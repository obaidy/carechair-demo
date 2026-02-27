import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import ClientDiagnosticsCard from '@/components/diagnostics/ClientDiagnosticsCard';
import {readAuthSession} from '@/lib/auth/server';
import {readSupabaseDiag} from '@/lib/dev/supabase-diagnostics';
import {createServiceSupabaseClient} from '@/lib/supabase/service';
import {normalizeSalonLifecycleStatus, SALON_STATUS} from '@/lib/types/status';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function hostFromUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function parseQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}

export default async function OwnerDiagnosticsPage({params, searchParams}: Props) {
  const {locale} = await params;
  const query = await searchParams;
  const session = await readAuthSession();

  if (!session || session.role !== 'salon_admin') {
    redirect(`/${locale}/login?next=/${locale}/app/diagnostics`);
  }

  const basePath = `/${locale}/app/diagnostics`;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return (
      <div className="cc-section">
        <section className="panel hero-lite">
          <h1>Diagnostics</h1>
          <p className="muted">Supabase service key is missing on web server.</p>
        </section>
      </div>
    );
  }

  async function createTestSalonAction() {
    'use server';

    if (process.env.NODE_ENV === 'production') {
      redirect(`${basePath}?diag_error=disabled_in_production`);
    }

    const current = await readAuthSession();
    if (!current || current.role !== 'salon_admin' || !current.userId) {
      redirect(`${basePath}?diag_error=unauthorized`);
    }

    const adminClient = createServiceSupabaseClient();
    if (!adminClient) {
      redirect(`${basePath}?diag_error=service_client_missing`);
    }

    const stamp = Date.now();
    const slug = `diag-${stamp.toString(36)}-${String(current.userId).slice(0, 6)}`.slice(0, 60);
    const name = `Diagnostics Salon ${new Date(stamp).toISOString().slice(11, 19)}`;

    const createSalon = await adminClient
      .from('salons')
      .insert({
        name,
        slug,
        area: 'Diagnostics',
        city: 'Baghdad',
        whatsapp: null,
        timezone: 'Asia/Baghdad',
        admin_passcode: '123456',
        status: SALON_STATUS.DRAFT,
        is_public: false,
        is_active: true,
        created_by: current.userId,
      } as any)
      .select('id')
      .single();

    if (createSalon.error || !createSalon.data?.id) {
      redirect(`${basePath}?diag_error=${encodeURIComponent(String(createSalon.error?.message || 'salon_insert_failed'))}`);
    }

    const ensureMembership = await adminClient
      .from('salon_members')
      .upsert(
        {
          salon_id: createSalon.data.id,
          user_id: current.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        {onConflict: 'salon_id,user_id'},
      )
      .select('salon_id')
      .single();

    if (ensureMembership.error) {
      redirect(`${basePath}?diag_error=${encodeURIComponent(String(ensureMembership.error.message || 'membership_upsert_failed'))}`);
    }

    revalidatePath(basePath);
    redirect(`${basePath}?diag_created=${createSalon.data.id}`);
  }

  const uid = String(session.userId || '');
  const membershipsRes = uid
    ? await supabase
        .from('salon_members')
        .select('salon_id,user_id,role,status,joined_at')
        .eq('user_id', uid)
        .eq('status', 'ACTIVE')
        .order('joined_at', {ascending: false})
        .limit(20)
    : {data: [], error: null};

  const membershipRows = membershipsRes.data || [];
  const membershipSalonIds = Array.from(new Set(membershipRows.map((row: any) => String(row.salon_id))));

  const salonsRes = membershipSalonIds.length
    ? await supabase
        .from('salons')
        .select('id,name,slug,status,city,area,is_public,is_active,updated_at,created_at')
        .in('id', membershipSalonIds)
        .order('updated_at', {ascending: false})
        .limit(10)
    : {data: [], error: null};

  const activationRes = membershipSalonIds.length
    ? await supabase
        .from('activation_requests')
        .select('id,salon_id,status,requested_by,created_at,reviewed_at,submitted_data')
        .in('salon_id', membershipSalonIds)
        .order('created_at', {ascending: false})
        .limit(10)
    : {data: [], error: null};

  const serverUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serverHost = hostFromUrl(serverUrl);
  const diagCreated = parseQueryValue(query.diag_created);
  const diagError = parseQueryValue(query.diag_error);

  const summary = {
    nodeEnv: process.env.NODE_ENV || 'development',
    sessionRole: session.role,
    sessionUid: session.userId,
    sessionSalonId: session.salonId,
    sessionSalonSlug: session.salonSlug,
    serverSupabaseUrl: serverUrl || '(missing)',
    serverSupabaseHost: serverHost || '(missing)',
    membershipsCount: membershipRows.length,
    membershipsError: membershipsRes.error ? String(membershipsRes.error.message || membershipsRes.error.code || 'error') : null,
    salonsCount: (salonsRes.data || []).length,
    salonsError: salonsRes.error ? String(salonsRes.error.message || salonsRes.error.code || 'error') : null,
    activationCount: (activationRes.data || []).length,
    activationError: activationRes.error ? String(activationRes.error.message || activationRes.error.code || 'error') : null,
    lastSupabaseErrors: readSupabaseDiag(20),
  };

  const salons = (salonsRes.data || []).map((row: any) => ({
    ...row,
    lifecycle_status: normalizeSalonLifecycleStatus(row.status),
  }));

  return (
    <div className="cc-section">
      <section className="panel hero-lite">
        <h1>Owner Diagnostics</h1>
        <p className="muted">Deterministic runtime visibility for membership, salon status, and activation queue.</p>
      </section>

      <section className="panel" style={{marginTop: 12}}>
        <h3>Actions</h3>
        {process.env.NODE_ENV === 'production' ? (
          <p className="muted">Create test salon is disabled in production.</p>
        ) : (
          <form action={createTestSalonAction}>
            <button type="submit" className="btn btn-primary">Create test salon</button>
          </form>
        )}
        {diagCreated ? <p className="muted" style={{marginTop: 8}}>Created salon: <code>{diagCreated}</code></p> : null}
        {diagError ? <p className="muted" style={{marginTop: 8, color: 'var(--danger)'}}>Last action error: <code>{diagError}</code></p> : null}
      </section>

      <section className="panel" style={{marginTop: 12}}>
        <h3>Server Diagnostics</h3>
        <pre style={{whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.4}}>{JSON.stringify(summary, null, 2)}</pre>
      </section>

      <section className="panel" style={{marginTop: 12}}>
        <h3>Memberships for Session UID</h3>
        <pre style={{whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.4}}>{JSON.stringify(membershipRows, null, 2)}</pre>
      </section>

      <section className="panel" style={{marginTop: 12}}>
        <h3>Visible Salons (last 10)</h3>
        <pre style={{whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.4}}>{JSON.stringify(salons, null, 2)}</pre>
      </section>

      <section className="panel" style={{marginTop: 12}}>
        <h3>Visible Activation Requests (last 10)</h3>
        <pre style={{whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.4}}>{JSON.stringify(activationRes.data || [], null, 2)}</pre>
      </section>

      <ClientDiagnosticsCard serverUrl={serverUrl} />
    </div>
  );
}
