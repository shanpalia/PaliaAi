import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ArrowUp,
  Mic,
  Globe,
  Image as ImageIcon,
  FileText,
  Paperclip,
  Sparkles,
  StopCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Attachment, DailyUsageStatus } from '../../types';
import { AttachmentPreview } from './AttachmentPreview';
import { usageService } from '../../services/usageService';

interface MessageComposerProps {
  onSendMessage: (text: string, attachments: Attachment[], isSearchMode: boolean) => void;
  isLoading: boolean;
  onStop?: () => void;
  placeholder?: string;
  defaultSearchMode?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  isLoading,
  onStop,
  placeholder = 'Ask Palia AI...',
  defaultSearchMode = false,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(defaultSearchMode);
  const [isListening, setIsListening] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [usage, setUsage] = useState<DailyUsageStatus>(usageService.getStatus());

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const unsub = usageService.subscribe((u) => {
      setUsage(u);
    });
    return unsub;
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  // Click outside listener for attachment menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Web Speech API Voice Dictation
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please try modern Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds 10MB limit.`);
        continue;
      }

      const isImg = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isDoc =
        file.name.endsWith('.txt') ||
        file.name.endsWith('.doc') ||
        file.name.endsWith('.docx') ||
        file.name.endsWith('.md');

      let type: Attachment['type'] = 'text';
      if (isImg) type = 'image';
      else if (isPdf) type = 'pdf';
      else if (isDoc) type = 'doc';

      // Read file
      if (isImg) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments((prev) => [
            ...prev,
            {
              id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              type: 'image',
              mimeType: file.type || 'image/png',
              size: file.size,
              dataUrl: e.target?.result as string,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        // Read text content
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = (e.target?.result as string) || '';
          setAttachments((prev) => [
            ...prev,
            {
              id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              type,
              mimeType: file.type || 'text/plain',
              size: file.size,
              textExtract: content.slice(0, 50000), // first 50k chars
            },
          ]);
        };
        reader.readAsText(file);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (usage.is_limit_reached) return;
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isLoading) return;

    onSendMessage(trimmed, attachments, isSearchMode);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      id="message-composer-wrapper"
      className="max-w-4xl mx-auto w-full px-4 sm:px-8 pb-4 relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {/* Drag Overlay Notice */}
      {isDragging && (
        <div className="absolute inset-x-4 inset-y-0 rounded-2xl bg-blue-50/90 border-2 border-dashed border-blue-400 z-30 flex items-center justify-center pointer-events-none backdrop-blur-xs">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <Paperclip className="w-5 h-5 animate-bounce" />
            <span>Drop images or documents to attach to Palia AI</span>
          </div>
        </div>
      )}

      {/* Main Composer Box */}
      <div
        className={`relative flex flex-col bg-white border rounded-2xl shadow-xl shadow-slate-100 p-2 transition-all duration-200 ${
          usage.is_limit_reached
            ? 'border-rose-200 bg-rose-50/20'
            : 'border-slate-200 hover:border-slate-300 focus-within:border-blue-500 focus-within:shadow-md'
        }`}
      >
        {/* Pending Attachment previews */}
        <AttachmentPreview attachments={attachments} onRemove={handleRemoveAttachment} />

        {/* Limit reached warning inside composer */}
        {usage.is_limit_reached && (
          <div className="mx-2 mb-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>
                Daily AI limit reached: You've used today's 2-hour AI allowance. Your access resets tomorrow.
              </span>
            </div>
            <button
              onClick={() => usageService.resetUsage()}
              className="text-[11px] font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer ml-2"
            >
              Reset for testing
            </button>
          </div>
        )}

        {/* Text Input Area */}
        <div className="w-full">
          <textarea
            id="composer-textarea"
            ref={textareaRef}
            rows={1}
            value={input}
            disabled={usage.is_limit_reached}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              usage.is_limit_reached
                ? "Daily AI limit reached. You've used today's 2-hour AI allowance."
                : isSearchMode
                ? 'Search the web with Palia AI live grounding...'
                : placeholder
            }
            className={`w-full border-none focus:ring-0 text-slate-700 resize-none px-4 py-3 placeholder:text-slate-400 focus:outline-none min-h-[44px] max-h-[180px] leading-relaxed text-sm sm:text-base bg-transparent ${
              usage.is_limit_reached ? 'cursor-not-allowed text-slate-400' : ''
            }`}
          />
        </div>

        {/* Action Controls Toolbar: [ + ] [ Mic ] | [ Model/Search ] [ Send ] */}
        <div className="flex items-center justify-between px-2 pb-1 pt-1">
          {/* Left Actions: Attachment Menu + Voice + Divider + Model tag */}
          <div className="flex items-center gap-1 relative" ref={menuRef}>
            {/* Attachment Button */}
            <button
              id="btn-composer-attachment"
              type="button"
              disabled={usage.is_limit_reached}
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Add attachments (Images, PDF, Documents)"
              aria-label="Add attachments"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Attachment Popover Menu */}
            {showAttachmentMenu && (
              <div
                id="attachment-menu-dropdown"
                className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-30 space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*';
                      fileInputRef.current.click();
                    }
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-purple-500" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'application/pdf,.pdf';
                      fileInputRef.current.click();
                    }
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-red-500" />
                  <span>Upload PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = '.txt,.md,.doc,.docx';
                      fileInputRef.current.click();
                    }
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left cursor-pointer"
                >
                  <Paperclip className="w-4 h-4 text-amber-500" />
                  <span>Upload Document</span>
                </button>
              </div>
            )}

            {/* Voice Dictation Button */}
            <button
              id="btn-composer-mic"
              type="button"
              disabled={usage.is_limit_reached}
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-200'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={isListening ? 'Stop listening' : 'Speak to Palia AI'}
              aria-label="Voice input"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>

            {/* Subtle Divider */}
            <div className="h-6 w-[1px] bg-slate-200 mx-1 mt-0.5" />

            {/* Web Search / Model tag */}
            <button
              id="btn-composer-search-toggle"
              type="button"
              disabled={usage.is_limit_reached}
              onClick={() => setIsSearchMode(!isSearchMode)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${
                isSearchMode
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Toggle Live Web Grounding"
            >
              {isSearchMode ? 'Web Search ON' : 'Palia AI'}
            </button>
          </div>

          {/* Right Action: Send / Stop Button */}
          <div>
            {isLoading ? (
              <button
                id="btn-composer-stop"
                type="button"
                onClick={onStop}
                className="bg-slate-800 text-white p-2.5 rounded-xl shadow-md hover:bg-slate-900 transition-all cursor-pointer"
                title="Stop generating"
              >
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button
                id="btn-composer-send"
                type="button"
                onClick={handleSend}
                disabled={usage.is_limit_reached || (!input.trim() && attachments.length === 0)}
                className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                  !usage.is_limit_reached && (input.trim() || attachments.length > 0)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
                title={usage.is_limit_reached ? 'Daily limit reached' : 'Send message (Enter)'}
                aria-label="Send message"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
        Palia AI can make mistakes. Check important info.
      </p>
    </div>
  );
};
