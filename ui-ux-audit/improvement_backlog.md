# GymTracker 개선 백로그 (개발 착수용)

> `final_priority_report.md`를 개발자가 바로 착수 가능한 작업 단위로 변환했다.
> 파일 경로·심볼은 실제 코드(`app/`, `components/`, `constants/`) 기준으로 검증했다.
> 난이도: S(한 화면·수치/색 치환) / M(컴포넌트 구조·로직 추가) / L(여러 화면·신규 흐름).
>
> 색 토큰 참조: `constants/colors.ts` — `SEM.brand=#FF3B30`, `SEM.onBrand=#FFFFFF`, `SEM.good=#2BD96A`, `SEM.danger=#FF453A`, `ink3=#8E8E93`, `ink4=#48484A`, `surface1~3`, `line2=#2C2C2E`.

---

## P0 — 즉시

### 1. 홈에 "운동 시작" 진입점 추가
- 문제: 홈에서 오늘 뭘 할지 3초 만에 판단한 직후 손 갈 곳이 화면 안에 없다. 운동 시작은 오직 하단 탭바 play 버튼뿐 — 가장 자주 하는 동작이 화면 밖이라 매 세션 마찰.
- 수정 방향: 홈 `index.tsx` 스크롤 상단(또는 헤더 직하)에 고정 "운동 시작" Primary 버튼(빨강 `SEM.brand`/흰글자, height 52) 1개 추가. 추가로 블록1 각 행(`ActionRow`)에 "오늘 운동에 추가" 보조 액션(우측 chevron/+칩)을 붙여 한 탭으로 세션에 넣을 수 있게 한다.
- 예상 수정 파일: `app/(tabs)/index.tsx`(블록1 렌더 영역·스크롤 상단), 블록1 행 컴포넌트(184행 부근 `ActionRow`), 세션 시작 핸들러(workout 라우트 진입)
- Acceptance Criteria:
  - 홈 첫 화면에 탭바 외 "운동 시작" 버튼이 1개 이상 보인다
  - 그 버튼 탭 시 빈(또는 추천 프리필) 운동 세션 입력 화면으로 바로 진입한다
  - 버튼 라벨은 흰색, 배경은 `SEM.brand`(빨강)다
- 난이도: M

### 2. 빨강 버튼 위 글자색 전부 흰색으로
- 문제: 빨강(`#FF3B30`) 버튼 위 글자가 검정/짙은초록(`#000000`·`#06210F`·`#0A1F12`)이라 대비 약 3.0:1. 완료·시작·저장·추가·NumPad'다음'·세트 완료 체크마크 전반. 헬스장 밝은 환경에서 빠른 탭 시 라벨이 묻힌다(WCAG 1.4.3 위반).
- 수정 방향: 빨강 배경 위 모든 텍스트색을 `#FFFFFF`(=`SEM.onBrand`)로 일괄 치환. 구체 대상: `NumPad.tsx` `nextText:'#000000'`→흰색(8번 항목과 함께), `workout.styles.ts`의 `startBtnText '#000000'`, `tagAddBtnText '#000000'`, `finishBtnText '#000000'`, `stickyFinishText '#06210F'`, `gymAddBtnText '#06210F'`, `templateStartText '#000000'`, `detailSaveText '#000000'`, `rmPickTextOn '#000000'`, `restSegTextOn '#0A1F12'`, `checkMark '#0A1F12'`(빨강 원 위).
- 예상 수정 파일: `app/workout.styles.ts`(위 심볼들), `components/NumPad.tsx:nextText`
- Acceptance Criteria:
  - 빨강 배경 버튼/배지/체크마크의 글자색이 모두 흰색이다
  - `workout.styles.ts`에서 `#000000`/`#06210F`/`#0A1F12` 글자색 잔존이 없다(검은 배경 위 의도된 경우 제외)
  - 세트 완료 시 빨강 체크 원 안의 마크가 흰색으로 보인다
- 난이도: S

