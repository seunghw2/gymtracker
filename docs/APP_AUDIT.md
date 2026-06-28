# GymTracker 앱 코드 감사 (APP_AUDIT)

> 작성: Code Audit Agent. 실제 파일을 읽고 근거(파일:심볼)를 단 현황 분석. 코드 미수정.
> 대상: 프론트 `/Users/shstl/Claude Code/gymtracker`, 백엔드 `/Users/shstl/Claude Code/gymtracker-backend`.

---

## 1. 화면 구조 (탭/스택/모달)

- 루트 스택: `app/_layout.tsx:RootLayout`
  - `Stack`(헤더 없음). 자식: `(auth)`, `(tabs)`, `workout`(modal), `exercise-add`(modal), `onboarding`(gesture 잠금), `templates`, `template-edit`(modal).
  - 인증 게이트: `useAuthStore.status`로 `guest→/(auth)/login`, `authenticated→/(tabs)` 리다이렉트. 부팅 시 `bootstrap()`, 알림/오디오 설정, 로그인되면 리마인더 재예약·푸시 등록.
  - `NotificationBridge`(인앱 폴링), `RestTimerEngine`(UI 없는 휴식 엔진)은 전역 마운트.
- 탭: `app/(tabs)/_layout.tsx:TabLayout` — `Tabs`(커스텀 `CustomTabBar`). 6탭: **홈(index) · 기록(calendar) · 종목(exercises) · 리포트(reports) · Chat · 설정(settings)**.
  - 운동 진행 중이고 운동 탭이 아니면 전역 `ActiveWorkoutBanner` 도킹. `RestTimerEngine` 한 번 더 마운트.
- 운동 중 화면은 탭이 아니라 **모달 스택**(`app/workout.tsx`). 종목 상세는 스택 라우트 `app/exercise/[name].tsx`.
- 그 외 스택 라우트(탭 외): `account`, `body-parts`, `custom-exercises`, `goals`, `trainer`, `workout-reminder`, `exercise-rest`, `ai/*`, `chat/*`.

근거: `app/_layout.tsx:66-74`, `app/(tabs)/_layout.tsx:22-42`.

## 2. 홈 화면 (index.tsx)

`app/(tabs)/index.tsx:Dashboard` — 점진적 과부하 대시보드.

표시 항목:
- 온보딩 게이트: `goalSetting.onboarded`가 false면 `/onboarding`으로 강제 이동(`index.tsx:47-53`).
- 요일 인사 + 규칙 기반 코멘트(`summary.comment`).
- **이번 주 목표 카드**: 출석 도트바(`att.done/target`), 개선 도트바(`imp.done/total`, 데이터 없으면 "다음 운동부터 추적 시작").
- **목표 부위 주간 세트** 진행바(`summary.bodyPartVolumes`, 목표 충족 시 초록).
- **오늘 운동하면** 카드(`summary.todayPlan`).
- **핵심/보조/기록만** 종목 카드 그룹(`GoalCard`). 카드에 단계 배지(`stageLabel`), 지난 기록, "오늘 {todayTarget}", 주의/다음조건. 탭하면 `ExerciseGoalSheet`.
- Chat FAB.

데이터 출처: `useOverloadStore`(goalSetting·exerciseGoals) + `getWeeklySummary()`(`db/api/overload.ts`).
정렬은 백엔드가 단계순으로 내려줌(`OverloadService.stageOrder`).

근거: `index.tsx:34-188`, `GoalCard index.tsx:190-224`.

## 3. 기록 화면 (calendar.tsx)

`app/(tabs)/calendar.tsx:HistoryScreen` — "기록" 탭(달력+히스토리).

