# Palia AI — Original Multimodal Build

This is the Palia AI project based on the uploaded ZIP.

## Included

- AI chat
- Web Search
- Image/file/video attachment UI
- Multimodal image understanding
- Image creation/editing request routing
- Actual generated-image rendering when an image-capable model is configured
- Download / Regenerate / Edit UI for generated images
- Voice input
- Recent Chats
- Rename / Pin / Archive / Delete
- Automatic chat titles
- Guest local chat persistence
- Daily 2-hour usage
- Profile/settings drawer
- GitHub Pages compatible frontend
- Supabase Edge Function backend
- CORS handling
- No provider/model branding in the user-facing UI

## Supabase deployment

From the project root:

```bash
supabase link --project-ref ralinnuegsbuvlhwpzln
supabase functions deploy palia-ai --no-verify-jwt
```

Set the text API key:

```bash
supabase secrets set GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

The default text model is:

```text
gemini-3.6-flash
```

You can override it with:

```bash
supabase secrets set TEXT_MODEL="YOUR_AVAILABLE_TEXT_MODEL"
```

### Actual image generation

The image-generation model must be an image-capable model that is available to the Google API key in your project.

Set:

```bash
supabase secrets set IMAGE_MODEL="YOUR_AVAILABLE_IMAGE_MODEL"
```

Then redeploy:

```bash
supabase functions deploy palia-ai --no-verify-jwt
```

Do not put `GEMINI_API_KEY` in `index.html`.

## Important

The included two-hour usage counter is an in-memory fallback. For strict production quota enforcement across Edge Function restarts/instances, move usage records to a Supabase table with server-side writes.


## Important image-generation fix

The image action defaults to the current stable Gemini image model:
`gemini-3.1-flash-image`

You may override it with the Supabase secret:
`IMAGE_MODEL`

Text chat remains on:
`gemini-3.6-flash`

Deploy:
`supabase functions deploy palia-ai --no-verify-jwt`
