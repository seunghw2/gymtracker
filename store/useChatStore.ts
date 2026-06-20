import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChatConversation, ChatMsg, CreateConvInput, SendResult,
  listConversations, getConversationMessages, createConversation, sendChatMessage, deleteConversation,
} from '../db/api/chat';

/**
 * AI 코치 대화(세션) 스토어. 데이터는 백엔드가 진실원이고, 여기선 화면용 캐시를 둔다.
 * 모든 호출은 실패해도 화면이 죽지 않게 안전 처리.
 */
type ChatState = {
  conversations: ChatConversation[];
  messagesByConv: Record<number, ChatMsg[]>;
  loadConversations: () => Promise<void>;
  loadMessages: (convId: number) => Promise<void>;
  findOrCreateByKey: (input: CreateConvInput) => Promise<ChatConversation | null>;
  appendLocal: (convId: number, role: 'user' | 'assistant', text: string) => ChatMsg;
  send: (convId: number, text: string) => Promise<SendResult | null>;
  remove: (convId: number) => Promise<void>;
};

let tempId = -1;

export const useChatStore = create<ChatState>()(persist((set, get) => ({
  conversations: [],
  messagesByConv: {},

  loadConversations: async () => {
    try {
      const list = await listConversations();
      set({ conversations: list });
    } catch (e) {
      console.warn('대화 목록 로드 실패', e);
    }
  },

  loadMessages: async (convId) => {
    try {
      const msgs = await getConversationMessages(convId);
      set(s => ({ messagesByConv: { ...s.messagesByConv, [convId]: msgs } }));
    } catch (e) {
      console.warn('메시지 로드 실패', e);
      set(s => ({ messagesByConv: { ...s.messagesByConv, [convId]: s.messagesByConv[convId] ?? [] } }));
    }
  },

  findOrCreateByKey: async (input) => {
    try {
      const conv = await createConversation(input);
      set(s => ({ conversations: [conv, ...s.conversations.filter(c => c.id !== conv.id)] }));
      return conv;
    } catch (e) {
      console.warn('대화 생성 실패', e);
      return null;
    }
  },

  appendLocal: (convId, role, text) => {
    const msg: ChatMsg = { id: tempId--, role, text, createdAt: new Date().toISOString() };
    set(s => ({ messagesByConv: { ...s.messagesByConv, [convId]: [...(s.messagesByConv[convId] ?? []), msg] } }));
    return msg;
  },

  send: async (convId, text) => {
    try {
      return await sendChatMessage(convId, text);
    } catch (e) {
      console.warn('메시지 전송 실패', e);
      return null;
    }
  },

  remove: async (convId) => {
    set(s => ({
      conversations: s.conversations.filter(c => c.id !== convId),
      messagesByConv: Object.fromEntries(Object.entries(s.messagesByConv).filter(([k]) => Number(k) !== convId)),
    }));
    try { await deleteConversation(convId); } catch (e) { console.warn('대화 삭제 실패', e); }
  },
}), {
  // 대화 목록을 로컬 캐시로 영속 → 재진입/콜드 스타트 시 네트워크 대기 없이 즉시 표시(SWR).
  // 메시지(messagesByConv)는 대화별로 다시 불러오므로 목록만 저장한다.
  name: 'chat-conversations',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (s) => ({ conversations: s.conversations }),
}));