- **타임라인/월별** 세그먼트 토글(`viewMode`).
- 타임라인: 세션 역순 + 이번주/지난주/N월 버킷 헤더 + 레일(점·선) + 2일 이상 휴식 갭 표시. 행 탭 → `SessionPreviewSheet`. 종목 태그(`MUSCLE_KO`), 세트/시간/종목 수.
- 월별: 달력 그리드(운동일 강조·오늘·선택), 월 통계(횟수·총시간), 선택일 `SessionCard` 목록.
- 연속일 배지(`calcStreak`, 백엔드 streak 규칙과 동일: 오늘 안 했으면 어제부터).
- 디스크 캐시(SWR)로 재진입 팝인 제거(`readCache/writeCache 'cal:overview'`), 첫 로드 스켈레톤.

데이터: `getWorkoutDates/getAllWorkoutDates/getMonthStats/getSessionHistory(90)`(`db/queries.ts`→stats).
**점진적 과부하 정보는 이 화면에 없음**(순수 로깅/달력).

근거: `calendar.tsx:67-257`.

## 4. 운동 중 세트 입력 (workout.tsx)

`app/workout.tsx:WorkoutScreen` — 약 2700줄, 단일 거대 컴포넌트. 운동 진행/과거 세션 편집/종목 선택/템플릿 시작을 한 파일에서 처리.

세트 입력:
- 세트 완료: `handleCompleteSet`(`workout.tsx:866`). 빈 세트 방지(시간기반은 초, 그 외 횟수 필요, 무게 0=맨몸 허용). 서버 `addWorkoutSet` 저장 실패 시 완료 처리 안 함(desync 방지). Epley로 1RM 계산, 역대 최고 초과 시 PR 표시 + 햅틱.
- 완료 해제: `handleUncompleteSet`(DB 세트 삭제 후 미완료). 세트 타입 순환(`handleCycleSetType`), 롱프레스 타입 지정(NORMAL/WARMUP/DROP/FAILURE).
- 숫자패드(`NumPad`): `beginEdit/commitEdit/handleNumKey/handleNumStep/handleNumNext`. 패드 열리면 전역 휴식바가 위로 비킴(`useUiStore.setNumPadOpen`).
- 무게 ± 조정(`handleAdjustWeight`), 워밍업 자동 생성(`handleAddWarmup/applyWarmup`, %·반복 → 2.5kg 라운딩).
- RM 기준(`confirmRmBasis`), 세션 태그/메모/제목 인라인 편집.

휴식 타이머: 세트 완료 시 `startRestTimer(restSec, {nextLabel})`. 워밍업/본세트 휴식 종목별 분리(`getExerciseWarmupRest/getExerciseRest`). 다이얼 시트로 시간 조정.

**RIR 팝업**(`workout.tsx:249-251, 917-925, 2227-2243`): 추적 종목의 **마지막 작업 세트** 완료 후 "마지막 세트 어땠나요?" 바텀시트(여유 많음~실패, `RIR_OPTIONS`). 선택 결과는 `rirSession[exerciseName]`에 저장.
- ⚠ **치명 격차**: `rirSession`은 **쓰기만 하고 어디서도 읽지 않음**(`grep` 결과 251번 선언/2238번 set 외 사용처 없음). 서버 전송·세트 저장·엔진 입력 어디에도 안 들어감. RIR 데이터는 수집 즉시 폐기된다.

운동 종료: `handleFinishWorkout→proceedFinish`(`workout.tsx:493-529`). `completeSession`(duration) → 다음 브리핑 dirty 플래그 → 요약(볼륨·세트·종목·PR) 계산 → 추적 종목 있으면 `getSessionEval(sessionId)`로 개선/유지/보류 평가를 받아 요약 시트에 표시.

## 5. 종목 상세 / 바텀시트

