import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/useAuthStore';
import { configureNotifications, ensurePermission } from '../lib/notifications';
import { configureAudio } from '../lib/sound';

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
        <ActivityIndicator color="#30D158" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exercise-add" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
