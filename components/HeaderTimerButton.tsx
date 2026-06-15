import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '../store/useStore';
import { COLORS } from '../constants/colors';

const PRESETS = [30, 60, 90, 120];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * 헤더 우측 휴식 타이머 아이콘 버튼 + 프리셋 바텀시트.
 * 세션과 무관하게 어디서든 startRestTimer로 전역 휴식 타이머를 띄운다.
 */
export default function HeaderTimerButton() {
  const startRestTimer = useWorkoutStore(s => s.startRestTimer);
  const restActive = useWorkoutStore(s => s.restTimerActive);
  const [open, setOpen] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [customSec, setCustomSec] = useState('');

  const start = (sec: number) => {
    if (sec <= 0) return;
    startRestTimer(sec);
    setOpen(false);
    setCustomMin('');
    setCustomSec('');
  };

  const startCustom = () => {
    const m = parseInt(customMin || '0', 10);
    const s = parseInt(customSec || '0', 10);
    start((Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0));
  };

  const customValid = (parseInt(customMin || '0', 10) || 0) * 60 + (parseInt(customSec || '0', 10) || 0) > 0;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={[styles.iconBtn, restActive && styles.iconBtnActive]}
        accessibilityLabel="휴식 타이머"
      >
        <Ionicons name="timer-outline" size={22} color={restActive ? COLORS.greenInk : COLORS.textPrimary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.grip} />
            <Text style={styles.title}>휴식 타이머</Text>

            <View style={styles.presetRow}>
              {PRESETS.map(p => (
                <Pressable key={p} style={styles.presetBtn} onPress={() => start(p)}>
                  <Text style={styles.presetText}>{fmt(p)}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.customLabel}>사용자 정의 타이머 생성</Text>
            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                value={customMin}
                onChangeText={setCustomMin}
                placeholder="분"
                placeholderTextColor="#48484A"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.colon}>:</Text>
              <TextInput
                style={styles.customInput}
                value={customSec}
                onChangeText={setCustomSec}
                placeholder="초"
                placeholderTextColor="#48484A"
                keyboardType="number-pad"
                maxLength={2}
              />
              <Pressable style={[styles.startBtn, !customValid && { opacity: 0.4 }]} onPress={startCustom} disabled={!customValid}>
                <Text style={styles.startBtnText}>시작</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: COLORS.green },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#161618', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 36 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', marginTop: 10, marginBottom: 14 },
  title: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 },

  presetRow: { flexDirection: 'row', gap: 10 },
  presetBtn: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  presetText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },

  customLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 22, marginBottom: 10 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: { width: 64, backgroundColor: '#1C1C1E', borderRadius: 12, paddingVertical: 12, color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  colon: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  startBtn: { flex: 1, backgroundColor: COLORS.green, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginLeft: 4 },
  startBtnText: { color: COLORS.greenInk, fontSize: 16, fontWeight: '800' },
});
