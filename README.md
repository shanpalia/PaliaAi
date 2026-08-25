# Palia AI — fixed build

## 1. Deploy backend

```bash
supabase link --project-ref ralinnuegsbuvlhwpzln
supabase functions deploy palia-ai --no-verify-jwt
```

The function reads `GEMINI_API_KEY` from Supabase secrets. Keep the key on the server; do not put it in `index.html`.

## 2. Verify CORS

```bash
curl -i -X OPTIONS https://ralinnuegsbuvlhwpzln.supabase.co/functions/v1/palia-ai
```

Expected: `HTTP ... 204` and `Access-Control-Allow-Origin: *`.

## 3. Verify text

```bash
curl -s -X POST https://ralinnuegsbuvlhwpzln.supabase.co/functions/v1/palia-ai -H "Content-Type: application/json" -d '{"action":"chat","userId":"test-user","message":"Hello, Palia AI"}'
```

## 4. Verify image generation

```bash
curl -s -X POST https://ralinnuegsbuvlhwpzln.supabase.co/functions/v1/palia-ai -H "Content-Type: application/json" -d '{"action":"image","userId":"test-image","message":"Create a modern premium app icon for PaliaAPK HUB. Use a bold P letter with a subtle APK download symbol, clean green and cyan gradient, rounded square, centered, no extra text."}'
```

The response must contain a non-empty `imageUrl` beginning with `data:image/`.

## Important

After changing the Edge Function, **redeploy it**. Updating only GitHub Pages does not update Supabase Edge Functions.

After changing `index.html`, commit/push the new root `index.html` to GitHub Pages.


## FINAL MULTIMODAL ARCHITECTURE

Image generation is now a **separate Supabase Edge Function**:
`palia-ai-image`

This is intentional: it prevents the old text-only `palia-ai` deployment from ever handling image-generation requests.

### Deploy BOTH functions

```bash
supabase functions deploy palia-ai --no-verify-jwt
supabase functions deploy palia-ai-image --no-verify-jwt
```

### Secret

The same existing secret is used:

```bash
supabase secrets set GEMINI_API_KEY="YOUR_EXISTING_KEY"
```

Optional model override:

```bash
supabase secrets set IMAGE_MODEL="gemini-3.1-flash-image"
```

The frontend automatically sends image requests to:
`/functions/v1/palia-ai-image`

Normal chat/search continues to use:
`/functions/v1/palia-ai`

Google's current Gemini API documentation confirms `gemini-3.1-flash-image` supports native image generation with `responseModalities: ["TEXT","IMAGE"]`.
