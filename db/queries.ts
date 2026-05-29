import { apiRequest } from '../lib/api';

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  equipment_type: string;
  brand: string | null;
  note: string | null;
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
};

// ─── API 응답 형식 (백엔드 camelCase) ───────────────────────────────────

type ApiExercise = {
  id: number; name: string;
  muscleGroup: string; equipmentType: string;
  brand: string | null; note: string | null;
  isSystem: boolean; isCustom: boolean;
};

type ApiSetDto = {
  id: number; exerciseId: number;
  exerciseName: string; brand: string | null;
  setOrder: number; weightKg: number;
  reps: number; estimated1rm: number | null;
};

type ApiSessionSummary = {
  id: number; date: string;
  durationSec: number | null;
  exerciseCount: number; setCount: number;
  exerciseNames: string[];
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
    is_system: e.isSystem ? 1 : 0, is_custom: e.isCustom ? 1 : 0,
  };
}

function mapSetDtoToWorkoutSet(s: ApiSetDto): WorkoutSet {
  return {
    id: s.id, session_id: 0, exercise_id: s.exerciseId,
    set_order: s.setOrder, weight_kg: s.weightKg, reps: s.reps,
    estimated_1rm: s.estimated1rm, created_at: '',
  };
}

function mapSetDtoToSessionSetRow(s: ApiSetDto): SessionSetRow {
  return {
    id: s.id, exercise_id: s.exerciseId,
    exercise_name: s.exerciseName, brand: s.brand,
    set_order: s.setOrder, weight_kg: s.weightKg,
    reps: s.reps, estimated_1rm: s.estimated1rm,
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

export async function addCustomExercise(name: string, muscle_group: string, equipment_type: string, brand?: string): Promise<number> {
  const result = await apiRequest<ApiExercise>('/api/v1/exercises', {
    method: 'POST',
    body: { name, muscleGroup: muscle_group, equipmentType: equipment_type, brand: brand ?? null },
  });
  return result.id;
}

export async function deleteCustomExercise(id: number): Promise<void> {
  await apiRequest(`/api/v1/exercises/${id}`, { method: 'DELETE' });
}

export async function getCustomExercises(): Promise<Exercise[]> {
  const list = await apiRequest<ApiExercise[]>('/api/v1/exercises/custom');
  return list.map(mapExercise);
}

// ─── 운동 세션 ─────────────────────────────────────────────────────────

export async function createWorkoutSession(date: string, gym_id?: number): Promise<number> {
  const result = await apiRequest<{ id: number }>('/api/v1/workouts/sessions', {
    method: 'POST',
    body: { date, gymId: gym_id ?? null },
  });
  return result.id;
}

export async function updateSessionDuration(sessionId: number, duration_sec: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { durationSec: duration_sec },
  });
}

export async function addWorkoutSet(
  session_id: number,
  exercise_id: number,
  set_order: number,
  weight_kg: number,
  reps: number,
  estimated_1rm: number,
): Promise<number> {
  const result = await apiRequest<ApiSetDto>(`/api/v1/workouts/sessions/${session_id}/sets`, {
    method: 'POST',
    body: { exerciseId: exercise_id, setOrder: set_order, weightKg: weight_kg, reps },
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
  }));
}

export async function getSessionSets(sessionId: number): Promise<SessionSetRow[]> {
  const detail = await apiRequest<{ session: unknown; sets: ApiSetDto[] }>(`/api/v1/workouts/sessions/${sessionId}`);
  return detail.sets.map(mapSetDtoToSessionSetRow);
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

export type TrainedExercise = {
  id: number;
  name: string;
  brand: string | null;
};

export async function getTrainedExercises(): Promise<TrainedExercise[]> {
  const list = await apiRequest<{ id: number; name: string; brand: string | null }[]>(
    '/api/v1/stats/trained-exercises'
  );
  return list.map(e => ({ id: e.id, name: e.name, brand: e.brand }));
}

export type VolumeStats = {
  daily: { date: string; volume: number }[];
  byMuscle: { muscleGroup: string; volume: number }[];
};

export async function getVolumeStats(): Promise<VolumeStats> {
  type ApiVolume = {
    daily: { date: string; volume: number }[];
    byMuscle: { muscleGroup: string; volume: number }[];
  };
  const res = await apiRequest<ApiVolume>('/api/v1/stats/volume');
  return {
    daily: res.daily.map(d => ({ date: String(d.date), volume: d.volume })),
    byMuscle: res.byMuscle.map(m => ({ muscleGroup: m.muscleGroup, volume: m.volume })),
  };
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

// 종목별 휴식시간(초). 미설정 시 fallback 반환.
export async function getExerciseRest(exerciseId: number, fallback: number): Promise<number> {
  const raw = await getSetting(`rest_ex_${exerciseId}`, '');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function setExerciseRest(exerciseId: number, sec: number): Promise<void> {
  await setSetting(`rest_ex_${exerciseId}`, String(sec));
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
