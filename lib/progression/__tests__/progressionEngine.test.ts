import {
  getNextTarget, evaluateWorkoutResult, getStageGuideText, formatRecord,
} from '../progressionEngine';
import { getComparisonConfidence } from '../progressionRules';
import type { ExerciseRecord, ExerciseProgressionGoal } from '../progressionTypes';

function rec(date: string, sets: { weightKg: number; reps: number; setType?: string }[], extra?: Partial<ExerciseRecord>): ExerciseRecord {
  return { recordId: date, date, sets, ...extra };
}

// ── §14-1. Pull Up (맨몸, 핵심) ──────────────────────────────────────────────
describe('Pull Up — BODYWEIGHT', () => {
  const prev = rec('2026-06-20', [{ weightKg: 0, reps: 1 }, { weightKg: 0, reps: 1 }, { weightKg: 0, reps: 1 }]); // 총 3

  it('오늘 목표는 총 4회 (총 3 + 1) — 15회를 바로 요구하지 않음', () => {
    const g = getNextTarget({ kind: 'BODYWEIGHT', role: 'CORE', previousComparableRecord: prev });
    expect(g.stage).toBe('BUILD_REPS');
    expect(g.targetTotalReps).toBe(4);
    expect(g.longTermTarget).toBe('총 15회');
    const guide = getStageGuideText(g);
    expect(guide.currentTargetText).toBe('총 4회');
  });

  it('장기 목표와 오늘 목표가 분리된다', () => {
    const g = getNextTarget({ kind: 'BODYWEIGHT', role: 'CORE', previousComparableRecord: prev });
    expect(g.targetTotalReps).not.toBe(15);
    expect(g.longTermTarget).toBe('총 15회');
  });
});

// ── §14-2. Squat (바벨 메인, 보조) ───────────────────────────────────────────
describe('Squat — BARBELL_COMPOUND', () => {
  const prev = rec('2026-06-20', [
    { weightKg: 80, reps: 4 }, { weightKg: 80, reps: 4 },
    { weightKg: 80, reps: 4 }, { weightKg: 80, reps: 4 },
  ]); // 총 16

  it('오늘 목표는 80kg 총 17~18회 — 8회x3세트를 바로 요구하지 않음', () => {
    const g = getNextTarget({ kind: 'BARBELL_COMPOUND', role: 'ASSISTANCE', previousComparableRecord: prev });
    expect(g.stage).toBe('BUILD_REPS');
    expect(g.targetWeight).toBe(80);
    expect(g.targetTotalReps).toBe(17);
    const guide = getStageGuideText(g);
    expect(guide.currentTargetText).toBe('80kg 총 17~18회');
    // 세트x반복(8회 3세트)을 강제하지 않고 총 반복수로 제시
    expect(guide.currentTargetText).toContain('총');
    expect(guide.currentTargetText).not.toContain('세트');
  });
});

// ── §14-3. Lateral Raise (고립, 핵심, 기준없음) ──────────────────────────────
describe('Lateral Raise — ISOLATION, no baseline', () => {
  it('NEED_BASELINE 상태 + 12~20회x3 기준 만들기 + 자세 우선 메시지', () => {
    const g = getNextTarget({ kind: 'ISOLATION', role: 'CORE', previousComparableRecord: null });
    expect(g.stage).toBe('NEED_BASELINE');
    expect(g.targetRepMin).toBe(12);
    expect(g.targetRepMax).toBe(20);
    const guide = getStageGuideText(g);
    expect(guide.currentTargetText).toContain('12~20회');
    expect(guide.cautionText).toContain('자세');
  });
});

