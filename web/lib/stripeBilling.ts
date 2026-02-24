import {supabase} from '@/lib/supabase';

export async function createCountryCheckout({
  salonId,
  planType = 'basic',
  successUrl,
  cancelUrl
}: {
  salonId: string;
  planType?: 'basic' | 'pro' | string;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!supabase) throw new Error('Supabase client is not initialized.');

  const {data, error} = await supabase.functions.invoke('create-checkout-session', {
    body: {
      salon_id: salonId,
      plan_type: planType === 'pro' ? 'pro' : 'basic',
      success_url: successUrl,
      cancel_url: cancelUrl
    }
  });

  if (error) throw new Error(error.message || 'Failed to start subscription checkout.');
  if (!data?.ok || !data?.url) throw new Error(String(data?.error || 'Failed to create checkout URL.'));
  return data.url as string;
}
