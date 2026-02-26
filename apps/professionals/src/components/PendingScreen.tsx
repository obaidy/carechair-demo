import {KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View} from 'react-native';
import {styles} from '../styles';
import type {OnboardingDraft, PendingMode} from '../types';

type PendingScreenProps = {
  shellPadding: number;
  isTablet: boolean;
  rtl: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  pendingMode: PendingMode;
  onboardingDraft: OnboardingDraft;
  onboardingSaving: boolean;
  setOnboardingDraft: (next: OnboardingDraft | ((prev: OnboardingDraft) => OnboardingDraft)) => void;
  submitOnboarding: () => void;
  resetSession: () => void;
};

export function PendingScreen(props: PendingScreenProps) {
  const {
    shellPadding,
    isTablet,
    rtl,
    t,
    pendingMode,
    onboardingDraft,
    onboardingSaving,
    setOnboardingDraft,
    submitOnboarding,
    resetSession
  } = props;

  return (
    <KeyboardAvoidingView style={styles.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.centerContainer, {padding: shellPadding, paddingBottom: shellPadding + 24}]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.card, isTablet && styles.pendingCardTablet]}>
          <Text style={[styles.kicker, rtl && styles.textRtl]}>{t('appName')}</Text>
          <Text style={[styles.pendingTitle, rtl && styles.textRtl]}>
            {pendingMode === 'onboarding_required' ? t('onboardingTitle') : t('pendingTitle')}
          </Text>
          <Text style={[styles.pendingSubtitle, rtl && styles.textRtl]}>
            {pendingMode === 'onboarding_required' ? t('onboardingSubtitle') : t('pendingSubtitle')}
          </Text>

          {pendingMode === 'onboarding_required' ? (
            <View style={styles.stackSm}>
              <Text style={[styles.panelTitle, rtl && styles.textRtl]}>{t('onboardingFormTitle')}</Text>

              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('salonName')}</Text>
              <TextInput
                style={styles.input}
                value={onboardingDraft.salonName}
                onChangeText={(value) => setOnboardingDraft((prev) => ({...prev, salonName: value}))}
                returnKeyType="done"
              />

              <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
                <View style={styles.inputCol}>
                  <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('countryCode')}</Text>
                  <TextInput
                    style={styles.input}
                    value={onboardingDraft.countryCode}
                    onChangeText={(value) => setOnboardingDraft((prev) => ({...prev, countryCode: value.toUpperCase()}))}
                    maxLength={3}
                    autoCapitalize="characters"
                    returnKeyType="done"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('city')}</Text>
                  <TextInput
                    style={styles.input}
                    value={onboardingDraft.city}
                    onChangeText={(value) => setOnboardingDraft((prev) => ({...prev, city: value}))}
                    returnKeyType="done"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('phone')}</Text>
              <TextInput
                style={styles.input}
                value={onboardingDraft.whatsapp}
                onChangeText={(value) => setOnboardingDraft((prev) => ({...prev, whatsapp: value}))}
                keyboardType="phone-pad"
                autoCapitalize="none"
                returnKeyType="done"
              />

              <Text style={[styles.inputLabel, rtl && styles.textRtl]}>{t('adminPasscode')}</Text>
              <TextInput
                style={styles.input}
                value={onboardingDraft.adminPasscode}
                onChangeText={(value) => setOnboardingDraft((prev) => ({...prev, adminPasscode: value}))}
                keyboardType="number-pad"
                autoCapitalize="none"
                returnKeyType="done"
              />

              <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
                <Pressable style={[styles.primaryBtn, onboardingSaving && styles.disabledBtn]} onPress={submitOnboarding} disabled={onboardingSaving}>
                  <Text style={styles.primaryBtnText}>{onboardingSaving ? t('onboardingSubmitting') : t('submitOnboarding')}</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={resetSession}>
                  <Text style={styles.secondaryBtnText}>{t('logout')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.rowWrap, rtl && styles.rowRtl]}>
              <Pressable style={styles.secondaryBtn} onPress={resetSession}>
                <Text style={styles.secondaryBtnText}>{t('logout')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
