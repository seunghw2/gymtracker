import { bucketExercises, sortExercises, STALE_WEEKS } from '../exerciseSections';
import type { ExerciseSummary } from '../../db/api/stats';

function row(p: Partial<ExerciseSummary> & { name: string }): ExerciseSummary {
  return {
    exerciseId: Math.floor(Math.random() * 1e6),
    name: p.name,
    bodyPart: p.bodyPart ?? '등',
    currentE1rm: p.currentE1rm ?? 100,
    prE1rm: p.prE1rm ?? 100,
    prDate: p.prDate ?? '2026-06-01',
    plateauWeeks: p.plateauWeeks ?? 0,
    trend: p.trend ?? 'up',
    delta: p.delta ?? 0,
    spark: p.spark ?? [1, 2, 3],
    lastDate: p.lastDate ?? '2026-06-10',
  };
}

const noPins = () => false;

describe('bucketExercises', () => {
  it('신기록(trend=new)은 주목으로, 일반 상승은 관심으로', () => {
    const b = bucketExercises([row({ name: 'A', trend: 'new' }), row({ name: 'B', trend: 'up' })], noPins, '1rm');
    expect(b.highlight.map(r => r.name)).toEqual(['A']);
    expect(b.watch.map(r => r.name)).toEqual(['B']);
  });

  it(`정체 ${STALE_WEEKS}주 이상만 멈춤, 미만은 관심`, () => {
    const b = bucketExercises([
      row({ name: 'old', trend: 'flat', plateauWeeks: STALE_WEEKS }),
      row({ name: 'mild', trend: 'flat', plateauWeeks: STALE_WEEKS - 1 }),
    ], noPins, '1rm');
    expect(b.stale.map(r => r.name)).toEqual(['old']);
    expect(b.watch.map(r => r.name)).toEqual(['mild']);
  });

  it('★보유는 신기록·정체여도 보유에 남는다', () => {
    const isPin = (n: string) => n === 'fav';
    const b = bucketExercises([
      row({ name: 'fav', trend: 'flat', plateauWeeks: 99 }),
      row({ name: 'other', trend: 'new' }),
    ], isPin, '1rm');
    expect(b.pinned.map(r => r.name)).toEqual(['fav']);
    expect(b.stale).toHaveLength(0);
    expect(b.highlight.map(r => r.name)).toEqual(['other']);
  });
});

describe('sortExercises', () => {
  const rows = [
    row({ name: 'Bench', currentE1rm: 120, plateauWeeks: 2, lastDate: '2026-06-01' }),
    row({ name: 'Apex', currentE1rm: 80, plateauWeeks: 50, lastDate: '2026-06-15' }),
    row({ name: 'Curl', currentE1rm: 100, plateauWeeks: 10, lastDate: '2026-05-20' }),
  ];
  it('1RM 높은순', () => expect(sortExercises(rows, '1rm').map(r => r.name)).toEqual(['Bench', 'Curl', 'Apex']));
  it('정체 오래된순', () => expect(sortExercises(rows, 'plateau').map(r => r.name)).toEqual(['Apex', 'Curl', 'Bench']));
  it('최근 운동순', () => expect(sortExercises(rows, 'recent').map(r => r.name)).toEqual(['Apex', 'Bench', 'Curl']));
  it('이름순', () => expect(sortExercises(rows, 'name').map(r => r.name)).toEqual(['Apex', 'Bench', 'Curl']));
});
