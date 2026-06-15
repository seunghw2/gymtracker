import { Tabs, useSegments } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkoutStore } from '../../store/useStore';
import RestTimerBanner from '../../components/RestTimerBanner';
import ActiveWorkoutBanner from '../../components/ActiveWorkoutBanner';
import CustomTabBar from '../../components/CustomTabBar';
import { TAB_BAR_CONTENT_HEIGHT } from '../../constants/layout';

export default function TabLayout() {
  const workoutActive = useWorkoutStore(s => s.activeSessionId != null);
  const insets = useSafeAreaInsets();
  // 탭바 전체 높이(safe area 포함) — "운동 중" 배너 위치 계산용
  const tabBarH = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);
  // 진행 중 운동이 있고 "운동" 탭이 아닐 때만 전역 배너 표시(운동 탭에선 중복 방지)
  const segments = useSegments();
  const onWorkoutTab = segments[segments.length - 1] === 'workout';
  const bannerVisible = workoutActive && !onWorkoutTab;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="workout" options={{ title: '운동' }} />
      <Tabs.Screen name="stats" options={{ title: '통계' }} />
      <Tabs.Screen name="calendar" options={{ title: '캘린더' }} />
      <Tabs.Screen name="settings" options={{ title: '설정' }} />
    </Tabs>

    {/* 전역 "운동 중" 배너 — 탭 바 바로 위에 도킹, 운동 탭에선 숨김 */}
    {bannerVisible && (
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: tabBarH + 8 }} pointerEvents="box-none">
        <ActiveWorkoutBanner />
      </View>
    )}

    {/* 전역 휴식 타이머 — 상단 진행 배너(상태바 아래), 탭 이동에도 유지 */}
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0 }} pointerEvents="box-none">
      <RestTimerBanner />
    </View>
    </View>
  );
}
