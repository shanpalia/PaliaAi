export interface Env {
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "https://shanpalia.github.io", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" } });

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function getUser(request: Request, env: Env) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth } });
  if (!r.ok) return null;
  const user = await r.json() as { id?: string; email?: string };
  return user.id ? user : null;
}
async function supabase(env: Env, path: string, init: RequestInit = {}) {
  return fetch(env.SUPABASE_URL.replace(/\/$/, "") + path, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json", ...(init.headers || {}) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "https://shanpalia.github.io", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" } });
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, service: "paliaai-payments" });

    if (url.pathname === "/webhooks/razorpay" && request.method === "POST") {
      const raw = await request.text();
      const signature = request.headers.get("x-razorpay-signature") || "";
      if (!signature || !timingSafeEqual(await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw), signature)) return json({ error: "Invalid webhook signature" }, 401);
      let event: any;
      try { event = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
      if (event.event !== "payment_link.paid") return json({ received: true, ignored: true });
      const entity = event.payload?.payment_link?.entity;
      const payment = event.payload?.payment?.entity;
      if (!entity?.id || !entity?.reference_id || !payment?.id || payment.status !== "captured" || entity.status !== "paid") return json({ error: "Payment not confirmed/captured" }, 400);
      const userId = String(entity.reference_id);
      const amount = Number(entity.amount);
      const plan = amount === 4900 ? "monthly" : amount === 39900 ? "yearly" : null;
      if (!plan || Number(payment.amount) !== amount || payment.currency !== "INR") return json({ error: "Payment amount/currency does not match an enabled plan" }, 400);

      const existing = await supabase(env, "/rest/v1/paliaai_payments?razorpay_payment_id=eq." + encodeURIComponent(payment.id) + "&select=id");
      if (!existing.ok) return json({ error: "Database lookup failed" }, 500);
      const already = await existing.json() as any[];
      if (already.length) return json({ received: true, duplicate: true });

      const now = new Date();
      const until = new Date(now);
      if (plan === "monthly") until.setMonth(until.getMonth() + 1); else until.setFullYear(until.getFullYear() + 1);
      const insert = await supabase(env, "/rest/v1/paliaai_payments", {
        method: "POST", headers: { prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, razorpay_payment_id: payment.id, razorpay_payment_link_id: entity.id, amount_paise: amount, plan, status: "paid", paid_at: now.toISOString(), expires_at: until.toISOString() })
      });
      if (!insert.ok) return json({ error: "Could not persist verified payment" }, 500);
      const upsert = await supabase(env, "/rest/v1/paliaai_subscriptions?on_conflict=user_id", {
        method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: userId, plan, status: "active", starts_at: now.toISOString(), expires_at: until.toISOString(), last_payment_id: payment.id, updated_at: now.toISOString() })
      });
      if (!upsert.ok) return json({ error: "Payment saved but subscription update failed; retry webhook" }, 500);
      return json({ received: true, activated: true });
    }

    if (url.pathname === "/checkout" && request.method === "POST") {
      const user = await getUser(request, env);
      if (!user) return json({ error: "Sign in with a verified Supabase account first" }, 401);
      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
      const plan = body?.plan;
      const amount = plan === "monthly" ? 4900 : plan === "yearly" ? 39900 : 0;
      if (!amount) return json({ error: "Plan must be monthly or yearly" }, 400);
      const appOrigin = env.APP_ORIGIN || "https://shanpalia.github.io/PaliaAi/";
      const payload = {
        amount, currency: "INR",
        accept_partial: false,
        description: plan === "monthly" ? "PaliaAi Pro Monthly" : "PaliaAi Pro Yearly",
        reference_id: user.id,
        callback_url: appOrigin + "?payment=success",
        callback_method: "get",
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { user_id: user.id, plan, product: "PaliaAi" }
      };
      const auth = btoa(env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET);
      const created = await fetch("https://api.razorpay.com/v1/payment_links", { method: "POST", headers: { authorization: "Basic " + auth, "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result: any = await created.json();
      if (!created.ok || !result.short_url) return json({ error: "Razorpay could not create checkout link" }, 502);
      return json({ checkout_url: result.short_url, plan, amount_paise: amount });
    }

    if (url.pathname === "/subscription" && request.method === "GET") {
      const user = await getUser(request, env);
      if (!user) return json({ error: "Unauthorized" }, 401);
      const r = await supabase(env, "/rest/v1/paliaai_subscriptions?user_id=eq." + encodeURIComponent(user.id) + "&select=plan,status,expires_at&limit=1");
      if (!r.ok) return json({ error: "Could not read subscription" }, 500);
      const rows = await r.json() as any[];
      const sub = rows[0];
      const active = Boolean(sub && sub.status === "active" && Date.parse(sub.expires_at) > Date.now());
      return json({ tier: active ? "Pro" : "Free", plan: active ? sub.plan : null, expires_at: active ? sub.expires_at : null });
    }
    return json({ error: "Not found" }, 404);
  }
} satisfies ExportedHandler<Env>;
