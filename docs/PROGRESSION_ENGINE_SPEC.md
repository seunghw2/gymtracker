# 점진적 과부하 엔진 설계 스펙 (PROGRESSION_ENGINE_SPEC)

> 작성: Progression Engine Agent. 입력 문서 `docs/APP_AUDIT.md`, `docs/PROGRESSION_PROGRAMS.md`, `docs/PROGRESSIVE_OVERLOAD_RESEARCH.md`(7장 결론) 및 실제 엔진 코드(`gymtracker-backend/.../overload/ProgressionEngine.java`, `OverloadService.java`)를 읽고 근거 기반 작성.
> 성격: **설계 문서**. 코드는 수정하지 않는다. 현 구현과의 차이를 명시한다.
> 타겟: 본인 1명(Strong 헤비유저, 중급+). 입력 최소화 · 헬스장 3초 이해가 철칙.
> 작성일: 2026-06-29

---

## 0. 설계 철칙 (모든 메서드가 지켜야 할 불변식)

이 스펙의 모든 계산은 아래 4개 원칙을 위반하면 안 된다. 메서드별 의사코드에 이를 가드로 심는다.

1. **오늘 목표는 직전 비교 기록(last comparable) 기준으로 계산.** "최고 비교 기록(best comparable)"은 현재 위치 판단용, "전체 PR(all-time PR)"은 동기부여용. 세 기록의 역할을 절대 섞지 않는다.
2. **기준 기록이 부족하면 분석하지 않고 기준 생성 단계로.** 기록 0개 → `NEED_BASELINE`, 1개 → `BASELINE_CHECK`. 이 단계에서는 개선/하락/정체를 단정하지 않는다.
3. **비교 조건이 다르면 개선/하락을 단정하지 않는다.** 세트 수가 2 이상 차이나면 `COMPARISON_DEFERRED`(비교 보류). 보류는 결코 "하락"으로 표현하지 않는다.
4. **비현실적 목표 금지.** 총 3회 한 사용자에게 오늘 15회를 제시하지 않는다. 오늘 목표 = 직전 총 + 작은 bump(맨몸 +1, 무게 기반 +1~2). 장기 목표는 별도 필드로 분리해 "오늘"과 섞지 않는다.

운동 유형별 추적 강도(역할):
- **core(핵심)**: 종목별 단계 머신을 적극 추적, 오늘 목표·증량 신호 모두 제공.
- **support(보조)**: 종목 카드는 보여주되 부위 볼륨·주간 균형 반영을 우선. 무리한 증량 처방 자제.
- **log_only(기록만)**: 단계 분석을 하지 않고 단순 기록만. 세션 평가에서 제외(`evaluateSession`이 이미 제외).

---

## 1. 입력 데이터 모델 (현 코드 기준)

엔진이 받는 단위 타입은 이미 정의돼 있다. 그대로 사용한다.

```
Kind = BARBELL_COMPOUND | MACHINE_OR_CABLE | ISOLATION | BODYWEIGHT   // ProgressionEngine.Kind
SetRec(weight: double, reps: int, warmup: boolean)
DayRecord(date: LocalDate, sets: List<SetRec>)                        // 한 날의 한 종목 전체 세트
```

파생 헬퍼(이미 구현, 단일 소스):
- `working(r)` = 워밍업 제외 작업 세트
- `topWeight(r)` = 작업 세트 최대 무게(= 대표 작업 무게)
- `topWeightReps(r)` = 대표 무게 세트들의 반복수 리스트
- `progressionReps(k, r)` = 진행 기준 반복수 (맨몸=전체 합, 무게 기반=대표 무게 세트 합)
- `totalReps(r)` = 작업 세트 반복수 전체 합

**핵심 규칙**: 무게 기반 종목의 "총 반복수"는 항상 **대표(최대) 무게 세트만** 합산한다. 워밍업·드롭·가벼운 세트가 비교를 오염시키지 않게 한다. (현 `progressionReps` 동작과 일치)

---

## 2. 12개 메서드 시그니처 · 입출력 · 의사코드

