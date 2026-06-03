import { apiRequest } from '../lib/api';
import type { SetType } from '../store/useStore';

export type TrackingType = 'REPS' | 'TIME';

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  equipment_type: string;
  brand: string | null;
  note: string | null;
  tracking_type: TrackingType;
  is_system: number;
  is_custom: number;
};

export type WorkoutSession = {
  id: number;
  date: string;
  gym_id: number | null;
  duration_sec: number | null;
  note: string | null;
};

export type WorkoutSet = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_order: number;
  weight_kg: number;
  reps: number;
  estimated_1rm: number | null;
  set_type: SetType;
  duration_sec: number | null;
  created_at: string;
};

export type BodyLog = {
  id: number;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

export type Gym = {
  id: number;
  name: string;
  location: string | null;
};

export type SessionSummary = {
  id: number;
  date: string;
  duration_sec: number | null;
  exercise_count: number;
  set_count: number;
  exercise_names: string;
  title: string | null;
  note: string | null;
  gym_id: number | null;
  tags: string | null;
};

export type SessionSetRow = {
  id: number;
  exercise_id: number;
  exercise_name: string;
  brand: string | null;
  set_order: number;
  weight_kg: number;
  reps: number;
  estimated_1rm: number | null;
  set_type: SetType;
  superset_group: number | null;
  duration_sec: number | null;
};

export type ExerciseNote = {
  exercise_id: number;
  note: string | null;
};

// ─── API 응답 형식 (백엔드 camelCase) ───────────────────────────────────

type ApiExercise = {
  id: number; name: string;
  muscleGroup: string; equipmentType: string;
  brand: string | null; note: string | null;
  trackingType: string | null;
  isSystem: boolean; isCustom: boolean;
};

type ApiSetDto = {
  id: number; exerciseId: number;
  exerciseName: string; brand: string | null;
  setOrder: number; weightKg: number;
  reps: number; estimated1rm: number | null;
  setType: string | null;
  supersetGroup: number | null;
  durationSec: number | null;
};

type ApiSessionSummary = {
  id: number; date: string;
  durationSec: number | null;
  exerciseCount: number; setCount: number;
  exerciseNames: string[];
  title: string | null; note: string | null; gymId: number | null; tags: string | null;
};

type ApiBodyLog = {
  id: number; date: string;
  weightKg: number | null; bodyFatPct: number | null;
};

type ApiCalendar = {
  year: number; month: number;
  workoutDates: string[];
  count: number; totalDurationSec: number;
};

// ─── 변환 함수 ─────────────────────────────────────────────────────────

function mapExercise(e: ApiExercise): Exercise {
  return {
    id: e.id, name: e.name,
    muscle_group: e.muscleGroup, equipment_type: e.equipmentType,
    brand: e.brand, note: e.note,
    tracking_type: e.trackingType === 'TIME' ? 'TIME' : 'REPS',
    is_system: e.isSystem ? 1 : 0, is_custom: e.isCustom ? 1 : 0,
  };
}

function normSetType(raw: string | null | undefined): SetType {
  const v = (raw ?? 'NORMAL').toUpperCase();
  return v === 'WARMUP' || v === 'DROP' || v === 'FAILURE' ? v : 'NORMAL';
}

function mapSetDtoToWorkoutSet(s: ApiSetDto): WorkoutSet {
  return {
    id: s.id, session_id: 0, exercise_id: s.exerciseId,
    set_order: s.setOrder, weight_kg: s.weightKg, reps: s.reps,
    estimated_1rm: s.estimated1rm, set_type: normSetType(s.setType),
    duration_sec: s.durationSec ?? null, created_at: '',
  };
}

function mapSetDtoToSessionSetRow(s: ApiSetDto): SessionSetRow {
  return {
    id: s.id, exercise_id: s.exerciseId,
    exercise_name: s.exerciseName, brand: s.brand,
    set_order: s.setOrder, weight_kg: s.weightKg,
    reps: s.reps, estimated_1rm: s.estimated1rm, set_type: normSetType(s.setType),
    superset_group: s.supersetGroup ?? null,
    duration_sec: s.durationSec ?? null,
  };
}

function mapBodyLog(b: ApiBodyLog): BodyLog {
  return {
    id: b.id, date: b.date,
    weight_kg: b.weightKg, body_fat_pct: b.bodyFatPct,
  };
}

// ─── 설정 캐시 ─────────────────────────────────────────────────────────

let settingsCache: Record<string, string> | null = null;

// ─── 운동 종목 ─────────────────────────────────────────────────────────

export async function getExercises(muscle_group?: string, equipment_type?: string, brand?: string): Promise<Exercise[]> {
  const params = new URLSearchParams();
  if (muscle_group) params.set('muscleGroup', muscle_group);
  if (equipment_type) params.set('equipmentType', equipment_type);
  if (brand) params.set('brand', brand);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const list = await apiRequest<ApiExercise[]>(`/api/v1/exercises${qs}`);
  return list.map(mapExercise);
}

export async function addCustomExercise(name: string, muscle_group: string, equipment_type: string, brand?: string, tracking_type: TrackingType = 'REPS'): Promise<number> {
  const result = await apiRequest<ApiExercise>('/api/v1/exercises', {
    method: 'POST',
    body: { name, muscleGroup: muscle_group, equipmentType: equipment_type, brand: brand ?? null, trackingType: tracking_type },
  });
  return result.id;
}

export async function deleteCustomExercise(id: number): Promise<void> {
  await apiRequest(`/api/v1/exercises/${id}`, { method: 'DELETE' });
}

/** 종목 영구 메모 수정. 갱신된 Exercise 반환. */
export async function updateExerciseNote(id: number, note: string): Promise<Exercise> {
  const result = await apiRequest<ApiExercise>(`/api/v1/exercises/${id}`, {
    method: 'PATCH',
    body: { note },
  });
  return mapExercise(result);
}

/** 종목 측정 방식(REPS/TIME) 변경. */
export async function setExerciseTrackingType(id: number, tracking_type: TrackingType): Promise<Exercise> {
  const result = await apiRequest<ApiExercise>(`/api/v1/exercises/${id}`, {
    method: 'PATCH',
    body: { trackingType: tracking_type },
  });
  return mapExercise(result);
}

export async function getCustomExercises(): Promise<Exercise[]> {
  const list = await apiRequest<ApiExercise[]>('/api/v1/exercises/custom');
  return list.map(mapExercise);
}

// ─── 운동 세션 ─────────────────────────────────────────────────────────

export async function createWorkoutSession(date: string, gym_id?: number | null, title?: string): Promise<number> {
  const result = await apiRequest<{ id: number }>('/api/v1/workouts/sessions', {
    method: 'POST',
    body: { date, gymId: gym_id ?? null, title: title?.trim() || null },
  });
  return result.id;
}

export type SessionPatch = {
  title?: string;
  note?: string;
  gymId?: number | null;
  date?: string;
  durationSec?: number;
  tags?: string;
};

export async function updateSession(sessionId: number, patch: SessionPatch): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function updateWorkoutSet(setId: number, weight_kg: number, reps: number, set_type?: SetType): Promise<void> {
  await apiRequest(`/api/v1/workouts/sets/${setId}`, {
    method: 'PATCH',
    body: { weightKg: weight_kg, reps, setType: set_type },
  });
}

export async function updateSessionDuration(sessionId: number, duration_sec: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { durationSec: duration_sec },
  });
}