- **종목 상세** `app/exercise/[name].tsx:ExerciseReport`(약 880줄):
  - 큰 1RM 헤더 + 기간 델타·정체 칩(`DeltaChip`).
  - 지표 탭: 1RM/최대무게/볼륨/빈도/렙기록. 선 차트(`LineChart`, SVG, PR·정체 음영·스크럽), 빈도 히트맵(`HeatmapChart`, GitHub식 일/주/월), 렙기록 표(`RepTable`, 1~12RM Epley).
  - 진단 카드(`Diagnosis`: 정체/신기록/성장 + 볼륨·빈도·무게 방향 칩), 핵심 지표 2×2(`KeyStats`).
  - AI 코치: 구조화 리포트(`getExerciseReport`)의 목표대비현재/원인/다음액션 + 코드 템플릿 폴백(`buildCoach`) + 편집 가능 체크리스트 메모(`buildChecklist`, 저장 시 종목 노트로) + "대화로 풀기" chat 연결.
- **종목 목표 바텀시트** `components/ExerciseGoalSheet.tsx`:
  - 역할 배지/부위/룰타입, 현재 단계(`stageLabel`), 비교기준(직전/최고/전체 PR + 비교 신뢰도 칩 + 근거), **오늘 목표 강조 박스**(successCondition/caution), 단기·장기 목표, 다음 단계(`nextStep`), 역할 수정(core/support/log_only).
  - 직전 기록 탭 → 그 날 세션 `SessionPreviewSheet` 미리보기.

근거: `[name].tsx:38-292`, `ExerciseGoalSheet.tsx:30-178`.

## 6. 리포트 화면 (reports.tsx)

`app/(tabs)/reports.tsx`는 `components/report/ReportScreen`을 `showBack={false}`로 렌더하는 얇은 래퍼.
- 실제 구현: `components/report/ReportScreen.tsx`(약 460줄) + `ReportTabs.tsx`(약 1100줄, 거대) + `charts.tsx`.
- 성격: backend `com.gymtracker.ai`의 **주간 AI 브리핑**(계산은 코드/`ReportAggregationService`, 해석만 LLM — backend CLAUDE.md). 정직 모드(데이터 0 → `INSUFFICIENT_DATA`, 3주 미만 → confidence low).
- **점진적 과부하 엔진(overload)과는 별개 시스템**. 리포트는 stats 기반 분석이지 단계 머신 결과를 쓰지 않는다.

근거: `reports.tsx:1-6`, backend CLAUDE.md(ai 패키지).

## 7. 운동 데이터 모델 (세션)

백엔드 `WorkoutSession`(`workout/WorkoutSession.java`):
- `id, userId, date(LocalDate), title, durationSec, note, tags(쉼표 "가슴,어깨"), completedAt`.
- `completedAt`이 null이면 진행 중 → **통계 집계 제외**(`markCompleted()`).

프론트 타입(`db/api/types.ts`): `WorkoutSession`(id/date/duration_sec/note — title·tags 누락), `SessionSummary`(집계용: exercise_count/set_count/exercise_names/title/note/tags), `SessionSetRow`, `SessionPatch`.
- ⚠ 프론트 `WorkoutSession` 타입이 엔티티보다 좁다(title/tags 없음). 실무상 `SessionSummary`를 주로 사용.

## 8. 세트 데이터 모델

백엔드 `WorkoutSet`(`workout/WorkoutSet.java`):
- `id, sessionId, exerciseId, setOrder, weightKg, reps, estimated1rm, setType, supersetGroup, durationSec`.
- `setType`: `NORMAL|WARMUP|DROP|FAILURE`(`SetType.java`, 정규화 `from()`).
- 1RM: `epley(weight,reps)=weight*(1+reps/30)` 반올림(`WorkoutSet.epley`).
- ⚠ **RIR/RPE·노력도 컬럼 없음**. 시간기반은 `durationSec`, 무게기반은 weight/reps.

프론트(`types.ts:WorkoutSet, SessionSetRow`): 백엔드와 정합. `set_type`, `superset_group`, `duration_sec` 포함, 노력도 필드 없음.

## 9. 종목 데이터 모델 (Exercise)

