import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../../constants/colors';
import { getNotifications, markAllNotificationsRead, clearNotifications, AppNotification } from '../../db/api/notifications';
import { groupNotifications, NotifGroup } from '../../lib/groupNotifications';
import { useUiStore } from '../../store/useUiStore';
import NotifDetailSheet from '../../components/NotifDetailSheet';

const ICON: Record<string, string> = { REPORT_READY: '📊', STAGNATION: '⚠️', PR: '💪', REMINDER: '🔔' };
const ICON_BG: Record<string, string> = {
  STAGNATION: 'rgba(255,197,61,0.14)', REPORT_READY: 'rgba(91,141,239,0.16)',
  PR: 'rgba(43,217,106,0.16)', REMINDER: 'rgba(255,138,0,0.16)',
};
const PR_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;   // PR은 14일 후 자연 숨김

function dayLabel(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtTime(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  if (dayLabel(iso) === '오늘') return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return dayLabel(iso);
}

/** 새 소식 — 컴팩트 행·시간순·중복 묶음·자동 읽음. 탭하면 타입별 리치 시트. */
export default function AiInboxScreen() {
  const router = useRouter();
  const setUnread = useUiStore(s => s.setUnread);
  const [groups, setGroups] = useState<NotifGroup[] | null>(null);
  const [markedRead, setMarkedRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<NotifGroup | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getNotifications();
      const now = Date.now();
      const items = r.items.filter(n => !(n.type === 'PR' && now - new Date(n.createdAt).getTime() > PR_MAX_AGE_MS));
      setGroups(groupNotifications(items).sort((a, b) => (a.latestAt > b.latestAt ? -1 : 1)));
      setMarkedRead(false);
      if (r.unreadCount > 0) markAllNotificationsRead().then(() => setMarkedRead(true)).catch(() => {});
      else setMarkedRead(true);
      setUnread(0);
    } catch {
      setGroups([]);
    }
  }, [setUnread]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const clearAll = () => {
    Alert.alert('모두 지우기', '새 소식을 모두 지울까요?', [
      { text: '취소', style: 'cancel' },
      { text: '지우기', style: 'destructive', onPress: async () => { setGroups([]); setUnread(0); await clearNotifications().catch(() => {}); } },
    ]);
  };

  let lastDay = '';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={s.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.hName}>새 소식</Text>
          <Text style={s.hSub}>중복은 묶음 처리</Text>
        </View>
        {!!groups?.length && <Pressable onPress={clearAll} hitSlop={8}><Text style={s.clear}>모두 지우기</Text></Pressable>}
      </View>

      {!groups ? (
        <View style={s.center}><ActivityIndicator color={AI.accent} size="large" /></View>
      ) : groups.length === 0 ? (
        <View style={s.center}><Text style={{ fontSize: 40, marginBottom: 10 }}>📭</Text><Text style={s.dim}>아직 받은 소식이 없어요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AI.accent} />}>
          {groups.map((g, i) => {
            const day = dayLabel(g.latestAt);
            const divider = day !== lastDay ? (lastDay = day, day) : null;
            const unread = g.unread && !markedRead;
            return (
              <React.Fragment key={g.dedupKey + i}>
                {divider && <Text style={s.dayDiv}>{divider}</Text>}
                <Pressable style={[s.row, unread && s.rowDot, !unread && s.rowRead]} onPress={() => setSheet(g)}>
                  {unread && <View style={s.udot} />}
                  <View style={[s.ic, { backgroundColor: ICON_BG[g.type] }]}><Text style={{ fontSize: 15 }}>{ICON[g.type] ?? '🔔'}</Text></View>
                  <View style={s.mid}>
                    <View style={s.ttRow}>
                      <Text style={s.tt} numberOfLines={1}>{g.title}</Text>
                      {g.count > 1 && <Text style={s.badge}>{g.count}번</Text>}
                    </View>
                    <Text style={s.bd} numberOfLines={1}>{g.body}</Text>
                  </View>
                  <View style={s.rt}><Text style={s.tm}>{fmtTime(g.latestAt)}</Text><Text style={s.chev}>›</Text></View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}

      <NotifDetailSheet group={sheet} onClose={() => setSheet(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 28, width: 22, marginTop: -3 },
  hName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 10, marginTop: 1 },
  clear: { color: AI.textSub, fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: AI.textSub, fontSize: 13 },
  dayDiv: { color: '#6a6a6e', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 14, paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: '#15151a' },
  rowDot: { paddingLeft: 14 },
  rowRead: { opacity: 0.5 },
  udot: { position: 'absolute', left: 0, top: '50%', marginTop: -3.5, width: 7, height: 7, borderRadius: 4, backgroundColor: AI.accent },
  ic: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  ttRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tt: { color: '#fff', fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
  badge: { color: '#fff', fontSize: 8.5, fontWeight: '800', backgroundColor: '#FF8A00', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  bd: { color: '#9a9aa2', fontSize: 10.5, marginTop: 2 },
  rt: { alignItems: 'flex-end', gap: 4 },
  tm: { color: '#6a6a6e', fontSize: 8.5 },
  chev: { color: '#4a4a50', fontSize: 13 },
});
