import { deriveCard, formatTopSet, mainValue, formatDelta, formatDay } from '../exerciseCard';
import type { ExerciseSummary } from '../../db/api/stats';

const base: ExerciseSummary = {
  exerciseId: 1, name: 'Squat', bodyPart: '하체',
  currentE1rm: null, prE1rm: null, prDate: null, plateauWeeks: 0, trend: 'up', delta: null, spark: [], lastDate: '2026-06-16',
  recentTopWeightKg: null, recentTopReps: null, bestTopWeightKg: null, bestTopReps: null, prevTopWeightKg: null,
};
const s = (o: Partial<ExerciseSummary>): ExerciseSummary => ({ ...base, ...o });

describe('deriveCard', () => {
  it('일반: 최근/최고/델타(직전 대비)', () => {
    const c = deriveCard(s({ recentTopWeightKg: 90, recentTopReps: 5, bestTopWeightKg: 105, bestTopReps: 5, prevTopWeightKg: 87.5 }));
    expect(c.recentTopSet).toEqual({ weight: 90, reps: 5 });
    expect(c.bestSet).toEqual({ weight: 105, reps: 5 });
    expect(c.deltaKg).toBe(2.5);
    expect(c.isPR).toBe(false);
  });

  it('PR: 최근==최고', () => {
    const c = deriveCard(s({ recentTopWeightKg: 110, recentTopReps: 5, bestTopWeightKg: 110, bestTopReps: 5, prevTopWeightKg: 105 }));
    expect(c.isPR).toBe(true);
  });

  it('맨몸: weight 0, 횟수로', () => {
    const c = deriveCard(s({ recentTopWeightKg: 0, recentTopReps: 12, bestTopWeightKg: 0, bestTopReps: 12, prevTopWeightKg: 0 }));
    expect(c.isPR).toBe(true);
    expect(c.deltaKg).toBe(0);
  });

  it('직전 기록 없으면 델타 null', () => {
    expect(deriveCard(s({ recentTopWeightKg: 60, recentTopReps: 8 })).deltaKg).toBeNull();
  });

  it('기록 전혀 없으면 null', () => {
    const c = deriveCard(base);
    expect(c.recentTopSet).toBeNull();
    expect(c.isPR).toBe(false);
  });
});

describe('formatTopSet / mainValue', () => {
  it('무게 세트 = W × R', () => expect(formatTopSet({ weight: 82.5, reps: 8 })).toBe('82.5 × 8'));
  it('맨몸(0) = 횟수', () => expect(formatTopSet({ weight: 0, reps: 12 })).toBe('12회'));
  it('null = –', () => expect(formatTopSet(null)).toBe('–'));
  it('mainValue 무게/맨몸 단위', () => {
    expect(mainValue({ weight: 80, reps: 5 })).toEqual({ value: '80', unit: 'kg' });
    expect(mainValue({ weight: 0, reps: 12 })).toEqual({ value: '12', unit: '회' });
  });
});

describe('formatDelta', () => {
  it('증가만 ↑', () => expect(formatDelta(2.5)).toBe('↑2.5kg'));
  it('0/감소/없음 = null', () => {
    expect(formatDelta(0)).toBeNull();
    expect(formatDelta(-5)).toBeNull();
    expect(formatDelta(null)).toBeNull();
  });
});

describe('formatDay', () => {
  const today = new Date('2026-06-20T12:00:00');
  it('오늘/어제/N일 전', () => {
    expect(formatDay('2026-06-20', today)).toBe('오늘');
    expect(formatDay('2026-06-19', today)).toBe('어제');
    expect(formatDay('2026-06-17', today)).toBe('3일 전');
    expect(formatDay('2026-06-10', today)).toBe('1주 전');
  });
  it('null = 빈문자', () => expect(formatDay(null, today)).toBe(''));
});