백엔드 `Exercise`(`exercise/Exercise.java`):
- `id, name, muscleGroup, equipmentType, brand, note, trackingType(REPS|TIME), system, custom, userId`.
- 시스템/커스텀 팩토리(`system()/custom()`). `TrackingType` enum.
- ⚠ 점진적 과부하용 분류(barbell_main 등)는 **엔티티에 없고** `equipmentType+muscleGroup`에서 `OverloadService.classifyRuleType`로 파생.

프론트(`types.ts:Exercise`): muscle_group/equipment_type/brand/tracking_type/is_system/is_custom.

## 10. 목표 데이터 모델 (GoalSetting / ExerciseGoal)

`GoalSetting`(`overload/GoalSetting.java`) — 유저당 1개(온보딩 결과):
- `goalType(hypertrophy|strength|fatloss|endurance)`, `weeklyFrequency`, `incUpper/incLower`(상/하체 증량 kg), `progressionTrigger(single|two_sessions|rpe)`, `onboardedAt`.

`ExerciseGoal`(`overload/ExerciseGoal.java`) — 유저×종목 유니크:
- `ruleType`, `role(core|support|log_only)`, `overridden`, `targetReps/targetSets`, `repRangeMin/Max`, `increment`, `status(in_progress|ready_to_increase|hold)`, `currentValue`, `nextTarget`.
- ⚠ `status`·`currentValue`·`nextTarget`은 **캐시 필드**인데, 실제 화면 단계는 `toDto`에서 엔진이 매번 재계산해 덮어쓴다(아래 11·14 참조). 즉 저장된 `status`/`nextTarget`은 거의 죽은 값(단계 정렬·improvements의 `hold` 필터 정도만 사용).

프론트 타입: `db/api/overload.ts:GoalSettingDto/ExerciseGoalDto`(엔진 가이드 필드까지 모두 포함).

## 11. 점진적 과부하 로직 흐름 (최근 변경 반영)

**진짜 엔진 = `ProgressionEngine.java`**(상태 머신·Rule 기반), 오케스트레이션 = `OverloadService.java`.

`OverloadService.toDto`(`OverloadService.java:588-618`)가 각 종목 카드를 만들 때:
1. `kindOf(ruleType)` → `BARBELL_COMPOUND|MACHINE_OR_CABLE|ISOLATION|BODYWEIGHT`.
2. `loadRecords(userId, exId)` — 최근 세션을 `DayRecord`(최신순)로 로드.
3. `ProgressionEngine.compute(kind, goalType, records, trigger)` → `Guide`(stage/stageLabel/todayTarget/successCondition/nextStep/3종기록/비교근거).

`compute`(`ProgressionEngine.java:188-299`) 단계:
- 기록 0 → `NEED_BASELINE`(분류별 기준 만들기 문구).
- 1개 → `BASELINE_CHECK`(정체 판단 불가).
- 3+·비증가·세트수 유사 → `STALL_REVIEW`(`stalling()` + `setCountSimilar()`).
- 그 외 분류별: BODYWEIGHT=`BUILD_REPS`(총 반복수 +1), ISOLATION/BARBELL/MACHINE=`readyToIncrease`면 `READY_TO_INCREASE`, 아니면 `BUILD_REPS`.

**최근 3대 변경 — 실제 반영 확인:**
1. **증량 트리거 연결됨**: `compute(...trigger)` → `readyToIncrease(records, repMax, sets, trigger)`(`ProgressionEngine.java:101-110`). `single`/`rpe`=최근 1세션 상단 달성, `two_sessions`(기본)=최근 2세션 연속. `trigger`는 `GoalSetting.progressionTrigger`에서 `getExerciseGoals/toDto`로 전달(`OverloadService.java:65,135,598`).
   - ⚠ 단, `rpe`는 노력도 미저장이라 `single`로 폴백(`ProgressionEngine.java:107` 주석·코드).
