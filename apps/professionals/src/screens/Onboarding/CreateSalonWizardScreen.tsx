import {useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Input} from '../../components';
import {useTheme} from '../../theme/provider';
import {useI18n} from '../../i18n/provider';
import {textDir} from '../../utils/layout';
import {createSalonDraftV2, getOwnerContextBySalonIdV2, listActiveMembershipsV2} from '../../api/invites';
import {persistActiveSalonId} from '../../auth/session';
import {useAuthStore} from '../../state/authStore';

const schema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  locationLabel: z.string().min(2),
  locationAddress: z.string().min(4),
  workdayStart: z.string().min(4),
  workdayEnd: z.string().min(4)
});

type FormValues = z.infer<typeof schema>;

export function CreateSalonWizardScreen({navigation}: any) {
  const {colors, spacing, typography} = useTheme();
  const {isRTL} = useI18n();
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const setMemberships = useAuthStore((state) => state.setMemberships);
  const setActiveSalonId = useAuthStore((state) => state.setActiveSalonId);
  const setContext = useAuthStore((state) => state.setContext);

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      locationLabel: '',
      locationAddress: '',
      workdayStart: '08:00',
      workdayEnd: '22:00'
    }
  });

  async function onSubmit(values: FormValues) {
    setSubmitError('');
    setSaving(true);
    try {
      const salon = await createSalonDraftV2(values);
      await persistActiveSalonId(salon.id);
      setActiveSalonId(salon.id);
      const memberships = await listActiveMembershipsV2();
      setMemberships(memberships);
      const context = await getOwnerContextBySalonIdV2(salon.id);
      setContext(context);
      navigation.navigate('ActivationRequest', {salonId: salon.id});
    } catch (error: any) {
      setSubmitError(String(error?.message || (isRTL ? 'فشل إنشاء الصالون.' : 'Failed to create salon.')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{padding: spacing.lg, gap: spacing.lg}}>
          <View style={{gap: spacing.xs}}>
            <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{isRTL ? 'إعداد الصالون' : 'Create salon'}</Text>
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>
              {isRTL ? 'أدخل بيانات أساسية. يمكنك تعديل كل شيء لاحقاً.' : 'Enter basic details. You can edit everything later.'}
            </Text>
          </View>

          <Card style={{gap: spacing.md}}>
            <Controller
              control={control}
              name="name"
              render={({field: {value, onChange}, fieldState: {error}}) => (
                <Input
                  label={isRTL ? 'اسم الصالون' : 'Salon name'}
                  value={value}
                  onChangeText={onChange}
                  error={error ? 'Required' : undefined}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={textDir(isRTL)}
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({field: {value, onChange}, fieldState: {error}}) => (
                <Input
                  label={isRTL ? 'رقم الهاتف' : 'Phone'}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="phone-pad"
                  error={error ? 'Required' : undefined}
                />
              )}
            />

            <Controller
              control={control}
              name="locationLabel"
              render={({field: {value, onChange}, fieldState: {error}}) => (
                <Input label={isRTL ? 'المدينة/الفرع' : 'City / branch'} value={value} onChangeText={onChange} error={error ? 'Required' : undefined} />
              )}
            />

            <Controller
              control={control}
              name="locationAddress"
              render={({field: {value, onChange}, fieldState: {error}}) => (
                <Input label={isRTL ? 'العنوان' : 'Address'} value={value} onChangeText={onChange} error={error ? 'Required' : undefined} />
              )}
            />

            <View style={{flexDirection: isRTL ? 'row-reverse' : 'row', gap: spacing.sm}}>
              <View style={{flex: 1}}>
                <Controller
                  control={control}
                  name="workdayStart"
                  render={({field: {value, onChange}, fieldState: {error}}) => (
                    <Input label={isRTL ? 'بداية الدوام' : 'Start'} value={value} onChangeText={onChange} error={error ? 'Required' : undefined} />
                  )}
                />
              </View>
              <View style={{flex: 1}}>
                <Controller
                  control={control}
                  name="workdayEnd"
                  render={({field: {value, onChange}, fieldState: {error}}) => (
                    <Input label={isRTL ? 'نهاية الدوام' : 'End'} value={value} onChangeText={onChange} error={error ? 'Required' : undefined} />
                  )}
                />
              </View>
            </View>

            {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

            <Button title={isRTL ? 'متابعة' : 'Continue'} onPress={handleSubmit(onSubmit)} loading={saving} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
