// 점진적 과부하 — Rule 기반 엔진 (순수 함수, UI/AI 의존 없음)
import type {
  ProgressionInput, ExerciseProgressionGoal, ProgressionResult, StageGuideText,
  ExerciseRecord, EffortLevel, ComparisonConfidence, ProgressionStage,
} from './progressionTypes';
import {
  getDefaultProgressionMethod, getDefaultRepRange, getDefaultSets,
  totalReps, topWorkingWeight, topWeightReps, workingSets, getComparisonConfidence,
} from './progressionRules';
import type { ExerciseKind } from './progressionTypes';

/** 진행 기준 반복수 — 맨몸은 전체 작업 세트, 무게 기반은 대표(최대) 무게 세트만 합산. */
function progressionReps(kind: ExerciseKind, rec: ExerciseRecord): number {
  if (kind === 'BODYWEIGHT') return totalReps(rec);
  return topWeightReps(rec).reduce((s, r) => s + r, 0);
}
import { STAGE_LABEL, comparisonNote } from './progressionMessages';

// 유형별 "반복수 쌓기" 1회 증가 폭 [floor, ceil]
const BUILD_BUMP: Record<string, [number, number]> = {
  BODYWEIGHT: [1, 2],
  BARBELL_COMPOUND: [1, 2],
  MACHINE_OR_CABLE: [2, 3],
  ISOLATION: [1, 2],
};

function fmtKg(w: number): string {
  return (w === Math.floor(w) ? String(w) : String(w)) + 'kg';
}

/** 직전 기록의 모든 작업 세트가 목표 반복 상단을 채웠는가. */
function metTopOfRange(rec: ExerciseRecord, repMax: number, sets: number): boolean {
  const reps = topWeightReps(rec);
  if (reps.length < sets) return false;
  return reps.filter(r => r >= repMax).length >= sets;
}

/** 최근 비교 가능 기록들에서 총 반복수가 정체(비증가)인지 — 3회 이상 변화 없음. */
function isStalling(records: ExerciseRecord[] | undefined, kind: ExerciseKind): boolean {
  if (!records || records.length < 3) return false;
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const totals = recent.map(r => progressionReps(kind, r));
  // 최신이 가장 오래된 것보다 크지 않으면(개선 없음) 정체로 본다
  return totals[0] <= totals[2];
}

/**
 * 오늘의 목표/단계 산출 (운동 전).
 * 기준 기록이 없으면 NEED_BASELINE.
 */
