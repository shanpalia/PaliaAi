import React, { useState } from 'react';
import { Menu, Pencil, MoreVertical, Share2, Settings as SettingsIcon, User as UserIcon, Sparkles } from 'lucide-react';
import { ToolType, UserProfile } from '../../types';

interface HeaderProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenAuth?: () => void;
  onOpenShare?: () => void;
  user: UserProfile | null;
  credits: number;
  activeConversationTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTool,
  onSelectTool,
  onNewChat,
  onToggleSidebar,
  onOpenSettings,
  onOpenProfile,
  onOpenShare,
  user,
  activeConversationTitle,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const userName = user?.name?.trim() || '';
  const userEmail = user?.email?.trim() || '';
  const userInitial = (userName || userEmail).charAt(0).toUpperCase();
  const hasAvatarUrl = Boolean(user?.avatarUrl?.trim());

  return (
    <header id="palia-header" className="h-[64px] border-b border-slate-200/70 bg-white/95 backdrop-blur-xl px-3 sm:px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition-all"
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectTool('chat')}
          className="flex items-center gap-2.5 min-w-0 rounded-xl px-2 py-1.5 hover:bg-slate-50 transition-all"
          aria-label="Palia AI home"
        >
          <img src={`${import.meta.env.BASE_URL}palia-ai-icon.svg`} alt="Palia AI" className="w-9 h-9 rounded-[12px] shadow-sm" />
          <div className="min-w-0 text-left">
            <div className="font-bold text-[15px] text-slate-950 leading-tight truncate max-w-[42vw]">
              {activeConversationTitle || 'Palia AI'}
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-slate-400 mt-0.5">
              <Sparkles className="w-3 h-3 text-emerald-500" /> Palia AI
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          id="btn-header-new-chat"
          onClick={onNewChat}
          className="hidden sm:flex h-10 items-center gap-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-sm font-semibold"
          title="New chat"
        >
          <Pencil className="w-4 h-4" />
          <span>New chat</span>
        </button>

        <div className="relative">
          <button
            id="btn-header-more"
            onClick={() => setShowMenu(v => !v)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
            title="More"
            aria-label="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-12 w-52 bg-white/98 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-1.5 z-[100]">
              {onOpenShare && activeTool === 'chat' && (
                <button onClick={() => { setShowMenu(false); onOpenShare(); }} className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                  <Share2 className="w-4 h-4 text-slate-500" /> Share chat
                </button>
              )}
              <button onClick={() => { setShowMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                <SettingsIcon className="w-4 h-4 text-slate-500" /> Settings
              </button>
              <button onClick={() => { setShowMenu(false); onOpenProfile(); }} className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                <UserIcon className="w-4 h-4 text-slate-500" /> Profile
              </button>
            </div>
          )}
        </div>

        <button id="btn-header-profile" onClick={onOpenProfile} className="hidden sm:flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-emerald-500/20 transition-all" title={userName || 'Profile'}>
          {hasAvatarUrl ? (
            <img src={user?.avatarUrl} alt={userName || 'User'} className="w-9 h-9 rounded-full border border-slate-200 object-cover" />
          ) : userInitial ? (
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">{userInitial}</div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white font-bold text-sm flex items-center justify-center">P</div>
          )}
        </button>
      </div>
    </header>
  );
};
