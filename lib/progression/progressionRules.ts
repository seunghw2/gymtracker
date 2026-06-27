// 점진적 과부하 — 운동 유형별 기본 규칙 + 비교 신뢰도 (순수 함수)
import type {
  ExerciseKind, ProgressionMethod, ComparisonConfidence,
  ExerciseRecord, UserGoalType, SetRecord,
} from './progressionTypes';
import { classifyRuleType, type RuleType } from '../overload';

/** 기존 RuleType ↔ ExerciseKind 매핑. */
export function ruleTypeToKind(rt: RuleType): ExerciseKind {
  switch (rt) {
    case 'barbell_main': return 'BARBELL_COMPOUND';
    case 'machine_cable': return 'MACHINE_OR_CABLE';
    case 'bodyweight': return 'BODYWEIGHT';
    case 'isolation': return 'ISOLATION';
  }
}

export function classifyKind(equipmentType: string, muscleGroup: string): ExerciseKind {
  return ruleTypeToKind(classifyRuleType(equipmentType, muscleGroup));
}

export function getDefaultProgressionMethod(kind: ExerciseKind): ProgressionMethod {
  switch (kind) {
    case 'BARBELL_COMPOUND': return 'WEIGHT_FIRST';
    case 'MACHINE_OR_CABLE': return 'REP_RANGE';
    case 'BODYWEIGHT': return 'TOTAL_REPS';
    case 'ISOLATION': return 'MAINTAIN_RANGE';
  }
}

/** 유형 + 사용자 목표별 기본 반복 범위. */
export function getDefaultRepRange(kind: ExerciseKind, userGoal?: UserGoalType): { min: number; max: number } {
  // 근력 목표는 바벨 메인을 낮은 반복으로, 그 외는 근비대 기본
  if (kind === 'BARBELL_COMPOUND') {
    return userGoal === 'strength' ? { min: 3, max: 6 } : { min: 6, max: 10 };
  }
  if (kind === 'MACHINE_OR_CABLE') return { min: 8, max: 12 };
  if (kind === 'ISOLATION') return { min: 12, max: 20 };
  // BODYWEIGHT — 범위 개념보다 총 반복수 중심이나 표기용 기본
  return { min: 5, max: 12 };
}

/** 유형별 기본 세트 수. */
export function getDefaultSets(kind: ExerciseKind): number {
  return kind === 'ISOLATION' ? 3 : 3;
}

/** 유형별 기본 증량 단위(kg). 상/하체 구분은 호출부에서 override. */
export function getDefaultIncrement(kind: ExerciseKind, isLowerBody: boolean): number {
  if (kind === 'BODYWEIGHT' || kind === 'ISOLATION') return 0;
  return isLowerBody ? 5 : 2.5;
}

// ── 기록 계산 헬퍼 ─────────────────────────────────────────────────────────

/** 워밍업 제외 작업 세트만. */
export function workingSets(rec: ExerciseRecord): SetRecord[] {
  return rec.sets.filter(s => (s.setType ?? 'NORMAL') !== 'WARMUP');
}

/** 작업 세트 총 반복수. */
export function totalReps(rec: ExerciseRecord): number {
  return workingSets(rec).reduce((sum, s) => sum + s.reps, 0);
}

/** 작업 세트 중 가장 무거운 무게(대표 작업 무게). */
export function topWorkingWeight(rec: ExerciseRecord): number {
  return workingSets(rec).reduce((m, s) => Math.max(m, s.weightKg), 0);
}

/** 대표 무게에서 수행한 작업 세트들의 반복수 배열. */
export function topWeightReps(rec: ExerciseRecord): number[] {
  const w = topWorkingWeight(rec);
  return workingSets(rec).filter(s => s.weightKg === w).map(s => s.reps);
}

/**
 * 비교 신뢰도 — 직전 기록과 현재 기록의 조건 유사성.
 * 순서·휴식·세트수·무게 차이를 본다. 기준 없으면 DEFERRED.
 */
export function getComparisonConfidence(
  previousRecord: ExerciseRecord | null | undefined,
  currentRecord: ExerciseRecord | null | undefined,
): ComparisonConfidence {
  if (!previousRecord || !currentRecord) return 'DEFERRED';

  const prevSets = workingSets(previousRecord).length;
  const curSets = workingSets(currentRecord).length;
  if (prevSets === 0 || curSets === 0) return 'DEFERRED';

  // 너무 오래된 기록(56일 초과)은 비교 보류
  const dayDiff = Math.abs(daysBetween(previousRecord.date, currentRecord.date));
  if (dayDiff > 56) return 'DEFERRED';

  const setDiff = Math.abs(prevSets - curSets);

  // 수행 순서 차이 (둘 다 있을 때만)
  let orderDiff: number | null = null;
  if (previousRecord.orderIndex != null && currentRecord.orderIndex != null) {
    orderDiff = Math.abs(previousRecord.orderIndex - currentRecord.orderIndex);
  }

  // 휴식 차이 (둘 다 있을 때만)
  let restDiff: number | null = null;
  if (previousRecord.restSecAvg != null && currentRecord.restSecAvg != null) {
    restDiff = Math.abs(previousRecord.restSecAvg - currentRecord.restSecAvg);
  }

  // LOW: 순서 크게 다르거나 세트수 크게 다름
  if ((orderDiff != null && orderDiff >= 3) || setDiff >= 2) return 'LOW';

  // MEDIUM: 순서 1~2 차이 또는 세트수 1 차이 또는 휴식 60초+ 차이
  if ((orderDiff != null && orderDiff >= 1) || setDiff === 1 || (restDiff != null && restDiff > 60)) {
    return 'MEDIUM';
  }

  return 'HIGH';
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86400000);
}
