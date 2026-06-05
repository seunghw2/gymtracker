import { Tabs, useSegments } from 'expo-router';
import { Text, View } from 'react-native';
import { useWorkoutStore } from '../../store/useStore';
import { useUiStore } from '../../store/useUiStore';
import RestTimer from '../../components/RestTimer';
import ActiveWorkoutBanner from '../../components/ActiveWorkoutBanner';

// 배너 한 블록이 차지하는 세로 높이(바 44 + 위아래 여백)
const BANNER_BLOCK = 60;

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const workoutActive = useWorkoutStore(s => s.activeSessionId != null);
  // 운동 탭 숫자패드가 떠 있으면 휴식 타이머를 그 위로 올림
  const numPadOpen = useUiStore(s => s.numPadOpen);
  // 탭 바는 운동 중에도 평소 크기(높이 80) 유지
  const tabBarH = 80;
  // 진행 중 운동이 있고 "운동" 탭이 아닐 때만 전역 배너 표시(운동 탭에선 중복 방지)
  const segments = useSegments();
  const onWorkoutTab = segments[segments.length - 1] === 'workout';
  const bannerVisible = workoutActive && !onWorkoutTab;
  // 배너가 떠 있으면 휴식 타이머는 그 위로 한 단계 더 올림
  // 숫자패드(라벨 포함 약 264pt) 위로 휴식 타이머가 확실히 올라오도록 여유를 둠
  const restBottom = numPadOpen ? 276 : tabBarH + (bannerVisible ? BANNER_BLOCK : 0);

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#2C2C2E',
          height: 80,
          paddingBottom: 20,
          paddingTop: 0,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#30D158',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: '운동',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💪" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: '통계',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '캘린더',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
    </Tabs>

    {/* 전역 "운동 중" 배너 — 탭 바 바로 위에 도킹, 운동 탭에선 숨김 */}
    {bannerVisible && (
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: tabBarH + 8 }} pointerEvents="box-none">
        <ActiveWorkoutBanner />
      </View>
    )}

    {/* 전역 휴식 타이머 — 모든 탭 공통, 탭 바/배너/숫자패드 위에 표시 */}
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: restBottom }} pointerEvents="box-none">
      <RestTimer />
    </View>
    </View>
  );
}
