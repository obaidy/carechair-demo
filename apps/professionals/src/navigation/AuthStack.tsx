import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {AuthPhoneScreen} from '../screens/AuthPhoneScreen';
import {AuthOtpScreen} from '../screens/AuthOtpScreen';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="AuthPhone" component={AuthPhoneScreen} />
      <Stack.Screen name="AuthOtp" component={AuthOtpScreen} />
    </Stack.Navigator>
  );
}
