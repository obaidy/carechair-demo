import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Text, View} from 'react-native';
import {AuthStack} from './AuthStack';
import {MainTabs} from './MainTabs';
import {OnboardingScreen} from '../screens/OnboardingScreen';
import {OnboardingV2Stack} from './OnboardingV2Stack';
import {SwitchSalonScreen} from '../screens/SwitchSalonScreen';
import {useAuthStore} from '../state/authStore';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';
import {flags} from '../config/flags';

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

export function RootNavigator() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const session = useAuthStore((state) => state.session);
  const context = useAuthStore((state) => state.context);
  const memberships = useAuthStore((state) => state.memberships);
  const activeSalonId = useAuthStore((state) => state.activeSalonId);

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

  if (flags.USE_INVITES_V2) {
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
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {!context?.salon ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : <Stack.Screen name="Main" component={MainTabs} />}
    </Stack.Navigator>
  );
}
