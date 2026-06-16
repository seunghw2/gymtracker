import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AI } from '../constants/colors';

const ACTIVE = '#27E06A';
const INACTIVE = '#7E7E83';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// 활성 탭은 채움(solid) 아이콘 + 초록으로, 비활성은 outline + 회색으로 강조 구분.
// calendar는 탭바에서 제외(홈 우측 하단 FAB로 진입). 대신 AI 항목을 별도로 끼워 넣는다.
const META: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: '홈' },
  workout: { active: 'barbell', inactive: 'barbell-outline', label: '운동' },
  stats: { active: 'stats-chart', inactive: 'stats-chart-outline', label: '통계' },
  settings: { active: 'settings', inactive: 'settings-outline', label: '설정' },
};

/**
 * 방식 A 하단 탭바 — 벡터 아이콘(Ionicons) + 초록 활성 스타일.
 * 활성 탭은 아이콘 위에 짧은 초록 인디케이터 바가 뜨고, 채움 아이콘 + 초록·굵은 라벨.
 * 하단 safe area는 insets.bottom을 paddingBottom에 더해 홈 인디케이터와 안 겹침.
 */
export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  // AI 화면은 (tabs) 밖 별도 스택(app/ai)이라 탭 state엔 안 잡힘 → segment로 활성 판단.
  const aiActive = (segments as string[]).includes('ai');

  // AI 탭 — 보라 액센트. 누르면 app/ai 스택으로 진입.
  const aiColor = aiActive ? AI.accent : INACTIVE;
  const aiTab = (
    <Pressable
      key="__ai"
      style={styles.tab}
      onPress={() => router.push('/ai')}
      accessibilityRole="button"
      accessibilityState={{ selected: aiActive }}
      accessibilityLabel="AI"
    >
      <View style={[styles.indicator, aiActive && styles.aiIndicatorOn]} />
      <Ionicons name={aiActive ? 'sparkles' : 'sparkles-outline'} size={26} color={aiColor} />
      <Text style={[styles.label, { color: aiColor }, aiActive && styles.labelOn]}>AI</Text>
    </Pressable>
  );

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, idx) => {
        const meta = META[route.name];
        if (!meta) return null;
        const focused = state.index === idx;
        const color = focused ? ACTIVE : INACTIVE;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        const tab = (
          <Pressable
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
          >
            <View style={[styles.indicator, focused && styles.indicatorOn]} />
            <Ionicons name={focused ? meta.active : meta.inactive} size={26} color={color} />
            <Text style={[styles.label, { color }, focused && styles.labelOn]}>{meta.label}</Text>
          </Pressable>
        );

        // 통계 다음(설정 앞)에 AI 탭을 끼워 넣는다.
        if (route.name === 'stats') {
          return <React.Fragment key={route.key}>{tab}{aiTab}</React.Fragment>;
        }
        return tab;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 44 },
  indicator: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
  indicatorOn: { backgroundColor: ACTIVE },
  aiIndicatorOn: { backgroundColor: AI.accent },
  label: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  labelOn: { fontWeight: '700' },
});
