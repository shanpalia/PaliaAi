import React, { useState } from 'react';
import { Menu, Pencil, MoreVertical, Share2, Settings as SettingsIcon, Sparkles, Crown } from 'lucide-react';
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
  onUpgrade?: () => void;
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
  onUpgrade,
  user,
  activeConversationTitle,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const userName = user?.name?.trim() || '';
  const userEmail = user?.email?.trim() || '';
  const userInitials = (userName || userEmail.split('@')[0] || 'Palia')
    .split(/[\\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'P';

  return (
    <header id="palia-header" className="h-[56px] border-b border-slate-200/70 bg-white px-3 sm:px-4 flex items-center justify-between sticky top-0 z-50">
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
          aria-label="Palia AI By ShanPalia home"
        >
          <img src={`${import.meta.env.BASE_URL}palia-ai-icon.svg?v=4`} alt="Palia AI By PaliaAPK HUB" className="w-9 h-9 rounded-[12px] object-contain" />
          <div className="min-w-0 text-left">
            <div className="font-bold text-[15px] text-slate-950 leading-tight truncate max-w-[42vw]">
              PaliaAi
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-slate-400 mt-0.5">
              <Sparkles className="w-3 h-3 text-emerald-500" /> By PaliaAPK HUB
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          id="btn-header-new-chat"
          onClick={onNewChat}
          className="hidden sm:flex h-9 items-center gap-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all text-sm font-semibold"
          title="New chat"
        >
          <Pencil className="w-4 h-4" />
          <span>New chat</span>
        </button>

        <button
          id="btn-header-upgrade"
          onClick={onUpgrade}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 cursor-pointer"
          title="Upgrade to Palia Pro"
        >
          <Crown className="h-4 w-4" />
          <span>Upgrade</span>
        </button>

        <button
          id="btn-header-profile"
          onClick={onOpenProfile}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-[#162B25] text-white text-xs font-bold border-2 border-[#D6E9DF] shadow-sm hover:opacity-90 transition"
          title={userName || userEmail || 'Profile'}
          aria-label="Open profile"
        >
          {user?.avatarUrl?.trim() ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : userInitials}
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
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
