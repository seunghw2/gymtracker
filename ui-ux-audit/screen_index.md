# GymTracker 화면 인벤토리 (screen_index)

## 프레임워크 · 실행 방법 · 캡처 가능 여부

- **프레임워크**: Expo (React Native) + expo-router 파일 기반 라우팅. 상태관리는 zustand(persist + AsyncStorage).
- **루트 위치**: `/Users/shstl/Claude Code/gymtracker`
- **실행 방법**: 백엔드(Spring Boot, 포트 8080) → cloudflared named tunnel `https://api.hammerslog.trade`. 프론트는 `npx expo start --tunnel`(8081)로 띄우고 폰의 Expo Go로 접속.
- **캡처 가능 여부 — 자동 캡처 불가**:
  - react-native-web가 설치되어 있지 않아 `expo web`으로 브라우저 캡처가 불가능하다.
  - 앱은 폰 Expo Go로만 구동 중이라, 30개 화면을 자동 네비게이션하며 스크린샷할 인프라가 없다.
  - 인증 게이트(`app/_layout.tsx`: 미로그인 시 `/(auth)/login`으로 강제) + 온보딩 게이트(`app/(tabs)/index.tsx`: `!onboarded` 시 `/onboarding`으로 강제) + 데이터 의존(운동 기록·AI 프로필) 때문에 무인 진입 자체가 막힌다.
  - 따라서 본 감사에서 화면 "캡처"는 자동 불가 → 실제 화면 `.tsx` 코드(StyleSheet 수치·구조·텍스트·hitSlop/height·색상)를 Read한 코드 기반 인벤토리로 대체한다.
  - 실제 이미지로 존재하는 것은 사용자 제공 1장뿐: `ui-ux-audit/screenshots/provided_goalsheet_pullup.png` (종목 바텀시트, Pull Up).

## 라우팅 · 게이트 · 핵심 흐름

