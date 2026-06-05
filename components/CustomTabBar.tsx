import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Dumbbell, BarChart3, Calendar, Settings, type LucideIcon } from 'lucide-react-native';

const ACTIVE = '#27E06A';
const INACTIVE = '#7E7E83';

const META: Record<string, { Icon: LucideIcon; label: string }> = {
  index: { Icon: Home, label: '홈' },
  workout: { Icon: Dumbbell, label: '운동' },
  stats: { Icon: BarChart3, label: '통계' },
  calendar: { Icon: Calendar, label: '캘린더' },
  settings: { Icon: Settings, label: '설정' },
};

/**
 * 방식 A 하단 탭바 — 벡터 아이콘(lucide) + 초록 활성 스타일.
 * 활성 탭은 아이콘 위에 짧은 초록 인디케이터 바가 뜨고, 아이콘/라벨이 초록·굵게.
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
        const { Icon, label } = meta;

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
            accessibilityLabel={label}
          >
            <View style={[styles.indicator, focused && styles.indicatorOn]} />
            <Icon size={26} color={color} strokeWidth={focused ? 2.2 : 1.9} />
            <Text style={[styles.label, { color }, focused && styles.labelOn]}>{label}</Text>
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
