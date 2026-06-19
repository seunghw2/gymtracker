import type { ExerciseSummary } from '../db/api/stats';
import type { ExerciseGroup } from '../db/api/exerciseGroups';

/** 종목 그룹 — 펠릿 구성·멤버십·자동그룹 필터(순수 로직, 테스트 가능). */

export type SystemKind = 'all' | 'thisWeek' | 'lastWeek';

export type Pellet =
  | { kind: 'system'; key: SystemKind; name: string }
  | { kind: 'custom'; id: number; name: string; exerciseIds: number[]; sortIndex: number };

export const SYSTEM_PELLETS: { key: SystemKind; name: string }[] = [
  { key: 'all', name: '기본' },
  { key: 'thisWeek', name: '이번주' },
  { key: 'lastWeek', name: '지난주' },
];

/** 펠릿 순서: 기본 → 이번주 → 지난주 → 커스텀(sortIndex, 동률은 id). */
export function buildPellets(groups: ExerciseGroup[]): Pellet[] {
  const sys: Pellet[] = SYSTEM_PELLETS.map(s => ({ kind: 'system', key: s.key, name: s.name }));
  const custom: Pellet[] = [...groups]
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id)
    .map(g => ({ kind: 'custom', id: g.id, name: g.name, exerciseIds: g.exerciseIds, sortIndex: g.sortIndex }));
  return [...sys, ...custom];
}

/** 커스텀 그룹 행 — 담은 순서대로 summary 매핑(목록에 없는 종목 id는 스킵). */
export function groupRows(exerciseIds: number[], byId: Map<number, ExerciseSummary>): ExerciseSummary[] {
  const out: ExerciseSummary[] = [];
  for (const id of exerciseIds) {
    const r = byId.get(id);
    if (r) out.push(r);
  }
  return out;
}

/** 자동 그룹 행 — all=전체, thisWeek/lastWeek=그 주 수행 종목으로 필터(요약 정렬 유지). */
export function systemRows(kind: SystemKind, rows: ExerciseSummary[], weekIds: Set<number>): ExerciseSummary[] {
  if (kind === 'all') return rows;
  return rows.filter(r => weekIds.has(r.exerciseId));
}

// ── 멤버십 순수 연산(담은 순서 보존) ──────────────────────────────
export function addMembers(ids: number[], add: number[]): number[] {
  const set = new Set(ids);
  return [...ids, ...add.filter(id => !set.has(id))];
}
export function removeMember(ids: number[], id: number): number[] {
  return ids.filter(x => x !== id);
}
export function moveMember(ids: number[], from: number, to: number): number[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const copy = [...ids];
  const [m] = copy.splice(from, 1);
  copy.splice(to, 0, m);
  return copy;
}
