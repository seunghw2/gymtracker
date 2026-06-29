# GymTracker 디자인 일관성 리포트

평가 방식: 추측 없이 실제 `.tsx` StyleSheet 수치를 교차 비교했다. 자동 스크린샷 인프라가 없어(react-native-web 미설치, 폰 Expo Go 전용) 코드 기반 인벤토리로 대체한다.

## 0. 토큰 체계 현황 — "토큰은 잘 만들어 뒀는데, 화면이 안 쓴다"

`constants/colors.ts`는 이미 꽤 성숙한 디자인 토큰을 갖고 있다:
- `SEM` (brand/danger/good/warn/bad/surface1~3/ink1~4/line/line2) — 시맨틱 단일 소스
- `RADIUS` (sm 4 / md 8 / lg 12 / card 14 / xl 16 / full 999)
- `SPACE` (4pt 그리드: xs 4 ~ xxxl 32)
- `TYPE` (8단 타이포 스케일 + lineHeight)
- `WEIGHT` (regular 400 / medium 600 / semibold 700 / bold 800)

문제는 **이 토큰을 거의 안 쓴다**는 것이다. 화면 대부분이 raw hex와 매직넘버를 직접 박는다. 실측:

| 항목 | 수치 |
|---|---|
| 화면/컴포넌트에 박힌 hex 색상 총량 | 600개 이상 |
| `'#fff'` vs `'#FFFFFF'` (같은 흰색, 두 표기 혼용) | 115회 / 89회 |
| `'#000'` vs `'#000000'` | 20회 / 17회 |
| `'#2c2c2e'`/`'#2C2C2E'` (대소문자 혼용) | 51회 |
| `RADIUS`/`SPACE`/`TYPE` 토큰 사용 화면 | 사실상 0 (settings/goals만 SEM 색상 일부 사용) |

게다가 색 토큰이 **세 갈래로 분기**돼 있다:
1. `SEM`/`ACCENT` (전역) — `settings.tsx`, `goals.tsx`만 비교적 충실히 사용
2. `RT` (`components/report/theme.ts`) — 리포트 전용. ink/surface/hair를 **독립 정의**(`ink: '#f5f5f7'`는 SEM.ink1 `#FFFFFF`와 미묘하게 다름, `surface2: '#1f1f23'`도 SEM에 없는 값)
3. raw hex — `workout.styles.ts`(214개), `exercise/[name].tsx`(79개), `index.tsx`(23개) 등 핵심 화면 다수

즉 토큰 인프라는 A급인데 채택률이 F급이다. 사용자 영향은 "한 앱인데 화면마다 미세하게 다른 검정·회색·둥근모서리"로 나타난다.

---

## 1. Primary(빨강) 버튼 — 같은 액션, 화면마다 다른 높이·radius·텍스트색 [영향: 상 / 난이도: 중]

레드 CTA가 모든 화면에 있지만 치수가 제각각이다:

| 화면:심볼 | height/padding | radius | 텍스트색 |
|---|---|---|---|
| `onboarding.tsx:cta` | height **54** | 14 | `#fff` |
| `index.tsx:setupCta` | height **52** | 14 | `#fff` |
| `ExerciseGoalSheet.tsx:closeBtn` | height **50** | 14 | `#fff` |
| `goals.tsx:save` | paddingV **14** | **12** | `SEM.onBrand` |
| `workout.styles.ts:finishBtn` | paddingV 8 | 12 | **`#000000`** |
| `workout.styles.ts:saveBtn` | padding 16 | 14 | **`#000000`** |
| `workout.styles.ts:addBarBtn` | paddingV 16 | 14 | **`#0A1F12`**(녹색빛 검정) |
| `report/ReportScreen.tsx:actionCta` | paddingV 13 | **13** | `#fff` |
| `report/ReportScreen.tsx:cta` | paddingV 13 | **13** | `#fff` |
| `NumPad.tsx:nextBtn` | height 48 | 8 | **`#000000`** |

