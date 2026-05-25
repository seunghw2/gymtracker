import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  SafeAreaView,
  Switch,
} from 'react-native';
import {
  getGyms,
  addGym,
  deleteGym,
  getCustomExercises,
  deleteCustomExercise,
  getSetting,
  setSetting,
  Gym,
  Exercise,
} from '../../db/queries';
import { useSettingsStore } from '../../store/useStore';

export default function SettingsScreen() {
  const {
    goalWeightKg, goalBodyFatPct, restDurationSec, unitKg,
    setGoalWeight, setGoalBodyFat, setRestDuration, setUnitKg,
  } = useSettingsStore();

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [gymName, setGymName] = useState('');
  const [gymLocation, setGymLocation] = useState('');
  const [goalWeightInput, setGoalWeightInput] = useState(String(goalWeightKg));
  const [goalFatInput, setGoalFatInput] = useState(String(goalBodyFatPct));
  const [restInput, setRestInput] = useState(String(restDurationSec));

  const load = useCallback(async () => {
    const [gymList, exList] = await Promise.all([getGyms(), getCustomExercises()]);
    setGyms(gymList);
    setCustomExercises(exList);

    const gw = await getSetting('goal_weight_kg', String(goalWeightKg));
    const gf = await getSetting('goal_body_fat_pct', String(goalBodyFatPct));
    const rd = await getSetting('rest_duration_sec', String(restDurationSec));
    const uk = await getSetting('unit_kg', '1');

    setGoalWeight(parseFloat(gw));
    setGoalBodyFat(parseFloat(gf));
    setRestDuration(parseInt(rd));
    setUnitKg(uk === '1');

    setGoalWeightInput(gw);
    setGoalFatInput(gf);
    setRestInput(rd);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveGoals = async () => {
    const gw = parseFloat(goalWeightInput);
    const gf = parseFloat(goalFatInput);
    const rd = parseInt(restInput);
    if (isNaN(gw) || isNaN(gf) || isNaN(rd)) {
      Alert.alert('오류', '올바른 숫자를 입력하세요.');
      return;
    }
    await Promise.all([
      setSetting('goal_weight_kg', String(gw)),
      setSetting('goal_body_fat_pct', String(gf)),
      setSetting('rest_duration_sec', String(rd)),
    ]);
    setGoalWeight(gw);
    setGoalBodyFat(gf);
    setRestDuration(rd);
    Alert.alert('저장됨');
  };

  const handleAddGym = async () => {
    if (!gymName.trim()) return;
    await addGym(gymName.trim(), gymLocation.trim() || undefined);
    setGymName('');
    setGymLocation('');
    load();
  };

  const handleDeleteGym = (gym: Gym) => {
    Alert.alert('삭제', `"${gym.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteGym(gym.id); load(); } },
    ]);
  };

  const handleDeleteExercise = (ex: Exercise) => {
    Alert.alert('삭제', `"${ex.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteCustomExercise(ex.id); load(); } },
    ]);
  };

  const toggleUnit = async (val: boolean) => {
    setUnitKg(val);
    await setSetting('unit_kg', val ? '1' : '0');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>설정</Text>

        {/* 목표 설정 */}
        <Text style={styles.sectionTitle}>목표 설정</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>목표 체중 (kg)</Text>
            <TextInput
              style={styles.input}
              value={goalWeightInput}
              onChangeText={setGoalWeightInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>목표 체지방률 (%)</Text>
            <TextInput
              style={styles.input}
              value={goalFatInput}
              onChangeText={setGoalFatInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>기본 휴식 시간 (초)</Text>
            <TextInput
              style={styles.input}
              value={restInput}
              onChangeText={setRestInput}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <Pressable style={styles.saveBtn} onPress={saveGoals}>
            <Text style={styles.saveBtnText}>저장</Text>
          </Pressable>
        </View>

        {/* 단위 설정 */}
        <Text style={styles.sectionTitle}>단위</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>kg 단위 사용</Text>
            <Switch
              value={unitKg}
              onValueChange={toggleUnit}
              trackColor={{ false: '#3A3A3C', true: '#30D158' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* 헬스장 관리 */}
        <Text style={styles.sectionTitle}>헬스장 관리</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.fullInput}
            placeholder="헬스장 이름"
            placeholderTextColor="#48484A"
            value={gymName}
            onChangeText={setGymName}
          />
          <TextInput
            style={[styles.fullInput, { marginTop: 8 }]}
            placeholder="위치 (선택)"
            placeholderTextColor="#48484A"
            value={gymLocation}
            onChangeText={setGymLocation}
          />
          <Pressable style={styles.addBtn} onPress={handleAddGym}>
            <Text style={styles.addBtnText}>+ 추가</Text>
          </Pressable>
          {gyms.map(gym => (
            <View key={gym.id} style={styles.listItem}>
              <View>
                <Text style={styles.listItemName}>{gym.name}</Text>
                {gym.location && <Text style={styles.listItemSub}>{gym.location}</Text>}
              </View>
              <Pressable onPress={() => handleDeleteGym(gym)}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
          ))}
          {gyms.length === 0 && (
            <Text style={styles.emptyText}>등록된 헬스장이 없습니다</Text>
          )}
        </View>

        {/* 커스텀 운동 관리 */}
        <Text style={styles.sectionTitle}>커스텀 운동</Text>
        <View style={styles.card}>
          {customExercises.map(ex => (
            <View key={ex.id} style={styles.listItem}>
              <View>
                <Text style={styles.listItemName}>{ex.name}</Text>
                <Text style={styles.listItemSub}>{ex.muscle_group} / {ex.equipment_type}</Text>
              </View>
              <Pressable onPress={() => handleDeleteExercise(ex)}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
          ))}
          {customExercises.length === 0 && (
            <Text style={styles.emptyText}>등록된 커스텀 운동이 없습니다</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },

  sectionTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },

  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: 8 },
  label: { color: '#FFFFFF', fontSize: 16 },
  input: {
    color: '#30D158',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 70,
    fontVariant: ['tabular-nums'],
  },

  saveBtn: {
    backgroundColor: '#30D158',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: '#000000', fontSize: 16, fontWeight: '700' },

  fullInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: '#30D158',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  addBtnText: { color: '#30D158', fontSize: 15, fontWeight: '600' },

  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    marginTop: 4,
  },
  listItemName: { color: '#FFFFFF', fontSize: 15 },
  listItemSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  deleteText: { color: '#FF453A', fontSize: 14 },
  emptyText: { color: '#48484A', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
});
