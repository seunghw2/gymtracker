// 무게는 항상 kg로 저장(canonical). 표시/입력만 단위 변환.
const LB_PER_KG = 2.20462;

export function unitLabel(unitKg: boolean): string {
  return unitKg ? 'kg' : 'lb';
}

/** 저장값(kg) → 표시 단위 숫자. lb는 0.5 단위, kg는 0.25 단위 반올림. */
export function toDisplay(kg: number, unitKg: boolean): number {
  if (unitKg) return Math.round(kg * 4) / 4;
  return Math.round(kg * LB_PER_KG * 2) / 2;
}

/** 표시 단위 입력값 → 저장값(kg). */
export function fromInput(val: number, unitKg: boolean): number {
  if (unitKg) return val;
  return Math.round((val / LB_PER_KG) * 100) / 100;
}

/** "60 kg" / "132.5 lb" 문자열 */
export function formatWeight(kg: number, unitKg: boolean): string {
  return `${toDisplay(kg, unitKg)}${unitLabel(unitKg)}`;
}
