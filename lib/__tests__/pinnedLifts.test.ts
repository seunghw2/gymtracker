import { getSetting, setSetting } from '../../db/queries';
import { loadPinned, savePinned, isPin, togglePin } from '../pinnedLifts';

jest.mock('../../db/queries', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

const mockGet = getSetting as jest.Mock;
const mockSet = setSetting as jest.Mock;

beforeEach(() => { mockGet.mockReset(); mockSet.mockReset(); });

describe('pinnedLifts', () => {
  test('loadPinned: 쉼표 목록 파싱(공백·빈값 제거)', async () => {
    mockGet.mockResolvedValue('Squat, Bench Press ,, Deadlift');
    const set = await loadPinned();
    expect([...set]).toEqual(['Squat', 'Bench Press', 'Deadlift']);
  });

  test('savePinned: 쉼표로 join 저장', async () => {
    mockSet.mockResolvedValue(undefined);
    await savePinned(new Set(['Squat', 'OHP']));
    expect(mockSet).toHaveBeenCalledWith('ai_pinned_lifts', 'Squat,OHP');
  });

  test('isPin: 핀이 있으면 정확히 그 집합만', () => {
    const pinned = new Set(['My Curl']);
    expect(isPin('My Curl', pinned)).toBe(true);
    expect(isPin('Squat', pinned)).toBe(false);   // 핀 지정시 기본키워드 무시
  });

  test('isPin: 핀이 비면 기본 주력 키워드로 판정', () => {
    const empty = new Set<string>();
    expect(isPin('Barbell Squat', empty)).toBe(true);   // squat 포함
    expect(isPin('Bench Press', empty)).toBe(true);
    expect(isPin('Cable Fly', empty)).toBe(false);
  });

  test('togglePin: 추가/제거 토글(원본 불변)', () => {
    const a = new Set(['Squat']);
    const added = togglePin('Bench', a);
    expect([...added].sort()).toEqual(['Bench', 'Squat']);
    expect([...a]).toEqual(['Squat']);   // 원본 그대로
    const removed = togglePin('Squat', added);
    expect(removed.has('Squat')).toBe(false);
  });
});