### 3. NumPad 위계 역전 수정 (완료 ↔ 다음 색 스왑)
- 문제: 세트 입력에서 가장 빈번한 주동작 "완료"가 회색(`doneBtn '#3A3A3C'`)이고, 보조 "다음"이 빨강(`nextBtn '#FF3B30'`)이라 시선이 보조 동작으로 끌려 오인 탭이 잦다.
- 수정 방향: `NumPad.tsx`에서 색 역할 스왑 — `doneBtn` 배경을 `SEM.brand`(또는 `SEM.good`), `doneText`는 흰색 유지. `nextBtn` 배경은 중립 회색(`#3A3A3C`/`line2`), `nextText`는 흰색(2번과 동시 처리). disabled 상태(`nextDisabled`)는 그대로 둔다.
- 예상 수정 파일: `components/NumPad.tsx`(styles: `doneBtn`, `nextBtn`, `nextText`, `doneText`)
- Acceptance Criteria:
  - "완료"가 빨강(주동작 강조), "다음"이 중립 회색이다
  - 두 버튼 글자색 모두 흰색이다
  - "다음"이 비활성일 때 시각적으로 눌리지 않음이 유지된다
- 난이도: S

### 4. 운동중 세트 완료 체크 타깃 키우기
- 문제: 완료 체크 원이 27×27px이고 `checkBtn`에 hitSlop이 없어, 운동중 가장 빈번한 단일 동작에서 땀·장갑 상황 미스탭이 잦다(WCAG 2.5.5 44pt 미달).
- 수정 방향: `workout.styles.ts` `checkCircle` 27→32(`borderRadius` 14→16), `checkBtn` `paddingVertical` 8→12. `workout.tsx`의 완료 `Pressable`에 `hitSlop={8}` 추가. 가능하면 세트 행 전체 탭으로 완료되게 확장(보조).
- 예상 수정 파일: `app/workout.styles.ts:checkCircle`,`checkBtn`; `app/workout.tsx`(완료 체크 `Pressable`)
- Acceptance Criteria:
  - 체크 원이 32×32px로 커진다
  - 완료 Pressable에 hitSlop 8 이상이 적용된다
  - 체크 주변 여백(가장자리)을 눌러도 완료 토글이 동작한다
- 난이도: S

### 5. "온보딩 초기화" 라벨-동작 불일치 버그 수정
- 문제: 설정의 "온보딩 초기화"가 `deleteAiProfile()`로 AI 인테이크 프로필만 지우고 `onboarded` 게이트는 안 건드린다. 사용자가 재온보딩을 기대하지만 실제로 온보딩이 다시 뜨지 않거나, 동작이 라벨과 어긋난다.
- 수정 방향: `settings.tsx:handleResetOnboarding`에서 `onboarded` 플래그(zustand persist / AsyncStorage)도 함께 리셋해 실제로 온보딩이 처음부터 뜨게 하거나, 그게 의도가 아니라면 라벨/문구를 실제 동작("AI 프로필 삭제")에 맞게 바꾼다.
- 예상 수정 파일: `app/(tabs)/settings.tsx:handleResetOnboarding`(57행), `lib/api.ts:deleteAiProfile`, onboarded 상태 store(`store/useAuthStore.ts` 또는 useStore)
- Acceptance Criteria:
  - "초기화" 실행 후 앱이 실제로 온보딩 시작 상태로 돌아간다(또는 라벨이 동작과 일치한다)
  - Alert 안내 문구와 실제 결과가 일치한다
  - 재온보딩 후 코어 값이 새로 설정 가능하다
- 난이도: S

### 6. 설정의 개발자 도구·미구현 행 일반 사용자에게 숨김
- 문제: "개발자 도구 (온보딩 초기화)"가 일반 행으로 노출되고, "개인정보처리방침"은 탭하면 "준비 중이에요" Alert만 뜬다. 데이터 파괴 위험 노출 + 미완성 인상.
- 수정 방향: `settings.tsx`에서 개발자 도구 행을 `__DEV__` 가드로 감싸 릴리스 빌드에서 숨긴다. "준비 중" Alert만 띄우는 미구현 행(개인정보처리방침 등)은 실제 링크 연결 전까지 숨기거나 비활성 처리.
- 예상 수정 파일: `app/(tabs)/settings.tsx`(115행 `개인정보처리방침` Row, 116행 `개발자 도구` Row)
- Acceptance Criteria:
  - 릴리스(비-`__DEV__`)에서 개발자 도구 행이 보이지 않는다
  - "준비 중" Alert만 뜨는 행이 출시 화면에서 제거/비활성된다
  - 개발 빌드에서는 개발자 도구가 그대로 접근 가능하다
