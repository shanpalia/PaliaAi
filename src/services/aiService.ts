import { Attachment, ChatMessage, GroundingSource, SearchSource } from '../types';
import { authService } from './authService';
import { usageService } from './usageService';
import { apiFetch, workerFetch } from './api';
import { detectPaliaIntent } from './intentService';

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

  let clientId = '';
  if (typeof window !== 'undefined') {
    try {
      clientId = localStorage.getItem('palia_ai_client_id') || '';
      if (!clientId) {
        clientId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `palia-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem('palia_ai_client_id', clientId);
      }
    } catch {}
  }

  return {
    userId: user?.id || '',
    clientId,
    timezone: usageService.getTimezone() || 'Asia/Kolkata',
  };
}

function buildMessages(
  history: any[] | undefined,
  systemInstruction: string | undefined,
  cleanMessage: string,
) {
  const messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [];

  if (systemInstruction?.trim()) {
    messages.push({
      role: 'system',
      content: systemInstruction.trim(),
    });
  }

  for (const item of history || []) {
    const role =
      item?.role === 'assistant' || item?.role === 'model'
        ? 'assistant'
        : 'user';
    const content = String(item?.text || item?.content || '').trim();
    if (content) messages.push({ role, content });
  }

  if (cleanMessage) {
    messages.push({
      role: 'user',
      content: cleanMessage,
    });
  }

  return messages;
}

function getAttachments(attachments: Attachment[] | undefined) {
  return (attachments || [])
    .filter((a) => a && a.dataUrl)
    .map((a) => ({
      name: a.name,
      type: a.type,
      mimeType: a.mimeType,
      dataUrl: a.dataUrl,
    }));
}

export const aiService = {
  async checkHealth() {
    try {
      const res = await workerFetch('/');
      return await res.json();
    } catch {
      try {
        const res = await apiFetch('/api/health');
        return await res.json();
      } catch {
        return { status: 'error', apiConfigured: false };
      }
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
      const attachments = getAttachments(params.attachments);
      const messages = buildMessages(
        params.history,
        params.systemInstruction,
        cleanMessage,
      );

      const hasImage = attachments.some((a) =>
        String(a.type || '').toLowerCase().includes('image') ||
        String(a.mimeType || '').toLowerCase().startsWith('image/')
      );

      const intent = detectPaliaIntent(
        cleanMessage,
        hasImage,
        Boolean(params.enableSearchGrounding),
      );

      /*
       * Palia AI task router:
       * - image + edit instruction -> image editing backend
       * - image generation prompt -> image backend
       * - explicit search grounding -> search backend
       * - everything else -> conversational AI backend
       *
       * Search is only auto-routed when the caller explicitly enables
       * search grounding, preventing accidental network searches.
       */
      if (
        intent === 'web_search' &&
        params.enableSearchGrounding &&
        !hasImage
      ) {
        const search = await this.searchWeb(cleanMessage);
        if (search.success) return search;
      }

      const generateImage =
        intent === 'image_edit' ||
        intent === 'image_generate';

      const res = await workerFetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: cleanMessage,
          model: params.model || 'gpt-5.6',
          messages,
          attachments,
          generateImage,
          intent,
          ...getRequestMeta(),
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        return {
          success: false,
          error:
            data?.error?.message ||
            data?.error ||
            `Palia AI Worker returned HTTP ${res.status}`,
        };
      }

      const content =
        data?.choices?.[0]?.message?.content;

      const text = Array.isArray(content)
        ? content
            .map((part: any) => part?.text || '')
            .join('')
        : String(
            content ||
              data?.output_text ||
              data?.text ||
              data?.reply ||
              '',
          );

      const imageUrl =
        data?.imageUrl ||
        data?.generatedImageUrl ||
        data?.image_url;

      if (!text.trim() && !imageUrl) {
        return {
          success: false,
          error:
            'Palia AI Worker returned an empty response.',
        };
      }

      return {
        success: true,
        text,
        reply: text,
        answer: text,
        sources: data?.sources || [],
        searchQueries: data?.searchQueries || [],
        modelUsed:
          data?.model ||
          params.model ||
          'Palia AI',
        imageUrl,
      };
    } catch (err: any) {
      console.error(
        'aiService.sendMessage error:',
        err,
      );

      return {
        success: false,
        text: '',
        reply: '',
        answer: '',
        error:
          err.message ||
          'Palia AI could not connect to the Cloudflare AI Worker.',
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
          error:
            'Please enter a search topic or question.',
        };
      }

      const meta = getRequestMeta();

      const res = await apiFetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...meta,
          query: cleanQuery,
        }),
      });

      const data = await res.json();

      if (data.usage) {
        usageService.updateFromApiResponse(
          data.usage,
        );
      }

      if (!res.ok) {
        const isLimit =
          res.status === 429 ||
          data.isLimitReached;

        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? "Daily AI limit reached."
              : 'Web search query failed'),
          isLimitReached: isLimit,
        };
      }

      const text =
        data.text ||
        data.reply ||
        '';

      return {
        success: true,
        text,
        reply: text,
        answer: text,
        sources: data.sources || [],
        searchQueries:
          data.searchQueries || [cleanQuery],
        modelUsed:
          data.modelUsed ||
          'Palia AI Web Search',
      };
    } catch (err: any) {
      console.error(
        'aiService.searchWeb error:',
        err,
      );

      return {
        success: false,
        text: '',
        reply: '',
        answer: '',
        error:
          err.message ||
          'Palia AI Web Search service is currently unavailable.',
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...meta,
          ...params,
        }),
      });

      const data = await res.json();

      if (data.usage) {
        usageService.updateFromApiResponse(
          data.usage,
        );
      }

      if (!res.ok) {
        const isLimit =
          res.status === 429 ||
          data.isLimitReached;

        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? 'Daily AI limit reached.'
              : 'Image generation failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error:
          err.message ||
          'Image generation request failed.',
      };
    }
  },

  async analyzeDocument(params: {
    documentText: string;
    filename: string;
    mode?: 'summary' | 'qa' | 'extract' | 'translate';
    question?: string;
  }): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    isLimitReached?: boolean;
  }> {
    try {
      const meta = getRequestMeta();

      const res = await apiFetch(
        '/api/document/analyze',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...meta,
            ...params,
          }),
        },
      );

      const data = await res.json();

      if (data.usage) {
        usageService.updateFromApiResponse(
          data.usage,
        );
      }

      if (!res.ok) {
        const isLimit =
          res.status === 429 ||
          data.isLimitReached;

        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? 'Daily AI limit reached.'
              : 'Document analysis failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error:
          err.message ||
          'Document analysis request failed.',
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
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          ...meta,
          ...params,
        }),
      });

      const data = await res.json();

      if (data.usage) {
        usageService.updateFromApiResponse(
          data.usage,
        );
      }

      if (!res.ok) {
        const isLimit =
          res.status === 429 ||
          data.isLimitReached;

        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? 'Daily AI limit reached.'
              : 'Translation failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error:
          err.message ||
          'Translation request failed.',
      };
    }
  },

  async assistCode(params: {
    code?: string;
    language?: string;
    action:
      | 'generate'
      | 'explain'
      | 'debug'
      | 'optimize';
    prompt?: string;
  }): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    isLimitReached?: boolean;
  }> {
    try {
      const meta = getRequestMeta();

      const res = await apiFetch(
        '/api/code/assist',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...meta,
            ...params,
          }),
        },
      );

      const data = await res.json();

      if (data.usage) {
        usageService.updateFromApiResponse(
          data.usage,
        );
      }

      if (!res.ok) {
        const isLimit =
          res.status === 429 ||
          data.isLimitReached;

        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? 'Daily AI limit reached.'
              : 'Code assistant failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error:
          err.message ||
          'Code assistant request failed.',
      };
    }
  },

  async assistResume(params: {
    section: string;
    role: string;
    details: string;
    action:
      | 'summary'
      | 'bullet_points'
      | 'skills';
  }): Promise<{
    success: boolean;
    result?: string;
    error?: string;
    isLimitReached?: boolean;
  }> {
    try {
      const meta = getRequestMeta();

      const res = await apiFetch(
        '/api/resume/assist',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            ...meta,
            ...params,
          }),
        },
      );

      const data = await res.json();

      if (data.usage) {
        usageService.updateFromApiResponse(
          data.usage,
        );
      }

      if (!res.ok) {
        const isLimit =
          res.status === 429 ||
          data.isLimitReached;

        return {
          success: false,
          error:
            data.error ||
            (isLimit
              ? 'Daily AI limit reached.'
              : 'Resume assistant failed'),
          isLimitReached: isLimit,
        };
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        error:
          err.message ||
          'Resume assistant request failed.',
      };
    }
  },

  async speakText(
    text: string,
    voiceName: string = 'Kore',
  ): Promise<void> {
    try {
      const meta = getRequestMeta();

      const res = await apiFetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          ...meta,
          text: text.slice(0, 500),
          voiceName,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.usage) {
          usageService.updateFromApiResponse(
            data.usage,
          );
        }

        if (
          data.success &&
          data.audioData
        ) {
          const audio = new Audio(
            data.audioData,
          );

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
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(text);

      utterance.rate = 1;
      utterance.pitch = 1;

      window.speechSynthesis.speak(
        utterance,
      );
    } catch (e) {
      console.warn(
        'Browser TTS error:',
        e,
      );
    }
  },
};
