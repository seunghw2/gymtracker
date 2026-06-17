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
