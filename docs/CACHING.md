# 캐싱 · 즉시 표시(SWR) 전략

> 화면이 "느리게 뜨는" 게 아니라 **네트워크 왕복(~1초)을 기다리는 동안 빈/폴백 상태가 보였다가 교체**되는 게 체감 문제다.
> 핵심 처방: **마지막 데이터를 즉시 보여주고(stale) → 백그라운드로 갱신(revalidate)**. (Stale-While-Revalidate, SWR)

---

## 개념 — 왜 필요한가

매 진입마다 서버에서 새로 받으면, 받아오기 전까지 화면은 비어 있거나 기본값을 보여준다.
사용자에겐 "이미 본 화면인데 왜 또 로딩?"으로 느껴진다. 데이터는 대부분 직전과 같으므로,
**캐시를 먼저 그리고 다른 점만 조용히 반영**하면 로딩 깜빡임이 사라진다.

## 3계층 (이 앱의 구조)

| 계층 | 파일 | 담당 | 수명 |
|---|---|---|---|
| 1. 인메모리 TTL + in-flight 중복제거 | `lib/cache.ts` (`cached`/`invalidate`) | 같은 세션 **웜 재진입**, 동시 요청 1회화 | 앱 살아있는 동안 |
| 2. 디스크 영속 | `lib/diskCache.ts` (`readCache`/`writeCache`/`clearDiskCache`) | **콜드 스타트**(앱 재실행) 즉시 복원 | 앱 꺼져도 유지 |
| 3. SWR 패턴 | 각 화면 | 캐시 즉시 표시 → `load()`가 백그라운드 갱신 | — |

- **무효화**: 데이터를 바꾸는 뮤테이션에서 `invalidate('ex:')`처럼 명시적으로 비운다(예: 종목 CRUD).
- **로그아웃**: `clearAllCache()`(인메모리) + `clearDiskCache()` + `clearSettingsCache()` — 계정 전환 시 이전 데이터 누수 차단.

## 적용 현황

- **종목 카탈로그**(`getExercises`·`getCustomExercises`): 인메모리 10분 + 종목 변경 시 무효화.
- **요약/Trained**(`getExerciseSummaries`·`getTrainedExercises`): 인메모리 45초.
- **브리핑(홈)**: 마지막 성공 리포트를 디스크(`cache:briefing:week`)에 저장 → 진입 즉시 복원 + 백그라운드 갱신.
- **종목 탭**: 마지막 요약 목록을 디스크(`cache:exercise:summaries`)에 저장 → 콜드 스타트 즉시 표시.
- **리포트 탭**: 이미 인메모리 Map + AsyncStorage 영속 SWR 보유(기간별 16개) — 추가 작업 불필요.

---

## 트러블슈팅 기록 (이번에 겪은 과정)

1. **증상**: 앱 열 때마다 홈 브리핑이 *완성된 듯한* 폴백 화면("이번 주 잘 쌓고 있어요")으로 ~1초 떴다가 실제 브리핑으로 휙 바뀜.
2. **진단**: 홈은 기본 데이터만 로드되면 `loaded=true`로 **먼저 렌더**하는데, 주간 브리핑(`getReportV2`)은 그 *다음에* 네트워크로 받아옴 → 그 사이 `report=null`이라 폴백 헤드라인이 보임.
3. **1차 수정**: `reportFetched` 플래그 도입 — 응답 전엔 폴백 대신 **스켈레톤**을 표시(완성된 듯한 화면이 안 보이게).
4. **재증상**: "이미 본 화면인데도 스켈레톤이 잠깐 뜬다." → 디스크에 저장이 없어 **진입/재실행마다 네트워크 재요청**.
5. **진단**: 인메모리만으론 콜드 스타트(앱 재실행)에서 캐시가 비어 매번 빈 상태.
6. **2차 수정 (SWR)**: 마지막 성공 데이터를 **디스크에 영속** + 마운트 시 즉시 복원(`readCache`) → 네트워크는 백그라운드 갱신. 이제 한 번이라도 본 화면은 로딩 없이 바로 뜸.
7. **확장**: 보일러플레이트를 `lib/diskCache.ts`로 빼서 종목 탭에도 적용. 리포트 탭은 이미 동일 패턴 보유.

---

## 새 화면에 적용하는 레시피

```ts
// 1) 콜드 스타트 즉시 표시 — 마운트 시 디스크 캐시 복원
useEffect(() => {
  readCache<Row[]>('mydata').then(c => { if (c?.length) setRows(prev => prev.length ? prev : c); });
}, []);

// 2) 진입 시 네트워크 갱신 + 다음을 위해 저장
const load = useCallback(async () => {
  const list = await fetchMyData();
  setRows(list);
  writeCache('mydata', list);
}, []);
useFocusEffect(useCallback(() => { load(); }, [load]));
```

## 주의점 (왜 단순 캐시가 위험한가)

- **stale write 경쟁**: 무효화 직후 진행 중이던 옛 요청이 캐시를 덮어쓸 수 있다 → `lib/cache.ts`는 요청 토큰으로 막는다.
- **계정 전환 누수**: 디스크 키는 `cache:` 접두사 + `clearDiskCache()`로 로그아웃 때 일괄 삭제. 새 영속 캐시를 추가하면 이 규칙을 따를 것.
- **비최종 상태 캐시 금지**: `GENERATING` 같은 진행 중 상태는 영속하지 말 것(다음 실행 때 가짜 진행 로더가 뜸). 브리핑/리포트는 **SUCCESS만** 저장한다.
- **TTL 선택**: 자주 바뀌는 통계(볼륨·기간요약·1RM 차트)는 짧게/캐시 안 함, 거의 안 바뀌는 카탈로그는 길게.

## 더 공부할 키워드

stale-while-revalidate, cache invalidation, request de-duplication(in-flight),
optimistic UI, TanStack Query(react-query)/SWR 라이브러리(이 앱은 의존성 없이 경량 구현).
