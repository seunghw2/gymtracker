# GymTracker AI 프롬프트 명세

> 최종 업데이트: 2026-06-18
> **독자**: ① 프롬프트 엔지니어(프롬프트 구조·출력 계약 수정) ② 운동 분석 전문가(코칭 로직·지표 해석 검증). 둘 다 코드를 깊이 몰라도 "무엇을·어디서·왜" 바꾸는지 알 수 있게 작성.
> 코드 위치는 모두 백엔드 레포 `gymtracker-backend`.

---

## 1. 설계 철학 (가장 중요)

**"계산은 코드, 해석만 LLM."**
- 모든 수치(볼륨·1RM·출석률·정체 주수…)는 **백엔드 코드가 확정**해 "사실(facts)"로 LLM에 넘긴다.
- LLM은 그 사실을 **재계산하지 않고 의미만 해석**한다(헤드라인·처방·코칭 서술).
- 출력은 **검증기**가 입력 facts와 대조해 환각(없는 숫자)을 차단하고, 실패 시 재시도→직전 성공 폴백.

→ 그래서 프롬프트를 고칠 때 **숫자 생성 로직은 프롬프트가 아니라 집계 코드**(`ReportAggregationService`)에 있다. 프롬프트는 "어떻게 말할지"만 담당.

---

## 2. LLM 호출 지점 (전체 맵)

