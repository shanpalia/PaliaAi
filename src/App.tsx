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
import { AlertTriangle, Clock, X } from 'lucide-react';

export const App: React.FC = () => {
  // App Navigation & View State
  const [activeTool, setActiveTool] = useState<ToolType>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareTargetMsg, setShareTargetMsg] = useState<ChatMessage | null>(null);

  // User & Settings & Daily Usage
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(storageService.getSettings());
  const [credits, setCredits] = useState<number>(creditService.getBalance());
  const [isLoading, setIsLoading] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageStatus>(usageService.getStatus());
  const [dismissedWarning, setDismissedWarning] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const loadedConvs = storageService.getConversations();
    setConversations(loadedConvs);

    const currentUser = authService.getCurrentUser();
    setUser(currentUser);

    const activeId = storageService.getActiveConversationId();
    if (activeId && loadedConvs.some((c) => c.id === activeId)) {
      setActiveConversationId(activeId);
    } else if (loadedConvs.length > 0) {
      setActiveConversationId(loadedConvs[0].id);
      storageService.setActiveConversationId(loadedConvs[0].id);
    } else {
      // Create initial conversation
      handleNewChat();
    }

    // Subscribe to daily AI usage state
    const unsub = usageService.subscribe((u) => {
      setDailyUsage(u);
    });

    return unsub;
  }, []);

  // Sync state helpers
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const handleNewChat = (toolType: ToolType = 'chat') => {
    const newConv = storageService.createConversation('New Chat', toolType);
    setConversations(storageService.getConversations());
    setActiveConversationId(newConv.id);
    setActiveTool(toolType);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    storageService.setActiveConversationId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveTool(conv.toolType || 'chat');
    }
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
      setConversations(storageService.getConversations());
      setIsProfileOpen(true);
      return;
    }

    // Deduct credits (2 for chat, 5 for search mode)
    const cost = isSearchMode ? 5 : 2;
    const desc = isSearchMode ? 'Grounded Web Search Chat' : 'Palia AI Message';
    const hasCredits = await creditService.deductCredits(desc, cost);
    if (!hasCredits) {
      alert('Insufficient credits. Please top up in your profile.');
      setIsProfileOpen(true);
      return;
    }
    setCredits(creditService.getBalance());

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
    setConversations(storageService.getConversations());

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

      if (res.success && (res.reply || res.text)) {
        const replyText = res.reply || res.text || '';
        const botMsg: ChatMessage = {
          id: `msg_bot_${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: res.sources,
          searchQueries: res.searchQueries,
          modelUsed: 'Palia AI',
        };

        storageService.addMessage(activeConversationId, botMsg);
        setConversations(storageService.getConversations());
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

  return (
    <div id="palia-ai-app" className="flex h-screen w-screen bg-white text-slate-900 overflow-hidden font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Responsive Collapsible Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
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
        searchFilter={searchFilter}
        onSearchChange={setSearchFilter}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-white">
        {/* Navigation Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenShare={() => {
            setShareTargetMsg(null);
            setIsShareOpen(true);
          }}
          onNewChat={() => handleNewChat('chat')}
          activeConversationTitle={activeConversation?.title}
          user={user}
          credits={credits}
        />

        {/* Global Daily AI Limit Reached Banner */}
        {dailyUsage.is_limit_reached && (
          <div
            id="banner-daily-limit-reached"
            className="bg-rose-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs z-10 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Daily AI limit reached:</strong> You've used today's 2-hour AI allowance. Your AI access will reset tomorrow at midnight ({dailyUsage.timezone || 'Asia/Kolkata'}).
              </span>
            </div>
            <button
              onClick={() => setIsProfileOpen(true)}
              className="px-2.5 py-1 rounded-md bg-white text-rose-700 font-bold hover:bg-rose-50 text-[11px] transition-colors ml-3 cursor-pointer whitespace-nowrap"
            >
              View Usage
            </button>
          </div>
        )}

        {/* Friendly Low Remaining Allowance Notification (e.g., 60m, 30m, 10m, 5m) */}
        {!dailyUsage.is_limit_reached && dailyUsage.warning && dismissedWarning !== dailyUsage.warning && (
          <div
            id="banner-daily-usage-warning"
            className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs flex items-center justify-between z-10 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-semibold">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{dailyUsage.warning} (Daily limit: 2 hours)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="underline text-[11px] font-bold cursor-pointer"
              >
                Details
              </button>
              <button
                onClick={() => setDismissedWarning(dailyUsage.warning)}
                className="p-1 hover:bg-amber-600 rounded text-slate-900 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
