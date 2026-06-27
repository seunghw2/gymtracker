import {
  classifyRuleType,
  nextTarget,
  evaluateProgression,
  weeklyPattern,
  buildNextWeekGoals,
  type ExerciseGoalSpec,
  type SessionResult,
} from '../overload';

const BASE_SPEC: ExerciseGoalSpec = {
  targetReps: 8,
  targetSets: 3,
  repRangeMin: 10,
  repRangeMax: 12,
  increment: 2.5,
};

// ── classifyRuleType ─────────────────────────────────────────────────────────

describe('classifyRuleType', () => {
  it('Bodyweight → bodyweight', () => {
    expect(classifyRuleType('Bodyweight', 'Back')).toBe('bodyweight');
  });
  it('Machine → machine_cable', () => {
    expect(classifyRuleType('Machine', 'Chest')).toBe('machine_cable');
  });
  it('Cable → machine_cable', () => {
    expect(classifyRuleType('Cable', 'Back')).toBe('machine_cable');
  });
  it('Barbell + Chest → barbell_main', () => {
    expect(classifyRuleType('Barbell', 'Chest')).toBe('barbell_main');
  });
  it('Barbell + Back → barbell_main', () => {
    expect(classifyRuleType('Barbell', 'Back')).toBe('barbell_main');
  });
  it('Barbell + Legs → barbell_main', () => {
    expect(classifyRuleType('Barbell', 'Legs')).toBe('barbell_main');
  });
  it('Barbell + Shoulder → barbell_main', () => {
    expect(classifyRuleType('Barbell', 'Shoulder')).toBe('barbell_main');
  });
  it('Barbell + Arms → isolation', () => {
    expect(classifyRuleType('Barbell', 'Arms')).toBe('isolation');
  });
  it('Barbell + Core → isolation', () => {
    expect(classifyRuleType('Barbell', 'Core')).toBe('isolation');
  });
  it('Dumbbell → isolation', () => {
    expect(classifyRuleType('Dumbbell', 'Shoulder')).toBe('isolation');
  });
  it('대소문자 무관 — barbell+chest', () => {
    expect(classifyRuleType('barbell', 'chest')).toBe('barbell_main');
  });
  it('대소문자 무관 — MACHINE', () => {
    expect(classifyRuleType('MACHINE', 'Chest')).toBe('machine_cable');
  });
});

// ── nextTarget ───────────────────────────────────────────────────────────────

describe('nextTarget', () => {
  it('barbell_main: 현재 무게 + increment', () => {
    const r = nextTarget('barbell_main', 60, { targetReps: 8, increment: 2.5 });
    expect(r.value).toBe(62.5);
    expect(r.unit).toBe('kg');
    expect(r.label).toBe('62.5kg');
  });

  it('barbell_main: 정수 결과는 소수점 없음', () => {
    const r = nextTarget('barbell_main', 60, { targetReps: 8, increment: 10 });
    expect(r.label).toBe('70kg');
  });

  it('machine_cable: 현재 무게 + increment', () => {
    const r = nextTarget('machine_cable', 59, { targetReps: 12, increment: 5 });
    expect(r.value).toBe(64);
    expect(r.unit).toBe('kg');
  });

  it('bodyweight: 현재 총반복 + targetReps', () => {
    const r = nextTarget('bodyweight', 38, { targetReps: 4, increment: 0 });
    expect(r.value).toBe(42);
    expect(r.unit).toBe('reps');
    expect(r.label).toBe('42회');
  });

  it('isolation: 유지', () => {
    const r = nextTarget('isolation', 12, { targetReps: 15, increment: 0 });
    expect(r.label).toBe('유지');
    expect(r.value).toBe(12);
  });

  it('부동소수점 반올림', () => {
    const r = nextTarget('barbell_main', 60, { targetReps: 8, increment: 1.25 });
    expect(r.value).toBe(61.25);
  });
});

// ── evaluateProgression ──────────────────────────────────────────────────────

function makeSession(date: string, sets: { reps: number; rpe?: number }[]): SessionResult {
  return { date, sets };
}

