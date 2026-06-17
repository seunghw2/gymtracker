import { epley, formatDuration } from '../format';

describe('format', () => {
  test('epley 1RM 추정(소수1자리)', () => {
    expect(epley(100, 5)).toBe(116.7);
    expect(epley(60, 1)).toBe(62);
    expect(epley(80, 0)).toBe(80);
  });

  test('formatDuration', () => {
    expect(formatDuration(600)).toBe('10분');
    expect(formatDuration(3600)).toBe('1시간 0분');
    expect(formatDuration(5400)).toBe('1시간 30분');
    expect(formatDuration(90)).toBe('2분');   // 1.5분 반올림
  });
});
