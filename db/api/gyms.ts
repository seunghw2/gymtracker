import { apiRequest } from '../../lib/api';
import type { Gym } from './types';

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

export async function updateGym(id: number, name: string, location?: string | null): Promise<void> {
  await apiRequest(`/api/v1/gyms/${id}`, {
    method: 'PATCH',
    body: { name, location: location ?? null },
  });
}

export async function deleteGym(id: number): Promise<void> {
  await apiRequest(`/api/v1/gyms/${id}`, { method: 'DELETE' });
}
