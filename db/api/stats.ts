import { apiRequest } from '../../lib/api';
import { cached } from '../../lib/cache';
import type {
  TrainedExercise, VolumeStats, VolumeRange, ExerciseRecord,
  MuscleFrequency, PeriodSummary, ExerciseUsage,
} from './types';
import { type ApiCalendar } from './mappers';

export async function getWorkoutDates(year: number, month: number): Promise<string[]> {
  const cal = await apiRequest<ApiCalendar>(`/api/v1/stats/calendar?year=${year}&month=${month}`);
  return cal.workoutDates.map(d => String(d));
}

export async function getAllWorkoutDates(): Promise<string[]> {
  const dates = await apiRequest<string[]>('/api/v1/stats/workout-dates');
  return dates.map(d => String(d));
}

export async function getWeeklyWorkoutCount(_startDate: string, _endDate: string): Promise<number> {
  const result = await apiRequest<{ from: string; to: string; count: number }>('/api/v1/stats/weekly-count');
  return result.count;
}

export async function getMonthStats(year: number, month: number): Promise<{ count: number; totalSec: number }> {
  const cal = await apiRequest<ApiCalendar>(`/api/v1/stats/calendar?year=${year}&month=${month}`);
  return { count: Number(cal.count), totalSec: Number(cal.totalDurationSec) };
}

export async function get1RMHistory(exercise_id: number): Promise<{ date: string; estimated_1rm: number }[]> {
  type ApiOneRm = { date: string; oneRm: number };
  const list = await apiRequest<ApiOneRm[]>(`/api/v1/stats/one-rm?exerciseId=${exercise_id}`);
  return list.map(r => ({ date: String(r.date), estimated_1rm: r.oneRm }));
}

// 특정 반복수(reps)로 실제 수행한 세트의 날짜별 최고 무게
export async function getActualRmHistory(exercise_id: number, reps: number): Promise<{ date: string; estimated_1rm: number }[]> {
  type ApiOneRm = { date: string; oneRm: number };
  const list = await apiRequest<ApiOneRm[]>(`/api/v1/stats/actual-rm?exerciseId=${exercise_id}&reps=${reps}`);
  return list.map(r => ({ date: String(r.date), estimated_1rm: r.oneRm }));
}

// 렙별 기록: 반복수 1~12 각각의 역대 최고 실측 무게 + Epley 추정 1RM(weight*(1+reps/30))
export type RepMax = { reps: number; weight: number; e1rm: number };
export async function getRepMaxes(exercise_id: number): Promise<RepMax[]> {
  const repsList = Array.from({ length: 12 }, (_, i) => i + 1);
  const series = await Promise.all(repsList.map(r => getActualRmHistory(exercise_id, r)));
  return repsList.map((reps, i) => {
    const vals = series[i].map(p => p.estimated_1rm).filter(v => v > 0);
    if (vals.length === 0) return { reps, weight: 0, e1rm: 0 };
    const weight = Math.max(...vals);
    return { reps, weight, e1rm: Math.round(weight * (1 + reps / 30) * 10) / 10 };
  });
}

export async function getTrainedExercises(): Promise<TrainedExercise[]> {
  return cached('ex:trained', 45_000, async () => {
    const list = await apiRequest<{ id: number; name: string; brand: string | null; note: string | null; trackingType: string | null }[]>(
      '/api/v1/stats/trained-exercises'
    );
    return list.map(e => ({ id: e.id, name: e.name, brand: e.brand, note: e.note ?? null, tracking_type: e.trackingType === 'TIME' ? 'TIME' : 'REPS' }));
  });
}

export async function getVolumeStats(range: VolumeRange = 'recent'): Promise<VolumeStats> {
  type ApiVolume = {
    daily: { date: string; volume: number }[];
    byMuscle: { muscleGroup: string; volume: number }[];
  };
  const res = await apiRequest<ApiVolume>(`/api/v1/stats/volume?range=${range}`);
  return {
    daily: res.daily.map(d => ({ date: String(d.date), volume: d.volume })),
    byMuscle: res.byMuscle.map(m => ({ muscleGroup: m.muscleGroup, volume: m.volume })),
  };
}

