import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  SessionSummary,
  TrainedExercise,
  getSessionSets,
  get1RMHistory,
  getTrainedExercises,
  createWorkoutSession,
  createTemplate,
  updateSession,
  deleteSession,
} from '../db/queries';
import { useWorkoutStore, ExerciseEntry } from '../store/useStore';
import { useUiStore } from '../store/useUiStore';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 세션 카드(캘린더·운동 탭 공용)의 액션 로직.
 * 이대로 시작 / 템플릿으로 저장 / 이름 변경 / 삭제 — 두 화면에서 동일하게 동작.
 */
export function useSessionActions() {
  const router = useRouter();
  const startSession = useWorkoutStore(s => s.startSession);
  const addExercises = useWorkoutStore(s => s.addExercises);
  const setExercisePrevBest = useWorkoutStore(s => s.setExercisePrevBest);
  const setEditTarget = useUiStore(s => s.setEditTarget);

  // 운동 탭의 편집 화면으로 이동해 과거 세션을 수정
  const edit = (session: SessionSummary) => {
    if (useWorkoutStore.getState().activeSessionId) {
      Alert.alert('수정 불가', '진행 중인 운동이 있어 수정할 수 없습니다. 먼저 마치거나 취소해주세요.');
      return;
    }
    setEditTarget(session);
    router.push('/(tabs)/workout');
  };

  // 과거 세션을 오늘 새 세션으로 그대로 시작 (입력칸 미완료 상태로 프리필)
  const startAsIs = async (session: SessionSummary) => {
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
    const entries = order.map(id => groups[id]);
    addExercises(entries);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push('/(tabs)/workout');
    // PR 기준 역대 최고 1RM 비동기 채움
    const bests = await Promise.all(order.map(id => get1RMHistory(id).catch(() => [])));
    bests.forEach((hist, idx) => {
      const best = hist.reduce((m, r) => Math.max(m, r.estimated_1rm), 0);
      if (best > 0) setExercisePrevBest(idx, best);
    });
  };

  // 과거 세션을 루틴(템플릿)으로 저장
  const saveAsTemplate = async (session: SessionSummary) => {
    const sets = await getSessionSets(session.id).catch(() => []);
    if (sets.length === 0) {
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
        Alert.alert('저장됨', `"${trimmed}" 루틴이 저장되었습니다.`);
      } catch {
        Alert.alert('저장 실패', '잠시 후 다시 시도해주세요.');
      }
    };
    if (Alert.prompt) {
      Alert.prompt('루틴으로 저장', '루틴 이름을 입력하세요', (name?: string) => doSave(name ?? ''), 'plain-text', session.title ?? '');
    } else {
      doSave(session.title?.trim() || '');
    }
  };

  // 세션 이름 변경
  const rename = (session: SessionSummary, onDone?: () => void) => {
    const doRename = async (name?: string) => {
      const trimmed = (name ?? '').trim();
      try {
        await updateSession(session.id, { title: trimmed });
        onDone?.();
      } catch {
        Alert.alert('변경 실패', '잠시 후 다시 시도해주세요.');
      }
    };
    if (Alert.prompt) {
      Alert.prompt('이름 변경', '세션 이름을 입력하세요', (name?: string) => doRename(name), 'plain-text', session.title ?? '');
    } else {
      Alert.alert('이름 변경', '이 기기에서는 지원되지 않습니다.');
    }
  };

  // 세션 삭제
  const remove = (session: SessionSummary, onDone?: () => void) => {
    Alert.alert('세션 삭제', '이 운동 기록을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await deleteSession(session.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone?.();
          } catch {
            Alert.alert('삭제 실패', '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  return { startAsIs, saveAsTemplate, rename, remove, edit };
}