2. **rep range 단일 소스화**: `ProgressionEngine.repRange(kind, goalType)`가 유일 소스(비대 바벨 6~12/머신 8~12/고립 8~15/맨몸 5~12, 근력 바벨 3~6). `OverloadService.range/defaultRep*`가 여기에 위임(`OverloadService.java:522-534`).
3. **마이크로로딩**: `OverloadService.effectiveIncrement`(`:536-542`) — `machine_cable`·`isolation`은 증량폭 절반(최소 0.5kg). `computeNextTarget`에서 적용. 무게0 고립은 "유지".

운동 후 평가: `OverloadService.evaluateSession`(`:156-197`) → 종목별 직전 vs 오늘 → `ProgressionEngine.evaluate`(`:326-352`)로 `IMPROVED|MAINTAINED|MISSED|BASELINE_CREATED|COMPARISON_DEFERRED`. 세트수 2+ 차이면 비교 보류. `log_only` 역할 제외.

## 12. 구현된 계산 함수 목록

엔진(`ProgressionEngine.java`):
- `kindOf`, `repRange`, `compute`(단계 가이드), `evaluate`(세션 평가), `formatRecord`(기록 요약), `readyToIncrease`, `stalling`, `progressionReps`, `topWeight/topWeightReps`, `bestRecordOf`, `allTimePrOf`, `comparisonReason`, `setCountSimilar`, `buildBump`.

서비스(`OverloadService.java`):
- `weeklySummary`(출석·개선·부위갭·부위세트·todayPlan·comment), `weeklyProgression`, `weeklyPattern`, `weeklyCheckIn`, `suggestedTemplates`, `classifyRuleType/classifyRole`, `computeNextTarget`, `effectiveIncrement`, `targetSetsForPart`.

stats(백엔드 `ExerciseStatsService.java`):
- `dailyE1rm`, PR/정체 산출(`plateauWeeks=WEEKS.between(prDate, today)`, `trend = new|flat|up`), 주간 볼륨/빈도, 4주 델타, 스파크라인.
- 1RM = **Epley**(`WorkoutSet.epley`, 프론트 `stats.ts:convertRm/getRepMaxes`도 동일식).

프론트 계산(보조/표시):
- `stats.ts`: get1RMHistory/getRepMaxes/getVolumeStats/getRecords/getMuscleFrequency 등.
- `[name].tsx`: `buildCoach/buildChecklist/seriesDir/DeltaChip/fillWeeks/fillMonths`(차트 가공).
- `lib/overload.ts`: `classifyRuleType`(온보딩), `buildNextWeekGoals`(chat 탭) — **실제 사용 2곳뿐**.

## 13. 부족한 기능 (점진적 과부하 앱 관점)

1. **노력도(RIR/RPE) 미저장 → 엔진 반쪽**: 세트 모델에 노력도 컬럼 없음, 프론트 RIR 팝업 결과 폐기(4·8 참조). 결과적으로 `progressionTrigger=rpe`가 `single` 폴백, "마지막 세트 여유" 성공조건이 **데이터 없는 안내 문구**일 뿐 판정에 안 들어감.
2. **운동 중 "오늘 목표" 비표시**: 단계/오늘목표는 홈·바텀시트·종목상세에만 있고, 정작 운동 중 화면(`workout.tsx`)의 종목 카드에는 todayTarget·targetTotalReps가 노출되지 않는 것으로 보임(헬스장 3초 룰 핵심). `ExerciseGoalDto.targetTotalReps` 주석은 "운동 중 남은 반복수 계산용"이지만 workout 화면에서의 활용 흔적이 약함.
3. **자동 증량 적용(progression apply) 없음**: `READY_TO_INCREASE`여도 다음 목표 무게를 세트에 **자동 채워주지 않음**. `nextTarget`/`currentValue`는 캐시일 뿐 운동 시작 시 프리필에 안 쓰임(템플릿 시작은 마지막 세션 복사).
4. **디로드/리셋 단계 미구현**: 타입엔 `DELOAD_OR_RESET/CONSOLIDATE/HOLD_OR_REPEAT/INCREASE_LOAD`가 있으나 `compute`가 실제로 반환하는 stage는 `NEED_BASELINE/BASELINE_CHECK/STALL_REVIEW/BUILD_REPS/READY_TO_INCREASE` 5개뿐. 정체 후 자동 감량 처방·단계 전이 없음.
5. **세트 순서/조건 정규화 부재**: 비교 신뢰도를 "세트 수 차이"로만 근사(`comparisonReason`). 운동 순서·휴식·피로 컨텍스트 없어 비교 보류가 잦을 수 있음.
6. **주간 목표/단기·장기 진척 추적 약함**: bodyweight `shortTerm/longTerm`은 문구 생성만, 실제 진행률 추적 루프 없음.

