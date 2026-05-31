import { create } from 'zustand';
import { SessionSummary } from '../db/queries';

/**
 * 탭 간 일시적 UI 핸드오프 (비영속).
 * 세션 카드의 "운동 수정" → 운동 탭으로 이동해 편집 화면을 여는 데 사용.
 */
type UiState = {
  editTarget: SessionSummary | null;
  setEditTarget: (session: SessionSummary) => void;
  clearEditTarget: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  editTarget: null,
  setEditTarget: (session) => set({ editTarget: session }),
  clearEditTarget: () => set({ editTarget: null }),
}));
