export interface Env {
  DB: D1Database;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  FIREBASE_WEB_API_KEY: string;
  APP_ORIGIN?: string;
}

const APP_ORIGIN = "https://shanpalia.github.io";
const headers = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": APP_ORIGIN, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
function equalSafe(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function authenticatedFirebaseUser(request: Request, env: Env): Promise<{ localId: string; email?: string } | null> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token === request.headers.get("authorization")) return null;
  const response = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_WEB_API_KEY), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: token })
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId: string; email?: string; emailVerified?: boolean; disabled?: boolean }> };
  const user = data.users?.[0];
  return user?.localId && !user.disabled ? { localId: user.localId, email: user.email } : null;
}
function planFromAmount(amount: number): "monthly" | "yearly" | null {
  return amount === 4900 ? "monthly" : amount === 39900 ? "yearly" : null;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, service: "paliaai-payments", mode: "firebase-auth+d1" });

    if (url.pathname === "/webhooks/razorpay" && request.method === "POST") {
      const raw = await request.text();
      const signature = request.headers.get("x-razorpay-signature") || "";
      if (!signature || !equalSafe(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw), signature)) return json({ error: "Invalid webhook signature" }, 401);
      let event: any;
      try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
      if (event.event !== "payment_link.paid") return json({ received: true, ignored: true });
      const link = event.payload?.payment_link?.entity;
      const payment = event.payload?.payment?.entity;
      if (!link?.id || !link?.reference_id || !payment?.id || link.status !== "paid" || payment.status !== "captured") return json({ error: "Payment is not captured" }, 400);
      const userId = String(link.reference_id);
      const amount = Number(link.amount);
      const plan = planFromAmount(amount);
      if (!plan || Number(payment.amount) !== amount || payment.currency !== "INR") return json({ error: "Amount or currency does not match an available plan" }, 400);
      const expiry = new Date();
      if (plan === "monthly") expiry.setMonth(expiry.getMonth() + 1); else expiry.setFullYear(expiry.getFullYear() + 1);
      const now = new Date().toISOString();
      const paymentInsert = await env.DB.prepare("INSERT OR IGNORE INTO payments (razorpay_payment_id, razorpay_payment_link_id, firebase_uid, amount_paise, plan, status, paid_at, expires_at) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)")
        .bind(String(payment.id), String(link.id), userId, amount, plan, now, expiry.toISOString()).run();
      if (!paymentInsert.success) return json({ error: "Could not save verified payment" }, 500);
      if (paymentInsert.meta.changes === 0) return json({ received: true, duplicate: true });
      const sub = await env.DB.prepare("INSERT INTO subscriptions (firebase_uid, plan, status, starts_at, expires_at, last_payment_id, updated_at) VALUES (?, ?, 'active', ?, ?, ?, ?) ON CONFLICT(firebase_uid) DO UPDATE SET plan=excluded.plan, status='active', starts_at=excluded.starts_at, expires_at=excluded.expires_at, last_payment_id=excluded.last_payment_id, updated_at=excluded.updated_at")
        .bind(userId, plan, now, expiry.toISOString(), String(payment.id), now).run();
      if (!sub.success) return json({ error: "Payment recorded but subscription update failed; retry webhook" }, 500);
      return json({ received: true, activated: true });
    }

    if (url.pathname === "/checkout" && request.method === "POST") {
      const user = await authenticatedFirebaseUser(request, env);
      if (!user) return json({ error: "Please sign in to PaliaAi before purchasing Pro." }, 401);
      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const plan = body?.plan;
      const amount = plan === "monthly" ? 4900 : plan === "yearly" ? 39900 : 0;
      if (!amount) return json({ error: "Choose monthly or yearly plan" }, 400);
      const appOrigin = env.APP_ORIGIN || APP_ORIGIN + "/PaliaAi/";
      const payload = {
        amount, currency: "INR", accept_partial: false,
        description: plan === "monthly" ? "PaliaAi Pro Monthly" : "PaliaAi Pro Yearly",
        reference_id: user.localId,
        callback_url: appOrigin + "?payment=success",
        callback_method: "get",
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { firebase_uid: user.localId, plan, product: "PaliaAi" }
      };
      const credentials = btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
      const response = await fetch("https://api.razorpay.com/v1/payment_links", {
        method: "POST", headers: { authorization: "Basic " + credentials, "content-type": "application/json" }, body: JSON.stringify(payload)
      });
      const result: any = await response.json();
      if (!response.ok || !result.short_url) return json({ error: result.error?.description || "Razorpay checkout could not be created" }, 502);
      return json({ checkout_url: result.short_url, plan, amount_paise: amount });
    }

    if (url.pathname === "/subscription" && request.method === "GET") {
      const user = await authenticatedFirebaseUser(request, env);
      if (!user) return json({ error: "Sign in to check your Pro status" }, 401);
      const row = await env.DB.prepare("SELECT plan, status, expires_at FROM subscriptions WHERE firebase_uid = ? LIMIT 1").bind(user.localId).first<{ plan: string; status: string; expires_at: string }>();
      const active = !!row && row.status === "active" && Date.parse(row.expires_at) > Date.now();
      return json({ tier: active ? "Pro" : "Free", plan: active ? "Palia Pro " + row!.plan : "Free Tier", expires_at: active ? row!.expires_at : null });
    }
    return json({ error: "Not found" }, 404);
  }
};
