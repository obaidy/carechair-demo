import {NextRequest, NextResponse} from 'next/server';
import {createServiceSupabaseClient} from '@/lib/supabase/service';
import {sendSalonPushNotification} from '@/lib/notifications/push';

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'invalid_payload'}, {status: 400});
  }

  const salonId = String(body?.salonId || '').trim();
  const bookingId = String(body?.bookingId || '').trim();
  const title = String(body?.title || 'Booking update').trim();
  const message = String(body?.body || '').trim();
  if (!salonId || !bookingId || !message) {
    return NextResponse.json({ok: false, error: 'missing_fields'}, {status: 400});
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ok: false, error: 'service_client_missing'}, {status: 500});
  }

  const bookingRes = await service
    .from('bookings')
    .select('id,salon_id')
    .eq('id', bookingId)
    .eq('salon_id', salonId)
    .maybeSingle();

  if (bookingRes.error) {
    return NextResponse.json({ok: false, error: bookingRes.error.message}, {status: 500});
  }
  if (!bookingRes.data?.id) {
    return NextResponse.json({ok: false, error: 'booking_not_found'}, {status: 404});
  }

  try {
    const result = await sendSalonPushNotification({
      salonId,
      title,
      body: message,
      data: {
        bookingId,
        salonId,
        source: 'web'
      }
    });
    return NextResponse.json({ok: true, result});
  } catch (error: any) {
    return NextResponse.json({ok: false, error: String(error?.message || error || 'push_failed')}, {status: 500});
  }
}
