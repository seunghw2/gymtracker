import { create } from 'zustand';
import {
  ChatConversation, ChatMsg, CreateConvInput, SendResult,
  listConversations, getConversationMessages, createConversation, sendChatMessage,
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
};

let tempId = -1;

export const useChatStore = create<ChatState>((set, get) => ({
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
}));
