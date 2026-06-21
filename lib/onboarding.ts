// 온보딩(AI 인테이크) 순수 로직 — 선택 토글·스텝 판정·답변→프로필 매핑.
// UI(intake.tsx)는 여기 함수로 상태 변환만 한다. 저장처는 백엔드 AiProfile.
import type { AiProfileInput } from '../db/api/ai';

export type OnboardingAnswers = {
  goal?: string;
  weightGoal?: string;
  experience?: string;
  trainingMonths?: number;
  frequency?: number;
  sessionMinutes?: number;
  muscles?: string[];
  constraintChips?: string[];
  constraintText?: string;
  note?: string;
};

/** 복수 선택 토글(불변) — 있으면 빼고 없으면 더한다. */
export const toggleMulti = (selected: string[], value: string): string[] =>
  selected.includes(value) ? selected.filter(x => x !== value) : [...selected, value];

/** 마지막 스텝인지. */
export const isLastStep = (index: number, total: number): boolean => index >= total - 1;

/** 답변 → 백엔드 프로필 입력. constraints는 칩+직접입력 합쳐 정리, 빈 메모는 null. */
export function answersToProfile(a: OnboardingAnswers): AiProfileInput {
  const constraints = [
    ...(a.constraintChips ?? []),
    ...((a.constraintText ?? '').split(',').map(s => s.trim()).filter(Boolean)),
  ];
  return {
    goalPhysique: a.goal ?? '',
    weightGoal: a.weightGoal ?? null,
    priorityMuscles: a.muscles ?? [],
    weeklyFrequencyTarget: a.frequency ?? null,
    constraints,
    experienceLevel: a.experience ?? null,
    trainingMonths: a.trainingMonths ?? null,
    splitStyle: null,
    sessionMinutes: a.sessionMinutes ?? null,
    freeNote: (a.note ?? '').trim() || null,
  };
}
