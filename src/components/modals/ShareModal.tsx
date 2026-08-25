import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  FileText,
  Code,
  Download,
  Link,
} from 'lucide-react';
import { Conversation, ChatMessage } from '../../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  targetMessage?: ChatMessage | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  conversation,
  targetMessage,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen || !conversation) return null;

  const shareUrl = `${window.location.origin}/share/${conversation.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportMarkdown = () => {
    let md = `# ${conversation.title}\n\n*Exported from Palia AI (${new Date().toLocaleString()})*\n\n---\n\n`;
    for (const m of conversation.messages) {
      const isUser = m.role === 'user' || m.sender === 'user';
      const sender = isUser ? '### 👤 User' : '### 🤖 Palia AI';
      const text = m.content || m.text || '';
      md += `${sender} (${m.timestamp})\n\n${text}\n\n---\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(conversation, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
  };

  return (
    <div
      id="share-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="share-modal-container"
        className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Share Conversation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share Link Box */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500">Public Shareable URL</label>
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <Link className="w-4 h-4 text-slate-400 ml-2 flex-shrink-0" />
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 bg-transparent text-xs text-slate-700 outline-none truncate"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Export Formats */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Export Transcript
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportMarkdown}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-800 text-xs font-semibold flex items-center gap-2 transition-all text-left"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="block">Markdown (.md)</span>
                <span className="text-[10px] text-slate-400 font-normal">Formatted text</span>
              </div>
            </button>

            <button
              onClick={handleExportJSON}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-slate-800 text-xs font-semibold flex items-center gap-2 transition-all text-left"
            >
              <Code className="w-4 h-4 text-purple-600" />
              <div>
                <span className="block">JSON (.json)</span>
                <span className="text-[10px] text-slate-400 font-normal">Raw payload</span>
              </div>
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
