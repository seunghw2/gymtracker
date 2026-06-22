# GymTracker · AI 입력→출력 파이프라인 (상세)

> 원칙: **모든 수치는 앱(코드)이 계산해 "사실"로 확정**하고, **LLM은 해석·서술만** 한다(재계산·창작 금지).
> 검증기가 LLM이 낸 수치를 실데이터와 대조해 환각을 차단한다. 관련: [AI_SYSTEM.md](AI_SYSTEM.md) · [AI_SCOPE.md](AI_SCOPE.md).

## 0. 공통 파이프라인 (5단계)
```
① 앱 계산        StatsService / ExerciseStatsService / 집계 → 모든 수치·플래그 확정
② 입력 JSON 조립  facts / AiReportInput (사실 + 프로필 + 기간 + 말투)
③ LLM 호출       system 프롬프트 + user(JSON)  →  gpt-5-mini
④ 파싱·검증      JSON 파싱 → (리포트) AiReportValidator 수치 대조 → 실패 시 재시도/폴백
⑤ 조립·렌더      코드 계산 카드 + LLM 서술 합쳐 응답 → 앱 렌더
```
- LLM에 가는 입력은 **이미 계산된 값**뿐. 모델은 "이 사실을 사람 말로 풀어라"만 한다.
- 현재 **모든 AI = gpt-5-mini**(`AI_MODEL`/`model-mini` 둘 다 gpt-5-mini). `max_completion_tokens=8000`(추론 모델이라 reasoning이 토큰을 먹어 비지 않도록).

---

## 1. 기간 리포트 (주간/월간/분기/반기/연간)
화면: 홈 브리핑 + 리포트 탭. 엔드포인트: `GET /api/v1/ai/v2/report?type=&from=&to=&label=&force=`.

### 1-A. 입력 데이터 — `AiReportInput` (앱이 전부 계산)
| 묶음 | 필드 | 의미(앱 계산) |
|---|---|---|
| **period** | from·to·type·label·horizon·inProgress·daysRemaining·weeksOfHistory | 기간 범위/종류/처방 시점/진행 중 여부 |
| **profile** | goalPhysique·weightGoal·**successGoal(북극성)**·priorityMuscles·weeklyFrequencyTarget·constraints·experienceLevel·trainingMonths·sessionMinutes·freeNote | 온보딩 인테이크(목표 렌즈) |
| **stats.consistency** | attendancePct·sessions·planned·longestGapDays·weeklyAvg | 출석·일관성 |
| **stats.periodSummary** | totalSessions·totalVolumeKg·avgSessionMin | 기간 합계 |
| **stats.volumeTrend** | [{week, volumeKg}] | 주별 볼륨 시계열 |
| **stats.muscleFrequency** | [{muscleGroup, weeklySets}] | 부위별 주당 하드세트 |
| **stats.oneRmTrends** | [{exercise, first, latest, trend}] | 종목별 1RM 추세 |
| **stats.records** | [{exercise, bestE1rm, setAt}] | 최고 기록 |
| **stats.stagnation** | [{exercise, weeksFlat, **cause**}] | 정체 종목 + 원인(최근 미수행/중량 하락/최고치 정체) |
| **stats.body** | weightKg·bodyFatPct·weightDelta4w·waist… | 체성분 |
| **notes** | [{date, title, tags, note}] | 세션 메모 |
| **tone** | terry·baptiste·crystal | 담당 트레이너(말투) |

### 1-B. 시스템 프롬프트 (`AiPrompts.SYSTEM`) — 골격
```
너는 GymTracker의 PT 트레이너다. (현재→원인→행동 구조로 따뜻·구체적으로)
[목표 기준 — 항상] profile의 goalPhysique·successGoal·priorityMuscles·weightGoal을 기준으로 해석.
   같은 데이터도 목표에 따라 다르게(근비대=볼륨, 근력=1RM, 감량=빈도). 새 숫자 금지.
[범위] period.type/label/horizon을 먼저 읽어 그 기간만, horizon 시점으로 처방.
[진행 중] inProgress면 "남은 N일" 기준.
[트레이너 말투] terry=존댓말 지적 / baptiste=반말 몰아붙임 / crystal=존댓말 스윗(이모지).
[출력] 아래 JSON만.
```
- user 메시지 = `AiReportInput`의 JSON(snake_case). 모델은 tone 값을 보고 그 트레이너로 말한다.

### 1-C. LLM 출력 계약 (`AiReportOutput`) — 모델이 채우는 것만
```json
{ "headline": "한 줄 헤드라인",
  "prescription": { "action": "horizon 시점 행동 1개(≤50자)", "why": "...", "this_week": "..." },
  "confidence": "high|medium|low", "dataCaveat": null,
  "coaching": { verdict, cause, interpretation, … 20개 챕터(근거 있을 때만) } }
```
> summaryMetrics·strengths·watchouts는 레거시(코드 KPI가 대체) — 제거 예정.

### 1-D. 코드가 더 붙이는 것 → 최종 응답 `AiReportV2`
LLM 서술(headline·prescription·coaching) + **코드 계산 블록**을 합쳐 응답:
- `summary`(점수·지표·한줄), `detail`(timeline·growth·stagnation·milestones·trends·balance…), `cards`(19개 데이터 블록), `consistency`, `bodyComposition`
- **기간별 추가 계산(코드)**:
  - 월간 `monthGrowth`(전월 동일 일수 대비 볼륨 %) · `monthScore`(꾸준함·성장성·밸런스 3축+종합)
  - 분기 `monthGrowth`(전분기 대비) · `forecast`(성장세 종목 1RM 다음 분기 외삽) · stagnation `cause`
  - 연간 `yearWrapped`(누적 운동·총 볼륨·최고 성장)

