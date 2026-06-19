import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 디스크(AsyncStorage) JSON 캐시 — 콜드 스타트(앱 재실행)에서도 마지막 데이터를 즉시 복원한다.
 * stale-while-revalidate의 'stale' 저장소: 화면 진입 시 이걸로 바로 그리고(로딩 없음),
 * 네트워크 응답이 오면 갱신 + 다시 write 한다. (인메모리 `lib/cache`는 같은 세션 내 웜 재진입 담당)
 *
 * 모든 키에 `cache:` 접두사를 붙여, 로그아웃 시 clearDiskCache()로 일괄 삭제(계정 전환 누수 차단).
 */
const PREFIX = 'cache:';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore — 캐시 실패는 무시 */
  }
}

// cache: 접두사를 안 쓰는 기존 영속 캐시(리포트 탭) — 로그아웃 시 함께 비운다.
const LEGACY_KEYS = ['ai_report_cache_v1', 'ai_first_workout_iso'];

/** 로그아웃/탈퇴 시 호출 — cache: 접두사 + 레거시 캐시 키 전부 삭제(계정 전환 누수 차단). */
export async function clearDiskCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(k => k.startsWith(PREFIX)).concat(LEGACY_KEYS);
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    /* ignore */
  }
}
