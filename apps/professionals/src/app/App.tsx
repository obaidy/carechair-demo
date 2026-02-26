import {useEffect, useMemo} from 'react';
import {Linking} from 'react-native';
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

const queryClient = new QueryClient();

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
    // Helpful visibility in dev; remove in production if needed.
    // eslint-disable-next-line no-console
    console.log(`[CareChair Professionals] API mode: ${activeApiMode()}`);
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
