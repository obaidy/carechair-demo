import {useEffect, useMemo} from 'react';
import {Linking, Text, View} from 'react-native';
import {NavigationContainer, DarkTheme, DefaultTheme, type Theme as NavigationTheme} from '@react-navigation/native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RootNavigator} from '../navigation/RootNavigator';
import {ThemeProvider, useTheme} from '../theme/provider';
import {I18nProvider} from '../i18n/provider';
import {useBootstrapAuth} from '../api/authHooks';
import {usePushNotifications} from './usePushNotifications';
import {activeApiMode} from '../api';
import {useAuthStore} from '../state/authStore';
import {extractJoinTokenFromUrl, persistPendingJoinToken} from '../auth/session';
import {flags} from '../config/flags';
import {env, hasSupabaseConfig, supabaseHost} from '../utils/env';
import {pushDevLog} from '../lib/devLogger';

const queryClient = new QueryClient();

function ConfigErrorScreen() {
  return (
    <View style={{flex: 1, padding: 24, backgroundColor: '#0b1220', justifyContent: 'center', gap: 12}}>
      <Text style={{fontSize: 20, fontWeight: '700', color: '#fff'}}>Configuration error</Text>
      <Text style={{fontSize: 14, color: '#cbd5e1', lineHeight: 20}}>
        Mock mode is OFF but Supabase config is missing. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
      </Text>
      <Text style={{fontSize: 13, color: '#93c5fd'}}>Current host: {supabaseHost || '(missing)'}</Text>
    </View>
  );
}

function AppInner() {
  const theme = useTheme();
  const bootstrapAuth = useBootstrapAuth();
  const session = useAuthStore((state) => state.session);
  const pendingJoinToken = useAuthStore((state) => state.pendingJoinToken);
  const setPendingJoinToken = useAuthStore((state) => state.setPendingJoinToken);

  usePushNotifications(Boolean(session));

  useEffect(() => {
    void bootstrapAuth();
  }, [bootstrapAuth]);

  useEffect(() => {
    const startup = {
      apiMode: activeApiMode(),
      useMockApi: env.useMockApi,
      useInvitesV2: flags.USE_INVITES_V2,
      devOtpBypass: __DEV__ && env.devOtpBypass,
      supabaseHost: supabaseHost || '(missing)',
      buildEnv: env.buildEnv,
      nodeEnv: process.env.NODE_ENV || 'development',
    };
    // eslint-disable-next-line no-console
    console.log('[CareChair Professionals] startup', startup);
    if (__DEV__) pushDevLog('info', 'startup', 'App bootstrap started', startup);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrateInitialUrl() {
      const initial = await Linking.getInitialURL();
      const token = extractJoinTokenFromUrl(initial);
      if (!mounted || !token) return;
      setPendingJoinToken(token);
      await persistPendingJoinToken(token);
    }

    void hydrateInitialUrl();

    const sub = Linking.addEventListener('url', (event) => {
      const token = extractJoinTokenFromUrl(event.url);
      if (!token) return;
      setPendingJoinToken(token);
      void persistPendingJoinToken(token);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [setPendingJoinToken]);

  useEffect(() => {
    if (!flags.USE_INVITES_V2 || !session || !pendingJoinToken) return;
    void bootstrapAuth();
  }, [bootstrapAuth, pendingJoinToken, session]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.primary
      }
    };
  }, [theme.colors.background, theme.colors.border, theme.colors.primary, theme.colors.surface, theme.colors.text, theme.mode]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  if (!env.useMockApi && !hasSupabaseConfig) {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        <ConfigErrorScreen />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AppInner />
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
