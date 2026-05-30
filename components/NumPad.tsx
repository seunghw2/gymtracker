import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  onDone: () => void;
  onNext?: () => void;
  allowDecimal?: boolean;
  label?: string;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function NumPad({ onKey, onBackspace, onDone, onNext, allowDecimal, label }: Props) {
  const press = (fn: () => void) => () => { Haptics.selectionAsync(); fn(); };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.grid}>
        {KEYS.map(k => (
          <Pressable key={k} style={styles.key} onPress={press(() => onKey(k))}>
            <Text style={styles.keyText}>{k}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.key} onPress={press(() => allowDecimal && onKey('.'))} disabled={!allowDecimal}>
          <Text style={[styles.keyText, !allowDecimal && styles.keyDisabled]}>.</Text>
        </Pressable>
        <Pressable style={styles.key} onPress={press(() => onKey('0'))}>
          <Text style={styles.keyText}>0</Text>
        </Pressable>
        <Pressable style={styles.key} onPress={press(onBackspace)}>
          <Text style={styles.keyText}>⌫</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        {onNext ? (
          <Pressable style={[styles.actionBtn, styles.nextBtn]} onPress={press(onNext)}>
            <Text style={styles.nextText}>다음</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.actionBtn, styles.doneBtn]} onPress={press(onDone)}>
          <Text style={styles.doneText}>완료</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 20,
  },
  label: { color: '#8E8E93', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  key: {
    width: '33.33%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: '#FFFFFF', fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  keyDisabled: { color: '#3A3A3C' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  nextBtn: { backgroundColor: '#2C2C2E' },
  nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  doneBtn: { backgroundColor: '#30D158' },
  doneText: { color: '#000000', fontSize: 16, fontWeight: '700' },
});
