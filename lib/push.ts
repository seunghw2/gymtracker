import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from '../db/api/notifications';

/**
 * 원격 푸시 등록(앱 종료 상태에서도 뜨는 푸시). Expo Go에서는 동작하지 않으므로 스킵하고,
 * 개발 빌드/스토어 빌드에서만 Expo 푸시 토큰을 받아 백엔드에 등록한다. 실패는 조용히 무시.
 */
export async function registerForPushNotifications(): Promise<void> {
  // Expo Go(appOwnership === 'expo')에선 원격 푸시 토큰 불가
  if (Constants.appOwnership === 'expo') return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted && perm.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (token) await registerPushToken(token, Platform.OS);
  } catch {
    /* ignore — 권한 거부/네트워크/Expo Go 등 */
  }
}
