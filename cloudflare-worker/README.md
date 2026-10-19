# PaliaAi Razorpay Worker (Cloudflare + Firebase Auth + D1)

This Worker uses the Firebase Auth session already present in PaliaAi. It validates ID tokens with Firebase Identity Toolkit, creates per-user Razorpay Payment Links with server-controlled INR amounts, verifies Razorpay webhook signatures, and stores successful payments/subscriptions in Cloudflare D1. A redirect never activates Pro.

## Deploy
1. From this folder run `npm install`.
2. Create D1: `npx wrangler d1 create paliaai-payments`. Copy the returned database_id into `wrangler.jsonc` replacing `REPLACE_WITH_D1_DATABASE_ID`.
3. Apply schema: `npx wrangler d1 migrations apply paliaai-payments --remote`.
4. Set secrets with `npx wrangler secret put RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `FIREBASE_WEB_API_KEY`. Never commit secret values.
5. Deploy: `npx wrangler deploy`.
6. In Razorpay Dashboard, add webhook URL `https://paliaai-payments.<your-subdomain>.workers.dev/webhooks/razorpay`, select `payment_link.paid`, and use the same webhook secret.
7. In the PaliaAi GitHub repository, add Actions variable `VITE_PALIA_PAYMENTS_WORKER_URL` with the deployed Worker origin and rerun the Pages workflow.

## Endpoints
- `GET /health`: public health check.
- `POST /checkout`: Firebase ID token in Authorization Bearer; JSON `{"plan":"monthly"}` or `{"plan":"yearly"}`. Amount is fixed server-side at ₹49 / ₹399.
- `GET /subscription`: Firebase ID token in Authorization Bearer; returns active Pro status only when D1 records an unexpired, webhook-verified payment.
- `POST /webhooks/razorpay`: verifies raw-body HMAC signature and captured INR payment, checks amount, and persists idempotently.

## Notes
- The current hard-coded ₹49 and ₹399 Payment Links remain in Razorpay but are not used by the new secure checkout because they do not bind a payer to a signed-in user. Checkout creates a fresh Razorpay link for each authenticated user.
- The Firebase Web API key is a public Firebase project identifier, but configure it as a Worker variable/secret to avoid hardcoding it in the Worker.
- Only the server changes entitlement. The frontend's local profile is never accepted as proof of Pro.
