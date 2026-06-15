import { useEffect, useState } from 'react';

/** 휴식 종료 시각(restTimerEnd)으로부터 남은 초를 매초 계산. 비활성 시 0. */
export function useRestRemaining(active: boolean, end: number | null): number {
  const [rem, setRem] = useState(0);
  useEffect(() => {
    if (!active || !end) { setRem(0); return; }
    const tick = () => setRem(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [active, end]);
  return rem;
}

/** 초 → "M:SS". */
export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