- 난이도: S

---

## P1 — 다음 배포

### 7. 온보딩 코어값(목적·주간횟수·증량폭) 편집 화면 연결
- 문제: 온보딩에서 정한 목적·주간 횟수·증량폭을 이후 바꿀 화면이 전무해 코어 값이 영구 고정된다. 헤비유저 1명 타겟인데 본인 설정을 못 바꾼다.
- 수정 방향: 설정 "목표 설정"(`goals.tsx`)에 온보딩 값 편집 섹션을 통합하거나, 설정에서 온보딩 재진입 경로를 연결한다.
- 예상 수정 파일: `app/goals.tsx`, `app/onboarding.tsx`, `app/(tabs)/settings.tsx`
- Acceptance Criteria:
  - 설정 경로로 목적·주간횟수·증량폭을 수정·저장할 수 있다
  - 변경값이 홈/운동중 목표 계산에 반영된다
  - 앱 재시작 후에도 변경값이 유지된다
- 난이도: M

### 8. 흐린 보조 텍스트 토큰 레벨 일괄 상향
- 문제: `#6A6A6E`·`#48484A`·`#555`·`#6E6E73` 보조 텍스트가 대비 약 2.0~3.0:1로 광범위. 헬스장에서 직전기록·휴식·힌트가 안 보인다.
- 수정 방향: 정보 텍스트 하한을 `ink3(#8E8E93)`로, placeholder/빈상태도 상향. `workout.styles.ts` `prevHint '#6E6E73'`, `setNumText '#AEAEB2'` 등 상위 빈도부터 토큰 치환.
- 예상 수정 파일: `constants/colors.ts`(토큰 확인), `app/workout.styles.ts`(`prevHint` 등), 캘린더/홈 보조 텍스트
- Acceptance Criteria: 정보성 텍스트 색이 `#8E8E93` 이상으로 통일 / placeholder 외 `#48484A`·`#555` 정보 텍스트 잔존 없음 / 직전기록 힌트가 밝은 환경에서 읽힌다
- 난이도: S

### 9. 종목 추가 모달 "최근·즐겨찾기" 우선 노출
- 문제: 부위→장비→브랜드→목록 4탭 드릴다운이라 같은 5~8종목 반복하는 헤비유저가 매 운동 재탐색.
- 수정 방향: 추가 모달 첫 화면을 "최근·즐겨찾기"로, 부위 드릴다운은 보조 탭/하단으로.
- 예상 수정 파일: `app/workout.tsx`(종목추가 모달), `constants/exercises.ts`
- Acceptance Criteria: 모달 첫 화면에 최근/즐겨찾기가 먼저 보인다 / 자주 쓰는 종목을 1~2탭으로 추가 / 부위 드릴다운도 접근 가능
- 난이도: M

### 10. 아이콘 전용 Pressable accessibilityLabel + 벡터화
- 문제: ⚙️💬🗑️✕⌫‹› 아이콘 Pressable에 라벨/Role이 없어 스크린리더가 글리프를 읽고, 이모지가 CARBON 톤과 충돌.
- 수정 방향: 네비/액션 아이콘을 벡터로 통일하고 `accessibilityLabel`/`accessibilityRole="button"` 일괄 추가.
- 예상 수정 파일: `app/(tabs)/settings.tsx`, `app/workout.tsx`, `components/NumPad.tsx`(`⌫`)
- Acceptance Criteria: 주요 아이콘 버튼에 라벨 부여 / 이모지 글리프가 벡터/통일 톤으로 교체 / VoiceOver가 의미 있는 라벨을 읽는다
- 난이도: M

### 11. 노력도 4버튼 자동 팝업 지연 제거
- 문제: 마지막 세트 후 0.8초 지연 자동 팝업이 다음 세트 흐름을 가로챈다(드롭세트 타이밍 어긋남).
- 수정 방향: 지연 자동 팝업 제거, 인라인 노력도 칩 또는 종료 요약에서 모아 받기.
- 예상 수정 파일: `app/workout.tsx`(노력도 팝업 트리거 로직)
- Acceptance Criteria: 세트 완료 후 자동 모달이 흐름을 막지 않는다 / 노력도는 인라인 또는 종료시 입력 / 미입력해도 다음 세트 진행 가능
- 난이도: M

