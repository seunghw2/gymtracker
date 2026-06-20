/**
 * 종목 카드 정렬(순수). 담은 순서 / 최근순 / 무게순 / 이름순 / 부위순.
 * 담은 순서(manual)는 호출부가 준 배열을 그대로 둔다(드래그 재정렬 결과).
 */
export type SortKey = 'manual' | 'recent' | 'weight' | 'name' | 'part';

export const SORT_OPTIONS: [SortKey, string][] = [
  ['manual', '담은 순서'],
  ['recent', '최근순'],
  ['weight', '무게순'],
  ['name', '이름순'],
  ['part', '부위순'],
];

export type SortItem = {
  exerciseId: number;
  name: string;
  part: string;             // 부위(한글)
  weight: number;           // 최근 top set 무게(맨몸=0) — 무게순용
  lastDate: string | null;  // 최근 수행일(ISO) — 최근순용
};

/** key에 따라 정렬한 새 배열. partOrder=부위 우선순서(없으면 가나다). */
export function sortItems<T extends SortItem>(items: T[], key: SortKey, partOrder: string[] = []): T[] {
  const arr = [...items];
  const rank = (p: string) => {
    const i = partOrder.indexOf(p);
    return i < 0 ? 999 : i;
  };
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  switch (key) {
    case 'recent':
      return arr.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || byName(a, b));
    case 'weight':
      return arr.sort((a, b) => b.weight - a.weight || byName(a, b));
    case 'name':
      return arr.sort(byName);
    case 'part':
      return arr.sort((a, b) => rank(a.part) - rank(b.part) || byName(a, b));
    case 'manual':
    default:
      return arr;
  }
}
