const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** YYYY-MM-DD 문자열을 로컬 기준 Date로 파싱 (UTC 오프셋 오류 방지). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** 한국어 요일 한 글자 (일~토). */
export function weekdayKo(date: Date): string {
  return WEEKDAYS_KO[date.getDay()];
}

/** "2026년 5월 30일 (금)" */
export function formatDateWithDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayKo(d)})`;
}

/** "5월 30일 (금)" — 짧은 표기 */
export function formatShortWithDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayKo(d)})`;
}

/** "5월 30일 금요일" — 요일 전체 표기 */
export function formatShortWithWeekday(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekdayKo(d)}요일`;
}
