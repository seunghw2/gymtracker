import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { getExercises, updateExercise, Exercise } from '../db/queries';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, MUSCLE_KO, EQUIP_KO } from '../constants/exercises';
import { GREEN } from '../constants/colors';

type Props = {
  exerciseId: number | null;
  onClose: () => void;
  onSaved: (ex: Exercise) => void;
};

/**
 * 종목 정보(이름·부위·장비·브랜드·측정방식) 수정 시트.
 * 기본(시스템) 종목은 이름·측정방식만, 커스텀 종목은 전체 수정 가능.
 * 운동 추가 화면과 세션 카드 ⋯ 메뉴에서 공통으로 사용.
 */
export default function ExerciseEditSheet({ exerciseId, onClose, onSaved }: Props) {
  const [ex, setEx] = useState<Exercise | null>(null);
  const [name, setName] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [time, setTime] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exerciseId == null) { setEx(null); return; }
    let alive = true;
    getExercises().then(list => {
      if (!alive) return;
      const found = list.find(e => e.id === exerciseId) ?? null;
      setEx(found);
      if (found) {
        setName(found.name);
        setPart(found.muscle_group);
        setEquip(found.equipment_type);
        setBrand(found.brand ?? '');
        setTime(found.tracking_type === 'TIME');
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [exerciseId]);

  const isCustom = ex?.is_custom === 1;

  const save = async () => {
    if (!ex || !name.trim() || saving) return;
    setSaving(true);
    try {
      const patch = isCustom
        ? { name: name.trim(), muscle_group: part ?? undefined, equipment_type: equip ?? undefined, brand: brand.trim() || null, tracking_type: time ? 'TIME' as const : 'REPS' as const }
        : { name: name.trim(), tracking_type: time ? 'TIME' as const : 'REPS' as const };
      const updated = await updateExercise(ex.id, patch);
      onSaved(updated);
      onClose();
    } catch {
      Alert.alert('수정 실패', '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={exerciseId != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {ex && (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.grip} />
            <Text style={styles.title}>종목 수정</Text>
            {!isCustom && <Text style={styles.hint}>기본 종목은 이름과 측정 방식만 바꿀 수 있어요.</Text>}

            <Text style={styles.label}>운동 이름</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#48484A" />

            {isCustom && (
              <>
                <Text style={styles.label}>부위</Text>
                <View style={styles.wrap}>
                  {MUSCLE_GROUPS.map(m => (
                    <Pressable key={m} style={[styles.choice, part === m && styles.choiceOn]} onPress={() => setPart(m)}>
                      <Text style={[styles.choiceText, part === m && styles.choiceTextOn]}>{MUSCLE_KO[m] ?? m}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>장비</Text>
                <View style={styles.wrap}>
                  {EQUIPMENT_TYPES.map(eq => (
                    <Pressable key={eq} style={[styles.choice, equip === eq && styles.choiceOn]} onPress={() => setEquip(eq)}>
                      <Text style={[styles.choiceText, equip === eq && styles.choiceTextOn]}>{EQUIP_KO[eq] ?? eq}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>브랜드 (선택)</Text>
                <TextInput style={styles.input} placeholder="없음" placeholderTextColor="#48484A" value={brand} onChangeText={setBrand} />
              </>
            )}

            <Text style={styles.label}>측정 방식</Text>
            <View style={styles.wrap}>
              {([['reps', '횟수·무게'], ['time', '시간(초)']] as const).map(([k, lbl]) => {
                const on = (k === 'time') === time;
                return (
                  <Pressable key={k} style={[styles.choice, on && styles.choiceOn]} onPress={() => setTime(k === 'time')}>
                    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{lbl}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={[styles.saveBtn, (!name.trim() || saving) && { opacity: 0.4 }]} onPress={save} disabled={!name.trim() || saving}>
              <Text style={styles.saveBtnText}>저장</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>취소</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#161618', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 28, maxHeight: '85%' },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', marginTop: 10, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#8E8E93', fontSize: 13, marginBottom: 4 },
  label: { color: '#8E8E93', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: '#1C1C1E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#FFFFFF', fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  choiceOn: { backgroundColor: GREEN },
  choiceText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  choiceTextOn: { color: '#06210F' },
  saveBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#06210F', fontSize: 16, fontWeight: '800' },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
});
