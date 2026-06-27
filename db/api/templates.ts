import { apiRequest } from '../../lib/api';
import type { TemplateSummary, TemplateDetail } from './types';

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

export async function updateTemplate(
  id: number,
  name: string,
  exercises: { exerciseId: number; sets: number; reps: number; weightKg: number }[],
): Promise<void> {
  await apiRequest(`/api/v1/templates/${id}`, { method: 'PUT', body: { name, exercises } });
}

export async function deleteTemplate(id: number): Promise<void> {
  await apiRequest(`/api/v1/templates/${id}`, { method: 'DELETE' });
}

export type SuggestedTemplate = {
  name: string;
  reason: string;
  exercises: { exerciseId: number; name: string; muscleGroup: string | null; sets: number; reps: number; weightKg: number }[];
};

export async function getSuggestedTemplates(): Promise<SuggestedTemplate[]> {
  try {
    return await apiRequest<SuggestedTemplate[]>('/api/v1/overload/suggested-templates');
  } catch {
    return [];
  }
}
