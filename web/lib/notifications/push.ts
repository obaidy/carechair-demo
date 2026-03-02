import 'server-only';

import {createServiceSupabaseClient} from '@/lib/supabase/service';

function isExpoPushToken(value: string) {
  return value.startsWith('ExponentPushToken[') || value.startsWith('ExpoPushToken[');
}

export async function sendSalonPushNotification(params: {
  salonId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const service = createServiceSupabaseClient();
  if (!service) return {ok: false, reason: 'service_client_missing' as const};

  const [ruleRes, tokenRes] = await Promise.all([
    service
      .from('salon_reminders')
      .select('enabled')
      .eq('salon_id', params.salonId)
      .eq('channel', 'push')
      .eq('type', 'booking_confirmed')
      .maybeSingle(),
    service
      .from('device_tokens')
      .select('token')
      .eq('salon_id', params.salonId)
      .is('disabled_at', null)
  ]);

  if (ruleRes.error) throw ruleRes.error;
  if (tokenRes.error) throw tokenRes.error;
  if (!ruleRes.data?.enabled) return {ok: true, skipped: 'disabled' as const};

  const tokens = Array.from(
    new Set(
      (tokenRes.data || [])
        .map((row: any) => String(row?.token || '').trim())
        .filter((value) => value && isExpoPushToken(value))
    )
  );

  if (!tokens.length) return {ok: true, skipped: 'no_tokens' as const};

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title: params.title,
        body: params.body,
        sound: 'default',
        data: params.data || {}
      }))
    )
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `EXPO_PUSH_${response.status}`);
  }

  return {ok: true, delivered: tokens.length};
}