// ── §14-4. Lat Pulldown (머신/케이블, 핵심) ──────────────────────────────────
describe('Lat Pulldown — MACHINE_OR_CABLE', () => {
  const prev = rec('2026-06-20', [
    { weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 },
    { weightKg: 50, reps: 9 }, { weightKg: 50, reps: 8 },
  ]); // 총 37

  it('오늘 목표는 50kg 총 39~40회 (범위 상단 전엔 증량 안 함)', () => {
    const g = getNextTarget({ kind: 'MACHINE_OR_CABLE', role: 'CORE', previousComparableRecord: prev });
    expect(g.stage).toBe('BUILD_REPS');
    expect(g.targetWeight).toBe(50);
    expect(g.targetTotalReps).toBe(39);
    const guide = getStageGuideText(g);
    expect(guide.currentTargetText).toBe('50kg 총 39~40회');
  });

  it('모든 세트가 범위 상단 달성 + 노력 여유면 증량 준비', () => {
    const topped = rec('2026-06-22', [
      { weightKg: 50, reps: 12 }, { weightKg: 50, reps: 12 }, { weightKg: 50, reps: 12 },
    ]);
    const g = getNextTarget({ kind: 'MACHINE_OR_CABLE', role: 'CORE', previousComparableRecord: topped, lastEffort: 'EASY' });
    expect(g.stage).toBe('READY_TO_INCREASE');
  });

  it('범위 상단 달성해도 거의 한계면 증량 준비 아님', () => {
    const topped = rec('2026-06-22', [
      { weightKg: 50, reps: 12 }, { weightKg: 50, reps: 12 }, { weightKg: 50, reps: 12 },
    ]);
    const g = getNextTarget({ kind: 'MACHINE_OR_CABLE', role: 'CORE', previousComparableRecord: topped, lastEffort: 'NEAR_LIMIT' });
    expect(g.stage).toBe('BUILD_REPS');
  });
});

// ── §14-5. 비교 보류 ─────────────────────────────────────────────────────────
describe('비교 신뢰도 / 비교 보류', () => {
  it('수행 순서 차이 크면 LOW', () => {
    const prev = rec('2026-06-20', [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }], { orderIndex: 1 });
    const cur = rec('2026-06-22', [{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }], { orderIndex: 5 });
    expect(getComparisonConfidence(prev, cur)).toBe('LOW');
  });

  it('비교 보류는 하락이 아니라 안내 메시지로 표현', () => {
    const goal: ExerciseProgressionGoal = {
      role: 'CORE', kind: 'MACHINE_OR_CABLE', stage: 'BUILD_REPS', method: 'REP_RANGE',
      targetRepMin: 8, targetRepMax: 12, targetSets: 3, targetWeight: 50, comparisonConfidence: 'HIGH',
    };
    const prev = rec('2026-06-20', [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }], { orderIndex: 1 });
    const cur = rec('2026-06-22', [{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }], { orderIndex: 5 });
    const r = evaluateWorkoutResult({ goal, previousComparableRecord: prev, currentRecord: cur });
    expect(r.result).toBe('COMPARISON_DEFERRED');
    expect(r.nextStage).toBe('BUILD_REPS'); // 단계 유지
    expect(r.userMessage).toContain('순서');
  });

  it('기준 기록 없으면 DEFERRED', () => {
    const cur = rec('2026-06-22', [{ weightKg: 50, reps: 8 }]);
    expect(getComparisonConfidence(null, cur)).toBe('DEFERRED');
  });

  it('같은 조건이면 HIGH', () => {
    const prev = rec('2026-06-20', [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }], { orderIndex: 2 });
    const cur = rec('2026-06-22', [{ weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 }], { orderIndex: 2 });
    expect(getComparisonConfidence(prev, cur)).toBe('HIGH');
  });
});