### 1-E. 처리 흐름
1. `ReportV2Service.build` → 기간 resolve(또는 custom from/to) → 캐시/잡 확인.
2. 캐시 미스 → **비동기 잡**(@Async) 시작, 앱은 2초 폴링(진행률 %). 진행률 = LLM 출력 글자수 기반(추론 구간은 15%에서 대기 후 상승).
3. `aiReportService.generate` → 집계 → LLM(스트리밍) → `AiReportValidator`(수치 대조) → 실패 1회 재시도 → 그래도 실패면 **직전 성공 리포트 폴백**.
4. 성공 → `ai_reports`에 input_json·output_json 영속(멱등 캐시).
- **재생성 시점(홈 브리핑)**: 자정 경과(첫 진입) 또는 운동 세션 완료 시. 그 외엔 캐시.

---

## 2. 종목 코치 한 줄
화면: 종목 상세 헤더 해석. 엔드포인트: `GET /api/v1/ai/exercise-coach?exerciseId=`.

- **입력 facts(한국어로 번역해 전달 — 영어 enum/플래그 노출 차단)**:
  `종목·부위·현재1RM·최고1RM·정체주수·최근추세{1RM·중량·볼륨·빈도 = 상승/유지/감소}·수행스타일(확정 시만)·목표{주목표·세부목표·우선부위}`
- **프롬프트**: `SYSTEM`(목표·스타일 기준 한 문장, 60자, 필드명 금지) + **트레이너 말투 한 줄**.
- **출력**: 한 문장(예: "등 넓어지기엔 중요한 종목인데 47주째 향상이 없어 자극이 부족합니다").
- **캐시**: 인메모리(데이터 시그니처 기준). 데이터 바뀌면 재생성.

---

## 3. 종목 구조화 리포트  ← 최근 전면 개편
화면: 종목 상세 "🤖 AI 코치". 엔드포인트: `GET /api/v1/ai/exercise-report?exerciseId=&force=`.

- **입력 facts**: 코치 한 줄과 동일(한국어, enum/UNKNOWN 미전달).
- **시스템 프롬프트(`REPORT_SYSTEM`) 핵심 규칙**:
  - facts의 키 이름·영어·내부 용어(trend·UNKNOWN·HYPERTROPHY 등) **노출 금지 → 전부 자연어**.
  - 사용자 **세부목표(예: 등 넓어지기)에 연결**해 분석.
  - 구조: **목표 대비 현재 상태 → 원인 → 다음 액션(구체 무게×반복×세트) → 체크리스트(운동 중 확인 가능)**.
  - + 트레이너 말투 한 줄.
- **출력 JSON**:
  ```json
  { "status":"정체|성장|하락|신기록", "goalBasis":"등 넓어지기 목표 기준으로",
    "currentSituation":"목표 대비 현재 상태", "causes":[…], "nextActions":["117.5kg×5×3 …"],
    "checklist":["117.5kg×5×3 수행","RPE 8 이하 유지","총 반복수 +2","운동 후 허리 기록"] }
  ```
- **영속 캐시 `exercise_ai_report`**: `generated_at`이 "마지막 AI 업데이트". 데이터가 같고 force가 아니면 저장본(날짜 유지), force(수동 '↻ 업데이트') 또는 데이터 변경 시 재생성+날짜 갱신.
- 앱: currentSituation→원인→다음액션 렌더, **checklist는 편집 가능 체크리스트로 프리필**.

---

## 4. 채팅 (대화로 풀기)
엔드포인트: `POST /api/v1/ai/v2/chat`.
- **입력 ctx**: 해당 기간 stats(리포트와 동일 집계) + profile + period + **tone(트레이너)** + question + history.
- **프롬프트(`CHAT_SYSTEM`)**: 내 데이터 기반 대화, 없는 정보는 추정 명시, tone대로 말투, 마크다운/JSON 금지.
- **출력**: 답변 텍스트 + 추천 질문.

---

## 5. 트레이너(말투) 시스템
- 저장: 설정 `ai_coach_tone` ∈ `terry|baptiste|crystal`(기본 terry). 레거시 plain→terry·cheer→crystal·blunt→baptiste.
- 적용: 리포트(입력 tone) · 종목 코치/리포트(`AiPrompts.trainerLine` 덧붙임) · 채팅(ctx.tone) — **모든 AI 출력**에 동일 말투.
- 선택: 온보딩 끝 화면 / 설정 'AI 트레이너' → `app/trainer.tsx`.

## 6. 모델·캐시 요약
| 항목 | 현재 |
|---|---|
| 모델 | **전부 gpt-5-mini** (`AI_MODEL`=gpt-5-mini) |
| max_completion_tokens | **8000**(추론 모델 출력 비는 것 방지) |
| 타임아웃 | 스트리밍 유휴 120s·전체 300s, 비스트리밍 240s |
| 리포트 캐시 | `ai_reports`(기간 멱등). 홈 브리핑은 자정/세션완료에 재생성 |
| 종목 리포트 캐시 | `exercise_ai_report`(영속, generated_at) |
| 종목 코치 캐시 | 인메모리(시그니처) |
| 환각 차단 | `AiReportValidator`가 LLM 수치를 입력 stats와 대조 |
