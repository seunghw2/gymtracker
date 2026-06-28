# GymTracker 구현 계획 (IMPLEMENTATION_PLAN)

> 작성: Product Lead Agent. 근거 = FINAL_PRODUCT_SPEC.md + 6개 입력 문서. 코드 미수정.
> 원칙: **현 백엔드 엔진(`ProgressionEngine`/`OverloadService`)이 이미 가진 것 위에 증분으로 설계한다. 처음부터 다시 만들지 않는다.**
> 프론트 = `/Users/shstl/Claude Code/gymtracker`, 백엔드 = `/Users/shstl/Claude Code/gymtracker-backend`.
> 작성일: 2026-06-29

---

## 단계 0. 전제 — 이미 구현돼 그대로 쓰는 것 (다시 만들지 말 것)

- 5 stage 엔진(NEED_BASELINE/BASELINE_CHECK/BUILD_REPS/READY_TO_INCREASE/STALL_REVIEW), `compute`/`evaluate`.
- `repRange`(목적·분류 단일 소스), `effectiveIncrement`(머신/고립 절반), two_sessions 트리거 연결, `evaluateSession`의 log_only 제외, `stageOrder`, 3종 기록 DTO 분리.
- 세트 입력 핵심 흐름(`workout.tsx` handleCompleteSet, 직전값 프리필, NumPad, 워밍업 자동, 휴식 타이머), 운동 중 goal banner 일부(workout.tsx:1706-1739).
- 종목 바텀시트(`ExerciseGoalSheet.tsx`)의 Section/todayBox/비교행/신뢰도 칩/역할 편집.

→ MVP는 위를 **재배치·정리·표시 보강** 중심으로 진행한다. 신규 stage·LLM·노력도 파이프라인은 만들지 않는다.

---

## 단계 1. 데이터 모델 정리

목적: MVP가 의존할 단일 소스를 확정 + 노력도 저장 컬럼 추가(§0-1).

- **건드릴 파일**
  - 백엔드: `workout/WorkoutSet.java`(**노력도 컬럼 신규 추가** — `effort` enum EASY/MODERATE/HARD/FAILURE nullable. 4버튼에 매핑), `overload/ExerciseGoal.java`(캐시 필드 status/currentValue/nextTarget의 위상 명문화 — 표시는 엔진 재계산이 단일 소스), `overload/GoalSetting.java`(progressionTrigger 기본 two_sessions 확정, 온보딩에서 안 받음).
  - 프론트: `db/api/types.ts`(WorkoutSet에 effort 필드 추가, WorkoutSession title/tags 정합 보강), `db/api/overload.ts`(DTO 필드 확인).
- **의존성**: 없음(ddl-auto update가 effort 컬럼 자동 추가, 기존 행 null 폴백).
- **리스크**: 낮음. 캐시 필드는 **제거하지 말고 "엔진 재계산이 단일 소스" 규약만 주석으로 고정**(Critic 12-5). effort는 nullable이라 기존 데이터 안전.
- **완료 기준**: WorkoutSet.effort 컬럼 존재(nullable). 모든 표시 화면이 `toDto` 재계산 값만 신뢰. GoalSetting 트리거 기본값 two_sessions.

## 단계 2. Progression Engine 구현(증분)

목적: 5 stage 유지 + Critic 반영 보정만. 신규 stage 없음.

- **건드릴 파일**
  - 백엔드: `overload/ProgressionEngine.java` — `buildBump` 머신 [2,3] → **+1~2로 통일**(§9·Critic 3-1), BODYWEIGHT 단기목표 ×1.5 산식 → **명확한 규칙값으로 단순화**(Critic 3-2), STALL_REVIEW 첫 진입 처방을 "같은 조건 한 번 더 기록 우선"으로 고정(Critic 4-2, 즉시 감량 카피 금지). **`readyToIncrease`의 rpe 트리거를 마지막 세트 effort에 실제 연결(§0-1)** — 여유 많음/2~3개 남음=증량 준비, 거의 한계/실패=보류. compute에 마지막 세트 effort 전달.
  - 백엔드: `overload/OverloadService.java` — 개선 도트바(improvements) 분모에서 baseline/deferred 종목 제외(Critic 5-1), 무게0·증량 비대상 종목 자동 role 보수화(Critic 6-2), **loadRecords/toDayRecord가 effort를 함께 로드해 compute에 전달**.
