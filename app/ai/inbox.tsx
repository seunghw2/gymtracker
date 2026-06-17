import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../../constants/colors';
import { getNotifications, markAllNotificationsRead, parseLinkParams, AppNotification } from '../../db/api/notifications';
import { groupNotifications, NotifGroup, stallExercise } from '../../lib/groupNotifications';
import { useChatStore } from '../../store/useChatStore';
import { useUiStore } from '../../store/useUiStore';

const ICON: Record<string, string> = { REPORT_READY: '📊', STAGNATION: '⚠️', PR: '💪', REMINDER: '🔔' };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return d.toDateString() === new Date().toDateString() ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/** 새 소식(알림) — 같은 종류는 중복 묶음 처리. 각 항목에서 AI 코치 대화로 풀 수 있다. */
export default function AiInboxScreen() {
  const router = useRouter();
  const setUnread = useUiStore(s => s.setUnread);
  const findOrCreateByKey = useChatStore(s => s.findOrCreateByKey);
  const [groups, setGroups] = useState<NotifGroup[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getNotifications();
      setGroups(groupNotifications(r.items));
      if (r.unreadCount > 0) markAllNotificationsRead().catch(() => {});
      setUnread(0);
    } catch {
      setGroups([]);
    }
  }, [setUnread]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const openLink = (n: AppNotification) => {
    if (!n.linkPath) return;
    router.push({ pathname: n.linkPath as never, params: parseLinkParams(n.linkParams) as never });
  };

  // 알림 → AI 코치 대화로 풀기(중복방지: dedupKey를 sourceKey로)
  const talk = async (g: NotifGroup) => {
    const isReport = g.type === 'REPORT_READY';
    const ex = stallExercise(g.body);
    const title = g.type === 'STAGNATION' ? `${ex ?? '정체'} 정체 풀기` : isReport ? g.title.replace(' 리포트가 나왔어요', ' 회고') : g.title;
    const periodType = isReport ? (parseLinkParams(g.linkParams)?.type ?? 'week') : undefined;
    const conv = await findOrCreateByKey({
      source: isReport ? 'report' : 'alert',
      sourceKey: g.dedupKey,
      title,
      periodType,
    });
    if (conv) {
      const seed = g.type === 'STAGNATION' ? `${ex ?? '이 종목'} 정체 어떻게 풀어?` : '이거 자세히 설명해줘';
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId: String(conv.id), title: conv.title, seed, ctx: g.title } });
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={s.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.hName}>새 소식</Text>
          <Text style={s.hSub}>중복은 묶음 처리</Text>
        </View>
      </View>

      {!groups ? (
        <View style={s.center}><ActivityIndicator color={AI.accent} size="large" /></View>
      ) : groups.length === 0 ? (
        <View style={s.center}><Text style={{ fontSize: 40, marginBottom: 10 }}>📭</Text><Text style={s.dim}>아직 받은 소식이 없어요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AI.accent} />}>
          {groups.map((g, i) => (
            <View key={i} style={[s.card, g.type === 'STAGNATION' && s.cardWarn]}>
              <View style={s.rowTop}>
                <Text style={s.icon}>{ICON[g.type] ?? '🔔'}</Text>
                <Text style={s.title}>{g.title}{g.count > 1 && <Text style={s.grp}>  {g.count}번</Text>}</Text>
                <Text style={s.time}>{fmtTime(g.latestAt)}</Text>
              </View>
              <Text style={s.bodyText}>{g.body}</Text>
              {g.count > 1 && <Text style={s.dup}>최근 {g.times.slice(0, 3).map(fmtTime).join(' · ')} (묶음)</Text>}
              <Pressable style={s.cta} onPress={() => talk(g)}><Text style={s.ctaText}>💬 대화로 풀기</Text></Pressable>
              {!!g.linkPath && <Pressable onPress={() => openLink(g.sample)}><Text style={s.go}>보기 ›</Text></Pressable>}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 28, width: 22, marginTop: -3 },
  hName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 10.5, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: AI.textSub, fontSize: 13 },
  body: { padding: 14, gap: 9, paddingBottom: 24 },
  card: { backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 14, padding: 13 },
  cardWarn: { borderColor: 'rgba(255,59,48,0.28)' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  icon: { fontSize: 14 },
  title: { color: '#fff', fontSize: 12.5, fontWeight: '800', flex: 1 },
  grp: { color: '#fff', fontSize: 10, fontWeight: '800', backgroundColor: '#FF8A00', borderRadius: 6, paddingHorizontal: 5, overflow: 'hidden' },
  time: { color: '#6a6a6e', fontSize: 9.5 },
  bodyText: { color: '#c8c8ce', fontSize: 13.5, lineHeight: 19 },
  dup: { color: '#6a6a6e', fontSize: 9.5, marginTop: 7 },
  cta: { marginTop: 9, backgroundColor: 'rgba(255,59,48,0.14)', borderWidth: 1, borderColor: AI.accent, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  go: { color: AI.accent, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
