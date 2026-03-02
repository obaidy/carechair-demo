import {NextRequest, NextResponse} from 'next/server';
import {createServiceSupabaseClient} from '@/lib/supabase/service';

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ok: false, error: 'supabase_env_missing'}, {status: 500});
    }

    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/notify-booking-event`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        salonId,
        bookingId,
        event: String(body?.event || 'booking_status_changed'),
        title,
        body: message
      })
    });

    const result = await edgeRes.json().catch(() => null);
    if (!edgeRes.ok) {
      return NextResponse.json({ok: false, error: result?.error || 'edge_push_failed'}, {status: edgeRes.status});
    }

    return NextResponse.json({ok: true, result});
  } catch (error: any) {
    return NextResponse.json({ok: false, error: String(error?.message || error || 'push_failed')}, {status: 500});
  }
}