describe('evaluateProgression', () => {
  describe('isolation → hold', () => {
    it('항상 hold 반환', () => {
      const h = [makeSession('2026-06-20', [{ reps: 15 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'single', 'isolation')).toBe('hold');
    });
  });

  describe('barbell_main / single', () => {
    it('목표 달성 → ready_to_increase', () => {
      const h = [makeSession('2026-06-20', [
        { reps: 8 }, { reps: 8 }, { reps: 8 },
      ])];
      expect(evaluateProgression(h, BASE_SPEC, 'single', 'barbell_main')).toBe('ready_to_increase');
    });

    it('세트 수 부족 → in_progress', () => {
      const h = [makeSession('2026-06-20', [{ reps: 8 }, { reps: 8 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'single', 'barbell_main')).toBe('in_progress');
    });

    it('반복수 부족 → in_progress', () => {
      const h = [makeSession('2026-06-20', [{ reps: 7 }, { reps: 7 }, { reps: 7 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'single', 'barbell_main')).toBe('in_progress');
    });

    it('이력 없음 → in_progress', () => {
      expect(evaluateProgression([], BASE_SPEC, 'single', 'barbell_main')).toBe('in_progress');
    });
  });

  describe('machine_cable / single', () => {
    it('repRangeMax 달성 → ready_to_increase', () => {
      const h = [makeSession('2026-06-20', [{ reps: 12 }, { reps: 12 }, { reps: 12 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'single', 'machine_cable')).toBe('ready_to_increase');
    });

    it('repRangeMax 미달 → in_progress', () => {
      const h = [makeSession('2026-06-20', [{ reps: 10 }, { reps: 10 }, { reps: 10 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'single', 'machine_cable')).toBe('in_progress');
    });
  });

  describe('two_sessions', () => {
    it('2세션 연속 달성 → ready_to_increase', () => {
      const h = [
        makeSession('2026-06-22', [{ reps: 8 }, { reps: 8 }, { reps: 8 }]),
        makeSession('2026-06-19', [{ reps: 8 }, { reps: 8 }, { reps: 8 }]),
      ];
      expect(evaluateProgression(h, BASE_SPEC, 'two_sessions', 'barbell_main')).toBe('ready_to_increase');
    });

    it('1세션만 달성 → in_progress', () => {
      const h = [
        makeSession('2026-06-22', [{ reps: 8 }, { reps: 8 }, { reps: 8 }]),
        makeSession('2026-06-19', [{ reps: 7 }, { reps: 7 }, { reps: 7 }]),
      ];
      expect(evaluateProgression(h, BASE_SPEC, 'two_sessions', 'barbell_main')).toBe('in_progress');
    });

    it('이력 1개 → in_progress', () => {
      const h = [makeSession('2026-06-22', [{ reps: 8 }, { reps: 8 }, { reps: 8 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'two_sessions', 'barbell_main')).toBe('in_progress');
    });

    it('최신 세션 기준 정렬', () => {
      const h = [
        makeSession('2026-06-19', [{ reps: 8 }, { reps: 8 }, { reps: 8 }]),
        makeSession('2026-06-22', [{ reps: 7 }, { reps: 7 }, { reps: 7 }]),
      ];
      expect(evaluateProgression(h, BASE_SPEC, 'two_sessions', 'barbell_main')).toBe('in_progress');
    });
  });

  describe('rpe', () => {
    it('목표 달성 + RPE ≤ 8 → ready_to_increase', () => {
      const h = [makeSession('2026-06-22', [{ reps: 8 }, { reps: 8 }, { reps: 8, rpe: 7 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'rpe', 'barbell_main')).toBe('ready_to_increase');
    });

    it('목표 달성 + RPE > 8 → in_progress', () => {
      const h = [makeSession('2026-06-22', [{ reps: 8 }, { reps: 8 }, { reps: 8, rpe: 9 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'rpe', 'barbell_main')).toBe('in_progress');
    });

    it('RPE 없으면 single 폴백 → ready_to_increase', () => {
      const h = [makeSession('2026-06-22', [{ reps: 8 }, { reps: 8 }, { reps: 8 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'rpe', 'barbell_main')).toBe('ready_to_increase');
    });

    it('목표 미달성이면 RPE 무관 → in_progress', () => {
      const h = [makeSession('2026-06-22', [{ reps: 6 }, { reps: 6 }, { reps: 6, rpe: 5 }])];
      expect(evaluateProgression(h, BASE_SPEC, 'rpe', 'barbell_main')).toBe('in_progress');
    });
  });
});

// ── weeklyPattern ────────────────────────────────────────────────────────────

describe('weeklyPattern', () => {
  const WEEK = '2026-06-22';

  it('주간 범위 내 세트만 집계', () => {
    const sessions = [
      { date: '2026-06-21', sets: [{ muscleGroup: 'Chest' }] },  // 전주
      { date: '2026-06-22', sets: [{ muscleGroup: 'Back' }, { muscleGroup: 'Back' }] },
      { date: '2026-06-25', sets: [{ muscleGroup: 'Legs' }] },
      { date: '2026-06-29', sets: [{ muscleGroup: 'Chest' }] },  // 다음 주
    ];
    const r = weeklyPattern(sessions, WEEK);
    expect(r).toHaveLength(2);
    expect(r.find(p => p.part === 'Back')?.setCount).toBe(2);
    expect(r.find(p => p.part === 'Legs')?.setCount).toBe(1);
  });

  it('세트수 내림차순 정렬', () => {
    const sessions = [
      { date: '2026-06-22', sets: [{ muscleGroup: 'Chest' }] },
      { date: '2026-06-23', sets: [{ muscleGroup: 'Back' }, { muscleGroup: 'Back' }, { muscleGroup: 'Back' }] },
    ];
    const r = weeklyPattern(sessions, WEEK);
    expect(r[0].part).toBe('Back');
    expect(r[1].part).toBe('Chest');
  });

  it('같은 날 세션은 sessionCount = 1', () => {
    const sessions = [
      {
        date: '2026-06-22',
        sets: [{ muscleGroup: 'Back' }, { muscleGroup: 'Back' }, { muscleGroup: 'Back' }],
      },
    ];
    const r = weeklyPattern(sessions, WEEK);
    expect(r[0].sessionCount).toBe(1);
    expect(r[0].setCount).toBe(3);
  });

  it('이틀에 걸친 sessionCount', () => {
    const sessions = [
      { date: '2026-06-22', sets: [{ muscleGroup: 'Back' }] },
      { date: '2026-06-24', sets: [{ muscleGroup: 'Back' }] },
    ];
    const r = weeklyPattern(sessions, WEEK);
    expect(r[0].sessionCount).toBe(2);
  });

  it('빈 세션 → 빈 배열', () => {
    expect(weeklyPattern([], WEEK)).toEqual([]);
  });
});

// ── buildNextWeekGoals ───────────────────────────────────────────────────────

describe('buildNextWeekGoals', () => {
  const goals = [
    { exerciseName: '랫풀다운', ruleType: 'machine_cable' as const, currentValue: 59, nextTargetLabel: '64kg', muscleGroup: 'Back' },
    { exerciseName: '풀업', ruleType: 'bodyweight' as const, currentValue: 38, nextTargetLabel: '42회', muscleGroup: 'Back' },
    { exerciseName: '벤치프레스', ruleType: 'barbell_main' as const, currentValue: 60, nextTargetLabel: '62.5kg', muscleGroup: 'Chest' },
    { exerciseName: '사이드 레터럴', ruleType: 'isolation' as const, currentValue: 12, nextTargetLabel: '유지', muscleGroup: 'Shoulder' },
  ];

  it('부위 필터링', () => {
    const r = buildNextWeekGoals('Back', goals);
    expect(r).toHaveLength(2);
    expect(r.map(l => l.exerciseName)).toContain('랫풀다운');
    expect(r.map(l => l.exerciseName)).toContain('풀업');
  });

  it('from: kg 표시 (무게 기반)', () => {
    const r = buildNextWeekGoals('Back', goals);
    const lat = r.find(l => l.exerciseName === '랫풀다운')!;
    expect(lat.from).toBe('59kg');
  });

  it('from: 회 표시 (맨몸)', () => {
    const r = buildNextWeekGoals('Back', goals);
    const pu = r.find(l => l.exerciseName === '풀업')!;
    expect(pu.from).toBe('38회');
  });

  it('isolation → isHold: true', () => {
    const r = buildNextWeekGoals('Shoulder', goals);
    expect(r[0].isHold).toBe(true);
    expect(r[0].to).toBe('유지');
  });

  it('대소문자 무관 부위 매칭', () => {
    const r = buildNextWeekGoals('back', goals);
    expect(r).toHaveLength(2);
  });

  it('currentValue null → from: -', () => {
    const g = [{ exerciseName: '벤치', ruleType: 'barbell_main' as const, currentValue: null, nextTargetLabel: '62.5kg', muscleGroup: 'Chest' }];
    const r = buildNextWeekGoals('Chest', g);
    expect(r[0].from).toBe('-');
  });
});
