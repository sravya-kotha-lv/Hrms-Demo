import { Alert, PermissionsAndroid, Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { postApiWithToken } from './api';

const isAuthorizedStatus = (status: number) =>
  status === messaging.AuthorizationStatus.AUTHORIZED ||
  status === messaging.AuthorizationStatus.PROVISIONAL;

const requestAndroidNotificationPermission = async () => {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

export const requestUserPermission = async (): Promise<boolean> => {
  const androidPermissionGranted = await requestAndroidNotificationPermission();
  if (!androidPermissionGranted) {
    return false;
  }

  const authStatus = await messaging().requestPermission();
  return isAuthorizedStatus(authStatus);
};

export const getFcmToken = async (): Promise<string | null> => {
  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();
  return token;
};

const registerDeviceToken = async (token: string, authToken: string) => {
  const response = await postApiWithToken<{ token: string }>(
    '/notifications/device-token/register',
    {
      token,
      platform: Platform.OS,
    },
    authToken
  );

  if (!response?.success) {
    throw new Error(response?.message || 'Unable to save FCM token');
  }
};

const getNotificationText = (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
  const title = remoteMessage.notification?.title || 'Notification';
  const body =
    remoteMessage.notification?.body ||
    String(remoteMessage.data?.body || remoteMessage.data?.message || '');

  return { title, body };
};

export const setupFirebaseMessaging = async (authToken: string) => {
  const permissionGranted = await requestUserPermission();
  if (!permissionGranted) {
    console.log('FCM permission not granted');
    return () => {};
  }

  const token = await getFcmToken();
  console.log('FCM token:', token);
  if (token) {
    await registerDeviceToken(token, authToken);
    console.log('FCM token registered with backend');
  }

  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    console.log('Foreground FCM message:', JSON.stringify(remoteMessage));
    const { title, body } = getNotificationText(remoteMessage);
    Alert.alert(title, body || 'You received a new message.');
  });

  const unsubscribeOpened = messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('Opened from background notification:', JSON.stringify(remoteMessage));
  });

  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('Opened from quit state notification:', JSON.stringify(remoteMessage));
      }
    });

  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async nextToken => {
    console.log('FCM token refreshed:', nextToken);
    try {
      await registerDeviceToken(nextToken, authToken);
      console.log('Refreshed FCM token registered with backend');
    } catch (error) {
      console.log('FCM token refresh registration failed:', error);
    }
  });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
    unsubscribeTokenRefresh();
  };
};
