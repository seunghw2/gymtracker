# 화면 상세: 브리핑 홈 (Briefing Home)

> 파일: `app/(tabs)/index.tsx` · 컴포넌트: `BriefingHome`
> 최종 업데이트: 2026-06-18 (UI/UX 1단계 개편 반영 — 히어로 통합 + 하단 고정 CTA + 토큰)
> 이 문서는 한 화면의 **인터랙션·데이터 흐름·상태·엣지케이스**를 깊게 기술한다. 전 화면 요약은 [../SCREENS.md](../SCREENS.md), 개편 제안은 [../UX_REVIEW.md](../UX_REVIEW.md).

---

## 1. 역할 / 진입

- **역할**: 앱의 첫 탭(홈). "이번 주 내가 잘하고 있나"를 한눈에 — AI 주간 브리핑 요약 + 핵심 지표 + 빠른 운동 시작 + 오늘 체중 입력.
- **진입 경로**: 앱 실행 후 기본 탭 / 하단 탭바 `브리핑` / 다른 탭에서 돌아올 때(`useFocusEffect`로 매 포커스 재로드).
- **나가는 경로**: 설정(⚙️), 리포트(`/ai/reports`), 인테이크(`/ai/intake`), 운동(`/workout`).

---

## 2. 데이터 소스 & 로드 흐름

`load()` (useCallback) — `useFocusEffect`로 **화면에 포커스될 때마다** 실행. 두 묶음으로 나뉜다.

### 2-1. 기본 지표 (병렬 `Promise.all`)
| 호출 | 용도 | 실패 시 |
|---|---|---|
| `getWeeklyWorkoutCount(start,end)` | 이번 주 운동 횟수 | catch → 폴백(무시) |
| `getTodayBodyLog(today)` | 오늘 체중/체지방/허리 | |
| `getLatestBodyLog()` | 최근값(모달 기본값) | |
| `getAllWorkoutDates()` | 스트릭 계산용 전체 운동일 | |

- 주 범위는 `getWeekRange()`(월요일 시작). 스트릭은 `computeStreak()`로 **클라에서** 계산(오늘 없으면 어제부터 역산).
- 오늘 체중 기록이 **없으면**: 설정 `weight_prompt_enabled`와 AsyncStorage `weight_prompt_dismissed`를 확인해 오늘 아직 안 닫았으면 **체중 모달 자동 오픈**. 모달 기본값은 최근값으로 프리필.
- 완료 후 `setLoaded(true)` — 이전까지는 전체 스피너.

### 2-2. 주간 리포트 (비동기, 별도 try)
- `getReportV2('week')` → `{ status, report, percent, step }`을 상태에 저장.
- 실패 시 `reportStatus='FAILED'`.

---

## 3. 상태 머신 (`reportStatus`)

리포트 상태에 따라 히어로 영역 렌더가 분기한다.

| status | 화면 | 사용자 액션 |
|---|---|---|
| `GENERATING` | 히어로 자리에 오비탈 로딩(`BriefingLoading`, 실시간 `percent`/`step`) | 대기 — 2초 폴링이 자동 완료 감지 |
| `PROFILE_REQUIRED` | 헤드라인="AI 분석을 켜볼까요?" + "시작하기" 히어로 | 탭 → `/ai/intake` |
| `SUCCESS`(report 존재) | 헤드라인=`report.headline` + 처방(`report.prescription`) | 탭 → `/ai/reports` |
| `FAILED`/그 외 | 폴백 헤드라인(운동수 기반) | 탭 → `/ai/reports` |

### 폴링 (`useEffect`)
- `reportStatus === 'GENERATING'`이면 **2초 후** `getReportV2('week')` 재호출 → 상태 갱신. 의존성 `[reportStatus, reportPct]`라 진행률이 바뀔 때마다 재예약 → 완료(SUCCESS) 시 자동 종료.

### 헤드라인 폴백 규칙
```
report.headline
  ?? (PROFILE_REQUIRED ? 'AI 분석을 켜볼까요?'
      : weekCount>0     ? '이번 주, 잘 쌓고 있어요.'
      :                   '오늘부터 다시 시작.')
```

---

## 4. 레이아웃 (위 → 아래)

스크롤 영역(`ScrollView`, `flex:1`, 당겨서 새로고침) + **하단 고정 CTA 바**(스크롤 밖).

1. **헤더 행**: `브리핑` 타이틀 + ⚙️ 설정 아이콘.
2. **날짜칩**: "N월 N일 요일 · 브리핑".
3. **히어로**(개편: 헤드라인+처방 통합 카드, 좌측 레드 보더):
   - 헤드라인(큰 글씨).
   - 구분선 + 처방(`처방 · 이번 주` 캡션 + `rx.action` + `rx.todo`) — 있을 때만.
   - (PROFILE_REQUIRED면 처방 대신 "1분 설정 →" 안내.)