각 메서드는 (a) 입력 (b) 출력 (c) 로직 의사코드 (d) 현 코드 매핑을 갖는다.
세 가지 기록 조회 메서드(`getLastComparableRecord`/`getBestComparableRecord`/`getAllTimePR`)는 §0-1의 역할 분리를 강제하는 1차 게이트다.

### 2.1 getLastComparableRecord — 직전 비교 가능 기록

- **입력**: `kind: Kind`, `records: List<DayRecord>`(최신순)
- **출력**: `DayRecord | null` (오늘 목표 계산의 유일한 기준)
- **로직**:
```
records 중 working(r) 비어있지 않은 첫 항목(가장 최근) 반환
없으면 null  // → NEED_BASELINE 으로 귀결
```
- **현 코드**: `compute`가 `records.get(0)`를 prev로 사용(working 비어있는 날은 사전 필터). 별도 메서드는 없으나 동일 의미. → **이 스펙에서 명시적 메서드로 추출 권장**(가독성·재사용).

### 2.2 getBestComparableRecord — 최고 비교 가능 기록

- **입력**: `kind`, `records`
- **출력**: `DayRecord | null` (현재 위치 판단용. **오늘 목표 계산에 쓰지 않는다**)
- **로직**:
```
best = argmax over records of progressionReps(kind, r)   // 동률이면 최신
working(r) 비어있으면 후보 제외
```
- **현 코드**: `bestRecordOf(kind, records)` — 그대로 사용. (Guide.bestRecord/bestRecordDate)

### 2.3 getAllTimePR — 전체 PR

- **입력**: `records`
- **출력**: `String | null` (가장 무거운 단일 세트 "무게 × 반복". 맨몸/무게0은 null) — **동기부여용 화폐**
- **로직**:
```
bestW = max single-set weight over all working sets; bestReps = 그 세트 reps
bestW <= 0 → null
else "{bestW}kg × {bestReps}회"
```
- **현 코드**: `allTimePrOf(records)` — 그대로. 맨몸은 `compute`에서 null 처리.
- **주의(연구 7장)**: 1RM은 **동기부여 화폐로 유지(강등 아님)**. 근비대 종목의 정체 판정에 1RM 단독 사용 금지(현 엔진은 반복수 기반이라 이미 충족).

### 2.4 getComparisonConfidence — 비교 신뢰도

- **입력**: `kind`, `records`
- **출력**: `ComparisonConfidence` = `HIGH | MEDIUM | LOW | DEFERRED` + 근거 문자열
- **로직**:
```
records.size() < 2          → LOW    ("기록이 한 번뿐이라 비교는 다음부터")
setCountSimilar(records)    → HIGH   ("같은 운동 · 세트 수 유사")
else                        → MEDIUM ("세트 구성이 달라 참고용으로만 비교")
// DEFERRED는 평가 시점(evaluate)에서 prev/cur 세트수 차 >=2 일 때 부여
```
- **현 코드 매핑**: `comparisonReason`(문자열만 반환, HIGH/MEDIUM 구분은 텍스트로만). `toDto`의 `comparability`는 `hasBaseline`만으로 high/low를 단순 산출 → **개선점**: `comparability`를 `getComparisonConfidence`의 4값 enum으로 정렬(아래 §6 추가 항목).
- **철칙 연결**: MEDIUM/DEFERRED일 때 §0-3에 따라 개선/하락 단정 금지.

### 2.5 getProgressionStage — 현재 단계

- **입력**: `kind`, `goalType`, `records`, `trigger`
- **출력**: `ProgressionStage`(9종 중 하나) + stageLabel
- **로직**(현 `compute`의 단계 분기 = 사실상 이 메서드):
```
records 비어있음            → NEED_BASELINE
records.size() == 1         → BASELINE_CHECK
stalling && setCountSimilar → STALL_REVIEW
else 분류별:
  BODYWEIGHT                → BUILD_REPS
  ISOLATION/BARBELL/MACHINE → readyToIncrease(records,repMax,sets,trigger) ? READY_TO_INCREASE : BUILD_REPS
```
- **현 코드가 실제 반환하는 stage = 5개**: NEED_BASELINE, BASELINE_CHECK, STALL_REVIEW, BUILD_REPS, READY_TO_INCREASE.
- **이 스펙이 추가 정의(미구현)**: INCREASE_LOAD, CONSOLIDATE, HOLD_OR_REPEAT, DELOAD_OR_RESET → §4 단계표 참조. (연구 P0-3/P1-1)

