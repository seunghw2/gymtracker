import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { AI } from '../../constants/colors';
import { markAllNotificationsRead } from '../../db/api/notifications';
import { useChatStore } from '../../store/useChatStore';
import { useUiStore } from '../../store/useUiStore';
import { useWorkoutStore } from '../../store/useStore';
import { ensureWeeklyConversation } from '../../db/api/chat';

/** Chat 탭(허브): 접힌 알림 strip + 동적 스타터 + 최근 대화 + 입력창. 상세는 /chat/[id]. */
export default function ChatTab() {
  const router = useRouter();
  const setUnread = useUiStore(s => s.setUnread);
  const conversations = useChatStore(s => s.conversations);
  const loadConversations = useChatStore(s => s.loadConversations);
  const findOrCreateByKey = useChatStore(s => s.findOrCreateByKey);
  const removeConv = useChatStore(s => s.remove);

  const [refreshing, setRefreshing] = useState(false);
  const [firstLoading, setFirstLoading] = useState(true);   // 최초 로드 중 여부(스켈레톤 표시용)
  const workoutActive = useWorkoutStore(s => s.activeSessionId != null);

  const load = useCallback(async () => {
    // 코치 허브 진입 → 알림 배지 비움(알림은 이제 주간 채팅 메시지로 들어옴)
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
    // 이번 주 코치 대화 보장(크론이 못 돌았어도 보완) 후 목록 갱신
    try { await ensureWeeklyConversation(); } catch { /* ignore */ }
    await loadConversations();
  }, [loadConversations, setUnread]);

  useFocusEffect(useCallback(() => {
    // 화면 전환 애니메이션이 끝난 뒤 네트워크 로드 → 진입이 매끄럽고,
    // 그동안 캐시(persist)된 목록이나 스켈레톤이 먼저 자리잡는다.
    const task = InteractionManager.runAfterInteractions(() => {
      load().finally(() => setFirstLoading(false));
    });
    return () => task.cancel();
  }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const starters = ['이번 주 어땠어', '정체 풀기', '루틴 짜줘'];

  const goConv = (id: number, title: string, extra?: Record<string, string>) =>
    router.push({ pathname: '/chat/[conversationId]', params: { conversationId: String(id), title, ...(extra ?? {}) } });

  const startDirect = async (seed: string) => {
    const q = seed.trim();
    if (!q) return;
    const conv = await findOrCreateByKey({ source: 'direct', title: q.length > 20 ? q.slice(0, 20) + '…' : q });
    if (conv) goConv(conv.id, conv.title, { seed: q });
  };
  // 새 빈 대화 시작(FAB) — 상세 화면에서 입력
  const newChat = async () => {
    const conv = await findOrCreateByKey({ source: 'direct', title: '새 대화' });
    if (conv) goConv(conv.id, conv.title);
  };

  const tag = (src: string) => src === 'weekly' ? { t: '이번 주', c: AI.accent } : src === 'report' ? { t: '리포트', c: '#c3a8e8' } : src === 'alert' ? { t: '알림', c: AI.warn } : null;

  return (
    <SafeAreaView style={s.safe}>
        <View style={s.headTop}><Text style={s.title}>AI 코치</Text></View>

        <ScrollView contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AI.accent} />}>

          <Text style={s.lbl}>바로 물어보기</Text>
          <View style={s.starters}>
            {starters.map((st, i) => (
              <Pressable key={i} style={[s.start, i === 0 && s.startHl]} onPress={() => startDirect(st)}>
                <Text style={[s.startT, i === 0 && s.startTHl]}>{st}</Text>
              </Pressable>
            ))}
          </View>

          {conversations.length > 0 && <Text style={s.lbl}>최근 대화</Text>}
          {[...conversations].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).map(c => {
            const tg = tag(c.source);
            return (
              <Swipeable key={c.id} renderRightActions={() => (
                <Pressable style={s.swipeDel} onPress={() => removeConv(c.id)}><Text style={s.swipeDelT}>삭제</Text></Pressable>
              )}>
                <Pressable style={s.ses} onPress={() => goConv(c.id, c.title)}>
                  <Text style={s.sesT} numberOfLines={1}>💬 {c.title}</Text>
                  {!!c.preview && <Text style={s.sesP} numberOfLines={1}>{c.preview}</Text>}
                  <View style={s.sesMeta}>
                    {tg && <Text style={[s.tagx, { color: tg.c, backgroundColor: tg.c + '22' }]}>{tg.t}</Text>}
                    <Text style={s.tm}>{fmtDay(c.updatedAt)}</Text>
                  </View>
                </Pressable>
              </Swipeable>
            );
          })}

          {/* 첫 로딩 중엔 스켈레톤으로 골격을 먼저 고정(빈→채움 팝인 방지) */}
          {conversations.length === 0 && firstLoading && <ChatSkeleton />}
          {conversations.length === 0 && !firstLoading && (
            <View style={s.empty}><Text style={{ fontSize: 36, marginBottom: 10 }}>🤖</Text><Text style={s.emptyT}>운동에 대해 뭐든 물어보세요.</Text></View>
          )}
        </ScrollView>

        {/* 새 대화 FAB — 운동 중이면 배너 위로 올려 안 가리게 */}
        <Pressable style={[s.fab, { bottom: workoutActive ? 78 : 22 }]} onPress={newChat} accessibilityLabel="새 대화 시작">
          <Text style={s.fabIcon}>✎</Text>
        </Pressable>
    </SafeAreaView>
  );
}

/** 최근 대화 자리표시(스켈레톤) — 실제 카드(s.ses)와 같은 크기로 골격을 잡아 레이아웃 점프를 막는다. */
function ChatSkeleton() {
  return (
    <View>
      <Text style={s.lbl}>최근 대화</Text>
      {[0, 1].map(i => (
        <View key={i} style={s.ses}>
          <View style={[s.skel, { width: '55%', height: 13 }]} />
          <View style={[s.skel, { width: '80%', height: 11, marginTop: 8 }]} />
          <View style={[s.skel, { width: 48, height: 10, marginTop: 9 }]} />
        </View>
      ))}
    </View>
  );
}

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  headTop: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  body: { padding: 14, paddingBottom: 24 },

  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 12, padding: 12 },
  stripT: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  stripS: { color: '#7a7a7e', fontSize: 10.5, marginTop: 2 },
  go: { color: AI.textSub, fontSize: 15 },

  lbl: { color: '#6a6a6e', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 8, marginLeft: 2 },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  start: { borderWidth: 1, borderColor: '#2a2a30', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#0d0d0f' },
  startHl: { borderColor: AI.accent, backgroundColor: 'rgba(255,59,48,0.14)' },
  startT: { color: '#e4e4ea', fontSize: 12.5, fontWeight: '700' },
  startTHl: { color: '#fff' },

  ses: { backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#15151a', borderRadius: 12, padding: 12, marginBottom: 8 },
  sesT: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  sesP: { color: '#8a8a8e', fontSize: 11.5, marginTop: 4 },
  sesMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  tagx: { fontSize: 9.5, fontWeight: '800', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  tm: { color: '#6a6a6e', fontSize: 10, marginLeft: 'auto', fontVariant: ['tabular-nums'] },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyT: { color: AI.textSub, fontSize: 13 },
  skel: { backgroundColor: '#1a1a1f', borderRadius: 6 },

  swipeDel: { backgroundColor: '#FF453A', justifyContent: 'center', alignItems: 'center', width: 76, marginBottom: 8, borderRadius: 12 },
  swipeDelT: { color: '#fff', fontSize: 13, fontWeight: '800' },
  fab: { position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabIcon: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: -2 },
});
