# GymTracker MVP 체크리스트 (MVP_TASKS)

> 작성: Product Lead Agent. 근거 = FINAL_PRODUCT_SPEC.md + IMPLEMENTATION_PLAN.md. 코드 미수정(이 문서는 Phase 8 구현이 그대로 따라가는 작업 목록).
> 철칙: 입력 최소화 · 헬스장 3초 이해 · 기준 부족 시 분석 금지 · 비현실적 목표/하락 단정 금지. 신규 stage·LLM·노력도 파이프라인 없음.
> 작성일: 2026-06-29

---

## Phase 1 — 데이터 모델 정리

- [ ] `overload/GoalSetting.java` progressionTrigger 기본값 two_sessions 확정(온보딩에서 입력받지 않음)
- [ ] `overload/ExerciseGoal.java` 캐시 필드(status/currentValue/nextTarget)는 표시 단일 소스 아님 — "엔진 toDto 재계산이 단일 소스" 규약 주석으로 고정
- [ ] **`workout/WorkoutSet.java`에 `effort` 컬럼 추가**(enum EASY/MODERATE/HARD/FAILURE, nullable) — 노력도 4버튼 저장(§0-1)
- [ ] 프론트 `db/api/types.ts` WorkoutSet에 effort 필드 + WorkoutSession title/tags 정합 보강
- [ ] 모든 표시 화면이 `toDto` 재계산 값만 신뢰하는지 확인(저장 캐시 직접 읽는 곳 없음)

## Phase 2 — Progression Engine 증분

- [ ] `ProgressionEngine.buildBump` 머신 [2,3] → **+1~2로 통일**(작은 bump 철칙 일관)
- [ ] BODYWEIGHT 단기목표 `max(8, ceil(직전총×1.5))` → 명확한 규칙값으로 단순화(임의 ×1.5 제거)
- [ ] STALL_REVIEW 첫 진입 처방 = "같은 순서·조건에서 한 번 더 기록" 우선, 즉시 감량 카피 금지
- [ ] `OverloadService` improvements(개선 도트바) 분모에서 baseline/deferred 종목 제외
- [ ] 무게0·증량 비대상 종목 기본 role을 support/log_only로 보수적 자동 배정
- [ ] 신규 stage(INCREASE_LOAD/CONSOLIDATE/HOLD_OR_REPEAT/DELOAD_OR_RESET) **만들지 않음** 확정
- [ ] **`readyToIncrease` rpe 트리거를 마지막 세트 effort에 연결(§0-1)** — 여유많음/2~3개=증량 준비, 거의한계/실패=보류. compute가 마지막 세트 effort 받도록 시그니처 확장
- [ ] `loadRecords`/`toDayRecord`가 effort 함께 로드해 compute에 전달(effort null이면 단일 세션 폴백 유지)
- [ ] 종목 상세 구조화 AI 코치 리포트·체크리스트·buildNextWeekGoals만 비활성(Chat 탭 자체는 유지)

## Phase 3 — 테스트 작성 (8개 케이스 필수)

- [ ] **TC1**: PullUp 직전 총 3회 → 오늘 목표 "총 4회"(BUILD_REPS, 직전+bump 1). 다량 증가 금지
- [ ] **TC2**: 위 PullUp의 장기 목표 15회를 **오늘 목표로 산출 금지** — todayTarget="총 4회", longTermTarget="총 15회"(별도 필드)
- [ ] **TC3**: Squat 80kg 4/4/4/4(총16, 비대 6~12) → 오늘 목표 "80kg 총 17~18회"(무게 고정, +1~2)
- [ ] **TC4**: 그 Squat에 "80kg 8회×3(=24)" 급점프 금지 — 4회→8회×3 요구 안 함
- [ ] **TC5**: Cable Crunch 40kg 3회 1세트(기록 1개) → **BASELINE_CHECK**(STALL_REVIEW 금지), "8~12회×3세트로 기준 안정화"
- [ ] **TC6**: Lateral Raise 기록 0개 → **NEED_BASELINE**, "8~15회×3세트로 첫 기준 만들기" + 자세 우선 caution(분석 안 함)
- [ ] **TC7**: prev 4세트 vs cur 2세트(차≥2) → evaluate=**COMPARISON_DEFERRED**, "세트·조건 달라 직접 비교하지 않았어요"
- [ ] **TC8**: 위 COMPARISON_DEFERRED 메시지에 "하락/감소/나빠짐" 단어 **없음**, resultLabel="비교 보류"(부정 평가 아님)
- [ ] **TC9**: rpe 트리거 + 마지막 세트 effort=EASY(여유 많음) + 상단 달성 → READY_TO_INCREASE. effort=HARD(거의 한계)면 상단 달성해도 BUILD_REPS 유지(증량 보류)
- [ ] **TC10**: effort=null(미입력) → 기존대로 단일 세션 폴백(회귀 안전)
- [ ] 죽은 `lib/progression/*` 프론트 테스트는 격리/skip(앱 import 0건)
- [ ] 백엔드 `./mvnw test`(h2/MockMvc) 전부 green 확인(첫 실행 온라인 필요)

## Phase 4 — 종목 바텀시트

