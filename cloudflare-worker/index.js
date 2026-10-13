const CORS = {
  "Access-Control-Allow-Origin": "https://shanpalia.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM = `You are Palia AI, developed by ShanPalia for PaliaAPK HUB.
IDENTITY: If asked who you are, say you are Palia AI by PaliaAPK HUB. Never claim to be ChatGPT, OpenAI, Claude, or Gemini, and never imply you are those systems.
LANGUAGE: Reply in the language the user uses. For Hindi/Hinglish, use natural, friendly Hindi/Hinglish. Match the user's level of technical knowledge.
HELPFULNESS: Answer the actual question directly first. Be practical, accurate, and specific. For complex tasks, organize the answer with short headings and numbered steps. For simple questions, keep it concise. When writing code, provide complete, runnable code where possible and explain exactly which file to change and how to run it.
HONESTY: Never claim you ran code, deployed a service, inspected a file, generated an image, or verified a result unless that actually happened. Clearly state uncertainty and missing requirements. Do not invent sources, links, prices, features, or test results.
CONVERSATION: Use prior messages in the supplied history to understand follow-up questions. Do not ask the user to repeat details already present. If the request is clear, proceed instead of asking unnecessary questions. If something fails, explain the cause in plain language and give the next useful action.
IMAGES: When an image is attached, use its visual content when the selected capability supports it. For supported image editing, edit the supplied image according to the instruction; do not merely describe how to edit it. For a white-background request, preserve the subject and replace only the background with clean white where feasible. Never say an edit succeeded unless an actual image result is returned.
SAFETY AND QUALITY: Give careful guidance for high-impact matters, distinguish facts from estimates, and prefer current verified information when available. Do not expose API keys, credentials, or private user data.`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function dataUrlToParts(dataUrl) {
  const m = String(dataUrl || "").match(/^data:(image\/[^;]+);base64,(.+)$/s);
  return m ? { mime: m[1], base64: m[2] } : null;
}

function textFromGemini(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  if (typeof data?.text === "string") return data.text;
  let out = "";
  for (const step of Array.isArray(data?.steps) ? data.steps : []) {
    if (step?.type !== "model_output") continue;
    for (const part of Array.isArray(step.content) ? step.content : []) {
      if (part?.type === "text" && typeof part.text === "string") out += part.text;
    }
  }
  return out.trim();
}

async function geminiChat(env, input) {
  if (!env.PALIA_GEMINI_API_KEY) {
    const error = new Error("Gemini API key is not configured.");
    error.provider = "gemini";
    throw error;
  }
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.PALIA_GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: "gemini-3.6-flash",
      input,
      system_instruction: SYSTEM,
      store: false,
    }),
  });

  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { error: { message: raw } }; }
  if (!r.ok) {
    const error = new Error(data?.error?.message || data?.message || "Gemini request failed");
    error.status = r.status;
    error.provider = "gemini";
    throw error;
  }
  return data;
}

function isProviderQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.status === 429 ||
    error?.status === 503 ||
    /quota|rate.?limit|resource_exhausted|too many requests|exceeded a quota|capacity/i.test(message);
}

async function openAIChatFallback(env, input) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Gemini quota/rate limit reached and OPENAI_API_KEY is not configured for fallback.");
  }
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.PALIA_OPENAI_FALLBACK_MODEL || "gpt-5.6-sol",
      instructions: SYSTEM,
      input,
      store: false,
    }),
  });
  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { error: { message: raw } }; }
  if (!r.ok) {
    const message = data?.error?.message || "OpenAI fallback request failed";
    throw new Error(`Gemini quota was reached; OpenAI fallback also failed: ${message}`);
  }
  let outputText = typeof data.output_text === "string" ? data.output_text : "";
  if (!outputText && Array.isArray(data.output)) {
    outputText = data.output.flatMap((item) =>
      Array.isArray(item.content) ? item.content : []
    ).filter((part) => part?.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text).join("\\n");
  }
  if (!outputText.trim()) throw new Error("OpenAI fallback returned an empty response.");
  return {
    id: data.id,
    model: data.model || env.PALIA_OPENAI_FALLBACK_MODEL || "gpt-5.6-sol",
    output_text: outputText.trim(),
    fallbackProvider: "openai",
  };
}

/*
 * Image generation and editing use Cloudflare Workers AI (free daily allocation).
 */
const IMAGE_LIMIT = 50;
const IMAGE_WINDOW_SECONDS = 24 * 60 * 60;
// Fallback keeps image features usable when the optional Cloudflare KV binding is absent.
// This is per Worker isolate; bind PALIA_USAGE for durable, shared quotas in production.
const localImageUsage = new Map();

async function quotaKey(body, request) {
  const userId = String(body?.userId || '').trim();
  const clientId = String(body?.clientId || '').trim();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const identity = userId || clientId || 'anonymous';
  const raw = `palia-image-limit:${identity}:${ip}`;
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'img:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function checkImageQuota(env, body, request) {
  const key = await quotaKey(body, request);
  const now = Date.now();
  const current = env.PALIA_USAGE
    ? await env.PALIA_USAGE.get(key, 'json')
    : localImageUsage.get(key) || null;

  if (!current || !current.expiresAt || current.expiresAt <= now) {
    return { allowed: true, count: 0, remaining: IMAGE_LIMIT, key };
  }

  const count = Number(current.count || 0);
  return {
    allowed: count < IMAGE_LIMIT,
    count,
    remaining: Math.max(0, IMAGE_LIMIT - count),
    resetAt: current.expiresAt,
    key,
  };
}

async function recordImageUsage(env, quota) {
  const now = Date.now();
  const current = env.PALIA_USAGE
    ? await env.PALIA_USAGE.get(quota.key, 'json')
    : localImageUsage.get(quota.key) || null;
  const expiresAt =
    current && Number(current.expiresAt) > now
      ? Number(current.expiresAt)
      : now + IMAGE_WINDOW_SECONDS * 1000;
  const count =
    current && Number(current.expiresAt) > now
      ? Number(current.count || 0) + 1
      : 1;

  const nextValue = { count, expiresAt };
  if (env.PALIA_USAGE) {
    await env.PALIA_USAGE.put(
      quota.key,
      JSON.stringify(nextValue),
      { expirationTtl: Math.max(60, Math.ceil((expiresAt - now) / 1000)) },
    );
  } else {
    localImageUsage.set(quota.key, nextValue);
  }

  return {
    count,
    remaining: Math.max(0, IMAGE_LIMIT - count),
    resetAt: expiresAt,
  };
}

function imageDataUrl(base64, mime = "image/jpeg") {
  return `data:${mime};base64,${base64}`;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function runCloudflareImage(env, prompt, aspectRatio, images = []) {
  if (!env.AI) throw new Error("Cloudflare Workers AI binding AI is not configured.");
  const sizes = {
    "1:1": [1024, 1024],
    "16:9": [1280, 720],
    "9:16": [720, 1280],
    "4:3": [1024, 768],
  };
  const [width, height] = sizes[aspectRatio] || sizes["1:1"];
  const form = new FormData();
  form.append("prompt", prompt.slice(0, 2048));
  form.append("width", String(width));
  form.append("height", String(height));
  images.slice(0, 2).forEach((image, index) => {
    form.append(`input_image_${index}`, new Blob([base64ToBytes(image.base64)], { type: image.mime || "image/png" }), `reference-${index}.png`);
  });
  const request = new Response(form);
  const result = await env.AI.run("@cf/black-forest-labs/flux-2-klein-4b", {
    multipart: {
      body: request.body,
      contentType: request.headers.get("content-type"),
    },
  });
  if (!result?.image) throw new Error("Cloudflare Workers AI returned no image. Please try again.");
  return imageDataUrl(result.image);
}

async function hfGenerate(env, prompt, aspectRatio) {
  return runCloudflareImage(
    env,
    prompt || "Create a beautiful, high-quality image based on the user's request.",
    aspectRatio,
  );
}

async function hfEdit(env, images, prompt) {
  const imageList = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!imageList.length) throw new Error("Upload at least one image to edit.");
  return runCloudflareImage(
    env,
    prompt || "Enhance this image naturally while preserving the original subject, face, identity and important details.",
    "1:1",
    imageList,
  );
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === "GET") {
      return json({
        ok: true,
        service: "Palia AI",
        status: "online",
        router: "Gemini + Hugging Face",
      });
    }

    if (request.method !== "POST") {
      return json({ error: { message: "Method not allowed" } }, 405);
    }

    const url = new URL(request.url);
    if (url.pathname !== "/v1/chat/completions") {
      return json({ error: { message: "Not found" } }, 404);
    }

    try {
      const body = await request.json();
      const prompt = String(body?.prompt || "").trim();
      const messages = Array.isArray(body?.messages) ? body.messages : [];
      const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
      const intent = String(body?.intent || "chat");
      const generateImage = body?.generateImage === true;

      const images = attachments
        .filter((a) => String(a?.type || "").toLowerCase() === "image" ||
          String(a?.mimeType || "").toLowerCase().startsWith("image/"))
        .map((a) => dataUrlToParts(a?.dataUrl))
        .filter(Boolean);
      const image = images[0] || null;
      const shortImageInstruction = /^(same|same image|aisa hi|aisi hi|like this|make same|similar|same bana do|same banao)$/i.test(prompt);
      const referenceImageEdit = images.length >= 2 && (shortImageInstruction || !prompt);

      if (referenceImageEdit || intent === "image_edit" || intent === "image_generate" || generateImage) {
        const quota = await checkImageQuota(env, body, request);
        if (!quota.allowed) {
          const resetInHours = Math.max(
            1,
            Math.ceil((Number(quota.resetAt) - Date.now()) / 3600000),
          );
          return json({
            error: {
              message: `24-hour image limit reached. You can create another image in about ${resetInHours} hour(s).`,
            },
            isLimitReached: true,
            imageLimit: IMAGE_LIMIT,
            imagesUsed: quota.count,
            imagesRemaining: 0,
            resetAt: quota.resetAt,
          }, 429);
        }

        const editPrompt = referenceImageEdit
          ? "Use the FIRST reference image as the target composition: preserve its pose, clothing, framing, background, and lighting. Use the SECOND reference image as the identity reference for the person; preserve their recognizable facial identity and natural facial features. Create one photorealistic image combining these references. Do not just describe the images."
          : prompt || "Enhance this image naturally while preserving the original subject, face, identity and important details.";
        const imageUrl = images.length
          ? await hfEdit(env, referenceImageEdit ? images : [image], editPrompt)
          : await hfGenerate(env, prompt || "Create a beautiful, high-quality image based on the user's request.", String(body?.aspectRatio || ""));

        const usage = await recordImageUsage(env, quota);

        return json({
          id: `palia-image-${Date.now()}`,
          object: "chat.completion",
          model: image ? "Qwen/Qwen-Image-Edit" : "fal-ai/flux-2/klein/9b/edit",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: image
                ? "आपकी फोटो को आपके prompt के अनुसार तैयार कर दिया गया है।"
                : "आपकी AI इमेज तैयार है।",
            },
            finish_reason: "stop",
          }],
          imageUrl,
          generatedImageUrl: imageUrl,
          imageLimit: IMAGE_LIMIT,
          imagesUsed: usage.count,
          imagesRemaining: usage.remaining,
          resetAt: usage.resetAt,
        });
      }

      const history = messages
        .slice(-20)
        .map((m) => `${m?.role === "assistant" ? "Palia AI" : "User"}: ${String(m?.content || "")}`)
        .join("\n\n");

      const input = [history, prompt ? `User: ${prompt}` : ""]
        .filter(Boolean)
        .join("\n\n");

      let data;
      let provider = "gemini";
      try {
        data = await geminiChat(env, input);
      } catch (geminiError) {
        if (!isProviderQuotaError(geminiError)) throw geminiError;
        console.warn("Gemini quota/rate limit reached; trying configured OpenAI fallback.");
        data = await openAIChatFallback(env, input);
        provider = "openai-fallback";
      }
      const text = textFromGemini(data);

      return json({
        id: data?.id || `palia-${Date.now()}`,
        object: "chat.completion",
        model: data?.model || (provider === "gemini" ? "gemini-3.6-flash" : "gpt-5.6-sol"),
        provider,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: text || "Palia AI को response नहीं मिला।",
          },
          finish_reason: "stop",
        }],
      });
    } catch (error) {
      console.error("PALIA AI ERROR", error);
      return json({
        error: {
          message: error instanceof Error ? error.message : "Palia AI error",
        },
      }, 500);
    }
  },
};
