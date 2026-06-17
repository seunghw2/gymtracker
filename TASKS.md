# TASKS

## P1 · 토큰 단일화 (2026-06-17)
- `constants/colors.ts`에 시맨틱 토큰 `SEM`(brand #FF3B30 · onBrand · good #2BD96A · warn #FFC53D · **bad #FF8A00 주황** · bg/surface/line/muted/text) + 보조 `CATS`(분배 초록 계열)·`COACH_PURPLE` 추가. **화면 렌더 값 변경 없음**(실제 치환은 P5).

### 빨강 사용처 분류 (P5 작업지시서)
| 분류 | 대표 위치 | P5 처리 |
|---|---|---|
| 브랜드(액션·활성·버튼·진행바) | `ACCENT`(#FF3B30) 앱 전반, `reports.tsx` `RT.action`, 탭바 활성 | 유지 → `SEM.brand` 매핑 |
| 의미: 미달·부족·위험·하락 | `report/theme.ts` `RT.bad`(#ff453a)·`RT.danger`, 리포트 카드 `toneColor('bad')` | **→ `SEM.bad`(주황) 치환** |
| 의미: 경고 | `RT.warn`(#ffb340) | → `SEM.warn` |
| 긍정·상승 | `RT.good`(#30d158), `COLORS.green` | → `SEM.good` |

- 핵심: 리포트 상태색(`RT.bad`)이 빨강이라 "미달·부족"이 빨강으로 과노출됨 → P5에서 `theme.ts` 상태색을 `SEM`으로 재배선하면 일괄 해결. workout/stats/session 등 다른 화면의 빨강은 대부분 브랜드 액션이라 유지.

## P2 · 내비 통합 (2026-06-17)
- 통계 탭 제거 → 탭=브리핑·기록·리포트·Chat (`(tabs)/_layout.tsx`, `CustomTabBar` META.stats 제거·리포트 앵커 calendar로).
- 새 `app/exercise-detail.tsx` 신설(종목 선택 picker + 추정/실제 1RM 차트 + RM basis). `OneRMChart`·기존 1RM 쿼리 재사용. 리포트 '종목별 진행' 행 탭 → 진입(name 파라미터).
- `app/(tabs)/stats.tsx` 삭제(딥링크 참조 없음 확인). 볼륨/부위/체중·체지방은 리포트 카드가 커버, 1RM 탐색은 종목상세로 흡수.

## P3 · 리포트 데이터 B배치 + 13블록 (2026-06-17)
- DataTab 재구성: ⚠이번주 주의(자동: 정체·부위부족·최장공백) / 추세(볼륨추세·1RM성장종목별·일관성통합) / 구성(하드세트+빈도·볼륨분배·밸런스·강도렙) / 강도·진행(상대강도·PR) / 몸(체성분+LBM+목표 통합) / 참고(접힘: 과부하·회복간격·세션통계).
- 통합: 일관성=출석+요일빈도+준수율 한 카드, 몸=체성분+LBM+목표 한 카드.
- 제거(렌더 제외, 백엔드 계산은 보존): 종합 강도 점수·운동 시간대·종목 다양성·세션 밀도/휴식.

## P4 · 편집(표시·숨김 + 순서) (2026-06-17)
- DataTab을 블록 레지스트리로 전환. 편집모드에서 카드별 숨김(기존 ai_report_hidden) + 그룹 내 ↑↓ 순서변경(신규 ai_report_order) → 백엔드 AppSetting 저장. '참고' 그룹 기본 접힘.

## P5 · 비주얼(C/레드) — 리포트 (2026-06-17)
- `report/theme.ts`를 SEM에서 파생하도록 재배선: **bad=주황(#FF8A00)**·warn=노랑(#FFC53D)·good=초록(#2BD96A), action=브랜드 빨강(#FF3B30). 리포트의 '미달·부족·하락'이 빨강→주황으로 바뀌어 빨강 과부하 해소(빨강은 액션·활성 전용).
- bg/surface도 SEM(#000/#0D0D0D)에서 파생. 분배색 c1~c5=CATS, 코치=COACH_PURPLE.
- (보너스) Chat 알림 중복: 백엔드 NotificationService.create의 dedupeKey(REPORT_READY=기간키, STAGNATION=기간키+:stag, REMINDER=날짜/스트릭키)로 이미 멱등 — 같은 이벤트 중복 적재 없음. 추가 변경 불필요.

## P5 확장 · 브리핑/기록/Chat (2026-06-17)
- 브리핑(index)·기록(calendar): 의미-빨강 오용 없음(빨강은 모두 브랜드 액션) → 별도 치환 불필요.
- Chat 탭: 알림 인박스 + AI 코치 대화(askGeneralChat → /v2/chat, period=null=최근 1개월 컨텍스트)로 동작 확인.
- 결론: "빨강 과부하"는 리포트 상태색(P5)에서 일괄 해소, 타 화면은 브랜드 액션이라 유지. P0~P5 완료.

## AI 코치 채팅 개편 P0~P5 (2026-06-17)
- P0: 백엔드 ai/chat(Conversation/ChatMessage + /api/v1/ai/conversations). 프론트 db/api/chat.ts + store/useChatStore.ts.
- P1: lib/groupNotifications.ts — 알림 표시 그룹핑(stall:종목/report:type), 횟수·최근시각. inbox 재작성(그룹 + 대화로 풀기).
- P2: Chat 탭=허브(알림 strip + 동적 스타터 + 최근 대화 + 입력창).
- P3: app/chat/[conversationId].tsx — 청크 스트리밍 + 타이핑 인디케이터 + 후속칩.
- P4: 리포트 코치 "이어가기/더 물어보기" → findOrCreateByKey(report:{type}:{start}) → 주차당 1세션 복귀.
- P5: 화면 문구 "애널리스트"→"AI 코치" 통일.
- E0~E5: 종목별 리포트 — 종목 탭(watchlist 허브: ★보유/관심·스파크·등락칩·정렬/검색), app/exercise/[name].tsx(큰 숫자 헤더 + 지표 토글 차트 1RM/최대무게/볼륨/빈도 + 코드템플릿 코치 + 대화로 풀기 stall:{종목}). 백엔드 /stats/exercise-summary·/exercise-progress 신설. 즐겨찾기=ai_pinned_lifts 재사용. exercise-detail 제거.
