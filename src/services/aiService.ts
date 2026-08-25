import { Attachment, ChatMessage, GroundingSource, SearchSource } from '../types';
import { authService } from './authService';
import { usageService } from './usageService';

export interface ChatResponse {
  success: boolean;
  text?: string;
  reply?: string;
  answer?: string;
  sources?: GroundingSource[] | SearchSource[];
  searchQueries?: string[];
  imageUrl?: string;
  modelUsed?: string;
  error?: string;
  isLimitReached?: boolean;
}

function getRequestMeta() {
  const user = authService.getUser();
  return {
    userId: user?.id || 'default_user',
    timezone: usageService.getTimezone() || 'Asia/Kolkata',
  };
}

export const aiService = {
  async checkHealth() {
    try {
      const res = await fetch('/api/health');
      return await res.json();
    } catch {
      return { status: 'error', apiConfigured: false };
    }
  },

  async sendMessage(params: {
    messages?: ChatMessage[];
    message?: string;
    attachments?: Attachment[];
    systemInstruction?: string;
    temperature?: number;
    model?: string;
    enableSearchGrounding?: boolean;
    history?: any[];
  }): Promise<ChatResponse> {
    try {
      const cleanMessage = (params.message || '').trim();
      const meta = getRequestMeta();
      const payload = {
        ...meta,
        message: cleanMessage,
        messages: params.messages,
        attachments: params.attachments,
        history: params.history,
        systemInstruction: params.systemInstruction,
        temperature: params.temperature,
        model: params.model || 'palia-ai-ultra',
        enableSearchGrounding: Boolean(params.enableSearchGrounding),
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : `Server error ${res.status}`),
          isLimitReached: isLimit,
        };
      }

      const text = data.text || data.reply || '';
      return {
        success: true,
        text,
        reply: text,
        answer: text,
        sources: data.sources || [],
        searchQueries: data.searchQueries || [],
        modelUsed: data.modelUsed || 'Palia AI',
      };
    } catch (err: any) {
      console.error('aiService.sendMessage error:', err);
      return {
        success: false,
        text: '',
        reply: '',
        answer: '',
        error:
          err.message ||
          'Palia AI is currently unable to connect to the assistant service. Please check your network and try again.',
      };
    }
  },

  async sendChatMessage(params: {
    message: string;
    model?: string;
    systemInstruction?: string;
    temperature?: number;
    enableSearchGrounding?: boolean;
    history?: any[];
    attachments?: Attachment[];
  }): Promise<ChatResponse> {
    return this.sendMessage(params);
  },

  async searchWeb(query: string): Promise<ChatResponse> {
    try {
      const cleanQuery = (query || '').trim();
      if (!cleanQuery) {
        return {
          success: false,
          error: 'Please enter a search topic or question.',
        };
      }

      const meta = getRequestMeta();
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, query: cleanQuery }),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : 'Web search query failed'),
          isLimitReached: isLimit,
        };
      }

      const text = data.text || data.reply || '';
      return {
        success: true,
        text,
        reply: text,
        answer: text,
        sources: data.sources || [],
        searchQueries: data.searchQueries || [cleanQuery],
        modelUsed: data.modelUsed || 'Palia AI Web Search',
      };
    } catch (err: any) {
      console.error('aiService.searchWeb error:', err);
      return {
        success: false,
        text: '',
        reply: '',
        answer: '',
        error:
          err.message ||
          'Palia AI Web Search service is currently unavailable. Please try again.',
      };
    }
  },

  async generateImage(params: {
    prompt: string;
    aspectRatio?: string;
    style?: string;
  }): Promise<{
    success: boolean;
    imageUrl?: string;
    description?: string;
    error?: string;
    isLimitReached?: boolean;
  }> {
    try {
      const meta = getRequestMeta();
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, ...params }),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : 'Image generation failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Image generation request failed.',
      };
    }
  },

  async analyzeDocument(params: {
    documentText: string;
    filename: string;
    mode?: 'summary' | 'qa' | 'extract' | 'translate';
    question?: string;
  }): Promise<{ success: boolean; result?: string; error?: string; isLimitReached?: boolean }> {
    try {
      const meta = getRequestMeta();
      const res = await fetch('/api/document/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, ...params }),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : 'Document analysis failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Document analysis request failed.',
      };
    }
  },

  async translate(params: {
    text: string;
    targetLang: string;
    sourceLang?: string;
    tone?: string;
  }): Promise<{
    success: boolean;
    translatedText?: string;
    detectedSourceLanguage?: string;
    phoneticGuide?: string;
    culturalNotes?: string;
    error?: string;
    isLimitReached?: boolean;
  }> {
    try {
      const meta = getRequestMeta();
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, ...params }),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : 'Translation failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Translation request failed.',
      };
    }
  },

  async assistCode(params: {
    code?: string;
    language?: string;
    action: 'generate' | 'explain' | 'debug' | 'optimize';
    prompt?: string;
  }): Promise<{ success: boolean; result?: string; error?: string; isLimitReached?: boolean }> {
    try {
      const meta = getRequestMeta();
      const res = await fetch('/api/code/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, ...params }),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : 'Code assistant failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Code assistant request failed.',
      };
    }
  },

  async assistResume(params: {
    section: string;
    role: string;
    details: string;
    action: 'summary' | 'bullet_points' | 'skills';
  }): Promise<{ success: boolean; result?: string; error?: string; isLimitReached?: boolean }> {
    try {
      const meta = getRequestMeta();
      const res = await fetch('/api/resume/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, ...params }),
      });

      const data = await res.json();
      if (data.usage) {
        usageService.updateFromApiResponse(data.usage);
      }

      if (!res.ok) {
        const isLimit = res.status === 429 || data.isLimitReached;
        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow."
              : 'Resume assistant failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Resume assistant request failed.',
      };
    }
  },

  async speakText(text: string, voiceName: string = 'Kore'): Promise<void> {
    try {
      const meta = getRequestMeta();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, text: text.slice(0, 500), voiceName }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.usage) {
          usageService.updateFromApiResponse(data.usage);
        }
        if (data.success && data.audioData) {
          const audio = new Audio(data.audioData);
          await audio.play();
          return;
        }
      }
      this.speakWithWebSpeech(text);
    } catch {
      this.speakWithWebSpeech(text);
    }
  },

  speakWithWebSpeech(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Browser TTS error:', e);
    }
  },
};
