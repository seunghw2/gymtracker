import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/useAuthStore';
import { configureNotifications, ensurePermission } from '../lib/notifications';
import { refreshWorkoutReminder } from '../lib/reminders';
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

  // 로그인되면 운동 리마인더를 마지막 운동일 기준으로 재예약
  useEffect(() => {
    if (status === 'authenticated') refreshWorkoutReminder().catch(() => {});
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
  );
}