export async function getRecords(): Promise<ExerciseRecord[]> {
  type Api = { exerciseId: number; name: string; brand: string | null; best1rm: number | null; maxWeight: number | null; bestSessionVolume: number | null };
  const list = await apiRequest<Api[]>('/api/v1/stats/records');
  return list.map(r => ({
    exercise_id: r.exerciseId, name: r.name, brand: r.brand,
    best_1rm: r.best1rm, max_weight: r.maxWeight, best_session_volume: r.bestSessionVolume,
  }));
}

export async function getMuscleFrequency(weeks = 4, range?: { from: string; to: string }): Promise<MuscleFrequency[]> {
  type Api = { muscleGroup: string; setCount: number; sessionCount: number };
  const qs = range ? `from=${range.from}&to=${range.to}` : `weeks=${weeks}`;
  const list = await apiRequest<Api[]>(`/api/v1/stats/muscle-frequency?${qs}`);
  return list.map(m => ({ muscle_group: m.muscleGroup, set_count: m.setCount, session_count: m.sessionCount }));
}

export async function getPeriodSummary(from: string, to: string): Promise<PeriodSummary> {
  type Api = { setCount: number; sessionCount: number; totalDurationSec: number };
  const r = await apiRequest<Api>(`/api/v1/stats/period-summary?from=${from}&to=${to}`);
  return { set_count: r.setCount, session_count: r.sessionCount, total_duration_sec: r.totalDurationSec };
}

export async function getExerciseUsage(): Promise<ExerciseUsage[]> {
  const list = await apiRequest<{ exerciseId: number; count: number; lastDate: string | null }[]>('/api/v1/stats/exercise-usage');
  return list.map(r => ({ exercise_id: r.exerciseId, count: r.count, last_date: r.lastDate }));
}

// ── 종목별 리포트 ──────────────────────────────────────────
export type ExerciseTrend = 'up' | 'flat' | 'new' | 'down';

export type ExerciseSummary = {
  exerciseId: number;
  name: string;
  bodyPart: string;
  currentE1rm: number | null;
  prE1rm: number | null;
  prDate: string | null;
  plateauWeeks: number;
  trend: ExerciseTrend;
  delta: number | null;
  spark: number[];
  lastDate: string | null;
  // 카드 그리드용 작업세트(워밍업 제외 최고무게 세트 W×R). 맨몸은 weight=0.
  recentTopWeightKg: number | null;
  recentTopReps: number | null;
  bestTopWeightKg: number | null;
  bestTopReps: number | null;
  prevTopWeightKg: number | null;
};

export type SeriesPoint = { date: string; value: number };

export type ExerciseProgress = {
  exerciseId: number;
  name: string | null;
  bodyPart: string | null;
  currentE1rm: number | null;
  prE1rm: number | null;
  prDate: string | null;
  plateauWeeks: number;
  trend: ExerciseTrend;
  e1rm: SeriesPoint[];
  maxWeight: SeriesPoint[];
  weeklyVolume: SeriesPoint[];
  weeklyFreq: SeriesPoint[];
};

/** 허브용: 운동한 적 있는 전 종목 요약(1RM·PR·정체·스파크)을 한 번에. */
export async function getExerciseSummaries(): Promise<ExerciseSummary[]> {
  return cached('ex:summaries', 45_000, () => apiRequest<ExerciseSummary[]>('/api/v1/stats/exercise-summary'));
}

/** 종목 진척 시계열(1RM·최대무게 일별, 볼륨·빈도 주별). */
export async function getExerciseProgress(exerciseId: number): Promise<ExerciseProgress> {
  return apiRequest<ExerciseProgress>(`/api/v1/stats/exercise-progress?exerciseId=${exerciseId}`);
}

// Epley 추정 1RM → N-RM 무게 환산 (N=1이면 그대로).
export function convertRm(estimated1rm: number, reps: number): number {
  if (reps <= 1) return estimated1rm;
  return Math.round((estimated1rm / (1 + reps / 30)) * 10) / 10;
}
