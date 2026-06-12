/**
 * Google 로그인 설정.
 * 클라이언트 ID는 Google Cloud Console에서 발급받아 .env에 넣는다
 * (자세한 절차: docs/SOCIAL_LOGIN_SETUP.md).
 *
 * 주의: Google 로그인은 Expo Go에서는 동작하지 않는다(redirect 제약) —
 * 개발 빌드(eas build --profile development) 또는 스토어 빌드에서만 동작.
 */
export const GOOGLE_CLIENT_IDS = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? undefined,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? undefined,
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? undefined,
};

/** 클라이언트 ID가 하나라도 설정돼 있으면 버튼 노출. */
export const googleConfigured =
  !!GOOGLE_CLIENT_IDS.ios || !!GOOGLE_CLIENT_IDS.android || !!GOOGLE_CLIENT_IDS.web;
