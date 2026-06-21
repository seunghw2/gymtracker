import { COLS, GAP, cellSize, reservedHeight, rangeToMode, chunkRows, bucketDaily } from '../frequencyHeatmap';

describe('rangeToMode', () => {
  test('1M=일별, 3M·6M=주별, 1Y·전체=월별', () => {
    expect(rangeToMode('1m')).toBe('day');
    expect(rangeToMode('3m')).toBe('week');
    expect(rangeToMode('6m')).toBe('week');
    expect(rangeToMode('1y')).toBe('month');
    expect(rangeToMode('all')).toBe('month');
  });
  test('기간지정은 범위로 — 1년 미만 주별, 이상 월별', () => {
    expect(rangeToMode('custom', 30)).toBe('week');
    expect(rangeToMode('custom', 364)).toBe('week');
    expect(rangeToMode('custom', 365)).toBe('month');
    expect(rangeToMode('custom')).toBe('week');
  });
});

describe('cellSize / reservedHeight', () => {
  test('정사각 칸 크기 = floor((너비 - 12*GAP)/13)', () => {
    expect(cellSize(300)).toBe(Math.floor((300 - (COLS - 1) * GAP) / COLS));
    expect(cellSize(300)).toBe(18);
  });
  test('예약 높이 = 3행 + 2간격, 칸 수와 무관하게 너비만으로 결정', () => {
    expect(reservedHeight(300)).toBe(3 * cellSize(300) + 2 * GAP);
    expect(reservedHeight(300)).toBe(3 * 18 + 2 * GAP);
  });
});

describe('chunkRows', () => {
  test('30칸 → [13,13,4], 마지막 행 pad 9', () => {
    const rows = chunkRows(Array.from({ length: 30 }, (_, i) => i));
    expect(rows.map(r => r.row.length)).toEqual([13, 13, 4]);
    expect(rows.map(r => r.pad)).toEqual([0, 0, 9]);
  });
  test('12칸 → [12], pad 1', () => {
    const rows = chunkRows(Array.from({ length: 12 }, (_, i) => i));
    expect(rows.map(r => r.row.length)).toEqual([12]);
    expect(rows.map(r => r.pad)).toEqual([1]);
  });
  test('26칸 → [13,13], pad 0', () => {
    const rows = chunkRows(Array.from({ length: 26 }, (_, i) => i));
    expect(rows.map(r => r.row.length)).toEqual([13, 13]);
    expect(rows.map(r => r.pad)).toEqual([0, 0]);
  });
});

describe('bucketDaily', () => {
  test('최근 30일, 끝일 포함, 오래된→최신, 같은 날 카운트 합산', () => {
    const out = bucketDaily(['2026-06-10', '2026-06-10', '2026-05-20'], '2026-06-17', 30);
    expect(out).toHaveLength(30);
    expect(out[0].date).toBe('2026-05-19'); // 30일 전(끝 포함)
    expect(out[out.length - 1].date).toBe('2026-06-17');
    expect(out.find(c => c.date === '2026-06-10')!.value).toBe(2);
    expect(out.find(c => c.date === '2026-05-20')!.value).toBe(1);
    expect(out[out.length - 1].value).toBe(0);
  });
});
