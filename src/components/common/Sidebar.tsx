import React, { useState, useMemo, useRef } from 'react';
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
  collapsed?: boolean;
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
  collapsed = false,
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
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 1024) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.innerWidth >= 1024 || touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    if (!isDragging.current && Math.abs(dx) < 8) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    isDragging.current = true;
    if (dx < 0) {
      e.preventDefault();
      setDragX(Math.max(dx, -320));
    }
  };

  const handleTouchEnd = () => {
    if (window.innerWidth >= 1024) return;
    if (isDragging.current && dragX < -70) onClose();
    setDragX(0);
    touchStartX.current = null;
    touchStartY.current = null;
    isDragging.current = false;
  };

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
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-30 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="palia-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-[min(86vw,320px)] bg-white border-r border-slate-200 flex flex-col transform-gpu transition-[width,transform,box-shadow] duration-300 ease-out lg:relative lg:z-40 lg:translate-x-0 lg:shadow-none ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'lg:w-[76px]' : 'lg:w-[286px]'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: window.innerWidth < 1024
            ? (isOpen ? `translate3d(${dragX}px,0,0)` : 'translate3d(-100%,0,0)')
            : undefined,
          transition: isDragging.current ? 'none' : 'transform 300ms cubic-bezier(0.22,1,0.36,1)',
          willChange: 'transform',
          touchAction: 'pan-y',
        }}
      >
        {/* Top Branding Section */}
        <div className={`p-4 sm:p-5 flex items-center justify-between ${collapsed ? "lg:justify-center" : ""}`}>
          <div className={collapsed ? "lg:hidden" : ""}><Logo size="md" /></div>
          <img src={`${import.meta.env.BASE_URL}palia-ai-icon.svg`} alt="Palia AI" className={`hidden w-9 h-9 rounded-xl ${collapsed ? "lg:block" : ""}`} />
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat & Search Input */}
        <div className={`px-3 sm:px-5 space-y-3 ${collapsed ? "lg:px-3" : ""}`}>
          <button
            id="btn-sidebar-new-chat"
            title={collapsed ? "New chat" : undefined}
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className={`w-full flex items-center justify-center gap-2 bg-white border border-slate-200 py-2.5 rounded-xl text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-100/80 active:scale-[0.98] transition-all cursor-pointer ${collapsed ? "lg:px-0" : ""}`}
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span className={collapsed ? "lg:hidden" : ""}>New Chat</span>
          </button>

          {/* Search Box */}
          <div className={collapsed ? "lg:hidden relative" : "relative"}>
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

        {/* Palia AI Tools Suite Navigation */}
        <div className={`px-3 sm:px-5 py-3 border-b border-slate-200/60 ${collapsed ? "lg:px-2" : ""}`}>
          <p className={`text-[10px] font-bold text-slate-400 uppercase px-1 mb-2 tracking-wider ${collapsed ? "lg:hidden" : ""}`}>
            AI Tools
          </p>
          <div className={`grid gap-1 ${collapsed ? "lg:grid-cols-1" : "grid-cols-2"}`}>
            {toolsList.map((tool) => {
              const Icon = tool.icon;
              const isSelected = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  id={`nav-tool-${tool.id}`}
                  title={collapsed ? tool.name : undefined}
                  onClick={() => {
                    onSelectTool(tool.id);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${collapsed ? "lg:justify-center lg:px-0" : ""} ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isSelected ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation History List */}
        <nav className={`flex-1 overflow-y-auto px-3 py-3 space-y-3 select-none ${collapsed ? "lg:px-2" : "lg:px-4"}`}>
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
                  <p className={`text-[10px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider ${collapsed ? "lg:hidden" : ""}`}>
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
                  <p className={`text-[10px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider ${collapsed ? "lg:hidden" : ""}`}>
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
                  <p className={`text-[10px] font-bold text-slate-400 uppercase px-2 mb-1.5 tracking-wider ${collapsed ? "lg:hidden" : ""}`}>
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
        <div className={`mt-auto p-3 border-t border-slate-200 space-y-3 bg-slate-50 ${collapsed ? "lg:p-2" : "lg:p-4"}`}>
          {/* Quick Tools Link */}
          <button type="button" title={collapsed ? "Tools" : undefined} onClick={() => { onSelectTool("dashboard"); onClose(); }} className={`w-full flex items-center gap-3 px-2 py-2 text-slate-600 hover:text-emerald-600 hover:bg-white rounded-lg cursor-pointer transition-colors active:scale-[0.98] ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
            <LayoutGrid className="w-4 h-4" />
            <span className={collapsed ? "lg:hidden text-sm font-medium" : "text-sm font-medium"}>Tools</span>
          </button>

          {/* AI Credits Badge */}
          <button type="button" title={collapsed ? "AI Credits" : undefined} onClick={() => { onOpenProfile(); onClose(); }} className={`w-full flex items-center justify-between px-3 bg-emerald-50 py-2 rounded-lg cursor-pointer hover:bg-blue-100/80 active:scale-[0.99] transition-colors ${collapsed ? "lg:justify-center lg:px-1" : ""}`}>
            <span className={collapsed ? "lg:hidden text-[11px] font-bold text-emerald-700 uppercase" : "text-[11px] font-bold text-blue-700 uppercase"}>
              AI Credits: {credits}
            </span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          </button>

          {/* User Profile Card */}
          <div className={`flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs ${collapsed ? "lg:justify-center lg:p-1.5" : ""}`}>
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
              className={`flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer ${collapsed ? "lg:justify-center" : ""}`}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User'}
                  className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'P'}
                </div>
              )}
              <div className={collapsed ? "lg:hidden flex-1 min-w-0" : "flex-1 min-w-0"}>
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
              className={`p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer ${collapsed ? "lg:hidden" : ""}`}
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
            className="p-0.5 text-emerald-600 hover:text-indigo-800 cursor-pointer"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
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
            className={`p-1 rounded hover:bg-slate-200/80 transition-colors cursor-pointer ${
              chat.isPinned ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
            title={chat.isPinned ? 'Unpin chat' : 'Pin chat'}
          >
            <Pin className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => handleStartRename(chat, e)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 transition-colors cursor-pointer"
            title="Rename"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteConversation(chat.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }
};
