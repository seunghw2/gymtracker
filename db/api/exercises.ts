import { apiRequest } from '../../lib/api';
import { cached, invalidate } from '../../lib/cache';
import type { Exercise, TrackingType } from './types';
import { type ApiExercise, mapExercise } from './mappers';

// 종목 카탈로그는 거의 안 변함 → 길게 캐시하고, 아래 종목 뮤테이션에서만 무효화한다.
const CATALOG_TTL = 10 * 60_000;

export async function getExercises(muscle_group?: string, equipment_type?: string, brand?: string): Promise<Exercise[]> {
  const key = `ex:list:${muscle_group ?? ''}:${equipment_type ?? ''}:${brand ?? ''}`;
  return cached(key, CATALOG_TTL, async () => {
    const params = new URLSearchParams();
    if (muscle_group) params.set('muscleGroup', muscle_group);
    if (equipment_type) params.set('equipmentType', equipment_type);
    if (brand) params.set('brand', brand);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const list = await apiRequest<ApiExercise[]>(`/api/v1/exercises${qs}`);
    return list.map(mapExercise);
  });
}

export async function addCustomExercise(name: string, muscle_group: string, equipment_type: string, brand?: string, tracking_type: TrackingType = 'REPS'): Promise<number> {
  const result = await apiRequest<ApiExercise>('/api/v1/exercises', {
    method: 'POST',
    body: { name, muscleGroup: muscle_group, equipmentType: equipment_type, brand: brand ?? null, trackingType: tracking_type },
  });
  invalidate('ex:');
  return result.id;
}

export async function deleteCustomExercise(id: number): Promise<void> {
  await apiRequest(`/api/v1/exercises/${id}`, { method: 'DELETE' });
  invalidate('ex:');
}

/** 종목 영구 메모 수정. 갱신된 Exercise 반환. */
export async function updateExerciseNote(id: number, note: string): Promise<Exercise> {
  const result = await apiRequest<ApiExercise>(`/api/v1/exercises/${id}`, {
    method: 'PATCH',
    body: { note },
  });
  invalidate('ex:');
  return mapExercise(result);
}

/** 종목 정보 수정(이름·부위·장비·브랜드·측정방식). 소유 종목만 가능. */
export async function updateExercise(id: number, patch: { name?: string; muscle_group?: string; equipment_type?: string; brand?: string | null; tracking_type?: TrackingType }): Promise<Exercise> {
  const result = await apiRequest<ApiExercise>(`/api/v1/exercises/${id}`, {
    method: 'PATCH',
    body: {
      name: patch.name,
      muscleGroup: patch.muscle_group,
      equipmentType: patch.equipment_type,
      brand: patch.brand === undefined ? undefined : (patch.brand ?? ''),
      trackingType: patch.tracking_type,
    },
  });
  invalidate('ex:');
  return mapExercise(result);
}

/** 종목 측정 방식(REPS/TIME) 변경. */
export async function setExerciseTrackingType(id: number, tracking_type: TrackingType): Promise<Exercise> {
  const result = await apiRequest<ApiExercise>(`/api/v1/exercises/${id}`, {
    method: 'PATCH',
    body: { trackingType: tracking_type },
  });
  invalidate('ex:');
  return mapExercise(result);
}

export async function getCustomExercises(): Promise<Exercise[]> {
  return cached('ex:custom', CATALOG_TTL, async () => {
    const list = await apiRequest<ApiExercise[]>('/api/v1/exercises/custom');
    return list.map(mapExercise);
  });
}