### 2.6 getTodayTarget — 오늘 목표

- **입력**: `kind`, `goalType`, `lastRecord(= getLastComparableRecord)`, `stage`, `trigger`
- **출력**: `{ text: String, targetWeight: Double?, targetTotalReps: Integer? }`
- **로직**(§0-1·0-4 강제: **반드시 직전 기록 기준 + 작은 bump**):
```
prevTotal = progressionReps(kind, lastRecord)
w         = topWeight(lastRecord)
bump      = (kind==MACHINE_OR_CABLE) ? [2,3] : [1,2]   // buildBump

stage별:
 NEED_BASELINE:
   BODYWEIGHT  → "현재 가능한 총 반복수를 기록하세요"
   ISOLATION   → "{min}~{max}회 × 3세트로 첫 기준 만들기" (+caution 자세 우선)
   BARBELL     → "현재 가능한 안전한 작업 세트 기록하기"
   MACHINE     → "{min}~{max}회 × 3세트 기준 만들기"
 BASELINE_CHECK:
   BODYWEIGHT  → "총 {prevTotal + 1}회"           // bump[0]만, 작게
   else        → "{min}~{max}회 × 3세트로 기준 안정화"
 BUILD_REPS:
   BODYWEIGHT  → "총 {prevTotal + 1}회"
   ISOLATION   → "{w}kg {min}~{max}회 × 3세트"
   BARBELL/MACHINE → "{w}kg 총 {prevTotal+bump[0]}~{prevTotal+bump[0]+1}회"
 READY_TO_INCREASE:
   → "같은 무게로 한 번 더 확인하거나 다음 운동에서 소폭 증량 가능"
 STALL_REVIEW:
   → "같은 순서·조건에서 한 번 더 기록"
```
- **가드(필수)**: `targetTotalReps`는 항상 `prevTotal + 1~2`를 넘지 않는다. **장기 목표(15회 등)를 오늘 목표로 절대 산출 금지**(§0-4, 테스트 2).
- **현 코드**: `compute` 본문이 stage별로 이 문구를 이미 생성. 일치.

### 2.7 getSuccessCondition — 성공 조건

- **입력**: `kind`, `stage`
- **출력**: `String` (오늘 이걸 하면 "성공")
- **로직**:
```
BODYWEIGHT  → "지난 기록보다 총 반복수 +1회"
무게 기반    → "지난 기록보다 총 반복수 +1~2회 · 마지막 세트 1~2개 남기는 느낌이면 성공"
READY_TO_INCREASE(바벨/머신) → "반복 범위 상단 달성 + 마지막 세트 여유"
NEED_BASELINE → "마지막 세트 1~2개 남기는 느낌으로 기록"
```
- **현 코드**: `successReps` / Guide.successCondition. 일치.
- **주의**: "마지막 세트 여유(RPE)"는 현재 **데이터 미저장**이라 판정엔 안 들어가고 **안내 문구**일 뿐(APP_AUDIT §13-1). RIR 저장 전까지 이 문구는 가이드로만.

### 2.8 getNextStep — 다음 단계 안내

- **입력**: `kind`
- **출력**: `String`(성공/여유/실패 분기 문구)
- **로직**:
```
무게 기반 → "성공하면 → 총 반복수 +1~2 / 여유 있으면 → 다음 무게 고려 / 실패하면 → 같은 조건 한 번 더"
맨몸     → "성공하면 → 총 반복수 +1 / 실패하면 → 같은 목표 한 번 더"
```
- **현 코드**: `NEXT_STEP_REPS` / `NEXT_STEP_BW`. 일치.

### 2.9 evaluateWorkoutResult — 운동 후 결과 평가

