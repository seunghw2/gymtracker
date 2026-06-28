import { apiRequest } from '../../lib/api';
import type { SetType } from '../../store/useStore';
import type { WorkoutSet, Effort } from './types';
import { type ApiSetDto, mapSetDtoToWorkoutSet } from './mappers';

export async function updateWorkoutSet(setId: number, weight_kg: number, reps: number, set_type?: SetType, effort?: Effort | null): Promise<void> {
  await apiRequest(`/api/v1/workouts/sets/${setId}`, {
    method: 'PATCH',
    body: { weightKg: weight_kg, reps, setType: set_type, effort: effort ?? undefined },
  });
}

export async function setSetEffort(setId: number, effort: Effort): Promise<void> {
  await apiRequest(`/api/v1/workouts/sets/${setId}/effort`, {
    method: 'PATCH',
    body: { effort },
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
  effort: Effort | null = null,
): Promise<number> {
  const result = await apiRequest<ApiSetDto>(`/api/v1/workouts/sessions/${session_id}/sets`, {
    method: 'POST',
    body: { exerciseId: exercise_id, setOrder: set_order, weightKg: weight_kg, reps, setType: set_type, supersetGroup: superset_group, durationSec: duration_sec, effort: effort ?? undefined },
  });
  return result.id;
}

export async function deleteWorkoutSet(setId: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sets/${setId}`, { method: 'DELETE' });
}

export async function getLastSessionSets(exercise_id: number): Promise<WorkoutSet[]> {
  const list = await apiRequest<ApiSetDto[]>(`/api/v1/workouts/exercises/${exercise_id}/last-sets`);
  return list.map(mapSetDtoToWorkoutSet);
}
