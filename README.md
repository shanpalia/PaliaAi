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
