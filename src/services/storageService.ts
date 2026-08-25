import { Conversation, UserSettings, UserProfile, ToolType, ChatMessage } from '../types';

const STORAGE_KEYS = {
  CONVERSATIONS: 'palia_conversations_v3',
  ACTIVE_CHAT_ID: 'palia_active_chat_id_v3',
  SETTINGS: 'palia_settings_v3',
  USER_PROFILE: 'palia_user_profile_v3',
};

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
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveConversations(conversations: Conversation[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to persist conversations', e);
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
    convs.unshift(newConv);
    this.saveConversations(convs);
    this.setActiveConversationId(newConv.id);
    return newConv;
  },

  addMessage(conversationId: string, message: ChatMessage): void {
    const convs = this.getConversations();
    const target = convs.find((c) => c.id === conversationId);
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