export function getNextTarget(input: ProgressionInput): ExerciseProgressionGoal {
  const { kind, role, userGoal, previousComparableRecord: prev, recentRecords, lastEffort } = input;
  const method = getDefaultProgressionMethod(kind);
  const range = getDefaultRepRange(kind, userGoal);
  const sets = getDefaultSets(kind);
  const confidence = getComparisonConfidence(prev, recentRecords?.[0] ?? prev);

  // 기준 기록 없음
  if (!prev || workingSets(prev).length === 0) {
    return {
      role, kind, stage: 'NEED_BASELINE', method,
      targetRepMin: range.min, targetRepMax: range.max, targetSets: sets,
      comparisonConfidence: 'DEFERRED',
    };
  }

  const w = topWorkingWeight(prev);
  const prevTotal = progressionReps(kind, prev);
  const [lowBump, highBump] = BUILD_BUMP[kind];

  // 정체 점검
  if (isStalling(recentRecords, kind)) {
    return {
      role, kind, stage: 'STALL_REVIEW', method,
      targetRepMin: range.min, targetRepMax: range.max, targetSets: sets,
      targetWeight: w, targetTotalReps: prevTotal,
      comparisonConfidence: confidence,
      shortTermTarget: shortTerm(kind, prevTotal),
      longTermTarget: longTerm(kind, prevTotal),
    };
  }

  // ── BODYWEIGHT: 총 반복수 증가 ──
  if (kind === 'BODYWEIGHT') {
    const target = prevTotal + lowBump;
    return {
      role, kind, stage: 'BUILD_REPS', method,
      targetTotalReps: target, targetSets: sets,
      comparisonConfidence: confidence,
      shortTermTarget: `총 ${Math.max(8, Math.ceil(prevTotal * 1.5))}회`,
      longTermTarget: '총 15회',
    };
  }

  // ── ISOLATION: 반복 범위 유지 ──
  if (kind === 'ISOLATION') {
    const ready = metTopOfRange(prev, range.max, sets) && readyByEffort(lastEffort);
    return {
      role, kind, stage: ready ? 'READY_TO_INCREASE' : 'BUILD_REPS', method,
      targetRepMin: range.min, targetRepMax: range.max, targetSets: sets,
      targetWeight: w,
      comparisonConfidence: confidence,
    };
  }

  // ── BARBELL_COMPOUND / MACHINE_OR_CABLE ──
  const ready = metTopOfRange(prev, range.max, sets) && readyByEffort(lastEffort);
  if (ready) {
    const inc = kind === 'BARBELL_COMPOUND' ? (input.userGoal === 'strength' ? 2.5 : 2.5) : 2.5;
    return {
      role, kind, stage: 'READY_TO_INCREASE', method,
      targetRepMin: range.min, targetRepMax: range.max, targetSets: sets,
      targetWeight: w, nextWeightIncrement: inc,
      comparisonConfidence: confidence,
    };
  }

  // 반복수 쌓는 중 — 같은 무게, 총 반복수 +bump
  const target = prevTotal + lowBump;
  return {
    role, kind, stage: 'BUILD_REPS', method,
    targetRepMin: range.min, targetRepMax: range.max, targetSets: sets,
    targetWeight: w, targetTotalReps: target,
    comparisonConfidence: confidence,
  };
}

function readyByEffort(effort?: EffortLevel): boolean {
  // 거의 한계/실패면 증량 준비 아님. 그 외(여유·2~3개·미입력)는 준비 가능.
  return effort !== 'NEAR_LIMIT' && effort !== 'FAILURE';
}

function shortTerm(kind: string, prevTotal: number): string | undefined {
  if (kind === 'BODYWEIGHT') return `총 ${Math.max(8, Math.ceil(prevTotal * 1.5))}회`;
  return undefined;
}
function longTerm(kind: string, _prevTotal: number): string | undefined {
  if (kind === 'BODYWEIGHT') return '총 15회';
  return undefined;
}

/**
 * 운동 후 결과 평가 (운동 후).
 */
