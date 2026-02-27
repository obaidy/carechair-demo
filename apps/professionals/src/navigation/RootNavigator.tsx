import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Pressable, Text, View} from 'react-native';
import {AuthStack} from './AuthStack';
import {MainTabs} from './MainTabs';
import {OnboardingScreen} from '../screens/OnboardingScreen';
import {OnboardingV2Stack} from './OnboardingV2Stack';
import {SwitchSalonScreen} from '../screens/SwitchSalonScreen';
import {DiagnosticsScreen} from '../screens/DiagnosticsScreen';
import {useAuthStore} from '../state/authStore';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {flags} from '../config/flags';
import {useBootstrapAuth} from '../api/authHooks';
import {env} from '../utils/env';

const Stack = createNativeStackNavigator();

function SplashScreen() {
  const {colors, typography} = useTheme();
  const {t} = useI18n();

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
      <Text style={[typography.h3, {color: colors.text}]}>{t('loading')}</Text>
    </View>
  );
}

function BootstrapErrorScreen() {
  const {colors, typography} = useTheme();
  const bootstrap = useBootstrapAuth();
  const bootstrapError = useAuthStore((state) => state.bootstrapError);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, backgroundColor: colors.background}}>
      <Text style={[typography.h3, {color: colors.text}]}>Load error</Text>
      <Text style={[typography.bodySm, {color: colors.textMuted, textAlign: 'center'}]}>
        Membership bootstrap failed. Retry instead of falling back to local/demo state.
      </Text>
      <Text selectable style={[typography.caption, {color: colors.danger, textAlign: 'center'}]}>
        {bootstrapError || 'BOOTSTRAP_FAILED'}
      </Text>
      <Pressable
        onPress={() => {
          void bootstrap();
        }}
        style={{
          minWidth: 140,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: 'center',
        }}
      >
        <Text style={[typography.bodySm, {color: colors.primary, fontWeight: '700'}]}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function RootNavigator() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const session = useAuthStore((state) => state.session);
  const context = useAuthStore((state) => state.context);
  const memberships = useAuthStore((state) => state.memberships);
  const activeSalonId = useAuthStore((state) => state.activeSalonId);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);

  if (!hydrated) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Splash" component={SplashScreen} />
      </Stack.Navigator>
    );
  }

  if (!session) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Auth" component={AuthStack} />
      </Stack.Navigator>
    );
  }

  if (bootstrapError) {
    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="BootstrapError" component={BootstrapErrorScreen} />
      </Stack.Navigator>
    );
  }

  const useMembershipRouting = flags.USE_INVITES_V2 || !env.useMockApi;

  if (useMembershipRouting) {
    if (!memberships.length) {
      return (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="OnboardingV2" component={OnboardingV2Stack} />
        </Stack.Navigator>
      );
    }

    if (memberships.length > 1 && !activeSalonId) {
      return (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="SwitchSalonMandatory" component={SwitchSalonScreen} />
        </Stack.Navigator>
      );
    }

    if (!context?.salon) {
      return (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="SwitchSalonMandatory" component={SwitchSalonScreen} />
        </Stack.Navigator>
      );
    }

    return (
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="SwitchSalon" component={SwitchSalonScreen} />
        {__DEV__ ? <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} /> : null}
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {!context?.salon ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : <Stack.Screen name="Main" component={MainTabs} />}
    </Stack.Navigator>
  );
}
