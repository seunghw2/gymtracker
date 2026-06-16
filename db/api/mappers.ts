import type { SetType } from '../../store/useStore';
import type { Exercise, WorkoutSet, SessionSetRow, BodyLog } from './types';

// ─── API 응답 형식 (백엔드 camelCase) ───────────────────────────────────

export type ApiExercise = {
  id: number; name: string;
  muscleGroup: string; equipmentType: string;
  brand: string | null; note: string | null;
  trackingType: string | null;
  isSystem: boolean; isCustom: boolean;
};

export type ApiSetDto = {
  id: number; exerciseId: number;
  exerciseName: string; brand: string | null;
  setOrder: number; weightKg: number;
  reps: number; estimated1rm: number | null;
  setType: string | null;
  supersetGroup: number | null;
  durationSec: number | null;
};

export type ApiSessionSummary = {
  id: number; date: string;
  durationSec: number | null;
  exerciseCount: number; setCount: number;
  exerciseNames: string[];
  title: string | null; note: string | null; gymId: number | null; tags: string | null;
};

export type ApiBodyLog = {
  id: number; date: string;
  weightKg: number | null; bodyFatPct: number | null; waistCm: number | null;
};

export type ApiCalendar = {
  year: number; month: number;
  workoutDates: string[];
  count: number; totalDurationSec: number;
};

// ─── 변환 함수 ─────────────────────────────────────────────────────────

export function mapExercise(e: ApiExercise): Exercise {
  return {
    id: e.id, name: e.name,
    muscle_group: e.muscleGroup, equipment_type: e.equipmentType,
    brand: e.brand, note: e.note,
    tracking_type: e.trackingType === 'TIME' ? 'TIME' : 'REPS',
    is_system: e.isSystem ? 1 : 0, is_custom: e.isCustom ? 1 : 0,
  };
}

export function normSetType(raw: string | null | undefined): SetType {
  const v = (raw ?? 'NORMAL').toUpperCase();
  return v === 'WARMUP' || v === 'DROP' || v === 'FAILURE' ? v : 'NORMAL';
}

export function mapSetDtoToWorkoutSet(s: ApiSetDto): WorkoutSet {
  return {
    id: s.id, session_id: 0, exercise_id: s.exerciseId,
    set_order: s.setOrder, weight_kg: s.weightKg, reps: s.reps,
    estimated_1rm: s.estimated1rm, set_type: normSetType(s.setType),
    duration_sec: s.durationSec ?? null, created_at: '',
  };
}

export function mapSetDtoToSessionSetRow(s: ApiSetDto): SessionSetRow {
  return {
    id: s.id, exercise_id: s.exerciseId,
    exercise_name: s.exerciseName, brand: s.brand,
    set_order: s.setOrder, weight_kg: s.weightKg,
    reps: s.reps, estimated_1rm: s.estimated1rm, set_type: normSetType(s.setType),
    superset_group: s.supersetGroup ?? null,
    duration_sec: s.durationSec ?? null,
  };
}

export function mapBodyLog(b: ApiBodyLog): BodyLog {
  return {
    id: b.id, date: b.date,
    weight_kg: b.weightKg, body_fat_pct: b.bodyFatPct, waist_cm: b.waistCm,
  };
}
