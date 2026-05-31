import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  PanGestureHandler,
  State,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

type Props = {
  initial: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unitLabel?: string;
};

const ITEM_W = 9; // 눈금 간격(px) — 드래그 민감도

export default function RulerPicker({ initial, onChange, min = 30, max = 200, step = 0.1 }: Props) {
  const [width, setWidth] = useState(0);
  const [value, setValue] = useState(initial);
  const startVal = useRef(initial);

  useEffect(() => { setValue(initial); }, [initial]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const round1 = (v: number) => Math.round(v * 10) / 10;

  const onGesture = (e: PanGestureHandlerGestureEvent) => {
    const dx = e.nativeEvent.translationX;
    // 왼쪽으로 끌면(dx<0) 값 증가
    const v = round1(clamp(startVal.current - (dx / ITEM_W) * step));
    setValue(v);
    onChange(v);
  };

  const onStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.state === State.BEGAN) {
      startVal.current = value;
    }
  };

  // 현재 값 기준으로 화면에 보이는 눈금만 그린다
  const ticks: React.ReactNode[] = [];
  if (width > 0) {
    const perUnit = Math.round(1 / step);     // 1단위(=1kg)마다 큰 눈금/라벨
    const perHalf = Math.round(0.5 / step);   // 0.5단위 중간 눈금
    const centerPos = (value - min) / step;   // 현재 값의 인덱스 위치
    const half = Math.ceil((width / ITEM_W) / 2) + 2;
    const startIdx = Math.max(0, Math.floor(centerPos - half));
    const endIdx = Math.min(Math.round((max - min) / step), Math.ceil(centerPos + half));
    for (let i = startIdx; i <= endIdx; i++) {
      const x = width / 2 + (i - centerPos) * ITEM_W;
      const isMajor = i % perUnit === 0;
      const isMid = i % perHalf === 0;
      ticks.push(
        <View key={i} style={[styles.tickCol, { left: x - 0.75 }]} pointerEvents="none">
          <View style={[styles.tick, isMajor ? styles.tickMajor : isMid ? styles.tickMid : styles.tickMinor]} />
          {isMajor ? <Text style={styles.tickLabel}>{Math.round(min + i * step)}</Text> : null}
        </View>
      );
    }
  }

  return (
    <PanGestureHandler onGestureEvent={onGesture} onHandlerStateChange={onStateChange}>
      <View style={styles.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {ticks}
        <View pointerEvents="none" style={styles.indicator}>
          <View style={styles.triangle} />
          <View style={styles.indicatorLine} />
        </View>
      </View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 76, alignSelf: 'stretch', marginVertical: 12, overflow: 'hidden' },
  tickCol: { position: 'absolute', top: 0, width: 1.5, alignItems: 'center' },
  tick: { width: 1.5, backgroundColor: '#48484A', borderRadius: 1 },
  tickMinor: { height: 18 },
  tickMid: { height: 28, backgroundColor: '#6E6E73' },
  tickMajor: { height: 38, backgroundColor: '#8E8E93' },
  tickLabel: { color: '#8E8E93', fontSize: 12, marginTop: 4, position: 'absolute', top: 40, width: 40, textAlign: 'center', left: -19 },
  indicator: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  triangle: {
    width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid',
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#5E5CE6',
  },
  indicatorLine: { width: 2, height: 40, backgroundColor: '#5E5CE6', borderRadius: 1 },
});
