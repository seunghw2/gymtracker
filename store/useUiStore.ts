import { create } from 'zustand';
import { SessionSummary } from '../db/queries';

/**
 * 탭 간 일시적 UI 핸드오프 (비영속).
 * 세션 카드의 "운동 수정" → 운동 탭으로 이동해 편집 화면을 여는 데 사용.
 */
import type { Exercise } from '../db/api/types';

type UiState = {
  editTarget: SessionSummary | null;
  setEditTarget: (session: SessionSummary) => void;
  clearEditTarget: () => void;
  numPadOpen: boolean;
  setNumPadOpen: (open: boolean) => void;
  unread: number;
  setUnread: (n: number) => void;
  /**
   * 종목 선택 모달(exercise-add)을 "선택" 모드로 열 때 사용하는 콜백 채널.
   * 호출 측이 setExercisePickCb로 콜백을 등록 → exercise-add가 완료 시 호출.
   */
  exercisePickCb: ((exercises: Exercise[]) => void) | null;
  setExercisePickCb: (cb: ((exercises: Exercise[]) => void) | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  editTarget: null,
  setEditTarget: (session) => set({ editTarget: session }),
  clearEditTarget: () => set({ editTarget: null }),
  numPadOpen: false,
  setNumPadOpen: (open) => set({ numPadOpen: open }),
  unread: 0,
  setUnread: (n) => set({ unread: n }),
  exercisePickCb: null,
  setExercisePickCb: (cb) => set({ exercisePickCb: cb }),
}));
