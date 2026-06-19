import { apiRequest } from '../../lib/api';

/** 사용자 정의 종목 그룹(커스텀). 자동 그룹은 클라에서 런타임 계산. */
export type ExerciseGroup = {
  id: number;
  name: string;
  exerciseIds: number[];   // 담은 순서
  sortIndex: number;
};

export async function listGroups(): Promise<ExerciseGroup[]> {
  return apiRequest<ExerciseGroup[]>('/api/v1/exercise-groups');
}

export async function createGroup(name: string): Promise<ExerciseGroup> {
  return apiRequest<ExerciseGroup>('/api/v1/exercise-groups', { method: 'POST', body: { name } });
}

export async function updateGroup(
  id: number,
  patch: { name?: string; exerciseIds?: number[]; sortIndex?: number },
): Promise<ExerciseGroup> {
  return apiRequest<ExerciseGroup>(`/api/v1/exercise-groups/${id}`, { method: 'PATCH', body: patch });
}

export async function deleteGroup(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/exercise-groups/${id}`, { method: 'DELETE' });
}

export async function reorderGroups(ids: number[]): Promise<void> {
  await apiRequest<void>('/api/v1/exercise-groups/order', { method: 'PUT', body: { ids } });
}

/** 기간 내 수행한 종목 ID — 이번주/지난주 자동 그룹용. */
export async function getTrainedExerciseIds(from: string, to: string): Promise<number[]> {
  return apiRequest<number[]>(`/api/v1/stats/trained-exercise-ids?from=${from}&to=${to}`);
}
