import { shouldRefreshBriefing } from '../briefingRefresh';

describe('shouldRefreshBriefing', () => {
  const today = '2026-06-22';
  test('처음(저장값 없음)이면 생성', () => {
    expect(shouldRefreshBriefing(null, today, false)).toBe(true);
  });
  test('날짜가 바뀌면(자정 경과) 재생성', () => {
    expect(shouldRefreshBriefing('2026-06-21', today, false)).toBe(true);
  });
  test('같은 날 + dirty 아니면 캐시 유지(재생성 안 함)', () => {
    expect(shouldRefreshBriefing(today, today, false)).toBe(false);
  });
  test('세션 완료(dirty)면 같은 날이라도 재생성', () => {
    expect(shouldRefreshBriefing(today, today, true)).toBe(true);
  });
});
