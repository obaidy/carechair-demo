import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

type CreateCheckoutBody = {
  salon_id?: string;
  salon_slug?: string;
  success_url?: string;
  cancel_url?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Only POST is allowed." });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const STRIPE_MONTHLY_PRICE_ID = Deno.env.get("STRIPE_MONTHLY_PRICE_ID") || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase server secrets." });
  }
  if (!STRIPE_SECRET_KEY || !STRIPE_MONTHLY_PRICE_ID) {
    return jsonResponse(500, { ok: false, error: "Missing Stripe secrets." });
  }

  let body: CreateCheckoutBody;
  try {
    body = (await req.json()) as CreateCheckoutBody;
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body." });
  }

  const salonId = String(body.salon_id || "").trim();
  const salonSlug = String(body.salon_slug || "").trim();
  const successUrl = String(body.success_url || "").trim();
  const cancelUrl = String(body.cancel_url || "").trim();

  if (!salonId) {
    return jsonResponse(400, { ok: false, error: "Missing salon_id." });
  }
  if (!successUrl || !cancelUrl) {
    return jsonResponse(400, { ok: false, error: "Missing success_url or cancel_url." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  try {
    const salonRes = await supabase
      .from("salons")
      .select("id, slug, name, stripe_customer_id")
      .eq("id", salonId)
      .maybeSingle();

    if (salonRes.error) throw salonRes.error;
    if (!salonRes.data) {
      return jsonResponse(404, { ok: false, error: "Salon not found." });
    }

    const salon = salonRes.data;
    let stripeCustomerId = String(salon.stripe_customer_id || "").trim();

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: salon.name || "Salon",
        metadata: {
          salon_id: salon.id,
          salon_slug: salon.slug || salonSlug,
        },
      });
      stripeCustomerId = customer.id;

      const upRes = await supabase
        .from("salons")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", salon.id);
      if (upRes.error) throw upRes.error;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: STRIPE_MONTHLY_PRICE_ID, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        salon_id: salon.id,
        salon_slug: salon.slug || salonSlug,
      },
      subscription_data: {
        metadata: {
          salon_id: salon.id,
          salon_slug: salon.slug || salonSlug,
        },
      },
    });

    return jsonResponse(200, { ok: true, url: session.url });
  } catch (err) {
    return jsonResponse(500, {
      ok: false,
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
});