export function evaluateWorkoutResult(args: {
  goal: ExerciseProgressionGoal;
  previousComparableRecord?: ExerciseRecord | null;
  currentRecord: ExerciseRecord;
  effortLevel?: EffortLevel;
  comparisonConfidence?: ComparisonConfidence;
  recentRecords?: ExerciseRecord[];
}): ProgressionResult {
  const { goal, previousComparableRecord: prev, currentRecord: cur, effortLevel } = args;
  const previousStage = goal.stage;
  const confidence = args.comparisonConfidence ?? getComparisonConfidence(prev, cur);

  // 기준 생성
  if (!prev || workingSets(prev).length === 0 || previousStage === 'NEED_BASELINE') {
    const next: ProgressionStage = goal.kind === 'ISOLATION' ? 'BUILD_REPS' : 'BUILD_REPS';
    return {
      result: 'BASELINE_CREATED',
      previousStage, nextStage: next, comparisonConfidence: confidence,
      reason: 'no comparable baseline existed; this record becomes the baseline',
      userMessage: '첫 기준 기록을 만들었어요. 다음 운동부터 비교해 드릴게요.',
      nextTargetText: nextTargetText(goal.kind, cur),
    };
  }

  // 비교 보류 — 하락으로 표현하지 않음
  if (confidence === 'DEFERRED' || confidence === 'LOW') {
    return {
      result: 'COMPARISON_DEFERRED',
      previousStage, nextStage: previousStage, comparisonConfidence: confidence,
      reason: `comparison confidence=${confidence}; order/condition differs`,
      userMessage: comparisonNote(confidence) ?? '직접 비교하지 않았어요.',
      nextTargetText: nextTargetText(goal.kind, cur),
    };
  }

  const prevTotal = progressionReps(goal.kind, prev);
  const curTotal = progressionReps(goal.kind, cur);
  const range = { min: goal.targetRepMin ?? 0, max: goal.targetRepMax ?? 0 };
  const sets = goal.targetSets ?? workingSets(cur).length;
  const metTop = goal.kind !== 'BODYWEIGHT' && metTopOfRange(cur, range.max, sets);

  // 증량 준비 — 목표 상단 달성 + 노력 여유
  if (metTop && readyByEffort(effortLevel)) {
    return {
      result: 'READY_TO_INCREASE',
      previousStage, nextStage: 'READY_TO_INCREASE', comparisonConfidence: confidence,
      reason: 'all working sets reached top of rep range with effort to spare',
      userMessage: '목표 반복을 충분히 채웠어요. 다음 운동에서 증량을 고려해 보세요.',
      nextTargetText: '다음 세션 +' + (goal.nextWeightIncrement ?? 2.5) + 'kg 가능',
    };
  }

  // 개선
  if (curTotal > prevTotal) {
    return {
      result: 'IMPROVED',
      previousStage, nextStage: 'BUILD_REPS', comparisonConfidence: confidence,
      reason: `total reps ${prevTotal} -> ${curTotal}`,
      userMessage: `총 반복수가 ${curTotal - prevTotal}회 늘었어요. 기준 대비 개선!`,
      nextTargetText: nextTargetText(goal.kind, cur),
    };
  }

  // 미달 + 거의 한계/실패 → 같은 목표 재도전, 반복되면 정체
  if (curTotal < prevTotal && (effortLevel === 'NEAR_LIMIT' || effortLevel === 'FAILURE')) {
    if (isStalling(args.recentRecords, goal.kind)) {
      return {
        result: 'STALL_POSSIBLE',
        previousStage, nextStage: 'STALL_REVIEW', comparisonConfidence: confidence,
        reason: 'repeated non-improvement across recent comparable records',
        userMessage: '최근 변화가 적어요. 같은 순서·조건에서 한 번 더 기록하거나 세트를 조정해 보세요.',
        nextTargetText: '같은 무게로 한 번 더, 또는 1세트 추가',
      };
    }
    return {
      result: 'MISSED',
      previousStage, nextStage: 'HOLD_OR_REPEAT', comparisonConfidence: confidence,
      reason: `total reps dropped to ${curTotal}, effort high`,
      userMessage: '오늘은 목표에 못 미쳤어요. 다음엔 같은 목표를 한 번 더 확인해요.',
      nextTargetText: nextTargetText(goal.kind, prev),
    };
  }

  // 유지 (NEED_BASELINE은 앞에서 이미 처리됨)
  return {
    result: 'MAINTAINED',
    previousStage, nextStage: previousStage,
    comparisonConfidence: confidence,
    reason: `total reps ${prevTotal} ~= ${curTotal}`,
    userMessage: '기준을 유지했어요. 다음 운동에서 총 반복수 1~2회 증가를 노려보세요.',
    nextTargetText: nextTargetText(goal.kind, cur),
  };
}

/** 다음 목표 텍스트 — 기록 기준 다음 단계 제안. */
function nextTargetText(kind: ExerciseKind, rec: ExerciseRecord): string {
  if (kind === 'BODYWEIGHT') return `총 ${totalReps(rec) + 1}회`;
  const total = progressionReps(kind, rec);
  const w = topWorkingWeight(rec);
  const [low, high] = BUILD_BUMP[kind] ?? [1, 2];
  return `${fmtKg(w)} 총 ${total + low}~${total + high}회`;
}

/** 비교 가능한 기록 요약 텍스트 — "50kg 10/10/9/8" 또는 "총 3회". */
export function formatRecord(kind: string, rec: ExerciseRecord): string {
  const ws = workingSets(rec);
  if (ws.length === 0) return '-';
  const w = topWorkingWeight(rec);
  if (kind === 'BODYWEIGHT' || w === 0) {
    return `총 ${totalReps(rec)}회`;
  }
  const reps = topWeightReps(rec).join('/');
  return `${fmtKg(w)} ${reps}`;
}

