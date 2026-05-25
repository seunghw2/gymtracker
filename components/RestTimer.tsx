import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore } from '../store/useStore';

type Props = {
  onFinish?: () => void;
};

export default function RestTimer({ onFinish }: Props) {
  const { restTimerActive, restTimerEnd, stopRestTimer } = useWorkoutStore();
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const rem = Math.ceil((restTimerEnd - Date.now()) / 1000);
      if (rem <= 0) {
        clearInterval(intervalRef.current!);
        setRemaining(0);
        stopRestTimer();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFinish?.();
      } else {
        setRemaining(rem);
        if (rem <= 5) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }, 200);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [restTimerActive, restTimerEnd]);

  useEffect(() => {
    if (restTimerActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [restTimerActive]);

  if (!restTimerActive) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <Text style={styles.label}>휴식 중</Text>
      <Text style={styles.time}>{`${mins}:${String(secs).padStart(2, '0')}`}</Text>
      <Pressable onPress={stopRestTimer} style={styles.skipBtn}>
        <Text style={styles.skipText}>건너뛰기</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30D158',
    marginVertical: 12,
  },
  label: {
    color: '#30D158',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  time: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  skipBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#2C2C2E',
  },
  skipText: {
    color: '#8E8E93',
    fontSize: 13,
  },
});
