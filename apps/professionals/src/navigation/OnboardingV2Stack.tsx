import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ChoosePathScreen} from '../screens/Onboarding/ChoosePathScreen';
import {JoinByInviteScreen} from '../screens/Onboarding/JoinByInviteScreen';
import {CreateSalonWizardScreen} from '../screens/Onboarding/CreateSalonWizardScreen';
import {ActivationRequestScreen} from '../screens/Onboarding/ActivationRequestScreen';
import {useAuthStore} from '../state/authStore';

const Stack = createNativeStackNavigator();

export function OnboardingV2Stack() {
  const pendingJoinToken = useAuthStore((state) => state.pendingJoinToken);
  const initial = pendingJoinToken ? 'JoinByInvite' : 'ChoosePath';

  return (
    <Stack.Navigator screenOptions={{headerShown: false}} initialRouteName={initial as any}>
      <Stack.Screen name="ChoosePath" component={ChoosePathScreen} />
      <Stack.Screen name="JoinByInvite" component={JoinByInviteScreen} />
      <Stack.Screen name="CreateSalonWizard" component={CreateSalonWizardScreen} />
      <Stack.Screen name="ActivationRequest" component={ActivationRequestScreen} />
    </Stack.Navigator>
  );
}
