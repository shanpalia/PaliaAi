import React, { useState } from 'react';
import {
  Menu,
  Pencil,
  MoreVertical,
  Share2,
  Settings as SettingsIcon,
  User as UserIcon,
} from 'lucide-react';
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
  onToggleSidebar,
  onOpenSettings,
  onOpenProfile,
  onOpenAuth,
  onOpenShare,
  user,
  activeConversationTitle,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  // Determine if user has a name/email for initials or fallback
  const userName = user?.name?.trim() || '';
  const userEmail = user?.email?.trim() || '';
  const userInitial = userName
    ? userName.charAt(0).toUpperCase()
    : userEmail
    ? userEmail.charAt(0).toUpperCase()
    : '';

  const isLoggedIn = Boolean(user && user.id && user.id !== 'guest_user');
  const hasAvatarUrl = Boolean(user?.avatarUrl && user.avatarUrl.trim());

  return (
    <header
      id="palia-header"
      className="h-14 border-b border-slate-100 bg-white px-3 sm:px-6 flex items-center justify-between sticky top-0 z-20"
    >
      {/* Left side: Hamburger menu button + Clean Navigation Tabs (Chat, Tools, Web Search) */}
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Toggle Navigation Sidebar"
          aria-label="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          id="palia-chat-title"
          onClick={() => onSelectTool('chat')}
          className="min-w-0 max-w-[55vw] text-left"
          aria-label="Current chat"
        >
          <span className="block text-[17px] sm:text-lg font-semibold text-slate-900 truncate">
            {activeConversationTitle || 'Palia AI'}
          </span>
          <span className="hidden sm:block text-[10px] text-slate-400">Palia AI</span>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button id="btn-header-new-chat" onClick={onNewChat} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer" title="New chat" aria-label="New chat">
          <Pencil className="w-5 h-5" />
        </button>
        <div className="relative">
          <button id="btn-header-more" onClick={() => setShowMenu((v) => !v)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer" title="More" aria-label="More options">
            <MoreVertical className="w-5 h-5" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-12 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50">
              {onOpenShare && activeTool === 'chat' && <button onClick={() => { setShowMenu(false); onOpenShare(); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50">Share chat</button>}
              <button onClick={() => { setShowMenu(false); onOpenSettings(); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50">Settings</button>
              <button onClick={() => { setShowMenu(false); onOpenProfile(); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50">Profile</button>
            </div>
          )}
        </div>
        <button id="btn-header-profile" onClick={onOpenProfile} className="hidden sm:flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-blue-500/20 focus:outline-none transition-all cursor-pointer" title={userName || 'User Profile'} aria-label="User Profile">
          {hasAvatarUrl ? <img src={user?.avatarUrl} alt={userName || 'User'} className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 object-cover" /> : userInitial ? <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">{userInitial}</div> : <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200"><UserIcon className="w-4 h-4" /></div>}
        </button>
      </div>/div>
    </header>
  );
};
