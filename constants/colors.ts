/**
 * 앱 공통 색 토큰. CARBON 디자인 시스템 — 블랙 배경 + 레드 액센트.
 * 브랜드 액센트(버튼·활성·헤더·진행바)는 레드로 통일하고, 증감/경고 같은 의미색은 따로 둔다.
 */
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
