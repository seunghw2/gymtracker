/**
 * 앱 공통 색 토큰. CARBON 디자인 시스템 — 블랙 배경 + 레드 액센트.
 * 브랜드 액센트(버튼·활성·헤더·진행바)는 레드로 통일하고, 증감/경고 같은 의미색은 따로 둔다.
 */

/**
 * 시맨틱 토큰(단일 소스). 색의 "의미"를 이름으로 고정한다.
 * - brand/onBrand : 액션·활성(탭·버튼) 전용. 의미(경고)에는 쓰지 않는다.
 * - good/warn/bad : 상태. **bad=주황**(미달·부족·위험), warn=노랑, good=초록.
 * - bg/surface/line/muted/text : 표면·구분선·약한 글자.
 * P1에선 토큰 정의만 추가하고 화면 값은 P5에서 점진 치환한다(여기선 렌더 변화 없음).
 */
export const SEM = {
  brand: '#FF3B30',
  onBrand: '#FFFFFF',
  good: '#2BD96A',
  warn: '#FFC53D',
  bad: '#FF8A00',
  bg: '#000000',
  surface: '#0D0D0D',
  line: '#1A1A1A',
  muted: '#6A6A6A',
  text: '#FFFFFF',

  // 표면 elevation 스케일(어두움→밝음). 카드/모달/칩 배경 통일용.
  surface1: '#0D0D0D',   // 기본 카드
  surface2: '#161618',   // 한 단계 위(강조 카드)
  surface3: '#1C1C1E',   // 모달·지표·세그먼트
  line2: '#2C2C2E',      // 강한 구분선/입력 테두리

  // 텍스트 잉크 스케일(밝음→어두움).
  ink1: '#FFFFFF',       // 1차 텍스트
  ink2: '#EDEDF0',       // 밝은 보조
  ink3: '#8E8E93',       // 약한 보조(캡션)
  ink4: '#48484A',       // 가장 약함(placeholder)
} as const;

/** 분배/카테고리 보조 팔레트(초록 단일 계열, 밝음→어두움). 시맨틱 외 보조색. */
export const CATS = ['#3ee06a', '#26a64c', '#1c7a3a', '#15532a', '#2c2c31'] as const;
/** 코치 페르소나 보조색(코치 탭 전용). */
export const COACH_PURPLE = '#9f8fef';
export const COLORS = {
  green: '#30D158',      // (의미색) 증가/긍정 — 브랜드 액센트 아님
  greenInk: '#06210F',
  red: '#FF453A',        // 위험/감소
  orange: '#FF9F0A',     // 경고/워밍업
  purple: '#BF5AF2',     // 드롭세트
  blue: '#0A84FF',
  gold: '#FFD60A',       // 즐겨찾기 별
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
} as const;

/** CARBON 브랜드 액센트(레드). 버튼·활성 탭·헤더·진행바 등 강조 전반. */
export const ACCENT = '#FF3B30';
/** 레드 액센트 위 텍스트(흰색). */
export const ACCENT_INK = '#FFFFFF';
/** 증가/긍정 의미색(브랜드색과 분리). */
export const UP = COLORS.green;

/**
 * 레거시 단축 토큰. 과거 그린 브랜드 액센트로 쓰이던 자리를 CARBON 레드로 repoint.
 * (이 토큰을 쓰던 화면은 자동으로 레드화된다.)
 */
export const GREEN = ACCENT;

/**
 * AI(애널리스트) 화면 토큰. CARBON 통일에 맞춰 액센트를 레드로 repoint.
 */
export const AI = {
  accent: ACCENT,           // 레드 액센트
  ink: ACCENT_INK,          // 액센트 위 텍스트(흰색)
  tint: '#241011',          // 강조 버블/카드 배경(레드 틴트)
  bubble: '#1C1C1E',        // AI 말풍선
  card: '#161618',
  line: '#2C2C2E',
  text: '#FFFFFF',
  textSub: '#8E8E93',
  faint: '#48484A',
  warn: '#FF9F0A',
  danger: '#FF453A',
} as const;
