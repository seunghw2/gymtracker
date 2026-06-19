import {
  buildPellets, groupRows, systemRows, addMembers, removeMember, moveMember,
} from '../exerciseGroups';
import type { ExerciseGroup } from '../../db/api/exerciseGroups';
import type { ExerciseSummary } from '../../db/api/stats';

const grp = (id: number, name: string, sortIndex: number, exerciseIds: number[] = []): ExerciseGroup => ({ id, name, sortIndex, exerciseIds });
const sum = (id: number, name: string): ExerciseSummary => ({
  exerciseId: id, name, bodyPart: '등', currentE1rm: 100, prE1rm: 100, prDate: null,
  plateauWeeks: 0, trend: 'up', delta: 0, spark: [1, 2], lastDate: null,
});

describe('buildPellets', () => {
  it('기본·이번주·지난주 먼저, 그 뒤 커스텀 sortIndex 순', () => {
    const pellets = buildPellets([grp(2, 'B', 1), grp(1, 'A', 0)]);
    expect(pellets.map(p => p.name)).toEqual(['기본', '이번주', '지난주', 'A', 'B']);
    expect(pellets.slice(0, 3).every(p => p.kind === 'system')).toBe(true);
  });
});

describe('groupRows', () => {
  it('담은 순서 유지 + 목록에 없는 id는 스킵', () => {
    const byId = new Map([1, 2, 3].map(i => [i, sum(i, 'E' + i)]));
    expect(groupRows([3, 99, 1], byId).map(r => r.exerciseId)).toEqual([3, 1]);
  });
});

describe('systemRows', () => {
  const rows = [sum(1, 'A'), sum(2, 'B'), sum(3, 'C')];
  it('all은 전체', () => expect(systemRows('all', rows, new Set()).length).toBe(3));
  it('thisWeek은 그 주 수행 종목만', () =>
    expect(systemRows('thisWeek', rows, new Set([1, 3])).map(r => r.exerciseId)).toEqual([1, 3]));
});

describe('멤버십 연산', () => {
  it('addMembers 중복 제거·순서 보존', () => expect(addMembers([1, 2], [2, 3, 4])).toEqual([1, 2, 3, 4]));
  it('removeMember', () => expect(removeMember([1, 2, 3], 2)).toEqual([1, 3]));
  it('moveMember 끝으로', () => expect(moveMember([1, 2, 3], 0, 2)).toEqual([2, 3, 1]));
  it('moveMember 범위 밖이면 그대로', () => expect(moveMember([1, 2], 0, 5)).toEqual([1, 2]));
});