## 14. 중복 / 애매한 기능

1. **죽은 `lib/progression/*`**: `progressionEngine.ts/progressionRules.ts/progressionMessages.ts/progressionTypes.ts`는 **테스트만 import**(앱 코드 import 0건, grep 확인). 진짜 엔진은 Java. → 혼동 유발 죽은 코드.
2. **프론트-백 분류 로직 이중화**: `lib/overload.ts:classifyRuleType` ↔ `OverloadService.classifyRuleType` 동일 규칙 두 벌. 프론트판은 온보딩 1곳에서만 쓰임.
3. **ExerciseGoal 캐시 필드 vs 엔진 재계산 중복**: `status/currentValue/nextTarget`을 저장하지만 카드 단계는 `toDto`에서 매번 엔진이 재계산해 덮어씀(11·10 참조). 저장값과 표시값이 다를 수 있는 이중 소스.
4. **두 평가 시스템 병존**: 점진과부하 엔진(stage/evaluate) vs AI 리포트(stats 기반 정체감지). 둘 다 "정체"를 따로 판정(`ProgressionEngine.stalling` vs `ExerciseStatsService` plateauWeeks) → 기준 불일치 가능.
5. **`summarizeSets`(OverloadService.java:626) 미사용 의심**: `formatRecord`(엔진)가 사실상 기록 요약 담당. 거의 호출되지 않는 잔존 메서드로 보임.
6. **운동 화면 거대 단일 파일**: `workout.tsx` 단일 컴포넌트에 진행/과거편집/종목선택/템플릿이 뒤섞여 유지보수 위험.

## 15. 실제 점진적 과부하 앱으로 가기 위한 수정점 (우선순위)

1. **[P0] RIR을 저장하고 엔진에 연결** — 세트 모델에 `rir/effort` 추가, `rirSession`을 세트 저장 시 동봉, `evaluate`/`readyToIncrease`의 "여유" 판정을 실데이터로. 이게 빠지면 `rpe` 트리거와 성공조건 문구가 전부 공허함.
2. **[P0] 운동 중 화면에 오늘 목표/증량 신호 노출** — 종목 카드에 `todayTarget`·`READY_TO_INCREASE` 배지·다음 무게 제안. "헬스장 3초 룰" 충족.
3. **[P1] 증량 자동 프리필** — `READY_TO_INCREASE` 종목은 세트 추가/운동 시작 시 다음 무게를 자동 채우고 사용자가 한 번에 수락. (임의 +2.5kg 하드코딩 대신 `effectiveIncrement` 사용.)
4. **[P1] 단계 머신 완성** — `compute`가 `DELOAD_OR_RESET`/`CONSOLIDATE`를 실제 반환하도록(정체 N주 → 감량 처방 → 회복 단계). PROGRESSIVE_OVERLOAD_RESEARCH.md 7장 결론 반영.
5. **[P2] 죽은 코드 정리** — `lib/progression/*` 제거 또는 명확히 "테스트 픽스처"로 격리, 프론트 `classifyRuleType` 단일화.
6. **[P2] 단일 소스 정리** — `ExerciseGoal` 캐시 필드를 엔진 결과의 영속화로 재정의하거나 제거해 표시값/저장값 이중화 해소.
7. **[P2] 정체 기준 통일** — overload 엔진의 `stalling`과 stats의 `plateauWeeks`를 한 정의로 수렴(리포트와 단계 카드 메시지 충돌 방지).
8. **[P3] `[name].tsx`·`workout.tsx`·`ReportTabs.tsx` 분리** — 거대 파일 컴포넌트 추출(버그·회귀 위험 감소). 기능 변화 없는 리팩터.

