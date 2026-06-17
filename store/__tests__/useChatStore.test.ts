import * as chatApi from '../../db/api/chat';
import { useChatStore } from '../useChatStore';

jest.mock('../../db/api/chat', () => ({
  listConversations: jest.fn(),
  getConversationMessages: jest.fn(),
  createConversation: jest.fn(),
  sendChatMessage: jest.fn(),
  deleteConversation: jest.fn(),
}));

const api = chatApi as jest.Mocked<typeof chatApi>;

beforeEach(() => {
  useChatStore.setState({ conversations: [], messagesByConv: {} });
  jest.clearAllMocks();
});

describe('useChatStore', () => {
  test('appendLocal: 메시지 누적(임시 음수 id)', () => {
    const m = useChatStore.getState().appendLocal(5, 'user', '안녕');
    expect(m.role).toBe('user');
    expect(m.text).toBe('안녕');
    expect(m.id).toBeLessThan(0);
    expect(useChatStore.getState().messagesByConv[5]).toHaveLength(1);
  });

  test('findOrCreateByKey: 생성된 대화를 맨 앞에', async () => {
    const conv = { id: 9, title: 'Squat 정체', source: 'alert' as const, sourceKey: 'stall:Squat', preview: null, updatedAt: null };
    api.createConversation.mockResolvedValue(conv);
    const r = await useChatStore.getState().findOrCreateByKey({ source: 'alert', sourceKey: 'stall:Squat', title: 'Squat 정체' });
    expect(r).toEqual(conv);
    expect(useChatStore.getState().conversations[0]).toEqual(conv);
  });

  test('findOrCreateByKey: 실패 시 null, 목록 불변', async () => {
    api.createConversation.mockRejectedValue(new Error('x'));
    const r = await useChatStore.getState().findOrCreateByKey({ source: 'direct', title: '새 대화' });
    expect(r).toBeNull();
    expect(useChatStore.getState().conversations).toHaveLength(0);
  });

  test('remove: 대화·메시지 제거 + 백엔드 삭제 호출', async () => {
    useChatStore.setState({
      conversations: [{ id: 1, title: 'A', source: 'direct', sourceKey: null, preview: null, updatedAt: null }],
      messagesByConv: { 1: [{ id: -1, role: 'user', text: 'hi', createdAt: null }] },
    });
    api.deleteConversation.mockResolvedValue(undefined);
    await useChatStore.getState().remove(1);
    expect(useChatStore.getState().conversations).toHaveLength(0);
    expect(useChatStore.getState().messagesByConv[1]).toBeUndefined();
    expect(api.deleteConversation).toHaveBeenCalledWith(1);
  });
});
