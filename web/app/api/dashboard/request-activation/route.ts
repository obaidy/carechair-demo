import {NextResponse} from 'next/server';
import {readAuthSession} from '@/lib/auth/server';
import {createServiceSupabaseClient} from '@/lib/supabase/service';

function isUuid(value: string | null | undefined) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
}

function text(input: unknown, max = 500) {
  return String(input ?? '').trim().slice(0, max);
}

function nullableText(input: unknown, max = 500) {
  const value = text(input, max);
  return value || null;
}

function num(input: unknown, min?: number, max?: number) {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  if (typeof min === 'number' && n < min) return null;
  if (typeof max === 'number' && n > max) return null;
  return n;
}

async function logActivationEvent(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  salonId: string,
  actorUserId: string,
  action: string,
  meta: Record<string, unknown>
) {
  if (!supabase) return;
  try {
    await supabase.rpc('log_activation_event', {
      p_salon_id: salonId,
      p_actor: actorUserId,
      p_action: action,
      p_meta: meta
    });
  } catch {
    try {
      await supabase.from('audit_log').insert({
        salon_id: salonId,
        actor_user_id: actorUserId,
        action,
        meta
      });
    } catch {
      // best effort
    }
  }
}

export async function POST(request: Request) {
  const session = await readAuthSession();
  if (!session || session.role !== 'salon_admin' || !session.salonId) {
    return NextResponse.json({ok: false, error: 'UNAUTHORIZED'}, {status: 401});
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ok: false, error: 'SUPABASE_SERVICE_MISSING'}, {status: 500});
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'INVALID_JSON'}, {status: 400});
  }

  const salonId = String(session.salonId);
  const salonRes = await supabase
    .from('salons')
    .select('id,status,created_by')
    .eq('id', salonId)
    .maybeSingle();

  if (salonRes.error || !salonRes.data?.id) {
    return NextResponse.json({ok: false, error: 'SALON_NOT_FOUND'}, {status: 404});
  }

  const currentStatus = String(salonRes.data.status || '').trim().toLowerCase();
  if (['active', 'trialing', 'past_due'].includes(currentStatus)) {
    return NextResponse.json({ok: false, error: 'ALREADY_ACTIVE'}, {status: 409});
  }
  if (currentStatus === 'suspended') {
    return NextResponse.json({ok: false, error: 'SALON_SUSPENDED'}, {status: 409});
  }
  if (!['draft', 'rejected', 'pending_approval', 'pending_review'].includes(currentStatus)) {
    return NextResponse.json({ok: false, error: 'INVALID_STATUS'}, {status: 409});
  }

  let requestedBy = isUuid(session.userId) ? String(session.userId) : '';

  if (!requestedBy) {
    const ownerRes = await supabase
      .from('salon_members')
      .select('user_id')
      .eq('salon_id', salonId)
      .eq('role', 'OWNER')
      .eq('status', 'ACTIVE')
      .order('joined_at', {ascending: true})
      .limit(1)
      .maybeSingle();
    if (!ownerRes.error && ownerRes.data?.user_id) {
      requestedBy = String(ownerRes.data.user_id);
    }
  }

  if (!requestedBy && isUuid(String(salonRes.data.created_by || ''))) {
    requestedBy = String(salonRes.data.created_by);
  }

  if (!requestedBy) {
    return NextResponse.json({ok: false, error: 'AUTH_SESSION_MISSING'}, {status: 401});
  }

  const submittedData = {
    whatsapp: nullableText(body.whatsapp, 50),
    city: nullableText(body.city, 120),
    area: nullableText(body.area, 120),
    address_mode: String(body.address_mode || '').trim().toUpperCase() === 'LOCATION' ? 'LOCATION' : 'MANUAL',
    address_text: nullableText(body.address_text, 500),
    location_lat: num(body.location_lat, -90, 90),
    location_lng: num(body.location_lng, -180, 180),
    location_accuracy_m: num(body.location_accuracy_m, 0),
    location_label: nullableText(body.location_label, 200),
    instagram: nullableText(body.instagram, 200),
    photo_url: nullableText(body.photo_url, 500),
    submitted_at: new Date().toISOString()
  };

  const rateKey = `request-activation:web:salon:${salonId}:${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const rate = await supabase.rpc('consume_rate_limit', {
    p_key: rateKey,
    p_limit: 3,
    p_window_seconds: 24 * 60 * 60
  });

  if (!rate.error && !rate.data?.ok) {
    await logActivationEvent(supabase, salonId, requestedBy, 'activation.request.denied', {reason: 'RATE_LIMITED'});
    return NextResponse.json({ok: false, error: 'RATE_LIMITED'}, {status: 429});
  }

  const pendingReq = await supabase
    .from('activation_requests')
    .select('id')
    .eq('salon_id', salonId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (pendingReq.error && pendingReq.error.code !== 'PGRST116') {
    return NextResponse.json({ok: false, error: 'REQUEST_LOOKUP_FAILED'}, {status: 500});
  }

  if (pendingReq.data?.id) {
    const updateReq = await supabase
      .from('activation_requests')
      .update({submitted_data: submittedData, requested_by: requestedBy, admin_notes: null})
      .eq('id', pendingReq.data.id);
    if (updateReq.error) {
      return NextResponse.json({ok: false, error: 'REQUEST_UPDATE_FAILED'}, {status: 500});
    }
  } else {
    const insertReq = await supabase.from('activation_requests').insert({
      salon_id: salonId,
      requested_by: requestedBy,
      status: 'PENDING',
      submitted_data: submittedData
    });
    if (insertReq.error) {
      return NextResponse.json({ok: false, error: 'REQUEST_CREATE_FAILED'}, {status: 500});
    }
  }

  const salonPatch: Record<string, unknown> = {
    status: 'pending_approval',
    address_mode: submittedData.address_mode,
    address_text: submittedData.address_text,
    location_lat: submittedData.location_lat,
    location_lng: submittedData.location_lng,
    location_accuracy_m: submittedData.location_accuracy_m,
    location_label: submittedData.location_label
  };
  if (submittedData.whatsapp) salonPatch.whatsapp = submittedData.whatsapp;
  if (submittedData.city) salonPatch.city = submittedData.city;
  if (submittedData.area) salonPatch.area = submittedData.area;

  const updateSalon = await supabase.from('salons').update(salonPatch).eq('id', salonId);
  if (updateSalon.error) {
    return NextResponse.json({ok: false, error: 'SALON_UPDATE_FAILED'}, {status: 500});
  }

  await logActivationEvent(supabase, salonId, requestedBy, 'activation.requested', {
    source: 'web_dashboard',
    address_mode: submittedData.address_mode
  });

  return NextResponse.json({ok: true, salon_status: 'PENDING_REVIEW'});
}
