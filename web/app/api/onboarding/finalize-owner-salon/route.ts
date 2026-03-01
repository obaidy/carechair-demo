import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createServiceSupabaseClient} from '@/lib/supabase/service';
import {getSupabaseConfig} from '@/lib/supabase/config';
import {SALON_STATUS} from '@/lib/types/status';

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

export async function POST(request: NextRequest) {
  const cfg = getSupabaseConfig();
  const service = createServiceSupabaseClient();
  if (!cfg || !service) {
    return NextResponse.json({ok: false, error: 'SUPABASE_MISSING'}, {status: 500});
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ok: false, error: 'INVALID_JSON'}, {status: 400});
  }

  const accessToken = text(body?.accessToken, 4000);
  const salonId = text(body?.salonId, 80);
  if (!accessToken || !salonId) {
    return NextResponse.json({ok: false, error: 'MISSING_FIELDS'}, {status: 400});
  }

  const authClient = createClient<any>(cfg.url, cfg.anonKey, {
    auth: {persistSession: false, autoRefreshToken: false},
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  const userRes = await authClient.auth.getUser(accessToken);
  const user = userRes.data?.user;
  if (userRes.error || !user?.id) {
    return NextResponse.json({ok: false, error: 'INVALID_SESSION'}, {status: 401});
  }

  const salonRes = await service
    .from('salons')
    .select('id,created_by')
    .eq('id', salonId)
    .maybeSingle();

  if (salonRes.error || !salonRes.data?.id) {
    return NextResponse.json({ok: false, error: 'SALON_NOT_FOUND'}, {status: 404});
  }

  const createdBy = String((salonRes.data as any).created_by || '').trim();
  if (createdBy && createdBy !== String(user.id)) {
    return NextResponse.json({ok: false, error: 'OWNER_MISMATCH'}, {status: 403});
  }

  const submittedData = {
    whatsapp: nullableText(body?.submittedData?.whatsapp, 50),
    city: nullableText(body?.submittedData?.city, 120),
    area: nullableText(body?.submittedData?.area, 120),
    address_mode: String(body?.submittedData?.address_mode || '').trim().toUpperCase() === 'LOCATION' ? 'LOCATION' : 'MANUAL',
    address_text: nullableText(body?.submittedData?.address_text, 500),
    location_lat: num(body?.submittedData?.location_lat, -90, 90),
    location_lng: num(body?.submittedData?.location_lng, -180, 180),
    location_accuracy_m: num(body?.submittedData?.location_accuracy_m, 0),
    location_label: nullableText(body?.submittedData?.location_label, 200),
    instagram: nullableText(body?.submittedData?.instagram, 200),
    photo_url: nullableText(body?.submittedData?.photo_url, 500),
    submitted_at: new Date().toISOString()
  };

  const updateSalonOwner = await service
    .from('salons')
    .update({created_by: user.id})
    .eq('id', salonId);
  if (updateSalonOwner.error) {
    return NextResponse.json({ok: false, error: 'SALON_OWNER_UPDATE_FAILED'}, {status: 500});
  }

  const membershipRes = await service.from('salon_members').upsert(
    {
      salon_id: salonId,
      user_id: user.id,
      role: 'OWNER',
      status: 'ACTIVE'
    },
    {onConflict: 'salon_id,user_id'}
  );
  if (membershipRes.error) {
    return NextResponse.json({ok: false, error: 'MEMBERSHIP_UPSERT_FAILED'}, {status: 500});
  }

  const pendingReq = await service
    .from('activation_requests')
    .select('id')
    .eq('salon_id', salonId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (pendingReq.error && pendingReq.error.code !== 'PGRST116') {
    return NextResponse.json({ok: false, error: 'REQUEST_LOOKUP_FAILED'}, {status: 500});
  }

  if (pendingReq.data?.id) {
    const updateReq = await service
      .from('activation_requests')
      .update({submitted_data: submittedData, requested_by: user.id, admin_notes: null})
      .eq('id', pendingReq.data.id);
    if (updateReq.error) {
      return NextResponse.json({ok: false, error: 'REQUEST_UPDATE_FAILED'}, {status: 500});
    }
  } else {
    const insertReq = await service.from('activation_requests').insert({
      salon_id: salonId,
      requested_by: user.id,
      status: 'PENDING',
      submitted_data: submittedData
    });
    if (insertReq.error) {
      return NextResponse.json({ok: false, error: 'REQUEST_CREATE_FAILED'}, {status: 500});
    }
  }

  const salonPatch: Record<string, unknown> = {
    status: SALON_STATUS.PENDING_REVIEW,
    address_mode: submittedData.address_mode,
    address_text: submittedData.address_text,
    location_lat: submittedData.location_lat,
    location_lng: submittedData.location_lng,
    location_accuracy_m: submittedData.location_accuracy_m,
    location_label: submittedData.location_label,
    is_active: true
  };
  if (submittedData.whatsapp) salonPatch.whatsapp = submittedData.whatsapp;
  if (submittedData.city) salonPatch.city = submittedData.city;
  if (submittedData.area) salonPatch.area = submittedData.area;

  const updateSalon = await service.from('salons').update(salonPatch).eq('id', salonId);
  if (updateSalon.error) {
    return NextResponse.json({ok: false, error: 'SALON_UPDATE_FAILED'}, {status: 500});
  }

  return NextResponse.json({ok: true, salonStatus: SALON_STATUS.PENDING_REVIEW});
}
