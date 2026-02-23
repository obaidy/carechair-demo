import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

type CheckoutBody = {
  salon_id?: string;
  plan_type?: "basic" | "pro";
  success_url?: string;
  cancel_url?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Only POST is allowed." });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const STRIPE_PRICE_ID_BASIC = Deno.env.get("STRIPE_PRICE_ID_BASIC") || "";
  const STRIPE_PRICE_ID_PRO = Deno.env.get("STRIPE_PRICE_ID_PRO") || "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { ok: false, error: "Missing Supabase server secrets." });
  }
  if (!STRIPE_SECRET_KEY) {
    return json(500, { ok: false, error: "Missing STRIPE_SECRET_KEY." });
  }

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body." });
  }

  const salonId = String(body.salon_id || "").trim();
  const planType = String(body.plan_type || "basic").trim().toLowerCase() === "pro" ? "pro" : "basic";
  const successUrl = String(body.success_url || "").trim();
  const cancelUrl = String(body.cancel_url || "").trim();

  if (!salonId) return json(400, { ok: false, error: "Missing salon_id." });
  if (!successUrl || !cancelUrl) return json(400, { ok: false, error: "Missing success_url or cancel_url." });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  try {
    const salonRes = await supabase
      .from("salons")
      .select("id, slug, name, country_code, stripe_customer_id")
      .eq("id", salonId)
      .maybeSingle();

    if (salonRes.error) throw salonRes.error;
    if (!salonRes.data) return json(404, { ok: false, error: "Salon not found." });

    const countryCode = String(salonRes.data.country_code || "IQ");
    const countryRes = await supabase
      .from("countries")
      .select("code, stripe_price_id_basic, stripe_price_id_pro, is_enabled")
      .eq("code", countryCode)
      .maybeSingle();
    if (countryRes.error) throw countryRes.error;

    if (!countryRes.data || countryRes.data.is_enabled === false) {
      return json(400, { ok: false, error: "Country configuration is disabled." });
    }

    const priceId =
      planType === "pro"
        ? String(countryRes.data.stripe_price_id_pro || STRIPE_PRICE_ID_PRO || "")
        : String(countryRes.data.stripe_price_id_basic || STRIPE_PRICE_ID_BASIC || "");

    if (!priceId) {
      return json(400, { ok: false, error: `Missing Stripe price id for plan '${planType}' and country '${countryCode}'.` });
    }

    let stripeCustomerId = String(salonRes.data.stripe_customer_id || "").trim();

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: salonRes.data.name || "Salon",
        metadata: {
          salon_id: salonRes.data.id,
          salon_slug: salonRes.data.slug || "",
          country_code: countryCode
        }
      });
      stripeCustomerId = customer.id;
      const saveCustomer = await supabase
        .from("salons")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", salonRes.data.id);
      if (saveCustomer.error) throw saveCustomer.error;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        salon_id: salonRes.data.id,
        salon_slug: salonRes.data.slug || "",
        country_code: countryCode,
        plan_type: planType
      },
      subscription_data: {
        metadata: {
          salon_id: salonRes.data.id,
          salon_slug: salonRes.data.slug || "",
          country_code: countryCode,
          plan_type: planType
        }
      }
    });

    return json(200, { ok: true, url: session.url, plan_type: planType, country_code: countryCode });
  } catch (err) {
    return json(500, { ok: false, error: err instanceof Error ? err.message : "Unexpected server error." });
  }
});
