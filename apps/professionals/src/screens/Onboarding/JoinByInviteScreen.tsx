import {useEffect, useMemo, useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Input} from '../../components';
import {useTheme} from '../../theme/provider';
import {useI18n} from '../../i18n/provider';
import {textDir} from '../../utils/layout';
import {acceptInvite, getOwnerContextBySalonIdV2, listActiveMembershipsV2, type AcceptInviteResult} from '../../api/invites';
import {persistActiveSalonId, clearPendingJoinToken} from '../../auth/session';
import {useAuthStore} from '../../state/authStore';

const schema = z.object({
  code: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

function normalizeInviteError(input: string, isRTL: boolean) {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'EXPIRED') return isRTL ? 'انتهت صلاحية الدعوة.' : 'Invite has expired.';
  if (value === 'REVOKED') return isRTL ? 'تم إلغاء الدعوة.' : 'Invite was revoked.';
  if (value === 'MAX_USES') return isRTL ? 'تم الوصول للحد الأقصى لاستخدام الدعوة.' : 'Invite max uses reached.';
  if (value === 'RATE_LIMITED') return isRTL ? 'محاولات كثيرة. حاول لاحقاً.' : 'Too many attempts. Try again later.';
  return isRTL ? 'الدعوة غير صالحة.' : 'Invalid invite.';
}

export function JoinByInviteScreen({route}: any) {
  const {colors, spacing, typography} = useTheme();
  const {isRTL} = useI18n();

  const pendingToken = useAuthStore((state) => state.pendingJoinToken);
  const setPendingToken = useAuthStore((state) => state.setPendingJoinToken);
  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setContext = useAuthStore((state) => state.setContext);

  const [submitError, setSubmitError] = useState('');
  const [submitInfo, setSubmitInfo] = useState('');
  const [accepted, setAccepted] = useState<AcceptInviteResult | null>(null);
  const [acceptedSalonName, setAcceptedSalonName] = useState('');
  const [loadingToken, setLoadingToken] = useState(false);
  const tokenFromRoute = useMemo(() => String(route?.params?.token || '').trim(), [route?.params?.token]);

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {code: ''}
  });

  async function completeFlow(salonId: string) {
    const memberships = await listActiveMembershipsV2();
    setMemberships(memberships);
    await persistActiveSalonId(salonId);
    setActiveSalonId(salonId);
    const context = await getOwnerContextBySalonIdV2(salonId);
    setContext(context);
  }

  async function acceptByToken(rawToken: string) {
    if (!rawToken) return;
    setSubmitError('');
    setSubmitInfo('');
    setLoadingToken(true);
    try {
      const accepted = await acceptInvite({token: rawToken});
      await clearPendingJoinToken();
      setPendingToken(null);
      const context = await getOwnerContextBySalonIdV2(accepted.salonId);
      setAccepted(accepted);
      setAcceptedSalonName(context.salon?.name || accepted.salonId);
      setSubmitInfo(isRTL ? 'تم التحقق من الدعوة.' : 'Invite verified successfully.');
    } catch (error: any) {
      setSubmitError(normalizeInviteError(String(error?.message || ''), isRTL));
    } finally {
      setLoadingToken(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitError('');
    setSubmitInfo('');
    try {
      const accepted = await acceptInvite({code: values.code});
      const context = await getOwnerContextBySalonIdV2(accepted.salonId);
      setAccepted(accepted);
      setAcceptedSalonName(context.salon?.name || accepted.salonId);
      setSubmitInfo(isRTL ? 'تم التحقق من الدعوة.' : 'Invite verified successfully.');
    } catch (error: any) {
      setSubmitError(normalizeInviteError(String(error?.message || ''), isRTL));
    }
  }

  useEffect(() => {
    const token = tokenFromRoute || pendingToken;
    if (!token) return;
    void acceptByToken(token);
  }, [pendingToken, tokenFromRoute]);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: 'center'}}>
        <View style={{gap: spacing.xs}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'الانضمام إلى صالون' : 'Join a salon'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
            {isRTL ? 'الصق كود الدعوة أو افتح رابط الدعوة مباشرة.' : 'Paste an invite code or open an invite link.'}
          </Text>
        </View>

        <Card style={{gap: spacing.md}}>
          <Controller
            control={control}
            name="code"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input
                label={isRTL ? 'كود الدعوة' : 'Invite code'}
                value={value}
                onChangeText={(next) => onChange(next.toUpperCase())}
                autoCapitalize="characters"
                error={error ? (isRTL ? 'أدخل كود صحيح' : 'Enter a valid code') : undefined}
                placeholder="A7K9Q2XZ"
              />
            )}
          />

          <Button title={isRTL ? 'انضمام بالكود' : 'Join with code'} onPress={handleSubmit(onSubmit)} />
          <Button
            title={isRTL ? 'فتح الرابط تلقائياً' : 'Open link automatically'}
            variant="secondary"
            disabled={!pendingToken && !tokenFromRoute}
            loading={loadingToken}
            onPress={() => acceptByToken(tokenFromRoute || pendingToken || '')}
          />

          {submitInfo ? <Text style={[typography.bodySm, {color: colors.success}, textDir(isRTL)]}>{submitInfo}</Text> : null}
          {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

          {accepted ? (
            <Card style={{gap: spacing.xs, backgroundColor: colors.surfaceSoft}}>
              <Text style={[typography.body, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'تمت إضافة العضوية' : 'Membership added'}</Text>
              <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                {isRTL ? 'الصالون' : 'Salon'}: {acceptedSalonName}
              </Text>
              <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
                {isRTL ? 'الدور' : 'Role'}: {accepted.role}
              </Text>
              <Button title={isRTL ? 'متابعة' : 'Continue'} onPress={() => completeFlow(accepted.salonId)} />
            </Card>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