- **입력**: `kind`, `prev(직전 비교 기록)`, `cur(오늘 기록)`
- **출력**: `Eval { result, resultLabel, userMessage }`, result ∈ `BASELINE_CREATED | IMPROVED | MAINTAINED | MISSED | COMPARISON_DEFERRED`
- **로직**(§0-2·0-3 강제):
```
cur 비어있음                         → COMPARISON_DEFERRED ("기록이 없어 비교 안 함")
prev 비어있음                        → BASELINE_CREATED   ("첫 기준 생성")
|working(prev) - working(cur)| >= 2  → COMPARISON_DEFERRED ("세트·조건 달라 직접 비교 안 함")  ← 테스트 7
prevT, curT = progressionReps(...)
curT > prevT  → IMPROVED   ("총 반복수 {차}회 늘었어요")
curT == prevT → MAINTAINED ("기준 유지")
else          → MISSED     ("기준에 못 미침 — 다음에 한 번 더")
```
- **가드(테스트 8)**: `COMPARISON_DEFERRED`의 userMessage는 **절대 "하락/감소/나빠짐"** 표현을 쓰지 않는다. "조건이 달라 비교하지 않았다"로만.
- **현 코드**: `ProgressionEngine.evaluate` — 그대로 일치. `OverloadService.evaluateSession`이 종목별로 호출하고 `log_only` 제외.

### 2.10 getBottomSheetData — 종목 바텀시트 데이터

- **입력**: `userId`, `exerciseGoal`, `exercise`, `goalType`, `trigger`
- **출력**: `ExerciseGoalDto`(stage/stageLabel/todayTarget/successCondition/nextStep/3종기록/비교근거/단기·장기 목표 전부)
- **로직**:
```
kind = kindOf(ruleType)
records = loadRecords(userId, exerciseId)            // 최신순
guide = compute(kind, goalType, records, trigger)    // = getProgressionStage+getTodayTarget+... 묶음
role  = goal.role || classifyRole(...)
return DTO(... guide.* ..., comparability=getComparisonConfidence)
```
- **현 코드**: `OverloadService.toDto` — 그대로. (`ExerciseGoalSheet.tsx`가 소비)
- **표시 역할 분리**: 직전 기록=오늘 목표 근거 / 최고 기록=현재 위치 / 전체 PR=동기부여. UI는 이미 3종을 분리 노출(`ExerciseGoalSheet`).

### 2.11 getHomeProgressionCardData — 홈 종목 카드 데이터

- **입력**: `userId`(→ goals 전체)
- **출력**: `List<ExerciseGoalDto>` 단계순 정렬(`stageOrder`)
- **로직**:
```
goals = exerciseGoalRepo.findByUserId(userId)
goalType, trigger = goalSetting 조회(없으면 hypertrophy / two_sessions)
return goals.map(toDto).sorted(by stageOrder)
```
- **stageOrder**(현 코드): READY_TO_INCREASE(0) → STALL/DELOAD(1) → INCREASE/CONSOLIDATE/HOLD(2) → BUILD_REPS(3) → NEED_BASELINE(4) → 기타(5). "지금 행동할 것"을 위로.
- **현 코드**: `getExerciseGoals` + `index.tsx`의 GoalCard. 일치.

### 2.12 getWorkoutInProgressTargetData — 운동 중 목표 데이터

- **입력**: `exerciseGoal`(또는 DTO), 현재까지 입력된 세트들
- **출력**: `{ todayTarget: String, targetWeight: Double?, targetTotalReps: Integer?, remainingReps: Integer? }`
- **로직**:
```
todayTarget, targetWeight, targetTotalReps = guide에서 (이미 DTO에 존재)
doneReps = 현재 세션에서 이 종목 작업 세트 reps 합(대표 무게 기준)
remainingReps = targetTotalReps != null ? max(0, targetTotalReps - doneReps) : null
```
- **현 코드**: **미연결**(APP_AUDIT §13-2). `targetTotalReps`는 DTO에 있으나 `workout.tsx`가 운동 중 카드에 노출/차감하지 않음. → **이 스펙에서 추가할 것**(헬스장 3초 룰 핵심). 엔진 신규 계산은 불필요, **프론트가 기존 `targetTotalReps`를 읽어 차감 표시**만 하면 됨.

---

## 3. 운동 유형별 기본 규칙 (상세)

공통 1차 엔진 = **Double Progression**. 4개 유형은 (반복 범위 · 증량폭 · 정체 출구) 3파라미터로만 갈린다(PROGRESSION_PROGRAMS 결론).

