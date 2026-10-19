import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ChatContainer } from './components/chat/ChatContainer';
import { ToolsDashboard } from './components/tools/ToolsDashboard';
import { ImageAITool } from './components/tools/ImageAITool';
import { DocumentAITool } from './components/tools/DocumentAITool';
import { TranslatorTool } from './components/tools/TranslatorTool';
import { ResumeBuilderTool } from './components/tools/ResumeBuilderTool';
import { CodingAssistantTool } from './components/tools/CodingAssistantTool';
import { VoiceAssistantTool } from './components/tools/VoiceAssistantTool';
import { WebSearchTool } from './components/tools/WebSearchTool';
import { AuthModal } from './components/modals/AuthModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ProfileDrawer } from './components/modals/ProfileDrawer';
import { ShareModal } from './components/modals/ShareModal';
import { UpgradeModal } from './components/modals/UpgradeModal';

import {
  Attachment,
  ChatMessage,
  Conversation,
  ToolType,
  UserProfile,
  UserSettings,
  DailyUsageStatus,
} from './types';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { creditService } from './services/creditService';
import { aiService } from './services/aiService';
import { usageService } from './services/usageService';
import { getFirebaseIdToken } from './services/authService';


function preserveLiveAttachments(saved: Conversation[], current: Conversation[]): Conversation[] {
  const currentById = new Map(current.map((conversation) => [conversation.id, conversation]));
  return saved.map((conversation) => {
    const live = currentById.get(conversation.id);
    if (!live) return conversation;
    const liveMessages = new Map(live.messages.map((message) => [message.id, message]));
    return {
      ...conversation,
      messages: conversation.messages.map((message) => {
        const liveMessage = liveMessages.get(message.id);
        if (!liveMessage?.attachments?.length || !message.attachments?.length) return message;
        const liveAttachments = new Map(liveMessage.attachments.map((attachment) => [attachment.id, attachment]));
        return {
          ...message,
          attachments: message.attachments.map((attachment) => {
            const liveAttachment = liveAttachments.get(attachment.id);
            return liveAttachment?.dataUrl ? { ...attachment, dataUrl: liveAttachment.dataUrl } : attachment;
          }),
        };
      }),
    };
  });
}

