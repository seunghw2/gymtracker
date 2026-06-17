import { earliestDate, buildBuckets } from '../periods';

const NOW = new Date(2026, 5, 17); // 2026-06-17 (로컬)

describe('earliestDate', () => {
  test('가장 이른 날짜', () => {
    expect(earliestDate(['2026-03-01', '2026-01-15', '2026-02-20'])).toBe('2026-01-15');
  });
  test('빈 배열은 null', () => {
    expect(earliestDate([])).toBeNull();
  });
});

describe('buildBuckets', () => {
  test('월별: 최초~현재, 최신이 맨 앞', () => {
    const b = buildBuckets('month', '2026-04-15', NOW);
    expect(b).toHaveLength(3);
    expect(b[0].label).toBe('2026년 6월');
    expect(b[0].isCurrent).toBe(true);
    expect(b[2].label).toBe('2026년 4월');
    expect(b[2].isCurrent).toBe(false);
  });

  test('주별: firstISO 없으면 현재 주 1개', () => {
    const b = buildBuckets('week', null, NOW);
    expect(b).toHaveLength(1);
    expect(b[0].isCurrent).toBe(true);
  });

  test('분기: Q1~Q2 두 개', () => {
    const b = buildBuckets('quarter', '2026-01-10', NOW);
    expect(b.map(x => x.label)).toEqual(['2026 2분기', '2026 1분기']);
  });

  test('반기: 상반기 1개', () => {
    const b = buildBuckets('half', '2026-02-01', NOW);
    expect(b).toHaveLength(1);
    expect(b[0].label).toBe('2026 상반기');
    expect(b[0].sublabel).toBe('1–6월');
  });
});
