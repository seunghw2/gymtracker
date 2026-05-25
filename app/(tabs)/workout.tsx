import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  getExercises,
  addCustomExercise,
  createWorkoutSession,
  addWorkoutSet,
  getLastSessionSets,
  updateSessionDuration,
  Exercise,
} from '../../db/queries';
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  MACHINE_BRANDS,
  MuscleGroup,
  EquipmentType,
} from '../../constants/exercises';
import { useWorkoutStore, useSettingsStore, ExerciseEntry, SetEntry } from '../../store/useStore';
import RestTimer from '../../components/RestTimer';

type SelectStep = 'muscle' | 'equipment' | 'brand' | 'list' | 'custom';

function epley(weight: number, reps: number) {
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function useElapsedTime(startTime: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const {
    activeSessionId,
    sessionDate,
    sessionStartTime,
    exercises,
    startSession,
    finishSession,
    addExercise,
    updateSet,
    addSetToExercise,
    markSetDone,
    startRestTimer,
  } = useWorkoutStore();
  const { restDurationSec } = useSettingsStore();
  const elapsed = useElapsedTime(sessionStartTime);

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectStep, setSelectStep] = useState<SelectStep>('muscle');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
  const [customName, setCustomName] = useState('');

  const loadExercises = useCallback(async () => {
    const list = await getExercises(
      selectedMuscle ?? undefined,
      selectedEquipment ?? undefined,
      selectedBrand ?? undefined,
    );
    setExerciseList(list);
  }, [selectedMuscle, selectedEquipment, selectedBrand]);

  useEffect(() => {
    if (selectStep === 'list') loadExercises();
  }, [selectStep, loadExercises]);

  const handleStartWorkout = async () => {
    const today = getTodayStr();
    const sessionId = await createWorkoutSession(today);
    startSession(sessionId, today);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFinishWorkout = () => {
    Alert.alert('운동 완료', '오늘의 운동을 종료할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료', onPress: async () => {
          if (activeSessionId && sessionStartTime) {
            const sec = Math.floor((Date.now() - sessionStartTime) / 1000);
            await updateSessionDuration(activeSessionId, sec);
          }
          finishSession();
        },
      },
    ]);
  };

  const openExerciseSelect = () => {
    setSelectStep('muscle');
    setSelectedMuscle(null);
    setSelectedEquipment(null);
    setSelectedBrand(null);
    setShowExerciseModal(true);
  };

  const handleSelectExercise = async (ex: Exercise) => {
    setShowExerciseModal(false);
    const prev = await getLastSessionSets(ex.id);
    const initSets: SetEntry[] = prev.length > 0
      ? prev.map((s, i) => ({ setOrder: i + 1, weight_kg: s.weight_kg, reps: s.reps, done: false }))
      : [{ setOrder: 1, weight_kg: 60, reps: 10, done: false }];

    const entry: ExerciseEntry = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      brand: ex.brand,
      sets: initSets,
    };
    addExercise(entry);
  };

  const handleCompleteSet = async (exIdx: number, setIdx: number) => {
    if (!activeSessionId) return;
    const ex = exercises[exIdx];
    const s = ex.sets[setIdx];
    const orm = epley(s.weight_kg, s.reps);
    await addWorkoutSet(activeSessionId, ex.exerciseId, s.setOrder, s.weight_kg, s.reps, orm);
    markSetDone(exIdx, setIdx, orm);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    startRestTimer(restDurationSec);
  };

  const saveCustomExercise = async () => {
    if (!customName.trim() || !selectedMuscle || !selectedEquipment) return;
    await addCustomExercise(customName.trim(), selectedMuscle, selectedEquipment, selectedBrand ?? undefined);
    setCustomName('');
    setSelectStep('list');
    loadExercises();
  };

  if (!activeSessionId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.startContainer}>
          <Text style={styles.startTitle}>오늘의 운동</Text>
          <Text style={styles.startDate}>{formatDate(getTodayStr())}</Text>
          <Pressable style={styles.startBtn} onPress={handleStartWorkout}>
            <Text style={styles.startBtnText}>운동 시작</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* 헤더 */}
      <View style={styles.sessionHeader}>
        <View>
          <Text style={styles.sessionTitle}>{sessionDate ? formatDate(sessionDate) : ''}</Text>
          <Text style={styles.sessionElapsed}>{elapsed}</Text>
        </View>
        <Pressable style={styles.finishBtn} onPress={handleFinishWorkout}>
          <Text style={styles.finishBtnText}>완료</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <RestTimer />

        {exercises.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>아래 버튼으로 운동을 추가하세요</Text>
          </View>
        )}

        {exercises.map((ex, exIdx) => {
          const bestORM = ex.sets
            .filter(s => s.done && s.estimated_1rm)
            .reduce((m, s) => Math.max(m, s.estimated_1rm ?? 0), 0);

          return (
            <View key={exIdx} style={styles.exerciseCard}>
              <View style={styles.exerciseCardHeader}>
                <View>
                  <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                  {ex.brand && <Text style={styles.exerciseBrand}>{ex.brand}</Text>}
                </View>
                {bestORM > 0 && (
                  <Text style={styles.ormBadge}>1RM {bestORM}kg</Text>
                )}
              </View>

              <View style={styles.setHeader}>
                <Text style={[styles.setCol, { flex: 0.5 }]}>SET</Text>
                <Text style={styles.setCol}>무게(kg)</Text>
                <Text style={styles.setCol}>횟수</Text>
                <Text style={[styles.setCol, { flex: 0.5 }]}>✓</Text>
              </View>

              {ex.sets.map((s, setIdx) => (
                <View key={setIdx} style={[styles.setRow, s.done && styles.setRowDone]}>
                  <Text style={[styles.setNum, { flex: 0.5 }]}>{s.setOrder}</Text>
                  <TextInput
                    style={styles.setInput}
                    value={String(s.weight_kg)}
                    keyboardType="decimal-pad"
                    onChangeText={v => updateSet(exIdx, setIdx, { weight_kg: parseFloat(v) || 0 })}
                    editable={!s.done}
                    selectTextOnFocus
                  />
                  <TextInput
                    style={styles.setInput}
                    value={String(s.reps)}
                    keyboardType="number-pad"
                    onChangeText={v => updateSet(exIdx, setIdx, { reps: parseInt(v) || 0 })}
                    editable={!s.done}
                    selectTextOnFocus
                  />
                  <Pressable
                    style={[styles.checkBtn, { flex: 0.5 }]}
                    onPress={() => !s.done && handleCompleteSet(exIdx, setIdx)}
                  >
                    <Text style={[styles.checkText, s.done && styles.checkDone]}>
                      {s.done ? '✓' : '○'}
                    </Text>
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.addSetBtn} onPress={() => addSetToExercise(exIdx)}>
                <Text style={styles.addSetText}>+ 세트 추가</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.addExerciseBtn} onPress={openExerciseSelect}>
          <Text style={styles.addExerciseBtnText}>+ 운동 추가</Text>
        </Pressable>
      </ScrollView>

      {/* 운동 선택 모달 */}
      <Modal visible={showExerciseModal} animationType="slide">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => {
              if (selectStep === 'muscle') { setShowExerciseModal(false); }
              else if (selectStep === 'equipment') setSelectStep('muscle');
              else if (selectStep === 'brand') setSelectStep('equipment');
              else if (selectStep === 'list') setSelectStep(selectedEquipment === 'Machine' ? 'brand' : 'equipment');
              else if (selectStep === 'custom') setSelectStep('list');
            }}>
              <Text style={styles.modalBack}>← 뒤로</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {selectStep === 'muscle' && '부위 선택'}
              {selectStep === 'equipment' && '장비 선택'}
              {selectStep === 'brand' && '브랜드 선택'}
              {selectStep === 'list' && '운동 선택'}
              {selectStep === 'custom' && '직접 등록'}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {selectStep === 'muscle' && (
            <View style={styles.modalContent}>
              <View style={styles.muscleGrid}>
                {MUSCLE_GROUPS.map(mg => (
                  <Pressable key={mg} style={styles.muscleBtn} onPress={() => { setSelectedMuscle(mg); setSelectStep('equipment'); }}>
                    <Text style={styles.muscleBtnText}>{mg}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {selectStep === 'equipment' && (
            <View style={styles.modalContent}>
              {EQUIPMENT_TYPES.map(eq => (
                <Pressable key={eq} style={styles.choiceBtn} onPress={() => {
                  setSelectedEquipment(eq);
                  setSelectStep(eq === 'Machine' ? 'brand' : 'list');
                }}>
                  <Text style={styles.choiceText}>{eq}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {selectStep === 'brand' && (
            <View style={styles.modalContent}>
              {MACHINE_BRANDS.map(b => (
                <Pressable key={b} style={styles.choiceBtn} onPress={() => { setSelectedBrand(b); setSelectStep('list'); }}>
                  <Text style={styles.choiceText}>{b}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.choiceBtn, { borderColor: '#30D158', borderWidth: 1 }]} onPress={() => { setSelectedBrand(null); setSelectStep('list'); }}>
                <Text style={styles.choiceText}>전체 보기</Text>
              </Pressable>
            </View>
          )}

          {selectStep === 'list' && (
            <FlatList
              data={exerciseList}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.modalContent}
              renderItem={({ item }) => (
                <Pressable style={styles.exItem} onPress={() => handleSelectExercise(item)}>
                  <View>
                    <Text style={styles.exName}>{item.name}</Text>
                    {item.brand && <Text style={styles.exBrand}>{item.brand}</Text>}
                  </View>
                  <Text style={styles.exArrow}>›</Text>
                </Pressable>
              )}
              ListFooterComponent={
                <Pressable style={styles.customBtn} onPress={() => { setCustomName(''); setSelectStep('custom'); }}>
                  <Text style={styles.customBtnText}>+ 직접 등록</Text>
                </Pressable>
              }
            />
          )}

          {selectStep === 'custom' && (
            <View style={styles.modalContent}>
              <Text style={styles.customFormLabel}>운동 이름</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 케이블 크런치"
                placeholderTextColor="#48484A"
                value={customName}
                onChangeText={setCustomName}
                autoFocus
              />
              <Text style={styles.customFormSub}>
                부위: {selectedMuscle}  |  장비: {selectedEquipment}{selectedBrand ? `  |  브랜드: ${selectedBrand}` : ''}
              </Text>
              <Pressable
                style={[styles.saveBtn, !customName.trim() && { opacity: 0.4 }]}
                onPress={saveCustomExercise}
                disabled={!customName.trim()}
              >
                <Text style={styles.saveBtnText}>저장하고 추가</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },

  startContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  startTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  startDate: { color: '#8E8E93', fontSize: 17, marginBottom: 32 },
  startBtn: {
    backgroundColor: '#30D158',
    borderRadius: 20,
    paddingHorizontal: 60,
    paddingVertical: 18,
  },
  startBtnText: { color: '#000000', fontSize: 19, fontWeight: '700' },

  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  sessionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  sessionElapsed: { color: '#30D158', fontSize: 14, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  finishBtn: { backgroundColor: '#30D158', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8 },
  finishBtnText: { color: '#000000', fontSize: 15, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 60 },

  emptyHint: { alignItems: 'center', paddingVertical: 40 },
  emptyHintText: { color: '#48484A', fontSize: 15 },

  exerciseCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  exerciseName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  exerciseBrand: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  ormBadge: {
    color: '#30D158',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: '#1A3D27',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  setHeader: { flexDirection: 'row', marginBottom: 4 },
  setCol: { flex: 1, color: '#8E8E93', fontSize: 12, textAlign: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#2C2C2E',
  },
  setRowDone: { opacity: 0.45 },
  setNum: { flex: 1, color: '#8E8E93', textAlign: 'center', fontSize: 14 },
  setInput: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  checkBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  checkText: { color: '#48484A', fontSize: 20 },
  checkDone: { color: '#30D158' },

  addSetBtn: {
    borderWidth: 1,
    borderColor: '#3A3A3C',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addSetText: { color: '#8E8E93', fontSize: 14 },

  addExerciseBtn: {
    borderWidth: 2,
    borderColor: '#30D158',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  addExerciseBtnText: { color: '#30D158', fontSize: 17, fontWeight: '700' },

  // 운동 선택 모달
  modalSafe: { flex: 1, backgroundColor: '#000000' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  modalBack: { color: '#30D158', fontSize: 16, width: 60 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  modalContent: { padding: 16 },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  muscleBtn: {
    width: '46%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  muscleBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  choiceBtn: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
  },
  choiceText: { color: '#FFFFFF', fontSize: 17 },
  exItem: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exName: { color: '#FFFFFF', fontSize: 16 },
  exBrand: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  exArrow: { color: '#8E8E93', fontSize: 24 },
  customBtn: {
    borderWidth: 1,
    borderColor: '#30D158',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  customBtnText: { color: '#30D158', fontSize: 16 },

  customFormLabel: { color: '#8E8E93', fontSize: 13, marginBottom: 8, textTransform: 'uppercase' },
  customFormSub: { color: '#48484A', fontSize: 13, marginBottom: 24, marginTop: 8 },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 4,
  },
  saveBtn: {
    backgroundColor: '#30D158',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },
});
