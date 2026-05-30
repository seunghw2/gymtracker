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
  Platform,
  Keyboard,
  InputAccessoryView,
  ActivityIndicator,
  findNodeHandle,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
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
  updateSession,
  updateWorkoutSet,
  updateExerciseNote,
  upsertExerciseSessionNote,
  getSessionExerciseNotes,
  getTrainedExercises,
  get1RMHistory,
  getTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  getGyms,
  Exercise,
  SessionSummary,
  SessionSetRow,
  TrainedExercise,
  TemplateSummary,
  TrackingType,
  Gym,
} from '../../db/queries';
import DatePickerSheet from '../../components/DatePickerSheet';
import { formatDateWithDay } from '../../lib/date';
import { toDisplay, fromInput, unitLabel } from '../../lib/units';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_GYM_KEY = 'last_gym_id';
const BODY_TAGS = ['가슴', '등', '어깨', '하체', '팔', '코어', '유산소'];

// 운동 추가 모달에서 선택 가능한 종목(목록·최근 종목 공통)
type SelectableExercise = {
  id: number;
  name: string;
  brand: string | null;
  note?: string | null;
  tracking_type?: TrackingType;
};
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  MACHINE_BRANDS,
  MuscleGroup,
  EquipmentType,
} from '../../constants/exercises';
import { useWorkoutStore, useSettingsStore, ExerciseEntry, SetEntry, SetType, nextSetType } from '../../store/useStore';
import RestTimer from '../../components/RestTimer';
import NumPad from '../../components/NumPad';

type SelectStep = 'muscle' | 'equipment' | 'brand' | 'custom-brand' | 'list' | 'custom';

/** 세트 타입별 짧은 표시(W/D/F) + 색상. NORMAL은 표시 없음. */
const SET_TYPE_META: Record<SetType, { label: string; color: string } | null> = {
  NORMAL: null,
  WARMUP: { label: 'W', color: '#FF9F0A' },
  DROP: { label: 'D', color: '#BF5AF2' },
  FAILURE: { label: 'F', color: '#FF453A' },
};

function epley(weight: number, reps: number) {
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  return formatDateWithDay(dateStr);
}

