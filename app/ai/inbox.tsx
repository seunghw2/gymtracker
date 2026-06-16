import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../../constants/colors';
import {
  getNotifications, markAllNotificationsRead, parseLinkParams,
  AppNotification, NotificationType,
} from '../../db/queries';

const ICON: Record<NotificationType, string> = {
  REPORT_READY: '📊',
  STAGNATION: '⚠️',
  PR: '💪',
  REMINDER: '🔔',
};

/** ISO LocalDateTime → "M/D HH:mm" (오늘이면 "HH:mm"). */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export default function AiInboxScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getNotifications();
      setItems(r.items);
      // 본 시점에 읽음 처리(배지 0). 실패해도 화면엔 영향 없음.
      if (r.unreadCount > 0) markAllNotificationsRead().catch(() => {});
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openLink = (n: AppNotification) => {
    if (!n.linkPath) return;
    router.push({ pathname: n.linkPath as never, params: parseLinkParams(n.linkParams) as never });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
        <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hName}>애널리스트<Text style={styles.hScope}>  · 알림</Text></Text>
          <Text style={styles.hSub}>새 소식을 모아서 알려드려요</Text>
        </View>
      </View>

      {!items ? (
        <View style={styles.center}><ActivityIndicator color={AI.accent} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>📭</Text>
          <Text style={styles.dim}>아직 받은 소식이 없어요.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AI.accent} />}
        >
          {/* 최신이 위로 — 백엔드가 id DESC로 내려줌 */}
          {items.map(n => (
            <Pressable
              key={n.id}
              style={[styles.bub, styles.aiBub, n.linkPath ? styles.bubLink : null]}
              disabled={!n.linkPath}
              onPress={() => openLink(n)}
            >
              <View style={styles.rowTop}>
                <Text style={styles.kindIcon}>{ICON[n.type] ?? '🔔'}</Text>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.time}>{fmtTime(n.createdAt)}</Text>
              </View>
              <Text style={styles.bodyText}>{n.body}</Text>
              {!!n.linkPath && <Text style={styles.go}>보기 ›</Text>}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 30, width: 24, marginTop: -4 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  hName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  hScope: { color: AI.textSub, fontSize: 11, fontWeight: '500' },
  hSub: { color: AI.textSub, fontSize: 11, marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: AI.textSub, fontSize: 13 },

  body: { padding: 14, paddingBottom: 24, gap: 8 },
  bub: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: AI.bubble, borderRadius: 16, borderTopLeftRadius: 5, paddingHorizontal: 13, paddingVertical: 11 },
  aiBub: {},
  bubLink: { borderColor: 'rgba(157,123,255,.4)', borderWidth: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  kindIcon: { fontSize: 14 },
  title: { color: '#fff', fontSize: 13.5, fontWeight: '800', flex: 1 },
  time: { color: AI.faint, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  bodyText: { color: '#EDEDF0', fontSize: 14, lineHeight: 20 },
  go: { color: AI.accent, fontSize: 12.5, fontWeight: '700', marginTop: 7 },
});
