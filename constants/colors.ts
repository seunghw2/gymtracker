/**
 * 앱 공통 색 토큰. 화면마다 흩어져 있던 hex 리터럴을 한곳으로 모은다.
 * (하단 탭바의 활성 그린 #27E06A는 의도적으로 분리된 스펙이라 CustomTabBar 안에 둔다.)
 */
export const COLORS = {
  green: '#30D158',      // 브랜드 그린(주요 강조)
  greenInk: '#06210F',   // 그린 위 텍스트
  red: '#FF453A',        // 위험/감소
  orange: '#FF9F0A',     // 경고/워밍업
  purple: '#BF5AF2',     // 드롭세트
  blue: '#0A84FF',
  gold: '#FFD60A',       // 즐겨찾기 별
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
} as const;

/** 가장 자주 쓰는 브랜드 그린 단축 토큰. */
export const GREEN = COLORS.green;

/**
 * AI(애널리스트) 화면 전용 액센트. 시안의 보라 톤 — 임시값이며 브랜드색 확정 시 여기만 교체.
 * 나머지 앱은 그린 유지.
 */
export const AI = {
  accent: '#9D7BFF',        // 보라 액센트
  ink: '#160A2E',           // 액센트 위 텍스트
  tint: '#191232',          // 강조 버블/카드 배경
  bubble: '#1C1C1E',        // AI 말풍선
  card: '#161618',
  line: '#2C2C2E',
  text: '#FFFFFF',
  textSub: '#8E8E93',
  faint: '#48484A',
  warn: '#FF9F0A',
  danger: '#FF453A',
} as const;
