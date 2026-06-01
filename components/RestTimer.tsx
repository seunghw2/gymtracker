import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager, Animated, PanResponder, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore, useSettingsStore } from '../store/useStore';
import { scheduleRestEnd, cancelRest } from '../lib/notifications';
import { playRestDoneSound, startRestKeepAlive, stopRestKeepAlive } from '../lib/sound';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Ring({ progress, size, stroke }: { progress: number; size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#2C2C2E" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#30D158" strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function RestTimer() {
  const {
    restTimerActive, restTimerEnd, restTotalSec, restNextLabel,
    stopRestTimer, adjustRestTimer,
  } = useWorkoutStore();
  const [remaining, setRemaining] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifId = useRef<string | null>(null);

  // 드래그로 위치 이동
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panVal = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const id = pan.addListener(v => { panVal.current = v; });
    return () => pan.removeListener(id);
  }, [pan]);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderGrant: () => { pan.setOffset(panVal.current); pan.setValue({ x: 0, y: 0 }); },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // 화면 밖으로 사라지지 않게 클램프
        const { width, height } = Dimensions.get('window');
        const x = Math.max(-(width / 2 - 60), Math.min(width / 2 - 60, panVal.current.x));
        const y = Math.max(-(height - 200), Math.min(40, panVal.current.y));
        Animated.spring(pan, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start();
      },
    })
  ).current;

  // 카운트다운
  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopRestKeepAlive();
      return;
    }
    if (useSettingsStore.getState().soundOnSilent) startRestKeepAlive();
    const tick = () => {
      const rem = Math.ceil((restTimerEnd - Date.now()) / 1000);
      if (rem <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRemaining(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (useSettingsStore.getState().soundOnSilent) playRestDoneSound();
        stopRestKeepAlive();
        stopRestTimer();
      } else {
        setRemaining(rem);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [restTimerActive, restTimerEnd]);

  // 알림 (재)예약
  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) return;
    let cancelled = false;
    const prev = notifId.current;
    const secs = Math.max(0, Math.round((restTimerEnd - Date.now()) / 1000));
    (async () => {
      await cancelRest(prev);
      if (cancelled) return;
      notifId.current = await scheduleRestEnd(secs);
    })();
    return () => { cancelled = true; };
  }, [restTimerActive, restTimerEnd]);

  if (!restTimerActive) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const progress = restTotalSec > 0 ? Math.max(0, Math.min(1, remaining / restTotalSec)) : 0;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setExpanded(e => !e);
  };

  const handleSkip = () => {
    cancelRest(notifId.current);
    notifId.current = null;
    stopRestKeepAlive();
    setExpanded(false);
    stopRestTimer();
  };

  const inner = !expanded ? (
    // 접힌 상태: 작은 알약
    <Pressable style={styles.pill} onPress={toggle}>
      <Ring progress={progress} size={34} stroke={4} />
      <Text style={styles.pillTime}>{timeStr}</Text>
      <Pressable style={styles.skipPrimary} onPress={handleSkip} hitSlop={8}>
        <Text style={styles.skipPrimaryText}>건너뛰기</Text>
      </Pressable>
    </Pressable>
  ) : (
    // 펼친 상태: 카드
    <Pressable style={styles.card} onPress={toggle}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.cardRow}>
        <Ring progress={progress} size={64} stroke={6} />
        <View style={styles.cardCenter}>
          <Text style={styles.bigTime}>{timeStr}</Text>
          <Text style={styles.restLabel} numberOfLines={1}>
            휴식 중{restNextLabel ? ` · 다음 ${restNextLabel}` : ''}
          </Text>
        </View>
        <Pressable style={styles.skipSecondary} onPress={handleSkip} hitSlop={8}>
          <Text style={styles.skipSecondaryText}>건너뛰기</Text>
        </Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.adjBtn} onPress={() => adjustRestTimer(-10)}><Text style={styles.adjText}>−10</Text></Pressable>
        <Pressable style={styles.adjBtn} onPress={() => adjustRestTimer(10)}><Text style={styles.adjText}>+10</Text></Pressable>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.dockCenter} pointerEvents="box-none">
      <Animated.View
        style={{ alignSelf: 'stretch', alignItems: 'center', transform: pan.getTranslateTransform() }}
        {...panResponder.panHandlers}
      >
        {inner}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockCenter: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },

  // 접힘
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 30,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  pillTime: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  skipPrimary: { backgroundColor: '#30D158', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  skipPrimaryText: { color: '#000000', fontSize: 14, fontWeight: '700' },

  // 펼침
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30D158',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
  },
  progressTrack: { height: 5, backgroundColor: '#2C2C2E', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#30D158', borderRadius: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  cardCenter: { flex: 1 },
  bigTime: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  restLabel: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  skipSecondary: { backgroundColor: '#2C2C2E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  skipSecondaryText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },

  controls: { flexDirection: 'row', gap: 10 },
  adjBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2C2C2E', alignItems: 'center' },
  adjText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