4. **부위별 볼륨 카드**(`report.detail.balance` 있을 때): 부위 · 하드세트 수 · 주 빈도. 부족(`low`)은 주황.
5. **핵심 지표 3**: `이번 주`(운동수) · `스트릭`(연속일) · `목표까지 kg`(또는 "체중 입력").
6. **(하단 고정)** `운동 시작` CTA — **운동 중이면 숨김**(전역 배너가 복귀 제공).

---

## 5. 요소별 인터랙션

| 요소 | 제스처 | 동작 / 핸들러 |
|---|---|---|
| ⚙️ 설정 | 탭 | `router.push('/(tabs)/settings')` |
| 히어로 카드(일반) | 탭 | `router.push('/ai/reports')` |
| 히어로 카드(PROFILE_REQUIRED) | 탭 | `router.push('/ai/intake')` |
| 부위별 볼륨 카드 | 탭 | `router.push('/ai/reports')` |
| 지표 `이번 주` / `스트릭` | — | 표시 전용(비인터랙티브) |
| 지표 `목표까지 kg` / `체중 입력` | 탭 | `openWeightModal()` — 체중 모달 |
| `운동 시작` CTA | 탭 | `router.push('/workout')`(모달) |
| 스크롤 영역 | 당김 | `onRefresh()` → `load()` 재실행 |

---

## 6. 체중 입력 모달

- **열림 트리거**: (a) 지표의 체중 카드 탭(`openWeightModal`), (b) 로드 시 오늘 미기록 + 오늘 안 닫음이면 자동.
- **구성**: 큰 readout(`dialValue` kg) · `RulerPicker`(룰러로 체중 선택) · 체지방(%) 입력 · 허리(cm) 입력 · `저장`.
- **저장**(`handleSaveWeight`): `upsertBodyLog(today, dialValue, fat?, waist?)` → 로컬 상태(`todayWeight` 등) 갱신 → `weight_prompt_dismissed=today` 기록 → 닫기. 체지방·허리는 유효(양수)할 때만 반영, 아니면 기존값 유지.
- **닫기**(`closeWeightModal` / 오버레이 탭): 저장 없이 닫되 **오늘은 다시 자동으로 안 띄움**(`weight_prompt_dismissed=today`).
- **입력 동작**: `keyboardType='decimal-pad'`, 체지방 maxLength 4, 허리 maxLength 5. `KeyboardAvoidingView`로 키보드 회피.

---

## 7. 라이프사이클 / 사이드이펙트

- `useFocusEffect(load)` — 포커스마다 재로드(운동·체중 변경이 즉시 반영).
- 폴링 `useEffect` — GENERATING 동안만 타이머, 언마운트/상태변경 시 `clearTimeout`.
- `loaded` 게이트 — 첫 로드 전 전체 스피너로 깜빡임 방지.
- `workoutActive`(`useWorkoutStore`) — 하단 CTA 표시 여부.

---

## 8. 엣지케이스 / 주의

- **네트워크 실패**: 기본 지표 묶음은 catch로 무시(폴백 UI), 리포트는 `FAILED`로 헤드라인만 폴백 — 화면이 죽지 않음.
- **체중 모달 중복 방지**: 하루 1회만 자동 — `weight_prompt_dismissed` 키. 설정에서 `weight_prompt_enabled='0'`이면 자동 안 띄움.
- **GENERATING 레이아웃**: 로딩 영역은 고정 높이(300)로 점프 최소화.
- **운동 중 겹침**: 진행 중 세션이 있으면 전역 `ActiveWorkoutBanner`가 탭바 위에 뜨므로, 하단 CTA는 숨겨 겹침을 피한다.
- **스트릭 이원화(알려진 빚)**: 여기선 클라(`computeStreak`)로 계산하지만 백엔드 `/stats/streak`도 존재 → 값 불일치 가능. 통일 권장(REQUIREMENTS N-R, UX_REVIEW 기록 화면 항목 참고).

---

## 9. 개편 시 보존 계약 (깨면 안 되는 동작)

UI/UX를 바꾸더라도 아래는 유지:
1. 포커스마다 `load()` 재실행(최신 반영).
2. 리포트 **비동기 상태 머신**(GENERATING→폴링→SUCCESS) + 진행률 표시.
3. `PROFILE_REQUIRED` 분기(인테이크 유도)와 `SUCCESS`/폴백 분기.
4. 체중 모달: 자동 1회 노출 규칙 + 저장/닫기 시 dismiss 기록 + 최근값 프리필.
5. 당겨서 새로고침.
6. 운동 시작 진입(`/workout`).

---

## 10. 스타일 토큰 매핑 (개편 후)

하드코딩 색 제거, `SEM` 토큰 사용:
- 배경 `SEM.bg` · 히어로/부위카드 `SEM.surface2` · 지표/모달 `SEM.surface3` · 입력칸 `SEM.line2`.
- 텍스트 `SEM.ink1`(1차)/`ink2`(보조)/`ink3`(캡션)/`ink4`(placeholder).
- 강조(처방 캡션·CTA·저장 버튼) `SEM.brand` / 위 텍스트 `SEM.onBrand`.
- 부족 표시(부위 미달) `SEM.bad`(주황).
