import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { usageManager } from './server/usageManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy initialized Gemini client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function resolveModel(modelName?: string): string {
  if (!modelName) return 'gemini-3.7-flash';
  if (
    modelName === 'palia-ai-pro' ||
    modelName === 'gemini-2.5-pro' ||
    modelName === 'gemini-1.5-pro'
  ) {
    return 'gemini-2.5-pro';
  }
  return 'gemini-3.7-flash';
}

// In-memory credit store initialized with 850 credits
const creditStore: Record<string, { credits: number; history: Array<any> }> = {
  default_user: {
    credits: 850,
    history: [
      {
        id: 'tx_init',
        timestamp: Date.now() - 3600000,
        operation: 'Welcome Bonus',
        amount: 850,
        balanceAfter: 850,
      },
    ],
  },
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Body parsers with larger limit for base64 images and documents
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    res.json({ status: 'ok', apiConfigured: hasKey, appName: 'Palia AI', developer: 'ShanPalia' });
  });

  // --- Daily AI Usage Allowance Endpoints ---
  // Get real-time usage status for user
  app.get('/api/user/usage', (req, res) => {
    const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = (req.query.timezone as string) || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';
    const status = usageManager.getUsageStatus(userId, timezone);
    res.json({ success: true, ...status });
  });

  // Admin: Get daily usage configuration & analytics
  app.get('/api/admin/usage-config', (req, res) => {
    const config = usageManager.getAdminConfig();
    res.json({ success: true, ...config });
  });

  // Admin: Update daily usage allowance limit
  app.post('/api/admin/usage-config', (req, res) => {
    const { minutes, userId } = req.body;
    if (typeof minutes === 'number' && minutes > 0) {
      usageManager.setAdminLimit(minutes, userId);
      return res.json({ success: true, ...usageManager.getAdminConfig() });
    }
    res.status(400).json({ error: 'Valid minutes value is required' });
  });

  // Admin / Testing: Reset user daily usage
  app.post('/api/admin/reset-usage', (req, res) => {
    const { userId = 'default_user', timezone = 'Asia/Kolkata' } = req.body;
    const status = usageManager.resetUserUsage(userId, timezone);
    res.json({ success: true, ...status });
  });

  // Credit balance (legacy compatibility)
  app.get('/api/user/credits', (req, res) => {
    const userId = (req.query.userId as string) || 'default_user';
    if (!creditStore[userId]) {
      creditStore[userId] = {
        credits: 850,
        history: [
          {
            id: 'tx_init',
            timestamp: Date.now(),
            operation: 'Welcome Bonus',
            amount: 850,
            balanceAfter: 850,
          },
        ],
      };
    }
    res.json({
      credits: creditStore[userId].credits,
      history: creditStore[userId].history,
    });
  });

  // Deduct credits (legacy compatibility)
  app.post('/api/user/credits/deduct', (req, res) => {
    const { userId = 'default_user', operation = 'AI Query', amount = 2 } = req.body;
    if (!creditStore[userId]) {
      creditStore[userId] = { credits: 850, history: [] };
    }

    const current = creditStore[userId].credits;
    if (current < amount) {
      return res.status(402).json({
        error: 'Insufficient AI credits. Please upgrade or top up.',
        credits: current,
      });
    }

    creditStore[userId].credits -= amount;
    const newTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      operation,
      amount: -amount,
      balanceAfter: creditStore[userId].credits,
    };
    creditStore[userId].history.unshift(newTx);

    res.json({
      success: true,
      credits: creditStore[userId].credits,
      transaction: newTx,
    });
  });

  // Auth mock/proxy
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const name = email.split('@')[0];
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    res.json({
      success: true,
      user: {
        id: 'user_' + Buffer.from(email).toString('base64').substring(0, 10),
        name: formattedName,
        email,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
        tier: 'Pro',
        credits: creditStore['default_user']?.credits || 850,
        createdAt: Date.now() - 86400000 * 5,
      },
    });
  });

  app.post('/api/auth/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    res.json({
      success: true,
      user: {
        id: 'user_' + Buffer.from(email).toString('base64').substring(0, 10),
        name: name || email.split('@')[0],
        email,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
        tier: 'Pro',
        credits: 850,
        createdAt: Date.now(),
      },
    });
  });

  // General AI Chat Endpoint with Usage Tracking
  app.post('/api/chat', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    // 1. Check daily allowance
    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const {
        message,
        messages = [],
        history = [],
        attachments = [],
        systemInstruction = 'You are Palia AI, an advanced, highly capable, elegant, and friendly AI assistant developed by ShanPalia. Provide accurate, deeply helpful, structured, and beautiful answers. Format code cleanly with language tags and use structured markdown when helpful.',
        temperature = 0.7,
        model = 'palia-ai-ultra',
        enableSearchGrounding = false,
      } = req.body;

      const ai = getGenAI();
      const internalModel = resolveModel(model);

      const contents: Array<{ role: string; parts: Array<any> }> = [];

      // Helper to process attachments into Gemini inlineData / text parts
      const processAttachments = (atts: Array<any>) => {
        const parts: Array<any> = [];
        if (!Array.isArray(atts)) return parts;
        for (const att of atts) {
          if (!att) continue;
          if (att.dataUrl && att.dataUrl.includes('base64,')) {
            const base64Data = att.dataUrl.split('base64,')[1];
            parts.push({
              inlineData: {
                mimeType: att.mimeType || 'image/jpeg',
                data: base64Data,
              },
            });
          } else if (att.textExtract) {
            parts.push({
              text: `[Attached Document: "${att.name || 'Document'}"]\n${att.textExtract}\n---`,
            });
          }
        }
        return parts;
      };

      // Process prior history turns if provided
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history) {
          if (!item) continue;
          const role = item.role === 'model' || item.role === 'assistant' ? 'model' : 'user';
          let itemText = '';
          if (typeof item === 'string') {
            itemText = item;
          } else if (typeof item.text === 'string') {
            itemText = item.text;
          } else if (typeof item.content === 'string') {
            itemText = item.content;
          } else if (Array.isArray(item.parts)) {
            itemText = item.parts
              .map((p: any) => (typeof p === 'string' ? p : p?.text || ''))
              .join(' ');
          }

          if (itemText && itemText.trim()) {
            contents.push({ role, parts: [{ text: itemText.trim() }] });
          }
        }
      }

      // Process messages array if provided
      if (Array.isArray(messages) && messages.length > 0) {
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (!msg) continue;
          const isLatest = i === messages.length - 1;
          const role = msg.role === 'model' || msg.sender === 'assistant' ? 'model' : 'user';
          const parts: Array<any> = [];

          if (isLatest && Array.isArray(attachments) && attachments.length > 0) {
            parts.push(...processAttachments(attachments));
          } else if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
            parts.push(...processAttachments(msg.attachments));
          }

          const textContent = msg.content || msg.text || (typeof msg === 'string' ? msg : '');
          if (textContent && String(textContent).trim()) {
            parts.push({ text: String(textContent).trim() });
          }

          if (parts.length > 0) {
            contents.push({ role, parts });
          }
        }
      }

      // Process direct 'message' query string if provided
      if (typeof message === 'string' && message.trim()) {
        const latestAttParts =
          Array.isArray(attachments) && attachments.length > 0
            ? processAttachments(attachments)
            : [];
        const userParts = [...latestAttParts, { text: message.trim() }];

        const lastContent = contents[contents.length - 1];
        const isDuplicate =
          lastContent &&
          lastContent.role === 'user' &&
          lastContent.parts.some((p: any) => p.text === message.trim());

        if (!isDuplicate) {
          contents.push({ role: 'user', parts: userParts });
        }
      } else if (contents.length === 0 && Array.isArray(attachments) && attachments.length > 0) {
        const attParts = processAttachments(attachments);
        if (attParts.length > 0) {
          contents.push({
            role: 'user',
            parts: [...attParts, { text: 'Analyze and provide insights on the attached file(s).' }],
          });
        }
      }

      if (contents.length === 0) {
        return res.status(400).json({
          error: 'Please enter a message or attach a file to continue.',
        });
      }

      const config: any = {
        systemInstruction,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
      };

      if (enableSearchGrounding) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: internalModel,
        contents,
        config,
      });

      const responseText = response.text || '';

      const sources: Array<{ title: string; url: string; uri: string; snippet?: string }> = [];
      const candidates = response.candidates;
      if (candidates && candidates[0]?.groundingMetadata) {
        const metadata = candidates[0].groundingMetadata;
        if (metadata.groundingChunks) {
          for (const chunk of metadata.groundingChunks) {
            if (chunk.web?.uri) {
              const url = chunk.web.uri;
              const title = chunk.web.title || new URL(url).hostname;
              sources.push({ title, url, uri: url });
            }
          }
        }
      }

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        text: responseText,
        reply: responseText,
        sources,
        modelUsed: 'Palia AI',
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Chat error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.status(500).json({
        error:
          err.message || 'Palia AI encountered an issue generating a response. Please try again.',
        usage: updatedUsage,
      });
    }
  });

  // Web Search Grounded AI Chat with Usage Tracking
  app.post('/api/search', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { query } = req.body;
      const cleanQuery = typeof query === 'string' ? query.trim() : '';
      if (!cleanQuery) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const ai = getGenAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: cleanQuery,
        config: {
          systemInstruction:
            'You are Palia AI Web Search mode. You have real-time access to the web via Google Search. Provide fresh, fact-checked, authoritative, and structured answers with clear citations.',
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || 'No response generated.';

      const sources: Array<{ title: string; url: string; uri: string; snippet?: string }> = [];
      const candidates = response.candidates;
      if (candidates && candidates[0]?.groundingMetadata) {
        const metadata = candidates[0].groundingMetadata;
        if (metadata.groundingChunks) {
          for (const chunk of metadata.groundingChunks) {
            if (chunk.web?.uri) {
              const url = chunk.web.uri;
              const title = chunk.web.title || new URL(url).hostname;
              sources.push({
                title,
                url,
                uri: url,
              });
            }
          }
        }
      }

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        text,
        reply: text,
        answer: text,
        sources,
        searchQueries: [cleanQuery],
        modelUsed: 'Palia AI Web Search',
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Search grounding error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.status(500).json({
        error: err.message || 'Web search retrieval failed. Please try again.',
        usage: updatedUsage,
      });
    }
  });

  // Image AI Tool: Generate & Edit with Usage Tracking
  app.post('/api/image/generate', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { prompt, aspectRatio = '1:1', style = 'photorealistic' } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Image prompt is required' });
      }

      const ai = getGenAI();
      const enhancedPrompt = `High quality, detailed visual art: ${prompt}. Style: ${style}.`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: enhancedPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: (aspectRatio as any) || '1:1',
            },
          },
        });

        let imageUrl = '';
        let description = '';
        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            } else if (part.text) {
              description += part.text + ' ';
            }
          }
        }

        if (imageUrl) {
          const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
          const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

          return res.json({
            success: true,
            imageUrl,
            description: description.trim() || `Generated image for: ${prompt}`,
            usage: updatedUsage,
          });
        }
      } catch (genErr: any) {
        console.warn('Direct image model fallback:', genErr.message);
      }

      // Fallback: Generate ultra high-fidelity SVG/Canvas vector artwork description
      const svgGen = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: `Create a modern, stunning, futuristic SVG artwork illustrating the prompt: "${prompt}". Style: ${style}. 
Return ONLY valid SVG code starting with <svg and ending with </svg>. Make it responsive with viewBox="0 0 800 800", rich color gradients, clean vector shapes, and modern lighting effects. Do not include markdown code ticks.`,
      });

      let svgText = svgGen.text?.trim() || '';
      if (svgText.includes('```xml')) {
        svgText = svgText.replace(/```xml/g, '').replace(/```/g, '').trim();
      } else if (svgText.includes('```svg')) {
        svgText = svgText.replace(/```svg/g, '').replace(/```/g, '').trim();
      } else if (svgText.includes('```')) {
        svgText = svgText.replace(/```/g, '').trim();
      }

      const encodedSvg = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        imageUrl: encodedSvg,
        description: `Visual artwork generated for "${prompt}" (${style})`,
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Image generation error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);
      res.status(500).json({ error: err.message || 'Image generation failed.', usage: updatedUsage });
    }
  });

  // Document AI Tool: Summarize, Extract, QA with Usage Tracking
  app.post('/api/document/analyze', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { documentText, filename, mode = 'summary', question = '' } = req.body;
      if (!documentText) {
        return res.status(400).json({ error: 'Document text content is required' });
      }

      const ai = getGenAI();

      let prompt = '';
      if (mode === 'summary') {
        prompt = `You are Palia Document AI. Please provide an executive summary, key takeaways, and structured highlights for the attached document: "${filename}".\n\nDocument Content:\n${documentText}`;
      } else if (mode === 'qa') {
        prompt = `You are Palia Document AI. Answer the following question accurately based strictly on the attached document "${filename}":\n\nQuestion: ${question}\n\nDocument Content:\n${documentText}`;
      } else if (mode === 'extract') {
        prompt = `Extract all key entities, facts, dates, action items, and data tables from this document "${filename}":\n\nDocument Content:\n${documentText}`;
      } else if (mode === 'translate') {
        prompt = `Translate the essential findings and body of this document "${filename}" into clear modern English:\n\nDocument Content:\n${documentText}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        result: response.text || 'No analysis generated.',
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Document analysis error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);
      res.status(500).json({ error: err.message || 'Document analysis failed.', usage: updatedUsage });
    }
  });

  // Translator Tool with Usage Tracking
  app.post('/api/translate', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { text, targetLang = 'Spanish', sourceLang = 'Auto-Detect', tone = 'Natural' } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text to translate is required' });
      }

      const ai = getGenAI();
      const prompt = `Translate the following text accurately from ${sourceLang} into ${targetLang}. 
Tone requested: ${tone}. 
Also detect the source language and provide a short pronunciation / phonetic guide if helpful.

Format response strictly as JSON with keys:
{
  "translatedText": string,
  "detectedSourceLanguage": string,
  "phoneticGuide": string,
  "culturalNotes": string
}

Text to translate:
"""${text}"""`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        parsed = {
          translatedText: response.text,
          detectedSourceLanguage: sourceLang,
          phoneticGuide: '',
          culturalNotes: '',
        };
      }

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        ...parsed,
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Translate error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);
      res.status(500).json({ error: err.message || 'Translation failed.', usage: updatedUsage });
    }
  });

  // Coding Assistant Tool with Usage Tracking
  app.post('/api/code/assist', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { code, language = 'javascript', action = 'explain', prompt = '' } = req.body;

      const ai = getGenAI();
      let instruction = '';

      if (action === 'generate') {
        instruction = `You are Palia AI Coding Specialist. Write clean, production-grade, well-commented ${language} code for the following request: "${prompt}". Include usage example and explanation.`;
      } else if (action === 'explain') {
        instruction = `You are Palia AI Coding Specialist. Explain the following ${language} code clearly, breaking down architecture, key functions, and data flow:\n\`\`\`${language}\n${code}\n\`\`\``;
      } else if (action === 'debug') {
        instruction = `You are Palia AI Coding Specialist. Identify bugs, edge cases, potential memory leaks, or race conditions in this ${language} code and provide the fixed version:\n\`\`\`${language}\n${code}\n\`\`\``;
      } else if (action === 'optimize') {
        instruction = `You are Palia AI Coding Specialist. Optimize the performance, readability, and time/space complexity of this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: instruction,
      });

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        result: response.text || '',
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Code assistant error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);
      res.status(500).json({ error: err.message || 'Code assistance failed.', usage: updatedUsage });
    }
  });

  // Resume Builder Assistant Tool with Usage Tracking
  app.post('/api/resume/assist', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { section, role, details, action = 'enhance' } = req.body;

      const ai = getGenAI();
      let prompt = '';

      if (action === 'summary') {
        prompt = `Generate a compelling, executive-level professional resume summary (3-4 impactful sentences) for a "${role}" with the following background: "${details}". Highlight achievements, leadership, and technical prowess.`;
      } else if (action === 'bullet_points') {
        prompt = `Convert the following rough work experience description for a "${role}" into 4-5 high-impact, STAR-method (Situation, Task, Action, Result) resume bullet points with strong action verbs and quantified impact:\n"${details}"`;
      } else if (action === 'skills') {
        prompt = `Suggest an organized, top-tier list of technical and soft skills for a "${role}" in industry standard categorization (Core Technical, Tools/Frameworks, Methodologies, Soft Skills):\n"${details}"`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      res.json({
        success: true,
        result: response.text || '',
        usage: updatedUsage,
      });
    } catch (err: any) {
      console.error('Resume assistant error:', err);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);
      res.status(500).json({ error: err.message || 'Resume assistance failed.', usage: updatedUsage });
    }
  });

  // Text-to-Speech synthesis endpoint with Usage Tracking
  app.post('/api/tts', async (req, res) => {
    const userId = req.body.userId || (req.headers['x-user-id'] as string) || 'default_user';
    const timezone = req.body.timezone || (req.headers['x-timezone'] as string) || 'Asia/Kolkata';

    const usageCheck = usageManager.getUsageStatus(userId, timezone);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: "Daily AI limit reached: You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.",
        isLimitReached: true,
        limitReached: true,
        usage: usageCheck,
      });
    }

    const startTime = Date.now();
    try {
      const { text, voiceName = 'Kore' } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required for TTS' });
      }

      const ai = getGenAI();
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: text.slice(0, 500) }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
            },
          },
        },
      });

      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({
          success: true,
          audioData: `data:audio/mp3;base64,${base64Audio}`,
          pcmBase64: base64Audio,
          usage: updatedUsage,
        });
      }

      res.json({ success: false, fallbackToBrowser: true, usage: updatedUsage });
    } catch (err: any) {
      console.warn('TTS API error (fallback to browser speech synthesis):', err.message);
      const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
      const updatedUsage = usageManager.recordUsage(userId, elapsedSec, timezone);
      res.json({ success: false, fallbackToBrowser: true, message: err.message, usage: updatedUsage });
    }
  });

  // --- Vite & Static Asset Handling ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Palia AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
});
