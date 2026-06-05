import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ACTIVE = '#27E06A';
const INACTIVE = '#7E7E83';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// 활성 탭은 채움(solid) 아이콘 + 초록으로, 비활성은 outline + 회색으로 강조 구분.
const META: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: '홈' },
  workout: { active: 'barbell', inactive: 'barbell-outline', label: '운동' },
  stats: { active: 'stats-chart', inactive: 'stats-chart-outline', label: '통계' },
  calendar: { active: 'calendar', inactive: 'calendar-outline', label: '캘린더' },
  settings: { active: 'settings', inactive: 'settings-outline', label: '설정' },
};

/**
 * 방식 A 하단 탭바 — 벡터 아이콘(Ionicons) + 초록 활성 스타일.
 * 활성 탭은 아이콘 위에 짧은 초록 인디케이터 바가 뜨고, 채움 아이콘 + 초록·굵은 라벨.
 * 하단 safe area는 insets.bottom을 paddingBottom에 더해 홈 인디케이터와 안 겹침.
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
