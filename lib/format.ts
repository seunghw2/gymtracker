/** 1RM 추정(Epley). 소수 첫째자리 반올림. */
export function epley(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** 초 → "N시간 M분" / "M분". 세션 소요시간 표시 공통. */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}
