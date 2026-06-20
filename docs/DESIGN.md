# GymTracker · 디자인 시스템 (단일 소스)

토큰 정의는 [`constants/colors.ts`](../constants/colors.ts). **새 코드/수정 시 하드코딩 금지 — 아래 토큰을 쓴다.**
(현황 감사: 색 토큰은 잘 쓰이나 타입/간격/반경은 하드코딩 다수 → 단계적으로 토큰으로 수렴. UIUX_PLAN 1단계)

## 색 (CARBON · 블랙+레드)
원칙: **레드=액션·네비 / 초록=양호(↑·PR) / 주황=주의**. 파랑 미사용.

| 용도 | 토큰 | 값 |
|---|---|---|
| 액션·활성·버튼 | `ACCENT` / `SEM.brand` | #FF3B30 |
| 액션 위 텍스트 | `ACCENT_INK` / `SEM.onBrand` | #FFFFFF |
| 위험·삭제 | `SEM.danger` | #FF453A |
| 양호·증가·PR | `COLORS.green` / `SEM.good` | #30D158 / #2BD96A |
| 주의(부족·정체) | `COLORS.orange` / `SEM.bad` | #FF9F0A / #FF8A00 |
| 배경 | `SEM.bg` | #000000 |
| 카드 표면 | `SEM.surface1/2/3` | #0D0D0D / #161618 / #1C1C1E |
| 구분선 | `SEM.line` / `SEM.line2` | #242427 / #2C2C2E |
| 텍스트 | `SEM.ink1/2/3/4` | #FFFFFF / #EDEDF0 / #8E8E93 / #48484A |

### 하드코딩 hex → 토큰 매핑 (이 값들 보이면 토큰으로 교체)
| 하드코딩 | → 토큰 |
|---|---|
| `#FF3B30` | `ACCENT` |
| `#FF453A` | `SEM.danger` |
| `#8E8E93` | `SEM.ink3` |
| `#EDEDF0` | `SEM.ink2` |
| `#48484A` | `SEM.ink4` |
| `#2C2C2E` | `SEM.line2` |
| `#1C1C1E` | `SEM.surface3` |
| `#161618` | `SEM.surface2` |
| `#30D158` | `COLORS.green` |
| `#FF9F0A` | `COLORS.orange` |
| `#FFFFFF`/`#fff` | `SEM.ink1`(텍스트) — 순수 흰색 의도면 그대로 가능 |

## 타입 스케일 `TYPE` (실사용 11~30)
`{ micro 10, caption 12, footnote 13, body 15, callout 17, title 20, headline 24, display 30 }` + lineHeight.
실사용은 11·12·13·14·15·16·17·18에 분포 → 단계적으로 위 스케일로 수렴(인접 값 통합).
굵기 `WEIGHT { regular 400, medium 600, semibold 700, bold 800 }`.

## 간격 `SPACE` (4pt 그리드)
`{ xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32 }`. padding·margin·gap 공통.

## 반경 `RADIUS`
`{ sm 4, md 8, lg 12, card 14, xl 16, full 999 }`. card=카드(최다), xl=시트/큰 카드, full=알약.

## 공용 컴포넌트 (`components/ui/`)
화면마다 반복되던 패턴은 공용으로. 새 시트·행·알약은 여기 것을 쓴다.
- **`BottomSheet`** — 스크림+하단 도킹 시트(그립·제목·children). 정렬/그룹관리/기간선택 등 모든 바텀시트의 기반.
- (예정) `Pill`(그룹·세그먼트), `Card`, `Row`, `Skeleton`.

> 규칙: 색/간격/반경/타입은 토큰, 반복 UI는 `components/ui/`. PR에 하드코딩 hex 추가 금지.