// 운동 완료 표시 — completedAt이 찍힌 세션만 통계에 집계된다
export async function completeSession(sessionId: number, duration_sec: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { durationSec: duration_sec, completed: true },
  });
}

export async function addWorkoutSet(
  session_id: number,
  exercise_id: number,
  set_order: number,
  weight_kg: number,
  reps: number,
  estimated_1rm: number,
  set_type: SetType = 'NORMAL',
  superset_group: number | null = null,
  duration_sec: number | null = null,
): Promise<number> {
  const result = await apiRequest<ApiSetDto>(`/api/v1/workouts/sessions/${session_id}/sets`, {
    method: 'POST',
    body: { exerciseId: exercise_id, setOrder: set_order, weightKg: weight_kg, reps, setType: set_type, supersetGroup: superset_group, durationSec: duration_sec },
  });
  return result.id;
}

export async function deleteWorkoutSet(setId: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sets/${setId}`, { method: 'DELETE' });
}

export async function deleteSession(sessionId: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function updateSessionDate(sessionId: number, date: string): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { date },
  });
}

export async function getLastSessionSets(exercise_id: number): Promise<WorkoutSet[]> {
  const list = await apiRequest<ApiSetDto[]>(`/api/v1/workouts/exercises/${exercise_id}/last-sets`);
  return list.map(mapSetDtoToWorkoutSet);
}

export async function getSessionHistory(limit = 30): Promise<SessionSummary[]> {
  const list = await apiRequest<ApiSessionSummary[]>(`/api/v1/workouts/sessions?limit=${limit}`);
  return list.map(s => ({
    id: s.id,
    date: String(s.date),
    duration_sec: s.durationSec,
    exercise_count: Number(s.exerciseCount),
    set_count: Number(s.setCount),
    exercise_names: s.exerciseNames.join(', '),
    title: s.title ?? null,
    note: s.note ?? null,
    gym_id: s.gymId ?? null,
    tags: s.tags ?? null,
  }));
}

export async function getSessionSets(sessionId: number): Promise<SessionSetRow[]> {
  const detail = await apiRequest<{ session: unknown; sets: ApiSetDto[] }>(`/api/v1/workouts/sessions/${sessionId}`);
  return detail.sets.map(mapSetDtoToSessionSetRow);
}

type ApiExerciseNote = { exerciseId: number; note: string | null };

/** 세션별 종목 메모 목록. */
export async function getSessionExerciseNotes(sessionId: number): Promise<ExerciseNote[]> {
  const detail = await apiRequest<{ exerciseNotes?: ApiExerciseNote[] }>(`/api/v1/workouts/sessions/${sessionId}`);
  return (detail.exerciseNotes ?? []).map(n => ({ exercise_id: n.exerciseId, note: n.note }));
}

/** 이번 세션의 그 종목 메모 저장(upsert). */
export async function upsertExerciseSessionNote(sessionId: number, exerciseId: number, note: string): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}/exercises/${exerciseId}/note`, {
    method: 'PUT',
    body: { note },
  });
}

