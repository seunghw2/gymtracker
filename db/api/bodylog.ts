import { apiRequest } from '../../lib/api';
import type { BodyLog } from './types';
import { type ApiBodyLog, mapBodyLog } from './mappers';

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
