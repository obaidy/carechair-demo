import {redirect} from 'next/navigation';
import {unstable_noStore as noStore} from 'next/cache';
import ActivationQueueClient from '@/components/admin/ActivationQueueClient';
import {createServiceSupabaseClient} from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: Promise<{locale: string}>;
};

type OwnerMembership = {
  salon_id: string;
  user_id: string;
};

type ProfilePhone = {
  user_id: string;
  phone: string | null;
};

export default async function ActivationQueuePage({params}: Props) {
  noStore();
  const {locale} = await params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    redirect(`/${locale}/admin/login?error=supabase_service_missing`);
  }

  const pendingRes = await supabase
    .from('activation_queue_view')
    .select('*')
    .eq('request_status', 'PENDING')
    .order('created_at', {ascending: true});

  const stateRes = await supabase
    .from('salons')
    .select('id,name,slug,status,city,area,whatsapp,updated_at')
    .in('status', ['active', 'suspended'])
    .order('updated_at', {ascending: false});

  if (pendingRes.error || stateRes.error) {
    return (
      <div className="cc-section">
        <section className="panel hero-lite">
          <h1>Activation Queue</h1>
          <p className="muted">Failed to load activation queue data.</p>
        </section>
      </div>
    );
  }

  const salonIds = Array.from(
    new Set<string>([
      ...((pendingRes.data || []).map((row: any) => String(row.salon_id))),
      ...((stateRes.data || []).map((row: any) => String(row.id)))
    ])
  );

  const ownerRes = salonIds.length
    ? await supabase
        .from('salon_members')
        .select('salon_id,user_id')
        .eq('role', 'OWNER')
        .eq('status', 'ACTIVE')
        .in('salon_id', salonIds)
    : {data: [], error: null};

  const ownerUserIds = Array.from(new Set((ownerRes.data || []).map((row: any) => String(row.user_id))));

  const profileRes = ownerUserIds.length
    ? await supabase
        .from('user_profiles')
        .select('user_id,phone')
        .in('user_id', ownerUserIds)
    : {data: [], error: null};

  const ownerBySalon: Record<string, string> = {};
  for (const row of (ownerRes.data || []) as OwnerMembership[]) {
    ownerBySalon[String(row.salon_id)] = String(row.user_id);
  }

  const phoneByUser: Record<string, string | null> = {};
  for (const row of (profileRes.data || []) as ProfilePhone[]) {
    phoneByUser[String(row.user_id)] = row.phone || null;
  }

  const pending = (pendingRes.data || []).map((row: any) => ({
    ...row,
    owner_phone: phoneByUser[ownerBySalon[String(row.salon_id)]] || null,
    submitted_data: (row.submitted_data || {}) as Record<string, unknown>
  }));

  const active = (stateRes.data || [])
    .filter((row: any) => String(row.status || '') === 'active')
    .map((row: any) => ({
      ...row,
      owner_phone: phoneByUser[ownerBySalon[String(row.id)]] || null
    }));

  const suspended = (stateRes.data || [])
    .filter((row: any) => String(row.status || '') === 'suspended')
    .map((row: any) => ({
      ...row,
      owner_phone: phoneByUser[ownerBySalon[String(row.id)]] || null
    }));

  return <ActivationQueueClient locale={locale} pending={pending as any} active={active as any} suspended={suspended as any} />;
}
