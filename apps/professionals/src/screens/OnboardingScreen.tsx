import {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Input} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {useCreateSalon} from '../api/hooks';
import {api} from '../api';
import {useAuthStore} from '../state/authStore';

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  locationLabel: z.string().min(2),
  locationAddress: z.string().min(4),
  workdayStart: z.string().min(4),
  workdayEnd: z.string().min(4)
});

type FormValues = z.infer<typeof schema>;

export function OnboardingScreen() {
  const {colors, spacing, typography} = useTheme();
  const {t, isRTL} = useI18n();
  const context = useAuthStore((state) => state.context);
  const setContext = useAuthStore((state) => state.setContext);
  const mutation = useCreateSalon();
  const [submitError, setSubmitError] = useState('');
  const [submitInfo, setSubmitInfo] = useState('');

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: context?.user?.phone || '',
      locationLabel: '',
      locationAddress: '',
      workdayStart: '08:00',
      workdayEnd: '22:00'
    }
  });

  async function onSubmit(values: FormValues) {
    setSubmitError('');
    setSubmitInfo('');
    try {
      const salon = await mutation.mutateAsync(values);

      if (context?.user) {
        setContext({
          user: {...context.user, salonId: salon.id},
          salon
        });
      } else {
        const refreshed = await api.owner.getContext();
        setContext(refreshed);
      }

      setSubmitInfo(isRTL ? 'تم إنشاء الصالون بنجاح.' : 'Salon created successfully.');
    } catch (error: any) {
      const message = String(error?.message || '').trim();
      setSubmitError(message || (isRTL ? 'فشل إنشاء الصالون. حاول مرة أخرى.' : 'Failed to create salon. Please try again.'));
    }
  }

  function onInvalidSubmit() {
    setSubmitInfo('');
    setSubmitError(t('activationFieldsMissing'));
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}} keyboardShouldPersistTaps="handled">
        <View style={{gap: spacing.xs}}>
          <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('salonSetupTitle')}</Text>
          <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
            {isRTL
              ? 'خطوات سريعة لإنشاء مساحة العمل والبدء بإدارة الحجوزات فوراً.'
              : 'Quick setup to create your workspace and start managing bookings immediately.'}
          </Text>
        </View>

        <Card style={{gap: spacing.md}}>
          <Controller
            control={control}
            name="name"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('salonName')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input
                label={t('salonPhone')}
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                error={error ? t('invalidPhone') : undefined}
              />
            )}
          />

          <Controller
            control={control}
            name="locationLabel"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('locationLabel')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <Controller
            control={control}
            name="locationAddress"
            render={({field: {value, onChange}, fieldState: {error}}) => (
              <Input label={t('salonLocation')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
            )}
          />

          <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
            <View style={{flex: 1}}>
              <Controller
                control={control}
                name="workdayStart"
                render={({field: {value, onChange}, fieldState: {error}}) => (
                  <Input label={t('workdayStart')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
                )}
              />
            </View>
            <View style={{flex: 1}}>
              <Controller
                control={control}
                name="workdayEnd"
                render={({field: {value, onChange}, fieldState: {error}}) => (
                  <Input label={t('workdayEnd')} value={value} onChangeText={onChange} error={error ? t('requiredField') : undefined} />
                )}
              />
            </View>
          </View>

          {submitInfo ? <Text style={[typography.bodySm, {color: colors.success}, textDir(isRTL)]}>{submitInfo}</Text> : null}
          {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

          <Button
            title={t('createSalon')}
            onPress={handleSubmit(onSubmit, onInvalidSubmit)}
            loading={mutation.isPending}
            disabled={mutation.isPending}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
