# GymTracker · AI 분석 시스템 설계 (정본)

> AI는 운동 데이터를 **계산**하지 않는다. 계산은 앱이 한다. AI의 역할은 **목표 기반 해석**이다.
> 모든 분석 구조: **목표 → 현재 위치 → 원인 → 다음 액션.** 통계는 근거일 뿐, 주인공은 목표 달성.
> 관련: [AI_SCOPE.md](AI_SCOPE.md)(무엇을 AI/무엇을 숫자), [REPORT_REDESIGN.md](REPORT_REDESIGN.md)(기간별 인격).

## 핵심 원칙
1. **앱이 계산하고 AI는 해석한다.** Raw 기록 전체를 주지 않고, 앱이 미리 계산한 값(1RM·최대중량·추세·주간 볼륨/세트/빈도·정체 기간)만 전달. AI는 새 숫자를 만들지 않는다.
2. **목표 중심 분석.** 같은 데이터도 목표에 따라 해석이 다르다. (예: 벤치 80kg 12주 정체 — 근력 목표=정체, 근비대 목표=볼륨↑면 문제 없음.) 모든 분석은 목표 기준.
3. **종목 목표는 AI가 추론.** 사용자는 운동 목표·세부 목표·우선 부위만 설정. 종목별 수행 스타일은 **앱이 규칙으로 계산**(아래).

## 공통 Context (앱 → AI 입력)
```ts
type UserGoalContext = {
  primaryGoal: 'HYPERTROPHY'|'STRENGTH'|'FAT_LOSS'|'HABIT'|'HEALTH'|'UNKNOWN';
  specificGoal?: string;            // 북극성(successGoal)
  priorityMuscles?: string[];
  weeklyTargetCount?: number;
  constraints?: { injuries?: string[]; sessionMinutes?: number };
};
type ExerciseStyleContext = {
  inferredStyle: 'STRENGTH'|'HYPERTROPHY'|'ENDURANCE'|'MAINTENANCE'|'UNKNOWN';
  confidence: number;
  evidence: { strengthSetRatio?; hypertrophySetRatio?; enduranceSetRatio?; weeklySetAvg?; frequencyAvg? };
};
type ExerciseStatsContext = {
  exerciseName: string; muscleGroups: string[];
  currentEstimated1RM?; bestEstimated1RM?; recentTrendPercent?;
  weeklyVolume?; weeklySets?; weeklyFrequency?;
  lastPerformedDaysAgo?; stagnationWeeks?; recentBestSet?: string;
};
```

## 종목 수행 스타일 추론 (LLM 아님 · 앱 규칙)
최근 8주 세트의 반복수 비율로 판정:
- reps ≤ 5 → 근력 / 6~12 → 근비대 / ≥ 13 → 근지구력
- 비율 > 0.5인 스타일 선택, 없으면 UNKNOWN. (STRENGTH/HYPERTROPHY/ENDURANCE)

## 공통 시스템 프롬프트 (요지)
- 너는 데이터 기반 애널리스트(감성 응원 < 분석). 계산은 이미 끝났다 — **숫자 새로 계산/추정 금지, 없는 사실 생성 금지.**
- **목표 기준을 반드시 언급.** 항상 순서: ① 목표 대비 현재 위치 ② 원인 분석 ③ 다음 액션(즉시 실행 가능).
- 출력은 지정 JSON만.

## 분석 타입 · 관점 · 출력
| 타입 | 질문 | 관점 | 출력 핵심 필드 |
|---|---|---|---|
| **DAILY_BRIEFING** | 오늘 뭐 할까 | Action | title·summary·todayRecommendation·keyInsights·nextAction |
| **WEEKLY_REPORT** | 이번 주 잘하나 | Progress | weeklyScore·goalProgressSummary·wins·risks·nextWeekFocus·recommendedActions |
| **MONTHLY_REPORT** | 이번 달 성과 | Result | monthlyScore·goalProgressSummary{summary,progressPercent}·highlights·growthDrivers·risks·nextMonthFocus |
| **QUARTERLY_REPORT** | 전략 맞나 | Strategy | quarterlyScore·majorAchievements·plateaus·strategyReview{whatWorked,whatDidNotWork}·nextQuarterFocus |
| **YEARLY_REPORT** | 얼마나 변했나 | Transformation | yearlyScore·yearInReview·biggestWins·bodyPartProgress·milestones·lessonsLearned·nextYearGoals |
| **EXERCISE_REPORT** | 이 종목 어떻게 | Execution | status·goalBasis·currentSituation·causes·nextActions·checklist |
| **CHAT_COACH** | 자유 대화 | Coaching | (목표 항상 고려·최근 데이터 참고·없는 정보는 추정 명시) |

## 최종 목표
"운동 기록을 읽어주는 AI"가 아니라 **"목표 달성을 돕는 AI."** 모든 분석은 목표↓현재위치↓원인↓다음액션 구조를 따른다.
