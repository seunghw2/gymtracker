import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { ACCENT, SEM } from '../constants/colors';
import { useUiStore } from '../store/useUiStore';
import { useWorkoutStore } from '../store/useStore';
import { createWorkoutSession } from '../db/queries';
import { todayStr as getTodayStr } from '../lib/date';

const ACTIVE = ACCENT;
const INACTIVE = '#7E7E83';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Chat 탭은 META에서 제외(탭바 숨김, 라우트는 유지 — 채팅 FAB에서 navigate 가능)
const META: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  index:     { active: 'sparkles',       inactive: 'sparkles-outline',       label: '홈' },
  calendar:  { active: 'list',           inactive: 'list-outline',           label: '기록' },
  exercises: { active: 'barbell',        inactive: 'barbell-outline',        label: '종목' },
  reports:   { active: 'document-text',  inactive: 'document-text-outline',  label: '리포트' },
};

// 탭 순서: 홈, 기록, [▶ 가운데], 종목, 리포트
const LEFT_TABS  = ['index', 'calendar'];
const RIGHT_TABS = ['exercises', 'reports'];

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { startSession } = useWorkoutStore();
  const [sheetOpen, setSheetOpen] = useState(false);

  const renderTab = (routeName: string) => {
    const idx = state.routes.findIndex(r => r.name === routeName);
    if (idx === -1) return null;
    const route = state.routes[idx];
    const meta = META[route.name];
    if (!meta) return null;
    const focused = state.index === idx;
    const color = focused ? ACTIVE : INACTIVE;

    return (
      <Pressable
        key={route.key}
        style={styles.tab}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
      >
        <View style={[styles.indicator, focused && styles.indicatorOn]} />
        <Ionicons name={focused ? meta.active : meta.inactive} size={26} color={color} />
        <Text style={[styles.label, { color }, focused && styles.labelOn]}>{meta.label}</Text>
      </Pressable>
    );
  };

  const handleStartEmpty = async () => {
    setSheetOpen(false);
    const date = getTodayStr();
    const sessionId = await createWorkoutSession(date, '');
    startSession(sessionId, date, null);
    router.navigate('/workout');
  };

  const handleStartTemplate = () => {
    setSheetOpen(false);
    router.navigate('/templates');
  };

  const handleStartHistory = () => {
    setSheetOpen(false);
    router.navigate({ pathname: '/workout', params: { start: 'history' } });
  };

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {LEFT_TABS.map(renderTab)}

        {/* 가운데 큰 플레이 버튼 */}
        <View style={styles.playWrap}>
          <Pressable style={styles.playBtn} onPress={() => setSheetOpen(true)}>
            <Ionicons name="play" size={26} color="#fff" />
          </Pressable>
        </View>

        {RIGHT_TABS.map(renderTab)}
      </View>

      {/* 운동 시작 바텀시트 */}
      <Modal visible={sheetOpen} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setSheetOpen(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>운동 시작</Text>

          <Pressable style={styles.option} onPress={handleStartTemplate}>
            <Ionicons name="copy-outline" size={20} color={ACTIVE} style={styles.optIcon} />
            <View>
              <Text style={styles.optT}>템플릿으로 시작</Text>
              <Text style={styles.optSub}>저장한 루틴 불러오기</Text>
            </View>
          </Pressable>

          <Pressable style={styles.option} onPress={handleStartHistory}>
            <Ionicons name="time-outline" size={20} color={ACTIVE} style={styles.optIcon} />
            <View>
              <Text style={styles.optT}>기존 운동 기록으로 시작</Text>
              <Text style={styles.optSub}>지난 운동 복사해서 시작</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.option, styles.optionLast]} onPress={handleStartEmpty}>
            <Ionicons name="add-circle-outline" size={20} color={INACTIVE} style={styles.optIcon} />
            <View>
              <Text style={[styles.optT, { color: SEM.muted }]}>빈 운동으로 시작</Text>
              <Text style={styles.optSub}>종목 직접 추가</Text>
            </View>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
    paddingTop: 8,
    alignItems: 'flex-start',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 44, gap: 3 },
  indicator: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorOn: { backgroundColor: ACTIVE },
  label: { fontSize: 11, fontWeight: '500' },
  labelOn: { fontWeight: '700' },

  playWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 4 },
  playBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: ACTIVE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ACTIVE, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#111113',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3a3a3c', alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 13, fontWeight: '700', color: SEM.muted, marginBottom: 8, letterSpacing: 0.3 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#1c1c1f',
  },
  optionLast: {},
  optIcon: { width: 24 },
  optT: { fontSize: 15, fontWeight: '700', color: '#fff' },
  optSub: { fontSize: 12, color: SEM.muted, marginTop: 2 },
});
