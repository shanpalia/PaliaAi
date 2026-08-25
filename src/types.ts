export type ToolType =
  | 'chat'
  | 'image'
  | 'document'
  | 'translator'
  | 'resume'
  | 'code'
  | 'voice'
  | 'search'
  | 'dashboard';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'text';
  mimeType: string;
  size: number;
  dataUrl?: string; // base64 for images / preview
  textExtract?: string; // for documents
  progress?: number;
}

export interface SearchSource {
  title: string;
  uri: string;
  snippet?: string;
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role?: 'user' | 'assistant' | 'system';
  sender?: 'user' | 'assistant';
  content?: string;
  text?: string;
  timestamp: number | string;
  attachments?: Attachment[];
  sources?: GroundingSource[] | SearchSource[];
  searchQueries?: string[];
  toolUsed?: ToolType;
  generatedImageUrl?: string;
  isStreaming?: boolean;
  modelUsed?: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  toolType: ToolType;
  isPinned?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  tier: 'Free' | 'Pro' | 'Enterprise';
  plan?: string;
  credits: number;
  createdAt: number;
}

export interface CreditTransaction {
  id: string;
  timestamp: number | string;
  operation?: string;
  description?: string;
  amount: number; // negative for deduction, positive for top-up
  balanceAfter: number;
}

export interface DailyUsageStatus {
  user_id: string;
  usage_date: string;
  used_seconds: number;
  daily_limit_seconds: number;
  remaining_seconds: number;
  daily_limit_minutes: number;
  formatted_remaining: string;
  formatted_limit: string;
  formatted_used: string;
  is_limit_reached: boolean;
  allowed: boolean;
  warning: string | null;
  timezone: string;
  resets_in_seconds: number;
  resets_at: string;
}

export interface AdminUsageConfig {
  defaultDailyLimitMinutes: number;
  userOverrides: Record<string, number>;
  allRecordsCount?: number;
  todayActiveUsers?: number;
}

export interface UserSettings {
  language: string;
  defaultModel: string;
  temperature: number;
  systemInstruction: string;
  autoScroll: boolean;
  searchGroundingDefault: boolean;
  voiceName: string;
  autoPlayVoice: boolean;
  dailyLimitMinutes?: number;
  userTimezone?: string;
}

export type AppSettings = UserSettings;

export interface ResumeData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  headline: string;
  summary: string;
  experience: Array<{
    id: string;
    role: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
  }>;
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    field: string;
    graduationYear: string;
  }>;
  skills: string[];
  projects: Array<{
    id: string;
    name: string;
    link: string;
    description: string;
  }>;
}
