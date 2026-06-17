import { parseLocalDate, weekdayKo, formatDateWithDay, formatShortWithDay, formatShortWithWeekday } from '../date';

describe('date', () => {
  test('parseLocalDate는 로컬 기준(월 인덱스 보정)', () => {
    const d = parseLocalDate('2026-05-30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);   // 5월 → index 4
    expect(d.getDate()).toBe(30);
  });

  test('weekdayKo (2026-01-01은 목요일)', () => {
    expect(weekdayKo(parseLocalDate('2026-01-01'))).toBe('목');
  });

  test('포맷 문자열', () => {
    expect(formatDateWithDay('2026-01-01')).toBe('2026년 1월 1일 (목)');
    expect(formatShortWithDay('2026-01-01')).toBe('1월 1일 (목)');
    expect(formatShortWithWeekday('2026-01-01')).toBe('1월 1일 목요일');
  });
});
