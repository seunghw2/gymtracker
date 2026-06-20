import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { configureNotifications, ensurePermission } from '../lib/notifications';
import { refreshWorkoutReminder, refreshWeeklyCoachNotification } from '../lib/reminders';
import { registerForPushNotifications } from '../lib/push';
import { configureAudio } from '../lib/sound';
import NotificationBridge from '../components/NotificationBridge';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { status, bootstrap } = useAuthStore();

  useEffect(() => {
    bootstrap();
    configureNotifications();
    configureAudio();
    ensurePermission();
  }, []);

  // 로그인되면 운동 리마인더 재예약 + 원격 푸시 토큰 등록(개발 빌드에서만 동작)
  useEffect(() => {
    if (status === 'authenticated') {
      refreshWorkoutReminder().catch(() => {});
      refreshWeeklyCoachNotification().catch(() => {});
      registerForPushNotifications().catch(() => {});
    }
  }, [status]);

  useEffect(() => {
    if (status === 'unknown') return;

    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup = firstSegment === '(auth)';

    // 미로그인 → 로그인 화면으로, 로그인 완료 → 탭으로
    if (status === 'guest' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [status, segments]);

  if (status === 'unknown') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF3B30" size="large" />
      </View>
    );
  }

  return (
    // initialWindowMetrics: 앱 시작 시점에 캡처된 안전영역 값을 첫 프레임부터 제공해
    // 화면 진입 시 인셋이 뒤늦게 적용되며 콘텐츠가 "툭" 내려오는 점프를 제거한다.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        {status === 'authenticated' && <NotificationBridge />}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercise-add" options={{ presentation: 'modal' }} />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
