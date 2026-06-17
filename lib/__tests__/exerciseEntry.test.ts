import { getLastSessionSets, get1RMHistory } from '../../db/queries';
import { buildExerciseEntry } from '../exerciseEntry';

jest.mock('../../db/queries', () => ({
  getLastSessionSets: jest.fn(),
  get1RMHistory: jest.fn(),
}));

const mockLast = getLastSessionSets as jest.Mock;
const mockRm = get1RMHistory as jest.Mock;

beforeEach(() => { mockLast.mockReset(); mockRm.mockReset(); });

describe('buildExerciseEntry', () => {
  test('지난 세션 값으로 프리필 + 역대 최고 1RM', async () => {
    mockLast.mockResolvedValue([
      { weight_kg: 100, reps: 5, duration_sec: null },
      { weight_kg: 100, reps: 4, duration_sec: null },
    ]);
    mockRm.mockResolvedValue([{ date: '2026-01-01', estimated_1rm: 110 }, { date: '2026-02-01', estimated_1rm: 120 }]);

    const e = await buildExerciseEntry({ id: 1, name: 'Squat', brand: null });

    expect(e.sets).toHaveLength(2);
    expect(e.sets[0]).toMatchObject({ setOrder: 1, weight_kg: 100, reps: 5, done: false, setType: 'NORMAL' });
    expect(e.lastSets).toEqual([{ weight_kg: 100, reps: 5 }, { weight_kg: 100, reps: 4 }]);
    expect(e.prevBest1rm).toBe(120);
    expect(e.timeBased).toBe(false);
    expect(e.bodyweight).toBe(false);
  });

  test('기록 없으면 기본 1세트(reps 10, weight 0)', async () => {
    mockLast.mockResolvedValue([]);
    mockRm.mockResolvedValue([]);
    const e = await buildExerciseEntry({ id: 2, name: 'New Lift', brand: 'X' });
    expect(e.sets).toEqual([{ setOrder: 1, weight_kg: 0, reps: 10, done: false, setType: 'NORMAL', durationSec: undefined }]);
    expect(e.prevBest1rm).toBe(0);
  });

  test('시간기반 종목은 durationSec 기본', async () => {
    mockLast.mockResolvedValue([]);
    mockRm.mockResolvedValue([]);
    const e = await buildExerciseEntry({ id: 3, name: 'Plank', brand: null, tracking_type: 'TIME' });
    expect(e.timeBased).toBe(true);
    expect(e.sets[0].durationSec).toBe(30);
    expect(e.sets[0].reps).toBe(0);
  });

  test('1RM 조회 실패해도 entry 생성(prevBest1rm 0)', async () => {
    mockLast.mockResolvedValue([]);
    mockRm.mockRejectedValue(new Error('network'));
    const e = await buildExerciseEntry({ id: 4, name: 'Dip', brand: null, equipment_type: 'Bodyweight' });
    expect(e.bodyweight).toBe(true);
    expect(e.prevBest1rm).toBe(0);
  });
});