/**
 * 홈/바텀시트용 단계 가이드 텍스트.
 */
export function getStageGuideText(goal: ExerciseProgressionGoal): StageGuideText {
  const stageLabel = STAGE_LABEL[goal.stage];
  const min = goal.targetRepMin, max = goal.targetRepMax, sets = goal.targetSets ?? 3;

  switch (goal.stage) {
    case 'NEED_BASELINE': {
      let target: string;
      if (goal.kind === 'BODYWEIGHT') target = '현재 가능한 총 반복수를 기록하세요';
      else if (goal.kind === 'ISOLATION') target = `${min}~${max}회 × ${sets}세트로 첫 기준 만들기`;
      else if (goal.kind === 'BARBELL_COMPOUND') target = '현재 가능한 안전한 작업 세트 기록하기';
      else target = `${min}~${max}회 × ${sets}세트 기준 만들기`;
      return {
        stageLabel,
        currentTargetText: target,
        nextConditionText: '1회 기록하면 다음 단계로 넘어가요',
        cautionText: goal.kind === 'ISOLATION' ? '무게보다 자세와 반복 범위 유지가 우선' : undefined,
      };
    }
    case 'BUILD_REPS': {
      let target: string;
      if (goal.kind === 'BODYWEIGHT') target = `총 ${goal.targetTotalReps}회`;
      else if (goal.kind === 'ISOLATION') target = `${min}~${max}회 × ${sets}세트 유지`;
      else target = `${fmtKg(goal.targetWeight ?? 0)} 총 ${goal.targetTotalReps}~${(goal.targetTotalReps ?? 0) + 1}회`;
      return {
        stageLabel,
        currentTargetText: target,
        nextConditionText: goal.kind === 'BODYWEIGHT'
          ? '지난 기록보다 총 반복수 +1회'
          : '목표 반복 범위 상단을 모두 채우면 증량 준비',
        cautionText: goal.kind === 'ISOLATION' ? '무게보다 자세와 반복수 유지가 우선' : undefined,
      };
    }
    case 'READY_TO_INCREASE':
      return {
        stageLabel,
        currentTargetText: `다음 운동에서 +${goal.nextWeightIncrement ?? 2.5}kg 도전 가능`,
        nextConditionText: '증량 적용하면 새 무게 적응 단계로',
        cautionText: goal.kind === 'ISOLATION' ? '증량은 보수적으로 — 강제하지 않아요' : undefined,
      };
    case 'INCREASE_LOAD':
      return {
        stageLabel,
        currentTargetText: `${fmtKg(goal.targetWeight ?? 0)} ${min}~${max}회 목표`,
        nextConditionText: '새 무게에서 기준이 만들어지면 적응 단계로',
        cautionText: '증량 직후 반복수 하락은 정상이에요',
      };
    case 'CONSOLIDATE':
      return {
        stageLabel,
        currentTargetText: '지난 새 무게 기록 유지 또는 총 반복수 +1',
        nextConditionText: '반복수가 안정되면 다시 반복수 쌓기',
        cautionText: '무게보다 자세와 반복수 안정화 우선',
      };
    case 'HOLD_OR_REPEAT':
      return {
        stageLabel,
        currentTargetText: '지난 목표를 그대로 한 번 더',
        nextConditionText: '달성하면 다시 반복수 쌓기',
      };
    case 'STALL_REVIEW':
      return {
        stageLabel,
        currentTargetText: '같은 순서·조건에서 한 번 더 기록',
        nextConditionText: '변화가 없으면 세트 추가 또는 5~10% 감량 후 재시작',
        cautionText: '운동 순서·휴식이 다르면 정체로 단정하지 않아요',
      };
    case 'DELOAD_OR_RESET':
      return {
        stageLabel,
        currentTargetText: '무게를 5~10% 낮춰 반복수부터 다시 쌓기',
        nextConditionText: '새 기준이 안정되면 다시 반복수 쌓기',
        cautionText: '리셋은 후퇴가 아니라 재정비예요',
      };
  }
}
