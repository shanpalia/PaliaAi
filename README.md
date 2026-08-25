# Palia AI — GitHub Pages + Supabase

This build is a **plain static website**. It does not use React/Vite at runtime, so GitHub Pages can serve it directly like a normal PaliaAPK HUB-style website.

## 1. GitHub Pages
Upload `index.html` to the repository root. In GitHub:
Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
No GitHub Actions are required.

## 2. Configure the AI backend
The browser must NOT contain a Gemini secret key. The included Supabase Edge Function keeps `GEMINI_API_KEY` server-side.

In `index.html`, replace the empty `SUPABASE_ANON_KEY` with your Supabase publishable/anon key.

Deploy `supabase/functions/palia-ai/index.ts` as the Edge Function named `palia-ai`.

Set this Supabase Function secret:
`GEMINI_API_KEY=YOUR_GEMINI_API_KEY`

The frontend will call:
`https://ralinnuegsbuvlhwpzln.supabase.co/functions/v1/palia-ai`

## 3. What works
- Palia AI chat
- Multi-turn chat history in the current browser session
- Live web search grounding with source links
- Daily 2-hour usage counter
- Profile drawer with usage slider/progress
- Voice input through browser speech recognition
- Image upload/analysis request path
- TXT/MD document analysis path
- Responsive desktop/mobile UI
- No Gemini branding in the user UI
- No GitHub Actions required

## Security
Never put `GEMINI_API_KEY` in `index.html`, GitHub, or any client-side JavaScript. Keep it as a Supabase Edge Function secret.
