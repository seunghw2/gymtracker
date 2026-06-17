import { apiRequest } from '../../lib/api';

// ── AI 코치 대화(세션) — 백엔드 camelCase 응답과 1:1 ────────────────────
export type ChatSource = 'report' | 'alert' | 'direct';

export type ChatConversation = {
  id: number;
  title: string;
  source: ChatSource;
  sourceKey: string | null;
  preview: string | null;
  updatedAt: string | null;
};

export type ChatMsg = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string | null;
};

export type CreateConvInput = {
  title?: string;
  source: ChatSource;
  sourceKey?: string | null;
  periodType?: string | null;
  from?: string | null;
  to?: string | null;
};

export type SendResult = {
  userMessage: ChatMsg;
  assistantMessage: ChatMsg;
  suggestedQuestions: string[];
};

export async function listConversations(): Promise<ChatConversation[]> {
  return apiRequest<ChatConversation[]>('/api/v1/ai/conversations', { method: 'GET' });
}

export async function getConversationMessages(id: number): Promise<ChatMsg[]> {
  return apiRequest<ChatMsg[]>(`/api/v1/ai/conversations/${id}/messages`, { method: 'GET' });
}

/** sourceKey가 있으면 기존 대화 반환(중복 방지), 없으면 새 direct 대화 생성. */
export async function createConversation(input: CreateConvInput): Promise<ChatConversation> {
  return apiRequest<ChatConversation>('/api/v1/ai/conversations', { method: 'POST', body: input });
}

/** 메시지 전송 → AI 코치 답변 생성·저장 후 반환. */
export async function sendChatMessage(id: number, text: string): Promise<SendResult> {
  return apiRequest<SendResult>(`/api/v1/ai/conversations/${id}/messages`, { method: 'POST', body: { text } });
}
