# GymTracker · 화면 흐름도 (Screen Flow)

앱의 화면과 **"무엇을 누르면 어디로/무엇이 되는지"**를 한눈에 보는 인터랙션 맵.
GitHub가 아래 Mermaid를 자동 렌더한다. (코드 기반: `app/` 라우팅 + `components/CustomTabBar`)

```mermaid
flowchart TD
  login["로그인<br/>(카카오·애플·구글)"] -->|로그인 성공| brief

  subgraph TAB["하단 탭바"]
    brief["브리핑<br/>(홈·주간 브리핑)"]
    record["기록<br/>(타임라인·월별 캘린더)"]
    exercises["종목<br/>(그룹별 카드)"]
    reports["리포트<br/>(주/월/분기/반기)"]
    chat["AI 코치<br/>(주간 대화)"]
  end

  %% 브리핑
  brief -->|⚙️ 헤더| settings["설정"]
  brief -->|브리핑 카드 탭| reportDetail["리포트 상세<br/>(뒤로가기 있음)"]
  brief -->|운동하러 가기| workout["운동 세션<br/>(모달)"]

  %% 기록
  record -->|타임라인 ↔ 월별| record
  record -->|세션 카드 탭| preview["세션 미리보기 시트"]
  record -->|편집| workout

  %% 종목
  exercises -->|그룹 pill 전환<br/>기본·이번주·지난주·커스텀| exercises
  exercises -->|+ 그룹추가| exercises
  exercises -->|정렬 ⌄| sortSheet["정렬 시트<br/>담은순·최근·무게·이름·부위"]
  exercises -->|편집 → ≡ 드래그 / ✕ 삭제| exercises
  exercises -->|종목 카드 탭| exDetail["종목 상세<br/>(1RM·히스토리·차트)"]
  exercises -->|+ 종목 추가하기| exAdd["운동 추가 피커"]

  %% 리포트
  reports -->|기간탭 주/월/분기/반기| reports
  reports -->|주차 칩 선택| reports
  reports -->|서브탭 브리핑·데이터·코치| reports
  reports -->|↻ 다시 받기| reports
  reports -->|처방·질문하기| chatDetail

  %% AI 코치
  chat -->|스타터 칩<br/>이번주 어땠어·정체 풀기·루틴 짜줘| chatDetail["대화 상세<br/>(스트리밍 답변)"]
  chat -->|최근 대화 탭| chatDetail
  chat -->|✎ FAB| chatDetail

  %% 설정 하위
  settings -->|목표 설정| goals["목표<br/>(체중·체지방·휴식·단위)"]
  settings -->|종목별 휴식| exRest["휴식시간"]
  settings -->|부위 관리| bodyParts["부위 관리"]
  settings -->|커스텀 운동| customEx["커스텀 운동"]
  settings -->|운동 리마인더| reminder["리마인더"]
  settings -->|계정| account["계정"]

  %% 운동 세션
  workout -->|세트 무게·횟수 입력 → 완료| workout
  workout -->|운동 추가| exAdd
  workout -->|세트 완료 시| rest["휴식 타이머<br/>(하단 바·사운드·알림)"]

  classDef tab fill:#2a1113,stroke:#ff3b30,color:#fff;
  classDef detail fill:#161618,stroke:#2c2c2e,color:#fff;
  class brief,record,exercises,reports,chat tab;
  class reportDetail,exDetail,exAdd,chatDetail,goals,exRest,bodyParts,customEx,reminder,account,workout,preview,sortSheet,settings detail;
```

## 화면별 주요 인터랙션

| 화면 | 누르는 것 | 결과 |
|---|---|---|
| **브리핑** | 브리핑 카드 / ⚙️ / 운동하러 가기 | 리포트 상세 / 설정 / 운동 세션 |
| **기록** | 타임라인·월별 토글 / 세션 카드 / 편집 | 보기 전환 / 미리보기 시트 / 과거 세션 편집 |
| **종목** | 그룹 pill / 카드 탭 / + 종목추가 / 편집 / 정렬 ⌄ | 그룹 전환 / 종목 상세 / 추가 피커 / ≡·✕ 모드 / 정렬 시트 |
| **리포트** | 기간탭 / 주차 칩 / 서브탭 / 다시받기 / 처방 | 기간·주차·탭 전환 / 재생성 / 코치 대화 |
| **AI 코치** | 스타터 칩 / 대화 / ✎ | 대화 상세(스트리밍) / 새 대화 |
| **설정** | 각 행 | 목표·휴식·부위·커스텀·리마인더·계정 페이지 |
| **운동 세션** | 세트 입력·완료 / 운동 추가 | 기록 저장 / 추가 피커 / 휴식 타이머 |

## 색 규칙 (CARBON)
- **레드** = 액션·네비(활성 탭·주요 버튼·링크)
- **초록** = 양호(↑ 증가·PR), **주황** = 주의(정체·부족)
- 파랑(info)은 미사용

> 참고: 정식 스크린샷은 `docs/screenshots/`(작업 중). 인터랙티브 클릭 프로토타입이 필요하면 이 흐름도를 기반으로 `prototype.html`을 생성할 수 있다.
