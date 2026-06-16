import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkoutStore } from '../store/useStore';
import { GREEN } from '../constants/colors';
import { useRestRemaining, fmtClock } from '../hooks/useRestRemaining';

/** 경과 초를 mm:ss(1시간 이상이면 h:mm:ss)로 포맷. */
function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/** 접근성용 한국어 경과 시간 라벨. */
function elapsedLabel(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `경과 ${m}분 ${sec}초` : `경과 ${sec}초`;
}

/**
 * 탭바 바로 위에 도킹되는 "운동 중" 전역 배너.
 * 진행 중 운동이 있고, 운동 탭이 아닐 때만 표시한다(표시 여부는 부모가 결정).
 * 경과 시간은 로컬 카운터가 아니라 sessionStartTime으로부터 매초 재계산해
 * 탭 이동·백그라운드 복귀 후에도 정확하다.
 */
export default function ActiveWorkoutBanner() {
  const router = useRouter();
  const startTime = useWorkoutStore(s => s.sessionStartTime);
  const restActive = useWorkoutStore(s => s.restTimerActive);
  const restEnd = useWorkoutStore(s => s.restTimerEnd);
  const stopRestTimer = useWorkoutStore(s => s.stopRestTimer);
  const restRemaining = useRestRemaining(restActive, restEnd);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;

  // 매초 갱신 (시작 시각 기준 계산이므로 드리프트 없음)
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  // 초록 점 펄스
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const elapsedSec = startTime ? (now - startTime) / 1000 : 0;
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });

  return (
    <Pressable
      style={styles.bar}
      onPress={() => router.navigate('/workout')}
      accessibilityRole="button"
      accessibilityLabel={`운동으로 돌아가기, ${elapsedLabel(elapsedSec)}`}
    >
      <View style={styles.dotWrap}>
        <Animated.View style={[styles.dot, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]} />
      </View>
      {restActive ? (
        <>
          <Text style={styles.label}>휴식</Text>
          <Text style={styles.time}>{fmtClock(restRemaining)}</Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); stopRestTimer(); }}
            hitSlop={8}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>건너뛰기 ✕</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>운동 중</Text>
          <Text style={styles.time}>{formatElapsed(elapsedSec)}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.cta}>탭하여 돌아가기 ›</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#2A1113',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginRight: 10 },
  time: { color: GREEN, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cta: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  skipBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  skipText: { color: '#8E8E93', fontSize: 12, fontWeight: '700' },
});
