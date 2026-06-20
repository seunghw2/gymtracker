import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useRouter } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  InputAccessoryView,
  ActivityIndicator,
  findNodeHandle,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import {
  getExercises,
  addCustomExercise,
  createWorkoutSession,
  addWorkoutSet,
  getLastSessionSets,
  completeSession,
  getSessionHistory,
  getSessionSets,
  getExerciseRest,
  setExerciseRest,
  getExerciseWarmupRest,
  setExerciseWarmupRest,
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
  getSetting,
  setSetting,
  getBodyTags,
  setBodyTags,
  getExerciseRmBasis,
  setExerciseRmBasis,
  getExerciseRmMode,
  setExerciseRmMode,
  convertRm,
  Exercise,
  SessionSummary,
  SessionSetRow,
  TrainedExercise,
  TemplateSummary,
  TrackingType,
} from '../db/queries';
import DatePickerSheet from '../components/DatePickerSheet';
import SessionCard from '../components/SessionCard';
import RulerPicker from '../components/RulerPicker';
import { useUiStore } from '../store/useUiStore';
import { formatDateWithDay, todayStr } from '../lib/date';
import { logError } from '../lib/log';
import { toDisplay, fromInput, unitLabel } from '../lib/units';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';


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
} from '../constants/exercises';
import { useWorkoutStore, useSettingsStore, ExerciseEntry, SetEntry, SetType, nextSetType } from '../store/useStore';
import RmBasisSheet, { RmMode } from '../components/RmBasisSheet';
import NumPad from '../components/NumPad';
import HeaderTimerButton from '../components/HeaderTimerButton';
import ExerciseEditSheet from '../components/ExerciseEditSheet';
import WorkoutCoachBanner from '../components/WorkoutCoachBanner';
import { useRestRemaining, fmtClock } from '../hooks/useRestRemaining';
import { playSetDoneSound } from '../lib/sound';
import { buildExerciseEntry } from '../lib/exerciseEntry';
import { epley, formatDuration } from '../lib/format';
import { refreshWorkoutReminder } from '../lib/reminders';
import { styles } from './workout.styles';

type SelectStep = 'muscle' | 'equipment' | 'brand' | 'custom-brand' | 'list' | 'custom';

/** 세트 타입별 짧은 표시(W/D/F) + 색상. NORMAL은 표시 없음. */
const SET_TYPE_META: Record<SetType, { label: string; color: string } | null> = {
  NORMAL: null,
  WARMUP: { label: 'W', color: '#FF9F0A' },
  DROP: { label: 'D', color: '#BF5AF2' },
  FAILURE: { label: 'F', color: '#FF453A' },
};

function getTodayStr() {
  return todayStr();
}

function formatDate(dateStr: string) {
  return formatDateWithDay(dateStr);
}

const KB_ACCESSORY_ID = 'setInputDone';

