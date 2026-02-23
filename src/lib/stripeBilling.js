import { supabase } from "./supabase";

export async function createSubscriptionCheckout({ salonId, salonSlug, successUrl, cancelUrl }) {
  if (!supabase) throw new Error("Supabase client is not initialized.");

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      salon_id: salonId,
      salon_slug: salonSlug,
      plan_type: "basic",
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
  });

  if (error) {
    throw new Error(error.message || "تعذر تشغيل بوابة الاشتراك.");
  }

  if (!data?.ok || !data?.url) {
    throw new Error(String(data?.error || "تعذر إنشاء رابط الدفع."));
  }

  return data.url;
}

export async function createCountryCheckout({ salonId, planType = "basic", successUrl, cancelUrl }) {
  if (!supabase) throw new Error("Supabase client is not initialized.");

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      salon_id: salonId,
      plan_type: planType === "pro" ? "pro" : "basic",
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
  });

  if (error) throw new Error(error.message || "تعذر تشغيل بوابة الاشتراك.");
  if (!data?.ok || !data?.url) throw new Error(String(data?.error || "تعذر إنشاء رابط الدفع."));
  return data.url;
}