### 3.1 BARBELL_COMPOUND
- **반복 범위**: 비대 6~12 / 근력 3~6 (`repRange`, goalType 분기 — 현 구현됨).
- **진행**: 같은 중량에서 **총 반복수 +1~2** 누적 → 목표(상단×세트수) 달성 후 **소폭 증량**(상체 +2.5kg, 하체 +2.5~5kg, 사용자 incUpper/incLower 그대로).
- **금지**: 직전 4회 → 갑자기 8회×3 요구 금지. 오늘 목표는 직전 총 +1~2만.
- **비대↔근력 전환**: 근력 범위(3~6)로 전환 시 **중량을 낮춰** 제안(고반복으로 쌓은 무게를 저반복에 그대로 들이대지 않음).
- **정체 출구**: 세트 추가 먼저 → 재차 정체면 5~10% 감량(2단계, §5).
- **현 코드**: BUILD_REPS가 `"{w}kg 총 {target}~{target+1}회"` 처방. 증량폭은 `incUpper/incLower`(상하체 차등 동작 중). 일치.

### 3.2 MACHINE_OR_CABLE
- **반복 범위**: 8~12 (복근/케이블 계열은 운영상 10~20까지 허용 가능하나 현 단일 소스는 8~12).
- **진행**: **반복수 우선**. 범위 상단을 세트 수만큼 채우면 다음 중량(핀 1단) 고려.
- **증량폭**: **마이크로로딩 — increment 절반(최소 0.5kg)**(`effectiveIncrement`). 핀머신 큰 점프 방지.
- **정체 출구**: **세트 추가 우선** → 그래도 막히면 감량.
- **현 코드**: BUILD_REPS bump = [2,3](머신은 총 반복수를 조금 더 크게). `effectiveIncrement` 절반 적용. 일치.

### 3.3 ISOLATION
- **반복 범위**: **8~15**(연구 반영, 과거 12~20에서 하단을 낮춰 증량 출구 확보).
- **진행**: **자세·반복수 우선**. 범위 상단 달성 시 증량 가능하나 **보수적(마이크로로딩)**.
- **실패 강요 금지**: "마지막 세트 1~2개 남기는 느낌". 완전 실패 강제 안 함.
- **무게0 고립**(맨몸 고립 등): 증량 대신 **"유지"**(`computeNextTarget` current<=0 → "유지").
- **정체 출구**: 세트 추가 우선.
- **현 코드**: READY_TO_INCREASE 문구에 "증량은 보수적으로 — 강제하지 않아요" caution. `effectiveIncrement` 절반. 일치.

### 3.4 BODYWEIGHT
- **반복 범위**: 5~12 (풀업/딥스는 임계 전까지 반복 중심).
- **진행**: **총 반복수 진행**. **오늘 목표 = 직전 총 + 1~2.**
- **단기/장기 분리**(§0-4 강제):
  - 오늘 = 직전 총 + 1 (bump[0])
  - 단기 = `max(8, ceil(직전총 × 1.5))` (현 `shortT`)
  - 장기 = "총 15회" (고정 장기 목표)
  - 예: 직전 3 → 오늘 4 → 단기 8 → 장기 15. **오늘 카드에는 4만, 15는 장기 필드에만.**
- **임계 후 가중**: 풀업 8~10·딥스 10~15 등 임계 도달 후 +2.5~5kg 가중으로 Double Progression 전환(설계상 권장, 현 엔진 미구현 — 후속).
- **현 코드**: BUILD_REPS가 `"총 {prevTotal+1}회"` + shortTerm + longTerm="총 15회". `compute`가 맨몸 PR을 null로. 일치. 임계 후 가중 전환은 미구현.

---

## 4. 단계 머신 — 진입/이탈 조건표

`ProgressionStage` 9종. **굵게=현 `compute`가 실제 반환(구현됨)**, 나머지는 이 스펙이 정의(미구현, 후속).