export const App: React.FC = () => {
  // App Navigation & View State
  const [activeTool, setActiveTool] = useState<ToolType>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const handleToggleSidebar = () => {
    if (window.innerWidth >= 1024) setSidebarCollapsed((v) => !v);
    else setSidebarOpen((v) => !v);
  };

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [shareTargetMsg, setShareTargetMsg] = useState<ChatMessage | null>(null);

  // User & Settings & Daily Usage
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(storageService.getSettings());
  const [credits, setCredits] = useState<number>(creditService.getBalance());
  const [isLoading, setIsLoading] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageStatus>(usageService.getStatus());
  const [paymentVerification, setPaymentVerification] = useState<'checking' | 'active' | 'pending' | 'signin'>('checking');

  // Initialize data on mount
  useEffect(() => {
    const loadedConvs = storageService.getConversations();
    setConversations(loadedConvs);

    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    // Keep the app state in sync with Firebase sessions and sign-out.
    const unsubscribeAuth = authService.subscribe((state) => setUser(state.user));

    // Always start with a fresh chat when the page/app is opened.
    // Previous conversations remain saved in the sidebar history.
    const newConv = storageService.createConversation('New Chat', 'chat');
    setConversations(loadedConvs.concat(newConv));
    setActiveConversationId(newConv.id);
    setActiveTool('chat');


    // Subscribe to daily AI usage state
    const unsub = usageService.subscribe((u) => {
      setDailyUsage(u);
    });

    return () => {
      unsub();
      unsubscribeAuth();
    };
  }, []);

  const paymentReturn = new URLSearchParams(window.location.search).get('payment');

  useEffect(() => {
    let cancelled = false;
    const verifySubscription = async () => {
      if (!user || user.id === 'guest_user') {
        if (paymentReturn === 'success' && !cancelled) setPaymentVerification('signin');
        return;
      }
      if (paymentReturn === 'success' && !cancelled) setPaymentVerification('checking');
      const token = await getFirebaseIdToken();
      if (!token) {
        if (paymentReturn === 'success' && !cancelled) setPaymentVerification('signin');
        return;
      }
      try {
        const response = await workerFetch('/subscription', { headers: { authorization: 'Bearer ' + token } });
        if (!response.ok) throw new Error('Subscription check unavailable');
        const data = await response.json() as { tier?: string; plan?: string | null };
        if (cancelled) return;
        const isPro = data.tier === 'Pro';
        authService.updateProfile({ tier: isPro ? 'Pro' : 'Free', plan: isPro ? (data.plan === 'yearly' ? 'Palia Pro Yearly' : 'Palia Pro Monthly') : 'Free Tier' });
        if (paymentReturn === 'success') setPaymentVerification(isPro ? 'active' : 'pending');
      } catch {
        if (!cancelled && paymentReturn === 'success') setPaymentVerification('pending');
      }
    };
    void verifySubscription();
    return () => { cancelled = true; };
  }, [paymentReturn, user?.id]);


  // Sync state helpers
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const handleNewChat = (toolType: ToolType = 'chat') => {
    const newConv = storageService.createConversation('New Chat', toolType);
    setConversations((current) => [newConv, ...current.filter((conversation) => conversation.id !== newConv.id)]);
    setActiveConversationId(newConv.id);
    setActiveTool(toolType);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    // Reload the selected saved conversation from storage so Recent always opens
    // the persisted messages rather than a stale in-memory list.
    const savedConversations = storageService.getConversations();
    const savedConversation = savedConversations.find((item) => item.id === id);
    const currentConversation = conversations.find((item) => item.id === id);
    const selected = savedConversation || currentConversation;

    if (selected) {
      const normalizedMessages = (Array.isArray(selected.messages) ? selected.messages : [])
        .filter((message: any) => message && typeof message === 'object')
        .map((message: any, index: number) => ({
          ...message,
          id: typeof message.id === 'string' && message.id ? message.id : `restored-${id}-${index}`,
          sender: message.sender || (message.role === 'user' ? 'user' : 'assistant'),
          text: typeof message.text === 'string' ? message.text : (typeof message.content === 'string' ? message.content : ''),
          timestamp: message.timestamp ?? Date.now(),
          attachments: Array.isArray(message.attachments) ? message.attachments.filter((attachment: any) => attachment && typeof attachment === 'object') : [],
        }));
      const hydrated = { ...selected, messages: normalizedMessages };
      setConversations((current) => {
        const others = current.filter((item) => item.id !== id);
        return [hydrated, ...others];
      });
      // Recent history items are conversations, so always render their saved
      // messages in ChatContainer instead of switching to a possibly empty tool screen.
      setActiveTool('chat');
    } else {
      setActiveTool('chat');
    }

    setActiveConversationId(id);
    storageService.setActiveConversationId(id);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSelectTool = (tool: ToolType) => {
    setActiveTool(tool);
    if (tool === 'chat') {
      if (!activeConversation) {
        handleNewChat('chat');
      }
    }
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Chat message sending with Palia AI backend
  const handleSendMessage = async (
    text: string,
    attachments: Attachment[],
    isSearchMode: boolean
  ) => {
    const cleanText = (text || '').trim();
    if (!cleanText && (!attachments || attachments.length === 0)) return;
    if (!user || user.id === 'guest_user') {
      setIsAuthOpen(true);
      return;
    }
    if (!activeConversationId) return;

    // Check if daily AI usage allowance is exhausted
    if (dailyUsage.is_limit_reached || dailyUsage.remaining_seconds <= 0) {
      const limitMsg: ChatMessage = {
        id: `msg_bot_limit_${Date.now()}`,
        sender: 'assistant',
        text: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      storageService.addMessage(activeConversationId, limitMsg);
      setConversations((current) => preserveLiveAttachments(storageService.getConversations(), current));
      setIsProfileOpen(true);
      return;
    }

    // Daily AI access is governed by the server-side 2-hour usage allowance.
    // Do not gate chat/search behind the legacy local credit counter.

    // 1. User Message
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };

    // Update conversation with user message
    storageService.addMessage(activeConversationId, userMsg);
    // Keep the original image data in memory for immediate display; storage intentionally strips base64 to avoid quota errors.
    setConversations((current) => {
      const withMessage = current.map((conversation) => conversation.id === activeConversationId
        ? { ...conversation, messages: [...conversation.messages.filter((message) => message.id !== userMsg.id), userMsg] }
        : conversation);
      return preserveLiveAttachments(storageService.getConversations(), withMessage);
    });

    // 2. Prepare AI Call
    setIsLoading(true);

    try {
      // Build history for multi-turn conversation (exclude the newly added user message and any error messages)
      const currentConv = storageService.getConversations().find((c) => c.id === activeConversationId);
      const allMsgs = currentConv?.messages || [];
      const prevMsgs = allMsgs
        .slice(0, -1)
        .filter((m) => m && m.text && !m.text.startsWith('⚠️ **Unable to complete response:'))
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: (m.text || m.content || '').trim(),
        }))
        .filter((m) => m.text.length > 0);

      const res = await aiService.sendChatMessage({
        message: cleanText,
        model: settings.defaultModel,
        systemInstruction: settings.systemInstruction,
        temperature: settings.temperature,
        enableSearchGrounding: isSearchMode || settings.searchGroundingDefault,
        history: prevMsgs,
        attachments,
      });

      if (res.success && (res.reply || res.text || res.imageUrl)) {
        const replyText = res.reply || res.text || '';
        const botMsg: ChatMessage = {
          id: `msg_bot_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: res.sources,
          searchQueries: res.searchQueries,
          modelUsed: 'Palia AI',
          generatedImageUrl: res.imageUrl,
        };

        storageService.addMessage(activeConversationId, botMsg);
        // Keep the full generated image in live React state. localStorage intentionally
        // drops large base64 image payloads to avoid quota errors, which otherwise made
        // the just-generated image disappear before it could render.
        const savedConversations = storageService.getConversations();
        setConversations(savedConversations.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                messages: [
                  ...conversation.messages.filter((message) => message.id !== botMsg.id),
                  botMsg,
                ],
              }
            : conversation,
        ));
      } else {
        const errorMsg: ChatMessage = {
          id: `msg_bot_err_${Date.now()}`,
          sender: 'assistant',
          text: res.isLimitReached
            ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
            : `⚠️ **Unable to complete response:** ${
                res.error || 'Palia AI could not process your request. Please try again.'
              }`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        storageService.addMessage(activeConversationId, errorMsg);
        setConversations(storageService.getConversations());
      }
    } catch (err: any) {
      console.error('Chat execution error:', err);
      const errorMsg: ChatMessage = {
        id: `msg_bot_err_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Unable to complete response:** ${
          err.message || 'An unexpected error occurred. Please try again.'
        }`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      storageService.addMessage(activeConversationId, errorMsg);
      setConversations(storageService.getConversations());
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    const lastUserMsg = [...activeConversation.messages]
      .reverse()
      .find((m) => m.sender === 'user');
    if (lastUserMsg && (lastUserMsg.text || (lastUserMsg.attachments && lastUserMsg.attachments.length > 0))) {
      handleSendMessage(
        lastUserMsg.text || '',
        lastUserMsg.attachments || [],
        activeConversation.toolType === 'search' || (lastUserMsg.sources && lastUserMsg.sources.length > 0) || false
      );
    }
  };

  const handleSelectSuggestion = (
    prompt: string,
    tool?: ToolType,
    uploadType?: 'image' | 'pdf'
  ) => {
    if (tool && tool !== 'chat' && tool !== 'search') {
      setActiveTool(tool);
    } else {
      setActiveTool('chat');
      // Prefill suggestions for guests; require sign-in only when they send.
      if (!user || user.id === 'guest_user') {
        setIsAuthOpen(true);
        return;
      }
      handleSendMessage(prompt, [], tool === 'search');
    }
  };

  const handleSendOutputToChat = (text: string, title?: string) => {
    handleNewChat('chat');
    // Send initial query
    setTimeout(() => {
      handleSendMessage(`Here is my document / code context:\n\n${text}`, [], false);
    }, 100);
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
  };

  const handleClearHistory = () => {
    storageService.clearAllConversations();
    setConversations([]);
    handleNewChat('chat');
  };

  if (paymentReturn === 'success') {
    const status = paymentVerification === 'active'
      ? { title: 'Payment verified', message: 'Your PaliaAi Pro subscription is active on this account.' }
      : paymentVerification === 'checking'
        ? { title: 'Checking payment status', message: 'We are checking your subscription status with the server. This page does not activate Pro by itself.' }
        : paymentVerification === 'signin'
          ? { title: 'Sign in to check status', message: 'Sign in with the same PaliaAi account used before checkout, then return here to check your subscription.' }
          : { title: 'Payment received — verification pending', message: 'Razorpay has returned you to PaliaAi, but the server has not confirmed an active subscription yet. Do not pay again; check your Razorpay receipt and try again shortly.' };
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${paymentVerification === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} text-3xl`} aria-hidden="true">{paymentVerification === 'active' ? '✓' : '…'}</div>
          <h1 className="mt-4 text-2xl font-bold">{status.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{status.message}</p>
          <button type="button" onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); window.location.reload(); }} className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">Return to PaliaAi</button>
        </section>
      </main>
    );
  }

  return (
    <div id="palia-ai-app" className="flex h-screen w-screen bg-white text-slate-900 overflow-hidden font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => handleNewChat('chat')}
        onDeleteConversation={(id) => {
          storageService.deleteConversation(id);
          const remaining = storageService.getConversations();
          setConversations(remaining);
          if (activeConversationId === id) {
            if (remaining.length > 0) {
              setActiveConversationId(remaining[0].id);
            } else {
              handleNewChat('chat');
            }
          }
        }}
        onRenameConversation={(id, newTitle) => {
          storageService.renameConversation(id, newTitle);
          setConversations(storageService.getConversations());
        }}
        onPinConversation={(id) => {
          storageService.togglePinConversation(id);
          setConversations(storageService.getConversations());
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        user={user}
        searchFilter={searchFilter}
        onSearchChange={setSearchFilter}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-white">
        {/* Navigation Header */}
        <Header
          onToggleSidebar={handleToggleSidebar}
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onUpgrade={() => setIsUpgradeOpen(true)}
          onOpenShare={() => {
            setShareTargetMsg(null);
            setIsShareOpen(true);
          }}
          onNewChat={() => handleNewChat('chat')}
          activeConversationTitle={activeConversation?.title}
          user={user}
          credits={credits}
        />

        {/* Daily usage is available from the profile drawer to keep the chat header uncluttered. */}

        {/* View Switcher based on Active Tool */}
        <main className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden">
          {activeTool === 'chat' && (
            <ChatContainer
              conversation={activeConversation}
              onSendMessage={handleSendMessage}
              onRegenerate={handleRegenerate}
              onShare={(msg) => {
                setShareTargetMsg(msg);
                setIsShareOpen(true);
              }}
              isLoading={isLoading}
              onSelectSuggestion={handleSelectSuggestion}
              ttsVoice={settings.voiceName}
            />
          )}

          {activeTool === 'dashboard' && (
            <ToolsDashboard onSelectTool={handleSelectTool} />
          )}

          {activeTool === 'image' && (
            <ImageAITool onSendToChat={handleSendOutputToChat} />
          )}

          {activeTool === 'document' && (
            <DocumentAITool onSendToChat={handleSendOutputToChat} />
          )}

          {activeTool === 'translator' && <TranslatorTool />}

          {activeTool === 'resume' && <ResumeBuilderTool />}

          {activeTool === 'code' && (
            <CodingAssistantTool onSendToChat={handleSendOutputToChat} />
          )}

          {activeTool === 'voice' && <VoiceAssistantTool />}

          {activeTool === 'search' && (
            <WebSearchTool onSendToChat={handleSendOutputToChat} />
          )}
        </main>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          setUser(authService.getCurrentUser());
          setCredits(creditService.getBalance());
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onClearHistory={handleClearHistory}
      />

      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onAuthRequired={() => {
          setIsProfileOpen(false);
          setIsAuthOpen(true);
        }}
        onOpenSettings={() => {
          setIsProfileOpen(false);
          setIsSettingsOpen(true);
        }}
        onUserUpdated={() => {
          setUser(authService.getCurrentUser());
          setCredits(creditService.getBalance());
        }}
      />

      <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} onAuthRequired={() => setIsAuthOpen(true)} />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        conversation={activeConversation}
        targetMessage={shareTargetMsg}
      />
    </div>
  );
};

export default App;
