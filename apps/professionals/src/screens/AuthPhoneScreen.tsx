import {useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Controller, useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {Button, Card, Input} from '../components';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {textDir} from '../utils/layout';
import {useSendOtp} from '../api/authHooks';
import {useAuthStore} from '../state/authStore';

const schema = z.object({
  phone: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

export function AuthPhoneScreen({navigation}: any) {
  const {colors, spacing, typography} = useTheme();
  const {t, isRTL} = useI18n();
  const [submitError, setSubmitError] = useState('');
  const setPendingPhone = useAuthStore((state) => state.setPendingPhone);

  const sendOtp = useSendOtp();

  const {control, handleSubmit} = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {phone: ''}
  });

  async function onSubmit(values: FormValues) {
    setSubmitError('');
    try {
      await sendOtp.mutateAsync(values.phone);
      setPendingPhone(values.phone);
      navigation.navigate('AuthOtp', {phone: values.phone});
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
            <Text style={[typography.h1, {color: colors.text}, textDir(isRTL)]}>{t('loginTitle')}</Text>
            <Text style={[typography.body, {color: colors.textMuted}, textDir(isRTL)]}>{t('loginSubtitle')}</Text>
          </View>

          <Card style={{gap: spacing.md}}>
            <Controller
              control={control}
              name="phone"
              render={({field: {onChange, value}, fieldState: {error}}) => (
                <Input
                  label={t('phoneLabel')}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  error={error ? t('invalidPhone') : undefined}
                  placeholder={isRTL ? '9647XXXXXXXX' : '+9647XXXXXXXX'}
                />
              )}
            />

            <Text style={[typography.bodySm, {color: colors.textMuted}, textDir(isRTL)]}>{t('otpHelp')}</Text>

            {submitError ? <Text style={[typography.bodySm, {color: colors.danger}, textDir(isRTL)]}>{submitError}</Text> : null}

            <Button title={t('sendCode')} onPress={handleSubmit(onSubmit)} loading={sendOtp.isPending} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
