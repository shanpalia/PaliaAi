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

        const edited = await hfEdit(
          env,
          image,
          prompt ||
            "Enhance this image naturally while preserving the original subject, face, identity and important details."
        );

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
