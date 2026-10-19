# PaliaAi Razorpay Worker (Cloudflare Workers + Firebase Auth + Supabase)

This Worker fits the existing PaliaAi repository: the frontend already uses Firebase Authentication, and the payment backend uses Supabase PostgREST for persistent subscription records. It creates per-user Razorpay Payment Links with server-controlled amounts, verifies Razorpay webhook signatures, and never grants Pro from a browser redirect.

## 1. Create the database tables
Open the Supabase project connected to PaliaAi, then run the complete SQL from [supabase/schema.sql](supabase/schema.sql) in **SQL Editor**. Keep Row Level Security enabled and do not create public client policies for these tables.

## 2. Deploy the Worker
From the repository's `cloudflare-worker` folder:
```bash
npm install
npx wrangler deploy
``
The Worker name is `paliaai-payments` in `wrangler.jsonc`. Cloudflare will print its deployed `.workers.dev` URL.

## 3. Add Cloudflare secrets
In Cloudflare Dashboard → Workers & Pages → `paliaai-payments` → Settings → Variables and Secrets, add:
- `RAZORPAY_KEY_ID` — Razorpay API key ID
- `RAZORPAY_KEY_SECRET` — Razorpay API key secret (Secret)
- `RAZORPAY_WEBHOOK_SECRET` — the webhook signing secret you choose in Razorpay (Secret)
- `FIREBASE_API_KEY` — API key from the existing Firebase web app configuration
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (Secret; never expose it in frontend code)

Set `APP_ORIGIN` to `https://shanpalia.github.io/PaliaAi/` if it is not already present. Redeploy after saving the variables/secrets.

## 4. Configure Razorpay webhook
In Razorpay Dashboard, add webhook URL:
`https://YOUR-DEPLOYED-WORKER-URL/webhooks/razorpay`
Subscribe to `payment_link.paid`. Set the same webhook secret in Cloudflare as `RAZORPAY_WEBHOOK_SECRET`. Test the webhook delivery in Razorpay.

## 5. Connect GitHub Pages frontend
In GitHub → `shanpalia/PaliaAi` → Settings → Secrets and variables → Actions → Variables, add:
- Name: `VITE_PALIA_PAYMENTS_WORKER_URL`
- Value: the Worker origin only, e.g. `https://paliaai-payments.YOUR-SUBDOMAIN.workers.dev` (no path or trailing slash)

Then go to Actions and rerun the Pages deployment workflow, or push a new commit. The Upgrade buttons stay disabled until this variable is supplied, preventing checkout from accidentally using old unassociated payment links.

## How the flow works
1. The signed-in Firebase user chooses Monthly ₹49 or Yearly ₹399.
2. The frontend sends its Firebase ID token to `POST /checkout`; the Worker verifies the token with Firebase and creates a new Razorpay link whose `reference_id` is that user's Firebase UID.
3. Razorpay sends `payment_link.paid` to the Worker. The Worker verifies the raw-body HMAC signature, checks captured payment status, currency, exact amount, and user association.
4. Only then does the Worker write the payment and subscription to Supabase.
5. The frontend checks `GET /subscription` after sign-in and uses that server response, not local storage, to show Pro.

## Important
- The manually created short links `q5Ri26Kb` and `A086v2Tj` are not used by the secure checkout because they don't reliably associate a purchase with the signed-in user. The Worker creates a new link per authenticated user at the same ₹49/₹399 prices.
- Do not paste any secret into GitHub source files, Vite variables, or chat.
- Before accepting real payments, test both plans and webhook retries with Razorpay test credentials. A redirect alone never activates Pro.
