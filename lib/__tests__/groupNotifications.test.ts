import { groupNotifications, stallExercise } from '../groupNotifications';
import type { AppNotification } from '../../db/api/notifications';

let id = 0;
function notif(over: Partial<AppNotification>): AppNotification {
  return {
    id: ++id, type: 'STAGNATION', title: '정체', body: 'Squat이(가) 정체됐어요',
    read: false, linkPath: null, linkParams: null, createdAt: '2026-06-01T10:00:00', ...over,
  };
}

describe('stallExercise 본문 파싱', () => {
  test('"X이(가) …"에서 종목명 추출', () => {
    expect(stallExercise('Squat이(가) 6주째 정체')).toBe('Squat');
    expect(stallExercise('Bench Press이(가) 정체')).toBe('Bench Press');
  });
  test('빈/형식불일치는 null', () => {
    expect(stallExercise(null)).toBeNull();
    expect(stallExercise('알 수 없는 본문')).toBeNull();
  });
});

describe('groupNotifications 중복 묶음', () => {
  test('같은 정체 종목 3건 → 1그룹 count 3', () => {
    const groups = groupNotifications([
      notif({ body: 'Squat이(가) 정체', createdAt: '2026-06-03T10:00:00' }),
      notif({ body: 'Squat이(가) 정체', createdAt: '2026-06-02T10:00:00' }),
      notif({ body: 'Squat이(가) 정체', createdAt: '2026-06-01T10:00:00' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].dedupKey).toBe('stall:Squat');
    expect(groups[0].count).toBe(3);
    expect(groups[0].latestAt).toBe('2026-06-03T10:00:00');
  });

  test('다른 종목은 별도 그룹, 최신순 정렬', () => {
    const groups = groupNotifications([
      notif({ body: 'Bench이(가) 정체', createdAt: '2026-06-05T10:00:00' }),
      notif({ body: 'Squat이(가) 정체', createdAt: '2026-06-04T10:00:00' }),
    ]);
    expect(groups.map(g => g.dedupKey)).toEqual(['stall:Bench', 'stall:Squat']);
  });

  test('REPORT_READY는 linkParams type별 묶음', () => {
    const groups = groupNotifications([
      notif({ type: 'REPORT_READY', body: '월간 리포트', linkParams: '{"type":"month"}' }),
      notif({ type: 'REPORT_READY', body: '월간 리포트', linkParams: '{"type":"month"}' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].dedupKey).toBe('report:month');
    expect(groups[0].count).toBe(2);
  });

  test('하나라도 안읽음이면 그룹 unread', () => {
    const groups = groupNotifications([
      notif({ body: 'Squat이(가) 정체', read: true, createdAt: '2026-06-02T10:00:00' }),
      notif({ body: 'Squat이(가) 정체', read: false, createdAt: '2026-06-01T10:00:00' }),
    ]);
    expect(groups[0].unread).toBe(true);
  });
});
