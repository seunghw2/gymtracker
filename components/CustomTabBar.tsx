import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ACCENT } from '../constants/colors';
import { useUiStore } from '../store/useUiStore';

const ACTIVE = ACCENT;
const INACTIVE = '#7E7E83';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// CARBON 탭: 브리핑(홈)·기록·종목·리포트·Chat. 운동은 탭에서 제거(브리핑에서 시작),
// 설정은 브리핑 헤더 ⚙️로 진입. META에 없는 라우트(settings)는 탭바에 렌더되지 않는다.
const META: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  index: { active: 'sparkles', inactive: 'sparkles-outline', label: '브리핑' },
  calendar: { active: 'list', inactive: 'list-outline', label: '기록' },
  exercises: { active: 'barbell', inactive: 'barbell-outline', label: '종목' },
  reports: { active: 'document-text', inactive: 'document-text-outline', label: '리포트' },
  chat: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline', label: 'Chat' },
};

/**
 * CARBON 하단 탭바 — 레드 활성 스타일. 모든 탭(리포트 포함)은 정식 탭 라우트라 navigate로 즉시 전환.
 */
export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unread = useUiStore(s => s.unread);

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
            <View>
              <Ionicons name={focused ? meta.active : meta.inactive} size={26} color={color} />
              {route.name === 'chat' && unread > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>
              )}
            </View>
            <Text style={[styles.label, { color }, focused && styles.labelOn]}>{meta.label}</Text>
          </Pressable>
        );

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
  label: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  labelOn: { fontWeight: '700' },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
