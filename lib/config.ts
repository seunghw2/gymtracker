import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 백엔드 API 베이스 URL.
 *
 * - iOS 시뮬레이터: localhost (Mac 자체)
 * - Android 에뮬레이터: 10.0.2.2 (호스트 머신)
 * - 실제 폰 (Expo Go): Mac의 LAN IP (Expo가 자동 추출)
 *
 * 환경변수 EXPO_PUBLIC_API_URL 로 오버라이드 가능.
 */
function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  if (Platform.OS === 'android' && !Constants.expoConfig?.hostUri) {
    return 'http://10.0.2.2:8080';
  }

  // Expo Go: hostUri는 보통 "192.168.x.x:8081"
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8080`;

  return 'http://localhost:8080';
}

export const API_URL = resolveApiUrl();
