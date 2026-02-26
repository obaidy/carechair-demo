import {KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import type {LocaleCode} from '../i18n';
import type {AccessRole, AuthMethod, OtpChannel} from '../types';
import {styles} from '../styles';
import {LocaleSwitcher} from './LocaleSwitcher';

type AuthScreenProps = {
  shellPadding: number;
  isTablet: boolean;
  locale: LocaleCode;
  rtl: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  busy: boolean;
  error: string;
  info: string;
  hasSupabaseConfig: boolean;
  authMethod: AuthMethod;
  role: AccessRole;
  phone: string;
  email: string;
  password: string;
  otpCode: string;
  otpChannel: OtpChannel;
  setLocale: (locale: LocaleCode) => void;
  setAuthMethod: (method: AuthMethod) => void;
  setRole: (role: AccessRole) => void;
  setPhone: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setOtpCode: (value: string) => void;
  sendOtpCode: () => void;
  verifyOtpCode: () => void;
  signInWithEmail: () => void;
};

export function AuthScreen(props: AuthScreenProps) {
  const {
    shellPadding,
    isTablet,
    locale,
    rtl,
    t,
    busy,
    error,
    info,
    hasSupabaseConfig,
    authMethod,
    role,
    phone,
    email,
    password,
    otpCode,
    otpChannel,
    setLocale,
    setAuthMethod,
    setRole,
    setPhone,
    setEmail,
    setPassword,
    setOtpCode,
    sendOtpCode,
    verifyOtpCode,
    signInWithEmail
  } = props;

  return (
    <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.screenContainer, {padding: shellPadding, paddingBottom: shellPadding + 28}]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.heroCard, isTablet && styles.heroCardTablet]}>
          <Text style={[styles.kicker, rtl && styles.textRtl]}>{t('appName')}</Text>
          <Text style={[styles.heroTitle, rtl && styles.textRtl]}>{t('authTitle')}</Text>
          <Text style={[styles.heroSubtitle, rtl && styles.textRtl]}>{t('authSubtitle')}</Text>
          <LocaleSwitcher locale={locale} onChange={setLocale} rtl={rtl} />
        </View>

        <View style={[styles.card, isTablet && styles.cardTablet]}>
          <View style={styles.segmentRow}>
            <Pressable style={[styles.segmentBtn, authMethod === 'phone' && styles.segmentBtnActive]} onPress={() => setAuthMethod('phone')}>
              <Text style={[styles.segmentText, authMethod === 'phone' && styles.segmentTextActive]}>{t('phoneOtp')}</Text>
            </Pressable>
            <Pressable style={[styles.segmentBtn, authMethod === 'email' && styles.segmentBtnActive]} onPress={() => setAuthMethod('email')}>
              <Text style={[styles.segmentText, authMethod === 'email' && styles.segmentTextActive]}>{t('emailLogin')}</Text>
            </Pressable>
          </View>

          <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
            <Pressable style={[styles.roleChip, role === 'salon_admin' && styles.roleChipActive]} onPress={() => setRole('salon_admin')}>
              <Text style={[styles.roleText, role === 'salon_admin' && styles.roleTextActive]}>{t('salonAdmin')}</Text>
            </Pressable>
            <Pressable style={[styles.roleChip, role === 'superadmin' && styles.roleChipActive]} onPress={() => setRole('superadmin')}>
              <Text style={[styles.roleText, role === 'superadmin' && styles.roleTextActive]}>{t('superadmin')}</Text>
            </Pressable>
          </View>

          {authMethod === 'phone' ? (
            <View style={styles.stackSm}>
              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('phone')}</Text>
              <TextInput
                placeholder="+9647xxxxxxxx"
                keyboardType="phone-pad"
                autoCapitalize="none"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                returnKeyType="done"
              />

              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('code')}</Text>
              <TextInput
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                style={styles.input}
                value={otpCode}
                onChangeText={setOtpCode}
                returnKeyType="done"
              />

              <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
                <Pressable style={[styles.primaryBtn, busy && styles.disabledBtn]} onPress={sendOtpCode} disabled={busy}>
                  <Text style={styles.primaryBtnText}>{busy ? t('pleaseWait') : t('sendCode')}</Text>
                </Pressable>
                <Pressable style={[styles.secondaryBtn, busy && styles.disabledBtn]} onPress={verifyOtpCode} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>{t('verify')}</Text>
                </Pressable>
              </View>

              {otpChannel ? (
                <Text style={[styles.helperText, rtl && styles.textRtl]}>
                  {t('deliveryChannel')}: {String(otpChannel).toUpperCase()}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.stackSm}>
              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('email')}</Text>
              <TextInput
                placeholder="name@company.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                returnKeyType="done"
              />

              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('password')}</Text>
              <TextInput
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
              />

              <Pressable style={[styles.primaryBtn, busy && styles.disabledBtn]} onPress={signInWithEmail} disabled={busy}>
                <Text style={styles.primaryBtnText}>{busy ? t('pleaseWait') : t('login')}</Text>
              </Pressable>
            </View>
          )}

          {info ? <Text style={[styles.successText, rtl && styles.textRtl]}>{info}</Text> : null}
          {error ? <Text style={[styles.errorText, rtl && styles.textRtl]}>{error}</Text> : null}
          {!hasSupabaseConfig ? <Text style={[styles.helperText, rtl && styles.textRtl]}>{t('missingConfig')}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
