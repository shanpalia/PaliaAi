# PaliaAi secure AI Worker

This Worker is a server-side proxy for the existing PaliaAi frontend route `/v1/chat/completions`. It keeps the Gemini key out of browser JavaScript and supports text chat, image understanding, image generation, and image editing when the configured Gemini image model is enabled for the API key.

## Free-tier expectations

- Start with `gemini-2.5-flash-lite` for chat. Check the current Google AI Studio quota for your own project; free-tier availability and request limits can change.
- Image generation is not guaranteed to be free or enabled for every project/model. `gemini-2.5-flash-image` is the default image model, but confirm its current availability and pricing in AI Studio before relying on it. The Worker returns a clear error if the model has no access or quota.
- A free API tier is limited, not unlimited. Do not promise visitors unlimited AI usage. Add a persistent rate limit / authentication before making the endpoint widely public.

## Deploy using the existing frontend endpoint

The frontend currently calls `https://paliaai.shanpalia786.workers.dev/v1/chat/completions` by default. This Worker is named `paliaai` so deploying it to the same Cloudflare account/name should preserve that URL. **Confirm this is the intended Worker before deploying**: deploying the same name replaces its current code, so export/back up the existing Worker first if it contains anything you still need.

1. Create a Gemini API key in Google AI Studio: https://aistudio.google.com/apikey
2. From this folder, run `npx wrangler secret put GEMINI_API_KEY` and paste the key into the terminal prompt. Never paste the key into source code or GitHub.
3. Install Wrangler if needed: `npm install --save-dev wrangler`.
4. Deploy from this directory: `npx wrangler deploy`.
5. Open `https://paliaai.shanpalia786.workers.dev/health`. It should return JSON with `status: "ok"` and `chatConfigured: true`.
6. Test text chat, then image generation. If image generation returns a model-access/quota error, check the model's access and current pricing in Google AI Studio before enabling billing.

## Security notes

- The API key is read only from the Worker secret `GEMINI_API_KEY`; it is never returned to the browser.
- The Worker checks the website Origin, limits prompt size, restricts accepted image data URLs and avoids caching responses.
- Origin checks are not authentication and can be forged by non-browser clients. Before public launch, add persistent per-IP/user rate limiting and abuse protection. Do not rely on localStorage credits as server-side security.
- Do not put the Gemini key in `VITE_*` variables, React components, or any committed file.
- This Worker only handles `/v1/chat/completions`; it does not replace the separate `cloudflare-worker/` payment webhook Worker.
