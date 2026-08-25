import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://shanpalia.github.io",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODEL = "gemini-2.5-flash";
const LIMIT = 7200;

const mem = new Map<string, { date: string; used: number }>();

function indiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getUsage(userId: string) {
  const today = indiaDate();

  let row = mem.get(userId);

  if (!row || row.date !== today) {
    row = {
      date: today,
      used: 0,
    };
    mem.set(userId, row);
  }

  const remaining = Math.max(0, LIMIT - row.used);

  return {
    user_id: userId,
    usage_date: today,
    used_seconds: row.used,
    daily_limit_seconds: LIMIT,
    remaining_seconds: remaining,
    is_limit_reached: remaining <= 0,
    allowed: remaining > 0,
    formatted_remaining:
      remaining >= 3600
        ? `${Math.floor(remaining / 3600)}h ${Math.floor(
            (remaining % 3600) / 60,
          )}m remaining`
        : remaining >= 60
          ? `${Math.floor(remaining / 60)}m remaining`
          : `${remaining}s remaining`,
  };
}

async function callGemini(payload: any) {
  if (!GEMINI_KEY) {
    throw new Error("GEMINI_API_KEY missing");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed");
  }

  return data;
}

function extractText(data: any) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") || ""
  );
}

function extractSources(data: any) {
  const list = [];

  for (const item of data?.candidates?.[0]?.groundingMetadata
    ?.groundingChunks || []) {
    if (item.web?.uri) {
      list.push({
        title: item.web.title || item.web.uri,
        url: item.web.uri,
      });
    }
  }

  return list;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: corsHeaders,
      },
    );
  }

  try {
    const body = await req.json();

    const userId = String(body.userId || "guest");
    const action = String(body.action || "chat");

    const usage = getUsage(userId);

    if (action === "usage") {
      return new Response(
        JSON.stringify({
          success: true,
          usage,
        }),
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    if (!usage.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Daily AI limit reached",
          usage,
        }),
        {
          status: 429,
          headers: corsHeaders,
        },
      );
    }

    const message = String(
      body.message || body.query || "",
    ).trim();

    if (!message) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Please enter a message",
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const systemPrompt =
      "You are Palia AI developed by ShanPalia. Never mention Gemini or Google. Answer naturally.";

    const contents: any[] = [];

    if (Array.isArray(body.history)) {
      for (const h of body.history.slice(-20)) {
        const text = String(h.content || h.text || "").trim();

        if (text) {
          contents.push({
            role:
              h.role === "assistant" || h.role === "model"
                ? "model"
                : "user",
            parts: [{ text }],
          });
        }
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const payload: any = {
      contents,
      generationConfig: {
        temperature: 0.7,
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    if (action === "search") {
      payload.tools = [
        {
          google_search: {},
        },
      ];
    }

    const start = Date.now();

    const data = await callGemini(payload);

    const elapsed = Math.max(
      1,
      Math.round((Date.now() - start) / 1000),
    );

    const record = mem.get(userId)!;
    record.used = Math.min(LIMIT, record.used + elapsed);

    return new Response(
      JSON.stringify({
        success: true,
        text: extractText(data),
        reply: extractText(data),
        sources: extractSources(data),
        usage: getUsage(userId),
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
