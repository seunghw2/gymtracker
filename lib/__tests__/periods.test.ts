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
  test('월별: 진행 중(6월) 제외, 완료된 4~5월만 최신순', () => {
    const b = buildBuckets('month', '2026-04-15', NOW);
    expect(b.map(x => x.label)).toEqual(['2026년 5월', '2026년 4월']);
    expect(b.every(x => !x.isCurrent)).toBe(true);
  });

  test('주별: firstISO 없으면(이번 주만 가능) 진행 중 제외로 빈 배열', () => {
    const b = buildBuckets('week', null, NOW);
    expect(b).toHaveLength(0);
  });

  test('주별: 완료된 지난 주들만, 이번 주 제외', () => {
    const b = buildBuckets('week', '2026-05-25', NOW);
    expect(b.length).toBeGreaterThan(0);
    expect(b.every(x => !x.isCurrent)).toBe(true);
  });
});
