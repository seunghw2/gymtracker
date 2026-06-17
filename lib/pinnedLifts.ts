import { getSetting, setSetting } from '../db/queries';

/**
 * 종목 즐겨찾기(=리포트 '주력' 핀)와 동일한 설정을 공유한다.
 * 키: ai_pinned_lifts (쉼표 구분 종목명). 비어 있으면 기본 키워드로 판정.
 */
const PINNED_KEY = 'ai_pinned_lifts';
const DEFAULT = ['squat', 'bench press', 'deadlift', 'overhead press', 'lat pulldown'];

export async function loadPinned(): Promise<Set<string>> {
  const v = await getSetting(PINNED_KEY, '');
  return new Set(v.split(',').map(s => s.trim()).filter(Boolean));
}

export async function savePinned(pinned: Set<string>): Promise<void> {
  await setSetting(PINNED_KEY, [...pinned].join(','));
}

/** 사용자가 핀을 하나도 안 했으면 기본 주력 키워드로 판정. */
export function isPin(name: string, pinned: Set<string>): boolean {
  if (pinned.size > 0) return pinned.has(name);
  const n = name.toLowerCase();
  return DEFAULT.some(k => n.includes(k));
}

export function togglePin(name: string, pinned: Set<string>): Set<string> {
  const next = new Set(pinned);
  if (next.has(name)) next.delete(name); else next.add(name);
  return next;
}
