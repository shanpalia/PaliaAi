import React from 'react';
import { X, FileText, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { Attachment } from '../../types';

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachments,
  onRemove,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2 px-3 bg-slate-50 border-b border-slate-200/80">
      {attachments.map((att) => {
        const isImage = att.type === 'image';
        return (
          <div
            key={att.id}
            id={`att-preview-${att.id}`}
            className="group relative flex items-center gap-2 pr-7 pl-2 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs text-xs"
          >
            {isImage && att.dataUrl ? (
              <img
                src={att.dataUrl}
                alt={att.name}
                className="w-7 h-7 rounded object-cover border border-slate-200"
              />
            ) : (
              <div className="w-7 h-7 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FileText className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0 max-w-[150px]">
              <p className="font-medium text-slate-800 truncate leading-tight">{att.name}</p>
              <p className="text-[10px] text-slate-400">
                {(att.size / 1024).toFixed(1)} KB · {att.type.toUpperCase()}
              </p>
            </div>

            <button
              onClick={() => onRemove(att.id)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Remove attachment"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
