# PaliaAi Razorpay Cloudflare Worker

This Worker uses the Firebase Authentication already present in PaliaAi, Razorpay Payment Links and Supabase tables for durable subscription state. Pro is never activated by the redirect page.

## Secrets in Cloudflare Worker > Settings > Variables and Secrets
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- FIREBASE_API_KEY (Firebase web API key from the existing app config; may be set as a Worker variable)
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (secret; server-side only)

Optional variable: APP_ORIGIN = https://shanpalia.github.io/PaliaAi/

## Deploy
From this directory: `npx wrangler deploy`. Set secrets with `npx wrangler secret put NAME`. Use `wrangler.toml` to name the Worker and configure compatibility date.

## Database
Run `supabase/schema.sql` in the Supabase SQL Editor. Firebase UIDs are stored as text; no Supabase Auth dependency is assumed.

## Razorpay webhook
Register `https://YOUR-WORKER.workers.dev/webhooks/razorpay`, subscribe to `payment_link.paid`, and use the webhook signing secret as `RAZORPAY_WEBHOOK_SECRET`. The handler verifies the HMAC against the exact raw body, validates captured INR payment and amount, and ignores duplicate payment IDs.

## Frontend
The Upgrade modal calls `POST /checkout` with the signed-in Firebase ID token. The Worker creates a per-user payment link for exactly ₹49 or ₹399. The success-return screen asks `GET /subscription`; it never trusts the query string to grant Pro.

## Launch checklist
- Configure all Worker secrets and deploy.
- Run the SQL schema.
- Register and test the Razorpay webhook.
- Test monthly/yearly payments using Razorpay test mode first.
