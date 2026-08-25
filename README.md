# Palia AI

GitHub Pages frontend + Supabase Edge Function backend.

## GitHub Pages
Upload the website files to the repository root and use normal GitHub Pages branch deployment.

## Supabase
Deploy `supabase/functions/palia-ai/index.ts` as the `palia-ai` Edge Function.

`supabase/config.toml` contains:

```toml
[functions.palia-ai]
verify_jwt = false
```

Set the Supabase Function Secret:

`GEMINI_API_KEY`

Do NOT put a Gemini secret or Supabase service-role key in `index.html`.

In `index.html`, set `window.PALIA_CONFIG.SUPABASE_ANON_KEY` to the Supabase publishable/anon key if the site needs to send it with the function request.

The website endpoint is:
`https://ralinnuegsbuvlhwpzln.supabase.co/functions/v1/palia-ai`

The Edge Function handles:
- CORS preflight
- AI chat
- Web search
- usage checks
- 2-hour daily quota (in-memory fallback)
