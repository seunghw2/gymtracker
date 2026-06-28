import type { SetType } from '../../store/useStore';

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
  duration_sec: number | null;
  note: string | null;
};

export type Effort = 'EASY' | 'MODERATE' | 'HARD' | 'FAILURE';

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
  effort?: Effort | null;
};

export type BodyLog = {
  id: number;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
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

export type SessionPatch = {
  title?: string;
  note?: string;
  date?: string;
  durationSec?: number;
  tags?: string;
};

export type TrainedExercise = {
  id: number;
  name: string;
  brand: string | null;
  note: string | null;
  tracking_type: TrackingType;
};

export type VolumeStats = {
  daily: { date: string; volume: number }[];
  byMuscle: { muscleGroup: string; volume: number }[];
};

export type VolumeRange = 'recent' | 'week' | 'month' | 'quarter';

export type ExerciseRecord = {
  exercise_id: number;
  name: string;
  brand: string | null;
  best_1rm: number | null;
  max_weight: number | null;
  best_session_volume: number | null;
};

export type MuscleFrequency = { muscle_group: string; set_count: number; session_count: number };

export type PeriodSummary = { set_count: number; session_count: number; total_duration_sec: number };

export type ExerciseUsage = { exercise_id: number; count: number; last_date: string | null };

export type TemplateSummary = { id: number; name: string; exercise_count: number; exercise_names: string[] };
export type TemplateExerciseItem = {
  exercise_id: number; name: string; brand: string | null; order_idx: number;
  default_sets: number; default_reps: number; default_weight_kg: number;
};
export type TemplateDetail = { id: number; name: string; exercises: TemplateExerciseItem[] };
