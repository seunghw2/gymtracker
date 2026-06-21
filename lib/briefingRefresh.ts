// 브리핑(주간 리포트) 재생성 시점 — 라이브 재계산이 아니라 정해진 트리거에서만.
// 트리거: ① 날짜 변경(자정 경과, '매일 0시' lazily) ② 세션 완료(dirty). 그 외엔 캐시 유지.
export const BRIEFING_DAY_KEY = 'briefing_fresh_day';   // 마지막 성공 생성 날짜(YYYY-MM-DD)
export const BRIEFING_DIRTY_KEY = 'briefing_dirty';     // 세션 완료 시 '1'

/** 브리핑을 강제 재생성할지. 날짜가 바뀌었거나(자정 경과) dirty면 true. */
export function shouldRefreshBriefing(lastDay: string | null, today: string, dirty: boolean): boolean {
  return dirty || lastDay !== today;
}
