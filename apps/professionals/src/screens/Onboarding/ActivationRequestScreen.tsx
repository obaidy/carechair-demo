import {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Input} from '../../components';
import {useTheme} from '../../theme/provider';
import {useI18n} from '../../i18n/provider';
import {textDir} from '../../utils/layout';
import {getOwnerContextBySalonIdV2, listActiveMembershipsV2, requestSalonActivationV2} from '../../api/invites';
import {persistActiveSalonId} from '../../auth/session';
import {useAuthStore} from '../../state/authStore';

const schema = z.object({
  locationAddress: z.string().min(4),
  storefrontPhotoUrl: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export function ActivationRequestScreen({route}: any) {
  const {colors, spacing, typography} = useTheme();
  const {isRTL} = useI18n();
  const salonId = String(route?.params?.salonId || '').trim();

  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setContext = useAuthStore((state) => state.setContext);

  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      locationAddress: '',
      storefrontPhotoUrl: ''
    }
  });

  async function finishAndEnterApp() {
    const memberships = await listActiveMembershipsV2();
    setMemberships(memberships);
    if (salonId) {
      await persistActiveSalonId(salonId);
      setActiveSalonId(salonId);
      const context = await getOwnerContextBySalonIdV2(salonId);
      setContext(context);
    }
  }

  async function onSubmit(values: FormValues) {
    if (!salonId) return;
    setSubmitError('');
    setSaving(true);
    try {
      await requestSalonActivationV2(salonId, {
        locationAddress: values.locationAddress,
        storefrontPhotoUrl: values.storefrontPhotoUrl
      });
      await finishAndEnterApp();
    } catch (error: any) {
      setSubmitError(String(error?.message || (isRTL ? 'فشل إرسال طلب التفعيل.' : 'Failed to request activation.')));
    } finally {
      setSaving(false);
    }
  }

  async function onSkip() {
    setSubmitError('');
    setSaving(true);
    try {
      await finishAndEnterApp();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, flexGrow: 1}}>
        <View style={{gap: spacing.xs}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'طلب التفعيل' : 'Activation request'}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
            {isRTL
              ? 'أضف بيانات المتجر لإرسال الطلب. يمكنك التخطي والمتابعة كمسودة.'
              : 'Add storefront details to submit review request. You can skip and continue as draft.'}
          </Text>
        </View>

        <Card style={{gap: spacing.md}}>
          <Controller
            control={control}
            name="locationAddress"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input
                label={isRTL ? 'عنوان المتجر' : 'Store address'}
                value={value}
                onChangeText={onChange}
                error={error ? (isRTL ? 'مطلوب' : 'Required') : undefined}
              />
            )}
          />

          <Controller
            control={control}
            name="storefrontPhotoUrl"
            render={({field: {value, onChange}}) => (
              <Input label={isRTL ? 'رابط صورة الواجهة (اختياري)' : 'Storefront photo URL (optional)'} value={value || ''} onChangeText={onChange} />
            )}
          />

          {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

          <Button title={isRTL ? 'إرسال طلب التفعيل' : 'Request activation'} onPress={handleSubmit(onSubmit)} loading={saving} />
          <Button title={isRTL ? 'متابعة كمسودة' : 'Continue as draft'} variant="secondary" onPress={onSkip} loading={saving} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
