import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Platform,
  InputAccessoryView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import {
  getSessionSets,
  getSessionExerciseNotes,
  addWorkoutSet,
  deleteWorkoutSet,
  deleteSession,
  updateSession,
  updateWorkoutSet,
  createTemplate,
  getLastSessionSets,
  SessionSummary,
  SessionSetRow,
} from '../db/queries';
import { SetType } from '../store/useStore';
import { epley } from '../lib/format';
import { toDisplay, fromInput, unitLabel } from '../lib/units';
import { formatDateWithDay, todayStr } from '../lib/date';
import { logError } from '../lib/log';
import DatePickerSheet from './DatePickerSheet';
import ExerciseSelectModal, { SelectableExercise } from './ExerciseSelectModal';
import { styles } from '../app/workout.styles';

const KB_ACCESSORY_ID = 'setInputDone';

/** 세트 타입별 짧은 표시(W/D/F) + 색상. NORMAL은 표시 없음. */
const SET_TYPE_META: Record<SetType, { label: string; color: string } | null> = {
  NORMAL: null,
  WARMUP: { label: 'W', color: '#FF9F0A' },
  DROP: { label: 'D', color: '#BF5AF2' },
  FAILURE: { label: 'F', color: '#FF453A' },
};

type Props = {
  /** 편집할 과거 세션(없으면 모달 닫힘). */
  session: SessionSummary | null;
  unitKg: boolean;
  onClose: () => void;
  /** 세트/세션/루틴 변경 시 부모의 히스토리·템플릿 목록을 갱신하라는 신호. */
  onChanged: () => void;
};

/**
 * 과거 세션 상세 편집 모달 — 제목/메모/날짜 변경, 세트 편집·삭제·추가, 종목 추가, 삭제, 루틴 저장.
 * 세트/노트/편집 상태는 내부에서 관리하고 부모와는 session/onClose/onChanged만 주고받는다.
 * 종목 추가도 자체 ExerciseSelectModal로 처리한다(workout.tsx에서 분리).
 */