const KB_ACCESSORY_ID = 'setInputDone';

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
    sessionTitle,
    sessionGymId,
    sessionTags,
    exercises,
    startSession,
    setSessionTitle,
    setSessionGym,
    setSessionTags,
    finishSession,
    addExercises,
    updateSet,
    cycleSetType,
    setExerciseNote,
    setExerciseSessionNote,
    setExercisePrevBest,
    addSetToExercise,
    prependWarmupSets,
    markSetDone,
    moveExercise,
    toggleTimeBased,
    removeSet,
    removeExercise,
    startRestTimer,
    restTimerActive,
  } = useWorkoutStore();
  const { restDurationSec, unitKg } = useSettingsStore();
  const u = unitLabel(unitKg);
  const elapsed = useElapsedTime(sessionStartTime);

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [selectStep, setSelectStep] = useState<SelectStep>('muscle');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
  const [customName, setCustomName] = useState('');
  const [customTracking, setCustomTracking] = useState<'REPS' | 'TIME'>('REPS');
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
  const [startName, setStartName] = useState('');
  const [startGymId, setStartGymId] = useState<number | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [showGymPicker, setShowGymPicker] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [detailTitle, setDetailTitle] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const [recents, setRecents] = useState<TrainedExercise[]>([]);
  const [detailExNotes, setDetailExNotes] = useState<Record<number, string>>({});
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [warmupExIdx, setWarmupExIdx] = useState<number | null>(null);
  const [warmupRows, setWarmupRows] = useState<{ percent: string; reps: string }[]>([]);
  const [warmupBase, setWarmupBase] = useState(0); // 기준 무게(kg)
  const [memoOpen, setMemoOpen] = useState<Record<number, boolean>>({});
  const [selectTarget, setSelectTarget] = useState<'active' | 'detail'>('active');
  const [selectedToAdd, setSelectedToAdd] = useState<Record<number, SelectableExercise>>({});
  const [detailSaving, setDetailSaving] = useState(false);
  const [summary, setSummary] = useState<{ volume: number; sets: number; exercises: number; prs: number; durationSec: number } | null>(null);
  // 앱 자체 숫자패드 편집 상태
  const [edit, setEdit] = useState<{ exIdx: number; setIdx: number; kind: 'weight' | 'reps' | 'duration' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Map<number, number>>(new Map());
  const rowRefs = useRef<Map<string, View>>(new Map());

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
      getTemplates().then(setTemplates).catch(() => {});
    }
  }, [activeSessionId]);

  useEffect(() => {
    getGyms().then(setGyms).catch(() => {});
  }, []);

  // 운동 중 화면 꺼짐 방지
  useEffect(() => {
    if (activeSessionId) {
      activateKeepAwakeAsync('workout').catch(() => {});
      return () => { deactivateKeepAwake('workout').catch(() => {}); };
    }
  }, [activeSessionId]);

  // 운동 추가 모달 열릴 때 최근 종목 로드(빠른 추가용)
  useEffect(() => {
    if (showExerciseModal) getTrainedExercises().then(setRecents).catch(() => {});
  }, [showExerciseModal]);

  const gymName = (id: number | null | undefined) => gyms.find(g => g.id === id)?.name ?? null;

  const handleStartWorkout = async () => {
    const date = getTodayStr();
    const sessionId = await createWorkoutSession(date, null, '');
    startSession(sessionId, date, null, null);
    setSessionNote('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // 진행 중 세션 헬스장 선택
  const handlePickSessionGym = (gymId: number | null) => {
    setSessionGym(gymId);
    setShowGymPicker(false);
    if (gymId != null) AsyncStorage.setItem(LAST_GYM_KEY, String(gymId)).catch(() => {});
    if (activeSessionId) updateSession(activeSessionId, { gymId }).catch(() => {});
  };

  // 진행 중 세션 부위 태그 토글
  const toggleSessionTag = (tag: string) => {
    const next = sessionTags.includes(tag) ? sessionTags.filter(t => t !== tag) : [...sessionTags, tag];
    setSessionTags(next);
    if (activeSessionId) updateSession(activeSessionId, { tags: next.join(',') }).catch(() => {});
  };

  // 지난 세션을 그대로 새 운동으로 불러와 시작
  const handleRepeatSession = async (session: SessionSummary) => {
    if (repeatLoading) return;
    setRepeatLoading(true);
    try {
      const [sets, trained] = await Promise.all([
        getSessionSets(session.id),
        getTrainedExercises().catch(() => [] as TrainedExercise[]),
      ]);
      if (sets.length === 0) {
        Alert.alert('불러올 수 없음', '이 운동에는 기록된 세트가 없습니다.');
        return;
      }
      const noteMap = new Map(trained.map(t => [t.id, t.note]));
      const typeMap = new Map(trained.map(t => [t.id, t.tracking_type]));
      const order: number[] = [];
      const groups: Record<number, ExerciseEntry> = {};
      for (const s of sets) {
        if (!groups[s.exercise_id]) {
          order.push(s.exercise_id);
          groups[s.exercise_id] = {
            exerciseId: s.exercise_id, exerciseName: s.exercise_name, brand: s.brand,
            sets: [], lastSets: [], note: noteMap.get(s.exercise_id) ?? null, sessionNote: '',
            timeBased: typeMap.get(s.exercise_id) === 'TIME',
          };
        }
        const g = groups[s.exercise_id];
        g.sets.push({ setOrder: g.sets.length + 1, weight_kg: s.weight_kg, reps: s.reps, done: false, setType: s.set_type, durationSec: s.duration_sec ?? undefined });
        g.lastSets!.push({ weight_kg: s.weight_kg, reps: s.reps });
      }
      const date = getTodayStr();
      const name = session.title || '';
      const newId = await createWorkoutSession(date, null, name);
      startSession(newId, date, name || null, null);
      setSessionNote('');
      const entries = order.map(id => groups[id]);
      addExercises(entries);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // PR 기준이 되는 역대 최고 1RM을 비동기로 채움
      const bests = await Promise.all(order.map(id => get1RMHistory(id).catch(() => [])));
      bests.forEach((hist, idx) => {
        const best = hist.reduce((m, r) => Math.max(m, r.estimated_1rm), 0);
        if (best > 0) setExercisePrevBest(idx, best);
      });
    } finally {
      setRepeatLoading(false);
    }
  };

  // 루틴(템플릿)으로 새 운동 시작
  const handleStartTemplate = async (tpl: TemplateSummary) => {
    if (repeatLoading) return;
    setRepeatLoading(true);
    try {
      const [detail, trained] = await Promise.all([
        getTemplate(tpl.id),
        getTrainedExercises().catch(() => [] as TrainedExercise[]),
      ]);
      const noteMap = new Map(trained.map(t => [t.id, t.note]));
      const typeMap = new Map(trained.map(t => [t.id, t.tracking_type]));
      const date = getTodayStr();
      const name = tpl.name;
      const newId = await createWorkoutSession(date, null, name);
      startSession(newId, date, name || null, null);
      setSessionNote('');
      const entries: ExerciseEntry[] = detail.exercises.map(te => {
        const timeBased = typeMap.get(te.exercise_id) === 'TIME';
        const sets: SetEntry[] = Array.from({ length: te.default_sets }, (_, i) => ({
          setOrder: i + 1, weight_kg: te.default_weight_kg, reps: te.default_reps, done: false, setType: 'NORMAL',
          durationSec: timeBased ? 30 : undefined,
        }));
        return {
          exerciseId: te.exercise_id, exerciseName: te.name, brand: te.brand,
          sets, lastSets: [], note: noteMap.get(te.exercise_id) ?? null, sessionNote: '', timeBased,
        };
      });
      addExercises(entries);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const bests = await Promise.all(detail.exercises.map(te => get1RMHistory(te.exercise_id).catch(() => [])));
      bests.forEach((hist, idx) => {
        const best = hist.reduce((m, r) => Math.max(m, r.estimated_1rm), 0);
        if (best > 0) setExercisePrevBest(idx, best);
      });
    } finally {
      setRepeatLoading(false);
    }
  };

  // 과거 세션을 루틴(템플릿)으로 저장
  const handleSaveDetailAsTemplate = () => {
    if (!detailSession || detailSets.length === 0) {
      Alert.alert('루틴 저장', '세트가 없는 운동입니다.');
      return;
    }
    const order: number[] = [];
    const groups: Record<number, { reps: number; weight: number; count: number }> = {};
    for (const s of detailSets) {
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
        getTemplates().then(setTemplates).catch(() => {});
        Alert.alert('저장됨', `"${trimmed}" 루틴이 저장되었습니다.`);
      } catch {
        Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
      }
    };
    if (Alert.prompt) {
      Alert.prompt('루틴으로 저장', '루틴 이름을 입력하세요', (name?: string) => doSave(name ?? ''), 'plain-text', detailSession.title ?? '');
    } else {
      doSave(detailSession.title?.trim() || formatDate(detailSession.date));
    }
  };

  const handleDeleteTemplate = (tpl: TemplateSummary) => {
    Alert.alert('루틴 삭제', `"${tpl.name}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteTemplate(tpl.id).catch(() => {});
        getTemplates().then(setTemplates).catch(() => {});
      } },
    ]);
  };

  const handleFinishWorkout = () => {
    Alert.alert('운동 완료', '오늘의 운동을 종료할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료', onPress: async () => {
          const durationSec = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
          if (activeSessionId && sessionStartTime) {
            await updateSessionDuration(activeSessionId, durationSec).catch(() => {});
          }
          // 종료 전 요약 계산
          const doneSets = exercises.flatMap(e => e.sets.filter(s => s.done));
          const volume = doneSets
            .filter(s => (s.setType ?? 'NORMAL') !== 'WARMUP')
            .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
          const prs = doneSets.filter(s => s.isPR).length;
          const exCount = exercises.filter(e => e.sets.some(s => s.done)).length;
          setSummary({ volume, sets: doneSets.length, exercises: exCount, prs, durationSec });
        },
      },
    ]);
  };

  const closeSummary = () => {
    setSummary(null);
    finishSession();
  };

  const handleCancelWorkout = () => {
    if (!activeSessionId) return;
    const id = activeSessionId;
    Alert.alert('운동 취소', '진행 중인 운동을 취소하고 기록을 삭제할까요?', [
      { text: '닫기', style: 'cancel' },
      {
        text: '취소', style: 'destructive', onPress: async () => {
          await deleteSession(id).catch(() => {});
          finishSession();
        },
      },
    ]);
  };

  const handleSessionTitleBlur = async () => {
    if (!activeSessionId) return;
    await updateSession(activeSessionId, { title: sessionTitle ?? '' }).catch(() => {});
  };

  const handleSessionNoteBlur = async () => {
    if (!activeSessionId) return;
    await updateSession(activeSessionId, { note: sessionNote }).catch(() => {});
  };

  const handleEditDoneSet = async (exIdx: number, setIdx: number) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    const orm = epley(s.weight_kg, s.reps);
    updateSet(exIdx, setIdx, { estimated_1rm: orm });
    if (s.done && s.setId) await updateWorkoutSet(s.setId, s.weight_kg, s.reps, s.setType ?? 'NORMAL').catch(() => {});
  };

  // 세트 번호 탭 → 타입 순환(일반→W→D→F). 이미 저장된 세트면 백엔드도 갱신.
  const handleCycleSetType = (exIdx: number, setIdx: number) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    cycleSetType(exIdx, setIdx);
    Haptics.selectionAsync();
    const next = nextSetType(s.setType);
    if (s.done && s.setId) {
      updateWorkoutSet(s.setId, s.weight_kg, s.reps, next).catch(() => {});
    }
  };

  // 워밍업 설정 모달 열기 (기준 무게 + 단계별 %/횟수)
  const handleAddWarmup = (exIdx: number) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    const working = ex.sets.find(s => (s.setType ?? 'NORMAL') !== 'WARMUP' && s.weight_kg > 0);
    const base = working?.weight_kg ?? ex.sets.find(s => s.weight_kg > 0)?.weight_kg ?? 0;
    setWarmupBase(base);
    setWarmupExIdx(exIdx);
    setWarmupRows([
      { percent: '40', reps: '10' },
      { percent: '60', reps: '6' },
      { percent: '80', reps: '3' },
    ]);
  };

  const warmupRound = (kg: number) => Math.max(0, Math.round(kg / 2.5) * 2.5);

  const applyWarmup = () => {
    if (warmupExIdx == null) return;
    const warmups = warmupRows
      .map(r => ({ pct: parseFloat(r.percent) || 0, reps: parseInt(r.reps) || 0 }))
      .filter(r => r.pct > 0 && r.reps > 0)
      .map(r => ({ weight_kg: warmupRound(warmupBase * r.pct / 100), reps: r.reps }));
    if (warmups.length > 0) prependWarmupSets(warmupExIdx, warmups);
    setWarmupExIdx(null);
    Haptics.selectionAsync();
  };

  // 무게 ±버튼 (표시단위 기준 kg=2.5 / lb=5)
  const weightStep = unitKg ? 2.5 : 5;
  const handleAdjustWeight = (exIdx: number, setIdx: number, deltaDisplay: number) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    const next = Math.max(0, toDisplay(s.weight_kg, unitKg) + deltaDisplay);
    const newKg = fromInput(next, unitKg);
    updateSet(exIdx, setIdx, { weight_kg: newKg, estimated_1rm: epley(newKg, s.reps) });
    Haptics.selectionAsync();
    if (s.done && s.setId) updateWorkoutSet(s.setId, newKg, s.reps, s.setType ?? 'NORMAL').catch(() => {});
  };

  // ── 앱 자체 숫자패드 ──────────────────────────────────────────
  const fieldValueStr = (s: SetEntry, kind: 'weight' | 'reps' | 'duration') => {
    if (kind === 'weight') return String(toDisplay(s.weight_kg, unitKg));
    if (kind === 'duration') return String(s.durationSec ?? 0);
    return String(s.reps);
  };

  const beginEdit = (exIdx: number, setIdx: number, kind: 'weight' | 'reps' | 'duration') => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    setEdit({ exIdx, setIdx, kind });
    setEditValue(fieldValueStr(s, kind));
    Haptics.selectionAsync();
    // 활성 종목 카드를 화면 상단 쪽으로 스크롤(숫자패드 가림 방지)
    const cy = cardY.current.get(exIdx);
    if (cy != null) setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, cy - 16), animated: true }), 60);
  };

  const commitEdit = (exIdx: number, setIdx: number, kind: 'weight' | 'reps' | 'duration', valStr: string) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    if (kind === 'weight') {
      const kg = fromInput(parseFloat(valStr) || 0, unitKg);
      updateSet(exIdx, setIdx, { weight_kg: kg, estimated_1rm: epley(kg, s.reps) });
      if (s.done && s.setId) updateWorkoutSet(s.setId, kg, s.reps, s.setType ?? 'NORMAL').catch(() => {});
    } else if (kind === 'reps') {
      const reps = parseInt(valStr) || 0;
      updateSet(exIdx, setIdx, { reps, estimated_1rm: epley(s.weight_kg, reps) });
      if (s.done && s.setId) updateWorkoutSet(s.setId, s.weight_kg, reps, s.setType ?? 'NORMAL').catch(() => {});
    } else {
      updateSet(exIdx, setIdx, { durationSec: parseInt(valStr) || 0 });
    }
  };

  const handleNumKey = (d: string) => {
    if (!edit) return;
    const allowDecimal = edit.kind === 'weight';
    let next = editValue;
    if (d === '.') {
      if (!allowDecimal || next.includes('.')) return;
      next = next === '' ? '0.' : next + '.';
    } else {
      next = (next === '0' ? '' : next) + d;
    }
    if (next.replace('.', '').length > 5) return;
    setEditValue(next);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, next);
  };

  const handleNumBackspace = () => {
    if (!edit) return;
    const next = editValue.slice(0, -1);
    setEditValue(next);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, next);
  };

  const handleNumStep = (delta: 1 | -1) => {
    if (!edit) return;
    const s = exercises[edit.exIdx]?.sets[edit.setIdx];
    if (!s) return;
    let nv: string;
    if (edit.kind === 'weight') {
      const cur = parseFloat(editValue);
      const base = Number.isFinite(cur) ? cur : toDisplay(s.weight_kg, unitKg);
      nv = String(Math.max(0, Math.round((base + delta * weightStep) * 100) / 100));
    } else {
      const cur = parseInt(editValue);
      const base = Number.isFinite(cur) ? cur : (edit.kind === 'duration' ? (s.durationSec ?? 0) : s.reps);
      nv = String(Math.max(0, base + delta));
    }
    setEditValue(nv);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, nv);
  };

  const handleNumNext = () => {
    if (!edit) return;
    const ex = exercises[edit.exIdx];
    const repsKind: 'reps' | 'duration' = ex?.timeBased ? 'duration' : 'reps';
    if (edit.kind === 'weight') {
      beginEdit(edit.exIdx, edit.setIdx, repsKind);
    } else {
      // 다음 세트의 무게로
      if (ex && edit.setIdx + 1 < ex.sets.length) beginEdit(edit.exIdx, edit.setIdx + 1, 'weight');
      else setEdit(null);
    }
  };

  // 세트번호 길게눌러 타입 직접 선택
  const handleSetTypeLongPress = (exIdx: number, setIdx: number) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    const setType = (t: SetType) => {
      updateSet(exIdx, setIdx, { setType: t });
      Haptics.selectionAsync();
      if (s.done && s.setId) updateWorkoutSet(s.setId, s.weight_kg, s.reps, t).catch(() => {});
    };
    Alert.alert('세트 타입 선택', undefined, [
      { text: '일반', onPress: () => setType('NORMAL') },
      { text: '워밍업 (W)', onPress: () => setType('WARMUP') },
      { text: '드롭세트 (D)', onPress: () => setType('DROP') },
      { text: '실패세트 (F)', onPress: () => setType('FAILURE') },
      { text: '취소', style: 'cancel' },
    ]);
  };

  // 종목 영구 메모 저장
  const handleExerciseNoteBlur = async (exIdx: number) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    await updateExerciseNote(ex.exerciseId, ex.note ?? '').catch(() => {});
  };

  // 세션별 종목 메모 저장
  const handleExerciseSessionNoteBlur = async (exIdx: number) => {
    const ex = exercises[exIdx];
    if (!ex || !activeSessionId) return;
    await upsertExerciseSessionNote(activeSessionId, ex.exerciseId, ex.sessionNote ?? '').catch(() => {});
  };

  const openExerciseSelect = (target: 'active' | 'detail' = 'active') => {
    setSelectTarget(target);
    setSelectStep('muscle');
    setSelectedMuscle(null);
    setSelectedEquipment(null);
    setSelectedBrand(null);
    setSearchText('');
    setSelectedToAdd({});
    setShowExerciseModal(true);
  };

  // 다중 선택: 종목을 탭하면 선택 토글(체크 표시), 하단 '추가(N)' 버튼으로 일괄 추가
  const toggleSelect = (ex: SelectableExercise) => {
    setSelectedToAdd(prev => {
      const next = { ...prev };
      if (next[ex.id]) delete next[ex.id];
      else next[ex.id] = ex;
      return next;
    });
    Haptics.selectionAsync();
  };

  const buildExerciseEntry = async (ex: SelectableExercise): Promise<ExerciseEntry> => {
    const timeBased = ex.tracking_type === 'TIME';
    const [prev, rmHist] = await Promise.all([
      getLastSessionSets(ex.id),
      get1RMHistory(ex.id).catch(() => []),
    ]);
    // 지난 세션 값으로 입력칸 프리필 + 원본은 힌트용으로 보존
    const initSets: SetEntry[] = prev.length > 0
      ? prev.map((s, i) => ({ setOrder: i + 1, weight_kg: s.weight_kg, reps: s.reps, done: false, setType: 'NORMAL', durationSec: timeBased ? (s.duration_sec ?? 30) : undefined }))
      : [{ setOrder: 1, weight_kg: timeBased ? 0 : 60, reps: timeBased ? 0 : 10, done: false, setType: 'NORMAL', durationSec: timeBased ? 30 : undefined }];
    const lastSets = prev.map(s => ({ weight_kg: s.weight_kg, reps: s.reps }));
    // PR 판정 기준: 종목 추가 시점까지의 역대 최고 1RM
    const prevBest1rm = rmHist.reduce((m, r) => Math.max(m, r.estimated_1rm), 0);
    return {
      exerciseId: ex.id,
      exerciseName: ex.name,
      brand: ex.brand,
      sets: initSets,
      lastSets,
      note: ex.note ?? null,
      sessionNote: '',
      prevBest1rm,
      timeBased,
    };
  };

  const confirmAddExercises = async () => {
    const list = Object.values(selectedToAdd);
    if (list.length === 0) return;
    if (selectTarget === 'detail') {
      if (detailSession) {
        for (const ex of list) {
          const timeBased = ex.tracking_type === 'TIME';
          const prev = await getLastSessionSets(ex.id).catch(() => []);
          const w = timeBased ? 0 : (prev[0]?.weight_kg ?? 60);
          const r = timeBased ? 0 : (prev[0]?.reps ?? 10);
          await addWorkoutSet(detailSession.id, ex.id, 1, w, r, epley(w, r), 'NORMAL', null, timeBased ? (prev[0]?.duration_sec ?? 30) : null).catch(() => {});
        }
        const sets = await getSessionSets(detailSession.id);
        setDetailSets(sets);
        getSessionHistory().then(setHistory);
      }
    } else {
      const entries = await Promise.all(list.map(buildExerciseEntry));
      addExercises(entries);
    }
    setSelectedToAdd({});
    setShowExerciseModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // 과거 세션에 세트 추가 (해당 종목 마지막 세트 복사)
  const addSetToDetail = async (exerciseId: number) => {
    if (!detailSession) return;
    const groupSets = detailSets.filter(s => s.exercise_id === exerciseId);
    const last = groupSets[groupSets.length - 1];
    const w = last?.weight_kg ?? 60;
    const r = last?.reps ?? 10;
    const nextOrder = (last?.set_order ?? 0) + 1;
    await addWorkoutSet(detailSession.id, exerciseId, nextOrder, w, r, epley(w, r), last?.set_type ?? 'NORMAL').catch(() => {});
    const sets = await getSessionSets(detailSession.id);
    setDetailSets(sets);
    getSessionHistory().then(setHistory);
  };

  // 과거 세션 편집 내용(세트 무게/횟수 + 제목/메모) 일괄 저장
  const handleSaveDetail = async () => {
    if (!detailSession || detailSaving) return;
    setDetailSaving(true);
    try {
      await Promise.all(detailSets.map(s => updateWorkoutSet(s.id, s.weight_kg, s.reps, s.set_type).catch(() => {})));
      await updateSession(detailSession.id, { title: detailTitle, note: detailNote }).catch(() => {});
      setDetailSession({ ...detailSession, title: detailTitle, note: detailNote });
      getSessionHistory().then(setHistory);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장됨', '변경사항이 저장되었습니다.');
    } finally {
      setDetailSaving(false);
    }
  };

  const handleCompleteSet = async (exIdx: number, setIdx: number) => {
    if (!activeSessionId) return;
    const ex = exercises[exIdx];
    const s = ex.sets[setIdx];
    const timed = !!ex.timeBased;
    // 빈 세트 방지: 시간기반은 시간, 그 외는 횟수 필요(무게 0은 맨몸운동 허용)
    if (timed ? (s.durationSec ?? 0) <= 0 : s.reps <= 0) {
      Alert.alert('입력 확인', timed ? '시간(초)을 입력하세요.' : '횟수를 입력하세요.');
      return;
    }
    const repsVal = timed ? 0 : s.reps;
    const orm = timed ? 0 : epley(s.weight_kg, s.reps);
    const setId = await addWorkoutSet(activeSessionId, ex.exerciseId, s.setOrder, s.weight_kg, repsVal, orm, s.setType ?? 'NORMAL', null, timed ? (s.durationSec ?? 0) : null);
    // PR: 시간기반/워밍업 제외, 종목 역대 최고 1RM을 넘으면
    const isPR = !timed
      && (s.setType ?? 'NORMAL') !== 'WARMUP'
      && (ex.prevBest1rm ?? 0) > 0
      && orm > (ex.prevBest1rm ?? 0);
    markSetDone(exIdx, setIdx, orm, setId, isPR);
    if (isPR) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // 같은 종목에 남은 미완료 세트가 있으면 해당 카드를 보기 좋게 스크롤(키보드는 안 띄움)
    const hasMore = ex.sets.some((st, j) => j !== setIdx && !st.done);
    if (hasMore) {
      const cy = cardY.current.get(exIdx);
      if (cy != null) setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, cy - 16), animated: true }), 80);
    }

    const nextSet = ex.sets[setIdx + 1];
    const nextLabel = nextSet ? `${toDisplay(nextSet.weight_kg, unitKg)}${u} × ${nextSet.reps}회` : undefined;
    // 워밍업 세트는 짧은 휴식(30초), 그 외는 종목 기본값
    const restSec = (s.setType ?? 'NORMAL') === 'WARMUP' ? 30 : await getExerciseRest(ex.exerciseId, restDurationSec);
    startRestTimer(restSec, { nextLabel });
  };

  const saveCustomExercise = async () => {
    if (!customName.trim() || !selectedMuscle || !selectedEquipment) return;
    await addCustomExercise(customName.trim(), selectedMuscle, selectedEquipment, selectedBrand ?? undefined, customTracking);
    setCustomName('');
    setCustomTracking('REPS');
    setSelectStep('list');
    loadExercises();
  };

  const openDetail = async (session: SessionSummary) => {
    const [sets, notes] = await Promise.all([
      getSessionSets(session.id),
      getSessionExerciseNotes(session.id).catch(() => []),
    ]);
    setDetailSets(sets);
    const noteMap: Record<number, string> = {};
    for (const n of notes) if (n.note) noteMap[n.exercise_id] = n.note;
    setDetailExNotes(noteMap);
    setDetailSession(session);
    setDetailTitle(session.title ?? '');
    setDetailNote(session.note ?? '');
  };

  const closeDetail = () => {
    setDetailSession(null);
    setDetailExNotes({});
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
    await updateSession(detailSession.id, { date: newDate });
    setDetailSession({ ...detailSession, date: newDate });
    getSessionHistory().then(setHistory);
  };

  const handleDetailTitleBlur = async () => {
    if (!detailSession) return;
    await updateSession(detailSession.id, { title: detailTitle }).catch(() => {});
    setDetailSession({ ...detailSession, title: detailTitle });
    getSessionHistory().then(setHistory);
  };

  const handleDetailNoteBlur = async () => {
    if (!detailSession) return;
    await updateSession(detailSession.id, { note: detailNote }).catch(() => {});
    setDetailSession({ ...detailSession, note: detailNote });
  };

  const handleEditDetailSet = (setId: number, weight: number, reps: number) => {
    setDetailSets(prev => prev.map(s =>
      s.id === setId ? { ...s, weight_kg: weight, reps, estimated_1rm: epley(weight, reps) } : s
    ));
  };

  const handleEditDetailSetBlur = async (setId: number) => {
    const s = detailSets.find(d => d.id === setId);
    if (!s) return;
    await updateWorkoutSet(setId, s.weight_kg, s.reps).catch(() => {});
    getSessionHistory().then(setHistory);
  };

  const groupedDetailSets = detailSets.reduce<Record<number, { exerciseId: number; name: string; brand: string | null; sets: SessionSetRow[] }>>(
    (acc, row) => {
      if (!acc[row.exercise_id]) acc[row.exercise_id] = { exerciseId: row.exercise_id, name: row.exercise_name, brand: row.brand, sets: [] };
      acc[row.exercise_id].sets.push(row);
      return acc;
    },
    {}
  );

  const renderGymPicker = () => (
    <Modal visible={showGymPicker} transparent animationType="slide" onRequestClose={() => setShowGymPicker(false)}>
      <Pressable style={styles.gymBackdrop} onPress={() => setShowGymPicker(false)}>
        <Pressable style={styles.gymSheet} onPress={() => {}}>
          <Text style={styles.gymSheetTitle}>헬스장 선택</Text>
          <Pressable style={styles.gymItem} onPress={() => handlePickSessionGym(null)}>
            <Text style={styles.gymItemText}>없음</Text>
            {sessionGymId === null && <Text style={styles.gymCheck}>✓</Text>}
          </Pressable>
          {gyms.map(g => (
            <Pressable key={g.id} style={styles.gymItem} onPress={() => handlePickSessionGym(g.id)}>
              <Text style={styles.gymItemText}>{g.name}</Text>
              {sessionGymId === g.id && <Text style={styles.gymCheck}>✓</Text>}
            </Pressable>
          ))}
          {gyms.length === 0 && (
            <Text style={styles.gymEmpty}>설정에서 헬스장을 추가하세요</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderExerciseModal = () => (
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
          <ScrollView contentContainerStyle={styles.modalContent}>
            {recents.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.quickAddTitle}>최근 종목 · 빠른 추가</Text>
                <View style={styles.chipWrap}>
                  {recents.slice(0, 8).map(r => {
                    const on = !!selectedToAdd[r.id];
                    return (
                      <Pressable key={r.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleSelect(r)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{on ? '✓ ' : ''}{r.name}</Text>
                        {r.brand && <Text style={styles.chipBrand} numberOfLines={1}>{r.brand}</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <Text style={styles.quickAddTitle}>부위로 찾기</Text>
            <View style={styles.muscleGrid}>
              {MUSCLE_GROUPS.map(mg => (
                <Pressable key={mg} style={styles.muscleBtn} onPress={() => { setSelectedMuscle(mg); setSelectStep('equipment'); }}>
                  <Text style={styles.muscleBtnText}>{mg}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
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
            contentContainerStyle={[styles.modalContent, Object.keys(selectedToAdd).length > 0 && { paddingBottom: 110 }]}
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
            renderItem={({ item }) => {
              const on = !!selectedToAdd[item.id];
              return (
                <Pressable style={[styles.exItem, on && styles.exItemOn]} onPress={() => toggleSelect(item)}>
                  <View>
                    <Text style={styles.exName}>{item.name}</Text>
                    {item.brand && <Text style={styles.exBrand}>{item.brand}</Text>}
                  </View>
                  <Text style={[styles.exArrow, on && styles.exCheck]}>{on ? '✓' : '＋'}</Text>
                </Pressable>
              );
            }}
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
            <Text style={styles.customFormLabel}>측정 방식</Text>
            <View style={styles.trackingRow}>
              {(['REPS', 'TIME'] as const).map(t => (
                <Pressable
                  key={t}
                  style={[styles.trackingBtn, customTracking === t && styles.trackingBtnOn]}
                  onPress={() => setCustomTracking(t)}
                >
                  <Text style={[styles.trackingText, customTracking === t && styles.trackingTextOn]}>
                    {t === 'REPS' ? '횟수·무게' : '시간(초)'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.saveBtn, !customName.trim() && { opacity: 0.4 }]}
              onPress={saveCustomExercise}
              disabled={!customName.trim()}
            >
              <Text style={styles.saveBtnText}>저장하고 추가</Text>
            </Pressable>
          </View>
        )}

        {/* 다중 선택 일괄 추가 바 */}
        {Object.keys(selectedToAdd).length > 0 && (
          <View style={styles.addBar}>
            <Pressable style={styles.addBarBtn} onPress={confirmAddExercises}>
              <Text style={styles.addBarBtnText}>추가 ({Object.keys(selectedToAdd).length}개)</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );

  if (!activeSessionId) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.homeContent}>
          {/* 시작 — 바로 시작, 이름·헬스장·태그는 진행 중에 */}
          <Pressable style={styles.startBtnBig} onPress={handleStartWorkout}>
            <Text style={styles.startBtnText}>운동 시작</Text>
          </Pressable>

          {/* 내 루틴 */}
          {templates.length > 0 && (
            <>
              <Text style={styles.historyTitle}>내 루틴</Text>
              {templates.map(tpl => (
                <View key={tpl.id} style={styles.templateCard}>
                  <Pressable style={{ flex: 1 }} onPress={() => handleStartTemplate(tpl)} disabled={repeatLoading}>
                    <Text style={styles.templateName}>{tpl.name}</Text>
                    <Text style={styles.templateMeta} numberOfLines={1}>
                      {tpl.exercise_names.join(', ') || '비어있음'} · {tpl.exercise_count}종목
                    </Text>
                  </Pressable>
                  <Pressable style={styles.templateStartBtn} onPress={() => handleStartTemplate(tpl)} disabled={repeatLoading}>
                    <Text style={styles.templateStartText}>시작</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteTemplate(tpl)} hitSlop={8} style={styles.templateDelBtn}>
                    <Text style={styles.templateDelText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {/* 히스토리 */}
          {history.length > 0 && (
            <>
              <Text style={styles.historyTitle}>지난 운동</Text>
              {history.map(session => (
                <Pressable key={session.id} style={styles.historyCard} onPress={() => openDetail(session)}>
                  <View style={styles.historyCardTop}>
                    <Text style={styles.historyDate}>{session.title?.trim() || formatDate(session.date)}</Text>
                    {session.duration_sec ? (
                      <Text style={styles.historyDuration}>{formatDuration(session.duration_sec)}</Text>
                    ) : null}
                  </View>
                  {session.title?.trim() ? (
                    <Text style={styles.historySubDate}>{formatDate(session.date)}</Text>
                  ) : null}
                  <Text style={styles.historyExercises} numberOfLines={1}>
                    {session.exercise_names || '운동 없음'}
                  </Text>
                  {session.tags ? (
                    <View style={styles.tagBadgeRow}>
                      {session.tags.split(',').filter(Boolean).map(t => (
                        <Text key={t} style={styles.tagBadge}>{t}</Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.historyBottom}>
                    <Text style={styles.historyMeta}>
                      {session.exercise_count}가지 운동 · {session.set_count}세트
                    </Text>
                    {session.set_count > 0 && (
                      <Pressable
                        style={styles.repeatBtn}
                        onPress={() => handleRepeatSession(session)}
                        disabled={repeatLoading}
                        hitSlop={6}
                      >
                        <Text style={styles.repeatBtnText}>🔁 이대로 시작</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>

        {/* 세션 상세 모달 */}
        <Modal visible={!!detailSession} animationType="slide">
          <SafeAreaView style={styles.safe}>
            <View style={styles.detailHeader}>
              <Pressable onPress={closeDetail}>
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
            <DatePickerSheet
              visible={showDetailPicker}
              value={detailSession?.date ?? getTodayStr()}
              onConfirm={(d) => { handleChangeDetailDate(d); setShowDetailPicker(false); }}
              onClose={() => setShowDetailPicker(false)}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <TextInput
                style={styles.detailTitleInput}
                placeholder="운동 이름"
                placeholderTextColor="#48484A"
                value={detailTitle}
                onChangeText={setDetailTitle}
              />
              {gymName(detailSession?.gym_id) ? (
                <Text style={styles.detailGym}>📍 {gymName(detailSession?.gym_id)}</Text>
              ) : null}
              {detailSession?.tags ? (
                <View style={styles.tagBadgeRow}>
                  {detailSession.tags.split(',').filter(Boolean).map(t => (
                    <Text key={t} style={styles.tagBadge}>{t}</Text>
                  ))}
                </View>
              ) : null}
              <TextInput
                style={styles.detailNoteInput}
                placeholder="세션 메모"
                placeholderTextColor="#48484A"
                value={detailNote}
                onChangeText={setDetailNote}
                multiline
              />
              {Object.values(groupedDetailSets).map((group, i) => (
                <View key={i} style={styles.exerciseCard}>
                  <View style={styles.exerciseCardHeader}>
                    <View>
                      <Text style={styles.exerciseName}>{group.name}</Text>
                      {group.brand && <Text style={styles.exerciseBrand}>{group.brand}</Text>}
                    </View>
                  </View>
                  {detailExNotes[group.exerciseId] ? (
                    <View style={styles.detailNoteChip}>
                      <Text style={styles.detailNoteChipText}>📝 {detailExNotes[group.exerciseId]}</Text>
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
                        <Text style={[styles.setReadOnly, { color: '#30D158' }]}>
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

              <Pressable style={styles.addExerciseBtn} onPress={() => openExerciseSelect('detail')}>
                <Text style={styles.addExerciseBtnText}>+ 운동 추가</Text>
              </Pressable>

              <Pressable style={styles.detailSaveBtn} onPress={handleSaveDetail} disabled={detailSaving}>
                <Text style={styles.detailSaveText}>{detailSaving ? '저장 중…' : '저장'}</Text>
              </Pressable>
              <Pressable style={styles.detailTemplateBtn} onPress={handleSaveDetailAsTemplate}>
                <Text style={styles.detailTemplateText}>⭐ 루틴으로 저장</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </Modal>

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

        {/* 운동 선택 모달 (과거 세션 종목 추가용) */}
        {renderExerciseModal()}

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
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.sessionTitleInput}
            placeholder={sessionDate ? formatDate(sessionDate) : '운동 이름'}
            placeholderTextColor="#8E8E93"
            value={sessionTitle ?? ''}
            onChangeText={setSessionTitle}
            onEndEditing={handleSessionTitleBlur}
          />
          <Text style={styles.sessionElapsed}>
            {(sessionDate ? formatDate(sessionDate) : '')}{gymName(sessionGymId) ? ` · ${gymName(sessionGymId)}` : ''} · {elapsed}
          </Text>
        </View>
        <Pressable style={styles.cancelBtn} onPress={handleCancelWorkout}>
          <Text style={styles.cancelBtnText}>취소</Text>
        </Pressable>
        <Pressable style={styles.finishBtn} onPress={handleFinishWorkout}>
          <Text style={styles.finishBtnText}>완료</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContent, restTimerActive && styles.scrollContentRest, edit && styles.scrollContentEditing]}>
        <Pressable style={styles.gymChip} onPress={() => setShowGymPicker(true)}>
          <Text style={styles.gymChipText}>📍 {gymName(sessionGymId) ?? '헬스장 선택'}</Text>
        </Pressable>
        <View style={styles.tagRow}>
          {BODY_TAGS.map(t => {
            const on = sessionTags.includes(t);
            return (
              <Pressable key={t} style={[styles.tagChip, on && styles.tagChipOn]} onPress={() => toggleSessionTag(t)}>
                <Text style={[styles.tagChipText, on && styles.tagChipTextOn]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.sessionNoteInput}
          placeholder="세션 메모 (선택)"
          placeholderTextColor="#48484A"
          value={sessionNote}
          onChangeText={setSessionNote}
          onEndEditing={handleSessionNoteBlur}
          multiline
        />

        {exercises.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>아래 버튼으로 운동을 추가하세요</Text>
          </View>
        )}

        {exercises.map((ex, exIdx) => {
          const bestORM = ex.sets
            .filter(s => s.done && s.estimated_1rm)
            .reduce((m, s) => Math.max(m, s.estimated_1rm ?? 0), 0);
          // 워밍업 제외 볼륨 + 완료 세트 수
          const doneSets = ex.sets.filter(s => s.done);
          const volume = doneSets
            .filter(s => (s.setType ?? 'NORMAL') !== 'WARMUP')
            .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);

          return (
            <View
              key={exIdx}
              style={styles.exerciseCard}
              onLayout={e => cardY.current.set(exIdx, e.nativeEvent.layout.y)}
            >
              <View style={styles.exerciseCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                  {ex.brand && <Text style={styles.exerciseBrand}>{ex.brand}</Text>}
                  {(volume > 0 || doneSets.length > 0) && (
                    <Text style={styles.exVolume}>
                      볼륨 {Math.round(toDisplay(volume, unitKg)).toLocaleString()}{u} · {doneSets.length}세트
                    </Text>
                  )}
                </View>
                <View style={styles.exerciseHeaderRight}>
                  {bestORM > 0 && (
                    <Text style={styles.ormBadge}>1RM {toDisplay(bestORM, unitKg)}{u}</Text>
                  )}
                  <Pressable
                    onPress={() => moveExercise(exIdx, -1)}
                    disabled={exIdx === 0}
                    hitSlop={6}
                    style={[styles.moveBtn, exIdx === 0 && styles.moveBtnDisabled]}
                  >
                    <Text style={styles.moveBtnText}>↑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => moveExercise(exIdx, 1)}
                    disabled={exIdx === exercises.length - 1}
                    hitSlop={6}
                    style={[styles.moveBtn, exIdx === exercises.length - 1 && styles.moveBtnDisabled]}
                  >
                    <Text style={styles.moveBtnText}>↓</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRemoveExercise(exIdx)} hitSlop={8} style={styles.exDeleteBtn}>
                    <Text style={styles.exDeleteText}>✕</Text>
                  </Pressable>
                </View>
              </View>

              {ex.timeBased && (
                <Text style={styles.timeBadge}>⏱ 시간 기반</Text>
              )}

              {/* 메모 (기본 접힘 — 내용 있으면 자동 펼침) */}
              {(memoOpen[exIdx] || ex.note || ex.sessionNote) ? (
                <>
                  <TextInput
                    style={styles.exNoteInput}
                    placeholder="📌 종목 메모 (항상 표시)"
                    placeholderTextColor="#48484A"
                    value={ex.note ?? ''}
                    onChangeText={t => setExerciseNote(exIdx, t)}
                    onEndEditing={() => handleExerciseNoteBlur(exIdx)}
                    multiline
                  />
                  <TextInput
                    style={styles.exSessionNoteInput}
                    placeholder="📝 오늘 메모 (이 세션만)"
                    placeholderTextColor="#48484A"
                    value={ex.sessionNote ?? ''}
                    onChangeText={t => setExerciseSessionNote(exIdx, t)}
                    onEndEditing={() => handleExerciseSessionNoteBlur(exIdx)}
                    multiline
                  />
                </>
              ) : (
                <Pressable style={styles.memoToggle} onPress={() => setMemoOpen(m => ({ ...m, [exIdx]: true }))}>
                  <Text style={styles.memoToggleText}>＋ 메모</Text>
                </Pressable>
              )}

              <View style={styles.setHeader}>
                <Text style={[styles.setCol, { flex: 0.5 }]}>SET</Text>
                <Text style={[styles.setCol, { flex: 1.4 }]}>무게({u})</Text>
                <Text style={styles.setCol}>{ex.timeBased ? '시간(초)' : '횟수'}</Text>
                <Text style={[styles.setCol, { flex: 0.5 }]}>✓</Text>
              </View>

              {ex.sets.map((s, setIdx) => {
                const meta = SET_TYPE_META[s.setType ?? 'NORMAL'];
                const isWarmup = (s.setType ?? 'NORMAL') === 'WARMUP';
                const prev = ex.lastSets?.[setIdx];
                const activeKind = edit && edit.exIdx === exIdx && edit.setIdx === setIdx ? edit.kind : null;
                return (
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
                    <View
                      ref={r => { const k = `${exIdx}-${setIdx}`; if (r) rowRefs.current.set(k, r); else rowRefs.current.delete(k); }}
                      style={[styles.setRow, s.done && styles.setRowDone, isWarmup && styles.setRowWarmup]}
                    >
                      {/* 세트 번호/타입 — 탭: 순환 / 길게: 직접 선택 */}
                      <Pressable
                        style={[styles.setNum, { flex: 0.5 }]}
                        onPress={() => handleCycleSetType(exIdx, setIdx)}
                        onLongPress={() => handleSetTypeLongPress(exIdx, setIdx)}
                        hitSlop={6}
                      >
                        {meta ? (
                          <Text style={[styles.setTypeBadge, { color: meta.color, borderColor: meta.color }]}>
                            {meta.label}
                          </Text>
                        ) : (
                          <Text style={styles.setNumText}>{s.setOrder}</Text>
                        )}
                      </Pressable>
                      <View style={{ flex: 1.4 }}>
                        <Pressable
                          style={[styles.fieldBtn, activeKind === 'weight' && styles.fieldActive]}
                          onPress={() => beginEdit(exIdx, setIdx, 'weight')}
                        >
                          <Text style={styles.fieldText}>
                            {activeKind === 'weight' ? (editValue || '0') : String(toDisplay(s.weight_kg, unitKg))}
                          </Text>
                          {activeKind === 'weight' && <View style={styles.caret} />}
                        </Pressable>
                        {prev && <Text style={styles.prevHint}>이전 {toDisplay(prev.weight_kg, unitKg)}</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        {ex.timeBased ? (
                          <Pressable
                            style={[styles.fieldBtn, activeKind === 'duration' && styles.fieldActive]}
                            onPress={() => beginEdit(exIdx, setIdx, 'duration')}
                          >
                            <Text style={styles.fieldText}>
                              {activeKind === 'duration' ? (editValue || '0') : String(s.durationSec ?? 0)}
                            </Text>
                            {activeKind === 'duration' && <View style={styles.caret} />}
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.fieldBtn, activeKind === 'reps' && styles.fieldActive]}
                            onPress={() => beginEdit(exIdx, setIdx, 'reps')}
                          >
                            <Text style={styles.fieldText}>
                              {activeKind === 'reps' ? (editValue || '0') : String(s.reps)}
                            </Text>
                            {activeKind === 'reps' && <View style={styles.caret} />}
                          </Pressable>
                        )}
                        {prev && !ex.timeBased && <Text style={styles.prevHint}>×{prev.reps}</Text>}
                      </View>
                      <Pressable
                        style={[styles.checkBtn, { flex: 0.5 }]}
                        onPress={() => !s.done && handleCompleteSet(exIdx, setIdx)}
                      >
                        <Text style={[styles.checkText, s.done && styles.checkDone, s.isPR && styles.checkPR]}>
                          {s.isPR ? '🏆' : s.done ? '✓' : '○'}
                        </Text>
                      </Pressable>
                    </View>
                  </Swipeable>
                );
              })}

              <View style={styles.setActionsRow}>
                <Pressable style={[styles.addSetBtn, { flex: 1 }]} onPress={() => addSetToExercise(exIdx)}>
                  <Text style={styles.addSetText}>+ 세트 추가</Text>
                </Pressable>
                <Pressable style={styles.warmupBtn} onPress={() => handleAddWarmup(exIdx)}>
                  <Text style={styles.warmupBtnText}>🔥 워밍업</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Pressable style={styles.addExerciseBtn} onPress={() => openExerciseSelect('active')}>
          <Text style={styles.addExerciseBtnText}>+ 운동 추가</Text>
        </Pressable>
      </ScrollView>

      {/* 하단 고정 휴식 타이머 (활성 시에만 렌더) */}
      <View style={[styles.restDock, edit && styles.restDockEditing]} pointerEvents="box-none">
        <RestTimer />
      </View>

      {/* 앱 자체 숫자패드 */}
      {edit && (
        <NumPad
          allowDecimal={edit.kind === 'weight'}
          label={edit.kind === 'weight' ? `무게 (${u})` : edit.kind === 'duration' ? '시간 (초)' : '횟수'}
          onKey={handleNumKey}
          onBackspace={handleNumBackspace}
          onStep={handleNumStep}
          onNext={handleNumNext}
          onDone={() => setEdit(null)}
        />
      )}

      {/* 숫자 키보드 위 완료 버튼 (iOS) */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KB_ACCESSORY_ID}>
          <View style={styles.kbAccessory}>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
              <Text style={styles.kbAccessoryText}>완료</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* 운동 완료 요약 모달 */}
      <Modal visible={summary !== null} transparent animationType="fade">
        <View style={styles.summaryOverlay}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>운동 완료! 💪</Text>
            {summary && (
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{Math.round(toDisplay(summary.volume, unitKg)).toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>총 볼륨({u})</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.sets}</Text>
                  <Text style={styles.summaryLabel}>세트</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.exercises}</Text>
                  <Text style={styles.summaryLabel}>종목</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatDuration(summary.durationSec)}</Text>
                  <Text style={styles.summaryLabel}>시간</Text>
                </View>
                {summary.prs > 0 && (
                  <View style={[styles.summaryItem, { width: '100%' }]}>
                    <Text style={[styles.summaryValue, { color: '#FF9F0A' }]}>🏆 개인기록 {summary.prs}개</Text>
                  </View>
                )}
              </View>
            )}
            <Pressable style={styles.summaryBtn} onPress={closeSummary}>
              <Text style={styles.summaryBtnText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 워밍업 설정 모달 */}
      <Modal visible={warmupExIdx !== null} transparent animationType="slide" onRequestClose={() => setWarmupExIdx(null)}>
        <Pressable style={styles.gymBackdrop} onPress={() => setWarmupExIdx(null)}>
          <Pressable style={styles.warmupSheet} onPress={() => {}}>
            <Text style={styles.warmupTitle}>워밍업 설정</Text>
            <View style={styles.warmupBaseRow}>
              <Text style={styles.warmupBaseLabel}>기준 무게</Text>
              <View style={styles.warmupStepper}>
                <Pressable style={styles.stepBtn} onPress={() => setWarmupBase(b => Math.max(0, fromInput(toDisplay(b, unitKg) - weightStep, unitKg)))} hitSlop={4}><Text style={styles.stepText}>−</Text></Pressable>
                <Text style={styles.warmupValue}>{toDisplay(warmupBase, unitKg)}{u}</Text>
                <Pressable style={styles.stepBtn} onPress={() => setWarmupBase(b => fromInput(toDisplay(b, unitKg) + weightStep, unitKg))} hitSlop={4}><Text style={styles.stepText}>+</Text></Pressable>
              </View>
            </View>
            <Text style={styles.warmupHint}>기준 무게 대비 % · 횟수 (아래 미리보기 적용 무게)</Text>
            {warmupRows.map((row, i) => {
              const pct = parseFloat(row.percent) || 0;
              const applied = toDisplay(warmupRound(warmupBase * pct / 100), unitKg);
              const adj = (field: 'percent' | 'reps', delta: number, min: number, max: number) =>
                setWarmupRows(rows => rows.map((r, j) => {
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
                  <Pressable onPress={() => setWarmupRows(rows => rows.filter((_, j) => j !== i))} hitSlop={8} style={styles.warmupDel}>
                    <Text style={styles.warmupDelText}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
            <Pressable style={styles.warmupAddRow} onPress={() => setWarmupRows(rows => [...rows, { percent: '50', reps: '8' }])}>
              <Text style={styles.warmupAddRowText}>+ 단계 추가</Text>
            </Pressable>
            <View style={styles.warmupActions}>
              <Pressable style={styles.warmupCancel} onPress={() => setWarmupExIdx(null)}>
                <Text style={styles.warmupCancelText}>취소</Text>
              </Pressable>
              <Pressable style={styles.warmupApply} onPress={applyWarmup}>
                <Text style={styles.warmupApplyText}>추가</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {renderExerciseModal()}
      {renderGymPicker()}

    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },

  homeContent: { padding: 20, paddingBottom: 40 },
  startBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
  },
  startNameInput: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 4,
  },
  startMetaRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 16 },
  startMetaBtn: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  startMetaText: { color: '#FFFFFF', fontSize: 14 },
  startTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  startDate: { color: '#8E8E93', fontSize: 14, marginTop: 4 },
  startBtn: {
    backgroundColor: '#30D158',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  startBtnBig: { backgroundColor: '#30D158', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 28 },

  historySubDate: { color: '#8E8E93', fontSize: 12, marginBottom: 4 },
  detailTitleInput: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 6,
    marginBottom: 4,
  },
  detailGym: { color: '#8E8E93', fontSize: 14, marginBottom: 8 },
  detailNoteInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 44,
    marginBottom: 16,
  },
  sessionTitleInput: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', paddingVertical: 2 },
  gymChip: { alignSelf: 'flex-start', backgroundColor: '#2C2C2E', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8 },
  gymChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tagChip: { backgroundColor: '#2C2C2E', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tagChipOn: { backgroundColor: '#0A84FF' },
  tagChipText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  tagChipTextOn: { color: '#FFFFFF' },
  tagBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagBadge: { color: '#5AB0FF', fontSize: 11, fontWeight: '600', backgroundColor: '#0A2A4A', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  sessionNoteInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 44,
    marginBottom: 16,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    marginRight: 8,
  },
  cancelBtnText: { color: '#FF453A', fontSize: 15, fontWeight: '600' },

  gymBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  gymSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  gymSheetTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  gymItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  gymItemText: { color: '#FFFFFF', fontSize: 16 },
  gymCheck: { color: '#30D158', fontSize: 16, fontWeight: '700' },
  gymEmpty: { color: '#48484A', fontSize: 14, paddingVertical: 12 },

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
  scrollContentEditing: { paddingBottom: 300 },
  restDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  restDockEditing: { bottom: 252 },

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
  exVolume: { color: '#30D158', fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] },
  exNoteInput: {
    backgroundColor: '#23201A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#E5C07B',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 2,
  },
  exSessionNoteInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 10,
  },
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
  setRowWarmup: { backgroundColor: '#2A2620' },
  setNum: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  setNumText: {
    color: '#AEAEB2', textAlign: 'center', fontSize: 13, fontWeight: '600',
    minWidth: 26, paddingVertical: 3,
    borderWidth: 1, borderColor: '#48484A', borderRadius: 6, overflow: 'hidden',
  },
  setTypeBadge: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 22,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  setInput: {
    width: '100%',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 30, height: 34, borderRadius: 8, backgroundColor: '#3A3A3C',
    alignItems: 'center', justifyContent: 'center',
  },
  stepText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  setInputStep: {
    flex: 1,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  fieldBtn: {
    paddingVertical: 9,
    marginHorizontal: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fieldActive: { borderColor: '#30D158', backgroundColor: '#14331F' },
  fieldText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  caret: { width: 2, height: 20, backgroundColor: '#30D158', marginLeft: 2, borderRadius: 1 },
  prevHint: {
    color: '#6E6E73',
    fontSize: 10,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  checkBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  checkText: { color: '#48484A', fontSize: 20 },
  checkDone: { color: '#30D158' },
  checkPR: { fontSize: 18 },

  moveBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.3 },
  moveBtnText: { color: '#8E8E93', fontSize: 15, fontWeight: '700' },

  detailNoteChip: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  detailNoteChipText: { color: '#E5E5EA', fontSize: 13 },

  kbAccessory: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  kbAccessoryText: { color: '#30D158', fontSize: 16, fontWeight: '700' },

  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  templateName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  templateMeta: { color: '#8E8E93', fontSize: 12, marginTop: 3 },
  templateStartBtn: { backgroundColor: '#30D158', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  templateStartText: { color: '#000000', fontSize: 14, fontWeight: '700' },
  templateDelBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  templateDelText: { color: '#8E8E93', fontSize: 13, fontWeight: '700' },
  detailSaveBtn: {
    backgroundColor: '#30D158',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  detailSaveText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  detailTemplateBtn: {
    borderWidth: 1,
    borderColor: '#FF9F0A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  detailTemplateText: { color: '#FF9F0A', fontSize: 15, fontWeight: '600' },
  timeBadge: { color: '#0A84FF', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  memoToggle: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 2, marginBottom: 6 },
  memoToggleText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  setActionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  warmupBtn: {
    backgroundColor: '#2A2620',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  warmupBtnText: { color: '#FF9F0A', fontSize: 14, fontWeight: '600' },
  summaryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 28 },
  summaryCard: { backgroundColor: '#1C1C1E', borderRadius: 24, padding: 28 },
  summaryTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryItem: { width: '50%', alignItems: 'center', paddingVertical: 12 },
  summaryValue: { color: '#30D158', fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  summaryBtn: { backgroundColor: '#30D158', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  summaryBtnText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  warmupSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  warmupTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  warmupHint: { color: '#8E8E93', fontSize: 13, marginTop: 4, marginBottom: 14 },
  warmupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  warmupInput: {
    backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: '#FFFFFF', fontSize: 16, minWidth: 70, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  warmupUnit: { color: '#8E8E93', fontSize: 15 },
  warmupStepper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2C2C2E', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
  warmupValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  warmupBaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 6 },
  warmupBaseLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  warmupApplied: { color: '#30D158', fontSize: 13, fontWeight: '600', minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  warmupDel: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' },
  warmupDelText: { color: '#8E8E93', fontSize: 13, fontWeight: '700' },
  warmupAddRow: { paddingVertical: 10, alignItems: 'center' },
  warmupAddRowText: { color: '#FF9F0A', fontSize: 14, fontWeight: '600' },
  warmupActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  warmupCancel: { flex: 1, backgroundColor: '#2C2C2E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  warmupCancelText: { color: '#8E8E93', fontSize: 16, fontWeight: '600' },
  warmupApply: { flex: 1, backgroundColor: '#FF9F0A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  warmupApplyText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  historyBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  repeatBtn: {
    backgroundColor: '#1A3D27',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  repeatBtnText: { color: '#30D158', fontSize: 13, fontWeight: '600' },

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
  trackingRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  trackingBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2C2C2E', alignItems: 'center' },
  trackingBtnOn: { backgroundColor: '#0A84FF' },
  trackingText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  trackingTextOn: { color: '#FFFFFF' },
  quickAddTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#1A3D27',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: '48%',
  },
  chipOn: { backgroundColor: '#30D158' },
  chipText: { color: '#30D158', fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#0A1F12' },
  chipBrand: { color: '#6E9E7E', fontSize: 11, marginTop: 1 },
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
  exItemOn: { backgroundColor: '#16301F', borderWidth: 1, borderColor: '#30D158' },
  exName: { color: '#FFFFFF', fontSize: 16 },
  exBrand: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  exArrow: { color: '#8E8E93', fontSize: 24 },
  exCheck: { color: '#30D158', fontWeight: '800' },
  addBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  addBarBtn: {
    backgroundColor: '#30D158',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBarBtnText: { color: '#0A1F12', fontSize: 17, fontWeight: '800' },
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
