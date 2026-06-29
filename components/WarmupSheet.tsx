import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { toDisplay, fromInput, unitLabel } from '../lib/units';
import { styles } from '../app/workout.styles';

type WarmupRow = { percent: string; reps: string };

const round = (kg: number) => Math.max(0, Math.round(kg / 2.5) * 2.5);

type Props = {
  visible: boolean;
  /** 기준 무게(kg) — 부모가 현재 세트에서 계산해 전달 */
  baseWeight: number;
  unitKg: boolean;
  onClose: () => void;
  onApply: (warmups: { weight_kg: number; reps: number }[]) => void;
};

/**
 * 워밍업 단계(기준 무게 대비 %/횟수) 설정 시트.
 * 단계 편집은 내부 상태로 관리하고, "추가" 시 계산된 워밍업 세트만 부모에 넘긴다(workout.tsx에서 분리).
 */
export default function WarmupSheet({ visible, baseWeight, unitKg, onClose, onApply }: Props) {
  const u = unitLabel(unitKg);
  const weightStep = unitKg ? 2.5 : 5;
  const [base, setBase] = useState(baseWeight);
  const [rows, setRows] = useState<WarmupRow[]>([]);

  useEffect(() => {
    if (visible) {
      setBase(baseWeight);
      setRows([
        { percent: '40', reps: '10' },
        { percent: '60', reps: '6' },
        { percent: '80', reps: '3' },
      ]);
    }
  }, [visible, baseWeight]);

  const apply = () => {
    const warmups = rows
      .map(r => ({ pct: parseFloat(r.percent) || 0, reps: parseInt(r.reps) || 0 }))
      .filter(r => r.pct > 0 && r.reps > 0)
      .map(r => ({ weight_kg: round(base * r.pct / 100), reps: r.reps }));
    if (warmups.length > 0) onApply(warmups);
    Haptics.selectionAsync();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.gymBackdrop} onPress={onClose}>
        <Pressable style={styles.warmupSheet} onPress={() => {}}>
          <Text style={styles.warmupTitle}>워밍업 설정</Text>
          <View style={styles.warmupBaseRow}>
            <Text style={styles.warmupBaseLabel}>기준 무게</Text>
            <View style={styles.warmupStepper}>
              <Pressable style={styles.stepBtn} onPress={() => setBase(b => Math.max(0, fromInput(toDisplay(b, unitKg) - weightStep, unitKg)))} hitSlop={4}><Text style={styles.stepText}>−</Text></Pressable>
              <Text style={styles.warmupValue}>{toDisplay(base, unitKg)}{u}</Text>
              <Pressable style={styles.stepBtn} onPress={() => setBase(b => fromInput(toDisplay(b, unitKg) + weightStep, unitKg))} hitSlop={4}><Text style={styles.stepText}>+</Text></Pressable>
            </View>
          </View>
          <Text style={styles.warmupHint}>기준 무게 대비 % · 횟수 (아래 미리보기 적용 무게)</Text>
          {rows.map((row, i) => {
            const pct = parseFloat(row.percent) || 0;
            const applied = toDisplay(round(base * pct / 100), unitKg);
            const adj = (field: 'percent' | 'reps', delta: number, min: number, max: number) =>
              setRows(rs => rs.map((r, j) => {
                if (j !== i) return r;
                const cur = parseInt(r[field]) || 0;
                return { ...r, [field]: String(Math.min(max, Math.max(min, cur + delta))) };
              }));
            return (
              <View key={i} style={styles.warmupRow}>
                <View style={styles.warmupStepper}>
                  <Pressable style={styles.stepBtn} onPress={() => adj('percent', -5, 5, 100)} hitSlop={4}><Text style={styles.stepText}>−</Text></Pressable>
                  <Text style={styles.warmupValue}>{row.percent}%</Text>
                  <Pressable style={styles.stepBtn} onPress={() => adj('percent', 5, 5, 100)} hitSlop={4}><Text style={styles.stepText}>+</Text></Pressable>
                </View>
                <View style={styles.warmupStepper}>
                  <Pressable style={styles.stepBtn} onPress={() => adj('reps', -1, 1, 30)} hitSlop={4}><Text style={styles.stepText}>−</Text></Pressable>
                  <Text style={styles.warmupValue}>{row.reps}회</Text>
                  <Pressable style={styles.stepBtn} onPress={() => adj('reps', 1, 1, 30)} hitSlop={4}><Text style={styles.stepText}>+</Text></Pressable>
                </View>
                <Text style={styles.warmupApplied}>≈{applied}{u}</Text>
                <Pressable onPress={() => setRows(rs => rs.filter((_, j) => j !== i))} hitSlop={8} style={styles.warmupDel}>
                  <Text style={styles.warmupDelText}>✕</Text>
                </Pressable>
              </View>
            );
          })}
          <Pressable style={styles.warmupAddRow} onPress={() => setRows(rs => [...rs, { percent: '50', reps: '8' }])}>
            <Text style={styles.warmupAddRowText}>+ 단계 추가</Text>
          </Pressable>
          <View style={styles.warmupActions}>
            <Pressable style={styles.warmupCancel} onPress={onClose}>
              <Text style={styles.warmupCancelText}>취소</Text>
            </Pressable>
            <Pressable style={styles.warmupApply} onPress={apply}>
              <Text style={styles.warmupApplyText}>추가</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
