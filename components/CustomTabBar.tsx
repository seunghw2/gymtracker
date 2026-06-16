import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ACCENT } from '../constants/colors';

const ACTIVE = ACCENT;
const INACTIVE = '#7E7E83';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// CARBON 4탭: 브리핑(홈)·운동·기록·통계. 설정은 탭에서 빼고 브리핑 헤더 ⚙️로 진입.
// META에 없는 라우트(settings)는 탭바에 렌더되지 않는다.
const META: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  index: { active: 'sparkles', inactive: 'sparkles-outline', label: '브리핑' },
  workout: { active: 'barbell', inactive: 'barbell-outline', label: '운동' },
  calendar: { active: 'list', inactive: 'list-outline', label: '기록' },
  stats: { active: 'stats-chart', inactive: 'stats-chart-outline', label: '통계' },
};

/**
 * CARBON 하단 탭바 — 레드 활성 스타일. 활성 탭은 상단 짧은 레드 인디케이터 + 채움 아이콘 + 굵은 라벨.
 */
export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

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

        return (
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
  label: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  labelOn: { fontWeight: '700' },
});
