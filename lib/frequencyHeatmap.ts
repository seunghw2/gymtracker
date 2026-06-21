// 빈도 히트맵 순수 로직 — 그리드 레이아웃 상수·기간→모드·행 분할·일별 집계.
// 컴포넌트(HeatmapChart)는 여기 함수들로 렌더만 한다(높이 고정·정사각 칸).

export const COLS = 13;
export const GAP = 5;
export const ROWS = 3; // 예약 행 수(기간 무관 고정)

export type HeatMode = 'day' | 'week' | 'month';
export type HeatCell = { date: string; value: number };

/** 그리드 너비에서 정사각 칸 한 변(px). 모드와 무관하게 동일. */
export function cellSize(gridWidth: number): number {
  return Math.floor((gridWidth - (COLS - 1) * GAP) / COLS);
}

/** 컨테이너 예약 높이 = 3행 + 사이 간격. 칸 수와 무관하게 동일 → 카드 높이 불변. */
export function reservedHeight(gridWidth: number): number {
  return ROWS * cellSize(gridWidth) + (ROWS - 1) * GAP;
}

/** 기간 → 집계 모드. 1M=일별, 3M·6M=주별, 1Y·전체=월별, 기간지정=범위로 결정(≥1년 월별). */
export function rangeToMode(period: string, customSpanDays?: number): HeatMode {
  if (period === '1m') return 'day';
  if (period === '1y' || period === 'all') return 'month';
  if (period === 'custom') return (customSpanDays ?? 0) >= 365 ? 'month' : 'week';
  return 'week'; // 3m, 6m
}

/** 13칸씩 행으로 분할. 각 행에 마지막 채움용 pad(부족분) 개수 포함. */
export function chunkRows<T>(cells: T[], cols = COLS): { row: T[]; pad: number }[] {
  const out: { row: T[]; pad: number }[] = [];
  for (let i = 0; i < cells.length; i += cols) {
    const row = cells.slice(i, i + cols);
    out.push({ row, pad: cols - row.length });
  }
  return out;
}

const parseYmd = (s: string): Date => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmtYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 세션 날짜 목록 → 최근 nDays일 일별 카운트(오래된→최신). 끝일(end) 포함. */
export function bucketDaily(dates: string[], end: string, nDays = 30): HeatCell[] {
  const count = new Map<string, number>();
  for (const ds of dates) { const k = ds.slice(0, 10); count.set(k, (count.get(k) ?? 0) + 1); }
  const endD = parseYmd(end);
  const out: HeatCell[] = [];
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(endD); d.setDate(d.getDate() - i);
    const k = fmtYmd(d);
    out.push({ date: k, value: count.get(k) ?? 0 });
  }
  return out;
}
