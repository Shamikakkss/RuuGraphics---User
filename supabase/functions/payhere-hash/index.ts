// Supabase Edge Function: payhere-hash
//
// PURPOSE:
//   Generates the PayHere payment hash SERVER-SIDE so the merchant_secret
//   never has to live in the browser / client-side JavaScript.
//
// DEPLOY:
//   supabase functions deploy payhere-hash --no-verify-jwt
//
// SET THE SECRET (never hardcode it in this file either):
//   supabase secrets set PAYHERE_MERCHANT_SECRET=ODAwMTA3ODk1NDA0OTAyOTYwOTEyNTUzMDQ5NDQ5OTYyNTM3NzM=
//   supabase secrets set PAYHERE_MERCHANT_ID=1236503
//
// CLIENT CALLS IT LIKE:
//   POST https://<project-ref>.supabase.co/functions/v1/payhere-hash
//   body: { "order_id": "ORD-ABC123", "amount": "3000.00", "currency": "LKR" }
//   response: { "hash": "...", "merchant_id": "1236503" }

import { createHash } from "node:crypto";

const MERCHANT_ID = Deno.env.get("PAYHERE_MERCHANT_ID") ?? "";
const MERCHANT_SECRET = Deno.env.get("PAYHERE_MERCHANT_SECRET") ?? "";

// Allow only your real site(s) to call this function.
// Add your GitHub Pages URL and any custom domain here.
const ALLOWED_ORIGINS = [
  "https://YOUR-GITHUB-USERNAME.github.io",
  "http://localhost:5500", // for local testing, remove in production if you want
];

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex").toUpperCase();
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!MERCHANT_ID || !MERCHANT_SECRET) {
    return new Response(JSON.stringify({ error: "Server not configured." }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const orderId = String(body.order_id ?? "").trim();
    const amount = String(body.amount ?? "").trim();
    const currency = String(body.currency ?? "LKR").trim();

    // Basic validation — reject anything malformed before hashing.
    if (!orderId || !/^[A-Za-z0-9\-]{3,40}$/.test(orderId)) {
      return new Response(JSON.stringify({ error: "Invalid order_id." }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!amount || !/^\d+\.\d{2}$/.test(amount)) {
      return new Response(JSON.stringify({ error: "Invalid amount format, expected e.g. 3000.00" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const hashedSecret = md5(MERCHANT_SECRET);
    const hash = md5(MERCHANT_ID + orderId + amount + currency + hashedSecret);

    return new Response(
      JSON.stringify({ hash, merchant_id: MERCHANT_ID }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Bad request." }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});