- [ ] `ExerciseGoalSheet.tsx` 오늘 목표 박스를 헤더 바로 아래(2번째)로 이동
- [ ] 현재 단계 → 비교 기준 → 다음 단계 → 단기·장기 → 역할 순으로 "근거" 하향
- [ ] 비교 신뢰도 low면 "비교 보류" 표기, 개선/하락 단정 금지
- [ ] 기존 Section/todayBox/비교행/신뢰도 칩/역할 편집 재활용(신규 데이터 없음)

## Phase 5 — 홈 카드

- [ ] `index.tsx` 9섹션 → **3블록 압축**
  - [ ] 블록1: 오늘 행동 필요 종목(READY+STALL을 "확인 필요"로 중립 묶음, 증량 단독 강조 금지)
  - [ ] 블록2: 이번 주 1줄(출석 + 부족 부위) — 부위 볼륨을 증량 종목과 동급 이상
  - [ ] 블록3: 종목 리스트(핵심 펼침 / 보조·기록만 기본 접힘)
- [ ] 주간 코멘트(summary.comment) 제거
- [ ] 개선 도트바 제거 또는 "이번 주" 카드로 병합
- [ ] 오늘운동하면 카드·추천 루틴(suggestedTemplates) 제거
- [ ] NEED_BASELINE 카드는 "오늘 기준 만들기" 문구로 치환

## Phase 6 — 운동 중 목표 표시

- [ ] `workout.tsx` goal banner를 **1줄로 축소**: "오늘 {목표} / 남은 {N}회"(targetTotalReps 차감)
- [ ] 단계 라벨·비교 보류·성공조건은 배너에서 빼고 카드 탭(시트)로 미룸
- [ ] READY_TO_INCREASE면 배너 초록 + 다음 무게(nextTarget) **자동 프리필**
- [ ] 자동 프리필은 항상 **1탭 덮어쓰기 보장**(강제 아님)
- [ ] 프리필 우선순위: 증량 준비=nextTarget, 아니면 직전값(충돌 방지)
- [ ] log_only 종목 배너 숨김, comparability low면 성공/실패 단정 금지
- [ ] **핵심 종목 마지막 작업 세트 완료 시 노력도 4버튼 시트(§0-1)**: 여유 많음 / 2~3개 남음 / 거의 한계 / 실패
- [ ] 버튼 탭 → effort를 세트 저장 API로 전송(WorkoutSet.effort). 한 번 탭/스킵 가능, 흐름 차단 금지
- [ ] 기존 RIR 팝업이 있으면 이 4버튼으로 대체(받고 버리던 것을 저장·엔진까지 연결)

## Phase 7 — 운동 종료 요약

- [ ] proceedFinish 요약 시트를 평가 칩 + 다음 목표 1줄로 정형화
- [ ] 칩: 기준완성(BASELINE_CREATED) / 개선(IMPROVED) / 유지(MAINTAINED) / 재도전(MISSED) / 비교 보류(COMPARISON_DEFERRED)
- [ ] 비교 보류는 "하락"으로 표기하지 않음
- [ ] 종료 후 컨디션 입력 **미추가**(추가 입력 0)

## Phase 8 — 리포트 결정론 개선 (§0-2, Chat 유지)

- [ ] `components/report/ReportScreen`에서 주간 LLM 브리핑 텍스트 제거, 결정론 블록으로 교체
- [ ] 결정론 블록: 이번 주 출석 / 목표 부위 주간 세트 / 핵심 종목 변화(엔진 stage·evaluate) / 정체 점검 종목(엔진 stalling) / 다음 주 액션 1~3개
- [ ] "다음 주 액션 1~3개"를 화면에서 가장 크게(숫자 나열 아닌 다음 행동 연결)
- [ ] 정체는 엔진 stalling 한 곳에서만 선언 — 리포트 plateauWeeks 정체 문구 폐기(홈·시트·리포트 동일)
- [ ] **Chat 탭은 유지(§0-3)** — 숨기지 않음. 단 Chat이 처방 숫자를 새로 만들지 않고 엔진 값 인용
- [ ] 종목 상세 구조화 AI 코치 리포트·체크리스트만 비활성(후속 복구 가능)

## 온보딩 정리(횡단)

- [ ] 온보딩 입력 **3개 고정**: 목적 · 주간 횟수 · 상/하체 증량폭
- [ ] 증량 트리거 선택 UI 제거(two_sessions 고정, 고급 설정으로만)
- [ ] 부위·경력·분류·rep range는 자동 도출(묻지 않음)

## 완료 게이트(전체)

- [ ] 정상 세션에서 사용자 입력 = 세트(무게·횟수·완료)뿐(노력도·컨디션 0)
- [ ] 홈 첫 화면 3초 안에 "오늘 행동 필요 종목" 노출
- [ ] 오늘 목표는 항상 직전 기준 + 작은 bump(+1~2), 장기값 미산출
- [ ] 기준 0~1개 종목은 분석 대신 기준 생성/확인으로 안내
- [ ] 비교 보류는 어떤 화면에서도 하락으로 표기되지 않음
- [ ] 정체는 엔진 단일 정의, 첫 정체는 재기록 우선(즉시 감량 없음)
