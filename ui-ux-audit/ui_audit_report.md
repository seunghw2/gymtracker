# GymTracker UI 감사 리포트 (코드 기반)

작성: UI Expert 관점 / 근거 = 각 화면 `.tsx` StyleSheet 실제 수치(폰트px·padding·height·색상). 추상 평가 금지, 수치 근거.

## 캡처 제약 (반드시 명시)
- `react-native-web` 미설치 → `expo web` 브라우저 캡처 불가.
- 앱은 폰 Expo Go로만 구동 → 인증·온보딩 게이트·데이터 의존으로 30개 화면 자동 네비게이션/스크린샷 불가.
- 따라서 화면 "캡처"는 자동 불가 → 실제 `.tsx` 코드 인벤토리로 대체.
- 실제 이미지로 존재하는 것은 사용자 제공 1장: `ui-ux-audit/screenshots/provided_goalsheet_pullup.png` (종목 바텀시트, Pull Up).

## 디자인 시스템 메모 (점수 기준선)
- 토큰 정의는 충실: `constants/colors.ts`에 SEM/TYPE/SPACE/RADIUS/WEIGHT 완비. 액센트=레드 `#FF3B30`, 배경=블랙. 의미색 분리(good 초록 / bad 주황 / warn 노랑 / danger 레드).
- 문제: 토큰이 정의돼 있으나 **화면이 토큰을 안 쓰고 하드코딩**한 곳이 많음(특히 `app/workout.styles.ts`는 전부 raw hex, TYPE 스케일 무시). 일관성 약점의 근원.
- 터치 타깃: HIG 44pt / Material 48dp 기준. 본 앱 핵심 입력부는 이 기준 미달이 반복됨(아래 화면별 근거).

---

# 핵심 화면 (12개 심층)

