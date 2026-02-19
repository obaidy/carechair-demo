import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

type SalonRow = {
  id: string;
  setup_paid: boolean | null;
  setup_required: boolean | null;
  billing_status: string | null;
  trial_enabled: boolean | null;
  trial_end: string | null;
  manual_override_active: boolean | null;
  is_active: boolean | null;
};

function computeIsActiveFromSalon(salon: SalonRow, nowMs = Date.now()) {
  if (salon.manual_override_active) return true;
  if (salon.billing_status === "suspended") return false;

  const trialEndMs = salon.trial_end ? new Date(salon.trial_end).getTime() : 0;
  if (salon.trial_enabled && Number.isFinite(trialEndMs) && trialEndMs > nowMs) return true;

  if ((salon.setup_required ?? true) && !salon.setup_paid) return false;
  if (salon.billing_status === "active") return true;
  if (salon.billing_status === "past_due") return false;
  return false;
}

function mapStripeSubscriptionStatus(status: string) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (
    status === "past_due" ||
    status === "unpaid" ||
    status === "incomplete" ||
    status === "incomplete_expired"
  ) {
    return "past_due";
  }
  if (status === "canceled") return "canceled";
  return "inactive";
}

function fromStripeUnix(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

async function findSalonByRefs(
  supabase: ReturnType<typeof createClient>,
  refs: { salonId?: string; stripeCustomerId?: string; stripeSubscriptionId?: string }
) {
  if (refs.salonId) {
    const byId = await supabase
      .from("salons")
      .select("id, setup_paid, setup_required, billing_status, trial_enabled, trial_end, manual_override_active, is_active")
      .eq("id", refs.salonId)
      .maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) return byId.data as SalonRow;
  }

  if (refs.stripeSubscriptionId) {
    const bySub = await supabase
      .from("salons")
      .select("id, setup_paid, setup_required, billing_status, trial_enabled, trial_end, manual_override_active, is_active")
      .eq("stripe_subscription_id", refs.stripeSubscriptionId)
      .maybeSingle();
    if (bySub.error) throw bySub.error;
    if (bySub.data) return bySub.data as SalonRow;
  }

  if (refs.stripeCustomerId) {
    const byCustomer = await supabase
      .from("salons")
      .select("id, setup_paid, setup_required, billing_status, trial_enabled, trial_end, manual_override_active, is_active")
      .eq("stripe_customer_id", refs.stripeCustomerId)
      .maybeSingle();
    if (byCustomer.error) throw byCustomer.error;
    if (byCustomer.data) return byCustomer.data as SalonRow;
  }

  return null;
}

async function patchSalon(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
  patch: Record<string, unknown>
) {
  const currentRes = await supabase
    .from("salons")
    .select("id, setup_paid, setup_required, billing_status, trial_enabled, trial_end, manual_override_active, is_active")
    .eq("id", salonId)
    .single();
  if (currentRes.error) throw currentRes.error;

  const merged = { ...(currentRes.data as SalonRow), ...(patch as Partial<SalonRow>) };
  const isActive = computeIsActiveFromSalon(merged as SalonRow);

  const up = await supabase
    .from("salons")
    .update({ ...patch, is_active: isActive })
    .eq("id", salonId);
  if (up.error) throw up.error;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Only POST allowed", { status: 405 });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response("Missing Stripe secrets", { status: 500 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase server secrets", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err instanceof Error ? err.message : "unknown"}`, {
      status: 400,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const salonId = String(session.metadata?.salon_id || "");
        const customerId = typeof session.customer === "string" ? session.customer : "";
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";

        const salon = await findSalonByRefs(supabase, {
          salonId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        if (!salon) break;

        let currentPeriodEnd: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          currentPeriodEnd = fromStripeUnix(sub.current_period_end);
        }

        await patchSalon(supabase, salon.id, {
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          current_period_end: currentPeriodEnd,
          billing_status: "active",
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : "";
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : "";
        const currentPeriodEnd = fromStripeUnix(invoice.lines?.data?.[0]?.period?.end ?? null);

        const salon = await findSalonByRefs(supabase, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        if (!salon) break;

        await patchSalon(supabase, salon.id, {
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          current_period_end: currentPeriodEnd,
          billing_status: "active",
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : "";
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : "";

        const salon = await findSalonByRefs(supabase, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        if (!salon) break;

        await patchSalon(supabase, salon.id, {
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          billing_status: "past_due",
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : "";
        const subscriptionId = sub.id;

        const salon = await findSalonByRefs(supabase, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        if (!salon) break;

        await patchSalon(supabase, salon.id, {
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          current_period_end: fromStripeUnix(sub.current_period_end),
          billing_status: mapStripeSubscriptionStatus(sub.status),
          trial_enabled: sub.status === "trialing",
          trial_end: sub.status === "trialing" ? fromStripeUnix(sub.trial_end ?? null) : salon.trial_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : "";
        const subscriptionId = sub.id;

        const salon = await findSalonByRefs(supabase, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
        if (!salon) break;

        await patchSalon(supabase, salon.id, {
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          billing_status: "canceled",
        });
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Webhook handling failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
