import { getLastSessionSets, get1RMHistory } from '../db/queries';
import type { ExerciseEntry, SetEntry } from '../store/useStore';

/** 선택 가능한 종목 최소 형태 */
export type PickableExercise = {
  id: number;
  name: string;
  brand: string | null;
  note?: string | null;
  tracking_type?: 'REPS' | 'TIME';
};

/** 종목 → 워크아웃 ExerciseEntry. 지난 세션 값 프리필 + 역대 최고 1RM(PR 기준). */
export async function buildExerciseEntry(ex: PickableExercise): Promise<ExerciseEntry> {
  const timeBased = ex.tracking_type === 'TIME';
  const [prev, rmHist] = await Promise.all([
    getLastSessionSets(ex.id),
    get1RMHistory(ex.id).catch(() => []),
  ]);
  const initSets: SetEntry[] = prev.length > 0
    ? prev.map((s, i) => ({ setOrder: i + 1, weight_kg: s.weight_kg, reps: s.reps, done: false, setType: 'NORMAL', durationSec: timeBased ? (s.duration_sec ?? 30) : undefined }))
    : [{ setOrder: 1, weight_kg: timeBased ? 0 : 60, reps: timeBased ? 0 : 10, done: false, setType: 'NORMAL', durationSec: timeBased ? 30 : undefined }];
  const lastSets = prev.map(s => ({ weight_kg: s.weight_kg, reps: s.reps }));
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
}