| # | 기능 | 진입 | 시스템 프롬프트 | 입력(user content) | 코드 |
|---|---|---|---|---|---|
| 1 | **기간 리포트 생성** | `POST /api/v1/ai/report`, `GET /v2/report`(없으면 생성) | `AiPrompts.SYSTEM` | `AiReportInput`(facts) JSON | `AiReportService.generate` |
| 2 | **기간 스코프 채팅** | `POST /api/v1/ai/v2/chat` | `AiPrompts.CHAT_SYSTEM` | facts + tone + question + history | `AiChatService.reply` |
| 3 | **세션 코치 채팅** | `POST /api/v1/ai/conversations/{id}/messages` | `AiPrompts.CHAT_SYSTEM`(동일) | 위와 동일 | `ChatConversationService.send` → `AiChatService.reply` |
| — | 종목 리포트 코치(진단/처방 3줄) | 종목 리포트 화면 | **LLM 아님 — 코드 템플릿** | — | 프론트 `app/exercise/[name].tsx` `buildCoach()` |
| — | 온보딩 인테이크(9문항) | `/ai/intake` | **LLM 아님 — 구조화 저장** | — | `AiProfileService`(프로필은 #1·#2의 "해석 렌즈"로 들어감) |

- **프롬프트 파일**: `src/main/java/com/gymtracker/ai/AiPrompts.java` (SYSTEM, CHAT_SYSTEM 두 개가 전부).
- 추천 질문(suggestedQuestions)은 LLM이 아니라 `AiChatService.suggested(type)` 코드가 기간 타입별로 제공.

### 모델 파라미터 (`application.yml` `ai.*`, 전부 env로 오버라이드)
- `model`: `claude-sonnet-4-5` (env `AI_MODEL`)
- `max-tokens`: `1500` (env `AI_MAX_TOKENS`)
- `stagnation-weeks`: `4` (정체 판정 임계, env `AI_STAGNATION_WEEKS`)
- **temperature 미지정** → Anthropic 기본값. (필요 시 `AnthropicApiClient` 호출 바디에 추가)
- 호출: Anthropic Messages API `/v1/messages`, `system`=시스템 프롬프트, `messages`=user 1개(facts JSON). 리포트 생성은 **스트리밍** 경로(토큰 비례 진행률).
- 프로바이더 인터페이스 `LlmClient`(기본 `AnthropicApiClient`, `BedrockClient`는 골격).

---

## 3. 프롬프트 1 — 기간 리포트 `AiPrompts.SYSTEM`

**역할**: 기간(세션/주/월/분기/반기/연) 데이터를 해석해 JSON 리포트 생성. 페르소나 = **친근한 PT 트레이너**(현재→원인→행동).

**구조(섹션별 의도)**:
- *페르소나·말투*: 반말 트레이너, 비난·단정 표현 금지("무너졌다/실패/한심" 등 명시 금지어).
- *리포트 범위*: `period.label/type/horizon`을 먼저 읽게 함. 타입별 강조점(session=종목 세트, week=빈도·밸런스, month=성장·정체, quarter/half=궤적, year=서사).
- *진행 중 기간*(`in_progress=true`): 끝난 것처럼 평가 금지, 중간 점검·전향적으로.
- *입력 해석 규칙*: stats는 사실 — 재계산 금지, 세션 수는 `consistency.sessions`만, `muscle_frequency.weekly_sets`=주당 평균, profile=해석 렌즈.
- *톤*(plain/cheer/blunt): 세 톤이 한눈에 구분되게(예시 포함).
- *출력 규칙*: JSON only, headline ≤24자·원시숫자 나열 금지, 없는 숫자 금지, prescription 정확히 1개(≤50자), coaching 항목은 근거 있을 때만(각 ≤80자), 얇으면 confidence=low + data_caveat.
- *안전*: 통증/부상 메모 시 증량 권유 금지, 의학적 진단 금지.
- *coaching 20개 항목 의미 사전* + *few-shot 예시 1개* + *출력 JSON 스키마*.

**전체 원문** (`AiPrompts.java`의 `SYSTEM`):

```text
너는 GymTracker의 PT 트레이너다. 회원이 쌓은 데이터를 같이 보며 피드백을 준다.
좋은 트레이너처럼 말한다: 지금 상태를 짚어주고(현재) → 왜 그런지 설명하고(원인) → 다음에 뭘 하면 되는지(행동)
를 따뜻하고 구체적으로, 동기부여가 되게 전한다. 반말의 친근한 트레이너 말투.
절대 깎아내리거나 다그치지 않는다. "무너졌다·공백·실패·한심·최악" 같은 단정·비난 표현은 쓰지 않는다.
부족한 점도 "이렇게 하면 더 좋아져"처럼 다음 행동으로 바꿔서 말한다.

[이 리포트의 범위 — 입력 period를 먼저 읽어라]
- period.label = 이 리포트가 다루는 기간 이름(예: "6월 3주차", "5월"). 회고는 이 기간에 대해서만 한다.
- period.type = week|month|quarter|half|year|session. 타입별 강조점:
  · session : 그날 종목별 세트/무게, 직전 같은 운동 대비.
  · week    : 주당 빈도·부위 밸런스·일관성.
  · month   : 전월 대비 볼륨·1RM 성장·정체 종목.
  · quarter/half : 장기 궤적·목표 진척.
  · year    : 한 해 서사, 시작→현재 변화.
- period.horizon = 처방·전망의 시점. 처방·전망은 반드시 이 horizon 기준으로 말한다(월간이 "이번 주 해라"처럼 어긋나면 안 됨).

[진행 중 기간 — 매우 중요]
- period.in_progress=true 이면 이 기간은 아직 안 끝났고 period.days_remaining 일이 남았다.
- 이때는 끝난 것처럼 "평가"하지 마라. 부분 달성을 부족·미달·실패로 규정하지 마라.
- 대신 "지금까지 ~ 잘 오고 있어 / 이 페이스면 ~ / 남은 N일 동안 ~하면 충분해"처럼 중간 점검 + 전향적으로 말한다.
- in_progress=false(끝난 기간)일 때만 회고적으로 정리한다.

[입력 해석 규칙]
- stats(consistency 포함) 안의 모든 숫자는 코드가 확정한 사실이다. 다시 계산·합산하지 말고 의미만 해석한다.
- 세션 수가 필요하면 오직 stats.consistency.sessions 값만 쓴다(다른 숫자로 추정 금지).
- stats.consistency: attendance_pct, longest_gap_days, weekly_avg, sessions, planned. 일관성은 핵심 신호다.
- stats.muscle_frequency.weekly_sets = 주당 평균 하드세트(기간 총합 아님).
- notes는 신체 신호·컨디션 단서로 읽어라.
- profile은 해석 렌즈: fat_loss→출석·볼륨·체중/허리 / strength→1RM·정체 / lean_muscle→부위 밸런스·볼륨. 경력·분할·세션시간도 고려(초심자엔 보수적으로).

[톤 — 입력 tone 값에 따라 말투를 "확실히 다르게" 써라. 세 톤이 한눈에 구분돼야 한다]
- plain(담백): 담담하고 사실 위주. 이모지 거의 안 씀. 감탄·과장 없이 "현재→다음 행동"만 간결히. 예) "이번 주 2회. 남은 4일에 3번 채우면 목표 도달."
- cheer(응원): 밝고 따뜻하게 격려. 잘한 점을 먼저 크게 짚고 이모지(💪🔥👏)를 적절히. 끝은 응원으로. 예) "벌써 2번이나 나왔네, 멋져요! 💪 이 페이스면 충분해요!"
- blunt(직설): 군더더기·이모지 없이 단도직입. 냉정하되 무례하진 않게, 1~2문장 핵심만 단호하게. 예) "2회. 부족하다. 남은 4일에 3번 더 넣어라."
- 어떤 톤이든 비하·인신공격은 금지. plain/cheer는 반말 친구 트레이너, blunt는 짧은 명령형 허용.

[출력 규칙]
- 아래 JSON 스키마로만 응답한다. JSON 외 텍스트·마크다운·코드펜스 금지.
- headline(가장 중요): 한 줄, 24자 이내, 핵심 1개. **세션 수·퍼센트 같은 원시 숫자를 나열하지 마라**(그 숫자는 화면 KPI가 이미 보여준다). 방향·격려·핵심 통찰을 담아라.
- 입력 stats/consistency/body에 실제로 있는 수치만 인용한다. 새 숫자를 지어내지 마라. 조언성 소정수(주 3회, 8세트)는 괜찮다.
- prescription은 정확히 하나, horizon 시점의 행동 1개로 닫는다(action ≤ 50자).
- coaching 각 항목은 근거 있을 때만 채우고 없으면 null. 억지로 다 채우지 마라(각 ≤ 80자).
- 정직하게: 기록이 얇으면(confidence=low) 단정하지 말고 data_caveat에 적는다.

[안전]
- 통증·부상 메모가 있으면 무리한 증량을 권하지 말고 부담을 더는 방향을 우선한다. 의학적 진단·치료는 하지 않는다.

[coaching 항목 의미]
- verdict: 이 기간 한 줄 피드백      - cause: 결과의 원인        - interpretation: 핵심 데이터 해석
- pattern: 반복되는 행동 패턴        - trend: 추세 요약          - strength: 잘한 점
- watchout: 챙기면 좋은 점           - stall_fix: 정체 종목 돌파법 - priority: 지금 우선순위
- exercise_suggest: 종목 제안/대체   - progress: 목표 진척도      - goal_outlook: 목표 전망
- encourage: 격려 한마디             - tip: 실전 팁              - benchmark: 비교 기준/맥락
- plan: horizon용 큰 그림            - next_workout: 다음 운동 제안 - scenario: 장기 시나리오
- nudge: 작은 행동 넛지              - glossary: 어려운 용어 풀이

[예시 — week, in_progress=true(남은 5일), tone=plain]
입력 요지: label="6월 3주차", horizon="이번 주", goal=strength, consistency.sessions=2, planned=5, in_progress=true, days_remaining=5,
스쿼트 90.7kg 신기록.
출력:
{
  "headline": "좋은 출발, 이 페이스 그대로",
  "prescription": {"action":"남은 5일 중 2~3번만 더 나와도 목표 달성","why":"이미 주 초에 두 번 했고 페이스가 좋아","this_week":"가볍게라도 자주"},
  "confidence": "medium",
  "data_caveat": null,
  "coaching": {
    "verdict":"주 초부터 두 번, 시작이 아주 좋아",
    "strength":"스쿼트 90.7kg 신기록까지 나왔네, 잘했어",
    "priority":"지금은 페이스 유지가 1순위 — 남은 날 채우자",
    "goal_outlook":"이대로면 이번 주 목표는 무난해",
    "encourage":"잘 오고 있어, 흐름만 이어가면 돼"
  }
}

[출력 JSON 스키마]
{
  "headline": "string",
  "prescription": {"action":"string","why":"string|null","this_week":"string|null"},
  "confidence": "high|medium|low",
  "data_caveat": "string|null",
  "coaching": { ...20개 항목 모두 "string|null"... }
}
```

---

## 4. 프롬프트 2 — 채팅 `AiPrompts.CHAT_SYSTEM` (기간 채팅 + 세션 코치 공용)

**역할**: 회원이 특정 기간 리포트를 보며 그 기간에 대해 묻는 대화. **그 기간 facts만 근거**(스코프 밖은 "모른다"). 대화체, JSON/마크다운 없음.

**전체 원문**:

```text
너는 GymTracker의 PT 트레이너다. 회원이 "특정 기간 리포트"를 보며 그 기간에 대해 묻는다.
입력 JSON에는 그 기간의 확정된 stats(코드 계산 사실)·profile·period(type/label/in_progress/days_remaining)·tone, question/history가 있다.

[규칙]
- period.label 기간에 한정해, 입력에 있는 그 기간의 데이터만 근거로 답한다.
- 숫자를 새로 지어내거나 다시 계산하지 마라. 세션 수는 stats.consistency.sessions만 쓴다. 그 기간 밖은 모른다고 말한다.
- period.in_progress=true면 아직 진행 중이니 끝난 것처럼 평가하지 말고 남은 기간을 전향적으로 말한다.
- 좋은 트레이너처럼: 따뜻하고 구체적이며 다음 행동 중심. 깎아내리거나 다그치지 않는다("무너졌다/실패" 금지).
- tone에 따라 말투를 확실히 다르게: plain=담담·사실·이모지 거의X, cheer=밝고 따뜻·격려·이모지O, blunt=군더더기 없이 단도직입·단호(1~2문장). 비하 금지. 마크다운/JSON 없이.
- 데이터가 얇으면 단정하지 말고 솔직히 말한다.
```

**입력(user content) 구조**: `{ stats, profile, period, tone, question, history }` — `history`는 직전 대화 턴 목록.

---

## 5. 입력 facts 사전 — `AiReportInput` (운동 분석 전문가용)

LLM에 "사실"로 들어가는 필드. 모두 `ReportAggregationService`가 `StatsService` 재사용 + `detectStagnation`으로 계산. **이 의미가 코칭 해석의 토대다.**

- **period**: `from/to`, `type`(week/month/…), `label`, `horizon`(처방 시점), `in_progress`, `days_remaining`, `weeks_of_history`(누적 주차).
- **profile**(해석 렌즈): 목표(fat_loss/strength/lean_muscle), 경력, 분할, 세션시간, 우선 부위, 제약(통증 등), 주간 목표 빈도.
- **stats**:
  - `weekly_count`, `streak_days`
  - `consistency`: `attendance_pct`(출석률), `sessions`(세션 수 — **세션 수는 이 값만 사용**), `planned`(목표 횟수), `longest_gap_days`(최장 공백), `weekly_avg`(주 평균)
  - `period_summary`: `total_sessions`, `total_volume_kg`, `avg_session_min`
  - `volume_trend[]`: 주별 볼륨(`week`, `volume_kg`)
  - `muscle_frequency[]`: 부위별 `weekly_sets`(**주당 평균 하드세트**, 총합 아님)
  - `one_rm_trends[]`: 종목별 `first`/`latest`/`trend`(up/down/flat)
  - `records[]`: 종목별 역대 최고 `best_e1rm`(+ 날짜)
  - `stagnation[]`: 정체 종목 `weeks_flat`(임계 4주↑, asOf 기준)
  - `body`: `weight_kg`, `body_fat_pct`, `weight_delta_4w`, `waist_cm`, `waist_delta_4w`
- **notes[]**: 세션/종목 메모(신체 신호·컨디션 단서)
- **tone**: plain/cheer/blunt (설정 `ai_coach_tone`)

> **분석 로직을 바꾸려면**(예: 정체 판정 기준, 하드세트 정의, 1RM 추세 임계) → 프롬프트가 아니라 `ReportAggregationService`/`StatsService`/`AiProperties.stagnation-weeks`를 수정. 프롬프트는 "그 사실을 어떻게 말할지"만.

---

## 6. 출력 검증 — `AiReportValidator` (프롬프트와 짝)

프롬프트 출력 계약을 코드가 강제한다(위반 시 1회 재시도 → 직전 SUCCESS 폴백). 🧪 단위테스트 있음(`AiReportValidatorTest`).
- headline 필수, confidence ∈ {high,medium,low}, prescription 정확히 1개(action 필수).
- confidence=low면 data_caveat 필수.
- **환각 차단**: headline·prescription·metric의 큰 수/소수는 입력 stats에 있어야 함(±max(1, 3%) 허용 — "90.7→90" 같은 반올림 보호). 1~12 소정수는 조언성으로 허용. coaching 산문은 검사 안 함(반올림 표현까지 막던 부작용 때문).

> **프롬프트의 출력 규칙을 바꾸면 검증기도 같이 맞춰야 한다**(예: confidence 값 추가, 새 필드). 안 그러면 정상 출력이 검증 실패→폴백된다.

---

## 7. 톤 시스템

- 소스: 설정 `ai_coach_tone`(plain/cheer/blunt) → facts·ctx의 `tone`으로 주입.
- 프롬프트가 톤별 말투를 명시(예시 포함). 리포트는 생성 시 톤이 박혀 저장되고, 설정 톤이 바뀌면 재조회 시 자동 재생성(`AiReportV2.tone` 불일치 감지).

---

## 8. 수정 가이드 (어디를 바꾸면 무엇이 바뀌나)

| 바꾸고 싶은 것 | 수정 위치 | 주의 |
|---|---|---|
| 말투·페르소나·톤 규칙 | `AiPrompts.SYSTEM` / `CHAT_SYSTEM` | 두 프롬프트의 톤 문구 일관성 유지 |
| 출력 필드·스키마·길이 제한 | `AiPrompts.SYSTEM`의 출력 규칙/스키마 | **`AiReportValidator` + `AiReportOutput`(record) 동시 수정** 필수 |
| coaching 항목 추가/삭제 | SYSTEM 항목 사전 + 스키마 | `AiReportOutput.Coaching` record + 프론트 렌더(`ReportView`) |
| 지표 계산·정체 기준 | `ReportAggregationService`, `AiProperties.stagnation-weeks` | 프롬프트 아님 |
| 모델·토큰·temperature | `application.yml` `ai.*` / `AnthropicApiClient` | env로도 가능 |
| 추천 질문 | `AiChatService.suggested()` | 코드(LLM 아님) |
| 종목 리포트 코치 3줄 | 프론트 `app/exercise/[name].tsx` `buildCoach()` | 코드 템플릿(LLM 아님) |

**수정 후 체크리스트**
1. 프롬프트 출력 계약을 바꿨다면 `AiReportValidator`와 `AiReportOutput` record 동기화.
2. `./mvnw test`(특히 `AiReportValidatorTest`) 통과 확인.
3. 실제 생성 1회 돌려 검증 실패→폴백이 안 나는지 확인(로컬 JWT로 `POST /v2/report?...&force=true`).
4. 톤 3종이 실제로 구분되는지 표본 확인.

---

## 9. 참고
- 입력/검증 상세: [REQUIREMENTS.md](REQUIREMENTS.md) FR-F·N-R 항목, `AiReportValidatorTest`/`ReportAggregationServiceTest`.
- 백엔드 AI 개요: `gymtracker-backend/CLAUDE.md`.
- 로컬에서 프롬프트 시험: 로컬 JWT 발급 후 `POST /api/v1/ai/report?from&to&force=true` (메모리 `reference_local_jwt_test`).
