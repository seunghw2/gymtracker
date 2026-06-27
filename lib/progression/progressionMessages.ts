// 점진적 과부하 — 단계/결과/비교신뢰도 한국어 문구 (순수)
import type {
  ProgressionStage, ComparisonConfidence, ExerciseRole, ProgressionResultKind,
} from './progressionTypes';

export const STAGE_LABEL: Record<ProgressionStage, string> = {
  NEED_BASELINE: '기준 만들기',
  BUILD_REPS: '반복수 쌓는 중',
  READY_TO_INCREASE: '증량 준비',
  INCREASE_LOAD: '증량 적용',
  CONSOLIDATE: '새 무게 적응 중',
  HOLD_OR_REPEAT: '같은 목표 재도전',
  STALL_REVIEW: '정체 점검',
  DELOAD_OR_RESET: '리셋 권장',
};

export const ROLE_LABEL: Record<ExerciseRole, string> = {
  CORE: '핵심',
  ASSISTANCE: '보조',
  LOG_ONLY: '기록만',
};

export const ROLE_DESC: Record<ExerciseRole, string> = {
  CORE: '직접 타깃 — 다음 목표를 적극 추적',
  ASSISTANCE: '부위 볼륨·밸런스에 기여',
  LOG_ONLY: '기록만 남김 (목표 추적 안 함)',
};

export const CONFIDENCE_LABEL: Record<ComparisonConfidence, string> = {
  HIGH: '비교 가능',
  MEDIUM: '참고 비교',
  LOW: '조건 다름',
  DEFERRED: '비교 보류',
};

/** 비교 보류/조건 다름일 때의 안내 문구(하락으로 표현하지 않음). */
export function comparisonNote(c: ComparisonConfidence): string | undefined {
  switch (c) {
    case 'DEFERRED': return '오늘은 비교 가능한 기준 기록이 없어 직접 비교하지 않았어요';
    case 'LOW': return '오늘은 수행 순서·조건이 달라 직접 비교하지 않았어요';
    case 'MEDIUM': return '조건이 약간 달라 참고용으로만 비교했어요';
    default: return undefined;
  }
}

export const RESULT_LABEL: Record<ProgressionResultKind, string> = {
  BASELINE_CREATED: '기준 생성',
  IMPROVED: '개선',
  MAINTAINED: '유지',
  MISSED: '미달',
  READY_TO_INCREASE: '증량 준비',
  INCREASED_LOAD: '증량 적용',
  COMPARISON_DEFERRED: '비교 보류',
  STALL_POSSIBLE: '정체 점검',
  RESET_RECOMMENDED: '리셋 권장',
};
