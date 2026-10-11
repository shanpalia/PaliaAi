const CORS = {
  "Access-Control-Allow-Origin": "https://shanpalia.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM = `You are Palia AI By PaliaAPK HUB, developed by ShanPalia.
Introduce yourself as Palia AI By PaliaAPK HUB when asked about your identity.
Never claim to be ChatGPT, OpenAI, Claude, or Gemini.
Reply in the user's language; prefer natural Hindi when the user writes Hindi or Hinglish.
Provide practical, accurate help with general questions and coding in HTML, CSS, JavaScript, Python, Flutter, and related tools.
You can chat, understand images, and route supported image editing/generation tasks.
When an image is supplied, use its visual information rather than asking the user to use another app when the requested operation is supported.`;

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
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": env.GEMINI_API_KEY,
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
  if (!r.ok) throw new Error(data?.error?.message || "Gemini request failed");
  return data;
}

/*
 * Hugging Face Inference Providers -> fal-ai queue.
 * HF's provider adapter converts image-to-image input to fal's image_url
 * format. The queue returns response_url; we poll its /status endpoint.
 */
const IMAGE_LIMIT = 25;
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

async function hfImageRequest(env, model, payload) {
  // Hugging Face Inference Providers expects a Hugging Face model ID after the provider name,
  // not a fal.ai endpoint slug. These endpoints return image bytes, not a fal queue job.
  const response = await fetch(`https://router.huggingface.co/fal-ai/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "image/*",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = await response.text();
    let detail;
    try { detail = JSON.parse(raw); } catch { detail = null; }
    throw new Error(detail?.error || detail?.message || raw || `Hugging Face HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  if (!contentType.toLowerCase().startsWith("image/")) {
    const raw = await response.text();
    throw new Error(`Hugging Face returned unexpected content: ${raw.slice(0, 400)}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function hfGenerate(env, prompt, aspectRatio) {
  const sizes = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "4:3": { width: 1024, height: 768 },
  };
  return hfImageRequest(env, "black-forest-labs/FLUX.1-schnell", {
    inputs: prompt,
    parameters: {
      width: (sizes[aspectRatio] || sizes["1:1"]).width,
      height: (sizes[aspectRatio] || sizes["1:1"]).height,
    },
  });
}

async function hfEdit(env, images, prompt) {
  const imageList = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!imageList.length) throw new Error("Upload at least one image to edit.");

  // FLUX.2 klein image-to-image accepts one source image per request.
  const image = imageList[0];
  const inputImage = `data:${image.mime};base64,${image.base64}`;
  return hfImageRequest(env, "black-forest-labs/FLUX.2-klein-9B", {
    inputs: inputImage,
    parameters: { prompt },
  });
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
        if (!env.HF_TOKEN) {
          throw new Error("HF_TOKEN is not configured in the Cloudflare Worker.");
        }

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
          model: image ? "Qwen/Qwen-Image-Edit" : "fal-ai/flux/schnell",
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

      const data = await geminiChat(env, input);
      const text = textFromGemini(data);

      return json({
        id: data?.id || `palia-${Date.now()}`,
        object: "chat.completion",
        model: data?.model || "gemini-3.6-flash",
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