가장 눈에 띄는 모순: **빨강 버튼 위 글자색이 어떤 화면은 흰색(`#fff`), 어떤 화면은 검정(`#000000`/`#0A1F12`)**이다. 토큰엔 `ACCENT_INK = '#FFFFFF'`로 흰색이 정답으로 정의돼 있는데도 workout/numpad 계열은 검정을 쓴다. `#0A1F12`(녹색빛 검정)는 과거 그린 액센트 시절의 잔재로 보인다.

사용자 영향: 운동중 화면(검정 글자)에서 온보딩/리포트(흰 글자)로 넘어가면 "같은 빨강 버튼인데 왜 글자색이 바뀌지" 하는 미묘한 이질감. 헬스장에서 빠르게 누를 때 대비(검정 on 빨강 = 대비 낮음)도 흰색보다 떨어진다.

통일 기준:
- 공통 컴포넌트 `components/ui/PrimaryButton.tsx` 신설 — `height: 52`, `borderRadius: RADIUS.card(14)`, 배경 `ACCENT`, 글자 `ACCENT_INK(#FFFFFF)`, `TYPE.callout` + `WEIGHT.bold` 고정. variant로 `compact`(작은 인라인용 paddingV 8~10)만 허용.
- workout/numpad의 `#000000`/`#0A1F12` 글자색을 전부 흰색으로 통일.

---

## 2. 검정/회색 표면 색이 화면마다 다른 검정 [영향: 상 / 난이도: 중]

같은 "카드 배경"인데 화면군마다 다른 검정·회색을 쓴다:

