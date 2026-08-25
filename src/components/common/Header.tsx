import React from 'react';
import {
  Menu,
  Settings as SettingsIcon,
  Share2,
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
}) => {
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
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Toggle Navigation Sidebar"
          aria-label="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Clean, spacious navigation tabs */}
        <nav className="flex items-center gap-4 sm:gap-6" aria-label="Main Navigation">
          <button
            id="nav-tab-chat"
            onClick={() => onSelectTool('chat')}
            className={`text-xs sm:text-sm font-semibold pb-1 transition-all cursor-pointer ${
              activeTool === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chat
          </button>
          <button
            id="nav-tab-tools"
            onClick={() => onSelectTool('dashboard')}
            className={`text-xs sm:text-sm font-semibold pb-1 transition-all cursor-pointer ${
              activeTool === 'dashboard'
                ? 'text-blue-600 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tools
          </button>
          <button
            id="nav-tab-search"
            onClick={() => onSelectTool('search')}
            className={`text-xs sm:text-sm font-semibold pb-1 transition-all cursor-pointer ${
              activeTool === 'search'
                ? 'text-blue-600 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Web Search
          </button>
        </nav>
      </div>

      {/* Right side: Desktop Share & Settings, plus Profile Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Desktop-only Share Button (when in chat) */}
        {onOpenShare && activeTool === 'chat' && (
          <button
            id="btn-header-share"
            onClick={onOpenShare}
            className="hidden sm:flex p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            title="Share conversation"
            aria-label="Share conversation"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}

        {/* Desktop-only Settings Button */}
        <button
          id="btn-header-settings"
          onClick={onOpenSettings}
          className="hidden sm:flex p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* Proper Profile Avatar Button (opens right-side profile drawer) */}
        <button
          id="btn-header-profile"
          onClick={onOpenProfile}
          className="flex items-center justify-center p-0.5 rounded-full hover:ring-2 hover:ring-blue-500/20 focus:outline-none transition-all cursor-pointer"
          title={userName || 'User Profile & Settings'}
          aria-label="User Profile & Settings"
        >
          {hasAvatarUrl ? (
            <img
              src={user?.avatarUrl}
              alt={userName || 'User'}
              className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 object-cover"
            />
          ) : userInitial ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center border border-blue-500/30 shadow-xs">
              {userInitial}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 hover:bg-slate-200 transition-colors">
              <UserIcon className="w-4 h-4" />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
