import { Attachment, ChatMessage, GroundingSource, SearchSource } from '../types';
import { authService } from './authService';
import { usageService } from './usageService';
import { apiFetch, workerFetch } from './api';

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
      const res = await apiFetch('/api/health');
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
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

      if (params.systemInstruction?.trim()) {
        messages.push({ role: 'system', content: params.systemInstruction.trim() });
      }

      for (const item of params.history || []) {
        const role =
          item?.role === 'assistant' || item?.role === 'model' ? 'assistant' : 'user';
        const content = String(item?.text || item?.content || '').trim();
        if (content) messages.push({ role, content });
      }

      if (cleanMessage) messages.push({ role: 'user', content: cleanMessage });

      const res = await workerFetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: params.model || 'gpt-5.6',
          messages,
        }),
      });

      let data: any = {};
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || data?.error || `Palia AI Worker returned HTTP ${res.status}`,
        };
      }

      const content = data?.choices?.[0]?.message?.content;
      const text = Array.isArray(content)
        ? content.map((part: any) => part?.text || '').join('')
        : String(content || data?.output_text || data?.text || data?.reply || '');

      if (!text.trim()) {
        return { success: false, error: 'Palia AI Worker returned an empty response.' };
      }

      return {
        success: true,
        text,
        reply: text,
        answer: text,
        sources: data?.sources || [],
        searchQueries: data?.searchQueries || [],
        modelUsed: data?.model || params.model || 'gpt-5.6',
      };
    } catch (err: any) {
      console.error('aiService.sendMessage error:', err);
      return {
        success: false,
        text: '',
        reply: '',
        answer: '',
        error: err.message || 'Palia AI could not connect to the Cloudflare AI Worker.',
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
      const res = await apiFetch('/api/search', {
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
      const res = await apiFetch('/api/image/generate', {
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
      const res = await apiFetch('/api/document/analyze', {
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
      const res = await apiFetch('/api/translate', {
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
      const res = await apiFetch('/api/code/assist', {
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
      const res = await apiFetch('/api/resume/assist', {
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
      const res = await apiFetch('/api/tts', {
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
