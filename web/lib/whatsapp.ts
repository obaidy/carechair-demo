import {supabase} from '@/lib/supabase';
import {isValidE164WithoutPlus, normalizeIraqiPhone} from '@/lib/utils';

export type WhatsappTemplateName =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'salon_approved'
  | 'salon_rejected';

const ALLOWED_TEMPLATES = new Set<WhatsappTemplateName>([
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'salon_approved',
  'salon_rejected'
]);

export function formatWhatsappAppointment(value: string, timezone = 'Asia/Baghdad') {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || '-');

  try {
    return new Intl.DateTimeFormat('ar-IQ-u-nu-arab', {
      timeZone: timezone || 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return d.toLocaleString('ar-IQ');
  }
}

export async function sendWhatsappTemplate({
  to,
  template,
  params = [],
  templateLang
}: {
  to: string;
  template: WhatsappTemplateName;
  params?: unknown[];
  templateLang?: string;
}) {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  if (!ALLOWED_TEMPLATES.has(template)) throw new Error('Unsupported WhatsApp template.');

  const normalizedTo = normalizeIraqiPhone(to);
  if (!isValidE164WithoutPlus(normalizedTo)) {
    throw new Error('Invalid WhatsApp destination number.');
  }

  const normalizedParams = Array.isArray(params) ? params.map((item) => String(item ?? '')) : [];

  const {data, error} = await supabase.functions.invoke('send-whatsapp', {
    body: {
      to: normalizedTo,
      template,
      params: normalizedParams,
      template_lang: templateLang
    }
  });

  if (error) {
    throw new Error(error.message || 'Edge Function invocation failed.');
  }
  if (!data?.ok) {
    throw new Error(String(data?.error || 'Unknown WhatsApp error.'));
  }

  return data;
}
