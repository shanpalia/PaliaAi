import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Languages,
  FileSpreadsheet,
  Code2,
  Mic,
  Globe,
  Settings,
  Trash2,
  Edit2,
  Check,
  X,
  Pin,
  Coins,
  LayoutGrid,
} from 'lucide-react';
import { Conversation, ToolType, UserProfile } from '../../types';
import { Logo } from './Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onPinConversation: (id: string) => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenAuth?: () => void;
  searchFilter: string;
  onSearchChange: (val: string) => void;
  credits?: number;
  user?: UserProfile | null;
}

const toolsList: Array<{ id: ToolType; name: string; icon: React.ElementType; tag?: string }> = [
  { id: 'chat', name: 'AI Chat', icon: MessageSquare },
  { id: 'dashboard', name: 'Tools Hub', icon: LayoutGrid, tag: 'All' },
  { id: 'image', name: 'Image AI', icon: ImageIcon, tag: 'Visual' },
  { id: 'document', name: 'Document AI', icon: FileText, tag: 'PDF' },
  { id: 'translator', name: 'Translator', icon: Languages },
  { id: 'resume', name: 'Resume Builder', icon: FileSpreadsheet, tag: 'CV' },
  { id: 'code', name: 'Coding Assistant', icon: Code2 },
  { id: 'voice', name: 'Voice Assistant', icon: Mic, tag: 'Live' },
  { id: 'search', name: 'Web Search', icon: Globe, tag: 'Search' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTool,
  onSelectTool,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onOpenSettings,
  onOpenProfile,
  onOpenAuth,
  searchFilter,
  onSearchChange,
  credits = 850,
  user,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Filtered conversations based on search filter
  const filteredConversations = useMemo(() => {
    if (!searchFilter.trim()) return conversations;
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(searchFilter.toLowerCase().trim())
    );
  }, [conversations, searchFilter]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const oneDay = 86400000;
    const sevenDays = 7 * oneDay;

    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const recent: Conversation[] = [];
    const older: Conversation[] = [];

    for (const c of filteredConversations) {
      if (c.isPinned) {
        pinned.push(c);
      } else if (now - c.updatedAt < oneDay) {
        today.push(c);
      } else if (now - c.updatedAt < sevenDays) {
        recent.push(c);
      } else {
        older.push(c);
      }
    }

    return { pinned, today, recent, older };
  }, [filteredConversations]);

  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="palia-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-[260px] bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Branding Section */}
        <div className="p-6 pb-4 flex items-center justify-between">
          <Logo size="md" />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat & Search Input */}
        <div className="px-5 space-y-3">
          <button
            id="btn-sidebar-new-chat"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 py-2.5 rounded-xl text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-100/80 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>New Chat</span>
          </button>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-search-chats"
              type="text"
              value={searchFilter}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-slate-200/50 border-none rounded-lg py-2 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchFilter && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* AI Tools Suite Navigation */}
        <div className="px-5 py-3 border-b border-slate-200/60">
          <p className="text-[10px] font-bold text-slate-400 uppercase px-1 mb-2 tracking-wider">
            AI Tools
          </p>
          <div className="grid grid-cols-2 gap-1">
            {toolsList.map((tool) => {
              const Icon = tool.icon;
              const isSelected = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  id={`nav-tool-${tool.id}`}
                  onClick={() => {
                    onSelectTool(tool.id);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isSelected ? 'text-blue-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation History List */}
        <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-3 select-none">
          {filteredConversations.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              {searchFilter ? 'No chats found matching search' : 'No previous conversations'}
            </div>
          ) : (
            <>
              {/* Pinned Chats */}
              {grouped.pinned.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Pin className="w-2.5 h-2.5 text-blue-500" />
                    <span>Pinned</span>
                  </div>
                  <div className="space-y-1">
                    {grouped.pinned.map((chat) => renderChatItem(chat))}
                  </div>
                </div>
              )}

              {/* Today / Recent History */}
              {grouped.today.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider">
                    Recent History
                  </p>
                  <div className="space-y-1">
                    {grouped.today.map((chat) => renderChatItem(chat))}
                  </div>
                </div>
              )}

              {/* Recent 7 Days */}
              {grouped.recent.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider">
                    Previous 7 Days
                  </p>
                  <div className="space-y-1">
                    {grouped.recent.map((chat) => renderChatItem(chat))}
                  </div>
                </div>
              )}

              {/* Older */}
              {grouped.older.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider">
                    Older
                  </p>
                  <div className="space-y-1">
                    {grouped.older.map((chat) => renderChatItem(chat))}
                  </div>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Bottom Profile & Settings Area */}
        <div className="mt-auto p-4 border-t border-slate-200 space-y-3 bg-slate-50">
          {/* Quick Tools Link */}
          <div
            onClick={() => {
              onSelectTool('dashboard');
              onClose();
            }}
            className="flex items-center gap-3 px-2 text-slate-600 hover:text-blue-600 cursor-pointer transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-sm font-medium">Tools</span>
          </div>

          {/* AI Credits Badge */}
          <div
            onClick={() => {
              onOpenProfile();
              onClose();
            }}
            className="flex items-center justify-between px-3 bg-blue-100/50 py-2 rounded-lg cursor-pointer hover:bg-blue-100/80 transition-colors"
          >
            <span className="text-[11px] font-bold text-blue-700 uppercase">
              AI Credits: {credits}
            </span>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <button
              id="sidebar-user-card"
              onClick={() => {
                if (user && user.id !== 'guest_user') {
                  onOpenProfile();
                } else {
                  (onOpenAuth || onOpenProfile)();
                }
                onClose();
              }}
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User'}
                  className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'P'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {user?.name || 'Shan Palia'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.plan === 'pro' || user?.plan === 'Palia Pro' ? 'Pro Member' : 'Palia Pro'}
                </p>
              </div>
            </button>

            <button
              id="btn-sidebar-settings"
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );

  function renderChatItem(chat: Conversation) {
    const isSelected = activeConversationId === chat.id;
    const isEditing = editingId === chat.id;

    if (isEditing) {
      return (
        <form
          key={chat.id}
          onSubmit={(e) => handleSaveRename(chat.id, e)}
          className="flex items-center gap-1 px-2 py-1 bg-white border border-indigo-200 rounded-lg"
        >
          <input
            type="text"
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full text-xs text-slate-900 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            className="p-0.5 text-indigo-600 hover:text-indigo-800"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="p-0.5 text-slate-400 hover:text-slate-600"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      );
    }

    return (
      <div
        key={chat.id}
        id={`chat-item-${chat.id}`}
        onClick={() => {
          onSelectConversation(chat.id);
          onClose();
        }}
        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all ${
          isSelected
            ? 'bg-slate-100 text-slate-900 font-medium'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
          <MessageSquare
            className={`w-3.5 h-3.5 flex-shrink-0 ${
              isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
          <span className="truncate">{chat.title || 'Untitled Chat'}</span>
        </div>

        {/* Hover Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPinConversation(chat.id);
            }}
            className={`p-1 rounded hover:bg-slate-200/80 transition-colors ${
              chat.isPinned ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
            title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => handleStartRename(chat, e)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteConversation(chat.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/80 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
};
