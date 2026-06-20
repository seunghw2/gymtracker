import { sortItems, SortItem } from '../exerciseSort';

const items: SortItem[] = [
  { exerciseId: 1, name: 'Squat', part: '하체', weight: 90, lastDate: '2026-06-16' },
  { exerciseId: 2, name: 'Bench Press', part: '가슴', weight: 80, lastDate: '2026-06-18' },
  { exerciseId: 3, name: 'Deadlift', part: '등', weight: 135, lastDate: '2026-06-10' },
  { exerciseId: 4, name: 'Pull Up', part: '등', weight: 0, lastDate: '2026-06-19' },
];
const ids = (a: SortItem[]) => a.map(x => x.exerciseId);

describe('sortItems', () => {
  it('manual: 입력 순서 유지', () => {
    expect(ids(sortItems(items, 'manual'))).toEqual([1, 2, 3, 4]);
  });
  it('recent: 최근 수행일 내림차순', () => {
    expect(ids(sortItems(items, 'recent'))).toEqual([4, 2, 1, 3]);
  });
  it('weight: 무게 내림차순(맨몸 0은 뒤)', () => {
    expect(ids(sortItems(items, 'weight'))).toEqual([3, 1, 2, 4]);
  });
  it('name: 가나다(영문 알파벳)', () => {
    expect(ids(sortItems(items, 'name'))).toEqual([2, 3, 4, 1]);
  });
  it('part: 부위 우선순서 → 이름', () => {
    const order = ['가슴', '등', '하체'];
    expect(ids(sortItems(items, 'part', order))).toEqual([2, 3, 4, 1]);
  });
  it('원본 불변(새 배열 반환)', () => {
    const before = ids(items);
    sortItems(items, 'weight');
    expect(ids(items)).toEqual(before);
  });
});
