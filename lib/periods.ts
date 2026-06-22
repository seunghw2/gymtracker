import { parseLocalDate } from './date';
import type { ReportPeriodType } from '../db/queries';

/**
 * AI 리포트 기간 선택 모델 — 달력 기준 주/월/분기/반기 버킷.
 * 최초 기록일이 속한 기간 ~ 현재(진행 중) 기간까지, 최신이 맨 앞.
 * 각 버킷의 start/end는 그대로 백엔드 getReportV2(range)로 넘어간다.
 */
export type PeriodUnit = 'week' | 'month' | 'quarter' | 'half' | 'year';

export type PeriodBucket = {
  label: string;      // 메인 라벨 (예: "6월 3주", "2026년 6월", "2026 2분기", "2026 상반기")
  sublabel: string;   // 보조 라벨 (날짜 범위)
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD
  isCurrent: boolean; // 진행 중(오늘이 속한) 기간
};

/** 세그먼트 컨트롤 항목 — 단위 라벨 + 백엔드 type 매핑. */
export const PERIOD_UNITS: { unit: PeriodUnit; label: string; type: ReportPeriodType }[] = [
  { unit: 'week', label: '주별', type: 'week' },
  { unit: 'month', label: '월별', type: 'month' },
  { unit: 'quarter', label: '분기', type: 'quarter' },
  { unit: 'half', label: '반기', type: 'half' },
  { unit: 'year', label: '연간', type: 'year' },
];

// ── 날짜 헬퍼(로컬 기준) ────────────────────────────────────────────────
function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
/** 월요일 시작 주의 월요일(홈 getWeekRange와 동일 관습). */
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}
const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
/** 그 달에서 몇 번째 주인지(1~). 월요일 일자 기준. */
function weekOfMonth(monday: Date): number {
  return Math.floor((monday.getDate() - 1) / 7) + 1;
}

/** 기록 날짜 목록에서 가장 이른 날짜(정렬 미가정). 없으면 null. */
export function earliestDate(dates: string[]): string | null {
  if (!dates.length) return null;
  let min = dates[0];
  for (const d of dates) if (d < min) min = d;
  return min;
}

/**
 * 단위별 기간 버킷 리스트(최신이 맨 앞). firstISO가 없으면 현재 기간 1개만.
 * 순수 함수 — 호출부에서 useMemo로 memoize한다.
 */
export function buildBuckets(unit: PeriodUnit, firstISO: string | null, now: Date = new Date()): PeriodBucket[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayISO = toISO(today);
  const first = firstISO ? parseLocalDate(firstISO) : today;
  const out: PeriodBucket[] = [];
  const mk = (label: string, sublabel: string, s: Date, e: Date): PeriodBucket => {
    const start = toISO(s), end = toISO(e);
    return { label, sublabel, start, end, isCurrent: start <= todayISO && todayISO <= end };
  };

  if (unit === 'week') {
    const firstMon = mondayOf(first);
    for (let mon = mondayOf(today); mon >= firstMon; mon = addDays(mon, -7)) {
      const end = addDays(mon, 6);
      out.push(mk(`${mon.getMonth() + 1}월 ${weekOfMonth(mon)}주`, `${md(mon)}–${md(end)}`, mon, end));
    }
  } else if (unit === 'month') {
    const firstM = new Date(first.getFullYear(), first.getMonth(), 1);
    for (let m = new Date(today.getFullYear(), today.getMonth(), 1); m >= firstM; m = new Date(m.getFullYear(), m.getMonth() - 1, 1)) {
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      out.push(mk(`${m.getFullYear()}년 ${m.getMonth() + 1}월`, `${md(m)}–${md(end)}`, m, end));
    }
  } else if (unit === 'quarter') {
    const firstQ = new Date(first.getFullYear(), Math.floor(first.getMonth() / 3) * 3, 1);
    for (let q = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1); q >= firstQ; q = new Date(q.getFullYear(), q.getMonth() - 3, 1)) {
      const end = new Date(q.getFullYear(), q.getMonth() + 3, 0);
      out.push(mk(`${q.getFullYear()} ${q.getMonth() / 3 + 1}분기`, `${q.getMonth() + 1}–${end.getMonth() + 1}월`, q, end));
    }
  } else if (unit === 'half') {
    const halfStartMonth = (d: Date) => (d.getMonth() < 6 ? 0 : 6);
    const firstH = new Date(first.getFullYear(), halfStartMonth(first), 1);
    for (let h = new Date(today.getFullYear(), halfStartMonth(today), 1); h >= firstH; h = new Date(h.getFullYear(), h.getMonth() - 6, 1)) {
      const end = new Date(h.getFullYear(), h.getMonth() + 6, 0);
      const h1 = h.getMonth() === 0;
      out.push(mk(`${h.getFullYear()} ${h1 ? '상' : '하'}반기`, h1 ? '1–6월' : '7–12월', h, end));
    }
  } else {
    const firstY = new Date(first.getFullYear(), 0, 1);
    for (let y = new Date(today.getFullYear(), 0, 1); y >= firstY; y = new Date(y.getFullYear() - 1, 0, 1)) {
      const end = new Date(y.getFullYear(), 11, 31);
      out.push(mk(`${y.getFullYear()}년`, '1–12월', y, end));
    }
  }
  return out;
}
