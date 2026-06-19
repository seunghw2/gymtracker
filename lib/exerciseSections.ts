import type { ExerciseSummary } from '../db/api/stats';

/** 종목 탭 섹션 버킷팅·정렬(순수 로직 — 테스트 가능). 계열 그룹은 추후 단계. */

export type SortKey = '1rm' | 'plateau' | 'recent' | 'name';
export const SORTS: [SortKey, string][] = [
  ['1rm', '1RM 높은순'],
  ['plateau', '정체 오래된순'],
  ['recent', '최근 운동순'],
  ['name', '이름순'],
];

/** 이 주수 이상 정체면 "한동안 멈춤"으로 접는다. */
export const STALE_WEEKS = 40;

export function sortExercises(list: ExerciseSummary[], sort: SortKey): ExerciseSummary[] {
  const cmp = (a: ExerciseSummary, b: ExerciseSummary): number => {
    switch (sort) {
      case 'plateau': return b.plateauWeeks - a.plateauWeeks;
      case 'recent': return (b.lastDate ?? '').localeCompare(a.lastDate ?? '');
      case 'name': return a.name.localeCompare(b.name);
      default: return (b.currentE1rm ?? 0) - (a.currentE1rm ?? 0);
    }
  };
  return [...list].sort(cmp);
}

export type Buckets = {
  pinned: ExerciseSummary[];     // ★ 보유 — 정체/신기록 무관 항상 상단
  highlight: ExerciseSummary[];  // ▲ 주목 · 신기록
  watch: ExerciseSummary[];      // 관심 — 정체 < STALE_WEEKS
  stale: ExerciseSummary[];      // 💤 한동안 멈춤 — 정체 ≥ STALE_WEEKS
};

/**
 * 종목 요약을 4개 버킷으로 나눈다.
 * 우선순위: ★보유 → 신기록(주목) → 멈춤(정체 STALE_WEEKS+) → 관심.
 * (★보유는 정체/신기록이어도 보유에 남는다.)
 */
export function bucketExercises(
  rows: ExerciseSummary[],
  isPinned: (name: string) => boolean,
  sort: SortKey,
): Buckets {
  const pinned: ExerciseSummary[] = [];
  const highlight: ExerciseSummary[] = [];
  const watch: ExerciseSummary[] = [];
  const stale: ExerciseSummary[] = [];

  for (const r of rows) {
    if (isPinned(r.name)) { pinned.push(r); continue; }
    if (r.trend === 'new') { highlight.push(r); continue; }
    if (r.trend === 'flat' && r.plateauWeeks >= STALE_WEEKS) { stale.push(r); continue; }
    watch.push(r);
  }

  return {
    pinned: sortExercises(pinned, '1rm'),
    highlight: sortExercises(highlight, '1rm'),
    watch: sortExercises(watch, sort),
    stale: sortExercises(stale, 'plateau'),
  };
}
