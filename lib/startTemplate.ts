import * as Haptics from 'expo-haptics';
import { useWorkoutStore, ExerciseEntry, SetEntry } from '../store/useStore';
import { createWorkoutSession } from '../db/api/sessions';
import { getTemplate } from '../db/api/templates';
import { getTrainedExercises, get1RMHistory } from '../db/api/stats';
import type { TrainedExercise } from '../db/api/types';
import { todayStr } from './date';

/**
 * 템플릿 ID로 새 운동 세션을 시작한다. (workout.tsx와 새 템플릿 화면 공용)
 * 세션 생성 → 종목/세트 채움 → prevBest 비동기 보강.
 */
export async function startSessionFromTemplate(templateId: number, templateName: string): Promise<void> {
  const ws = useWorkoutStore.getState();

  const [detail, trained] = await Promise.all([
    getTemplate(templateId),
    getTrainedExercises().catch(() => [] as TrainedExercise[]),
  ]);
  const noteMap = new Map(trained.map(t => [t.id, t.note]));
  const typeMap = new Map(trained.map(t => [t.id, t.tracking_type]));

  const date = todayStr();
  const newId = await createWorkoutSession(date, templateName);
  ws.startSession(newId, date, templateName || null);

  const entries: ExerciseEntry[] = detail.exercises.map(te => {
    const timeBased = typeMap.get(te.exercise_id) === 'TIME';
    const sets: SetEntry[] = Array.from({ length: te.default_sets }, (_, i) => ({
      setOrder: i + 1, weight_kg: te.default_weight_kg, reps: te.default_reps,
      done: false, setType: 'NORMAL', durationSec: timeBased ? 30 : undefined,
    }));
    return {
      exerciseId: te.exercise_id, exerciseName: te.name, brand: te.brand,
      sets, lastSets: [], note: noteMap.get(te.exercise_id) ?? null, sessionNote: '', timeBased,
    };
  });
  useWorkoutStore.getState().addExercises(entries);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  // prevBest(역대 1RM) 비동기 보강 — 인덱스 기준
  const bests = await Promise.all(detail.exercises.map(te => get1RMHistory(te.exercise_id).catch(() => [])));
  bests.forEach((hist, idx) => {
    const best = hist.reduce((m, r) => Math.max(m, r.estimated_1rm), 0);
    if (best > 0) useWorkoutStore.getState().setExercisePrevBest(idx, best);
  });
}
