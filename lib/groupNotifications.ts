import { AppNotification, parseLinkParams } from '../db/api/notifications';

/**
 * 알림 표시용 그룹핑(중복 제거). 백엔드 알림 데이터는 보존하고, 같은 dedupKey끼리 1건으로 묶어
 * 발생 횟수·최근 시각·시각 목록을 함께 제공한다. (예: 정체 Squat 3번 → 1개 + "3번")
 */
export type NotifGroup = {
  dedupKey: string;
  type: AppNotification['type'];
  title: string;
  body: string;
  linkPath: string | null;
  linkParams: string | null;
  count: number;
  latestAt: string;
  times: string[];
  sample: AppNotification;
};

/** 정체 알림 본문 "Squat이(가) …" 에서 종목명을 뽑는다. 실패 시 null. */
export function stallExercise(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(/^(.+?)이\(가\)/) ?? body.match(/^(\S+)\s*가\s/);
  return m ? m[1].trim() : null;
}

function dedupKeyOf(n: AppNotification): string {
  if (n.type === 'STAGNATION') {
    const ex = stallExercise(n.body);
    return ex ? `stall:${ex}` : 'stall';
  }
  if (n.type === 'REPORT_READY') {
    const p = parseLinkParams(n.linkParams);
    return `report:${p?.type ?? 'week'}`;
  }
  if (n.type === 'PR') return 'pr';
  return `reminder:${n.type}`;
}

export function groupNotifications(items: AppNotification[]): NotifGroup[] {
  const byKey = new Map<string, NotifGroup>();
  // 최신이 먼저 들어오도록(백엔드 id DESC) 가정 — 첫 항목을 대표로.
  for (const n of items) {
    const key = dedupKeyOf(n);
    const g = byKey.get(key);
    if (!g) {
      byKey.set(key, {
        dedupKey: key, type: n.type, title: n.title, body: n.body,
        linkPath: n.linkPath, linkParams: n.linkParams,
        count: 1, latestAt: n.createdAt, times: [n.createdAt], sample: n,
      });
    } else {
      g.count += 1;
      g.times.push(n.createdAt);
      if (n.createdAt > g.latestAt) g.latestAt = n.createdAt;
    }
  }
  return Array.from(byKey.values()).sort((a, b) => (a.latestAt > b.latestAt ? -1 : 1));
}
