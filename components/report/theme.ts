/**
 * 리포트 화면 전용 디자인 토큰(명세 §2). 앱 전역 colors.ts(CARBON 레드)와 분리.
 * 규칙: 상태=good/warn/bad 3색만 · 분배=c1~c5 초록 계열(밝을수록 큼) · 선택=good · 액션/나쁨=action · 코치=purple.
 */
export const RT = {
  // 배경/표면
  bg: '#0a0a0b',
  surface: '#161619',
  surface2: '#1f1f23',
  hair: 'rgba(255,255,255,0.06)',
  track: '#2a2a2f',

  // 텍스트
  ink: '#f5f5f7',
  ink2: '#9a9aa1',
  ink3: '#5e5e66',

  // 상태(의미 표현 전용 — 이 3색만)
  good: '#30d158',
  goodBg: 'rgba(48,209,88,0.13)',
  warn: '#ffb340',
  warnBg: 'rgba(255,179,64,0.13)',
  bad: '#ff453a',
  badBg: 'rgba(255,69,58,0.13)',

  // 분배/카테고리(초록 단일 계열, 밝음→어두움)
  c1: '#3ee06a',
  c2: '#26a64c',
  c3: '#1c7a3a',
  c4: '#15532a',
  c5: '#2c2c31',

  // 액션(빨강) — 네비/다시받기/편집/파괴적/bad
  action: '#ff453a',

  // 코치 페르소나(코치 탭 전용 — 데이터 탭 사용 금지)
  purple: '#9f8fef',
  purpleD: '#6c5ce0',
  purpleBg: 'rgba(159,143,239,0.13)',
  purpleLine: 'rgba(159,143,239,0.4)',
} as const;

export type RtTone = 'ok' | 'good' | 'warn' | 'bad';

/** 상태 톤 → 본색. ok는 good 취급. */
export function toneColor(tone?: string): string {
  switch (tone) {
    case 'bad': return RT.bad;
    case 'warn': return RT.warn;
    default: return RT.good;
  }
}
/** 상태 톤 → 연한 배경. */
export function toneBg(tone?: string): string {
  switch (tone) {
    case 'bad': return RT.badBg;
    case 'warn': return RT.warnBg;
    default: return RT.goodBg;
  }
}
/** 분배 차트 랭킹 색(0이 가장 밝음/큼). */
export const CAT = [RT.c1, RT.c2, RT.c3, RT.c4, RT.c5] as const;
export function catColor(rank: number): string {
  return CAT[Math.min(rank, CAT.length - 1)];
}
