import { unitLabel, toDisplay, fromInput, formatWeight } from '../units';

describe('units 무게 단위 변환', () => {
  test('unitLabel', () => {
    expect(unitLabel(true)).toBe('kg');
    expect(unitLabel(false)).toBe('lb');
  });

  test('toDisplay: kg는 0.25 단위 반올림', () => {
    expect(toDisplay(100, true)).toBe(100);
    expect(toDisplay(100.1, true)).toBe(100);     // 0.25 격자
    expect(toDisplay(100.2, true)).toBe(100.25);
  });

  test('toDisplay: lb는 *2.20462 후 0.5 단위', () => {
    expect(toDisplay(100, false)).toBe(220.5);    // 220.462 → 0.5격자
    expect(toDisplay(0, false)).toBe(0);
  });

  test('fromInput: 표시값 → 저장 kg', () => {
    expect(fromInput(100, true)).toBe(100);       // kg는 그대로
    expect(fromInput(220.5, false)).toBeCloseTo(100.02, 1);
  });

  test('formatWeight 문자열', () => {
    expect(formatWeight(60, true)).toBe('60kg');
    expect(formatWeight(100, false)).toBe('220.5lb');
  });
});
