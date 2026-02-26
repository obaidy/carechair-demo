import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Ionicons} from '@expo/vector-icons';
import {DashboardScreen} from '../screens/DashboardScreen';
import {CalendarScreen} from '../screens/CalendarScreen';
import {ClientsScreen} from '../screens/ClientsScreen';
import {StaffScreen} from '../screens/StaffScreen';
import {MoreScreen} from '../screens/MoreScreen';
import {useTheme} from '../theme/provider';
import {useI18n} from '../i18n/provider';

const Tabs = createBottomTabNavigator();

export function MainTabs() {
  const {colors} = useTheme();
  const {t} = useI18n();

  return (
    <Tabs.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIcon,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarIcon: ({color, size}) => {
          const iconName =
            route.name === 'DashboardTab'
              ? 'home-outline'
              : route.name === 'CalendarTab'
                ? 'calendar-outline'
                : route.name === 'ClientsTab'
                  ? 'people-outline'
                  : route.name === 'StaffTab'
                    ? 'person-outline'
                    : 'menu-outline';
          return <Ionicons name={iconName as any} size={size} color={color} />;
        }
      })}
    >
      <Tabs.Screen name="DashboardTab" component={DashboardScreen} options={{title: t('dashboard')}} />
      <Tabs.Screen name="CalendarTab" component={CalendarScreen} options={{title: t('calendar')}} />
      <Tabs.Screen name="ClientsTab" component={ClientsScreen} options={{title: t('clients')}} />
      <Tabs.Screen name="StaffTab" component={StaffScreen} options={{title: t('staff')}} />
      <Tabs.Screen name="MoreTab" component={MoreScreen} options={{title: t('more')}} />
    </Tabs.Navigator>
  );
}