- **의존성**: 단계 1(effort 컬럼).
- **리스크**: 중간. 기존 테스트가 머신 bump=[2,3]·×1.5를 가정하면 깨짐 → 단계 3에서 기대값 갱신. evaluate/COMPARISON_DEFERRED 가드는 건드리지 않음. effort 미입력(null)은 기존대로 단일 세션 폴백(안전).
- **완료 기준**: 머신/바벨/고립 모두 오늘 목표 = 직전 총 +1~2. STALL_REVIEW 카피에 감량 단정 없음. improvements 모수에 기준부족 종목 미포함. rpe 트리거 선택 시 effort가 증량 판정을 실제로 가른다.

## 단계 3. 테스트 작성

목적: 철칙(직전 기준·작은 bump·기준부족 분석금지·보류는 하락 아님)을 회귀 방지로 못박는다.

- **건드릴 파일**
  - 백엔드 테스트(h2/MockMvc): `ProgressionEngine`·`OverloadService` 단위 테스트(MVP_TASKS의 8개 케이스).
  - 프론트: 죽은 `lib/progression/*` 테스트는 MVP 판정과 무관하므로 격리 또는 skip(앱 import 0).
- **의존성**: 단계 2(기대값이 통일 bump 반영).
- **리스크**: 낮음. 백엔드 첫 실행은 온라인 필요(메모리: test_infra).
- **완료 기준**: 8개 케이스(MVP_TASKS) 전부 green. 특히 보류 메시지에 "하락/감소/나빠짐" 단어 없음, 오늘 목표에 장기값(15회) 미산출.

## 단계 4. 종목 바텀시트

목적: 3초 룰 — 오늘 목표를 가장 먼저 보게.

- **건드릴 파일**: 프론트 `components/ExerciseGoalSheet.tsx` — 오늘 목표 박스를 헤더 바로 아래(2번째)로 이동, 단계/비교를 그 아래 "근거"로. 기존 컴포넌트 재활용(신규 데이터 없음).
- **의존성**: 단계 1~2(DTO 값).
- **리스크**: 낮음(순서 재배치).
- **완료 기준**: 시트 열면 오늘 목표 + 성공조건이 첫 화면. 비교 신뢰도 low면 "비교 보류" 표기.

## 단계 5. 홈 카드

목적: 9섹션 → 3블록 압축, 부위 볼륨 동급 이상.

- **건드릴 파일**: 프론트 `app/(tabs)/index.tsx` — (1)행동 필요 종목(READY+STALL 중립 묶음) (2)이번 주 1줄(출석+부족 부위) (3)종목 리스트(보조/기록만 접힘). 주간 코멘트·개선도트바·오늘운동하면 카드·추천 루틴 제거/병합. GoalCard 구조 재활용.
- **의존성**: 단계 4(카드 탭 → 시트).
- **리스크**: 중간(레이아웃 대수술). `suggestedTemplates` 호출 제거 시 시작 플로우 확인.
- **완료 기준**: 홈 첫 화면이 스크롤 없이 "행동 필요 종목 + 이번 주 1줄". 증량 단독 영웅화 없음.

## 단계 6. 운동 중 목표 표시

목적: 헬스장 3초 룰의 최대 미수확 — 1줄 배너 + 증량 자동 프리필.