- **루트 스택**(`app/_layout.tsx`): `(auth)`, `(tabs)`, 그리고 모달/스택 화면들. `workout`·`exercise-add`·`template-edit`은 `presentation: 'modal'`. `onboarding`은 `gestureEnabled:false`(스와이프 닫기 차단).
- **인증 게이트**: `status === 'guest'` → `/(auth)/login` replace. 로그인 완료(`authenticated`) → `/(tabs)` replace. `status === 'unknown'` 동안 전체화면 스피너.
- **온보딩 게이트**: 홈 진입 시 `onboarded` 아니면 `/onboarding` replace.
- **탭 바**(`app/(tabs)/_layout.tsx`, 커스텀 `CustomTabBar`): 홈 / 기록 / 종목 / 리포트 / Chat / 설정 (6탭).
- **전역 오버레이**: 진행 중 운동이 있고 운동 탭이 아닐 때 `ActiveWorkoutBanner`가 탭 바 위에 도킹. `RestTimerEngine`(UI 없는 휴식 타이머 엔진)은 항상 탑재.
- **핵심 사용자 흐름**: 로그인 → (최초)온보딩 → 홈 → (종목 선택/템플릿) → 운동 기록(workout 모달, 세트 입력·휴식 타이머) → 기록(calendar)·리포트 확인 → AI 브리핑/코치(ai/*, chat).
- **AI 섹션**(`app/ai/*`)은 별도 `_layout`이 없으며 루트 스택 화면으로 동작. 브리핑 카드·코치 배너·아카이브·설정에서 `router.push`로 진입(뒤로가기 있음). `(tabs)/chat`는 일반 AI 코치 대화 탭, `app/ai/index`는 주간 분석 '애널리스트' 허브로 역할이 다름.

## 화면 표 (탭)

| ID | Screen Name | Route | File Path | Main Purpose | 비고 |
|----|-------------|-------|-----------|--------------|------|
| S01 | 홈 | /(tabs) | app/(tabs)/index.tsx | 오늘 행동 필요 종목·진행 요약·종목 리스트 3블록 | tab / 온보딩 게이트 |
| S02 | 기록(캘린더) | /(tabs)/calendar | app/(tabs)/calendar.tsx | 연속일수·운동 세션 타임라인 | tab |
| S03 | 종목 허브 | /(tabs)/exercises | app/(tabs)/exercises.tsx | 그룹별 종목 목록·종목 상세 진입·추가 | tab |
| S04 | 리포트 | /(tabs)/reports | app/(tabs)/reports.tsx | 주간 리포트(ReportScreen, showBack=false 래퍼) | tab |
| S05 | Chat(AI 코치) | /(tabs)/chat | app/(tabs)/chat.tsx | 일반 AI 코치 대화·주간 체크인 | tab |
| S06 | 설정 | /(tabs)/settings | app/(tabs)/settings.tsx | 계정·목표·휴식·리마인더·트레이너 등 진입 허브 | tab |

## 화면 표 (스택)

| ID | Screen Name | Route | File Path | Main Purpose | 비고 |
|----|-------------|-------|-----------|--------------|------|
| S07 | 로그인 | /(auth)/login | app/(auth)/login.tsx | Google/Kakao 소셜 로그인 | stack / 인증 게이트 |
| S08 | 온보딩 | /onboarding | app/onboarding.tsx | 5단계(목표 등) 최초 설정 | stack / gestureEnabled:false |
| S09 | 종목 상세(리포트) | /exercise/[name] | app/exercise/[name].tsx | 1RM/최대무게/볼륨/빈도/렙 지표 차트·코치 | stack(dynamic) |
| S10 | 목표 설정 | /goals | app/goals.tsx | 체중·체지방·기본 휴식·단위(kg) | stack(설정 하위) |
| S11 | 계정 | /account | app/account.tsx | 프로필·로그아웃·회원탈퇴 | stack(설정 하위) |
| S12 | 부위 편집 | /body-parts | app/body-parts.tsx | 운동 부위 목록 편집·정렬 | stack(설정 하위) |
| S13 | 커스텀 운동 | /custom-exercises | app/custom-exercises.tsx | 직접 등록한 종목 편집·삭제 | stack(설정 하위) |
| S14 | 종목별 휴식시간 | /exercise-rest | app/exercise-rest.tsx | 기본 휴식+종목별 오버라이드 | stack(설정 하위) |
| S15 | 운동 리마인더 | /workout-reminder | app/workout-reminder.tsx | 며칠 쉬면 알림·일수·시각 | stack(설정 하위) |
| S16 | 담당 트레이너 | /trainer | app/trainer.tsx | AI 코치 말투/캐릭터 선택 | stack / 온보딩 시 진입도 |
| S17 | 템플릿 목록 | /templates | app/templates.tsx | 저장 템플릿으로 운동 시작·새 템플릿 | stack |
| S18 | AI 애널리스트 허브 | /ai | app/ai/index.tsx | 주간 분석 브리핑 허브 | stack |
| S19 | AI 채팅(리포트 맥락) | /ai/chat | app/ai/chat.tsx | 특정 기간 리포트에 대한 대화 | stack |
| S20 | AI 인테이크 | /ai/intake | app/ai/intake.tsx | AI 프로필 설문(목표·부위·통증) | stack |
| S21 | AI 상세 리포트(단건) | /ai/report | app/ai/report.tsx | 상세 리포트 단건 뷰 | stack |
| S22 | AI 리포트(상세 진입) | /ai/reports | app/ai/reports.tsx | 리포트(ReportScreen, showBack 래퍼) | stack |
| S23 | AI 지난 기록 | /ai/archive | app/ai/archive.tsx | 지난 리포트 아카이브 | stack |
| S24 | 대화 상세 | /chat/[conversationId] | app/chat/[conversationId].tsx | 종목/리포트 시드 대화 스레드 | stack(dynamic) |

## 화면 표 (모달)

| ID | Screen Name | Route | File Path | Main Purpose | 비고 |
|----|-------------|-------|-----------|--------------|------|
| S25 | 운동 중(세트 입력) | /workout | app/workout.tsx | 진행 중 운동·세트 입력·휴식·종목 추가 | modal |
| S26 | 종목 추가 | /exercise-add | app/exercise-add.tsx | 종목/브랜드 검색·다중 선택 추가 | modal |
| S27 | 템플릿 편집 | /template-edit | app/template-edit.tsx | 템플릿 이름·종목 구성 편집 | modal |

## 주요 바텀시트 / 모달 컴포넌트

| ID | Sheet Name | File Path | Main Purpose | 비고 |
|----|------------|-----------|--------------|------|
| C01 | 종목 진행도 시트 | components/ExerciseGoalSheet.tsx | 역할·오늘 목표·증량 조건·신뢰도 | sheet(Modal slide) · 제공 스크린샷 |
| C02 | 날짜 선택 시트 | components/DatePickerSheet.tsx | 운동 날짜 선택 | sheet(Modal slide) |
| C03 | 기준 RM 시트 | components/RmBasisSheet.tsx | 1RM 기준 RM 선택 | sheet(Modal slide) |
| C04 | 기간 지정 시트 | components/RangePickerSheet.tsx | 리포트 기간 범위 선택 | sheet(Modal slide) |
| C05 | 세션 미리보기 시트 | components/SessionPreviewSheet.tsx | 세션 읽기전용 미리보기(캘린더·운동 공용) | sheet(Modal slide) |
| C06 | 종목 수정 시트 | components/ExerciseEditSheet.tsx | 종목 이름/속성 수정 | sheet(Modal slide) |
| C07 | 정렬 시트 | components/exercises/SortSheet.tsx | 종목 정렬(담은순/최근/무게/이름/부위) | sheet(공용 BottomSheet) |
| C08 | 공용 바텀시트 | components/ui/BottomSheet.tsx | Modal+scrim+sheet 공통 래퍼 | sheet 베이스 |
| C09 | 숫자패드 | components/NumPad.tsx | 세트 무게/횟수 입력 키패드 | 인라인 컴포넌트(워크아웃) |

## 비화면/지원 컴포넌트(참고)

- `components/ActiveWorkoutBanner.tsx` — 전역 "운동 중" 도킹 배너
- `components/RestTimerEngine.tsx` — UI 없는 휴식 타이머 엔진(사운드·알림·자동종료)
- `components/CustomTabBar.tsx` — 커스텀 탭 바
- `components/NotificationBridge.tsx` — 인앱 알림 폴링 브리지
- `components/AiBriefingCard.tsx` / `components/WorkoutCoachBanner.tsx` — AI 진입 카드/배너(홈·워크아웃)
- `components/HeaderTimerButton.tsx`, `components/RulerPicker.tsx`, `components/OneRMChart.tsx`, `components/SessionCard.tsx`, `components/SettingIcon.tsx`, `components/BriefingLoading.tsx`, `components/report/*`, `components/exercises/ExerciseCard.tsx`·`ExerciseGrid.tsx`, `components/ReportView.tsx`
