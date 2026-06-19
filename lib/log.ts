/**
 * 삼켜지던 비핵심 오류를 개발 중 가시화한다.
 * 기존에 `.catch(() => {})`로 조용히 무시되던 서버 쓰기 실패를 최소한 콘솔에 남겨,
 * 서버-로컬 desync 같은 버그의 추적을 돕는다. 운영 빌드(__DEV__=false)에선 조용하다.
 * 동작(에러 삼킴)은 그대로 유지하고 가시성만 더한다.
 */
export function logError(context: string, err: unknown): void {
  if (__DEV__) console.warn(`[gt:${context}]`, err);
}
