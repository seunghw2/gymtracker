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
  /** 운동 탭에서 앱 내 숫자패드가 떠 있는지 — 전역 휴식 타이머가 위로 비켜서기 위함 */
  numPadOpen: boolean;
  setNumPadOpen: (open: boolean) => void;
  /** 안 읽은 알림 수 — Chat 탭 배지용(NotificationBridge가 폴링으로 갱신, Chat 진입 시 0). */
  unread: number;
  setUnread: (n: number) => void;
};

export const useUiStore = create<UiState>((set) => ({
  editTarget: null,
  setEditTarget: (session) => set({ editTarget: session }),
  clearEditTarget: () => set({ editTarget: null }),
  numPadOpen: false,
  setNumPadOpen: (open) => set({ numPadOpen: open }),
  unread: 0,
  setUnread: (n) => set({ unread: n }),
}));