| 의미 | index/onboarding (SEM 계열) | workout.styles | report(RT) | exercise/[name] |
|---|---|---|---|---|
| 화면 배경 | `#000` / `SEM.bg` | `#000000` | `SEM.bg`(#000) | `SEM.bg` |
| 카드 표면 | `SEM.surface1`(#0D0D0D) | **`#1C1C1E`** | `SEM.surface`(#0D0D0D) | `#0a0a0c`/`#0d0d0f` |
| 입력/칩 배경 | `SEM.surface2`(#161618) | **`#2C2C2E`** | `#1f1f23` | `#1c1c22` |
| 약한 회색 텍스트 | `SEM.muted`(#6A6A6A) | **`#8E8E93`** | `#9a9aa1`/`#5e5e66` | `#7a7a7e`/`#8a8a8e` |

특히 **`workout.styles.ts`는 거의 전부 iOS 시스템 그레이(`#1C1C1E`/`#2C2C2E`/`#8E8E93`)** 로 짜여 있어, SEM 계열(`#0D0D0D`/`#161618`/`#6A6A6A`)을 쓰는 홈·온보딩보다 **눈에 띄게 밝은 회색**이다. 사용자가 홈(매우 어두움) → 운동 시작(한 단계 밝은 회색 카드)으로 들어가면 톤이 바뀐다.

약한 텍스트 회색만 해도 최소 6종(`#6A6A6A`, `#8E8E93`, `#9a9aa1`, `#7a7a7e`, `#8a8a8e`, `#5e5e66`)이 혼재한다. 이는 `SEM.ink3(#8E8E93)` 하나로 수렴 가능하다(주석에도 "중간 회색은 ink3로 수렴"이라 명시돼 있으나 실제 미적용).

통일 기준:
- `workout.styles.ts`를 surface 토큰으로 일괄 치환: `#1C1C1E`→`surface1`, `#2C2C2E`→`surface2`, `#8E8E93`→`ink3`. (단, 운동중 화면이 의도적으로 밝아야 한다면 그 결정을 토큰에 `surface1Active`로 명시 — 지금은 "그냥 다른 파일이라 다른 값"으로 보임)
- 회색 텍스트 6종 → `ink3` 단일화. 캡션은 `ink3`, placeholder/disabled는 `ink4`.

---

## 3. 카드 padding·radius가 14/16/18/20/24로 제각각 [영향: 중 / 난이도: 중]

같은 "정보 카드"인데:

| 화면:심볼 | radius | padding |
|---|---|---|
| `index.tsx:card`(이번 주) | 16 | 18 |
| `index.tsx:pcard`(종목) | 14 | 16 |
| `index.tsx:actionRow` | **13** | 14 |
| `ExerciseGoalSheet:todayBox` | 14 | 16 |
| `ExerciseGoalSheet:sheet` | 22 | 20 |
| `onboarding:opt`/`ruleCard` | 14 | 17 / 15 |
| `workout.styles:exerciseCard` | 16 | 16 |
| `workout.styles:startBox` | **20** | 20 |
| `workout.styles:summaryCard` | **24** | 28 |
| `report:actionCard` | **18** | 18 |
| `settings:group` | 14 | (row 단위) |

radius만 13/14/16/18/20/22/24 일곱 종, padding은 14/15/16/17/18/20/28. `RADIUS` 토큰(card 14 / xl 16)이 있는데 거의 무시된다. 특히 `actionRow`의 radius **13**, `report`의 radius **18**은 토큰에 존재하지도 않는 값이다.

통일 기준: 카드=`RADIUS.card(14)` 또는 큰 카드=`RADIUS.xl(16)` 두 단계로만. 시트=20. padding은 `SPACE.lg(16)`/`SPACE.xl(20)` 두 단계로. 공통 `Card` 컴포넌트로 강제(report엔 이미 `Card`가 있으니 전역으로 승격).

---

## 4. 화면 제목 폰트 크기가 통일 안 됨 [영향: 중 / 난이도: 하]

탭 화면 헤더 제목 크기가 화면마다 다르다:

| 화면:심볼 | fontSize |
|---|---|
| `settings.tsx:header`("설정") | **28** |
| `calendar.tsx:header` | **28** |
| `exercises.tsx:title`("종목") | **30** |
| `index` | 제목 없음(요일 인사말 13만) |
| `report/ReportScreen:title` | **16** |
| `goals.tsx:navTitle` | 17 |
| `workout.styles:detailHeaderTitle` | 17 |
| `workout.styles:modalTitle` | 18 |
| `login.tsx:title` | 32 |

탭 최상위 제목만 봐도 28/30/16으로 갈린다. 특히 **리포트는 탭 화면인데 제목이 16**(센터 네비바 스타일)이고, 종목·설정·기록은 28~30(좌측 큰 헤더 스타일)이다. 두 가지 헤더 패턴이 섞여 있다: (a) 좌측 큰 제목(settings/calendar/exercises), (b) 중앙 네비 제목 + 양옆 버튼(report/goals/workout detail). 어떤 탭은 (a), 어떤 탭은 (b)라 일관성이 없다.

`TYPE` 스케일에 `headline(24)`, `display(30)`, `title(20)`이 있는데 28은 스케일 밖 값이다.

통일 기준:
- 탭 루트 화면 제목 = `TYPE.display(30)` + `WEIGHT.bold` 좌측 정렬로 통일(현재 28/30 → 30). 리포트 탭도 좌측 큰 제목 패턴으로 전환.
- 푸시된 상세/모달 = 중앙 네비 제목 `TYPE.callout(17)` 패턴으로 통일.
- 공통 `ScreenHeader` / `NavHeader` 두 컴포넌트로 분리.

---

## 5. 같은 액션인데 CTA 위치·문구·스타일이 다름 [영향: 중 / 난이도: 중]

"닫기/취소" 패턴:
- `ExerciseGoalSheet:closeBtn` — 시트 하단, 빨강 아닌 `#1c1c22` 배경 "닫기"
- `onboarding:backBtn` — 푸터 좌측, 외곽선 "이전"
- `workout.styles:menuCancel` — 하단, `#2C2C2E` "취소"
- `workout.styles:warmupCancel` — flex 좌측, `#2C2C2E` "취소"

"종목 선택" 진입 화살표:
- `onboarding:pickerBtnArrow` — `›` fontSize 20, ACCENT
- `settings:rowChev` — `›` fontSize 17, ink3
- `ExerciseGoalSheet:cmpChevron` — `›` fontSize 22, `#8a8a8e`

같은 `›` 셰브론이 17/20/22 세 크기 + 세 색으로 존재. 같은 "저장" 버튼도 goals는 빨강(흰글자), workout은 빨강(검정글자).

토글/세그먼트도 분기: `onboarding:seg`(레드 ON), `settings:seg`(레드 보더 ON), `workout.styles:restSeg`(레드 ON, 검정글자), `workout.styles:trackingBtn`(**파랑** `#0A84FF` ON). workout 일부는 아직 **iOS 블루(`#0A84FF`)** 를 활성색으로 쓴다(`tagDoneBtn`, `tagChipOn`, `trackingBtnOn`, `timeBadge`) — CARBON 레드 전환에서 누락된 곳.

통일 기준:
- 셰브론 `›`을 공통 `<Chevron size tone>` 컴포넌트로(기본 17/ink3).
- 세그먼트/토글 ON 색을 전부 `ACCENT`로(workout의 `#0A84FF` 4곳 제거).
- 시트 하단 dismiss는 "닫기" 문구 + secondary(중립 회색) 스타일로 통일.

---

## 6. 리스트/카드/폼이 화면마다 중복 구현 [영향: 중 / 난이도: 중]

같은 UI 패턴이 컴포넌트화 안 되고 화면마다 복붙됐다:

- **설정형 그룹 행(아이콘+라벨+값+셰브론)**: `settings.tsx:Row`와 `goals.tsx:Field/row`가 거의 동일한 `group`+`settingRow` 구조를 각자 정의(둘 다 `SEM.surface2`+`RADIUS 14`지만 별도 StyleSheet).
- **스텝퍼(− 숫자 +)**: `onboarding:freqBtn`(56원형), `onboarding:stepBtn`(36각), `workout.styles:stepBtn`(30x34), `NumPad:stepBtn` — 네 군데 각각 구현. 크기·radius 전부 다름.
- **칩/뱃지**: `index:stageBadge`, `ExerciseGoalSheet:roleBadge`, `report:chip`, `workout.styles:chip`, `exercise/[name]:tg/cause/chip` — radius 5~18, 폰트 8.5~14로 난립.
- **빈 상태(empty)**: report는 📭 이모지+CTA, exercises는 텍스트만, workout은 `emptyHint` 텍스트만 — 패턴 불일치.

통일 기준: `components/ui/`에 `Stepper`, `Badge`, `SettingRow`, `EmptyState`를 만들어 공유. `BottomSheet`는 이미 `components/ui/BottomSheet`로 추출돼 있으니 같은 자리로 모은다.

---

## 7. 같은 의미인데 다른 문구·색 의미 충돌 [영향: 중 / 난이도: 하]

- **"확인 필요" 색**: `index:actionRowCheck`/`actionTagCheck`는 증량준비를 **초록 테두리/초록 칩**(`rgba(43,217,106…)`)으로 표시하는데, 같은 화면 `GoalCard`의 READY 뱃지도 초록이라 OK. 그러나 `actionTagT`의 텍스트는 **ACCENT(빨강)** 로 찍힌다 — 초록 칩 안에 빨강 글자. 의미색 규칙(brand=액션, good=증가)이 한 행 안에서 섞임.
- **PR/최고기록 보라**: `ExerciseGoalSheet:cmpValuePr`는 `#c3a8e8`, `index`엔 보라 없음, `exercise/[name]`은 다른 보라 계열. PR 강조색이 통일 안 됨(`COLORS.purple #BF5AF2`, `COACH_PURPLE #9f8fef`, `#c3a8e8` 혼재).
- **"기준 만들기" vs "기준 생성" vs "기준 기록"**: 같은 NEED_BASELINE 개념을 홈은 "기준 만들기", 리포트는 "기준 생성", 시트는 "비교 기준"으로 다르게 표기.
- **노트/메모 노랑**: `workout.styles:exNoteInput`(`#E5C07B`), `exercise/[name]:memo`(`#caa94a`/`#e7dcc0`) — 메모 강조 노랑이 두 종.

통일 기준: 의미색은 `SEM`(good=초록=증가, brand=빨강=액션 only)만 쓰고 한 요소 안에서 섞지 않기. PR=보라는 토큰 `SEM.pr` 신설로 단일화. 도메인 용어집(기준 생성/정체/증량 준비)을 `constants/labels.ts`로 한 곳에 고정.

---

## 8. 아이콘 스타일 혼재(이모지 vs 벡터) [영향: 하~중 / 난이도: 중]

아이콘 체계가 두 갈래다:
- `components/SettingIcon.tsx`(벡터, `settings.tsx`에서 사용) — 깔끔한 단일 시스템
- 그 외 거의 전부 **이모지**: 홈 설정 진입 `⚙️`(`index:gearIcon` 22), 챗 FAB `💬`, 로그인 `💪`, exercises 그룹 시트 `✏️/↕️/🗑️`, report 빈상태 `📭`, 시트 `⚠`, 백스페이스 `⌫`

이모지는 OS/폰트 버전마다 렌더가 달라지고(특히 `⚙️`·`💬`는 플랫폼별 색이 제각각) 톤이 컬러풀해서 CARBON(블랙+레드) 톤과 충돌한다. 같은 설정 진입도 settings 탭은 벡터 아이콘, 홈 우상단은 `⚙️` 이모지로 불일치.

통일 기준: `SettingIcon`을 전역 `Icon` 시스템으로 승격하고 네비/액션 아이콘을 벡터로 교체(이모지는 보상/축하 같은 감정 표현에만 한정). 최소한 홈 `⚙️`만이라도 settings와 같은 벡터로.

---

## 우선순위 요약

| 순위 | 이슈 | 사용자 영향 | 난이도 |
|---|---|---|---|
| P0 | #1 Primary 버튼 글자색(흰/검 혼용)·치수 통일 + 공통 `PrimaryButton` | 상 | 중 |
| P0 | #2 workout의 `#1C1C1E/#2C2C2E/#8E8E93` → surface/ink 토큰 치환 | 상 | 중 |
| P1 | #5 workout의 iOS 블루(`#0A84FF`) 4곳 → ACCENT, 세그먼트/셰브론 통일 | 중 | 중 |
| P1 | #3 카드 radius/padding 두 단계로 토큰화 + 공통 `Card` 전역화 | 중 | 중 |
| P2 | #4 탭 제목 30/네비 17 두 패턴으로 + `ScreenHeader` | 중 | 하 |
| P2 | #7 의미색 충돌·PR 보라·도메인 용어 통일 | 중 | 하 |
| P3 | #6 Stepper/Badge/SettingRow/EmptyState 공통화 | 중 | 중 |
| P3 | #8 이모지 → 벡터 아이콘 전환(최소 네비 아이콘) | 하~중 | 중 |

근본 처방은 단순하다: **이미 있는 `colors.ts` 토큰(SEM/RADIUS/SPACE/TYPE)을 실제로 쓰게 만드는 것.** raw hex 600개 중 상위 빈도(`#fff`·`#FFFFFF`·`#8E8E93`·`#1C1C1E`·`#2C2C2E`)만 토큰으로 일괄 치환해도 일관성 체감이 크게 오른다. `report/theme.ts`의 `RT`도 SEM 파생이라 주장하지만 ink/surface2 값이 실제로 다르므로, RT를 SEM에 정확히 맞추거나 RT를 폐기하고 SEM으로 흡수하는 결정이 필요하다.
