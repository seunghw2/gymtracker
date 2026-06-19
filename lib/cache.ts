/**
 * 경량 인메모리 캐시 — TTL + in-flight 중복 제거(같은 키 동시 요청은 1회만).
 * react-query 같은 무거운 의존성 없이, 정적/준정적 읽기를 화면 전반에서 재사용한다.
 * 변경(뮤테이션) 시 `invalidate(prefix)`로 무효화하고, 로그아웃 시 `clearAllCache()`로 비운다.
 */
type Entry<T> = { value?: T; ts: number; promise?: Promise<T>; token?: object };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const e = store.get(key) as Entry<T> | undefined;
  if (e && e.value !== undefined && now - e.ts < ttlMs) return e.value;   // 신선한 캐시
  if (e?.promise) return e.promise;                                       // 진행 중이면 공유

  const token = {};   // 이 요청의 식별자 — 무효화/후속 요청으로 교체됐는지 판별
  const p = (async () => {
    try {
      const v = await fetcher();
      if (store.get(key)?.token === token) store.set(key, { value: v, ts: Date.now(), token });
      return v;
    } catch (err) {
      const cur = store.get(key) as Entry<T> | undefined;
      if (cur?.token === token) {
        if (cur.value !== undefined) { store.set(key, { value: cur.value, ts: cur.ts }); return cur.value; }
        store.delete(key);   // 캐시 없던 첫 요청 실패 → 다음에 재시도
      } else if (cur?.value !== undefined) {
        return cur.value;    // 교체됐지만 값이 있으면 그걸 반환(화면 안 깨지게)
      }
      throw err;
    }
  })();
  store.set(key, { value: e?.value, ts: e?.ts ?? 0, promise: p, token });
  return p;
}

/** 키 또는 접두사로 무효화. 예: invalidate('ex:') → ex:로 시작하는 모든 키 삭제. */
export function invalidate(...prefixes: string[]): void {
  for (const k of store.keys()) {
    if (prefixes.some(pre => k === pre || k.startsWith(pre))) store.delete(k);
  }
}

export function clearAllCache(): void {
  store.clear();
}
