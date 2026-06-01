import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useWorkoutStore } from '../../store/useStore';
import { useUiStore } from '../../store/useUiStore';
import RestTimer from '../../components/RestTimer';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabLayout() {
  // 운동 진행 중에는 탭 바를 얇게(아이콘만) 해 화면을 넓게 쓴다
  const workoutActive = useWorkoutStore(s => s.activeSessionId != null);
  // 운동 탭 숫자패드가 떠 있으면 휴식 타이머를 그 위로 올림
  const numPadOpen = useUiStore(s => s.numPadOpen);
  const tabBarH = workoutActive ? 50 : 80;
  const restBottom = numPadOpen ? 252 : tabBarH;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#2C2C2E',
          height: workoutActive ? 50 : 80,
          paddingBottom: workoutActive ? 6 : 20,
          paddingTop: workoutActive ? 4 : 0,
        },
        tabBarShowLabel: !workoutActive,
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

    {/* 전역 휴식 타이머 — 모든 탭 공통, 탭 바(또는 숫자패드) 위에 표시 */}
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: restBottom }} pointerEvents="box-none">
      <RestTimer />
    </View>
    </View>
  );
}
