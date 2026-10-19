export interface Env {
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  FIREBASE_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN?: string;
}
const allowedOrigin = "https://shanpalia.github.io";
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": allowedOrigin, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS", "vary": "Origin" } });
}
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function firebaseUser(request: Request, env: Env): Promise<{ uid: string; email?: string } | null> {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const idToken = auth.slice(7).trim();
  if (!idToken) return null;
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_API_KEY), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken })
  });
  if (!response.ok) return null;
  const payload = await response.json() as { users?: Array<{ localId?: string; email?: string }> };
  const user = payload.users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email } : null;
}
async function db(env: Env, path: string, init: RequestInit = {}) {
  return fetch(env.SUPABASE_URL.replace(/\/$/, "") + path, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json", ...(init.headers || {}) }
  });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": allowedOrigin, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" } });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, service: "paliaai-payments", auth: "firebase" });
    if (url.pathname === "/webhooks/razorpay" && request.method === "POST") {
      const raw = await request.text();
      const signature = request.headers.get("x-razorpay-signature") || "";
      if (!signature || !timingSafeEqual(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw), signature)) return json({ error: "Invalid webhook signature" }, 401);
      let event: any;
      try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
      if (event.event !== "payment_link.paid") return json({ received: true, ignored: true });
      const link = event.payload?.payment_link?.entity;
      const payment = event.payload?.payment?.entity;
      if (!link?.id || !link?.reference_id || !payment?.id || payment.status !== "captured" || link.status !== "paid") return json({ error: "Payment not confirmed/captured" }, 400);
      const userId = String(link.reference_id);
      const amount = Number(link.amount);
      const plan = amount === 4900 ? "monthly" : amount === 39900 ? "yearly" : null;
      if (!plan || Number(payment.amount) !== amount || payment.currency !== "INR") return json({ error: "Amount/currency does not match a configured plan" }, 400);
      const lookup = await db(env, "/rest/v1/paliaai_payments?razorpay_payment_id=eq." + encodeURIComponent(payment.id) + "&select=id");
      if (!lookup.ok) return json({ error: "Payment lookup failed" }, 500);
      if (((await lookup.json()) as any[]).length) return json({ received: true, duplicate: true });
      const now = new Date();
      const existingSubRes = await db(env, "/rest/v1/paliaai_subscriptions?user_id=eq." + encodeURIComponent(userId) + "&select=expires_at,status&limit=1");
      if (!existingSubRes.ok) return json({ error: "Subscription lookup failed" }, 500);
      const previous = ((await existingSubRes.json()) as any[])[0];
      const base = previous?.status === "active" && Date.parse(previous.expires_at) > now.getTime() ? new Date(previous.expires_at) : now;
      const expires = new Date(base);
      if (plan === "monthly") expires.setMonth(expires.getMonth() + 1); else expires.setFullYear(expires.getFullYear() + 1);
      const paymentSave = await db(env, "/rest/v1/paliaai_payments", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ user_id: userId, razorpay_payment_id: payment.id, razorpay_payment_link_id: link.id, amount_paise: amount, plan, status: "paid", paid_at: now.toISOString(), expires_at: expires.toISOString() }) });
      if (!paymentSave.ok) return json({ error: "Could not persist payment; webhook retry required" }, 500);
      const subSave = await db(env, "/rest/v1/paliaai_subscriptions?on_conflict=user_id", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, plan, status: "active", starts_at: now.toISOString(), expires_at: expires.toISOString(), last_payment_id: payment.id, updated_at: now.toISOString() }) });
      if (!subSave.ok) return json({ error: "Payment saved but subscription update failed; check and retry" }, 500);
      return json({ received: true, activated: true });
    }
    if (url.pathname === "/checkout" && request.method === "POST") {
      const user = await firebaseUser(request, env);
      if (!user) return json({ error: "Please sign in to PaliaAi first." }, 401);
      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const plan = body?.plan;
      const amount = plan === "monthly" ? 4900 : plan === "yearly" ? 39900 : 0;
      if (!amount) return json({ error: "Choose monthly or yearly plan." }, 400);
      const payload = { amount, currency: "INR", accept_partial: false, description: plan === "monthly" ? "PaliaAi Pro Monthly" : "PaliaAi Pro Yearly", reference_id: user.uid, callback_url: (env.APP_ORIGIN || "https://shanpalia.github.io/PaliaAi/") + "?payment=success", callback_method: "get", notify: { sms: false, email: false }, reminder_enable: false, notes: { user_id: user.uid, plan, product: "PaliaAi" } };
      const auth = btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
      const created = await fetch("https://api.razorpay.com/v1/payment_links", { method: "POST", headers: { authorization: "Basic " + auth, "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result: any = await created.json();
      if (!created.ok || !result.short_url) return json({ error: "Could not create Razorpay checkout link. Check Worker credentials." }, 502);
      return json({ checkout_url: result.short_url });
    }
    if (url.pathname === "/subscription" && request.method === "GET") {
      const user = await firebaseUser(request, env);
      if (!user) return json({ error: "Please sign in to check subscription." }, 401);
      const response = await db(env, "/rest/v1/paliaai_subscriptions?user_id=eq." + encodeURIComponent(user.uid) + "&select=plan,status,expires_at&limit=1");
      if (!response.ok) return json({ error: "Could not read subscription" }, 500);
      const sub = ((await response.json()) as any[])[0];
      const active = Boolean(sub && sub.status === "active" && Date.parse(sub.expires_at) > Date.now());
      return json({ tier: active ? "Pro" : "Free", plan: active ? sub.plan : null, expires_at: active ? sub.expires_at : null });
    }
    return json({ error: "Not found" }, 404);
  }
} satisfies ExportedHandler<Env>;