---

## 현 구현 vs 목표 격차 요약

| 영역 | 현 구현 | 목표(점진과부하 코칭) | 격차 |
|---|---|---|---|
| 단계 머신 | compute가 5개 stage 반환 | 9개 stage 전이(디로드 포함) | 디로드/리셋/통합 미구현 |
| 증량 트리거 | single/two_sessions 동작, 기본 2세션 | RPE 기반 포함 | RPE는 single 폴백(데이터 없음) |
| 노력도(RIR) | 팝업 수집 후 **폐기** | 저장→판정 반영 | 모델·전송·엔진 연결 전부 없음 |
| 오늘 목표 노출 | 홈/시트/상세 O | 운동 중 화면 O | 운동 중 todayTarget 비표시 |
| 증량 적용 | 문구만 안내 | 다음 무게 자동 프리필 | apply 루프 없음 |
| rep range | 단일 소스(repRange) O | 분류별 권장 | 충족 |
| 마이크로로딩 | 머신/고립 절반 증량 O | 큰 점프 방지 | 충족 |
| 정체 판정 | 엔진 stalling + stats plateau 이중 | 단일 기준 | 두 시스템 기준 상이 |
| 평가 신뢰도 | 세트수 차이 근사 | 순서·피로 컨텍스트 | 컨텍스트 부재로 보류 잦음 |
| 죽은 코드 | lib/progression 테스트 전용 | 단일 엔진(Java) | TS 엔진 잔존 |
| 캐시 vs 재계산 | status/nextTarget 저장+재계산 | 단일 소스 | 표시·저장 이중화 |

---

### 핵심 발견 8줄
1. 진짜 점진과부하 엔진은 백엔드 `ProgressionEngine.java`(상태머신)이고, `OverloadService.toDto`가 종목마다 매번 재계산해 홈·시트·상세 카드를 만든다.
2. 최근 3대 변경(증량 트리거 연결·repRange 단일소스·머신/고립 마이크로로딩)은 코드에 **실제 반영 확인**됨.
3. 그러나 RIR 팝업 결과(`rirSession`)는 **쓰기만 하고 한 번도 읽지 않아** 수집 즉시 폐기 — `rpe` 트리거와 "여유" 성공조건이 공허함(P0).
4. 세트 모델에 노력도 컬럼 자체가 없어(WorkoutSet) RIR을 저장할 곳도 없다 — 모델·전송·엔진 3단 연결이 모두 빠짐.
5. 단계 머신 타입은 9개지만 `compute`가 실제 반환하는 stage는 5개뿐 — 디로드/리셋/통합 단계와 자동 감량 처방이 미구현.
6. "오늘 목표/증량 신호"가 정작 운동 중 화면(`workout.tsx`)엔 약하게 노출되고, 증량 준비여도 다음 무게 자동 프리필이 없다(헬스장 3초 룰 미흡).
7. `lib/progression/*`는 테스트만 import하는 죽은 TS 엔진, 프론트/백 `classifyRuleType` 이중화, ExerciseGoal 캐시 필드 vs 엔진 재계산 이중 소스 등 정리 대상이 있다.
8. overload 엔진의 정체 판정과 stats/AI리포트의 plateauWeeks가 기준이 달라, 같은 종목에 상충하는 "정체" 메시지가 날 수 있다.
