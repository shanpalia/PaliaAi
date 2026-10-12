# PaliaAi Razorpay Cloudflare Worker

This Worker implements server-verified Razorpay Payment Link webhooks and persistent Supabase subscription records. It does not activate Pro based on the browser redirect.

## Configure secrets (Cloudflare Worker > Settings > Variables and Secrets)
Required secrets:
- RAZORPAY_KEY_ID
- RAZORPAY_KEY_SECRET
- RAZORPAY_WEBHOOK_SECRET
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (secret; server-side only)

Optional variable:
- APP_ORIGIN = https://shanpalia.github.io/PaliaAi/

## Setup
1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Deploy this directory as a Cloudflare Worker using `wrangler deploy`.
3. Configure Razorpay webhook URL as `https://YOUR-WORKER.workers.dev/webhooks/razorpay`; subscribe to `payment_link.paid`. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`.
4. Use `POST /checkout` with JSON `{"plan":"monthly"}` or `{"plan":"yearly"}` and `Authorization: Bearer <Supabase access token>`. The Worker creates a fresh payment link with a server-controlled amount and authenticated user UUID in reference_id.
5. Use `GET /subscription` with the same Supabase access token to read verified Pro status.

## Important integration requirements
- The current PaliaAi frontend's authService is a mock/local implementation, not Supabase Auth. The checkout endpoint intentionally rejects it; do not pass a client-supplied user ID as proof of identity.
- Before production, migrate the frontend login/signup to Supabase Auth, call this Worker's /checkout endpoint instead of hard-coded Razorpay links, and read /subscription on session load.
- Existing manually created Razorpay short links do not contain a trusted per-user association and cannot safely grant Pro. The Worker creates per-user links using the exact ₹49/₹399 amounts.
- Test webhook delivery and duplicate retries before launch. Only captured INR payments with matching configured amount activate a plan.
- Do not put any secret in Vite env variables or frontend code.