| Stage | 진입 조건 | 이탈 조건 | 처방 | 상태 |
|---|---|---|---|---|
| **NEED_BASELINE** | working 기록 0개 | 1회 기록되면 → BASELINE_CHECK | "현재 가능한 만큼 안전하게 기록" | 구현됨 |
| **BASELINE_CHECK** | working 기록 1개 | 1회 더 기록 → BUILD_REPS/READY (정체 판단은 아직 불가) | "같은 조건 한 번 더로 기준 안정화" | 구현됨 |
| **BUILD_REPS** | 기록 2+ & 증량 미준비 & 비정체 | readyToIncrease=true → READY_TO_INCREASE / 누적 정체 → STALL_REVIEW | "총 반복수 +1~2" (맨몸 +1) | 구현됨 |
| **READY_TO_INCREASE** | 범위 상단을 세트수만큼 달성 + 트리거(2세션 기본) 충족 | 증량 적용 시 → (설계) INCREASE_LOAD / 현재는 다음 세션에서 자연 재평가 | "한 번 더 확인 또는 소폭 증량" | 구현됨 |
| INCREASE_LOAD | 사용자가 증량 적용한 직후 1세션 | 새 무게에서 하단 재확립하면 → BUILD_REPS | "새 무게에서 범위 하단부터 재확립" | **미구현(후속 P0-3)** |
| CONSOLIDATE | 증량 직후 적응 구간(1~2세션 동일 무게 유지) | 안정되면 → BUILD_REPS | "이 무게로 한 번 더 안정화" | **미구현(후속)** |
| HOLD_OR_REPEAT | 맨몸 목표 반복 지속 미달 | 목표 달성 시 → BUILD_REPS | "같은 목표 한 번 더, 무리 금지" | **미구현(후속)** |
| **STALL_REVIEW** | 같은 무게 **3회 연속 비증가**(`stalling`) **AND** 세트수 유사(`setCountSimilar`) | 반복수 증가/세트 추가 성공 → BUILD_REPS / 재차 정체 → DELOAD_OR_RESET | **1차: "세트 추가 또는 5~10% 감량 검토"** | 구현됨(2단계 중 1단계) |
| DELOAD_OR_RESET | STALL_REVIEW 후 **재차 정체**(2단계) | 감량 후 재시작·반복수 회복 → BUILD_REPS | "5~10% 감량 후 재시작(회복 목적)" | **미구현(후속 P1-1)** |

**STALL_REVIEW 게이팅(§테스트 5 핵심)**: 단발 저조가 아니라 **누적 정체**로만 진입한다. 구체적으로:
- `records.size() >= 3` 그리고 같은 무게 기록 ≥ 3개 (`stalling`이 같은 무게 3개 미만이면 false 반환)
- `progressionReps(newest) <= progressionReps(oldest of 3)` (3회에 걸쳐 비증가)
- `setCountSimilar`(최근 3개 세트수 차 ≤ 1) — 세트 구성이 다르면 정체 단정 안 함
→ **기록이 1~2개거나 무게가 제각각이면 절대 정체로 보지 않는다.**

**DELOAD_OR_RESET 포지셔닝(연구 7장)**: 회복 목적. **"성장 재민감화/성장 촉진" 카피 금지**(Coleman 2024 근거 부족). "정체 탈출·회복"으로만 표현.

---

## 5. 2단계 정체 안전망 (GZCL식)

연구 7장 P1-1 만장일치 결론. 한 번 막혔다고 바로 감량하지 않는다.

```
1차 정체(STALL_REVIEW 첫 진입):
   → "같은 순서·조건에서 한 번 더 기록" + "변화 없으면 세트 추가 또는 5~10% 감량 검토"
   → 우선 세트 추가(특히 machine/isolation) 또는 재기록으로 비교 신뢰도 확보
2차 정체(세트 추가/재기록 후에도 같은 무게 비증가):
   → DELOAD_OR_RESET: "5~10% 감량 후 재시작(회복 목적)"
```
- **현 구현**: STALL_REVIEW의 nextCondition이 이미 "세트 추가 또는 5~10% 감량 후 재시작"을 한 문장에 담음. **2단계 분기(첫 정체=세트추가, 재정체=감량)는 미구현** → 후속 보강.

---

## 6. 현 백엔드 구현 vs 이 스펙 (추가/수정 구분)

