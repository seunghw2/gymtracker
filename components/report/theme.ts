import { SEM, CATS, COACH_PURPLE } from '../../constants/colors';

/**
 * 리포트 화면 토큰 — 앱 전역 시맨틱(SEM, constants/colors.ts)에서 파생(단일 소스).
 * 규칙: 상태=good/warn/bad 3색만(**bad=주황**) · 분배=c1~c5 초록 계열 · 선택=good · 액션=action(브랜드 빨강, 의미엔 안 씀) · 코치=purple.
 */
export const RT = {
  // 배경/표면(시맨틱 파생)
  bg: SEM.bg,
  surface: SEM.surface,
  surface2: '#1f1f23',
  hair: 'rgba(255,255,255,0.06)',
  track: '#2a2a2f',

  // 텍스트
  ink: '#f5f5f7',
  ink2: '#9a9aa1',
  ink3: '#5e5e66',

  // 상태(의미 전용 — bad=주황, warn=노랑, good=초록)
  good: SEM.good,
  goodBg: 'rgba(43,217,106,0.14)',
  warn: SEM.warn,
  warnBg: 'rgba(255,197,61,0.15)',
  bad: SEM.bad,
  badBg: 'rgba(255,138,0,0.15)',

  // 분배/카테고리(초록 단일 계열, 밝음→어두움)
  c1: CATS[0],
  c2: CATS[1],
  c3: CATS[2],
  c4: CATS[3],
  c5: CATS[4],

  // 액션(브랜드 빨강) — 네비/다시받기/편집/파괴적. 경고에는 쓰지 않는다.
  action: SEM.brand,

  // 코치 페르소나(코치 탭 전용 — 데이터 탭 사용 금지)
  purple: COACH_PURPLE,
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
