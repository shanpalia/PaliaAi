const CORS = {
  "Access-Control-Allow-Origin": "https://shanpalia.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM = `You are Palia AI, developed by ShanPalia.
Your name is Palia AI. Never claim to be ChatGPT, OpenAI, Claude, or Gemini.
Match the user's language naturally. Be accurate, practical and clear.
You can chat, understand images, and route image editing/generation tasks.
When an image is supplied, use its visual information rather than asking
the user to use another app when the requested operation is supported.`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

function dataUrlToParts(dataUrl) {
  const m = String(dataUrl || "").match(/^data:(image\\/[^;]+);base64,(.+)$/s);
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
  const r = await fetch("https://generativelanguage.googleapis.com/v1/interactions", {
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
  if (!env.PALIA_USAGE) {
    throw new Error('PALIA_USAGE KV binding is not configured.');
  }

  const key = await quotaKey(body, request);
  const now = Date.now();
  const current = await env.PALIA_USAGE.get(key, 'json');

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
  const current = await env.PALIA_USAGE.get(quota.key, 'json');
  const expiresAt =
    current && Number(current.expiresAt) > now
      ? Number(current.expiresAt)
      : now + IMAGE_WINDOW_SECONDS * 1000;
  const count =
    current && Number(current.expiresAt) > now
      ? Number(current.count || 0) + 1
      : 1;

  await env.PALIA_USAGE.put(
    quota.key,
    JSON.stringify({ count, expiresAt }),
    { expirationTtl: Math.max(60, Math.ceil((expiresAt - now) / 1000)) },
  );

  return {
    count,
    remaining: Math.max(0, IMAGE_LIMIT - count),
    resetAt: expiresAt,
  };
}

async function hfEdit(env, image, prompt) {
  const submitUrl =
    "https://router.huggingface.co/fal-ai/fal-ai/qwen-image-edit?_subdomain=queue";

  const submit = await fetch(submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        image_url: `data:${image.mime};base64,${image.base64}`,
      },
    }),
  });

  const submitRaw = await submit.text();
  let job;
  try { job = JSON.parse(submitRaw); } catch { job = {}; }

  if (!submit.ok) {
    throw new Error(
      job?.error || job?.message || submitRaw || `Hugging Face HTTP ${submit.status}`
    );
  }

  if (!job.request_id || !job.response_url) {
    throw new Error("Hugging Face did not return a queue request.");
  }

  const responseUrl = new URL(job.response_url);
  const baseUrl = `${responseUrl.origin}${responseUrl.pathname}`;
  const query = responseUrl.search;

  const statusUrl = `${baseUrl}/status${query}`;
  const resultUrl = `${baseUrl}${query}`;

  for (let attempt = 0; attempt < 60; attempt++) {
    const statusResponse = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${env.HF_TOKEN}`,
      },
    });

    const statusRaw = await statusResponse.text();
    let status;
    try { status = JSON.parse(statusRaw); } catch { status = {}; }

    if (!statusResponse.ok) {
      throw new Error(
        status?.error || status?.message || statusRaw
      );
    }

    if (status.status === "COMPLETED") {
      const resultResponse = await fetch(resultUrl, {
        headers: {
          Authorization: `Bearer ${env.HF_TOKEN}`,
        },
      });

      const resultRaw = await resultResponse.text();
      let result;
      try { result = JSON.parse(resultRaw); } catch { result = {}; }

      if (!resultResponse.ok) {
        throw new Error(
          result?.error || result?.message || resultRaw
        );
      }

      const url = result?.images?.[0]?.url;
      if (!url) {
        throw new Error("Image provider completed without an image URL.");
      }

      return url;
    }

    if (status.status === "FAILED") {
      throw new Error(
        status.error || status.message || "Image editing failed."
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Image editing timed out. Please try again.");
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

      const image = attachments
        .map((a) => dataUrlToParts(a?.dataUrl))
        .find(Boolean);

      if ((intent === "image_edit" || generateImage) && image) {
        if (!env.HF_TOKEN) {
          throw new Error("HF_TOKEN is not configured.");
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

        const edited = await hfEdit(
          env,
          image,
          prompt ||
            "Enhance this image naturally while preserving the original subject, face, identity and important details."
        );

        const usage = await recordImageUsage(env, quota);

        return json({
          id: `palia-image-${Date.now()}`,
          object: "chat.completion",
          model: "Qwen/Qwen-Image-Edit",
          choices: [{
            index: 0,
            message: {
              role: "assistant",
              content: "आपकी फोटो को आपके prompt के अनुसार तैयार कर दिया गया है।",
            },
            finish_reason: "stop",
          }],
          imageUrl: edited,
          generatedImageUrl: edited,
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
