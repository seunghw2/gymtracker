// 온보딩(AI 인테이크) 순수 로직 — 선택 토글·스텝 판정·답변→프로필 매핑.
// UI(intake.tsx)는 여기 함수로 상태 변환만 한다. 저장처는 백엔드 AiProfile.
import type { AiProfileInput } from '../db/api/ai';

export type OnboardingAnswers = {
  goal?: string;
  successGoal?: string;
  weightGoal?: string;
  trainingMonths?: number;
  frequency?: number;
  sessionMinutes?: number;
  muscles?: string[];
  constraintChips?: string[];
  constraintText?: string;
  note?: string;
};

export type OnbOpt = { v: string; label: string };

/** 복수 선택 토글(불변) — 있으면 빼고 없으면 더한다. */
export const toggleMulti = (selected: string[], value: string): string[] =>
  selected.includes(value) ? selected.filter(x => x !== value) : [...selected, value];

/** 마지막 스텝인지. */
export const isLastStep = (index: number, total: number): boolean => index >= total - 1;

/** 성공 기준(북극성) — 목표(goal)별 분기 질문·선택지. 비신체 목표는 공통 버전. */
export function successOptions(goal?: string): { prompt: string; options: OnbOpt[] } {
  switch (goal) {
    case 'lean_muscle':
      return { prompt: '6개월 뒤 가장 이루고 싶은 것은?', options: [
        { v: 'shoulders_width', label: '어깨 넓어지기' }, { v: 'back_width', label: '등 넓어지기' },
        { v: 'upper_body', label: '상체 키우기' }, { v: 'lower_body', label: '하체 키우기' }, { v: 'balance', label: '전신 균형' } ] };
    case 'strength':
      return { prompt: '가장 강해지고 싶은 운동은?', options: [
        { v: 'bench', label: '벤치프레스 증가' }, { v: 'squat', label: '스쿼트 증가' }, { v: 'deadlift', label: '데드리프트 증가' },
        { v: 'pullup', label: '턱걸이 증가' }, { v: 'overall_load', label: '전반적인 중량 증가' } ] };
    case 'fat_loss':
      return { prompt: '감량에서 가장 중요한 것은?', options: [
        { v: 'weight', label: '체중 감량' }, { v: 'bodyfat', label: '체지방 감소' },
        { v: 'belly', label: '복부 지방 감소' }, { v: 'preserve_muscle', label: '근손실 최소화' } ] };
    default: // habit · health · unsure 등 비신체 목표 공통
      return { prompt: '6개월 뒤 가장 이루고 싶은 것은?', options: [
        { v: 'consistency', label: '꾸준함 유지' }, { v: 'condition', label: '컨디션 개선' },
        { v: 'shape', label: '체형 관리' }, { v: 'health', label: '전반적 건강' }, { v: 'unsure', label: '아직 잘 모르겠어요' } ] };
  }
}

/** 누적 운동 개월 → 실력 단계(경력 질문을 하나로 합쳤으므로 코드에서 도출). */
export const deriveExperience = (months?: number): string | null =>
  months == null ? null : months < 6 ? 'beginner' : months < 36 ? 'intermediate' : 'advanced';

/** 답변 → 백엔드 프로필 입력. constraints는 칩+직접입력 합쳐 정리, 빈 메모는 null. */
export function answersToProfile(a: OnboardingAnswers): AiProfileInput {
  const constraints = [
    ...(a.constraintChips ?? []),
    ...((a.constraintText ?? '').split(',').map(s => s.trim()).filter(Boolean)),
  ];
  return {
    goalPhysique: a.goal ?? '',
    weightGoal: a.weightGoal ?? null,
    successGoal: a.successGoal ?? null,
    priorityMuscles: a.muscles ?? [],
    weeklyFrequencyTarget: a.frequency ?? null,
    constraints,
    experienceLevel: deriveExperience(a.trainingMonths),
    trainingMonths: a.trainingMonths ?? null,
    splitStyle: null,
    sessionMinutes: a.sessionMinutes ?? null,
    freeNote: (a.note ?? '').trim() || null,
  };
}
