import { apiRequest } from '../../lib/api';

let settingsCache: Record<string, string> | null = null;

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  if (!settingsCache) {
    settingsCache = await apiRequest<Record<string, string>>('/api/v1/settings');
  }
  return settingsCache[key] ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await apiRequest(`/api/v1/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { value },
  });
  settingsCache = null;
}

// 부위 태그 목록(사용자 편집 가능). 미설정 시 기본 7개.
export const DEFAULT_BODY_TAGS = ['가슴', '등', '어깨', '하체', '팔', '코어', '유산소'];

export async function getBodyTags(): Promise<string[]> {
  const raw = await getSetting('body_tags', '');
  const list = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
  return list.length > 0 ? list : DEFAULT_BODY_TAGS;
}

export async function setBodyTags(tags: string[]): Promise<void> {
  await setSetting('body_tags', tags.join(','));
}

// 종목별 통계 기준 RM(반복수). 미설정 시 10.
export async function getExerciseRmBasis(exerciseId: number): Promise<number> {
  const raw = await getSetting(`rm_basis_${exerciseId}`, '10');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 10;
}

export async function setExerciseRmBasis(exerciseId: number, reps: number): Promise<void> {
  await setSetting(`rm_basis_${exerciseId}`, String(reps));
}

// 종목별 RM 기준 모드: 'actual'(실제) | 'estimated'(추정). 미설정 시 'actual'.
export async function getExerciseRmMode(exerciseId: number): Promise<'actual' | 'estimated'> {
  const raw = await getSetting(`rm_mode_${exerciseId}`, 'actual');
  return raw === 'estimated' ? 'estimated' : 'actual';
}

export async function setExerciseRmMode(exerciseId: number, mode: 'actual' | 'estimated'): Promise<void> {
  await setSetting(`rm_mode_${exerciseId}`, mode);
}

// 종목별 휴식시간(초). 미설정 시 fallback 반환.
export async function getExerciseRest(exerciseId: number, fallback: number): Promise<number> {
  const raw = await getSetting(`rest_ex_${exerciseId}`, '');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function setExerciseRest(exerciseId: number, sec: number): Promise<void> {
  await setSetting(`rest_ex_${exerciseId}`, String(sec));
}

export async function getExerciseWarmupRest(exerciseId: number, fallback: number): Promise<number> {
  const raw = await getSetting(`rest_warmup_ex_${exerciseId}`, '');
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function setExerciseWarmupRest(exerciseId: number, sec: number): Promise<void> {
  await setSetting(`rest_warmup_ex_${exerciseId}`, String(sec));
}
