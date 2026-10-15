export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_CHAT_MODEL?: string;
  GEMINI_IMAGE_MODEL?: string;
  APP_ORIGIN?: string;
}

const DEFAULT_ORIGIN = "https://shanpalia.github.io";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_PROMPT_CHARS = 8000;

function response(data: unknown, status = 200, origin = DEFAULT_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "vary": "Origin",
    },
  });
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([
    DEFAULT_ORIGIN,
    "https://shanpalia.github.io",
    ...(env.APP_ORIGIN ? [env.APP_ORIGIN.replace(/\/$/, "")] : []),
  ]);
  return allowed.has(origin) ? origin : null;
}

function dataUrlToInlineData(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2].replace(/\s/g, "") };
}

function getImageParts(attachments: any[]) {
  const parts: any[] = [];
  for (const item of attachments.slice(0, 3)) {
    const dataUrl = typeof item?.dataUrl === "string" ? item.dataUrl : "";
    const inlineData = dataUrlToInlineData(dataUrl);
    if (inlineData && inlineData.data.length <= 7_000_000) {
      parts.push({ inlineData });
    }
    if (typeof item?.textExtract === "string" && item.textExtract.trim()) {
      parts.push({ text: "[Attached document]\n" + item.textExtract.slice(0, 12000) });
    }
  }
  return parts;
}

async function callGemini(env: Env, model: string, contents: any[], options: Record<string, unknown> = {}) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) + ":generateContent";
  const result = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, ...options },
    }),
  });
  const data: any = await result.json().catch(() => ({}));
  if (!result.ok) {
    const message = data?.error?.message || "Gemini API request failed.";
    const status = result.status === 429 ? 429 : result.status === 403 ? 403 : 502;
    throw Object.assign(new Error(message), { status, providerStatus: result.status });
  }
  return data;
}

function publicError(error: any) {
  const status = Number(error?.status) || 502;
  const message = String(error?.message || "AI request failed.");
  if (status === 429 || /quota|rate.?limit|resource exhausted/i.test(message)) {
    return { status: 429, body: { error: "Free AI quota is temporarily exhausted. Please try again later or check your Gemini API quota.", isLimitReached: true } };
  }
  if (/api key|permission|billing|not enabled/i.test(message)) {
    return { status: 503, body: { error: "Gemini API key or model access is not configured. Check the Worker secret and Google AI Studio model access." } };
  }
  return { status, body: { error: message.slice(0, 500) } };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = getAllowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "vary": "Origin",
      }});
    }
    if (!origin && request.headers.has("Origin")) return response({ error: "Origin not allowed." }, 403);
    const corsOrigin = origin || DEFAULT_ORIGIN;
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return response({
        status: "ok",
        service: "PaliaAi secure AI proxy",
        provider: "Google Gemini",
        chatConfigured: Boolean(env.GEMINI_API_KEY),
        imageConfigured: Boolean(env.GEMINI_API_KEY && env.GEMINI_IMAGE_MODEL),
      }, 200, corsOrigin);
    }

    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      return response({ error: "Not found." }, 404, corsOrigin);
    }
    if (!env.GEMINI_API_KEY) {
      return response({ error: "AI backend is not configured. Add GEMINI_API_KEY as a Cloudflare Worker secret." }, 503, corsOrigin);
    }

    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_BODY_BYTES) return response({ error: "Request is too large. Reduce the number or size of uploaded images." }, 413, corsOrigin);

    let body: any;
    try { body = await request.json(); } catch { return response({ error: "Invalid JSON request." }, 400, corsOrigin); }
    const prompt = String(body?.prompt || body?.messages?.filter((m: any) => m?.role === "user").map((m: any) => m.content).join("\n") || "").trim();
    if (!prompt && !Array.isArray(body?.attachments)) return response({ error: "Enter a prompt or attach a file." }, 400, corsOrigin);
    if (prompt.length > MAX_PROMPT_CHARS) return response({ error: "Prompt is too long. Maximum is 8,000 characters." }, 400, corsOrigin);

    const intent = String(body?.intent || (body?.generateImage ? "image_generate" : "chat"));
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    const wantsImage = body?.generateImage === true || intent === "image_generate" || intent === "image_edit";

    try {
      if (wantsImage) {
        const model = env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
        const parts: any[] = [];
        for (const image of getImageParts(attachments)) parts.push(image);
        parts.push({ text: prompt || "Create a polished image based on the supplied reference image." });
        const data = await callGemini(env, model, [{ role: "user", parts }], {
          responseModalities: ["TEXT", "IMAGE"],
        });
        const resultParts = data?.candidates?.[0]?.content?.parts || [];
        const text = resultParts.filter((p: any) => p.text).map((p: any) => p.text).join("\n").trim();
        const imagePart = resultParts.find((p: any) => p.inlineData?.data);
        if (!imagePart) {
          return response({
            error: text || "The selected Gemini model did not return an image. Check whether image generation is enabled for this model and API key.",
            model,
          }, 502, corsOrigin);
        }
        const mime = imagePart.inlineData.mimeType || "image/png";
        const imageUrl = "data:" + mime + ";base64," + imagePart.inlineData.data;
        return response({
          id: "paliaai-" + crypto.randomUUID(),
          model,
          choices: [{ message: { role: "assistant", content: text || "Image generated successfully." } }],
          text: text || "Image generated successfully.",
          imageUrl,
          generatedImageUrl: imageUrl,
        }, 200, corsOrigin);
      }

      const model = env.GEMINI_CHAT_MODEL || "gemini-2.5-flash-lite";
      const history = Array.isArray(body?.messages) ? body.messages.slice(-16) : [];
      const contents: any[] = [];
      for (const item of history) {
        const role = item?.role === "assistant" || item?.role === "model" ? "model" : "user";
        const text = typeof item?.content === "string" ? item.content.slice(0, 12000) : "";
        if (text.trim()) contents.push({ role, parts: [{ text }] });
      }
      const imageParts = getImageParts(attachments);
      if (contents.length && contents[contents.length - 1].role === "user") {
        contents[contents.length - 1].parts.push(...imageParts);
      } else {
        contents.push({ role: "user", parts: [...imageParts, { text: prompt || "Please inspect the attached file." }] });
      }
      if (!contents.length) contents.push({ role: "user", parts: [{ text: prompt }] });

      const system = String(body?.messages?.find((m: any) => m?.role === "system")?.content || "").slice(0, 4000);
      const data = await callGemini(env, model, contents, {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        maxOutputTokens: 2048,
      });
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
      if (!text) return response({ error: "Gemini returned an empty response. Please try again." }, 502, corsOrigin);
      return response({
        id: "paliaai-" + crypto.randomUUID(),
        model,
        choices: [{ message: { role: "assistant", content: text } }],
        text,
      }, 200, corsOrigin);
    } catch (error: any) {
      const mapped = publicError(error);
      return response(mapped.body, mapped.status, corsOrigin);
    }
  },
} satisfies ExportedHandler<Env>;
