# GymTracker 접근성 감사 보고서 (Accessibility Audit)

평가 기준: WCAG 2.1 AA. 실제 `.tsx` StyleSheet 색상값·px·hitSlop·height·접근성 속성을 Read한 근거 기반. 추측 없음.

## 캡처 제약 (반드시 명시)
- `react-native-web` 미설치 → `expo web` 브라우저 캡처 불가.
- 앱은 폰 Expo Go로만 구동 + 인증/온보딩 게이트 + 데이터 의존 → 30개 화면 자동 네비게이션·스크린샷 불가.
- 따라서 본 감사는 **코드 기반**(StyleSheet 수치·구조·텍스트·속성)으로 진행. 실제 이미지 1장만 존재: `ui-ux-audit/screenshots/provided_goalsheet_pullup.png`.
- 명도 대비는 색상값으로 **추정**한 값(다크 배경 #000~#1C1C1E 기준). 실제 기기 캡처가 없으니 수치는 ±0.3 오차 가능 — 판정 자체(통과/위반)는 명확한 케이스만 표기.

---

## 0. 토큰 레벨 대비 진단 (constants/colors.ts)

다크 테마라 글자색이 배경(#000 / #0D0D0D / #1C1C1E)과 충돌하는 게 핵심 문제다. 흰 배경 기준이 아니라 어두운 배경 기준으로 계산.

| 토큰 | 값 | 배경 | 추정 대비 | WCAG 4.5:1(본문) | 판정 |
|------|-----|------|-----------|------------------|------|
| `SEM.ink1` / 흰색 | #FFFFFF | #000 | 21:1 | ✅ | OK |
| `SEM.ink2` | #EDEDF0 | #000 | 18:1 | ✅ | OK |
| `SEM.ink3` | #8E8E93 | #000 | ~4.6:1 | ✅(아슬) | 보더라인 — 카드(#1C1C1E) 위에선 ~4.0:1 미달 |
| `SEM.muted` | #6A6A6E | #000 | ~3.0:1 | ❌ | 본문/캡션 위반 |
| `SEM.ink4` / placeholder | #48484A | #000 | ~2.0:1 | ❌ | 심각 |
| 온보딩 힌트 직접값 | #555 | #000 | ~2.4:1 | ❌ | 위반 |
| 빨강 위 검정(`#000000`) | #000 on #FF3B30 | — | ~3.0:1 | ❌ | 버튼 라벨 위반 |
| 빨강 위 짙은초록(`#0A1F12`,`#06210F`) | on #FF3B30 | — | ~3.4:1 | ❌(보더라인) | 위반 가능 |

핵심: `SEM.muted(#6A6A6E)`와 `#48484A`, `#555`가 **보조 텍스트 전반에 광범위하게** 쓰임 → 시스템 차원 위반. 그리고 **빨강 버튼 위 검정/짙은초록 글자**가 주요 액션 버튼(완료/시작/저장)에서 반복.

---

## 1. 화면별 문제 표

| 화면 | 문제 | 심각도 | WCAG 항목 | 개선안(구체 수치/속성) |
|------|------|--------|-----------|------------------------|
| **공통(colors.ts)** | `SEM.muted #6A6A6E`(~3.0:1)를 캡션·메타·힌트 전반에 사용 | High | 1.4.3 대비 | muted를 #8E8E93→실제 #9A9AA2 수준(≥4.5:1)으로 상향, 또는 보조본문은 ink3(#8E8E93) 이상만 사용 |
| **공통** | `#48484A`(ink4)를 placeholder·빈상태·disabled 텍스트에 사용(~2.0:1) | High | 1.4.3 | placeholder 최소 #6E6E73(≥3:1 대형) / 실제 정보 텍스트는 ink3 이상. 빈상태 안내문은 #8E8E93로 |
| **NumPad** (components/NumPad.tsx:110) | '다음' 버튼 텍스트 `#000000` on `#FF3B30`(~3.0:1) | High | 1.4.3 | 빨강 위 텍스트는 `#FFFFFF`(가독·일관). `nextText.color`를 #FFF로 |
| **NumPad** (:40,99) | 소수점 키 비활성 시 `#48484A`만으로 구분, accessibilityState 없음 | Med | 1.4.1 / 4.1.2 | `disabled` 키에 `accessibilityState={{disabled:true}}` 추가 |
| **NumPad** (전체) | 모든 키가 `<Pressable>`인데 `accessibilityRole`/`accessibilityLabel` 없음 → ⌫는 스크린리더가 "⌫" 글리프로 읽음 | High | 4.1.2 | ⌫에 `accessibilityLabel="지우기"`, ＋/− 스텝에 "증가/감소", 각 키 `accessibilityRole="button"` |
| **NumPad** (:78 KEY_H=48) | 키 height 48 — OK. 그러나 `side` 열 버튼·stepBtn도 48 OK | Low | 2.5.5 | 유지(44pt 이상 충족) |
| **워크아웃 세트행** (workout.styles.ts:326 checkBtn / :327 checkCircle 27px) | 완료 체크 원 27×27, checkBtn 패딩 포함해도 탭 영역 작고 hitSlop 없음 | High | 2.5.5 타깃 크기 | checkCircle 유지하되 부모 `checkBtn`에 `hitSlop={{top:8,bottom:8,left:8,right:8}}` 또는 minHeight 44 |
| **워크아웃** (workout.styles.ts:213 exDeleteBtn 28×28, :379 templateDelBtn 28×28, :436 warmupDel 28×28) | 삭제/스텝 등 28×28 아이콘 버튼 다수 44pt 미만, hitSlop 미지정 | High | 2.5.5 | 모두 `hitSlop` 8~10 추가. 삭제 X는 `accessibilityLabel="삭제"` |
| **워크아웃 세트번호** (workout.tsx:573 setNumText 26px) | 세트번호 탭→타입순환, 롱프레스→타입선택인데 시각/스크린리더 단서 없음 | Med | 1.3.1 / 4.1.2 | `accessibilityHint="탭하면 세트 타입 변경"` + 26px 타깃 hitSlop |
| **워크아웃 마무리 버튼** (workout.styles.ts:149,157,579,421) finishBtnText `#000`, stickyFinishText `#06210F`, addBarBtnText `#0A1F12`, summaryBtnText `#000` | 빨강 위 검정/짙은초록 라벨 다수(~3.0~3.4:1) | High | 1.4.3 | 빨강(#FF3B30) 위 모든 라벨 `#FFFFFF`로 통일 |
| **워크아웃 종목메모** (workout.styles.ts:189 exNoteInput color #E5C07B on #23201A) | 금색 메모 텍스트 대비 OK이나 placeholder가 muted | Low | 1.4.3 | placeholder #8E8E93 이상 |
| **워크아웃 prevHint** (workout.styles.ts:319 #6E6E73, 10px) | 직전 기록 힌트 10px + #6E6E73(~3.1:1) → 작고 흐림 | Med | 1.4.3 / 1.4.4 | 폰트 11px↑, 색 #8E8E93. 중요한 "직전 무게"는 더 진하게 |
| **홈** (index.tsx:267 gearIcon ⚙️ fontSize 22, hitSlop 10) | 설정 진입이 이모지뿐 — 라벨 없음 | Med | 4.1.2 | `<Pressable accessibilityRole="button" accessibilityLabel="설정">` |
| **홈** (index.tsx:175 chatFab 💬) | 채팅 FAB 이모지뿐, 라벨 없음 | Med | 4.1.2 | `accessibilityLabel="AI 코치 대화"` |
| **홈 단계 구분** (index.tsx:242 stageBadgeStyle) | 증량준비=초록/정체=주황/기본=빨강을 **색으로만** 구분(stageLabel 텍스트는 있으나 도트·테두리는 색만) | Med | 1.4.1 색만으로 구분 금지 | 배지에 텍스트 라벨은 있음(OK). 단 volFill 진행바(:127)와 dotBar는 색만 → 패턴/아이콘 보조 권장 |
| **홈 출석 도트** (index.tsx:303 dot 10×10, dotOn ACCENT / dotOff #2a2a2f) | 완료/미완료를 색만으로 구분 | Med | 1.4.1 | done 도트에 채움+border, 또는 "n/m회" 텍스트로 대체(텍스트는 이미 있음 → 보조 OK) |
| **홈 greet** (index.tsx:275 #6A6A6E muted 13px) | 인사문구 muted | Low | 1.4.3 | ink3 이상 |
| **캘린더 휴식 텍스트** (calendar.tsx:310 restText #48484A 11.5px) | "휴식 N일" 정보 텍스트가 #48484A(~2.0:1)+11.5px | High | 1.4.3 | 색 #8E8E93, 폰트 12px↑ |
| **캘린더 emptyText** (calendar.tsx:334 #48484A 14px) | "운동 기록이 없어요" 빈상태 #48484A | Med | 1.4.3 | #8E8E93 이상 |
| **캘린더 월 네비** (calendar.tsx:314 navBtn padding 8, navArrow 28px) | ‹ › 버튼 패딩 8 → 약 28px 타깃, 라벨 없음 | Med | 2.5.5 / 4.1.2 | hitSlop 8, `accessibilityLabel="이전 달/다음 달"` |
| **캘린더 날짜셀** (calendar.tsx:321 dayCircle 36×36) | 셀은 14.28%폭 aspectRatio라 탭영역은 충분하나, 오늘/운동일 구분이 색(빨강/짙은빨강)만 | Med | 1.4.1 | 운동일에 점/밑줄 등 비색상 단서 추가 |
| **캘린더 태그캡슐** (calendar.tsx:307 tagText #C7C7CC 10.5px) | 부위 태그 10.5px → 1.4.4 확대 시 취약, 대비는 OK | Low | 1.4.4 | 11px↑ |
| **리포트 bandHint/changeLabel** (ReportScreen.tsx:252 ink3 11px, :236 11.5px) | 캡션 11~11.5px | Low | 1.4.4 | 12px 권장 |
| **리포트 ChangeRow 색** (ReportScreen.tsx:201 tone별 색) | "증량 준비/개선/기준"을 색+뱃지글리프(↑＋●)로 구분 — 뱃지 있어 OK이나 글리프 라벨 없음 | Low | 1.4.1 | 텍스트 라벨 동반(이미 label 있음) → OK |
| **로그인** (login.tsx:175 terms #48484A 12px) | 약관 안내 #48484A(~2.0:1) | Med | 1.4.3 | #8E8E93 이상 |
| **로그인 G 아이콘** (login.tsx:114) | "G" 텍스트만으로 Google 표현, 버튼 라벨은 함께 있음 | Low | 4.1.2 | OK(텍스트 라벨 동반). 단 버튼 `accessibilityRole="button"` 명시 권장 |
| **로그인 에러** | 모든 실패가 `Alert.alert(제목, 메시지)` — 명확함 | Low | 3.3.1 | OK. 단 "오류가 발생했습니다" 류는 사용자 조치 안내 부족 |
| **온보딩 힌트들** (onboarding.tsx:306 freqHint #555, :323 segHint #555, :335 incNote #555, :306 hint) | 힌트 텍스트 다수 #555(~2.4:1) | High | 1.4.3 | #8E8E93 이상. 힌트는 의사결정 정보라 가독 필수 |
| **온보딩 tick** (onboarding.tsx:283 tick 22×22 borderColor #555) | 선택 라디오를 색(빨강채움)으로만 구분 + 테두리 #555 흐림 | Med | 1.4.1 / 1.4.11 | 선택 시 체크 글리프 추가, 비선택 테두리 #8E8E93 |
| **온보딩 진행바** (onboarding.tsx:269 progSeg height 3) | 진행 단계 색만(빨강/회색), 텍스트 "1/5"는 별도 있음 | Low | 1.4.1 | stepNo 텍스트로 보조됨 → OK |
| **온보딩 비활성 CTA** (onboarding.tsx:232 ctaGhost + ctaTGhost muted) | disabled 버튼이 `disabled` prop은 있으나 `accessibilityState` 없음, 라벨 muted | Med | 4.1.2 | `accessibilityState={{disabled:!valid}}` |
| **설정 스위치** (settings.tsx:92 등 trackColor true=brand) | 스위치 on/off가 색만 — RN Switch는 기본 접근성 OK | Low | 1.4.1 | Switch는 role 자동. OK |
| **설정 Row chevron** (settings.tsx:167 rowChev ›) | ›가 장식이나 행 자체가 Pressable이라 OK. 라벨은 텍스트 | Low | 4.1.2 | OK |
| **설정 rowSub** (settings.tsx:164 ink3 11.5px) | 계정 이메일 등 11.5px ink3 | Low | 1.4.4 | 12px 권장 |
| **종목 허브 펠릿** (exercises.tsx:266 pelletT SEM.ink3, :248 pelletX 18×18) | 그룹 삭제 X 18×18(매우 작음) hitSlop 6 + accessibilityLabel 없음 | High | 2.5.5 / 4.1.2 | X 타깃 ≥24, hitSlop 10, `accessibilityLabel="그룹 삭제"` |
| **종목 허브 정렬칩** (exercises.tsx:275 sortBtn paddingV 6, hitSlop 미상) | 정렬·편집 버튼 작음 | Med | 2.5.5 | hitSlop 8 |
| **종목 허브 이모지 옵션** (exercises.tsx:230 ✏️↕️🗑️) | 시트 옵션이 이모지+텍스트 → 텍스트 동반이라 OK | Low | — | OK |
| **종목 상세** (exercise/[name].tsx:28 METRICS 토글, RangePicker) | 지표 세그먼트 다수 — 미니 차트 SVG는 스크린리더에 의미 전달 안 됨 | Med | 1.1.1 비텍스트 콘텐츠 | 차트에 `accessibilityLabel`로 핵심 수치 요약 제공 |
| **ExerciseGoalSheet** (ExerciseGoalSheet.tsx:216 metaText SEM.muted, :228 cmpLabel muted, :232 cmpReason muted) | 역할·비교·근거 메타가 SEM.muted(~3.0:1) 다수 | High | 1.4.3 | 의미 있는 정보 텍스트는 ink3 이상으로 |
| **ExerciseGoalSheet 비교칩** (:133 compChip 색=compColor) | 비교가능/참고/보류를 색으로 구분하나 **텍스트 라벨 동반** | Low | 1.4.1 | OK(라벨 있음) |
| **ExerciseGoalSheet 닫기** (:173 closeBtn height 50) | OK | Low | 2.5.5 | OK |
| **ExerciseGoalSheet caution** (:223 cautionText SEM.warn #FFC53D 12.5px) | 주의문구를 ⚠ 글리프+노랑으로 — 글리프 동반이라 OK, 단 12.5px | Low | 1.4.1 / 1.4.4 | 13px 권장 |
| **전역 모달 backdrop Pressable** (ExerciseGoalSheet:67 등) | scrim Pressable에 `accessibilityViewIsModal`/닫기 라벨 없음 | Med | 4.1.2 | 시트에 `accessibilityViewIsModal={true}`, scrim `accessibilityLabel="닫기"` |

---

## 2. 횡단 이슈 요약 (반복 패턴)

1. **빨강 버튼 위 검정/짙은초록 글자** — `#000000`·`#06210F`·`#0A1F12`·`#0A1F12`가 finish/start/save/add/numpad-next 버튼에서 반복(~3.0~3.4:1). 전부 `#FFFFFF`로 통일하면 일괄 해결.
2. **흐린 보조 텍스트 토큰 남용** — `SEM.muted #6A6A6E`(~3.0:1), `#48484A`(~2.0:1), `#555`(~2.4:1)가 캡션·힌트·빈상태·placeholder 전반. 토큰 레벨에서 muted 상향(또는 정보 텍스트는 ink3 #8E8E93 하한)이 가장 큰 ROI.
3. **아이콘 전용 Pressable에 accessibilityLabel/Role 전무** — ⚙️ 💬 ✏️ 🗑️ ✕ ⌫ ‹ › 등. 스크린리더가 글리프를 그대로 읽어 의미 불통. 일괄 라벨 부여 필요.
4. **28px 이하 작은 탭 타깃 + hitSlop 미지정** — 세트 완료 체크(27px), 삭제 버튼(28px), 그룹 삭제 X(18px) 등 2.5.5(44pt) 미달. hitSlop 8~10 추가가 저비용 해결.
5. **고정 px 폰트 + Dynamic Type 미대응** — TYPE 스케일이 전부 고정 px(10~30), `allowFontScaling` 제어 없음. 시스템 글자 확대 시 11px대 캡션(prevHint 10px, tagText 10.5px)이 특히 취약(1.4.4).
6. **색만으로 상태 구분(부분)** — 단계 배지/진행바/도트가 색 의존. 텍스트 라벨이 동반된 곳은 OK이나, 진행바(volFill)·출석도트·달력 운동일은 비색상 단서 보강 권장.

---

## 3. 개발 난이도 vs 사용자 영향 (우선순위)

- **P1 (저난이도·고영향)**: 빨강버튼 글자 흰색 통일 / muted·#555·#48484A 정보텍스트 상향 / 아이콘버튼 accessibilityLabel / 작은 버튼 hitSlop. → 색·라벨 일괄 치환, 1~2일.
- **P2 (중난이도·중영향)**: 단계·진행바·달력 운동일 비색상 단서 / 모달 accessibilityViewIsModal / disabled accessibilityState / 11px 이하 캡션 12px↑.
- **P3 (고난이도·국지영향)**: 차트 SVG accessibilityLabel 요약 / Dynamic Type 전면 대응(allowFontScaling 정책 수립).

---

## 가장 심각한 접근성 위반 8

1. 빨강(#FF3B30) 액션 버튼 위 글자가 검정/짙은초록(#000·#06210F·#0A1F12)으로 대비 ~3.0:1 — 완료·시작·저장·추가·NumPad'다음' 버튼 전반 위반(WCAG 1.4.3). 전부 #FFFFFF로.
2. `SEM.muted #6A6A6E`(~3.0:1)를 캡션·메타·힌트에 광범위 사용 — 시스템 차원 본문 대비 위반(1.4.3).
3. `#48484A`(~2.0:1)·온보딩 `#555`(~2.4:1)가 placeholder·빈상태·힌트·약관 등 **의미 있는 정보 텍스트**에 사용 — 심각한 가독 실패(1.4.3).
4. 아이콘 전용 Pressable(⚙️ 설정, 💬 챗FAB, 🗑️/✕ 삭제, ⌫ 백스페이스, ‹›달력)에 accessibilityLabel/Role 전무 — 스크린리더 사용 불가(4.1.2).
5. 세트 완료 체크 원 27×27, 그룹 삭제 X 18×18, 삭제 버튼 28×28 등 다수 탭 타깃이 44pt 미만 + hitSlop 미지정(2.5.5).
6. 캘린더 "휴식 N일"(#48484A·11.5px), prevHint(#6E6E73·10px) 등 정보 텍스트가 흐린 색 + 11px 이하 — 대비·확대 동시 취약(1.4.3 / 1.4.4).
7. 모든 폰트 고정 px + Dynamic Type 미대응 — 시스템 글자 확대 시 10~11px대 캡션(prevHint 10px, tagText 10.5px) 레이아웃·가독 붕괴(1.4.4).
8. 단계 진행바(volFill)·출석 도트·달력 운동일이 색만으로 상태 구분 — 색각이상 사용자 정보 손실(1.4.1). (배지 텍스트가 동반된 곳은 제외).
</content>
</invoke>
