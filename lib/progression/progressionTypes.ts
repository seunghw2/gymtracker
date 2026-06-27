// 점진적 과부하 단계 가이드 — 타입 정의 (순수 도메인, UI 의존 없음)

export type ExerciseRole = 'CORE' | 'ASSISTANCE' | 'LOG_ONLY';

export type ProgressionStage =
  | 'NEED_BASELINE'      // 기준 기록 필요
  | 'BUILD_REPS'         // 반복수 쌓는 중
  | 'READY_TO_INCREASE'  // 증량 준비
  | 'INCREASE_LOAD'      // 증량 적용
  | 'CONSOLIDATE'        // 새 무게 적응 중
  | 'HOLD_OR_REPEAT'     // 같은 목표 재도전
  | 'STALL_REVIEW'       // 정체 점검
  | 'DELOAD_OR_RESET';   // 리셋 권장

export type ProgressionMethod =
  | 'WEIGHT_FIRST'    // 목표 반복 달성 후 증량 (바벨 메인)
  | 'REP_RANGE'       // 반복 범위 채운 뒤 증량 (머신/케이블)
  | 'TOTAL_REPS'      // 총 반복수 증가 (맨몸)
  | 'MAINTAIN_RANGE'; // 반복 범위 유지 (고립)

export type ComparisonConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'DEFERRED';

export type EffortLevel = 'EASY' | 'RIR_2_3' | 'NEAR_LIMIT' | 'FAILURE' | 'UNKNOWN';

/** 운동 유형 — 기존 RuleType과 1:1 매핑. */
export type ExerciseKind = 'BARBELL_COMPOUND' | 'MACHINE_OR_CABLE' | 'ISOLATION' | 'BODYWEIGHT';

/** 사용자 큰 목표 — 목표 반복 범위 해석에 영향. */
export type UserGoalType = 'hypertrophy' | 'strength' | 'fatloss' | 'endurance';

export type SetRecord = {
  weightKg: number;   // 맨몸이면 0
  reps: number;
  setType?: 'NORMAL' | 'WARMUP' | string;
};

/** 비교 가능한 한 세션의 종목 기록. */
export type ExerciseRecord = {
  recordId: string;
  date: string;        // YYYY-MM-DD
  orderIndex?: number; // 세션 내 종목 수행 순서(1부터). 비교 신뢰도용
  restSecAvg?: number; // 평균 휴식(초). 비교 신뢰도용
  sets: SetRecord[];
};

export type ProgressionInput = {
  kind: ExerciseKind;
  role: ExerciseRole;
  userGoal?: UserGoalType;
  /** 직전 비교 가능 기록(없으면 NEED_BASELINE). */
  previousComparableRecord?: ExerciseRecord | null;
  /** 최근 기록들(최신순, 정체·연속실패 판단용). */
  recentRecords?: ExerciseRecord[];
  /** 직전 운동 직후 입력된 노력도. */
  lastEffort?: EffortLevel;
};

export type ExerciseProgressionGoal = {
  role: ExerciseRole;
  kind: ExerciseKind;
  stage: ProgressionStage;
  method: ProgressionMethod;
  targetRepMin?: number;
  targetRepMax?: number;
  targetSets?: number;
  targetTotalReps?: number;
  targetWeight?: number;       // 작업 무게(kg). 맨몸이면 0
  nextWeightIncrement?: number;
  shortTermTarget?: string;
  longTermTarget?: string;
  comparisonConfidence: ComparisonConfidence;
};

export type ProgressionResultKind =
  | 'BASELINE_CREATED'
  | 'IMPROVED'
  | 'MAINTAINED'
  | 'MISSED'
  | 'READY_TO_INCREASE'
  | 'INCREASED_LOAD'
  | 'COMPARISON_DEFERRED'
  | 'STALL_POSSIBLE'
  | 'RESET_RECOMMENDED';

export type ProgressionResult = {
  result: ProgressionResultKind;
  previousStage: ProgressionStage;
  nextStage: ProgressionStage;
  comparisonConfidence: ComparisonConfidence;
  reason: string;       // 내부 디버그/AI 입력용 (계산 근거)
  userMessage: string;  // 사용자 노출 문구
  nextTargetText: string;
};

/** 홈/바텀시트용 가이드 텍스트 묶음. */
export type StageGuideText = {
  stageLabel: string;
  currentTargetText: string;
  nextConditionText: string;
  cautionText?: string;
};