## S25 운동 중 / 세트 입력 — `app/workout.tsx` + `app/workout.styles.ts`
제품 철칙(입력 최소화·헤비유저 1명)의 심장. 가장 자주 보는 화면이지만 **밀도·터치영역·색 의미 충돌**이 가장 심함.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 6 | 종목명 18px/700, 오늘목표 배너 15px/800은 좋으나 세트행·이전기록·휴식구분선이 비슷한 무게로 경쟁 |
| 여백·밀도 | 4 | `setRow` paddingVertical 10, `marginBottom: 4`로 행 간격 극소. 행 사이 휴식 구분선(`marginVertical:1.5`)까지 끼어 밀집 |
| 정렬 | 7 | 컬럼 flex(0.5/1.4/1/0.6) 일관. 헤더-행 정렬 일치 |
| 폰트 가독성 | 7 | `fieldText` 18px/600 tabular-nums 좋음. `prevHint` 10px(#6E6E73)는 헬스장 환경에서 너무 작음 |
| 버튼·터치영역 | 3 | `checkBtn` paddingVertical 8 + `checkCircle` 27×27 → 실측 ~40px 이하. `setNum` hitSlop 6만. `fieldBtn` paddingVertical 9 → 약 38px. **장갑 낀 손·땀 상황에서 미스탭 위험** |
| 컬러 | 4 | **레드 액센트와 빨강 위험색 혼용** — 완료 체크 `#FF3B30`(액센트)인데 같은 빨강이 삭제/취소에도 쓰임. 휴식바·시간기반은 파랑(`#0A84FF`, #13233A)으로 톤 이탈 |
| 아이콘 | 6 | ✓/🏆 명확. ⌫ 등 텍스트 글리프 의존 |
| 카드·리스트 | 6 | `exerciseCard` radius16 padding16 무난. 카드 marginBottom16 대비 내부 행 밀도가 불균형 |
| CTA 명확성 | 6 | `stickyFinish` paddingV8 → 약 34px로 작음. 완료 버튼이 상단에만 있어 스크롤 중 사라짐 |
| 정보 우선순위 | 6 | 오늘 목표 배너 1줄은 좋은 결정. 다만 메모칸·이전기록·휴식시간이 항상 노출돼 노이즈 |
| HIG/Material | 4 | 터치타깃 44/48 미달 다발. 완료=빨강이 iOS 컨벤션(파괴=빨강)과 충돌 |

좋은 점
- 오늘 목표 "오늘 {todayTarget}" + "남은 N회/✓달성" 1줄 배너(`wgStyles.banner`)는 철칙(3초 이해)에 정확히 부합.
- 자체 숫자패드(`NumPad`)로 키보드 점프 제거, READY_TO_INCREASE 종목 다음무게 자동 프리필.
- tabular-nums 일관 적용으로 숫자 정렬 흔들림 없음.

문제점 (사용자 불편 중심)
1. 완료 체크가 27px 원 + 작은 hitSlop → 세트 완료(가장 빈번한 동작)에서 미스탭. 헬스장에서 짜증 직결.
2. 세트행 간격 4px + 휴식 구분선이 행마다 끼어 "벽 같은" 밀집. 빠르게 스캔하기 어렵다.
3. 완료(빨강)·삭제(빨강)·휴식(파랑) 색 의미가 섞임 → 빨강이 "성공"인지 "위험"인지 학습 부담.

개선안 (구체 수치)
- `checkCircle` 27→32, `checkBtn` paddingVertical 8→12, 행 전체 onPress 영역으로 확장(현재 체크만 탭). 미스탭 즉시 감소.
- `setRow` marginBottom 4→8, 휴식 구분선은 done 세트에서만 노출(미완료 행 사이 라인 제거)로 밀도 완화.
- 완료 체크 색을 액센트 레드 대신 `SEM.good`(#2BD96A)로 변경 → 빨강은 삭제/취소 전용. 색=의미 1:1 확립.
- `stickyFinish` paddingVertical 8→12(높이 ~44), 그리고 화면 하단 고정 "완료" 미러 버튼 추가(스크롤 무관 접근).
- `prevHint` 10→11.5px, 색 #6E6E73→#8E8E93(SEM.ink3).

---

## S01 홈 (대시보드) — `app/(tabs)/index.tsx`
"3초 안에 오늘 뭐 할지"의 1차 관문. 구조(블록1 확인필요 / 블록2 이번주 / 블록3 종목)는 우수.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 8 | actionTitle 15/800, pcardName 15/800, badge 11/800로 계층 분명 |
| 여백·밀도 | 7 | body padding18, 카드 marginBottom 10~16 균형. greet 13px는 약함 |
| 정렬 | 8 | goalRow/volRow width 고정(40/48)으로 라벨-값 정렬 안정 |
| 폰트 가독성 | 8 | pcardToday 14.5/800, 본문 lineHeight 17~20 적절 |
| 버튼·터치영역 | 6 | gearIcon hitSlop10 + fontSize22 → 경계선. moreToggle paddingV10은 OK. chatFab 52×52 양호 |
| 컬러 | 8 | 단계별 색(ready 초록/stall 주황/baseline 회색) 의미 일관 |
| 아이콘 | 5 | 헤더 ⚙️·💬 이모지 의존 → OS별 렌더 편차, 톤 불일치 |
| 카드·리스트 | 8 | pcard/card radius14~16, border 일관 |
| CTA 명확성 | 7 | setupCta height52 양호하나 평소엔 ActionRow 탭→시트가 주 동선 |
| 정보 우선순위 | 9 | "오늘 확인 필요"를 최상단 + 빈 상태 카피("따로 챙길 종목 없어요")까지 — 철칙 충실 |
| HIG/Material | 7 | 대체로 부합. 헤더 좌측 빈 `<View/>` + 우측 기어만 → 타이틀 부재로 허전 |

좋은 점: 블록1을 "확인 필요"라는 중립 프레이밍으로 묶고 빈 상태도 안심 카피. 비현실적 목표 단정 회피 철칙에 부합.
문제점: (1) 헤더에 화면 타이틀이 없어 첫 진입 맥락 약함. (2) 이모지 아이콘이 톤(CARBON)과 이질. (3) greet 13px/muted는 거의 안 보임.
개선안: 헤더 좌측 빈 View 자리에 "홈"/날짜 강조(예: greet를 17px로 올려 헤더로 승격). ⚙️·💬를 `SettingIcon` 같은 벡터로 교체. ActionRow는 이미 좋음 — 유지.

---

## S03 종목 허브 — `app/(tabs)/exercises.tsx`
그룹 펠릿 + 정렬 + 그리드. 정보 구조는 강하나 컨트롤바가 혼란.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 7 | title 30/800 강한 헤더. pellet 15/700 |
| 여백·밀도 | 7 | pelletBar height52, ctrlbar paddingH22 |
| 정렬 | 7 | 펠릿 가로 스크롤 gap8 일관 |
| 폰트 가독성 | 7 | pelletT 15px OK. ctrlL 13px 약함 |
| 버튼·터치영역 | 6 | pellet paddingV9 → ~38px, 경계선. editBtn paddingV6 작음, hitSlop8 보강 |
| 컬러 | 7 | pelletOn #2a2a34(중립) — 활성 강조가 약함(액센트 미사용) |
| 아이콘 | 5 | 🔒✏️↕️🗑️ 이모지 의존(BottomSheet 메뉴) |
| 카드·리스트 | 7 | ExerciseGrid 위임. 부위 dotColor 의미 부여 |
| CTA 명확성 | 6 | "+ 그룹추가"·"편집" 텍스트 링크. ctrlbar에 라벨+정렬버튼+편집이 한 줄에 몰림 |
| 정보 우선순위 | 6 | `ctrlL`(그룹·정렬 라벨)과 sortBtn이 같은 정렬 텍스트를 중복 표기 |
| HIG/Material | 6 | 활성 펠릿이 브랜드색이 아니라 중립 회색 → 선택 상태 약함 |

문제점: (1) 컨트롤바 정렬 라벨 중복(`ctrlL`에 sortLabel, 바로 옆 sortBtn에도 sortLabel). (2) 활성 펠릿 `#2a2a34`는 비활성 `#16161a`와 명도차 작아 선택 구분 약함.
개선안: `pelletOn` 배경을 `ACCENT_TINT`(rgba 255,59,48,0.15) + 텍스트 흰색으로 → 선택 명확. `ctrlL`에서 정렬 라벨 제거(그룹명만), 정렬은 sortBtn에만. pellet paddingVertical 9→11.

---

## S09 종목 상세(리포트) — `app/exercise/[name].tsx`
지표 토글(1RM/최대무게/볼륨/빈도/렙) + SVG 차트 + 코치. 기능 풍부하나 정보량 과다.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 6 | 큰 숫자 헤더 의도는 좋으나 5지표+5기간 토글 두 줄이 상단 점유 |
| 여백·밀도 | 5 | 차트 폭 `W = 화면-28-24` 고정 계산, 토글·히트맵·체크리스트·코치가 길게 누적 |
| 정렬 | 7 | SVG 좌표 일관 |
| 폰트 가독성 | 6 | 차트 라벨 SvgText 의존, 작을 가능성 |
| 버튼·터치영역 | 6 | METRICS/PERIODS 칩 다수 → 칩 크기 작으면 오탭 |
| 컬러 | 7 | SEM 사용 |
| 아이콘 | 6 | 별(핀) 등 |
| 카드·리스트 | 6 | 카드 다수 적층 |
| CTA 명확성 | 6 | "AI 업데이트"·코치 채팅 진입 다수 |
| 정보 우선순위 | 5 | 한 화면에 지표차트+히트맵+렙맥스+체크리스트+코치 — 헤비유저라도 스캔 부담 |
| HIG/Material | 6 | 토글 칩 밀집 |

문제점: 한 스크롤에 너무 많은 모듈. 핵심(1RM 추세)과 부가(체크리스트·코치)가 평면 나열.
개선안: 상단 = 큰 1RM 숫자 + 추세 차트만 우선 노출, 히트맵/렙맥스/코치는 접이식 섹션. 지표 토글은 5개를 가로 스크롤 세그먼트로(현재 두 줄 점유 완화).

---

## C01 종목 진행도 시트 — `components/ExerciseGoalSheet.tsx`
유일한 실제 스크린샷 존재. 정보 위계가 가장 잘 잡힌 컴포넌트.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 9 | name 22/800 → todayBox(21/800 레드틴트) → Section 라벨 11/800 uppercase. 깔끔한 위계 |
| 여백·밀도 | 8 | sheet padding20, section marginTop20 — 호흡 좋음 |
| 정렬 | 8 | cmpRow flex+chevron 정렬 안정 |
| 폰트 가독성 | 8 | todayTarget 21/lineHeight27, bodyText 14/21 |
| 버튼·터치영역 | 7 | cmpRow paddingV8(비교기록 탭) ~36px 약간 작음. closeBtn height50 양호 |
| 컬러 | 8 | todayBox 레드틴트로 "오늘 할 일" 강조. compChip 신뢰도색(good/warn/muted) 의미 일치 |
| 아이콘 | 7 | ⚠/› 절제된 사용 |
| 카드·리스트 | 8 | Section 패턴 재사용 일관 |
| CTA 명확성 | 7 | closeBtn 명확. 역할 변경 "변경" 링크는 작음(13.5px) |
| 정보 우선순위 | 9 | 오늘 목표를 헤더 바로 아래 최상단 — 철칙 정확 |
| HIG/Material | 8 | backdrop 0.6, slide, handle 36×4 — 표준 바텀시트 |

좋은 점: "오늘 목표 → 근거(단계·비교·다음단계)" 순서가 제품 철칙과 정확히 일치. 비교 기록 탭→세션 미리보기 연결 우수.
문제점: cmpRow 탭 영역 36px로 작고, 탭 가능(chevron)과 불가(전체PR)가 시각적으로 구분 안 됨. 역할 "변경" 링크 작음.
개선안: cmpRow paddingVertical 8→11. 탭 가능 행에만 미묘한 chevron+pressed opacity 유지(이미 일부 적용), 불가 행은 배경 살짝 다르게. "변경" 링크를 칩 형태로 키움.

---

## C09 숫자패드 — `components/NumPad.tsx`
세트 입력 핵심 입력기. 구조 좋으나 색·키 높이가 아쉬움.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 7 | 좌 그리드 / 우 기능열 분리 명확 |
| 여백·밀도 | 7 | key margin3, paddingBottom22(홈 인디케이터 회피) |
| 정렬 | 8 | 3×4 그리드 + side 96px 일관 |
| 폰트 가독성 | 8 | keyText 23/600 tabular-nums — 큼직 |
| 버튼·터치영역 | 6 | `KEY_H=48` 자체는 OK(48dp). 단 margin3 제외 실효 높이 48, 폭은 화면4분할로 충분 |
| 컬러 | 4 | **"다음" 버튼이 빨강(#FF3B30)인데 텍스트가 검정(#000)** → 빨강=위험 컨벤션과 충돌하고, 검정 텍스트는 빨강 위 대비 부족. "완료"는 회색(#3A3A3C)으로 오히려 약함 |
| 아이콘 | 6 | ⌫ −/＋ 글리프 |
| 카드·리스트 | 7 | wrap #1C1C1E 일관 |
| CTA 명확성 | 5 | 주 동작 "완료"가 회색, 보조 "다음"이 빨강 → **위계 역전** |
| HIG/Material | 6 | 키 높이 48 OK. 색 위계만 문제 |

문제점: 가장 중요한 "완료"가 가장 약한 회색, "다음"이 가장 강한 빨강. 사용자가 시선을 "다음"으로 뺏김. 빨강 위 검정텍스트 대비 미흡.
개선안: "완료"=액센트 레드(흰 텍스트), "다음"=중립 회색(`#3A3A3C`, 흰 텍스트)로 **역할 스왑**. 또는 완료=`SEM.good` 초록. nextText 색 #000→#fff.

---

## S08 온보딩 — `app/onboarding.tsx`
5단계. 시각적으로 가장 완성도 높은 화면 중 하나.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 9 | q 25/800 lineHeight33, stepNo 12 액센트, sub 13.5 muted — 표준 온보딩 위계 |
| 여백·밀도 | 8 | body padding22, opt marginBottom11 |
| 정렬 | 8 | opt 좌 텍스트 / 우 tick 일관 |
| 폰트 가독성 | 8 | freqNum 70/800까지 — 빈도 단계 한눈에 |
| 버튼·터치영역 | 8 | opt padding17, freqBtn 56×56, cta height54 — 모두 44+ 충족 |
| 컬러 | 8 | optSel 레드틴트+테두리, progDone 액센트 |
| 아이콘 | 7 | tick 라디오 도형(이모지 아님) — 좋음 |
| 카드·리스트 | 8 | ruleCard·seg 일관 |
| CTA 명확성 | 8 | footer cta height54, valid 아닐 때 ghost 처리 명확 |
| 정보 우선순위 | 8 | 단계별 1질문 — 입력 최소화 철칙 |
| HIG/Material | 8 | 진행바·이전/다음 표준 |

좋은 점: 터치타깃·위계·진행 표시가 앱 내 최고 수준. tick을 이모지 아닌 도형으로.
문제점: 사소 — segBtnT 12.5px 트리거 라벨이 3분할에서 좁을 수 있음. incNote/freqHint 색 #555는 약함.
개선안: 보조 텍스트 #555→`SEM.muted`(#6A6A6A) 통일. 큰 이슈 없음.

---

## S02 기록(캘린더) — `app/(tabs)/calendar.tsx`
타임라인/월별 토글. 타임라인 레일 디자인 우수.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 8 | header 28/800, bucket 12/700, tlTitle 15/700 |
| 여백·밀도 | 7 | content padding20, tlBody paddingBottom16 |
| 정렬 | 8 | rail width12 + railLine 일관, 그리드 cell 14.28% |
| 폰트 가독성 | 7 | tlStats 12 tabular, restText 11.5(#48484A) 너무 어두움 |
| 버튼·터치영역 | 6 | tlRow 전체 탭 가능(좋음). navBtn padding8 작음. dayCircle 36×36 → 셀 자체는 aspectRatio1로 큼 |
| 컬러 | 8 | streakBadge·dot 액센트, dayCircleToday 액센트 명확 |
| 아이콘 | 6 | 🔥 이모지(스트릭) |
| 카드·리스트 | 8 | 타임라인 레일+휴식갭 표기 — 정보 밀도 우수 |
| CTA 명확성 | 7 | 세그먼트 토글 명확(segmentBtnOn 액센트) |
| 정보 우선순위 | 8 | 연속일수·휴식갭으로 "꾸준함" 가시화 — 헤비유저 동기 |
| HIG/Material | 7 | 표준 캘린더 |

좋은 점: 휴식 갭("3/1–3/4 휴식 3일")을 타임라인에 명시 — 헤비유저 패턴 인식에 유용. 스켈레톤으로 레이아웃 점프 방지.
문제점: restText/emptyText #48484A는 거의 비가시. navBtn(월 이동) 탭 영역 작음.
개선안: restText 색 #48484A→#6A6A6A. navBtn padding8→12(또는 hitSlop10). dayCircleSelected(흰테두리)와 today(빨강)가 겹칠 때 우선순위 규칙 명시.

---

## S04 리포트 — `components/report/ReportScreen.tsx`
"다음 주 액션"을 히어로로. 결정론 단일 소스. 정보 우선순위 모범.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 9 | actionCard(히어로) → Card 모듈 순. actionText 16/700 lineHeight23 |
| 여백·밀도 | 8 | actionCard padding18, Card 간 marginBottom14 |
| 정렬 | 8 | actionNum 26원 + 텍스트 flex |
| 폰트 가독성 | 8 | actionText 16, attBig 28/800 tabular |
| 버튼·터치영역 | 7 | actionCta paddingV13(~44), cta paddingV13 — 충족 |
| 컬러 | 8 | action 레드 히어로, stall warn, 출석 tone(good/warn/bad) 의미 일관 |
| 아이콘 | 7 | 📭 빈상태 1회, 나머지 배지(↑＋●) 텍스트 — 절제 |
| 카드·리스트 | 8 | Card 컴포넌트 재사용 |
| CTA 명확성 | 9 | "오늘 운동 시작하기 ›" 액션 카드 하단 고정 — 행동 연결 |
| 정보 우선순위 | 9 | 액션 먼저, 근거(변화·정체·출석·볼륨) 뒤 — 철칙 충실 |
| HIG/Material | 8 | 표준 |

좋은 점: 리포트인데 "다음 행동"을 가장 크게 + CTA 직결. 빈 상태도 "운동하러 가기" CTA. 앱에서 정보 우선순위가 가장 잘 잡힌 화면.
문제점: bandHint 11px(RT.ink3) 작음. Card가 많아질수록 스크롤 길어짐(현재는 양호).
개선안: 거의 없음. 유지 권장. 굳이면 actionRow numberOfLines 미설정 → 긴 액션 텍스트 줄바꿈 확인.

---

## S06 설정 — `app/(tabs)/settings.tsx`
표준 iOS 설정 패턴. 안정적.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 8 | header 28/800, sectionHd 11/800 uppercase |
| 여백·밀도 | 8 | settingRow minHeight48, group radius14 |
| 정렬 | 8 | iconChip 30 + flex 라벨 + 우측 value/chev |
| 폰트 가독성 | 8 | rowLabel 15/600, rowSub 11.5 |
| 버튼·터치영역 | 8 | settingRow minHeight48 — 기준 충족 |
| 컬러 | 8 | Switch trackColor SEM.brand 일관 |
| 아이콘 | 8 | SettingIcon 벡터 사용(이모지 아님) — 앱 내 모범 |
| 카드·리스트 | 8 | 그룹 카드 + divider 표준 |
| CTA 명확성 | 7 | "개발자 도구(온보딩 초기화)"가 일반 정보 섹션에 노출 — 사용자에게 위험 |
| 정보 우선순위 | 7 | 섹션 분류 명확. 단 "개인정보처리방침=준비 중" 더미 노출 |
| HIG/Material | 8 | 표준 설정 |

좋은 점: SettingIcon 벡터 + minHeight48로 터치·아이콘 모두 모범. 다른 화면이 따라야 할 기준.
문제점: 개발자 도구가 일반 사용자에게 노출(데이터 초기화 위험). 미구현("준비 중") 행 노출.
개선안: 개발자 도구 섹션은 `__DEV__` 가드 또는 별도 숨김. 미구현 행은 출시 전 숨김.

---

## S10 목표 설정 — `app/goals.tsx`
짧고 깔끔. 폼 패턴 양호.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 8 | navTitle 17/800, sectionHd 11/800 |
| 여백·밀도 | 8 | content padding16, frow paddingV12 |
| 정렬 | 8 | 라벨 좌 / finput 우정렬(textAlign right) tabular |
| 폰트 가독성 | 8 | finput 18/800 |
| 버튼·터치영역 | 7 | frow paddingV12(~44 미만, 입력은 TextInput로 보강). save paddingV14 |
| 컬러 | 8 | Switch SEM.brand, save SEM.brand |
| 아이콘 | 7 | 없음(텍스트) — 무난 |
| 카드·리스트 | 8 | group divider 일관 |
| CTA 명확성 | 8 | save 버튼 명확 |
| 정보 우선순위 | 8 | 체중·체지방·휴식·단위 묶음 적절 |
| HIG/Material | 8 | 표준 폼 |

좋은 점: 설정과 동일 토큰(SEM)으로 일관. 입력 우정렬+tabular로 폼 정돈.
문제점: navBack "‹ 설정" 텍스트 링크 hitSlop10은 OK이나 fontSize16. 큰 이슈 없음.
개선안: 거의 없음. frow 자체를 탭하면 TextInput 포커스되도록(현재 input만) 하면 입력 편의 향상.

---

## S07 로그인 — `app/(auth)/login.tsx`
첫인상. 단순하나 약점 존재.

| 항목 | 점수 | 근거 |
|---|---|---|
| 시각적 계층 | 7 | title 32/700, subtitle 14 |
| 여백·밀도 | 7 | container padding24, brand marginBottom48 |
| 정렬 | 8 | 중앙 정렬 brand + 버튼 스택 |
| 폰트 가독성 | 7 | btnText 16/700 |
| 버튼·터치영역 | 8 | apple 56, google/kakao padding18(~54) — 충족 |
| 컬러 | 7 | kakao #FEE500, google 흰색 — 브랜드 정확. 단 앱 자체 CARBON 레드는 로그인에 부재 |
| 아이콘 | 4 | **logo 💪 이모지, googleIcon "G" 텍스트** — 브랜드 약함. 실제 Google 로고 가이드 위반 소지 |
| 카드·리스트 | 7 | 버튼 radius14 일관 |
| CTA 명확성 | 7 | 소셜 버튼 명확 |
| 정보 우선순위 | 7 | 로그인만 — 단순 |
| HIG/Material | 6 | Apple 버튼은 공식 컴포넌트(좋음). Google "G" 텍스트는 비표준 |

문제점: 로고가 이모지 💪, Google 아이콘이 글자 "G" → 첫인상 신뢰도/브랜드 약함. 카카오 로딩만 인디케이터, 구글은 disabled opacity만.
개선안: 💪→앱 워드마크/벡터 로고. googleIcon "G"→공식 G 로고 SVG/이미지. 버튼 height를 56으로 통일(현재 apple만 56, 나머지 padding18).

---

# 나머지 화면 (간략 묶음 평가)

근거: 핵심 화면들과 동일 토큰·패턴을 공유. 별도 정독 대신 라우팅/역할 기준 그룹 평가.

## 설정 하위 페이지군 (S11 계정 / S12 부위 / S13 커스텀운동 / S14 종목별휴식 / S15 리마인더 / S16 트레이너)
- 공통: `app/(tabs)/settings.tsx`의 Row/group 패턴을 재사용할 가능성이 높아 **터치타깃·divider·SEM 색은 안정적**으로 추정.
- 위험: 목록 편집(부위/커스텀운동) 화면은 삭제·정렬 액션이 이모지 글리프(✏️↕️🗑️)에 의존하는 경향(허브와 동일) → 벡터 아이콘 통일 필요.
- 권고: 모든 설정 하위 페이지의 헤더 back을 `goals.tsx`의 "‹ 설정" 패턴으로 통일(hitSlop10 이상).

## AI 섹션 (S18 애널리스트허브 / S19,S24 채팅 / S20 인테이크 / S21 리포트단건 / S22 리포트 / S23 아카이브)
- 별도 `AI` 토큰(`colors.ts`)으로 레드 액센트 통일됨 — 톤 일관성은 확보.
- 위험: 채팅 말풍선·칩(AI.bubble/chipBg)의 대비, 인테이크 설문의 선택 칩 터치타깃이 온보딩(opt padding17)만큼 큰지 미검증 → 동일 기준(44+) 적용 권고.
- 역할 혼선: `(tabs)/chat`(일반 코치)와 `ai/index`(주간 애널리스트)가 사용자에겐 둘 다 "AI"로 보임 → 진입점 라벨/아이콘 차별화 필요(정보 우선순위 약점).

## 모달 (S25 운동중[위 심층] / S26 종목추가 / S27 템플릿편집)
- S26 종목추가: `workout.styles.ts`의 modal/exItem/addBar 재사용. exItem padding18·addBar paddingBottom28 → 터치 양호. 다만 다단계(부위→장비→브랜드→목록) back 라벨이 텍스트 "← 뒤로"로 작음.
- S27 템플릿편집: 동일 스타일군 추정, 별도 위험 낮음.

## 기타 바텀시트 (C02~C08)
- `BottomSheet`(C08) 공통 래퍼 + scrim 0.6 + handle — 표준화돼 있어 시트류 일관성은 양호.
- C05 세션 미리보기는 캘린더·시트 공용 — 재사용 좋음.

---

# 공통 UI 강점 / 약점 요약

## 강점
1. 정보 우선순위 설계가 강함: 홈/리포트/종목시트 모두 "오늘 할 행동 → 근거" 순서. 제품 철칙(3초 이해·입력 최소화)이 구조에 반영됨.
2. 디자인 토큰(SEM/TYPE/SPACE/RADIUS)이 정의돼 있고, 설정·목표·온보딩은 토큰을 잘 따름 → 그 화면들은 일관성 높음.
3. 의미색 분리 의도(good 초록 / bad 주황 / warn 노랑 / danger 레드)가 토큰 레벨에 명문화.
4. 자체 숫자패드·세션미리보기·BottomSheet 등 핵심 컴포넌트 재사용 구조.
5. tabular-nums 광범위 적용으로 숫자 UI 흔들림 없음.

## 약점
1. 터치타깃 미달이 핵심 입력부에 집중: 운동중 완료체크(~27px+작은 hitSlop), 비교기록행(36px), 여러 텍스트 링크(paddingV6) → HIG44/Material48 미달.
2. 색=의미 1:1 붕괴: 레드가 액센트(완료·시작)와 위험(삭제·취소)에 동시 사용. NumPad는 주동작(완료)이 회색, 보조(다음)가 레드로 위계 역전.
3. 토큰 무시 하드코딩: `workout.styles.ts` 전체가 raw hex + TYPE 스케일 미사용 → 가장 중요한 화면이 디자인 시스템 밖.
4. 이모지 아이콘 남용: 홈 ⚙️💬, 로그인 💪·"G", 그룹메뉴 ✏️🗑️ → OS별 렌더 편차·CARBON 톤 이탈. (반례: settings의 SettingIcon 벡터는 모범)
5. 약한 보조 텍스트 색(#48484A·#555·#6E6E73)이 본문 곁에 자주 노출 → 헬스장 밝은 환경 가독성 저하.
6. 운동중 화면 밀도 과다: 세트행 4px 간격 + 행마다 휴식구분선 → 빠른 스캔 방해.

---

# 가장 심각한 UI 문제 8 (반환용)

1. [운동중] 완료 체크 타깃이 27px 원 + 작은 hitSlop → 가장 빈번한 동작에서 미스탭. checkCircle 27→32, 행 전체 탭 + paddingV 8→12.
2. [전역] 레드가 "완료/시작"(액센트)과 "삭제/취소"(위험)에 동시 사용 → 의미 충돌. 완료류는 SEM.good 초록으로 분리, 빨강은 파괴 전용.
3. [NumPad] 주동작 "완료"가 회색, 보조 "다음"이 레드 → 위계 역전 + 빨강 위 검정텍스트 대비 부족. 색 역할 스왑.
4. [운동중] 세트행 간격 4px + 행마다 휴식 구분선으로 밀집 → marginBottom 8, 구분선은 완료 세트에만.
5. [전역] workout.styles.ts 전부 raw hex·TYPE 미사용 → 디자인 시스템 밖. 토큰화 필요(일관성 근원 문제).
6. [전역] 이모지 아이콘(홈 ⚙️💬, 로그인 💪/"G", 그룹 ✏️🗑️) → 벡터(SettingIcon 패턴)로 통일, 톤·신뢰도 확보.
7. [로그인] 첫인상 로고가 이모지, Google 아이콘이 글자 "G" → 브랜드/신뢰 약화. 워드마크·공식 로고로 교체.
8. [전역] 보조 텍스트 #48484A/#555/#6E6E73 과다 사용 → 헬스장 가독성 저하. SEM.muted(#6A6A6A) 이상으로 상향.