// ─── 캘린더 / 통계 ─────────────────────────────────────────────────────

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

export type TrainedExercise = {
  id: number;
  name: string;
  brand: string | null;
  note: string | null;
  tracking_type: TrackingType;
};

export async function getTrainedExercises(): Promise<TrainedExercise[]> {
  const list = await apiRequest<{ id: number; name: string; brand: string | null; note: string | null; trackingType: string | null }[]>(
    '/api/v1/stats/trained-exercises'
  );
  return list.map(e => ({ id: e.id, name: e.name, brand: e.brand, note: e.note ?? null, tracking_type: e.trackingType === 'TIME' ? 'TIME' : 'REPS' }));
}

export type VolumeStats = {
  daily: { date: string; volume: number }[];
  byMuscle: { muscleGroup: string; volume: number }[];
};

export type VolumeRange = 'recent' | 'week' | 'month' | 'quarter';

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

export type ExerciseRecord = {
  exercise_id: number;
  name: string;
  brand: string | null;
  best_1rm: number | null;
  max_weight: number | null;
  best_session_volume: number | null;
};

export async function getRecords(): Promise<ExerciseRecord[]> {
  type Api = { exerciseId: number; name: string; brand: string | null; best1rm: number | null; maxWeight: number | null; bestSessionVolume: number | null };
  const list = await apiRequest<Api[]>('/api/v1/stats/records');
  return list.map(r => ({
    exercise_id: r.exerciseId, name: r.name, brand: r.brand,
    best_1rm: r.best1rm, max_weight: r.maxWeight, best_session_volume: r.bestSessionVolume,
  }));
}

