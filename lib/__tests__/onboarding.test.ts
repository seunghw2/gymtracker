import { toggleMulti, isLastStep, answersToProfile, successOptions, deriveExperience } from '../onboarding';

describe('successOptions (분기)', () => {
  test('근육/근력/감량은 전용, 그 외는 공통', () => {
    expect(successOptions('strength').options.map(o => o.v)).toContain('bench');
    expect(successOptions('lean_muscle').options.map(o => o.v)).toContain('shoulders_width');
    expect(successOptions('fat_loss').options.map(o => o.v)).toContain('bodyfat');
    expect(successOptions('habit').options.map(o => o.v)).toContain('consistency');
    expect(successOptions(undefined).options.length).toBeGreaterThan(0);
  });
});

describe('deriveExperience', () => {
  test('개월 → 단계', () => {
    expect(deriveExperience(3)).toBe('beginner');
    expect(deriveExperience(9)).toBe('intermediate');
    expect(deriveExperience(48)).toBe('advanced');
    expect(deriveExperience(undefined)).toBeNull();
  });
});

describe('toggleMulti', () => {
  test('없으면 추가, 있으면 제거(불변)', () => {
    expect(toggleMulti([], 'chest')).toEqual(['chest']);
    expect(toggleMulti(['chest'], 'back')).toEqual(['chest', 'back']);
    expect(toggleMulti(['chest', 'back'], 'chest')).toEqual(['back']);
  });
  test('원본 배열을 바꾸지 않는다', () => {
    const src = ['chest'];
    toggleMulti(src, 'back');
    expect(src).toEqual(['chest']);
  });
});

describe('isLastStep', () => {
  test('마지막 인덱스 판정', () => {
    expect(isLastStep(8, 9)).toBe(true);
    expect(isLastStep(7, 9)).toBe(false);
  });
});

describe('answersToProfile', () => {
  test('단일·복수·숫자 필드 매핑', () => {
    const p = answersToProfile({
      goal: 'lean_muscle', weightGoal: 'gain', successGoal: 'shoulders_width',
      trainingMonths: 24, frequency: 4, sessionMinutes: 60, muscles: ['back', 'shoulders'],
    });
    expect(p.goalPhysique).toBe('lean_muscle');
    expect(p.weightGoal).toBe('gain');
    expect(p.successGoal).toBe('shoulders_width');
    expect(p.priorityMuscles).toEqual(['back', 'shoulders']);
    expect(p.weeklyFrequencyTarget).toBe(4);
    expect(p.experienceLevel).toBe('intermediate'); // trainingMonths 24 → 도출
    expect(p.trainingMonths).toBe(24);
    expect(p.sessionMinutes).toBe(60);
    expect(p.splitStyle).toBeNull();
  });
  test('constraints = 칩 + 직접입력(콤마 분리) 합치고 공백 정리', () => {
    const p = answersToProfile({ goal: 'strength', constraintChips: ['어깨'], constraintText: '왼 무릎,  손목 ' });
    expect(p.constraints).toEqual(['어깨', '왼 무릎', '손목']);
  });
  test('빈 메모는 null, 미응답 필드는 null/빈배열', () => {
    const p = answersToProfile({ goal: 'health', note: '   ' });
    expect(p.freeNote).toBeNull();
    expect(p.weightGoal).toBeNull();
    expect(p.priorityMuscles).toEqual([]);
    expect(p.constraints).toEqual([]);
  });
});
