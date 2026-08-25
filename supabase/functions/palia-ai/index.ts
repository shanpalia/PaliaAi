import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const TEXT_MODEL = Deno.env.get("TEXT_MODEL") || "gemini-3.6-flash";
const IMAGE_MODEL = Deno.env.get("IMAGE_MODEL") || "gemini-3.1-flash-image";
const DAILY_LIMIT = 7200;

type UsageRow = { date: string; used: number };
const memoryUsage = new Map<string, UsageRow>();

function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getUsage(userId: string) {
  const date = indiaDate();
  let row = memoryUsage.get(userId);
  if (!row || row.date !== date) {
    row = { date, used: 0 };
    memoryUsage.set(userId, row);
  }
  const remaining = Math.max(0, DAILY_LIMIT - row.used);
  return {
    user_id: userId,
    usage_date: date,
    used_seconds: row.used,
    daily_limit_seconds: DAILY_LIMIT,
    remaining_seconds: remaining,
    is_limit_reached: remaining <= 0,
    allowed: remaining > 0,
    formatted_remaining:
      remaining >= 3600
        ? `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m remaining`
        : remaining >= 60
          ? `${Math.floor(remaining / 60)}m remaining`
          : `${remaining}s remaining`,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function generate(model: string, payload: unknown) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY is not configured in Supabase.");
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `AI API error ${r.status}`);
  return data;
}

function extractText(data: any) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => typeof part?.text === "string")
      ?.map((part: any) => part.text)
      ?.join("\n") || ""
  );
}

function extractImage(data: any) {
  for (const part of data?.candidates?.[0]?.content?.parts || []) {
    const inline = part?.inlineData;
    if (inline?.data && String(inline?.mimeType || "").startsWith("image/")) {
      return `data:${inline.mimeType};base64,${inline.data}`;
    }
  }
  return "";
}

function extractSources(data: any) {
  const result: any[] = [];
  for (const chunk of data?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
    if (chunk?.web?.uri) {
      result.push({
        title: chunk.web.title || chunk.web.uri,
        url: chunk.web.uri,
        uri: chunk.web.uri,
      });
    }
  }
  return result;
}

function attachmentParts(attachments: any[]) {
  const result: any[] = [];
  for (const item of Array.isArray(attachments) ? attachments : []) {
    const raw = String(item?.data || "");
    const match = raw.match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) continue;

    // Prevent accidental enormous requests from crashing the function.
    if (match[2].length > 100_000_000) {
      throw new Error(`${item?.name || "Attachment"} is too large. Please use a smaller file.`);
    }

    result.push({
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    });
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return response({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json();
    const userId = String(body?.userId || "guest");
    const action = String(body?.action || "chat");
    const usage = getUsage(userId);

    if (action === "usage") return response({ success: true, usage });

    if (!usage.allowed) {
      return response(
        {
          success: false,
          isLimitReached: true,
          error: "Daily AI limit reached. Your 2-hour allowance resets tomorrow.",
          usage,
        },
        429,
      );
    }

    const prompt = String(body?.message || body?.query || "").trim();
    const attachments = attachmentParts(body?.attachments || []);

    if (!prompt && !attachments.length) {
      return response(
        { success: false, error: "Please enter a message or attach a file.", usage },
        400,
      );
    }

    const system = `
You are Palia AI, a helpful, accurate, friendly multimodal AI assistant developed by ShanPalia.
Never reveal or mention the underlying AI model or provider name unless the user explicitly asks about the technical configuration.
Answer naturally and clearly.
You can understand text and supported uploaded images/files.
If the user asks for an image to be created or edited, the server may return an actual generated image when IMAGE_MODEL supports image output.
Never claim an image was generated if no image was actually returned.
When an image is requested, do not substitute a prompt, SVG, ASCII art, or design instructions for the actual image unless the user explicitly asks for those.
`.trim();

    const contents: any[] = [];
    for (const item of Array.isArray(body?.history) ? body.history.slice(-20) : []) {
      const text = String(item?.text || item?.content || "").trim();
      if (!text) continue;
      contents.push({
        role: item.role === "assistant" || item.role === "model" ? "model" : "user",
        parts: [{ text }],
      });
    }

    contents.push({
      role: "user",
      parts: [
        { text: prompt || "Analyze the attached content and help the user." },
        ...attachments,
      ],
    });

    const payload: any = {
      contents,
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: { temperature: 0.7 },
    };

    if (action === "search") payload.tools = [{ google_search: {} }];

    if (action === "image") {
      // Current stable Gemini image model. It accepts text + image inputs and returns image + text.
      payload.generationConfig = {
        temperature: 0.7,
        responseModalities: ["TEXT", "IMAGE"],
      };
    }

    const started = Date.now();
    const data = await generate(action === "image" ? IMAGE_MODEL : TEXT_MODEL, payload);
    const elapsed = Math.max(1, Math.round((Date.now() - started) / 1000));

    const row = memoryUsage.get(userId);
    if (row) row.used = Math.min(DAILY_LIMIT, row.used + elapsed);

    const text = extractText(data);
    const imageUrl = extractImage(data);

    if (action === "image" && !imageUrl) {
      return response({
        success: false,
        error: "The image model returned no image. Check that your Gemini API key has access to the configured image model.",
        text,
        usage: getUsage(userId),
      }, 502);
    }

    return response({
      success: true,
      text: text || (imageUrl ? "Here is your generated image." : "No response generated."),
      reply: text || (imageUrl ? "Here is your generated image." : "No response generated."),
      imageUrl,
      sources: extractSources(data),
      searchQueries: action === "search" ? [prompt] : [],
      modelUsed: "Palia AI",
      usage: getUsage(userId),
    });
  } catch (error) {
    return response(
      {
        success: false,
        error: error instanceof Error ? error.message : "Palia AI request failed.",
      },
      500,
    );
  }
});
