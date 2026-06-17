import { apiRequest } from '../../lib/api';
import type { SessionSummary, SessionSetRow, SessionPatch, ExerciseNote } from './types';
import { type ApiSessionSummary, type ApiSetDto, mapSetDtoToSessionSetRow } from './mappers';

export async function createWorkoutSession(date: string, title?: string): Promise<number> {
  const result = await apiRequest<{ id: number }>('/api/v1/workouts/sessions', {
    method: 'POST',
    body: { date, title: title?.trim() || null },
  });
  return result.id;
}

export async function updateSession(sessionId: number, patch: SessionPatch): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function updateSessionDuration(sessionId: number, duration_sec: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { durationSec: duration_sec },
  });
}

// 운동 완료 표시 — completedAt이 찍힌 세션만 통계에 집계된다
export async function completeSession(sessionId: number, duration_sec: number): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}`, {
    method: 'PATCH',
    body: { durationSec: duration_sec, completed: true },
  });
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

export async function getSessionHistory(limit = 30): Promise<SessionSummary[]> {
  const list = await apiRequest<ApiSessionSummary[]>(`/api/v1/workouts/sessions?limit=${limit}`);
  return list.map(s => ({
    id: s.id,
    date: String(s.date),
    duration_sec: s.durationSec,
    exercise_count: Number(s.exerciseCount),
    set_count: Number(s.setCount),
    exercise_names: s.exerciseNames.join(', '),
    title: s.title ?? null,
    note: s.note ?? null,
    tags: s.tags ?? null,
  }));
}

export async function getSessionSets(sessionId: number): Promise<SessionSetRow[]> {
  const detail = await apiRequest<{ session: unknown; sets: ApiSetDto[] }>(`/api/v1/workouts/sessions/${sessionId}`);
  return detail.sets.map(mapSetDtoToSessionSetRow);
}

type ApiExerciseNote = { exerciseId: number; note: string | null };

/** 세션별 종목 메모 목록. */
export async function getSessionExerciseNotes(sessionId: number): Promise<ExerciseNote[]> {
  const detail = await apiRequest<{ exerciseNotes?: ApiExerciseNote[] }>(`/api/v1/workouts/sessions/${sessionId}`);
  return (detail.exerciseNotes ?? []).map(n => ({ exercise_id: n.exerciseId, note: n.note }));
}

/** 이번 세션의 그 종목 메모 저장(upsert). */
export async function upsertExerciseSessionNote(sessionId: number, exerciseId: number, note: string): Promise<void> {
  await apiRequest(`/api/v1/workouts/sessions/${sessionId}/exercises/${exerciseId}/note`, {
    method: 'PUT',
    body: { note },
  });
}