### 이미 구현됨 (그대로 유지)
- `kindOf`, `repRange`(단일 소스, goalType 분기), `compute`(5 stage), `evaluate`(5 result), `formatRecord`, `bestRecordOf`, `allTimePrOf`, `comparisonReason`, `readyToIncrease`(trigger 반영), `stalling`+`setCountSimilar`, `buildBump`.
- 증량 트리거(single/two_sessions/rpe) **연결됨**(`compute(...trigger)`). 기본 two_sessions.
- 마이크로로딩(`effectiveIncrement`: 머신/고립 절반, 최소 0.5kg).
- 상하체 차등 증량(`incUpper`/`incLower`), `evaluateSession`의 `log_only` 제외.
- 단계순 정렬(`stageOrder`), 3종 기록 DTO 분리.

### 이 스펙에서 추가/수정 (미구현·후속)
1. **INCREASE_LOAD / CONSOLIDATE 전이**: 증량 직후 적응 단계. 현재 5 stage만 반환 → 9 stage 완성. (연구 P0-3)
2. **DELOAD_OR_RESET + 2단계 정체 분기**: STALL_REVIEW 재진입 시 감량 처방으로 전이. (연구 P1-1)
3. **HOLD_OR_REPEAT(맨몸)**: 목표 반복 지속 미달 시 유지 단계.
4. **운동 중 목표 노출/차감**(`getWorkoutInProgressTargetData`): `targetTotalReps` 차감 표시. 엔진 변경 불필요, 프론트 연결. (APP_AUDIT P0-2)
5. **getComparisonConfidence 4값화**: `comparability`를 HIGH/MEDIUM/LOW/DEFERRED enum으로 정렬(현재 high/low 2값).
6. **RIR 저장·rpe 트리거 실데이터화**: 세트 모델에 effort 컬럼 추가 후 `readyToIncrease`의 rpe 분기 실데이터 연결. (현재 single 폴백, APP_AUDIT P0)
7. **임계 후 가중 전환(맨몸)**: 풀업/딥스 임계 도달 후 +2.5~5kg Double Progression 전환.

### 명시적 보류 (연구 7장 만장일치 — 하지 않음)
- 자동 디로드 강제, 디로드 "성장 재민감화" 카피, mesocycle 풀구현/MEV·MRV 정밀화, 1RM 강등(병기까지만), RIR 강제 입력, 다주 캘린더 정체 판정, 레벨별(초·중·고) 분기.

---

## 7. 테스트 케이스 기대 출력 (8개)

각 케이스는 위 메서드/단계/철칙으로부터 도출되는 **기대 출력**이다.

| # | 시나리오 | 입력(기록, 최신순) | stage | todayTarget | 핵심 판정 / 금지 |
|---|---|---|---|---|
| 1 | PullUp 총3회 → 오늘 총4회 | BODYWEIGHT, [총3회] (1개) → 또는 [총3, 총3] | BASELINE_CHECK(1개) / BUILD_REPS(2개+) | **"총 4회"** (= 직전3 + bump 1) | 오늘 목표 = 직전 총 + 1. 절대 +다량 금지 |
| 2 | 그 PullUp에 장기15를 오늘목표로 금지 | 위와 동일 | (동일) | todayTarget = **"총 4회"**, longTerm = "총 15회"(별도 필드) | **오늘 카드에 15회 노출 금지**(§0-4). 15는 longTermTarget에만 |
| 3 | Squat 80kg 4/4/4/4 → 오늘 80kg 총17~18회 | BARBELL, prev= 80kg 4/4/4/4 (총16), 비대 6~12 | BUILD_REPS | **"80kg 총 17~18회"** (= 16 + bump[0]=1 → 17, +1 → 18) | 같은 무게 총 반복수 +1~2. 무게 그대로 |
| 4 | 그 Squat에 바로 80kg 8회×3 금지 | 동일 | BUILD_REPS | 위와 동일 (17~18) | **"8회×3(=24)" 같은 급점프 금지.** 4회→8회×3 요구 안 함(§3.1) |
| 5 | Cable Crunch 40kg 3회 1세트 → 정체점검 금지 | MACHINE, [40kg×3회 1세트] (기록 1개) | **BASELINE_CHECK** | "8~12회 × 3세트로 기준 안정화" | **STALL_REVIEW 금지**(기록 1개 < 3, 세트 1개). 정체 단정 대신 기준 확인 |
| 6 | Lateral Raise 기준없음 → 8~15회×3 기준만들기 | ISOLATION, [] (기록 0개) | **NEED_BASELINE** | **"8~15회 × 3세트로 첫 기준 만들기"** (+caution "무게보다 자세·반복 범위 우선") | 분석 안 함. 기준 생성 단계 |
| 7 | 운동 순서/세트 크게 다르면 비교 보류 | prev 4세트 vs cur 2세트 (차 ≥2) | evaluate → **COMPARISON_DEFERRED** | "오늘은 수행 세트·조건이 달라 직접 비교하지 않았어요" | 개선/하락 단정 금지(§0-3, 2.9 가드) |
| 8 | 비교 보류를 하락으로 표현 금지 | 위와 동일 | COMPARISON_DEFERRED | 메시지에 "하락/감소/나빠짐" 단어 **없음** | resultLabel="비교 보류". 부정 평가 아님(§2.9 가드) |

