import React, { useRef, useEffect, useState } from 'react';
import {
  Sparkles,
  HelpCircle,
  PenTool,
  Image as ImageIcon,
  FileText,
  Languages,
  Code2,
  Palette,
  Globe,
  ArrowDown,
  Bot,
} from 'lucide-react';
import { Attachment, ChatMessage, Conversation, ToolType } from '../../types';
import { ChatMessageItem } from './ChatMessageItem';
import { MessageComposer } from './MessageComposer';

interface ChatContainerProps {
  conversation: Conversation | null;
  onSendMessage: (text: string, attachments: Attachment[], isSearchMode: boolean) => void;
  onRegenerate: () => void;
  onShare: (msg: ChatMessage) => void;
  isLoading: boolean;
  onSelectSuggestion: (prompt: string, tool?: ToolType, autoTriggerUpload?: 'image' | 'pdf') => void;
  ttsVoice?: string;
}

const suggestions = [
  {
    icon: HelpCircle,
    title: 'Explain something',
    prompt: 'Explain how quantum computing works in simple terms with everyday analogies.',
    tool: 'chat' as ToolType,
    color: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
  },
  {
    icon: PenTool,
    title: 'Write something',
    prompt: 'Write a high-converting announcement email for our upcoming software launch.',
    tool: 'chat' as ToolType,
    color: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
  },
  {
    icon: ImageIcon,
    title: 'Analyze image',
    prompt: 'Please analyze this attached image in detail and extract all key insights.',
    tool: 'image' as ToolType,
    uploadType: 'image' as const,
    color: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
  },
  {
    icon: FileText,
    title: 'Analyze PDF',
    prompt: 'Please provide an executive summary and extract key points from this document.',
    tool: 'document' as ToolType,
    uploadType: 'pdf' as const,
    color: 'bg-red-50 text-red-600 group-hover:bg-red-100',
  },
  {
    icon: Code2,
    title: 'Help me code',
    prompt: 'Write a robust TypeScript function to debounce an API call with cancel token and TypeScript generics.',
    tool: 'code' as ToolType,
    color: 'bg-green-50 text-green-600 group-hover:bg-green-100',
  },
  {
    icon: Languages,
    title: 'Translate text',
    prompt: 'Translate the phrase "Welcome to our futuristic world" into French, Japanese, and Spanish.',
    tool: 'translator' as ToolType,
    color: 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100',
  },
  {
    icon: Globe,
    title: 'Search web',
    prompt: 'What are the most recent major breakthroughs in artificial intelligence research this year?',
    tool: 'search' as ToolType,
    color: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
  },
  {
    icon: Palette,
    title: 'Create image',
    prompt: 'A futuristic glass neural observatory floating above clouds at sunrise, cinematic lighting, 8k render',
    tool: 'image' as ToolType,
    color: 'bg-pink-50 text-pink-600 group-hover:bg-pink-100',
  },
];

export const ChatContainer: React.FC<ChatContainerProps> = ({
  conversation,
  onSendMessage,
  onRegenerate,
  onShare,
  isLoading,
  onSelectSuggestion,
  ttsVoice = 'Kore',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messages = conversation?.messages || [];
  const isEmpty = messages.length === 0;

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length, isLoading]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isFarFromBottom);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
      {/* Messages / Hero Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col"
      >
        {isEmpty ? (
          /* Premium landing state */
          <div className="flex-1 flex flex-col items-center justify-center px-5 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-16 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-emerald-100/30 blur-3xl" />
              <div className="absolute left-[12%] bottom-20 w-40 h-40 rounded-full bg-cyan-100/20 blur-3xl" />
            </div>
            <div className="relative z-10 text-center mb-8 sm:mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-emerald-100 shadow-sm text-[11px] font-semibold text-emerald-700 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Palia AI
              </div>
              <div className="mb-5">
                <img
                  src={`${import.meta.env.BASE_URL}palia-ai-icon.svg`}
                  alt="Palia AI"
                  className="w-[76px] h-[76px] mx-auto rounded-[24px] shadow-xl shadow-emerald-200/40"
                />
              </div>
              <h2 className="text-[32px] sm:text-[46px] font-bold text-slate-950 tracking-[-0.04em] leading-tight">
                What can I help you <span className="text-emerald-500">create?</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-500">
                Ask anything, explore ideas, analyze files, search the web, or create images.
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[760px]">
              {suggestions.map((sug, idx) => {
                const Icon = sug.icon;
                return (
                  <div
                    key={idx}
                    id={`suggestion-card-${idx}`}
                    onClick={() =>
                      onSelectSuggestion(sug.prompt, sug.tool, sug.uploadType)
                    }
                    className="p-4 sm:p-5 bg-white/90 backdrop-blur border border-slate-200/80 rounded-2xl cursor-pointer hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/50 transition-all group select-none text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${sug.color} flex items-center justify-center transition-colors flex-shrink-0`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">{sug.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Start with Palia AI</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Active Chat Messages */
          <div className="flex-1 divide-y divide-slate-100">
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                onRegenerate={onRegenerate}
                onShare={onShare}
                ttsVoice={ttsVoice}
              />
            ))}

            {/* Professional AI Typing / Thinking Indicator */}
            {isLoading && (
              <div
                id="palia-thinking-indicator"
                className="py-4 sm:py-6 px-4 sm:px-6 bg-slate-50/70 border-t border-slate-100"
              >
                <div className="max-w-3xl mx-auto flex gap-3 sm:gap-4 items-center">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-200 animate-pulse">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      Palia AI is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          id="btn-scroll-bottom"
          onClick={() => scrollToBottom(true)}
          className="absolute right-6 bottom-28 p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-md hover:shadow-lg transition-all z-10"
          title="Scroll to latest message"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}

      {/* Message Composer pinned at bottom with subtle gradient */}
      <div className="bg-gradient-to-t from-white via-white to-transparent">
        <MessageComposer
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          defaultSearchMode={conversation?.toolType === 'search'}
        />
      </div>
    </div>
  );
};
