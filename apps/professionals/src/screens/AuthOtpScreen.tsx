import {useMemo, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Input} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {useSendOtp, useVerifyOtp} from '../api/authHooks';
import {useAuthStore} from '../state/authStore';

const schema = z.object({
  code: z.string().min(4)
});

type FormValues = z.infer<typeof schema>;

export function AuthOtpScreen({route}: any) {
  const {colors, spacing, typography} = useTheme();
  const {t, isRTL} = useI18n();
  const [submitError, setSubmitError] = useState('');
  const pendingPhone = useAuthStore((state) => state.pendingPhone);

  const phone = useMemo(() => String(route?.params?.phone || pendingPhone || ''), [route?.params?.phone, pendingPhone]);

  const resendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {code: ''}
  });

  async function onSubmit(values: FormValues) {
    setSubmitError('');
    try {
      await verifyOtp.mutateAsync({phone, code: values.code});
    } catch (error: any) {
      setSubmitError(String(error?.message || t('requiredField')));
    }
  }

  async function onResend() {
    setSubmitError('');
    try {
      await resendOtp.mutateAsync(phone);
    } catch (error: any) {
      setSubmitError(String(error?.message || t('invalidPhone')));
    }
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: 'center'}}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={{gap: spacing.xs}}>
            <Text style={[typography.h2, {color: colors.text}, textDir(isRTL)]}>{t('verifyCode')}</Text>
            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{phone}</Text>
          </View>

          <Card style={{gap: spacing.md}}>
            <Controller
              control={control}
              name="code"
              render={({field: {onChange, value}, fieldState: {error}}) => (
                <Input
                  label={t('otpLabel')}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="number-pad"
                  error={error ? t('requiredField') : undefined}
                  placeholder="123456"
                />
              )}
            />

            {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

            <Button title={t('continue')} onPress={handleSubmit(onSubmit)} loading={verifyOtp.isPending} />
            <Button title={t('sendCode')} variant="secondary" onPress={onResend} loading={resendOtp.isPending} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
