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
      className="max-w-3xl mx-auto w-full px-3 sm:px-6 pb-4 sm:pb-6 relative"
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
        className={`relative flex flex-col bg-white/95 backdrop-blur-xl border rounded-[24px] shadow-[0_12px_40px_rgba(15,23,42,0.10)] p-2 transition-all duration-200 ${
          usage.is_limit_reached
            ? 'border-rose-200 bg-rose-50/20'
            : 'border-slate-200/90 hover:border-slate-300 focus-within:border-emerald-400 focus-within:shadow-[0_14px_45px_rgba(16,185,129,0.12)]'
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

        {/* ChatGPT-style composer controls */}
        <div className="flex items-center justify-between px-1 pb-1 pt-1">
          <div className="flex items-center gap-1 relative" ref={menuRef}>
            <button
              id="btn-composer-attachment"
              type="button"
              disabled={usage.is_limit_reached}
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
              title="Add photos and files"
              aria-label="Add photos and files"
            >
              <Plus className="w-6 h-6" />
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            {showAttachmentMenu && (
              <div id="attachment-menu-dropdown" className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-30">
                <button type="button" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); } setShowAttachmentMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 text-left"><ImageIcon className="w-4 h-4" />Upload image</button>
                <button type="button" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "application/pdf,.pdf"; fileInputRef.current.click(); } setShowAttachmentMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 text-left"><FileText className="w-4 h-4" />Upload PDF</button>
                <button type="button" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = ".txt,.md,.doc,.docx"; fileInputRef.current.click(); } setShowAttachmentMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-700 hover:bg-slate-50 text-left"><Paperclip className="w-4 h-4" />Upload document</button>
              </div>
            )}
            <button
              id="btn-composer-mic"
              type="button"
              disabled={usage.is_limit_reached}
              onClick={toggleSpeechRecognition}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${isListening ? "bg-rose-500 text-white animate-pulse" : "text-slate-700 hover:bg-slate-100"}`}
              title={isListening ? "Stop listening" : "Voice input"}
              aria-label="Voice input"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
          <div>
            {isLoading ? (
              <button id="btn-composer-stop" type="button" onClick={onStop} className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm hover:bg-slate-800" title="Stop generating">
                <StopCircle className="w-4 h-4" />
              </button>
            ) : (
              <button id="btn-composer-send" type="button" onClick={handleSend} disabled={usage.is_limit_reached || (!input.trim() && attachments.length === 0)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!usage.is_limit_reached && (input.trim() || attachments.length > 0) ? "bg-slate-950 text-white hover:bg-emerald-600 shadow-lg shadow-slate-900/10" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`} title="Send message" aria-label="Send message">
                <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>      </div>

      <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">Palia AI can make mistakes. Check important info.</p>
    </div>
  );
};
