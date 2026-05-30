import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  onStep: (delta: 1 | -1) => void;
  onDone: () => void;
  onNext?: () => void;
  allowDecimal?: boolean;
  label?: string;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export default function NumPad({ onKey, onBackspace, onStep, onDone, onNext, allowDecimal, label }: Props) {
  const tap = (fn: () => void) => () => { Haptics.selectionAsync(); fn(); };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.body}>
        {/* 왼쪽: 숫자 그리드 */}
        <View style={styles.grid}>
          {ROWS.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map(k => (
                <Pressable key={k} style={styles.key} onPress={tap(() => onKey(k))}>
                  <Text style={styles.keyText}>{k}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={styles.gridRow}>
            <Pressable style={styles.key} onPress={tap(() => allowDecimal && onKey('.'))} disabled={!allowDecimal}>
              <Text style={[styles.keyText, !allowDecimal && styles.keyDisabled]}>.</Text>
            </Pressable>
            <Pressable style={styles.key} onPress={tap(() => onKey('0'))}>
              <Text style={styles.keyText}>0</Text>
            </Pressable>
            <Pressable style={styles.key} onPress={tap(onBackspace)}>
              <Text style={styles.keyText}>⌫</Text>
            </Pressable>
          </View>
        </View>

        {/* 오른쪽: 기능 열 */}
        <View style={styles.side}>
          <Pressable style={[styles.sideBtn, styles.doneBtn]} onPress={tap(onDone)}>
            <Text style={styles.doneText}>완료</Text>
          </Pressable>
          <View style={styles.stepRow}>
            <Pressable style={[styles.sideBtn, styles.stepBtn]} onPress={tap(() => onStep(-1))}>
              <Text style={styles.sideText}>−</Text>
            </Pressable>
            <Pressable style={[styles.sideBtn, styles.stepBtn]} onPress={tap(() => onStep(1))}>
              <Text style={styles.sideText}>＋</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.sideBtn, styles.nextBtn, !onNext && styles.nextDisabled]}
            onPress={tap(() => onNext && onNext())}
            disabled={!onNext}
          >
            <Text style={styles.nextText}>다음</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const KEY_H = 48;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 22,
  },
  label: { color: '#8E8E93', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  body: { flexDirection: 'row', gap: 6 },
  grid: { flex: 1 },
  gridRow: { flexDirection: 'row' },
  key: { flex: 1, height: KEY_H, margin: 3, borderRadius: 8, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  keyText: { color: '#FFFFFF', fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  keyDisabled: { color: '#48484A' },

  side: { width: 96 },
  sideBtn: { height: KEY_H, margin: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sideText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  doneBtn: { backgroundColor: '#3A3A3C' },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  stepRow: { flexDirection: 'row' },
  stepBtn: { flex: 1, backgroundColor: '#2C2C2E' },
  nextBtn: { backgroundColor: '#30D158' },
  nextDisabled: { backgroundColor: '#2C2C2E' },
  nextText: { color: '#000000', fontSize: 16, fontWeight: '700' },
});