export default function SessionDetailModal({ session, unitKg, onClose, onChanged }: Props) {
  const u = unitLabel(unitKg);
  const [local, setLocal] = useState<SessionSummary | null>(session);
  const [sets, setSets] = useState<SessionSetRow[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [exNotes, setExNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showExercise, setShowExercise] = useState(false);
  const swipeRefs = useRef<Map<number, Swipeable>>(new Map());

  useEffect(() => {
    setLocal(session);
    if (session) {
      Promise.all([
        getSessionSets(session.id),
        getSessionExerciseNotes(session.id).catch(() => []),
      ]).then(([s, notes]) => {
        setSets(s);
        const noteMap: Record<number, string> = {};
        for (const n of notes) if (n.note) noteMap[n.exercise_id] = n.note;
        setExNotes(noteMap);
      });
      setTitle(session.title ?? '');
      setNote(session.note ?? '');
    } else {
      setExNotes({});
    }
  }, [session]);

  const handleDeleteSession = () => {
    if (!local) return;
    const id = local.id;
    Alert.alert('세션 삭제', '이 운동 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await deleteSession(id);
          onClose();
          onChanged();
        },
      },
    ]);
  };

  const handleDeleteDetailSet = async (setId: number) => {
    if (!local) return;
    await deleteWorkoutSet(setId);
    const s = await getSessionSets(local.id);
    setSets(s);
    onChanged();
  };

  const handleChangeDetailDate = async (newDate: string) => {
    if (!local) return;
    await updateSession(local.id, { date: newDate });
    setLocal({ ...local, date: newDate });
    onChanged();
  };

  const handleEditDetailSet = (setId: number, weight: number, reps: number) => {
    setSets(prev => prev.map(s =>
      s.id === setId ? { ...s, weight_kg: weight, reps, estimated_1rm: epley(weight, reps) } : s
    ));
  };

  // 과거 세션에 세트 추가 (해당 종목 마지막 세트 복사)
  const addSetToDetail = async (exerciseId: number) => {
    if (!local) return;
    const groupSets = sets.filter(s => s.exercise_id === exerciseId);
    const last = groupSets[groupSets.length - 1];
    const w = last?.weight_kg ?? 60;
    const r = last?.reps ?? 10;
    const nextOrder = (last?.set_order ?? 0) + 1;
    await addWorkoutSet(local.id, exerciseId, nextOrder, w, r, epley(w, r), last?.set_type ?? 'NORMAL').catch(e => logError('addSetToDetail:addWorkoutSet', e));
    const s = await getSessionSets(local.id);
    setSets(s);
    onChanged();
  };

  // 과거 세션 편집 내용(세트 무게/횟수 + 제목/메모) 일괄 저장
  const handleSaveDetail = async () => {
    if (!local || saving) return;
    setSaving(true);
    try {
      await Promise.all(sets.map(s => updateWorkoutSet(s.id, s.weight_kg, s.reps, s.set_type).catch(e => logError('handleSaveDetail:updateWorkoutSet', e))));
      await updateSession(local.id, { title, note }).catch(() => {});
      setLocal({ ...local, title, note });
      onChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장됨', '변경사항이 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 과거 세션을 루틴(템플릿)으로 저장
  const handleSaveDetailAsTemplate = () => {
    if (!local || sets.length === 0) {
      Alert.alert('루틴 저장', '세트가 없는 운동입니다.');
      return;
    }
    const order: number[] = [];
    const groups: Record<number, { reps: number; weight: number; count: number }> = {};
    for (const s of sets) {
      if (!groups[s.exercise_id]) { order.push(s.exercise_id); groups[s.exercise_id] = { reps: s.reps, weight: s.weight_kg, count: 0 }; }
      if ((s.set_type ?? 'NORMAL') !== 'WARMUP') groups[s.exercise_id].count += 1;
    }
    const payload = order.map(id => ({
      exerciseId: id,
      sets: Math.max(1, groups[id].count),
      reps: groups[id].reps,
      weightKg: groups[id].weight,
    }));
    const doSave = async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        await createTemplate(trimmed, payload);
        onChanged();
        Alert.alert('저장됨', `"${trimmed}" 루틴이 저장되었습니다.`);
      } catch {
        Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
      }
    };
    if (Alert.prompt) {
      Alert.prompt('루틴으로 저장', '루틴 이름을 입력하세요', (name?: string) => doSave(name ?? ''), 'plain-text', local.title ?? '');
    } else {
      doSave(local.title?.trim() || formatDateWithDay(local.date));
    }
  };

  // 종목 추가(과거 세션 대상) — 각 종목 마지막 기록을 기본값으로 1세트 추가
  const handleAddExercises = async (list: SelectableExercise[]) => {
    if (list.length === 0) return;
    if (local) {
      for (const ex of list) {
        const timeBased = ex.tracking_type === 'TIME';
        const prev = await getLastSessionSets(ex.id).catch(() => []);
        const w = timeBased ? 0 : (prev[0]?.weight_kg ?? 60);
        const r = timeBased ? 0 : (prev[0]?.reps ?? 10);
        await addWorkoutSet(local.id, ex.id, 1, w, r, epley(w, r), 'NORMAL', null, timeBased ? (prev[0]?.duration_sec ?? 30) : null).catch(() => {});
      }
      const s = await getSessionSets(local.id);
      setSets(s);
      onChanged();
    }
    setShowExercise(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const grouped = sets.reduce<Record<number, { exerciseId: number; name: string; brand: string | null; sets: SessionSetRow[] }>>(
    (acc, row) => {
      if (!acc[row.exercise_id]) acc[row.exercise_id] = { exerciseId: row.exercise_id, name: row.exercise_name, brand: row.brand, sets: [] };
      acc[row.exercise_id].sets.push(row);
      return acc;
    },
    {}
  );

  return (
    <>
      <Modal visible={!!session} animationType="slide">
        <SafeAreaView style={styles.safe}>
          <View style={styles.detailHeader}>
            <Pressable onPress={onClose}>
              <Text style={styles.modalBack}>✕ 닫기</Text>
            </Pressable>
            <Pressable onPress={() => setShowPicker(true)}>
              <Text style={styles.detailHeaderTitle}>
                {local ? `${formatDateWithDay(local.date)} ›` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={handleDeleteSession}>
              <Text style={styles.detailDelete}>삭제</Text>
            </Pressable>
          </View>
          <DatePickerSheet
            visible={showPicker}
            value={local?.date ?? todayStr()}
            onConfirm={(d) => { handleChangeDetailDate(d); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <TextInput
              style={styles.detailTitleInput}
              placeholder="운동 이름"
              placeholderTextColor="#48484A"
              value={title}
              onChangeText={setTitle}
            />
            {local?.tags ? (
              <View style={styles.tagBadgeRow}>
                {local.tags.split(',').filter(Boolean).map(t => (
                  <Text key={t} style={styles.tagBadge}>{t}</Text>
                ))}
              </View>
            ) : null}
            <TextInput
              style={styles.detailNoteInput}
              placeholder="세션 메모"
              placeholderTextColor="#48484A"
              value={note}
              onChangeText={setNote}
              multiline
            />
            {Object.values(grouped).map((group, i) => (
              <View key={i} style={styles.exerciseCard}>
                <View style={styles.exerciseCardHeader}>
                  <View>
                    <Text style={styles.exerciseName}>{group.name}</Text>
                    {group.brand && <Text style={styles.exerciseBrand}>{group.brand}</Text>}
                  </View>
                </View>
                {exNotes[group.exerciseId] ? (
                  <View style={styles.detailNoteChip}>
                    <Text style={styles.detailNoteChipText}>📝 {exNotes[group.exerciseId]}</Text>
                  </View>
                ) : null}
                <View style={styles.setHeader}>
                  <Text style={[styles.setCol, { flex: 0.5 }]}>SET</Text>
                  <Text style={styles.setCol}>무게({u})</Text>
                  <Text style={styles.setCol}>횟수</Text>
                  <Text style={styles.setCol}>추정 1RM</Text>
                </View>
                {group.sets.map((s) => (
                  <Swipeable
                    key={s.id}
                    ref={ref => {
                      if (ref) swipeRefs.current.set(s.id, ref);
                      else swipeRefs.current.delete(s.id);
                    }}
                    renderRightActions={() => (
                      <Pressable
                        style={styles.deleteAction}
                        onPress={() => {
                          swipeRefs.current.get(s.id)?.close();
                          handleDeleteDetailSet(s.id);
                        }}
                      >
                        <Text style={styles.deleteActionText}>삭제</Text>
                      </Pressable>
                    )}
                    rightThreshold={40}
                    overshootRight={false}
                  >
                    <View style={[styles.setRow, (s.set_type ?? 'NORMAL') === 'WARMUP' && styles.setRowWarmup]}>
                      <View style={[styles.setNum, { flex: 0.5 }]}>
                        {SET_TYPE_META[s.set_type ?? 'NORMAL'] ? (
                          <Text style={[styles.setTypeBadge, {
                            color: SET_TYPE_META[s.set_type ?? 'NORMAL']!.color,
                            borderColor: SET_TYPE_META[s.set_type ?? 'NORMAL']!.color,
                          }]}>
                            {SET_TYPE_META[s.set_type ?? 'NORMAL']!.label}
                          </Text>
                        ) : (
                          <Text style={styles.setNumText}>{s.set_order}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          style={styles.setInput}
                          value={String(toDisplay(s.weight_kg, unitKg))}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY_ID : undefined}
                          onChangeText={v => handleEditDetailSet(s.id, fromInput(parseFloat(v) || 0, unitKg), s.reps)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        {s.duration_sec != null ? (
                          <Text style={[styles.setInput, { color: '#FFFFFF' }]}>{s.duration_sec}초</Text>
                        ) : (
                          <TextInput
                            style={styles.setInput}
                            value={String(s.reps)}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY_ID : undefined}
                            onChangeText={v => handleEditDetailSet(s.id, s.weight_kg, parseInt(v) || 0)}
                          />
                        )}
                      </View>
                      <Text style={[styles.setReadOnly, { color: '#FF3B30' }]}>
                        {s.estimated_1rm ? `${toDisplay(s.estimated_1rm, unitKg)}${u}` : '-'}
                      </Text>
                    </View>
                  </Swipeable>
                ))}
                <Pressable style={styles.addSetBtn} onPress={() => addSetToDetail(group.exerciseId)}>
                  <Text style={styles.addSetText}>+ 세트 추가</Text>
                </Pressable>
              </View>
            ))}

            <Pressable style={styles.addExerciseBtn} onPress={() => setShowExercise(true)}>
              <Text style={styles.addExerciseBtnText}>+ 운동 추가</Text>
            </Pressable>

            <Pressable style={styles.detailSaveBtn} onPress={handleSaveDetail} disabled={saving}>
              <Text style={styles.detailSaveText}>{saving ? '저장 중…' : '저장'}</Text>
            </Pressable>
            <Pressable style={styles.detailTemplateBtn} onPress={handleSaveDetailAsTemplate}>
              <Text style={styles.detailTemplateText}>⭐ 루틴으로 저장</Text>
            </Pressable>
          </ScrollView>

          {/* 과거 세션 입력 키보드 완료 버튼 */}
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={KB_ACCESSORY_ID}>
              <View style={styles.kbAccessory}>
                <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
                  <Text style={styles.kbAccessoryText}>완료</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          )}
        </SafeAreaView>
      </Modal>

      {/* 운동 선택 모달 (과거 세션 종목 추가용) */}
      <ExerciseSelectModal
        visible={showExercise}
        onClose={() => setShowExercise(false)}
        onConfirm={handleAddExercises}
      />
    </>
  );
}
