export interface Env {
  AI: Ai;
  APP_ORIGIN?: string;
}

const DEFAULT_ORIGIN = "https://shanpalia.github.io";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_PROMPT_CHARS = 8000;
const CHAT_MODEL = "@cf/zai-org/glm-4.7-flash";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

function json(data: unknown, status = 200, origin = DEFAULT_ORIGIN) {
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

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([
    DEFAULT_ORIGIN,
    ...(env.APP_ORIGIN ? [env.APP_ORIGIN.replace(/\/$/, "")] : []),
  ]);
  return allowed.has(origin) ? origin : null;
}

function decodeImage(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[2].replace(/\s/g, ""));
  if (binary.length > 1_500_000) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1], bytes };
}

function getError(error: any) {
  const message = String(error?.message || error || "AI request failed.");
  const lower = message.toLowerCase();
  const limit = /quota|rate.?limit|too many requests|neurons|capacity|429|3040/.test(lower);
  return {
    status: limit ? 429 : 502,
    body: {
      error: limit
        ? "PaliaAi's free daily AI allowance or model capacity is temporarily exhausted. Please try again later."
        : message.slice(0, 450),
      isLimitReached: limit,
    },
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "vary": "Origin",
      }});
    }
    if (!origin && request.headers.has("Origin")) return json({ error: "Origin not allowed." }, 403);
    const corsOrigin = origin || DEFAULT_ORIGIN;
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({
        status: "ok",
        service: "PaliaAi secure AI proxy",
        provider: "Cloudflare Workers AI",
        chatModel: CHAT_MODEL,
        imageModel: IMAGE_MODEL,
        apiKeyRequired: false,
      }, 200, corsOrigin);
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      return json({ error: "Not found." }, 404, corsOrigin);
    }

    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > MAX_BODY_BYTES) return json({ error: "Request is too large. Reduce the number or size of uploaded images." }, 413, corsOrigin);

    let body: any;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON request." }, 400, corsOrigin); }
    const prompt = String(body?.prompt || body?.messages?.filter((m: any) => m?.role === "user").map((m: any) => typeof m.content === "string" ? m.content : "").join("\n") || "").trim();
    if (!prompt) return json({ error: "Enter a prompt or question." }, 400, corsOrigin);
    if (prompt.length > MAX_PROMPT_CHARS) return json({ error: "Prompt is too long. Maximum is 8,000 characters." }, 400, corsOrigin);

    const intent = String(body?.intent || (body?.generateImage ? "image_generate" : "chat"));
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    const wantsImage = body?.generateImage === true || intent === "image_generate" || intent === "image_edit";

    try {
      if (wantsImage) {
        const form = new FormData();
        form.set("prompt", prompt.slice(0, 2048));
        form.set("width", "1024");
        form.set("height", "1024");
        form.set("guidance", "4");
        let imageIndex = 0;
        for (const attachment of attachments.slice(0, 4)) {
          const decoded = typeof attachment?.dataUrl === "string" ? decodeImage(attachment.dataUrl) : null;
          if (!decoded) continue;
          form.set("input_image_" + imageIndex, new Blob([decoded.bytes], { type: decoded.mime }), "reference-" + imageIndex);
          imageIndex++;
        }
        const formRequest = new Response(form);
        const contentType = formRequest.headers.get("content-type") || "multipart/form-data";
        const result: any = await env.AI.run(IMAGE_MODEL, {
          multipart: {
            body: formRequest.body!,
            contentType,
          },
        });
        if (!result?.image) return json({ error: "Image model did not return an image. Please try a different prompt." }, 502, corsOrigin);
        const imageUrl = "data:image/jpeg;base64," + result.image;
        const description = "Generated with Cloudflare Workers AI.";
        return json({
          id: "paliaai-" + crypto.randomUUID(),
          model: IMAGE_MODEL,
          choices: [{ message: { role: "assistant", content: description } }],
          text: description,
          imageUrl,
          generatedImageUrl: imageUrl,
        }, 200, corsOrigin);
      }

      const supplied = Array.isArray(body?.messages) ? body.messages.slice(-16) : [];
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
      const system = supplied.find((m: any) => m?.role === "system")?.content;
      if (typeof system === "string" && system.trim()) {
        messages.push({ role: "system", content: system.slice(0, 4000) });
      }
      for (const item of supplied) {
        if (!item || item.role === "system") continue;
        const role = item.role === "assistant" || item.role === "model" ? "assistant" : "user";
        const content = typeof item.content === "string" ? item.content.trim().slice(0, 12000) : "";
        if (content) messages.push({ role, content });
      }
      if (!messages.some((m) => m.role === "user")) messages.push({ role: "user", content: prompt });
      const result: any = await env.AI.run(CHAT_MODEL, {
        messages,
        max_completion_tokens: 1024,
        temperature: 0.7,
        reasoning_effort: "low",
        chat_template_kwargs: { enable_thinking: false },
      });

      // Workers AI models can return either a native { response } object
      // or an OpenAI-style { choices: [{ message: { content } }] } object.
      const candidate =
        result?.response ??
        result?.result?.response ??
        result?.choices?.[0]?.message?.content ??
        result?.choices?.[0]?.text ??
        result?.text ??
        result?.output_text;
      const text = typeof candidate === "string" ? candidate.trim() : "";
      if (!text) {
        // Include only response shape metadata; never log the user's prompt.
        const keys = result && typeof result === "object" ? Object.keys(result).slice(0, 12) : [];
        console.error("Workers AI returned no text", {
          model: CHAT_MODEL,
          resultKeys: keys,
          responseType: typeof result?.response,
          choiceCount: Array.isArray(result?.choices) ? result.choices.length : 0,
        });
        return json({
          error: "Cloudflare AI returned no text. Check Workers AI logs and model availability, then retry.",
          diagnostic: { model: CHAT_MODEL, resultKeys: keys },
        }, 502, corsOrigin);
      }
      return json({
        id: "paliaai-" + crypto.randomUUID(),
        model: CHAT_MODEL,
        choices: [{ message: { role: "assistant", content: text } }],
        text,
      }, 200, corsOrigin);
    } catch (error: any) {
      const mapped = getError(error);
      return json(mapped.body, mapped.status, corsOrigin);
    }
  },
} satisfies ExportedHandler<Env>;
