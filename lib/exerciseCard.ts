import type { ExerciseSummary } from '../db/api/stats';

/**
 * 종목 카드 그리드용 순수 파생 로직.
 * 백엔드 exercise-summary의 작업세트(최근/역대 top set, 직전 top 무게)를 받아
 * 카드 표시값(델타·PR·포맷)을 만든다. 1RM 추정은 쓰지 않는다(머신·고렙 부정확).
 */

export type TopSet = { weight: number; reps: number };

export type CardData = {
  recentTopSet: TopSet | null;
  bestSet: TopSet | null;
  deltaKg: number | null;       // 최근 top 무게 − 직전 세션 top 무게 (없으면 null)
  isPR: boolean;                // 최근 top == 역대 top
  lastPerformedAt: string | null;
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** summary → 카드 파생값. */
export function deriveCard(s: ExerciseSummary): CardData {
  const recent: TopSet | null =
    s.recentTopWeightKg != null && s.recentTopReps != null
      ? { weight: s.recentTopWeightKg, reps: s.recentTopReps } : null;
  const best: TopSet | null =
    s.bestTopWeightKg != null && s.bestTopReps != null
      ? { weight: s.bestTopWeightKg, reps: s.bestTopReps } : null;

  const deltaKg =
    recent && s.prevTopWeightKg != null ? round1(recent.weight - s.prevTopWeightKg) : null;

  // 최근 top 세트가 역대 top 세트와 같으면 PR(이번에 자기 최고 갱신/동률)
  const isPR = !!recent && !!best && recent.weight === best.weight && recent.reps === best.reps;

  return { recentTopSet: recent, bestSet: best, deltaKg, isPR, lastPerformedAt: s.lastDate };
}

/** 정수면 정수로, 아니면 소수 1자리. "82.5" / "80". */
function fmtWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : String(round1(w));
}

/** 작업세트 표기: 무게 있으면 "80 × 5", 맨몸(무게0)은 "5회". null이면 "–". */
export function formatTopSet(t: TopSet | null): string {
  if (!t) return '–';
  return t.weight > 0 ? `${fmtWeight(t.weight)} × ${t.reps}` : `${t.reps}회`;
}

/** 카드 메인 숫자: 무게 있으면 "80", 맨몸은 "5"(횟수). 단위는 별도 표기. */
export function mainValue(t: TopSet | null): { value: string; unit: string } {
  if (!t) return { value: '–', unit: '' };
  return t.weight > 0 ? { value: fmtWeight(t.weight), unit: 'kg' } : { value: String(t.reps), unit: '회' };
}

/** 델타 표기(증가만 ↑로). "↑2.5kg" / 없거나 0이하면 null. */
export function formatDelta(deltaKg: number | null): string | null {
  if (deltaKg == null || deltaKg <= 0) return null;
  return `↑${fmtWeight(deltaKg)}kg`;
}

/** 수행일 → "오늘"/"어제"/"N일 전"/"N주 전". today는 테스트용 주입(기본 오늘). */
export function formatDay(iso: string | null, today: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((t0.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;
  if (diff < 28) return `${Math.floor(diff / 7)}주 전`;
  return `${Math.floor(diff / 30)}개월 전`;
}
