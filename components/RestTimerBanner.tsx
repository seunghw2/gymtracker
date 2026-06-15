import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore, useSettingsStore } from '../store/useStore';
import { scheduleRestEnd, cancelRest } from '../lib/notifications';
import { playRestDoneSound, startRestKeepAlive, stopRestKeepAlive } from '../lib/sound';
import { COLORS } from '../constants/colors';

/**
 * 전역 휴식 타이머 상단 배너 (상태바 아래 얇은 진행 바).
 * 카운트다운·햅틱·사운드·로컬알림 로직은 기존 RestTimer와 동일하게 useWorkoutStore의
 * rest 상태를 그대로 재사용한다. 세션 여부와 무관하게 restTimerActive면 표시된다.
 */
export default function RestTimerBanner() {
  const { restTimerActive, restTimerEnd, restTotalSec, restNextLabel, stopRestTimer } = useWorkoutStore();
  const insets = useSafeAreaInsets();
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifId = useRef<string | null>(null);

  // 카운트다운
  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopRestKeepAlive();
      cancelRest(notifId.current);
      notifId.current = null;
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

  const handleSkip = () => {
    cancelRest(notifId.current);
    notifId.current = null;
    stopRestKeepAlive();
    stopRestTimer();
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          휴식 중{restNextLabel ? ` · 다음 ${restNextLabel}` : ''}
        </Text>
        <View style={styles.right}>
          <Text style={styles.time}>{timeStr}</Text>
          <Pressable style={styles.skip} onPress={handleSkip} hitSlop={8}>
            <Text style={styles.skipText}>건너뛰기 ✕</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#1C1C1E', borderBottomWidth: 1, borderBottomColor: '#2C2C2E' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  label: { color: COLORS.green, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  skip: { backgroundColor: '#2C2C2E', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  track: { height: 3, backgroundColor: '#2C2C2E' },
  fill: { height: '100%', backgroundColor: COLORS.green },
});
