import { apiRequest } from '../../lib/api';

export type GoalType = 'hypertrophy' | 'strength' | 'fatloss' | 'endurance';
export type ProgressionTrigger = 'single' | 'two_sessions' | 'rpe';
export type RuleType = 'barbell_main' | 'machine_cable' | 'bodyweight' | 'isolation';
export type ProgressionStatus = 'in_progress' | 'ready_to_increase' | 'hold';

export type GoalSettingDto = {
  id: number;
  goalType: GoalType;
  weeklyFrequency: number;
  incUpper: number;
  incLower: number;
  progressionTrigger: ProgressionTrigger;
  onboarded: boolean;
};

export type GoalSettingRequest = {
  goalType: GoalType;
  weeklyFrequency: number;
  incUpper: number;
  incLower: number;
  progressionTrigger: ProgressionTrigger;
  complete: boolean;
};

export type ExerciseGoalDto = {
  id: number;
  exerciseId: number;
  exerciseName: string | null;
  muscleGroup: string | null;
  ruleType: RuleType;
  overridden: boolean;
  targetReps: number | null;
  targetSets: number | null;
  repRangeMin: number | null;
  repRangeMax: number | null;
  increment: number | null;
  status: ProgressionStatus;
  currentValue: number | null;
  nextTarget: string | null;
};

export type ExerciseGoalBulkRequest = {
  exercises: { exerciseId: number; currentValue?: number }[];
};

export type ExerciseGoalUpdateRequest = {
  ruleType?: RuleType;
  targetReps?: number;
  targetSets?: number;
  repRangeMin?: number;
  repRangeMax?: number;
  increment?: number;
  status?: ProgressionStatus;
  currentValue?: number;
  nextTarget?: string;
};

export type WeeklyFocusDto = {
  id: number;
  weekStart: string;
  bodyPart: string;
};

export async function getGoalSetting(): Promise<GoalSettingDto | null> {
  try {
    return await apiRequest<GoalSettingDto>('/api/v1/goal-setting');
  } catch {
    return null;
  }
}

export async function upsertGoalSetting(req: GoalSettingRequest): Promise<GoalSettingDto> {
  return apiRequest<GoalSettingDto>('/api/v1/goal-setting', { method: 'POST', body: req });
}

export async function getExerciseGoals(): Promise<ExerciseGoalDto[]> {
  return apiRequest<ExerciseGoalDto[]>('/api/v1/exercise-goals');
}

export async function bulkCreateExerciseGoals(req: ExerciseGoalBulkRequest): Promise<ExerciseGoalDto[]> {
  return apiRequest<ExerciseGoalDto[]>('/api/v1/exercise-goals/bulk', { method: 'POST', body: req });
}

export async function updateExerciseGoal(id: number, req: ExerciseGoalUpdateRequest): Promise<ExerciseGoalDto> {
  return apiRequest<ExerciseGoalDto>(`/api/v1/exercise-goals/${id}`, { method: 'PUT', body: req });
}

export async function getWeeklyFocus(weekStart: string): Promise<WeeklyFocusDto | null> {
  try {
    return await apiRequest<WeeklyFocusDto>(`/api/v1/weekly-focus/${weekStart}`);
  } catch {
    return null;
  }
}

export async function saveWeeklyFocus(bodyPart: string, weekStart: string): Promise<WeeklyFocusDto> {
  return apiRequest<WeeklyFocusDto>('/api/v1/weekly-focus', { method: 'POST', body: { bodyPart, weekStart } });
}

export type PartSummaryDto = { part: string; sessionCount: number; setCount: number };

export type WeeklySummaryDto = {
  attendance: { done: number; target: number };
  improvements: { done: number; total: number; hasData: boolean };
  bodyPartGaps: { part: string; korPart: string; missing: number }[];
  todayPlan: string;
  comment: string;
};

export async function getWeeklySummary(): Promise<WeeklySummaryDto | null> {
  try {
    return await apiRequest<WeeklySummaryDto>('/api/v1/overload/weekly-summary');
  } catch {
    return null;
  }
}

export async function getWeeklyPattern(): Promise<PartSummaryDto[]> {
  return apiRequest<PartSummaryDto[]>('/api/v1/overload/weekly-pattern');
}

export type WeeklyCheckInResult = { messageId: number | null; messageText: string; bodyParts: string[] };

export async function weeklyCheckIn(): Promise<WeeklyCheckInResult> {
  return apiRequest<WeeklyCheckInResult>('/api/v1/weekly-check-in', { method: 'POST' });
}