export type MuscleFrequency = { muscle_group: string; set_count: number; session_count: number };

export async function getMuscleFrequency(weeks = 4, range?: { from: string; to: string }): Promise<MuscleFrequency[]> {
  type Api = { muscleGroup: string; setCount: number; sessionCount: number };
  const qs = range ? `from=${range.from}&to=${range.to}` : `weeks=${weeks}`;
  const list = await apiRequest<Api[]>(`/api/v1/stats/muscle-frequency?${qs}`);
  return list.map(m => ({ muscle_group: m.muscleGroup, set_count: m.setCount, session_count: m.sessionCount }));
}

export type PeriodSummary = { set_count: number; session_count: number; total_duration_sec: number };

export async function getPeriodSummary(from: string, to: string): Promise<PeriodSummary> {
  type Api = { setCount: number; sessionCount: number; totalDurationSec: number };
  const r = await apiRequest<Api>(`/api/v1/stats/period-summary?from=${from}&to=${to}`);
  return { set_count: r.setCount, session_count: r.sessionCount, total_duration_sec: r.totalDurationSec };
}

// ─── 신체 기록 ─────────────────────────────────────────────────────────

export async function getTodayBodyLog(date: string): Promise<BodyLog | null> {
  const latest = await getLatestBodyLog();
  if (latest && latest.date === date) return latest;
  return null;
}

export async function getLatestBodyLog(): Promise<BodyLog | null> {
  try {
    const result = await apiRequest<ApiBodyLog | undefined>('/api/v1/body-logs/latest');
    return result ? mapBodyLog(result) : null;
  } catch {
    return null;
  }
}

export async function upsertBodyLog(date: string, weight_kg: number, body_fat_pct?: number): Promise<void> {
  await apiRequest('/api/v1/body-logs', {
    method: 'POST',
    body: { date, weightKg: weight_kg, bodyFatPct: body_fat_pct ?? null },
  });
}

export async function getBodyLogs(limit = 30): Promise<BodyLog[]> {
  const list = await apiRequest<ApiBodyLog[]>(`/api/v1/body-logs?limit=${limit}`);
  return list.map(mapBodyLog);
}

