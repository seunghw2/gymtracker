import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '../store/useStore';
import { scheduleRestEnd, cancelRest } from '../lib/notifications';

const PRESETS = [60, 90, 120];

export default function RestTimer() {
  const {
    restTimerActive, restTimerEnd, restTotalSec, restNextLabel,
    stopRestTimer, adjustRestTimer, setRestTimer,
  } = useWorkoutStore();
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifId = useRef<string | null>(null);

  // 카운트다운
  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const tick = () => {
      const rem = Math.ceil((restTimerEnd - Date.now()) / 1000);
      if (rem <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRemaining(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        stopRestTimer(); // 예약 알림은 취소하지 않음 → 포그라운드 소리/백그라운드 알림 발화
      } else {
        setRemaining(rem);
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [restTimerActive, restTimerEnd]);

  // 알림 (재)예약: 활성/종료시각 변경 시
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
  const progress = restTotalSec > 0 ? Math.max(0, Math.min(1, remaining / restTotalSec)) : 0;

  const handleSkip = () => {
    cancelRest(notifId.current);
    notifId.current = null;
    stopRestTimer();
  };

  return (
    <View style={styles.bar}>
      {/* 진행 바 */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* 본문 */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.label}>휴식 중</Text>
          {restNextLabel ? (
            <Text style={styles.next} numberOfLines={1}>다음: {restNextLabel}</Text>
          ) : null}
        </View>
        <Text style={styles.time}>{`${mins}:${String(secs).padStart(2, '0')}`}</Text>
        <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>

      {/* 조정 + 프리셋 */}
      <View style={styles.controls}>
        <Pressable style={styles.adjBtn} onPress={() => adjustRestTimer(-30)}><Text style={styles.adjText}>-30</Text></Pressable>
        <Pressable style={styles.adjBtn} onPress={() => adjustRestTimer(-10)}><Text style={styles.adjText}>-10</Text></Pressable>
        <Pressable style={styles.adjBtn} onPress={() => adjustRestTimer(10)}><Text style={styles.adjText}>+10</Text></Pressable>
        <Pressable style={styles.adjBtn} onPress={() => adjustRestTimer(30)}><Text style={styles.adjText}>+30</Text></Pressable>
        <View style={styles.divider} />
        {PRESETS.map(p => (
          <Pressable key={p} style={styles.presetBtn} onPress={() => setRestTimer(p)}>
            <Text style={styles.presetText}>{p}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderColor: '#30D158',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#30D158', borderRadius: 3 },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  left: { flex: 1 },
  label: { color: '#30D158', fontSize: 13, fontWeight: '600' },
  next: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  time: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginHorizontal: 12,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
  },
  skipText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adjBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
  },
  adjText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  divider: { width: 1, height: 24, backgroundColor: '#3A3A3C', marginHorizontal: 4 },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1A3D27',
    alignItems: 'center',
  },
  presetText: { color: '#30D158', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
