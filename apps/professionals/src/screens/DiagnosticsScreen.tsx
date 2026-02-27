import {useCallback, useMemo, useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Card} from '../components';
import {useTheme} from '../theme/provider';
import {supabase} from '../api/supabase/client';
import {useAuthStore} from '../state/authStore';
import {readActiveSalonId} from '../auth/session';
import {env, supabaseHost} from '../utils/env';
import {getDevLogs, useDevLogs} from '../lib/devLogger';
import {SALON_STATUS} from '../types/status';
import {requestSalonActivationV2} from '../api/invites';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function stringify(value: Json) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function DiagnosticsScreen() {
  const {colors, spacing, typography} = useTheme();
  const storeSession = useAuthStore((state) => state.session);
  const logs = useDevLogs(20);
  const [activeSalonId, setActiveSalonId] = useState<string | null>(null);
  const [uid, setUid] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [memberships, setMemberships] = useState<any[]>([]);
  const [lastResult, setLastResult] = useState<Json>(null);
  const [loading, setLoading] = useState(false);

  const sessionSummary = useMemo(
    () => ({
      exists: Boolean(storeSession?.accessToken),
      userId: storeSession?.userId || '',
      phone: storeSession?.phone || '',
    }),
    [storeSession?.accessToken, storeSession?.phone, storeSession?.userId],
  );

  const setResult = useCallback((label: string, payload: unknown) => {
    setLastResult({label, payload, at: new Date().toISOString()});
  }, []);

  const refreshSessionAndMemberships = useCallback(async () => {
    if (!supabase) {
      setResult('refresh', {error: 'SUPABASE_CONFIG_MISSING'});
      return;
    }
    setLoading(true);
    try {
      const active = await readActiveSalonId();
      setActiveSalonId(active);

      const sessionRes = await supabase.auth.getSession();
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      setUid(String(user?.id || ''));
      setPhone(String(user?.phone || user?.user_metadata?.phone || ''));

      if (!user?.id) {
        setMemberships([]);
        setResult('refresh', {sessionRes, userRes, memberships: []});
        return;
      }

      const membersRes = await supabase
        .from('salon_members')
        .select('salon_id,user_id,role,status,joined_at')
        .eq('user_id', user.id)
        .order('joined_at', {ascending: false});
      setMemberships(membersRes.data || []);
      setResult('refresh', {sessionRes, userRes, membersRes});
    } catch (error: any) {
      setResult('refresh', {error: String(error?.message || error)});
    } finally {
      setLoading(false);
    }
  }, [setResult]);

  const createTestDraftSalon = useCallback(async () => {
    if (!supabase) {
      setResult('createTestDraftSalon', {error: 'SUPABASE_CONFIG_MISSING'});
      return;
    }
    setLoading(true);
    try {
      const userRes = await supabase.auth.getUser();
      const user = userRes.data.user;
      if (!user?.id) {
        setResult('createTestDraftSalon', {error: 'AUTH_UID_MISSING', userRes});
        return;
      }

      const stamp = Date.now();
      const slug = `diag-${stamp.toString(36)}`.slice(0, 50);
      const salonInsert = await supabase
        .from('salons')
        .insert({
          name: `Diagnostics Salon ${new Date(stamp).toISOString().slice(11, 19)}`,
          slug,
          status: SALON_STATUS.DRAFT,
          created_by: user.id,
          whatsapp: user.phone || null,
          timezone: 'Asia/Baghdad',
          is_public: false,
          is_active: true,
        } as any)
        .select('id,name,slug,status,created_by,created_at')
        .single();

      let memberInsert: any = null;
      if (salonInsert.data?.id) {
        memberInsert = await supabase
          .from('salon_members')
          .upsert(
            {
              salon_id: salonInsert.data.id,
              user_id: user.id,
              role: 'OWNER',
              status: 'ACTIVE',
            },
            {onConflict: 'salon_id,user_id'},
          )
          .select('salon_id,user_id,role,status')
          .single();
      }

      setResult('createTestDraftSalon', {userRes, salonInsert, memberInsert});
      await refreshSessionAndMemberships();
    } catch (error: any) {
      setResult('createTestDraftSalon', {error: String(error?.message || error)});
    } finally {
      setLoading(false);
    }
  }, [refreshSessionAndMemberships, setResult]);

  const requestActivationForLatestSalon = useCallback(async () => {
    if (!supabase) {
      setResult('requestActivationForLatestSalon', {error: 'SUPABASE_CONFIG_MISSING'});
      return;
    }
    setLoading(true);
    try {
      const userRes = await supabase.auth.getUser();
      const uidValue = String(userRes.data.user?.id || '');
      if (!uidValue) {
        setResult('requestActivationForLatestSalon', {error: 'AUTH_UID_MISSING', userRes});
        return;
      }

      const latestSalon = await supabase
        .from('salons')
        .select('id,name,status,created_at')
        .eq('created_by', uidValue)
        .order('created_at', {ascending: false})
        .limit(1)
        .maybeSingle();

      if (!latestSalon.data?.id) {
        setResult('requestActivationForLatestSalon', {error: 'NO_SALON_FOUND', latestSalon});
        return;
      }

      const payload = {
        city: 'Baghdad',
        area: 'Diagnostics',
        addressMode: 'MANUAL' as const,
        addressText: 'Diagnostics test address',
        locationLabel: 'Diagnostics run',
      };
      const invokeRes = await requestSalonActivationV2(latestSalon.data.id, payload);
      setResult('requestActivationForLatestSalon', {latestSalon, payload, invokeRes});
    } catch (error: any) {
      setResult('requestActivationForLatestSalon', {error: String(error?.message || error)});
    } finally {
      setLoading(false);
    }
  }, [setResult]);

  const fetchLatestActivationRequests = useCallback(async () => {
    if (!supabase) {
      setResult('fetchLatestActivationRequests', {error: 'SUPABASE_CONFIG_MISSING'});
      return;
    }
    setLoading(true);
    try {
      const requests = await supabase
        .from('activation_requests')
        .select('id,salon_id,status,created_at,reviewed_at,salons(id,name,status)')
        .order('created_at', {ascending: false})
        .limit(10);
      setResult('fetchLatestActivationRequests', requests);
    } catch (error: any) {
      setResult('fetchLatestActivationRequests', {error: String(error?.message || error)});
    } finally {
      setLoading(false);
    }
  }, [setResult]);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.md, paddingBottom: 120}}>
        <Text style={[typography.h2, {color: colors.text}]}>Diagnostics</Text>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>API mode: {env.useMockApi ? 'mock' : 'supabase'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>USE_INVITES_V2: {String(process.env.EXPO_PUBLIC_USE_INVITES_V2 || '') || '(default)'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>Build env: {env.buildEnv}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>Supabase host: {supabaseHost || '(missing)'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>Session exists: {sessionSummary.exists ? 'yes' : 'no'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>auth.uid(): {uid || sessionSummary.userId || '-'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>phone: {phone || sessionSummary.phone || '-'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>activeSalonId (local): {activeSalonId || '-'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}]}>memberships count: {memberships.length}</Text>
        </Card>

        <Card style={{gap: spacing.sm}}>
          <Button title="Refresh Session + Memberships" onPress={refreshSessionAndMemberships} loading={loading} />
          <Button title="Create Test Draft Salon" onPress={createTestDraftSalon} variant="secondary" loading={loading} />
          <Button title="Request Activation for Latest Salon" onPress={requestActivationForLatestSalon} variant="secondary" loading={loading} />
          <Button title="Fetch Latest activation_requests" onPress={fetchLatestActivationRequests} variant="secondary" loading={loading} />
        </Card>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.body, {color: colors.text}]}>Live memberships</Text>
          <Text selectable style={[typography.bodySm, {color: colors.textMuted}]}>
            {stringify(memberships)}
          </Text>
        </Card>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.body, {color: colors.text}]}>Last action result</Text>
          <Text selectable style={[typography.bodySm, {color: colors.textMuted}]}>
            {stringify(lastResult)}
          </Text>
        </Card>

        <Card style={{gap: spacing.xs}}>
          <Text style={[typography.body, {color: colors.text}]}>Last API logs/errors (20)</Text>
          <Text selectable style={[typography.bodySm, {color: colors.textMuted}]}>
            {stringify(logs.length ? logs : getDevLogs(20))}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