- **건드릴 파일**: 프론트 `app/workout.tsx` — goal banner를 "오늘 {목표} / 남은 {N}회" 1줄로 축소(targetTotalReps 차감 표시, 엔진 신규 계산 불필요), READY면 초록 + 다음 무게(nextTarget) 자동 프리필 + 1탭 덮어쓰기 보장. log_only 숨김, low면 단정 금지. **핵심 종목 마지막 작업 세트 완료 시 노력도 4버튼 시트(§0-1)** — 버튼 탭 → effort를 세트 저장 API로 전송. 한 번 탭/스킵 가능, 흐름 차단 금지.
- **의존성**: 단계 1~2(targetTotalReps/nextTarget DTO, effort 컬럼·전송).
- **리스크**: 중간. `workout.tsx` 거대 단일 파일 — 프리필이 직전값 프리필과 충돌하지 않게 우선순위 규칙(증량준비면 nextTarget, 아니면 직전값). 기존 RIR 팝업이 있으면 이 4버튼으로 대체(받고 버리던 것을 전송·저장까지 연결).
- **완료 기준**: 운동 중 종목 카드에 1줄 목표 + 남은 회수. 증량 준비 종목은 무게 자동 채움+수정 가능. 마지막 세트 노력도가 실제로 저장돼 다음 세션 증량 판정에 쓰임.

## 단계 7. 운동 종료 요약

목적: 추가 입력 0, 평가 칩 + 다음 목표 1줄.

- **건드릴 파일**: 프론트 `app/workout.tsx`(proceedFinish 요약 시트) — getSessionEval 결과를 칩(기준완성/개선/유지/재도전/비교보류) + 종목별 다음 목표 1줄로 정형화. 컨디션 입력 미추가.
- **의존성**: 단계 2(evaluate), 단계 6.
- **리스크**: 낮음.
- **완료 기준**: 종료 시 입력 0. 비교 보류가 하락으로 표기되지 않음.

## 단계 8. 리포트 (결정론 개선, §0-2)

목적: 리포트 탭 유지 + LLM 브리핑을 엔진/통계 값으로 교체 + 정체 정의 단일화. Chat 탭은 유지(§0-3).

- **건드릴 파일**: 프론트 `components/report/ReportScreen` 등 — 주간 LLM 브리핑 텍스트를 빼고 결정론 블록으로 채움: 이번 주 출석 · 목표 부위 주간 세트 · 핵심 종목 변화(엔진 stage/evaluate) · 정체 점검 종목(엔진 stalling) · 다음 주 액션 1~3개. 백엔드: `ai`/overload 집계에서 리포트가 쓸 결정론 데이터 엔드포인트 정리. 정체는 엔진 stalling 단일 소스만 사용, plateauWeeks 기반 정체 문구 폐기(Critic 4-1).
- **의존성**: 단계 2(엔진 evaluate/stalling), 단계 5(홈과 동일 데이터·문구).
- **리스크**: 중간. 리포트가 기존 LLM 응답 구조를 가정하면 결정론 데이터로 어댑트 필요. Chat 탭은 **숨기지 않음**(유지) — 단 Chat이 처방 숫자를 새로 만들지 않고 엔진 값 인용.
- **완료 기준**: 리포트가 LLM 없이 표시되고, 정체는 엔진 한 곳에서만 선언(홈·시트·리포트 동일). 다음 주 액션 1~3개가 화면에서 가장 큼. Chat 탭 정상 동작.

---

## 의존성 그래프(요약)

```
1 데이터모델 ─→ 2 엔진(증분) ─→ 3 테스트
                     │
                     ├─→ 4 바텀시트 ─→ 5 홈
                     ├─→ 6 운동중 표시 ─→ 7 종료요약
                     └─→ 8 리포트/Chat 숨김(독립)
```

## 공통 리스크

- `workout.tsx` 거대 단일 파일(약 2700줄): 단계 6·7이 같은 파일을 건드림 → 한 세션에서 순차 진행, 분리 리팩터는 MVP 이후.
- 두 계정 git 규율: 세션 시작 git pull, 끝 commit+push, 의도한 파일만 add.
- 백엔드 ddl-auto update: 컬럼 추가는 자동이나 MVP는 신규 컬럼 없음(노력도 미추가).
- Expo v56 API 버전 확인 후 프론트 작성.