### 12. workout raw hex → 디자인 토큰 치환 + iOS 블루 잔존 제거
- 문제: `workout.styles.ts`가 전부 raw hex(`#1C1C1E`·`#2C2C2E`·`#8E8E93`)라 홈→운동중 진입 시 톤이 달라지고, iOS 블루(`#0A84FF`)가 `tagDoneBtn`·`tagChipOn`·`tagEditBtn`·`timeBadge` 등 4곳 잔존.
- 수정 방향: 상위 빈도 hex를 `surface1~3`/`line2`/`ink3` 토큰으로 치환, iOS 블루 ON 상태를 전부 `ACCENT`로.
- 예상 수정 파일: `app/workout.styles.ts`(`tagDoneBtn`,`tagChipOn`,`tagEditBtn`,`timeBadge` 등)
- Acceptance Criteria: 핵심 hex가 colors.ts 토큰 참조로 교체 / `#0A84FF` 잔존 없음 / 홈과 운동중 표면 톤이 일치
- 난이도: M

### 13. 작은 탭 타깃 hitSlop 일괄 추가
- 문제: 삭제 28px·그룹삭제 X 18px·비교기록행 36px·캘린더 navBtn 등 44pt 미만 + hitSlop 없음.
- 수정 방향: 해당 Pressable에 `hitSlop={8~10}` 일괄 추가 + 삭제류 `accessibilityLabel`.
- 예상 수정 파일: `app/workout.tsx`, `app/(tabs)/calendar.tsx`, `components/ExerciseGoalSheet.tsx`
- Acceptance Criteria: 작은 버튼들에 hitSlop 8 이상 / 삭제 버튼에 라벨 / 44pt 영역 미달 타깃 미스탭 감소
- 난이도: S

### 14. 리포트 CTA가 곧장 세션 생성
- 문제: 리포트 "오늘 운동 시작하기"가 빈 세션을 안 만들고 시작 관문으로만 떨어진다.
- 수정 방향: CTA가 곧장 빈(또는 추천 프리필) 세션을 만들어 한 탭 입력 진입.
- 예상 수정 파일: `components/report/ReportScreen.tsx`(CTA 핸들러)
- Acceptance Criteria: CTA 탭 시 세션이 생성되고 입력 화면 진입 / 추가 관문 1단계 제거 / 프리필이 있으면 채워진 상태로 시작
- 난이도: S

### 15. 빨강 의미 충돌 분리 (완료=초록 / 빨강=삭제·취소)
- 문제: 빨강이 액센트(완료/시작)와 위험(삭제/취소)에 동시 사용돼 색=의미 1:1이 붕괴.
- 수정 방향: 완료류는 `SEM.good` 초록 검토, 빨강은 삭제/취소 전용으로 정리(브랜드 정체성과 충돌 시 final_priority_report 결론대로 단계적용).
- 예상 수정 파일: `app/workout.styles.ts`, `components/NumPad.tsx`, `constants/colors.ts`
- Acceptance Criteria: 한 의미(완료/위험)에 한 색 / 삭제·취소가 시각적으로 구분 / 사용자 학습 부담 감소
- 난이도: M

---

## P2 — 개선 (핵심만)

### 16. 홈 블록1 증량/정체 2그룹 분리
- 문제: 증량(전진)과 정체를 "오늘 확인 필요" 한 라벨로 묶어 이분이 흐려진다.
- 수정 방향: "↑ 증량 가능" / "⚠ 정체 점검" 2그룹 헤더로 시각 분리.
- 예상 수정 파일: `app/(tabs)/index.tsx`(블록1, 91/101행 `actionTitle`)
- Acceptance Criteria: 증량과 정체가 별도 그룹 / 헤더로 구분 / 행 라벨이 그룹과 일치
- 난이도: S

