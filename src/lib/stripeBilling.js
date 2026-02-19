import { supabase } from "./supabase";

export async function createSubscriptionCheckout({ salonId, salonSlug, successUrl, cancelUrl }) {
  if (!supabase) throw new Error("Supabase client is not initialized.");

  const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
    body: {
      salon_id: salonId,
      salon_slug: salonSlug,
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