// 휴식 시간 표기: 60초 미만은 "Ns", 이상은 "m:ss"
function fmtRest(sec: number): string {
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function useElapsedTime(startTime: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const {
    activeSessionId,
    sessionDate,
    sessionStartTime,
    sessionTitle,
    sessionTags,
    exercises,
    startSession,
    setSessionTitle,
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
    unmarkSetDone,
    reorderExercise,
    toggleTimeBased,
    removeSet,
    removeExercise,
    startRestTimer,
    stopRestTimer,
    restTimerActive,
    restTimerEnd,
    restNextLabel,
    adjustRestTimer,
  } = useWorkoutStore();
  const { restDurationSec, unitKg } = useSettingsStore();
  const u = unitLabel(unitKg);
  const elapsed = useElapsedTime(sessionStartTime);
  const restRemaining = useRestRemaining(restTimerActive, restTimerEnd);

  // 인라인 휴식 바(스트롱 스타일): 어떤 세트 직후 휴식이 도는지 추적
  const [restAnchor, setRestAnchor] = useState<{ ex: number; set: number } | null>(null);
  const [restTotal, setRestTotal] = useState(0);
  const [restControlOpen, setRestControlOpen] = useState(false);
  useEffect(() => { if (!restTimerActive) { setRestAnchor(null); setRestControlOpen(false); } }, [restTimerActive]);

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
  const [showTags, setShowTags] = useState(false);
  const [showNote, setShowNote] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [autoTagPrompt, setAutoTagPrompt] = useState(true);
  const [finishAfterTags, setFinishAfterTags] = useState(false);
  const [bodyTags, setBodyTagsState] = useState<string[]>([]);
  const [tagEdit, setTagEdit] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [detailTitle, setDetailTitle] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const [recents, setRecents] = useState<TrainedExercise[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [searchAll, setSearchAll] = useState<Exercise[]>([]);
  const [favIds, setFavIds] = useState<number[]>([]);
  const [detailExNotes, setDetailExNotes] = useState<Record<number, string>>({});
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [warmupExIdx, setWarmupExIdx] = useState<number | null>(null);
  const [warmupRows, setWarmupRows] = useState<{ percent: string; reps: string }[]>([]);
  const [warmupBase, setWarmupBase] = useState(0); // 기준 무게(kg)
  // 운동 카드 액션 메뉴 + 휴식 시간 다이얼 시트
  const [cardMenuIdx, setCardMenuIdx] = useState<number | null>(null);
  const [editExIdx, setEditExIdx] = useState<number | null>(null);
  const setExerciseInfo = useWorkoutStore(s => s.setExerciseInfo);
  const [rmPickerIdx, setRmPickerIdx] = useState<number | null>(null);
  const [restPickerIdx, setRestPickerIdx] = useState<number | null>(null);
  const [restMain, setRestMain] = useState<number>(90);
  const [restWarm, setRestWarm] = useState<number>(30);
  const [restTab, setRestTab] = useState<'main' | 'warm'>('main');
  const [selectTarget, setSelectTarget] = useState<'active' | 'detail'>('active');
  const [selectedToAdd, setSelectedToAdd] = useState<Record<number, SelectableExercise>>({});
  const [detailSaving, setDetailSaving] = useState(false);
  const [summary, setSummary] = useState<{ volume: number; sets: number; exercises: number; prs: number; durationSec: number } | null>(null);
  // 앱 자체 숫자패드 편집 상태
  const [edit, setEdit] = useState<{ exIdx: number; setIdx: number; kind: 'weight' | 'reps' | 'duration' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const replaceOnNextRef = useRef(true); // 숫자패드 첫 입력 시 기존 값 교체
  const listRef = useRef<any>(null);
  const noteDraftRef = useRef(''); // 종목 메모 입력 중 임시값(타이핑마다 스토어 갱신 방지)
  const rowRefs = useRef<Map<string, View>>(new Map());
  const scrollY = useRef(0);
  const [rmBasisMap, setRmBasisMap] = useState<Record<number, number>>({});
  const [rmModeMap, setRmModeMap] = useState<Record<number, RmMode>>({});

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

  // 세션 카드 "운동 수정" → 운동 탭으로 넘어와 편집 화면 열기
  const editTarget = useUiStore(s => s.editTarget);
  const clearEditTarget = useUiStore(s => s.clearEditTarget);
  useEffect(() => {
    if (editTarget && !activeSessionId) {
      openDetail(editTarget);
      clearEditTarget();
    }
  }, [editTarget, activeSessionId]);

  // 숫자패드 열림 상태를 전역에 알려 전역 휴식 타이머가 위로 비켜서게 함
  const setNumPadOpen = useUiStore(s => s.setNumPadOpen);
  useEffect(() => {
    setNumPadOpen(edit != null);
    return () => setNumPadOpen(false);
  }, [edit, setNumPadOpen]);

  useEffect(() => {
    getSetting('show_session_note', '1').then(v => setShowNote(v !== '0')).catch(() => {});
    getSetting('auto_tag_prompt', '1').then(v => setAutoTagPrompt(v !== '0')).catch(() => {});
    getBodyTags().then(setBodyTagsState).catch(() => {});
  }, []);

  // 세션 운동들의 종목별 기준 RM(반복수·모드) 로드
  useEffect(() => {
    Array.from(new Set(exercises.map(e => e.exerciseId))).forEach(id => {
      if (rmBasisMap[id] === undefined) {
        getExerciseRmBasis(id).then(n => setRmBasisMap(m => ({ ...m, [id]: n }))).catch(() => {});
        getExerciseRmMode(id).then(mo => setRmModeMap(m => ({ ...m, [id]: mo }))).catch(() => {});
      }
    });
  }, [exercises]);

  const addBodyTag = () => {
    const t = newTag.trim();
    if (!t || bodyTags.includes(t)) { setNewTag(''); return; }
    const next = [...bodyTags, t];
    setBodyTagsState(next);
    setNewTag('');
    setBodyTags(next).catch(() => {});
  };

  const removeBodyTag = (t: string) => {
    const next = bodyTags.filter(x => x !== t);
    setBodyTagsState(next);
    setBodyTags(next).catch(() => {});
  };

  // 운동 중 화면 꺼짐 방지
  useEffect(() => {
    if (activeSessionId) {
      activateKeepAwakeAsync('workout').catch(() => {});
      return () => { deactivateKeepAwake('workout').catch(() => {}); };
    }
  }, [activeSessionId]);

  // 운동 추가 모달 열릴 때 최근 종목·전체 목록·즐겨찾기 로드
  useEffect(() => {
    if (showExerciseModal) {
      setModalSearch('');
      getTrainedExercises().then(setRecents).catch(() => {});
      getExercises().then(setSearchAll).catch(() => {});
      getSetting('fav_exercises', '').then(v => {
        setFavIds(v ? v.split(',').map(Number).filter(Boolean) : []);
      }).catch(() => {});
    }
  }, [showExerciseModal]);

  const toggleFav = (id: number) => {
    setFavIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setSetting('fav_exercises', next.join(',')).catch(() => {});
      return next;
    });
    Haptics.selectionAsync();
  };

  const confirmRmBasis = (exIdx: number, reps: number, mode: RmMode) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    setRmBasisMap(m => ({ ...m, [ex.exerciseId]: reps }));
    setRmModeMap(m => ({ ...m, [ex.exerciseId]: mode }));
    setExerciseRmBasis(ex.exerciseId, reps).catch(() => {});
    setExerciseRmMode(ex.exerciseId, mode).catch(() => {});
    // TODO: 'estimated' 모드의 환산 표시를 뱃지/통계에 실제 연결
  };

  const handleStartWorkout = async () => {
    const date = getTodayStr();
    const sessionId = await createWorkoutSession(date, '');
    startSession(sessionId, date, null);
    setSessionNote('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // 진행 중 세션 부위 태그 토글 — 세션 이름도 선택 부위로 자동 설정
  const toggleSessionTag = (tag: string) => {
    const next = sessionTags.includes(tag) ? sessionTags.filter(t => t !== tag) : [...sessionTags, tag];
    setSessionTags(next);
    const autoTitle = next.join('·');
    setSessionTitle(autoTitle);
    if (activeSessionId) updateSession(activeSessionId, { tags: next.join(','), title: autoTitle }).catch(() => {});
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
      const newId = await createWorkoutSession(date, name);
      startSession(newId, date, name || null);
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
    // 부위 미선택이면 부위 선택 팝업을 먼저 띄우고, 거기서 마무리
    if (autoTagPrompt && sessionTags.length === 0) {
      setFinishAfterTags(true);
      setShowTags(true);
      return;
    }
    proceedFinish();
  };

  const proceedFinish = () => {
    Alert.alert('운동 완료', '오늘의 운동을 종료할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '완료', onPress: async () => {
          const durationSec = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
          if (activeSessionId) {
            await completeSession(activeSessionId, durationSec).catch(() => {});
          }
          refreshWorkoutReminder().catch(() => {});  // 운동했으니 다음 리마인더를 뒤로 미룸
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
    if (s.done && s.setId) await updateWorkoutSet(s.setId, s.weight_kg, s.reps, s.setType ?? 'NORMAL').catch(e => logError('handleEditDoneSet:updateWorkoutSet', e));
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

  // 휴식 시간 다이얼 시트 열기 (본세트·워밍업 현재값 로드)
  const openRestPicker = async (exIdx: number) => {
    const ex = exercises[exIdx];
    if (!ex) return;
    const [main, warm] = await Promise.all([
      getExerciseRest(ex.exerciseId, restDurationSec).catch(() => restDurationSec),
      getExerciseWarmupRest(ex.exerciseId, 30).catch(() => 30),
    ]);
    setRestMain(main);
    setRestWarm(warm);
    setRestTab('main');
    setRestPickerIdx(exIdx);
  };

  // 휴식 시간 저장 후 닫기 (네트워크 저장은 닫을 때 한 번)
  const closeRestPicker = async () => {
    const idx = restPickerIdx;
    setRestPickerIdx(null);
    if (idx == null) return;
    const ex = exercises[idx];
    if (!ex) return;
    await Promise.all([
      setExerciseRest(ex.exerciseId, restMain).catch(() => {}),
      setExerciseWarmupRest(ex.exerciseId, restWarm).catch(() => {}),
    ]);
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
    Keyboard.dismiss(); // 메모 등 시스템 키보드 닫고 앱 내 숫자패드 표시
    setEdit({ exIdx, setIdx, kind });
    setEditValue(fieldValueStr(s, kind));
    replaceOnNextRef.current = true; // 첫 키 입력 시 기존 값 비우고 새로 입력
    Haptics.selectionAsync();
    // 편집하는 세트 행이 숫자패드 위에 보이도록 스크롤(행 기준 정밀)
    setTimeout(() => {
      const node = rowRefs.current.get(`${exIdx}-${setIdx}`);
      node?.measure((_x, _y, _w, h, _px, py) => {
        const winH = Dimensions.get('window').height;
        const padTop = winH - 320; // 숫자패드 상단 추정선
        const overflow = (py + h + 12) - padTop;
        if (overflow > 0) listRef.current?.scrollToOffset({ offset: scrollY.current + overflow, animated: true });
      });
    }, 80);
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
    if (replaceOnNextRef.current) { next = ''; replaceOnNextRef.current = false; }
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
    replaceOnNextRef.current = false;
    const next = editValue.slice(0, -1);
    setEditValue(next);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, next);
  };

  const handleNumStep = (delta: 1 | -1) => {
    if (!edit) return;
    replaceOnNextRef.current = false;
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
    await addWorkoutSet(detailSession.id, exerciseId, nextOrder, w, r, epley(w, r), last?.set_type ?? 'NORMAL').catch(e => logError('addSetToDetail:addWorkoutSet', e));
    const sets = await getSessionSets(detailSession.id);
    setDetailSets(sets);
    getSessionHistory().then(setHistory);
  };

  // 과거 세션 편집 내용(세트 무게/횟수 + 제목/메모) 일괄 저장
  const handleSaveDetail = async () => {
    if (!detailSession || detailSaving) return;
    setDetailSaving(true);
    try {
      await Promise.all(detailSets.map(s => updateWorkoutSet(s.id, s.weight_kg, s.reps, s.set_type).catch(e => logError('handleSaveDetail:updateWorkoutSet', e))));
      await updateSession(detailSession.id, { title: detailTitle, note: detailNote }).catch(() => {});
      setDetailSession({ ...detailSession, title: detailTitle, note: detailNote });
      getSessionHistory().then(setHistory);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('저장됨', '변경사항이 저장되었습니다.');
    } finally {
      setDetailSaving(false);
    }
  };

  // 완료 체크 해제: DB에서 세트 삭제 후 미완료로 되돌림
  const handleUncompleteSet = async (exIdx: number, setIdx: number) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s?.done) return;
    if (s.setId) await deleteWorkoutSet(s.setId).catch(e => logError('handleUncompleteSet:deleteWorkoutSet', e));
    unmarkSetDone(exIdx, setIdx);
    stopRestTimer(); // 완료로 시작된 휴식 타이머 취소
    Haptics.selectionAsync();
  };

  const handleCompleteSet = async (exIdx: number, setIdx: number) => {
    if (!activeSessionId) return;
    Keyboard.dismiss(); // 메모 등 시스템 키보드가 떠 있으면 닫기
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
    let setId: number;
    try {
      setId = await addWorkoutSet(activeSessionId, ex.exerciseId, s.setOrder, s.weight_kg, repsVal, orm, s.setType ?? 'NORMAL', null, timed ? (s.durationSec ?? 0) : null);
    } catch (e) {
      // 서버 저장 실패 시 완료 처리하지 않고 사용자에게 알림(서버-로컬 desync 방지)
      logError('handleCompleteSet:addWorkoutSet', e);
      Alert.alert('저장 실패', '세트를 저장하지 못했습니다. 네트워크를 확인하고 다시 시도해주세요.');
      return;
    }
    // PR: 시간기반/워밍업 제외, 종목 역대 최고 1RM을 넘으면
    const isPR = !timed
      && (s.setType ?? 'NORMAL') !== 'WARMUP'
      && (ex.prevBest1rm ?? 0) > 0
      && orm > (ex.prevBest1rm ?? 0);
    markSetDone(exIdx, setIdx, orm, setId, isPR);
    playSetDoneSound();
    if (isPR) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // 같은 종목에 남은 미완료 세트가 있으면 해당 카드를 보기 좋게 스크롤(키보드는 안 띄움)
    const hasMore = ex.sets.some((st, j) => j !== setIdx && !st.done);
    if (hasMore) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: exIdx, viewPosition: 0, viewOffset: 16, animated: true }), 80);
    }

    const nextSet = ex.sets[setIdx + 1];
    const nextLabel = nextSet ? `${toDisplay(nextSet.weight_kg, unitKg)}${u} × ${nextSet.reps}회` : undefined;
    // 워밍업/본세트 휴식을 종목별로 따로 적용
    const restSec = (s.setType ?? 'NORMAL') === 'WARMUP'
      ? await getExerciseWarmupRest(ex.exerciseId, 30)
      : await getExerciseRest(ex.exerciseId, restDurationSec);
    startRestTimer(restSec, { nextLabel });
    setRestTotal(restSec);
    setRestAnchor({ ex: exIdx, set: setIdx });
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
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <TextInput
                style={styles.searchInput}
                placeholder="종목 검색"
                placeholderTextColor="#48484A"
                value={modalSearch}
                onChangeText={setModalSearch}
                clearButtonMode="while-editing"
              />
            </View>
            {modalSearch.trim() ? (
              <FlatList
                data={searchAll.filter(e => e.name.toLowerCase().includes(modalSearch.trim().toLowerCase()))}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.modalContent, Object.keys(selectedToAdd).length > 0 && { paddingBottom: 110 }]}
                renderItem={({ item }) => {
                  const on = !!selectedToAdd[item.id];
                  return (
                    <View style={[styles.exItem, on && styles.exItemOn]}>
                      <Pressable style={styles.exItemMain} onPress={() => toggleSelect(item)}>
                        <Text style={styles.exName} numberOfLines={1}>{on ? '✓ ' : ''}{item.name}</Text>
                        {item.brand && <Text style={styles.exBrand} numberOfLines={1}>{item.brand}</Text>}
                      </Pressable>
                      <Pressable onPress={() => toggleFav(item.id)} hitSlop={8}>
                        <Text style={styles.favStar}>{favIds.includes(item.id) ? '⭐' : '☆'}</Text>
                      </Pressable>
                    </View>
                  );
                }}
              />
            ) : (
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {searchAll.filter(e => favIds.includes(e.id)).length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.quickAddTitle}>⭐ 즐겨찾기</Text>
                    <View style={styles.chipWrap}>
                      {searchAll.filter(e => favIds.includes(e.id)).map(f => {
                        const on = !!selectedToAdd[f.id];
                        return (
                          <Pressable key={f.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleSelect(f)}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{on ? '✓ ' : ''}{f.name}</Text>
                            {f.brand && <Text style={styles.chipBrand} numberOfLines={1}>{f.brand}</Text>}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
                {recents.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.quickAddTitle}>최근 종목 · 빠른 추가</Text>
                    <View style={styles.chipWrap}>
                      {recents.slice(0, 6).map(r => {
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
              <Text style={[styles.choiceText, { color: '#FF3B30' }]}>+ 직접 등록</Text>
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
          {/* 헤더 — 좌측 접기, 우측 휴식 타이머 버튼 */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="닫기">
              <Text style={{ color: '#8E8E93', fontSize: 22, fontWeight: '700' }}>⌄</Text>
            </Pressable>
            <HeaderTimerButton />
          </View>
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
                <SessionCard
                  key={session.id}
                  session={session}
                  onChanged={() => { getSessionHistory().then(setHistory); getTemplates().then(setTemplates); }}
                />
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
      {/* 상단 고정 바 — 스크롤해도 유지(휴식 타이머 버튼 · 경과/휴식 · 완료) */}
      <View style={styles.stickyBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ paddingRight: 6, paddingVertical: 4 }} accessibilityLabel="운동 접기">
          <Text style={{ color: '#8E8E93', fontSize: 22, fontWeight: '700' }}>⌄</Text>
        </Pressable>
        <View style={[styles.stickyElapsed, { flex: 1 }]}>
          <View style={styles.stickyDot} />
          <Text style={styles.stickyElapsedText}>{elapsed}</Text>
        </View>
        <Pressable style={styles.stickyFinish} onPress={handleFinishWorkout}>
          <Text style={styles.stickyFinishText}>완료</Text>
        </Pressable>
      </View>
      <DraggableFlatList
        ref={listRef}
        data={exercises}
        keyExtractor={(ex) => String(ex.exerciseId)}
        onDragEnd={({ from, to }) => reorderExercise(from, to)}
        activationDistance={12}
        contentContainerStyle={[styles.scrollContent, edit && styles.scrollContentEditing]}
        keyboardShouldPersistTaps="handled"
        onScrollOffsetChange={(off) => { scrollY.current = off; }}
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={(
          <>
        {/* 헤더(제목 수정 가능·날짜·취소) — 스크롤 시 함께 사라짐 */}
        <View style={styles.sessionHeader}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.sessionTitleInput}
              value={sessionTitle ?? ''}
              onChangeText={setSessionTitle}
              onEndEditing={handleSessionTitleBlur}
              placeholder={sessionDate ? formatDate(sessionDate) : '운동 제목'}
              placeholderTextColor="#8E8E93"
              returnKeyType="done"
              numberOfLines={1}
              inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY_ID : undefined}
            />
            {sessionDate && <Text style={styles.sessionDateSub}>{formatDate(sessionDate)}</Text>}
          </View>
          <Pressable style={styles.cancelBtn} onPress={handleCancelWorkout}>
            <Text style={styles.cancelBtnText}>취소</Text>
          </Pressable>
        </View>
        <View style={styles.metaRow}>
          <Pressable style={styles.metaChip} onPress={() => setShowTags(true)}>
            <Text style={[styles.metaChipText, sessionTags.length === 0 && styles.tagButtonPlaceholder]} numberOfLines={1}>
              🏷 {sessionTags.length > 0 ? sessionTags.join('·') : '부위'}
            </Text>
          </Pressable>
          {showNote && (
            <Pressable style={[styles.metaChip, noteOpen && styles.metaChipOn]} onPress={() => setNoteOpen(o => !o)}>
              <Text style={[styles.metaChipText, !sessionNote.trim() && !noteOpen && styles.tagButtonPlaceholder]} numberOfLines={1}>
                📝 {sessionNote.trim() ? sessionNote.trim() : '메모'}
              </Text>
            </Pressable>
          )}
        </View>
        {showNote && noteOpen && (
          <TextInput
            style={styles.sessionNoteInput}
            placeholder="세션 메모 (선택)"
            placeholderTextColor="#48484A"
            value={sessionNote}
            onChangeText={setSessionNote}
            onEndEditing={handleSessionNoteBlur}
            inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY_ID : undefined}
            multiline
            autoFocus
          />
        )}

        <WorkoutCoachBanner />

        {exercises.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>아래 버튼으로 운동을 추가하세요</Text>
          </View>
        )}
          </>
        )}
        ListFooterComponent={(
          <Pressable style={styles.addExerciseBtn} onPress={() => router.push('/exercise-add')}>
            <Text style={styles.addExerciseBtnText}>+ 운동 추가</Text>
          </Pressable>
        )}
        renderItem={({ item: ex, getIndex, drag, isActive }: RenderItemParams<ExerciseEntry>) => {
          const exIdx = getIndex() ?? 0;
          const bestORM = ex.sets
            .filter(s => s.done && s.estimated_1rm)
            .reduce((m, s) => Math.max(m, s.estimated_1rm ?? 0), 0);

          return (
            <View style={[styles.exerciseCard, isActive && styles.exerciseCardDragging]}>
              <View style={styles.exerciseCardHeader}>
                <Pressable
                  onPressIn={drag}
                  disabled={isActive}
                  hitSlop={12}
                  style={[styles.dragHandle, { marginRight: 10 }]}
                >
                  <Text style={styles.dragHandleText}>≡</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
                  {ex.brand && <Text style={styles.exerciseBrand}>{ex.brand}</Text>}
                  {(() => {
                    const basisN = rmBasisMap[ex.exerciseId] ?? 10;
                    const hasPrev = (ex.prevBest1rm ?? 0) > 0;
                    // 실제로 기준 반복수(basisN)를 수행한 완료 세트가 있으면 그 최대 무게를 "실측"으로 우선 표시.
                    // (없을 때만 Epley로 다른 세트에서 환산)
                    const actualBasisKg = ex.sets
                      .filter(s => s.done && !ex.timeBased && s.reps === basisN)
                      .reduce((m, s) => Math.max(m, s.weight_kg), 0);
                    const hasActual = actualBasisKg > 0;
                    const rmKind = hasActual ? '실측' : '환산';
                    const curKg = hasActual ? actualBasisKg : convertRm(bestORM, basisN);
                    const curD = toDisplay(curKg, unitKg);
                    const prevD = toDisplay(convertRm(ex.prevBest1rm ?? 0, basisN), unitKg);
                    const diff = Math.round((curD - prevD) * 10) / 10;
                    // 체크 후: 이전 → 현재 + 증감을 함께 표시 (이전 기록 유지)
                    if (bestORM > 0) {
                      return (
                        <Pressable onPress={() => setRmPickerIdx(exIdx)} hitSlop={6}>
                          <Text style={styles.exVolume}>
                            {hasPrev ? `이전 ${basisN}RM ${prevD}${u} → ${rmKind} ` : `${rmKind} ${basisN}RM `}{curD}{u}
                            {hasPrev && diff !== 0 ? (
                              <Text style={{ color: diff > 0 ? '#30D158' : '#FF453A', fontWeight: '700' }}>{'  '}{diff > 0 ? '▲' : '▼'}{Math.abs(diff)}{u}</Text>
                            ) : null}
                          </Text>
                        </Pressable>
                      );
                    }
                    return (
                      <Pressable onPress={() => setRmPickerIdx(exIdx)} hitSlop={6}>
                        <Text style={styles.exVolume}>
                          {hasPrev ? `이전 ${basisN}RM ${prevD}${u}` : `${basisN}RM 기록 없음`}
                        </Text>
                      </Pressable>
                    );
                  })()}
                </View>
                <Pressable onPress={() => setCardMenuIdx(exIdx)} hitSlop={8} style={styles.exMenuBtn}>
                  <Text style={styles.exMenuText}>⋯</Text>
                </Pressable>
              </View>

              {ex.timeBased && (
                <Text style={styles.timeBadge}>⏱ 시간 기반</Text>
              )}

              {/* 종목 메모 — 버튼 없이 항상 표시 */}
              <TextInput
                key={`note-${ex.exerciseId}`}
                style={styles.exNoteInput}
                placeholder="📌 종목 메모"
                placeholderTextColor="#48484A"
                defaultValue={ex.note ?? ''}
                inputAccessoryViewID={Platform.OS === 'ios' ? KB_ACCESSORY_ID : undefined}
                onFocus={() => { setEdit(null); noteDraftRef.current = ex.note ?? ''; }}
                onChangeText={t => { noteDraftRef.current = t; }}
                onEndEditing={() => {
                  const t = noteDraftRef.current;
                  setExerciseNote(exIdx, t);
                  updateExerciseNote(ex.exerciseId, t).catch(() => {});
                }}
                multiline
              />

              <View style={styles.setHeader}>
                <Text style={[styles.setCol, { flex: 0.5 }]}>SET</Text>
                <Text style={[styles.setCol, { flex: 1.4 }]}>무게({u})</Text>
                <Text style={styles.setCol}>{ex.timeBased ? '시간(초)' : '횟수'}</Text>
                <Text style={[styles.setCol, { flex: 0.6 }]}>✓</Text>
              </View>

              {ex.sets.map((s, setIdx) => {
                const meta = SET_TYPE_META[s.setType ?? 'NORMAL'];
                const isWarmup = (s.setType ?? 'NORMAL') === 'WARMUP';
                const prev = ex.lastSets?.[setIdx];
                const activeKind = edit && edit.exIdx === exIdx && edit.setIdx === setIdx ? edit.kind : null;
                const isAnchor = !!restAnchor && restAnchor.ex === exIdx && restAnchor.set === setIdx;
                const showBar = restTimerActive && isAnchor;
                const restPct = restTotal > 0 ? Math.max(0, Math.min(100, (restRemaining / restTotal) * 100)) : 0;
                return (
                  <React.Fragment key={setIdx}>
                  <Swipeable
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
                        {(() => {
                          // 맨몸이 아니고 기록 없는(0) 미완료 세트는 공란(—)로 입력 유도
                          const blank = !ex.bodyweight && s.weight_kg === 0 && !s.done;
                          return (
                            <Pressable
                              style={[styles.fieldBtn, activeKind === 'weight' && styles.fieldActive]}
                              onPress={() => beginEdit(exIdx, setIdx, 'weight')}
                            >
                              <Text style={[styles.fieldText, activeKind !== 'weight' && blank && styles.fieldPlaceholder]}>
                                {activeKind === 'weight'
                                  ? editValue
                                  : (blank ? '—' : String(toDisplay(s.weight_kg, unitKg)))}
                              </Text>
                            </Pressable>
                          );
                        })()}
                        {prev && (
                          <Text style={styles.prevHint} numberOfLines={1}>
                            이전 {toDisplay(prev.weight_kg, unitKg)}{!ex.timeBased ? `×${prev.reps}` : ''}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        {ex.timeBased ? (
                          <Pressable
                            style={[styles.fieldBtn, activeKind === 'duration' && styles.fieldActive]}
                            onPress={() => beginEdit(exIdx, setIdx, 'duration')}
                          >
                            <Text style={styles.fieldText}>
                              {activeKind === 'duration' ? editValue : String(s.durationSec ?? 0)}
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.fieldBtn, activeKind === 'reps' && styles.fieldActive]}
                            onPress={() => beginEdit(exIdx, setIdx, 'reps')}
                          >
                            <Text style={styles.fieldText}>
                              {activeKind === 'reps' ? editValue : String(s.reps)}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      <Pressable
                        style={[styles.checkBtn, { flex: 0.6 }]}
                        onPress={() => s.done ? handleUncompleteSet(exIdx, setIdx) : handleCompleteSet(exIdx, setIdx)}
                      >
                        <View style={[styles.checkCircle, s.done && styles.checkCircleDone, s.isPR && styles.checkCirclePR]}>
                          {s.isPR ? <Text style={styles.checkTrophy}>🏆</Text> : s.done ? <Text style={styles.checkMark}>✓</Text> : null}
                        </View>
                      </Pressable>
                    </View>
                  </Swipeable>
                  {showBar ? (
                    <Pressable onPress={() => setRestControlOpen(true)} style={{ height: 28, borderRadius: 8, backgroundColor: '#13233A', justifyContent: 'center', overflow: 'hidden', marginVertical: 3 }}>
                      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${restPct}%`, backgroundColor: '#0A84FF' }} />
                      <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '800', fontVariant: ['tabular-nums'] }}>{fmtClock(restRemaining)}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => openRestPicker(exIdx)} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 1.5 }} hitSlop={6}>
                      <View style={{ flex: 1, height: 1, backgroundColor: s.done ? 'rgba(48,209,88,0.3)' : 'rgba(120,120,128,0.22)' }} />
                      <Text style={{ color: s.done ? '#30D158' : '#7E7E83', fontSize: 11, fontWeight: '700', marginHorizontal: 8, fontVariant: ['tabular-nums'] }}>{fmtClock(restDurationSec)}</Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: s.done ? 'rgba(48,209,88,0.3)' : 'rgba(120,120,128,0.22)' }} />
                    </Pressable>
                  )}
                  </React.Fragment>
                );
              })}

              <Pressable style={[styles.addSetBtn, { marginTop: 4 }]} onPress={() => addSetToExercise(exIdx)}>
                <Text style={styles.addSetText}>+ 세트 추가</Text>
              </Pressable>
            </View>
          );
        }}
      />

      {/* 휴식 제어 패널 — 인라인 막대 탭 시(스트롱식): 큰 타이머 + ±15 · 리셋 · 건너뛰기 */}
      <Modal visible={restControlOpen && restTimerActive} transparent animationType="slide" onRequestClose={() => setRestControlOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setRestControlOpen(false)}>
          <Pressable style={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, alignItems: 'center' }} onPress={() => {}}>
            <Text style={{ color: '#8E8E93', fontSize: 13, fontWeight: '700' }}>휴식 타이머</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 64, fontWeight: '800', letterSpacing: -1, marginTop: 6, fontVariant: ['tabular-nums'] }}>{fmtClock(restRemaining)}</Text>
            {restNextLabel ? <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 2 }}>다음 · {restNextLabel}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 22, alignSelf: 'stretch' }}>
              <Pressable style={{ flex: 1, backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }} onPress={() => adjustRestTimer(-15)}>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>−15</Text>
              </Pressable>
              <Pressable style={{ flex: 1, backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }} onPress={() => adjustRestTimer(15)}>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>+15</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'stretch' }}>
              <Pressable style={{ flex: 1, backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }} onPress={() => startRestTimer(restTotal, { nextLabel: restNextLabel ?? undefined })}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>리셋</Text>
              </Pressable>
              <Pressable style={{ flex: 1, backgroundColor: '#0A84FF', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }} onPress={() => { stopRestTimer(); setRestControlOpen(false); }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>건너뛰기</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTags} transparent animationType="fade" onRequestClose={() => { setShowTags(false); setTagEdit(false); setFinishAfterTags(false); }}>
        <Pressable style={styles.centerBackdrop} onPress={() => { setShowTags(false); setTagEdit(false); setFinishAfterTags(false); }}>
          <Pressable style={styles.centerCard} onPress={() => {}}>
            <View style={styles.tagHeaderRow}>
              <Text style={styles.gymSheetTitle}>부위 선택</Text>
              <Pressable onPress={() => setTagEdit(e => !e)} hitSlop={8}>
                <Text style={styles.tagEditBtn}>{tagEdit ? '완료' : '편집'}</Text>
              </Pressable>
            </View>
            <View style={styles.tagRow}>
              {bodyTags.map(t => {
                const on = sessionTags.includes(t);
                return (
                  <Pressable
                    key={t}
                    style={[styles.tagChip, on && !tagEdit && styles.tagChipOn]}
                    onPress={() => tagEdit ? removeBodyTag(t) : toggleSessionTag(t)}
                  >
                    <Text style={[styles.tagChipText, on && !tagEdit && styles.tagChipTextOn]}>{tagEdit ? `${t}  ✕` : t}</Text>
                  </Pressable>
                );
              })}
            </View>
            {tagEdit && (
              <View style={styles.tagAddRow}>
                <TextInput
                  style={styles.tagAddInput}
                  placeholder="부위 추가"
                  placeholderTextColor="#48484A"
                  value={newTag}
                  onChangeText={setNewTag}
                  onSubmitEditing={addBodyTag}
                  returnKeyType="done"
                />
                <Pressable style={[styles.tagAddBtn, !newTag.trim() && { opacity: 0.4 }]} onPress={addBodyTag} disabled={!newTag.trim()}>
                  <Text style={styles.tagAddBtnText}>추가</Text>
                </Pressable>
              </View>
            )}
            <Pressable style={styles.tagDoneBtn} onPress={() => {
              setShowTags(false); setTagEdit(false);
              if (finishAfterTags) { setFinishAfterTags(false); proceedFinish(); }
            }}>
              <Text style={styles.tagDoneText}>{finishAfterTags ? (sessionTags.length > 0 ? '완료하고 종료' : '건너뛰고 종료') : (sessionTags.length > 0 ? '완료' : '건너뛰기')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 운동 카드 액션 메뉴 */}
      <Modal visible={cardMenuIdx != null} transparent animationType="fade" onRequestClose={() => setCardMenuIdx(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setCardMenuIdx(null)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuHeader} numberOfLines={1}>
              {cardMenuIdx != null ? exercises[cardMenuIdx]?.exerciseName : ''}
            </Text>
            <Pressable style={styles.menuItem} onPress={() => { const i = cardMenuIdx; setCardMenuIdx(null); if (i != null) setTimeout(() => setEditExIdx(i), 180); }}>
              <Text style={styles.menuItemText}>✏️ 종목 정보 수정</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { const i = cardMenuIdx; setCardMenuIdx(null); if (i != null) setTimeout(() => openRestPicker(i), 180); }}>
              <Text style={styles.menuItemText}>⏱ 휴식 시간 설정</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { const i = cardMenuIdx; setCardMenuIdx(null); if (i != null) setTimeout(() => handleAddWarmup(i), 180); }}>
              <Text style={styles.menuItemText}>🔥 워밍업 추가</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { const i = cardMenuIdx; setCardMenuIdx(null); if (i != null) setTimeout(() => setRmPickerIdx(i), 180); }}>
              <Text style={styles.menuItemText}>🎯 기준 RM</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { const i = cardMenuIdx; setCardMenuIdx(null); if (i != null) setTimeout(() => handleRemoveExercise(i), 180); }}>
              <Text style={[styles.menuItemText, { color: '#FF453A' }]}>🗑 운동 삭제</Text>
            </Pressable>
            <Pressable style={styles.menuCancel} onPress={() => setCardMenuIdx(null)}>
              <Text style={styles.menuCancelText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 종목 정보 수정 시트 (카드 ⋯ 메뉴) */}
      <ExerciseEditSheet
        exerciseId={editExIdx != null ? (exercises[editExIdx]?.exerciseId ?? null) : null}
        onClose={() => setEditExIdx(null)}
        onSaved={(updated) => {
          if (editExIdx != null) {
            setExerciseInfo(editExIdx, {
              exerciseName: updated.name,
              brand: updated.brand,
              timeBased: updated.tracking_type === 'TIME',
              bodyweight: updated.equipment_type === 'Bodyweight',
            });
          }
        }}
      />

      {/* 기준 RM 선택 시트 */}
      <RmBasisSheet
        visible={rmPickerIdx != null}
        exerciseName={rmPickerIdx != null ? exercises[rmPickerIdx]?.exerciseName : undefined}
        initialReps={rmPickerIdx != null ? (rmBasisMap[exercises[rmPickerIdx]?.exerciseId] ?? 10) : 10}
        initialMode={rmPickerIdx != null ? (rmModeMap[exercises[rmPickerIdx]?.exerciseId] ?? 'actual') : 'actual'}
        onConfirm={(reps, mode) => { if (rmPickerIdx != null) confirmRmBasis(rmPickerIdx, reps, mode); }}
        onClose={() => setRmPickerIdx(null)}
      />

      {/* 휴식 시간 다이얼 시트 */}
      <Modal visible={restPickerIdx != null} transparent animationType="fade" onRequestClose={closeRestPicker}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable style={styles.menuOverlay} onPress={closeRestPicker}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Text style={styles.menuHeader} numberOfLines={1}>
              휴식 시간 · {restPickerIdx != null ? exercises[restPickerIdx]?.exerciseName : ''}
            </Text>

            <View style={styles.restSeg}>
              {(['main', 'warm'] as const).map(t => (
                <Pressable key={t} style={[styles.restSegBtn, restTab === t && styles.restSegBtnOn]} onPress={() => setRestTab(t)}>
                  <Text style={[styles.restSegText, restTab === t && styles.restSegTextOn]}>{t === 'main' ? '본세트' : '워밍업'}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.restReadout}>{fmtRest(restTab === 'main' ? restMain : restWarm)}</Text>

            <RulerPicker
              initial={restTab === 'main' ? restMain : restWarm}
              onChange={v => (restTab === 'main' ? setRestMain(v) : setRestWarm(v))}
              min={0}
              max={600}
              step={5}
              majorEvery={30}
              midEvery={15}
              format={fmtRest}
            />

            <View style={styles.restAdjRow}>
              {[-30, -10, 10, 30].map(d => (
                <Pressable
                  key={d}
                  style={styles.restAdjBtn}
                  onPress={() => {
                    const cur = restTab === 'main' ? restMain : restWarm;
                    const next = Math.max(0, Math.min(600, cur + d));
                    (restTab === 'main' ? setRestMain : setRestWarm)(next);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.restAdjText}>{d > 0 ? `+${d}` : `${d}`}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.menuCancel} onPress={closeRestPicker}>
              <Text style={styles.menuCancelText}>완료</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </GestureHandlerRootView>
      </Modal>

      {/* 휴식 타이머는 탭 레이아웃(전역)에서 렌더 — 모든 탭에서 보임 */}

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

    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