// ─── 설정 ──────────────────────────────────────────────────────────────

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  if (!settingsCache) {
    settingsCache = await apiRequest<Record<string, string>>('/api/v1/settings');
  }
  return settingsCache[key] ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await apiRequest(`/api/v1/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { value },
  });
  settingsCache = null;
}

// 부위 태그 목록(사용자 편집 가능). 미설정 시 기본 7개.
export const DEFAULT_BODY_TAGS = ['가슴', '등', '어깨', '하체', '팔', '코어', '유산소'];

export async function getBodyTags(): Promise<string[]> {
  const raw = await getSetting('body_tags', '');
  const list = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
  return list.length > 0 ? list : DEFAULT_BODY_TAGS;
}

export async function setBodyTags(tags: string[]): Promise<void> {
  await setSetting('body_tags', tags.join(','));
}

// 종목별 통계 기준 RM(반복수). 미설정 시 10.
export async function getExerciseRmBasis(exerciseId: number): Promise<number> {
  const raw = await getSetting(`rm_basis_${exerciseId}`, '10');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 10;
}

export async function setExerciseRmBasis(exerciseId: number, reps: number): Promise<void> {
  await setSetting(`rm_basis_${exerciseId}`, String(reps));
}

// 종목별 RM 기준 모드: 'actual'(실제) | 'estimated'(추정). 미설정 시 'actual'.
export async function getExerciseRmMode(exerciseId: number): Promise<'actual' | 'estimated'> {
  const raw = await getSetting(`rm_mode_${exerciseId}`, 'actual');
  return raw === 'estimated' ? 'estimated' : 'actual';
}

export async function setExerciseRmMode(exerciseId: number, mode: 'actual' | 'estimated'): Promise<void> {
  await setSetting(`rm_mode_${exerciseId}`, mode);
}

// Epley 추정 1RM → N-RM 무게 환산 (N=1이면 그대로).
export function convertRm(estimated1rm: number, reps: number): number {
  if (reps <= 1) return estimated1rm;
  return Math.round((estimated1rm / (1 + reps / 30)) * 10) / 10;
}

// 종목별 휴식시간(초). 미설정 시 fallback 반환.
export async function getExerciseRest(exerciseId: number, fallback: number): Promise<number> {
  const raw = await getSetting(`rest_ex_${exerciseId}`, '');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type ExerciseUsage = { exercise_id: number; count: number; last_date: string | null };

export async function getExerciseUsage(): Promise<ExerciseUsage[]> {
  const list = await apiRequest<{ exerciseId: number; count: number; lastDate: string | null }[]>('/api/v1/stats/exercise-usage');
  return list.map(r => ({ exercise_id: r.exerciseId, count: r.count, last_date: r.lastDate }));
}

export async function setExerciseRest(exerciseId: number, sec: number): Promise<void> {
  await setSetting(`rest_ex_${exerciseId}`, String(sec));
}

export async function getExerciseWarmupRest(exerciseId: number, fallback: number): Promise<number> {
  const raw = await getSetting(`rest_warmup_ex_${exerciseId}`, '');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function setExerciseWarmupRest(exerciseId: number, sec: number): Promise<void> {
  await setSetting(`rest_warmup_ex_${exerciseId}`, String(sec));
}

// ─── 운동 루틴(템플릿) ──────────────────────────────────────────────────

export type TemplateSummary = { id: number; name: string; exercise_count: number; exercise_names: string[] };
export type TemplateExerciseItem = {
  exercise_id: number; name: string; brand: string | null; order_idx: number;
  default_sets: number; default_reps: number; default_weight_kg: number;
};
export type TemplateDetail = { id: number; name: string; exercises: TemplateExerciseItem[] };

export async function getTemplates(): Promise<TemplateSummary[]> {
  type Api = { id: number; name: string; exerciseCount: number; exerciseNames: string[] };
  const list = await apiRequest<Api[]>('/api/v1/templates');
  return list.map(t => ({ id: t.id, name: t.name, exercise_count: t.exerciseCount, exercise_names: t.exerciseNames }));
}

export async function getTemplate(id: number): Promise<TemplateDetail> {
  type ApiEx = { exerciseId: number; name: string; brand: string | null; orderIdx: number; defaultSets: number; defaultReps: number; defaultWeightKg: number };
  type Api = { id: number; name: string; exercises: ApiEx[] };
  const t = await apiRequest<Api>(`/api/v1/templates/${id}`);
  return {
    id: t.id, name: t.name,
    exercises: t.exercises.map(e => ({
      exercise_id: e.exerciseId, name: e.name, brand: e.brand, order_idx: e.orderIdx,
      default_sets: e.defaultSets, default_reps: e.defaultReps, default_weight_kg: e.defaultWeightKg,
    })),
  };
}

export async function createTemplate(
  name: string,
  exercises: { exerciseId: number; sets: number; reps: number; weightKg: number }[],
): Promise<number> {
  const res = await apiRequest<{ id: number }>('/api/v1/templates', { method: 'POST', body: { name, exercises } });
  return res.id;
}

export async function deleteTemplate(id: number): Promise<void> {
  await apiRequest(`/api/v1/templates/${id}`, { method: 'DELETE' });
}

// ─── 헬스장 ────────────────────────────────────────────────────────────

export async function getGyms(): Promise<Gym[]> {
  return apiRequest<Gym[]>('/api/v1/gyms');
}

export async function addGym(name: string, location?: string): Promise<number> {
  const result = await apiRequest<Gym>('/api/v1/gyms', {
    method: 'POST',
    body: { name, location: location ?? null },
  });
  return result.id;
}

export async function deleteGym(id: number): Promise<void> {
  await apiRequest(`/api/v1/gyms/${id}`, { method: 'DELETE' });
}
