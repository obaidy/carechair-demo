import {useEffect} from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {Platform} from 'react-native';
import {api} from '../api';
import {pushDevLog} from '../lib/devLogger';

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function register() {
      try {
        await Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true
          })
        });
      } catch (error) {
        // Expo Go can have notification limitations; do not block app boot.
        if (__DEV__) console.warn('[Push] notification handler setup skipped', error);
        return;
      }

      // Remote push in Expo Go is limited; skip registration in this environment.
      if (Constants.appOwnership === 'expo') {
        if (__DEV__) pushDevLog('info', 'push.register', 'Skipping push registration in Expo Go');
        return;
      }
      if (!Device.isDevice) return;

      try {
        const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          if (__DEV__) pushDevLog('warn', 'push.register', 'Missing EAS projectId for push registration');
          return;
        }

        const {status: existingStatus} = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const {status} = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          if (__DEV__) pushDevLog('warn', 'push.register', 'Push permission not granted', {status: finalStatus});
          return;
        }

        const token = await Notifications.getExpoPushTokenAsync({projectId});
        if (!cancelled && token.data) {
          if (__DEV__) pushDevLog('info', 'push.register', 'Expo push token acquired', {tokenPrefix: token.data.slice(0, 18)});
          await api.notifications.registerPushToken(token.data);
          if (__DEV__) pushDevLog('info', 'push.register', 'Push token registered with backend');
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT
          });
        }
      } catch (error) {
        if (__DEV__) pushDevLog('warn', 'push.register', 'Push registration skipped', {error: String((error as any)?.message || error || 'unknown')});
        if (__DEV__) console.warn('[Push] registration skipped', error);
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
