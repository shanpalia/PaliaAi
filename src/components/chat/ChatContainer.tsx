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
          /* Empty / Landing Hero State */
          <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-10">
            {/* Professional Polish Greeting */}
            <div className="text-center mb-8 sm:mb-12">
              <div className="inline-block p-4 rounded-3xl bg-blue-50 mb-5 shadow-xs">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2 sm:mb-3 tracking-tight">
                Hello, I&apos;m Palia AI
              </h2>
              <p className="text-base sm:text-lg text-slate-500 font-normal">
                How can I help you today?
              </p>
            </div>

            {/* 8 Suggestion Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 w-full max-w-4xl">
              {suggestions.map((sug, idx) => {
                const Icon = sug.icon;
                return (
                  <div
                    key={idx}
                    id={`suggestion-card-${idx}`}
                    onClick={() =>
                      onSelectSuggestion(sug.prompt, sug.tool, sug.uploadType)
                    }
                    className="p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group select-none"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${sug.color} flex items-center justify-center mb-3 transition-colors`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                      {sug.title}
                    </p>
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
