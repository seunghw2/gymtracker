import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ACCENT, SEM } from '../constants/colors';
import { createTemplate, updateTemplate, getTemplate } from '../db/api/templates';
import type { Exercise } from '../db/api/types';
import { useUiStore } from '../store/useUiStore';

type Row = {
  exerciseId: number;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
};

export default function TemplateEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : null;
  const setExercisePickCb = useUiStore(s => s.setExercisePickCb);

  const [name, setName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    getTemplate(editId).then(t => {
      setName(t.name);
      setRows(t.exercises.map(e => ({
        exerciseId: e.exercise_id, name: e.name,
        sets: e.default_sets, reps: e.default_reps, weightKg: e.default_weight_kg,
      })));
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [editId]);

  const addExercises = useCallback(() => {
    setExercisePickCb((picked: Exercise[]) => {
      setRows(prev => {
        const existing = new Set(prev.map(r => r.exerciseId));
        const additions = picked
          .filter(p => !existing.has(p.id))
          .map(p => ({ exerciseId: p.id, name: p.name, sets: 3, reps: 10, weightKg: 0 }));
        return [...prev, ...additions];
      });
    });
    router.navigate({
      pathname: '/exercise-add',
      params: { target: 'pick', preselectedIds: rows.map(r => r.exerciseId).join(',') },
    });
  }, [router, rows, setExercisePickCb]);

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('이름 입력', '템플릿 이름을 입력해 주세요.'); return; }
    if (rows.length === 0) { Alert.alert('종목 추가', '종목을 1개 이상 추가해 주세요.'); return; }
    setSaving(true);
    const payload = rows.map(r => ({ exerciseId: r.exerciseId, sets: r.sets, reps: r.reps, weightKg: r.weightKg }));
    try {
      if (editId) await updateTemplate(editId, trimmed, payload);
      else await createTemplate(trimmed, payload);
      router.back();
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.headerTitle}>{editId ? '템플릿 편집' : '새 템플릿'}</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10}>
          {saving ? <ActivityIndicator color={ACCENT} /> : <Text style={s.saveBtn}>저장</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>템플릿 이름</Text>
        <TextInput
          style={s.nameInput}
          placeholder="예: 등·이두 루틴"
          placeholderTextColor="#48484A"
          value={name}
          onChangeText={setName}
        />

        <Text style={[s.label, { marginTop: 20 }]}>종목</Text>
        {rows.map((row, idx) => (
          <View key={row.exerciseId} style={s.row}>
            <View style={s.rowHead}>
              <Text style={s.rowName}>{row.name}</Text>
              <Pressable hitSlop={8} onPress={() => removeRow(idx)}>
                <Text style={s.rowDel}>✕</Text>
              </Pressable>
            </View>
            <View style={s.steppers}>
              <Stepper label="세트" value={row.sets} min={1}
                onChange={v => updateRow(idx, { sets: v })} />
              <Stepper label="반복" value={row.reps} min={0}
                onChange={v => updateRow(idx, { reps: v })} />
              <Stepper label="무게(kg)" value={row.weightKg} min={0} step={2.5}
                onChange={v => updateRow(idx, { weightKg: v })} />
            </View>
          </View>
        ))}

        <Pressable style={s.addBtn} onPress={addExercises}>
          <Text style={s.addBtnText}>＋ 종목 추가</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ label, value, onChange, min = 0, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(1);
  return (
    <View style={s.stepperBox}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}>
          <Text style={s.stepBtnT}>−</Text>
        </Pressable>
        <Text style={s.stepVal}>{fmt(value)}</Text>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.round((value + step) * 10) / 10)}>
          <Text style={s.stepBtnT}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SEM.line },
  back: { color: ACCENT, fontSize: 30, width: 24, marginTop: -4 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  saveBtn: { color: ACCENT, fontSize: 16, fontWeight: '800' },

  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '800', color: SEM.muted, letterSpacing: 0.4,
    textTransform: 'uppercase', marginBottom: 8 },
  nameInput: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: '#fff', fontSize: 15 },

  row: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 12, padding: 14, marginBottom: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowName: { fontSize: 15, fontWeight: '800', color: '#fff', flex: 1 },
  rowDel: { fontSize: 16, color: '#6a6a6e', paddingHorizontal: 4 },
  steppers: { flexDirection: 'row', gap: 10 },
  stepperBox: { flex: 1 },
  stepperLabel: { fontSize: 11, color: SEM.muted, marginBottom: 6, textAlign: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: SEM.surface2, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepBtnT: { color: '#fff', fontSize: 18, fontWeight: '400' },
  stepVal: { color: '#fff', fontSize: 14, fontWeight: '800', minWidth: 36, textAlign: 'center' },

  addBtn: { height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#2a2a2f',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  addBtnText: { color: '#9a9aa1', fontSize: 15, fontWeight: '700' },
});
