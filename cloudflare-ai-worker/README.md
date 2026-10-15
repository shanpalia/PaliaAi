# PaliaAi secure AI Worker (Cloudflare Workers AI)

This Worker keeps AI inference on the server and matches the existing frontend endpoint `/v1/chat/completions`. It does **not** require a Gemini or OpenAI API key.

## What it uses

- Chat: `@cf/zai-org/glm-4.7-flash`
- Image generation and reference-image editing: `@cf/black-forest-labs/flux-2-klein-4b`
- Cloudflare Workers AI includes a free allocation of **10,000 Neurons per day**. Limits reset daily at 00:00 UTC. Requests may fail when the allowance, model capacity, or rate limit is reached. It is free within the allocation, not unlimited. See https://developers.cloudflare.com/workers-ai/platform/pricing/
- Image model usage consumes the same daily allowance. Cloudflare may change model availability and quotas; check the dashboard before public launch.

## Deploy

The existing frontend default in `src/services/api.ts` is `https://paliaai.shanpalia786.workers.dev`. This configuration names the Worker `paliaai` so it can keep that URL **if it is deployed in the same Cloudflare account**.

1. Open Cloudflare Dashboard and make sure Workers AI is enabled for your account.
2. Back up/export the existing Worker named `paliaai` before replacing it. Deploying the same name replaces its current code.
3. Open GitHub Codespaces or a terminal in this folder. Install Wrangler if needed: `npm install --save-dev wrangler`.
4. Log in: `npx wrangler login`.
5. From `cloudflare-ai-worker/`, deploy: `npx wrangler deploy`. The `[ai]` binding connects Workers AI; there is no API key to paste or commit.
6. Test `https://paliaai.shanpalia786.workers.dev/health`. It should return JSON with `status: "ok"` and `apiKeyRequired: false`.
7. Test chat and image generation on https://shanpalia.github.io/PaliaAi/.

## Security and limits

- No provider API key is stored in frontend JavaScript or GitHub.
- The Worker allows the GitHub Pages origin, validates request shape, limits prompt and request size, and does not cache AI responses.
- Origin checks are not authentication. Because this is a public app, add persistent per-IP/user rate limiting and abuse protection before heavy public use. Browser localStorage credits are not a secure server-side limit.
- The existing separate `cloudflare-worker/` folder is for Razorpay/Supabase payments and is not replaced by this AI Worker.
- Chat/image generation can still return 429 or capacity errors when Cloudflare's free allocation is exhausted. No provider offers unlimited free inference.
