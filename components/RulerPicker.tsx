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
  /** 큰 눈금/라벨 간격(값 단위). 기본 1 */
  majorEvery?: number;
  /** 중간 눈금 간격(값 단위). 기본 majorEvery/2 */
  midEvery?: number;
  /** 라벨 표기. 기본 반올림 정수 */
  format?: (v: number) => string;
};

const ITEM_W = 9; // 눈금 간격(px) — 드래그 민감도

export default function RulerPicker({ initial, onChange, min = 30, max = 200, step = 0.1, majorEvery = 1, midEvery, format }: Props) {
  const [width, setWidth] = useState(0);
  const [value, setValue] = useState(initial);
  const startVal = useRef(initial);

  useEffect(() => { setValue(initial); }, [initial]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // step 단위로 스냅(부동소수 보정)
  const snap = (v: number) => Math.round(Math.round(v / step) * step * 1000) / 1000;

  const onGesture = (e: PanGestureHandlerGestureEvent) => {
    const dx = e.nativeEvent.translationX;
    // 왼쪽으로 끌면(dx<0) 값 증가
    const v = snap(clamp(startVal.current - (dx / ITEM_W) * step));
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
    const perUnit = Math.max(1, Math.round(majorEvery / step));            // 큰 눈금/라벨
    const perHalf = Math.max(1, Math.round((midEvery ?? majorEvery / 2) / step)); // 중간 눈금
    const centerPos = (value - min) / step;   // 현재 값의 인덱스 위치
    const half = Math.ceil((width / ITEM_W) / 2) + 2;
    const startIdx = Math.max(0, Math.floor(centerPos - half));
    const endIdx = Math.min(Math.round((max - min) / step), Math.ceil(centerPos + half));
    for (let i = startIdx; i <= endIdx; i++) {
      const x = width / 2 + (i - centerPos) * ITEM_W;
      const isMajor = i % perUnit === 0;
      const isMid = i % perHalf === 0;
      const labelVal = min + i * step;
      ticks.push(
        <View key={i} style={[styles.tickCol, { left: x - 0.75 }]} pointerEvents="none">
          <View style={[styles.tick, isMajor ? styles.tickMajor : isMid ? styles.tickMid : styles.tickMinor]} />
          {isMajor ? <Text style={styles.tickLabel}>{format ? format(labelVal) : String(Math.round(labelVal))}</Text> : null}
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