도출 근거 요약:
- 1·2: `compute` BODYWEIGHT 분기 — target=`prevTotal+bump[0]`, longTerm="총 15회" 별도. (ProgressionEngine.java:255-262)
- 3·4: BARBELL BUILD_REPS — `"{w}kg 총 {prevTotal+1}~{prevTotal+2}회"`, prevTotal=16(대표무게 80kg 4세트 합). (ProgressionEngine.java:293-298)
- 5: 기록 1개 → `records.size() < 2` 분기로 BASELINE_CHECK, `stalling`은 size<3에서 false. (ProgressionEngine.java:229-239, 73)
- 6: 기록 0개 → NEED_BASELINE, ISOLATION 문구 + caution. (ProgressionEngine.java:196-208)
- 7·8: `evaluate` 세트수 차 ≥2 → COMPARISON_DEFERRED, "직접 비교하지 않았어요"(하락 표현 없음). (ProgressionEngine.java:335-338)

---

### 핵심 8줄
1. 12개 메서드는 사실상 현 백엔드 `ProgressionEngine.compute`/`evaluate`/`OverloadService.toDto`를 역할별로 재명세한 것이며, 5개(stage/오늘목표/성공조건/다음단계/평가)는 그대로 코드와 일치한다.
2. 오늘 목표는 항상 직전 비교 기록 + 작은 bump(맨몸+1, 무게+1~2)로만 계산하고, 최고 기록은 위치 판단·전체 PR은 동기부여로 역할을 분리한다.
3. 운동 4유형은 별개 방식이 아니라 Double Progression을 (반복 범위·증량폭·정체 출구) 3파라미터로 분기한 것이고, 머신/고립은 마이크로로딩(증량폭 절반)으로 큰 점프를 막는다.
4. 단계 머신 9종 중 현재 5종(NEED_BASELINE·BASELINE_CHECK·BUILD_REPS·READY_TO_INCREASE·STALL_REVIEW)만 구현됐고, INCREASE_LOAD·CONSOLIDATE·HOLD_OR_REPEAT·DELOAD_OR_RESET와 2단계 정체 분기가 후속 추가 항목이다.
5. STALL_REVIEW는 단발이 아니라 같은 무게 3회 누적 비증가 + 세트수 유사로만 진입해, 기록 1개거나 세트 구성이 다르면 정체로 단정하지 않는다.
6. DELOAD_OR_RESET은 회복 목적이며 "성장 재민감화" 카피를 금지하고, 1차 정체엔 세트 추가를 먼저 제안한다.
7. 비교 조건이 다르면(세트수 차 ≥2) COMPARISON_DEFERRED로 보류하고, 이 보류는 절대 "하락"으로 표현하지 않는다.
8. 8개 테스트는 전부 현 엔진 분기에서 도출되며(예: PullUp 3→4, Squat 80kg 16→17~18, Cable Crunch 1기록→기준확인, Lateral Raise 0기록→기준만들기), 비현실적 목표(오늘 15회)·급점프(4회→8회×3)·보류의 하락 표현을 명시적으로 금지한다.
