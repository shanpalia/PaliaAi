import { Conversation, UserSettings, UserProfile, ToolType, ChatMessage } from '../types';

const STORAGE_KEYS = {
  CONVERSATIONS: 'palia_conversations_v3',
  ACTIVE_CHAT_ID: 'palia_active_chat_id_v3',
  SETTINGS: 'palia_settings_v3',
  USER_PROFILE: 'palia_user_profile_v3',
};

const pendingConversations = new Map<string, Conversation>();
const MAX_SAVED_CONVERSATIONS = 30;
const MAX_SAVED_MESSAGES_PER_CONVERSATION = 50;

function compactConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: (conversation.messages || []).slice(-MAX_SAVED_MESSAGES_PER_CONVERSATION).map((message) => ({
      ...message,
      // Uploaded images stay in memory for the active request; never persist huge base64 payloads.
      attachments: message.attachments?.map((attachment) => ({
        ...attachment,
        // Preserve reasonably small image data URLs so uploaded photos remain visible
        // in chat history; omit large payloads to avoid exhausting localStorage quota.
        dataUrl:
          (
            attachment.type === 'image' ||
            String(attachment.mimeType || '').toLowerCase().startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(attachment.name || '')
          ) &&
          (attachment.dataUrl || '').length <= 700_000
            ? attachment.dataUrl
            : '',
      })),
    })),
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  defaultModel: 'palia-ai-ultra',
  temperature: 0.7,
  systemInstruction:
    'You are Palia AI, an advanced, highly capable, elegant, and friendly AI assistant developed by ShanPalia. Provide accurate, deeply helpful, structured, and beautiful answers. Format code cleanly with language tags and use structured markdown when helpful.',
  autoScroll: true,
  searchGroundingDefault: false,
  voiceName: 'Kore',
  autoPlayVoice: false,
};

const DEFAULT_USER: UserProfile = {
  id: 'guest_user',
  name: 'Shan Palia',
  email: 'shanpalia786@gmail.com',
  avatarUrl: '',
  tier: 'Pro',
  plan: 'Palia Pro',
  credits: 850,
  createdAt: Date.now(),
};

export const storageService = {
  getConversations(): Conversation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      if (!data) return [];
      const parsed = JSON.parse(data) as Conversation[];
      const useful = parsed.filter((c) => Array.isArray(c.messages) && c.messages.length > 0);
      if (useful.length !== parsed.length) this.saveConversations(useful);
      return useful;
    } catch {
      return [];
    }
  },

  saveConversations(conversations: Conversation[]): void {
    // Persist only real chats. Empty drafts are held in memory until the first message.
    const useful = conversations
      .filter((c) => Array.isArray(c.messages) && c.messages.length > 0)
      .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || b.updatedAt - a.updatedAt)
      .slice(0, MAX_SAVED_CONVERSATIONS)
      .map(compactConversation);

    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(useful));
    } catch (firstError) {
      // Retry with a smaller history if older messages or attachments still exceed browser quota.
      try {
        const reduced = useful.slice(0, 10).map((conversation) => ({
          ...conversation,
          messages: conversation.messages.slice(-15),
        }));
        localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(reduced));
      } catch (retryError) {
        console.error('Failed to persist conversations after reducing saved history', retryError || firstError);
      }
    }
  },

  createConversation(title: string = 'New Chat', toolType: ToolType = 'chat'): Conversation {
    const convs = this.getConversations();
    const newConv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      toolType,
    };
    // Empty chats stay temporary until a message is sent.
    pendingConversations.set(newConv.id, newConv);
    this.setActiveConversationId(newConv.id);
    return newConv;
  },

  addMessage(conversationId: string, message: ChatMessage): void {
    const convs = this.getConversations();
    let target = convs.find((c) => c.id === conversationId);
    if (!target) {
      target = pendingConversations.get(conversationId);
      if (target) { convs.unshift(target); pendingConversations.delete(conversationId); }
    }
    if (target) {
      target.messages.push(message);
      target.updatedAt = Date.now();
      // Auto-title conversation from first user query if still named "New Chat"
      if (target.title === 'New Chat' && (message.text || message.content)) {
        const text = (message.text || message.content || '').trim();
        target.title = text.slice(0, 32) + (text.length > 32 ? '...' : '');
      }
      this.saveConversations(convs);
    }
  },

  deleteConversation(id: string): void {
    pendingConversations.delete(id);
    const convs = this.getConversations().filter((c) => c.id !== id);
    this.saveConversations(convs);
  },

  renameConversation(id: string, newTitle: string): void {
    const convs = this.getConversations();
    const target = convs.find((c) => c.id === id);
    if (target) {
      target.title = newTitle;
      target.updatedAt = Date.now();
      this.saveConversations(convs);
    }
  },

  togglePinConversation(id: string): void {
    const convs = this.getConversations();
    const target = convs.find((c) => c.id === id);
    if (target) {
      target.isPinned = !target.isPinned;
      this.saveConversations(convs);
    }
  },

  getActiveConversationId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
    } catch {
      return null;
    }
  },

  setActiveConversationId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
      }
    } catch (e) {
      console.error('Failed to set active chat id', e);
    }
  },

  getSettings(): UserSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  getUserProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (!data) return DEFAULT_USER;
      return JSON.parse(data);
    } catch {
      return DEFAULT_USER;
    }
  },

  saveUserProfile(user: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save user profile', e);
    }
  },

  clearAllConversations(): void {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
  },

  exportAllData(): string {
    return JSON.stringify(
      {
        conversations: this.getConversations(),
        settings: this.getSettings(),
        user: this.getUserProfile(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  },
};