// ── evaluateWorkoutResult 결과 분기 ─────────────────────────────────────────
describe('evaluateWorkoutResult', () => {
  const goalBW: ExerciseProgressionGoal = {
    role: 'CORE', kind: 'BODYWEIGHT', stage: 'BUILD_REPS', method: 'TOTAL_REPS',
    targetTotalReps: 4, targetSets: 3, comparisonConfidence: 'HIGH',
  };

  it('기준 없으면 BASELINE_CREATED', () => {
    const cur = rec('2026-06-22', [{ weightKg: 0, reps: 3 }]);
    const r = evaluateWorkoutResult({ goal: { ...goalBW, stage: 'NEED_BASELINE' }, previousComparableRecord: null, currentRecord: cur });
    expect(r.result).toBe('BASELINE_CREATED');
  });

  it('총 반복수 증가 → IMPROVED', () => {
    const prev = rec('2026-06-20', [{ weightKg: 0, reps: 3 }]);
    const cur = rec('2026-06-22', [{ weightKg: 0, reps: 4 }]);
    const r = evaluateWorkoutResult({ goal: goalBW, previousComparableRecord: prev, currentRecord: cur, comparisonConfidence: 'HIGH' });
    expect(r.result).toBe('IMPROVED');
    expect(r.userMessage).toContain('1회');
  });

  it('동일하면 MAINTAINED', () => {
    const prev = rec('2026-06-20', [{ weightKg: 0, reps: 3 }]);
    const cur = rec('2026-06-22', [{ weightKg: 0, reps: 3 }]);
    const r = evaluateWorkoutResult({ goal: goalBW, previousComparableRecord: prev, currentRecord: cur, comparisonConfidence: 'HIGH' });
    expect(r.result).toBe('MAINTAINED');
  });

  it('미달 + 거의 한계 → MISSED → HOLD_OR_REPEAT', () => {
    const prev = rec('2026-06-20', [{ weightKg: 0, reps: 5 }]);
    const cur = rec('2026-06-22', [{ weightKg: 0, reps: 3 }]);
    const r = evaluateWorkoutResult({ goal: goalBW, previousComparableRecord: prev, currentRecord: cur, effortLevel: 'NEAR_LIMIT', comparisonConfidence: 'HIGH' });
    expect(r.result).toBe('MISSED');
    expect(r.nextStage).toBe('HOLD_OR_REPEAT');
  });

  it('머신 범위 상단 + 여유 → READY_TO_INCREASE', () => {
    const goal: ExerciseProgressionGoal = {
      role: 'CORE', kind: 'MACHINE_OR_CABLE', stage: 'BUILD_REPS', method: 'REP_RANGE',
      targetRepMin: 8, targetRepMax: 12, targetSets: 3, targetWeight: 50, nextWeightIncrement: 2.5, comparisonConfidence: 'HIGH',
    };
    const prev = rec('2026-06-20', [{ weightKg: 50, reps: 11 }, { weightKg: 50, reps: 11 }, { weightKg: 50, reps: 10 }]);
    const cur = rec('2026-06-22', [{ weightKg: 50, reps: 12 }, { weightKg: 50, reps: 12 }, { weightKg: 50, reps: 12 }]);
    const r = evaluateWorkoutResult({ goal, previousComparableRecord: prev, currentRecord: cur, effortLevel: 'RIR_2_3', comparisonConfidence: 'HIGH' });
    expect(r.result).toBe('READY_TO_INCREASE');
    expect(r.nextTargetText).toContain('2.5kg');
  });
});

// ── 정체 ─────────────────────────────────────────────────────────────────────
describe('정체 점검 (STALL_REVIEW)', () => {
  it('최근 3회 총 반복수 비증가 → STALL_REVIEW', () => {
    const recents = [
      rec('2026-06-22', [{ weightKg: 80, reps: 4 }, { weightKg: 80, reps: 4 }]), // 8
      rec('2026-06-19', [{ weightKg: 80, reps: 4 }, { weightKg: 80, reps: 5 }]), // 9
      rec('2026-06-16', [{ weightKg: 80, reps: 5 }, { weightKg: 80, reps: 4 }]), // 9
    ];
    const g = getNextTarget({
      kind: 'BARBELL_COMPOUND', role: 'CORE',
      previousComparableRecord: recents[0], recentRecords: recents,
    });
    expect(g.stage).toBe('STALL_REVIEW');
  });
});

// ── formatRecord ─────────────────────────────────────────────────────────────
describe('formatRecord', () => {
  it('무게 기록은 "50kg 10/10/9/8"', () => {
    const r = rec('2026-06-20', [
      { weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 },
      { weightKg: 50, reps: 9 }, { weightKg: 50, reps: 8 },
    ]);
    expect(formatRecord('MACHINE_OR_CABLE', r)).toBe('50kg 10/10/9/8');
  });

  it('맨몸 기록은 "총 N회"', () => {
    const r = rec('2026-06-20', [{ weightKg: 0, reps: 2 }, { weightKg: 0, reps: 1 }]);
    expect(formatRecord('BODYWEIGHT', r)).toBe('총 3회');
  });

  it('워밍업 세트는 제외', () => {
    const r = rec('2026-06-20', [
      { weightKg: 20, reps: 15, setType: 'WARMUP' },
      { weightKg: 50, reps: 10 }, { weightKg: 50, reps: 10 },
    ]);
    expect(formatRecord('MACHINE_OR_CABLE', r)).toBe('50kg 10/10');
  });
});