### 17. 홈 헤더에 실데이터 한 줄 요약 승격
- 문제: 헤더 타이틀이 13px muted 인사말뿐 — 3초 요약 약함.
- 수정 방향: 헤더 좌측에 큰 제목/오늘 추천 한 줄("오늘 추천: 가슴·삼두") 승격.
- 예상 수정 파일: `app/(tabs)/index.tsx`(헤더)
- Acceptance Criteria: 헤더에 실데이터 요약 1줄 / 큰 제목 크기(`TYPE.display/headline`) / 첫 진입 맥락 즉시 파악
- 난이도: S

### 18. 정체 카드/시트에 "같은 무게로 추가" 원탭 출구
- 문제: 정체 시 텍스트만 있고 행동 출구가 없다.
- 수정 방향: 정체 카드/시트에 원탭 "같은 무게로 운동 추가" 액션.
- 예상 수정 파일: `app/(tabs)/index.tsx`, `components/ExerciseGoalSheet.tsx`
- Acceptance Criteria: 정체 항목에 원탭 추가 액션 / 같은 무게가 프리필 / 한 탭으로 세션 반영
- 난이도: M

### 19. comparability low면 홈에서도 단정 톤다운
- 문제: 홈 카드는 comparability low여도 `todayTarget`을 단정 노출(시트와 불일치).
- 수정 방향: 시트와 동일하게 low면 "기준 쌓는 중"으로 톤다운.
- 예상 수정 파일: `app/(tabs)/index.tsx`(194/229행 `todayTarget` 렌더)
- Acceptance Criteria: low일 때 단정 표현 미노출 / 홈·시트 톤 일치 / 비현실 목표 단정 금지 철칙 준수
- 난이도: S

### 20. 캘린더 보조 텍스트/탭 타깃 보강
- 문제: `restText`/`emptyText` `#48484A`(약 2.0:1)+11.5px, navBtn 탭 작음.
- 수정 방향: 색 `#8E8E93`, 폰트 12px↑, navBtn `hitSlop 8` + `accessibilityLabel`.
- 예상 수정 파일: `app/(tabs)/calendar.tsx`
- Acceptance Criteria: 보조 텍스트 색 상향+폰트 12px↑ / navBtn hitSlop 8 / navBtn 라벨 부여
- 난이도: S

---

## P3 — 장기 (핵심만)

### 21. 공통 PrimaryButton 신설·강제
- 문제: 빨강 CTA 높이 50/52/54·radius 12~14·텍스트색 제각각.
- 수정 방향: `components/ui/PrimaryButton`(height 52/radius 14/흰글자/`SEM.brand`) 신설 후 전역 치환.
- 예상 수정 파일: `components/ui/`(신규), 각 CTA 사용처
- Acceptance Criteria: 공통 버튼 컴포넌트 존재 / 주요 CTA가 이를 사용 / 높이·radius·글자색 통일
- 난이도: M

### 22. 종목상세 과부하 접이식 정리
- 문제: 5지표+5기간+히트맵+코치+체크리스트 한 스크롤 적층.
- 수정 방향: 상단 1RM 숫자+추세 차트만, 나머지 접이식 섹션.
- 예상 수정 파일: `app/exercise/[name].tsx`
- Acceptance Criteria: 첫 화면에 핵심 지표만 / 부가 섹션 접힘 기본 / 스크롤 길이 단축
- 난이도: M

### 23. 폰트 Dynamic Type 정책 + 최소 폰트 12px
- 문제: 고정 px + 미대응으로 시스템 확대 시 10~11px 캡션 붕괴.
- 수정 방향: `allowFontScaling` 정책 수립, 최소 폰트 11→12px.
- 예상 수정 파일: 전역(공통 Text 래퍼 검토), `constants/colors.ts`(TYPE)
- Acceptance Criteria: 최소 폰트 12px / 시스템 확대 시 레이아웃 깨짐 없음 / 정책 문서화
- 난이도: L

### 24. 로그인 브랜드 요소 정비
- 문제: 로고 💪 이모지, Google 아이콘이 글자 "G".
- 수정 방향: 워드마크/벡터 로고, 공식 G 로고, 버튼 height 56 통일.
- 예상 수정 파일: `app/(auth)/login.tsx`
- Acceptance Criteria: 이모지 로고 제거 / 공식 Google 로고 / 버튼 높이 통일
- 난이도: M
