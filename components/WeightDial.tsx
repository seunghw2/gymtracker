import React, { useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export default function WeightDial({ value, onChange, min = 30, max = 200, step = 0.1 }: Props) {
  const lastX = useRef<number | null>(null);
  const accumulated = useRef(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gestureState) => {
      lastX.current = gestureState.x0;
      accumulated.current = 0;
    },
    onPanResponderMove: (_, gestureState) => {
      const dx = gestureState.moveX - (lastX.current ?? gestureState.moveX);
      lastX.current = gestureState.moveX;
      accumulated.current += dx;

      const steps = Math.trunc(accumulated.current / 8);
      if (steps !== 0) {
        accumulated.current -= steps * 8;
        const newVal = Math.round((value + steps * step) * 10) / 10;
        const clamped = Math.min(max, Math.max(min, newVal));
        if (clamped !== value) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(clamped);
        }
      }
    },
    onPanResponderRelease: () => {
      lastX.current = null;
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>체중</Text>
      <View style={styles.dialRow} {...panResponder.panHandlers}>
        <Text style={styles.arrow}>{'◀'}</Text>
        <View style={styles.valueBox}>
          <Text style={styles.value}>{value.toFixed(1)}</Text>
          <Text style={styles.unit}>kg</Text>
        </View>
        <Text style={styles.arrow}>{'▶'}</Text>
      </View>
      <Text style={styles.hint}>좌우로 드래그하여 조절</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    color: '#8E8E93',
    fontSize: 13,
    marginBottom: 8,
  },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  arrow: {
    color: '#30D158',
    fontSize: 20,
  },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 100,
    justifyContent: 'center',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: '#8E8E93',
    fontSize: 20,
    marginBottom: 8,
  },
  hint: {
    color: '#48484A',
    fontSize: 11,
    marginTop: 4,
  },
});
