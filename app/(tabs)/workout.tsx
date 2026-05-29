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
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getExercises,
  addCustomExercise,
  createWorkoutSession,
  addWorkoutSet,
  getLastSessionSets,
  updateSessionDuration,
  getSessionHistory,
  getSessionSets,
  getExerciseRest,
  deleteWorkoutSet,
  deleteSession,
  updateSessionDate,
  Exercise,
  SessionSummary,
  SessionSetRow,
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

type SelectStep = 'muscle' | 'equipment' | 'brand' | 'custom-brand' | 'list' | 'custom';

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

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
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
    removeSet,
    removeExercise,
    startRestTimer,
    restTimerActive,
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
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [detailSession, setDetailSession] = useState<SessionSummary | null>(null);
  const [detailSets, setDetailSets] = useState<SessionSetRow[]>([]);
  const [searchText, setSearchText] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showDetailPicker, setShowDetailPicker] = useState(false);
  const detailSwipeRefs = useRef<Map<number, Swipeable>>(new Map());

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

  useEffect(() => {
    if (!activeSessionId) {
      getSessionHistory().then(setHistory);
    }
  }, [activeSessionId]);

  const handleStartWorkout = async () => {
    const sessionId = await createWorkoutSession(startDate);
    startSession(sessionId, startDate);
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
    setSearchText('');
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
    const setId = await addWorkoutSet(activeSessionId, ex.exerciseId, s.setOrder, s.weight_kg, s.reps, orm);
    markSetDone(exIdx, setIdx, orm, setId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const nextSet = ex.sets[setIdx + 1];
    const nextLabel = nextSet ? `${nextSet.weight_kg}kg × ${nextSet.reps}회` : undefined;
    const restSec = await getExerciseRest(ex.exerciseId, restDurationSec);
    startRestTimer(restSec, { nextLabel });
  };

  const saveCustomExercise = async () => {
    if (!customName.trim() || !selectedMuscle || !selectedEquipment) return;
    await addCustomExercise(customName.trim(), selectedMuscle, selectedEquipment, selectedBrand ?? undefined);
    setCustomName('');
    setSelectStep('list');
    loadExercises();
  };

  const openDetail = async (session: SessionSummary) => {
    const sets = await getSessionSets(session.id);
    setDetailSets(sets);
    setDetailSession(session);
  };

  const handleRemoveExercise = (exIdx: number) => {
    const ex = exercises[exIdx];
    Alert.alert('운동 삭제', `${ex.exerciseName}을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          const doneIds = ex.sets.filter(s => s.done && s.setId).map(s => s.setId as number);
          await Promise.all(doneIds.map(id => deleteWorkoutSet(id).catch(() => {})));
          removeExercise(exIdx);
        },
      },
    ]);
  };

  const handleDeleteActiveSet = async (exIdx: number, setIdx: number) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (s?.done && s.setId) await deleteWorkoutSet(s.setId).catch(() => {});
    removeSet(exIdx, setIdx);
  };

  const handleDeleteSession = () => {
    if (!detailSession) return;
    const id = detailSession.id;
    Alert.alert('세션 삭제', '이 운동 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await deleteSession(id);
          setDetailSession(null);
          getSessionHistory().then(setHistory);
        },
      },
    ]);
  };

  const handleDeleteDetailSet = async (setId: number) => {
    if (!detailSession) return;
    await deleteWorkoutSet(setId);
    const sets = await getSessionSets(detailSession.id);
    setDetailSets(sets);
    getSessionHistory().then(setHistory);
  };

  const handleChangeDetailDate = async (newDate: string) => {
    if (!detailSession) return;
    await updateSessionDate(detailSession.id, newDate);
    setDetailSession({ ...detailSession, date: newDate });
    getSessionHistory().then(setHistory);
  };

  const groupedDetailSets = detailSets.reduce<Record<number, { name: string; brand: string | null; sets: SessionSetRow[] }>>(
    (acc, row) => {
      if (!acc[row.exercise_id]) acc[row.exercise_id] = { name: row.exercise_name, brand: row.brand, sets: [] };
      acc[row.exercise_id].sets.push(row);
      return acc;
    },
    {}
  );

  if (!activeSessionId) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.homeContent}>
          {/* 시작 */}
          <View style={styles.startBox}>
            <Pressable onPress={() => setShowStartPicker(true)}>
              <Text style={styles.startTitle}>
                {startDate === getTodayStr() ? '오늘의 운동' : '운동 기록'}
              </Text>
              <Text style={styles.startDate}>{formatDate(startDate)} ›</Text>
            </Pressable>
            <Pressable style={styles.startBtn} onPress={handleStartWorkout}>
              <Text style={styles.startBtnText}>시작</Text>
            </Pressable>
          </View>
          {showStartPicker && (
            <DateTimePicker
              value={new Date(startDate)}
              mode="date"
              maximumDate={new Date()}
              onChange={(event, date) => {
                setShowStartPicker(false);
                if (event.type === 'set' && date) setStartDate(date.toISOString().slice(0, 10));
              }}
            />
          )}

          {/* 히스토리 */}
          {history.length > 0 && (
            <>
              <Text style={styles.historyTitle}>지난 루틴</Text>
              {history.map(session => (
                <Pressable key={session.id} style={styles.historyCard} onPress={() => openDetail(session)}>
                  <View style={styles.historyCardTop}>
                    <Text style={styles.historyDate}>{formatDate(session.date)}</Text>
                    {session.duration_sec ? (
                      <Text style={styles.historyDuration}>{formatDuration(session.duration_sec)}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.historyExercises} numberOfLines={1}>
                    {session.exercise_names || '운동 없음'}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {session.exercise_count}가지 운동 · {session.set_count}세트
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>

        {/* 세션 상세 모달 */}
        <Modal visible={!!detailSession} animationType="slide">
          <SafeAreaView style={styles.safe}>
            <View style={styles.detailHeader}>
              <Pressable onPress={() => setDetailSession(null)}>
                <Text style={styles.modalBack}>✕ 닫기</Text>
              </Pressable>
              <Pressable onPress={() => setShowDetailPicker(true)}>
                <Text style={styles.detailHeaderTitle}>
                  {detailSession ? `${formatDate(detailSession.date)} ›` : ''}
                </Text>
              </Pressable>
              <Pressable onPress={handleDeleteSession}>
                <Text style={styles.detailDelete}>삭제</Text>
              </Pressable>
            </View>
            {showDetailPicker && detailSession && (
              <DateTimePicker
                value={new Date(detailSession.date)}
                mode="date"
                maximumDate={new Date()}
                onChange={(event, date) => {
                  setShowDetailPicker(false);
                  if (event.type === 'set' && date) handleChangeDetailDate(date.toISOString().slice(0, 10));
                }}
              />
            )}
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {Object.values(groupedDetailSets).map((group, i) => (
                <View key={i} style={styles.exerciseCard}>
                  <View style={styles.exerciseCardHeader}>
                    <View>
                      <Text style={styles.exerciseName}>{group.name}</Text>
                      {group.brand && <Text style={styles.exerciseBrand}>{group.brand}</Text>}
                    </View>
                  </View>
                  <View style={styles.setHeader}>
                    <Text style={[styles.setCol, { flex: 0.5 }]}>SET</Text>
                    <Text style={styles.setCol}>무게(kg)</Text>
                    <Text style={styles.setCol}>횟수</Text>
                    <Text style={styles.setCol}>추정 1RM</Text>
                  </View>
                  {group.sets.map((s) => (
                    <Swipeable
                      key={s.id}
                      ref={ref => {
                        if (ref) detailSwipeRefs.current.set(s.id, ref);
                        else detailSwipeRefs.current.delete(s.id);
                      }}
                      renderRightActions={() => (
                        <Pressable
                          style={styles.deleteAction}
                          onPress={() => {
                            detailSwipeRefs.current.get(s.id)?.close();
                            handleDeleteDetailSet(s.id);
                          }}
                        >
                          <Text style={styles.deleteActionText}>삭제</Text>
                        </Pressable>
                      )}
                      rightThreshold={40}
                      overshootRight={false}
                    >
                      <View style={[styles.setRow, styles.setRowDone]}>
                        <Text style={[styles.setNum, { flex: 0.5 }]}>{s.set_order}</Text>
                        <Text style={styles.setReadOnly}>{s.weight_kg}</Text>
                        <Text style={styles.setReadOnly}>{s.reps}</Text>
                        <Text style={[styles.setReadOnly, { color: '#30D158' }]}>
                          {s.estimated_1rm ? `${s.estimated_1rm}kg` : '-'}
                        </Text>
                      </View>
                    </Swipeable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  const renderDeleteAction = (exIdx: number, setIdx: number) => (
    <Pressable
      style={styles.deleteAction}
      onPress={() => {
        swipeableRefs.current.get(`${exIdx}-${setIdx}`)?.close();
        handleDeleteActiveSet(exIdx, setIdx);
      }}
    >
      <Text style={styles.deleteActionText}>삭제</Text>
    </Pressable>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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

      <ScrollView contentContainerStyle={[styles.scrollContent, restTimerActive && styles.scrollContentRest]}>
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
                <View style={styles.exerciseHeaderRight}>
                  {bestORM > 0 && (
                    <Text style={styles.ormBadge}>1RM {bestORM}kg</Text>
                  )}
                  <Pressable onPress={() => handleRemoveExercise(exIdx)} hitSlop={8} style={styles.exDeleteBtn}>
                    <Text style={styles.exDeleteText}>✕</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.setHeader}>
                <Text style={[styles.setCol, { flex: 0.5 }]}>SET</Text>
                <Text style={styles.setCol}>무게(kg)</Text>
                <Text style={styles.setCol}>횟수</Text>
                <Text style={[styles.setCol, { flex: 0.5 }]}>✓</Text>
              </View>

              {ex.sets.map((s, setIdx) => (
                <Swipeable
                  key={setIdx}
                  ref={ref => {
                    const key = `${exIdx}-${setIdx}`;
                    if (ref) swipeableRefs.current.set(key, ref);
                    else swipeableRefs.current.delete(key);
                  }}
                  renderRightActions={() => renderDeleteAction(exIdx, setIdx)}
                  rightThreshold={40}
                  overshootRight={false}
                >
                  <View style={[styles.setRow, s.done && styles.setRowDone]}>
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
                </Swipeable>
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

      {/* 하단 고정 휴식 타이머 (활성 시에만 렌더) */}
      <View style={styles.restDock} pointerEvents="box-none">
        <RestTimer />
      </View>

      {/* 운동 선택 모달 */}
      <Modal visible={showExerciseModal} animationType="slide">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => {
              if (selectStep === 'muscle') { setShowExerciseModal(false); }
              else if (selectStep === 'equipment') setSelectStep('muscle');
              else if (selectStep === 'brand') setSelectStep('equipment');
              else if (selectStep === 'custom-brand') setSelectStep('brand');
              else if (selectStep === 'list') setSelectStep(selectedEquipment === 'Machine' ? 'brand' : 'equipment');
              else if (selectStep === 'custom') setSelectStep('list');
            }}>
              <Text style={styles.modalBack}>← 뒤로</Text>
            </Pressable>
            <Text style={styles.modalTitle}>
              {selectStep === 'muscle' && '부위 선택'}
              {selectStep === 'equipment' && '장비 선택'}
              {selectStep === 'brand' && '브랜드 선택'}
              {selectStep === 'custom-brand' && '브랜드 직접 입력'}
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
            <ScrollView contentContainerStyle={styles.modalContent}>
              {[...MACHINE_BRANDS, ...extraBrands].map(b => (
                <Pressable
                  key={b}
                  style={styles.choiceBtn}
                  onPress={() => { setSelectedBrand(b); setSelectStep('list'); }}
                >
                  <Text style={styles.choiceText}>{b}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.choiceBtn, styles.choiceBtnOutline]}
                onPress={() => { setCustomBrandInput(''); setSelectStep('custom-brand'); }}
              >
                <Text style={[styles.choiceText, { color: '#30D158' }]}>+ 직접 등록</Text>
              </Pressable>
            </ScrollView>
          )}

          {selectStep === 'custom-brand' && (
            <View style={styles.modalContent}>
              <Text style={styles.customFormLabel}>브랜드 이름</Text>
              <TextInput
                style={styles.input}
                placeholder="예: Technogym, Matrix..."
                placeholderTextColor="#48484A"
                value={customBrandInput}
                onChangeText={setCustomBrandInput}
                autoFocus
              />
              <Pressable
                style={[styles.saveBtn, { marginTop: 16 }, !customBrandInput.trim() && { opacity: 0.4 }]}
                onPress={() => {
                  const brand = customBrandInput.trim();
                  if (!brand) return;
                  setExtraBrands(prev => [...prev, brand]);
                  setCustomBrandInput('');
                  setSelectStep('brand');
                  Alert.alert('브랜드 추가', `${brand} 브랜드가 추가되었습니다.`);
                }}
                disabled={!customBrandInput.trim()}
              >
                <Text style={styles.saveBtnText}>저장</Text>
              </Pressable>
            </View>
          )}

          {selectStep === 'list' && (
            <FlatList
              data={exerciseList.filter(e =>
                e.name.toLowerCase().includes(searchText.trim().toLowerCase())
              )}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <TextInput
                  style={styles.searchInput}
                  placeholder="종목 검색"
                  placeholderTextColor="#48484A"
                  value={searchText}
                  onChangeText={setSearchText}
                  clearButtonMode="while-editing"
                />
              }
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },

  homeContent: { padding: 20, paddingBottom: 40 },
  startBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
  },
  startTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  startDate: { color: '#8E8E93', fontSize: 14, marginTop: 4 },
  startBtn: {
    backgroundColor: '#30D158',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  startBtnText: { color: '#000000', fontSize: 16, fontWeight: '700' },

  historyTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12 },
  historyCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyDate: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  historyDuration: { color: '#8E8E93', fontSize: 13 },
  historyExercises: { color: '#8E8E93', fontSize: 14, marginBottom: 4 },
  historyMeta: { color: '#48484A', fontSize: 12 },

  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  detailHeaderTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  detailDelete: { color: '#FF453A', fontSize: 16, fontWeight: '600', width: 60, textAlign: 'right' },
  setReadOnly: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },

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
  scrollContentRest: { paddingBottom: 220 },
  restDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },

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
  exerciseHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exDeleteText: { color: '#8E8E93', fontSize: 14, fontWeight: '700' },

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

  deleteAction: {
    backgroundColor: '#FF453A',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: 8,
    marginBottom: 4,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
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
  searchInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
  },
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
  choiceBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#30D158',
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
