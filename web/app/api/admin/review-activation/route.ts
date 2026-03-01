import {NextResponse} from 'next/server';
import {readAuthSession} from '@/lib/auth/server';
import {isSuperAdminUser} from '@/lib/auth/admin';
import {createServiceSupabaseClient} from '@/lib/supabase/service';
import {SALON_STATUS} from '@/lib/types/status';

function text(input: unknown, max = 2000) {
  return String(input ?? '').trim().slice(0, max);
}

function normalizeDecision(input: unknown): 'APPROVE' | 'REJECT' | '' {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'APPROVE') return 'APPROVE';
  if (value === 'REJECT') return 'REJECT';
  return '';
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
  if (!session || session.role !== 'superadmin' || !session.userId) {
    return NextResponse.json({ok: false, error: 'UNAUTHORIZED'}, {status: 401});
  }

  const allowed = await isSuperAdminUser(session.userId);
  if (!allowed) {
    return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});
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

  const requestId = text(body.activation_request_id, 80);
  const decision = normalizeDecision(body.decision);
  const adminNotes = text(body.admin_notes, 2000) || null;

  if (!requestId) {
    return NextResponse.json({ok: false, error: 'ACTIVATION_REQUEST_ID_REQUIRED'}, {status: 400});
  }
  if (!decision) {
    return NextResponse.json({ok: false, error: 'DECISION_REQUIRED'}, {status: 400});
  }

  const reqRes = await supabase
    .from('activation_requests')
    .select('id,salon_id,status')
    .eq('id', requestId)
    .maybeSingle();

  if (reqRes.error || !reqRes.data?.id) {
    return NextResponse.json({ok: false, error: 'REQUEST_NOT_FOUND'}, {status: 404});
  }

  const currentRequestStatus = String(reqRes.data.status || '').toUpperCase();
  if (currentRequestStatus !== 'PENDING') {
    return NextResponse.json({ok: false, error: 'REQUEST_NOT_PENDING'}, {status: 409});
  }

  const salonId = String(reqRes.data.salon_id);

  const reviewPatch = {
    status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    reviewed_by: session.userId,
    reviewed_at: new Date().toISOString(),
    admin_notes: adminNotes
  };

  const reviewReq = await supabase
    .from('activation_requests')
    .update(reviewPatch)
    .eq('id', requestId)
    .select('id')
    .single();

  if (reviewReq.error) {
    return NextResponse.json({ok: false, error: 'REQUEST_REVIEW_UPDATE_FAILED'}, {status: 500});
  }

  const salonPatch: Record<string, unknown> = {
    status: decision === 'APPROVE' ? SALON_STATUS.ACTIVE : SALON_STATUS.DRAFT,
    is_active: decision === 'APPROVE',
    is_public: decision === 'APPROVE'
  };

  const updateSalon = await supabase
    .from('salons')
    .update(salonPatch)
    .eq('id', salonId)
    .select('id,status')
    .single();

  if (updateSalon.error) {
    return NextResponse.json({ok: false, error: 'SALON_UPDATE_FAILED'}, {status: 500});
  }

  await logActivationEvent(
    supabase,
    salonId,
    session.userId,
    decision === 'APPROVE' ? 'activation.approved' : 'activation.rejected',
    {
      activation_request_id: requestId,
      notes: adminNotes
    }
  );

  return NextResponse.json({
    ok: true,
    salon_id: salonId,
    salon_status: decision === 'APPROVE' ? SALON_STATUS.ACTIVE : SALON_STATUS.DRAFT
  });
}
