import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = "gemini-2.5-flash";
const LIMIT = 7200;

// Temporary in-memory usage fallback.
// For persistent enforcement, connect this function to a Supabase table.
const mem = new Map<string, { date: string; used: number }>();

function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function usage(userId: string) {
  const date = indiaDate();
  let row = mem.get(userId);

  if (!row || row.date !== date) {
    row = { date, used: 0 };
    mem.set(userId, row);
  }

  const remaining = Math.max(0, LIMIT - row.used);

  return {
    user_id: userId,
    usage_date: date,
    used_seconds: row.used,
    daily_limit_seconds: LIMIT,
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

async function gemini(payload: any) {
  if (!GEMINI_KEY) throw new Error("Palia AI backend is not configured: GEMINI_API_KEY is missing.");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=` +
    encodeURIComponent(GEMINI_KEY);

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const d = await r.json();

  if (!r.ok) {
    throw new Error(d?.error?.message || `AI API error ${r.status}`);
  }

  return d;
}

function extract(d: any) {
  return (
    d?.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("\n") || ""
  );
}

function sources(d: any) {
  const out: any[] = [];

  for (const c of d?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
    if (c.web?.uri) {
      out.push({
        title: c.web.title || c.web.uri,
        url: c.web.uri,
        uri: c.web.uri,
      });
    }
  }

  return out;
}

serve(async (req) => {
  // This MUST run before any auth/body handling.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      success: false,
      error: "Method not allowed",
    }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const b = await req.json();
    const userId = String(b.userId || "guest");
    const action = String(b.action || "chat");
    const u = usage(userId);

    if (action === "usage") {
      return new Response(JSON.stringify({
        success: true,
        usage: u,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (!u.allowed) {
      return new Response(JSON.stringify({
        success: false,
        isLimitReached: true,
        error: "Daily AI limit reached. Your 2-hour allowance resets tomorrow.",
        usage: u,
      }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    const prompt = String(b.message || b.query || "").trim();

    if (!prompt) {
      return new Response(JSON.stringify({
        success: false,
        error: "Please enter a message.",
        usage: u,
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const system =
      "You are Palia AI, a helpful, accurate and friendly AI assistant developed by ShanPalia. " +
      "Never mention or expose the underlying AI model/provider name. " +
      "Do not fabricate sources or claim an operation was completed when it was not.";

    const contents: any[] = [];

    if (Array.isArray(b.history)) {
      for (const h of b.history.slice(-20)) {
        const text = String(h.text || h.content || "").trim();
        if (!text) continue;

        contents.push({
          role: h.role === "assistant" || h.role === "model" ? "model" : "user",
          parts: [{ text }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const payload: any = {
      contents,
      generationConfig: {
        temperature: 0.7,
      },
      systemInstruction: {
        parts: [{ text: system }],
      },
    };

    if (action === "search") {
      payload.tools = [{ google_search: {} }];
    }

    const start = Date.now();
    const data = await gemini(payload);
    const elapsed = Math.max(1, Math.round((Date.now() - start) / 1000));

    const row = mem.get(userId);
    if (row) row.used = Math.min(LIMIT, row.used + elapsed);

    const text = extract(data);

    return new Response(JSON.stringify({
      success: true,
      text: text || "No response generated.",
      reply: text || "No response generated.",
      sources: sources(data),
      searchQueries: action === "search" ? [prompt] : [],
      modelUsed: "Palia AI",
      usage: usage(userId),
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Palia AI request failed",
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
