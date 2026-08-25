# Palia AI — Complete Multimodal Build

## What is included

- AI chat
- Web Search
- Image understanding
- Image/file/video attachment UI
- Image/icon/logo editing requests
- Optional image generation through `IMAGE_MODEL`
- Voice input
- Conversation history
- Daily 2-hour usage
- Profile drawer
- GitHub Pages static frontend
- Supabase Edge Function backend
- No Gemini/provider branding in the UI

## GitHub Pages

Upload the website files to the repository root and use the normal GitHub Pages branch deployment.

## Supabase

This repository includes:

`supabase/config.toml`

with:

```toml
[functions.palia-ai]
verify_jwt = false
```

Deploy:

```bash
supabase link --project-ref ralinnuegsbuvlhwpzln
supabase functions deploy palia-ai --no-verify-jwt
```

Set the secret:

```bash
supabase secrets set GEMINI_API_KEY="YOUR_KEY"
```

The current working text model defaults to:

`gemini-3.6-flash`

You can override it:

```bash
supabase secrets set TEXT_MODEL="gemini-3.6-flash"
```

For actual image generation, configure an image-capable Gemini model available to your API key:

```bash
supabase secrets set IMAGE_MODEL="YOUR_IMAGE_CAPABLE_MODEL"
```

The image action uses `responseModalities: ["TEXT","IMAGE"]`. If the configured model does not support image output, the function returns a clear configuration error instead of faking an image.

## Security

Do not put:

- GEMINI_API_KEY
- Supabase service-role key

in `index.html` or GitHub.

The browser only calls the public Edge Function. The Gemini secret stays in Supabase.

## Important usage note

The included 2-hour quota uses Edge Function memory as a simple fallback. For strict production enforcement across function restarts/instances, store usage in a Supabase table with RLS/server-side writes.

## Final setup

Deploy:
`supabase functions deploy palia-ai --no-verify-jwt`

Set:
`supabase secrets set GEMINI_API_KEY="YOUR_KEY"`

For actual image generation, set an image-capable model available to your API key:
`supabase secrets set IMAGE_MODEL="YOUR_IMAGE_MODEL"`

The browser never receives GEMINI_API_KEY.
