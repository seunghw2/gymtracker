import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getNotifications, markAllNotificationsRead, parseLinkParams, AppNotification, NotificationType } from '../db/api/notifications';
import { useUiStore } from '../store/useUiStore';
import { RT } from './report/theme';

const ICON: Record<NotificationType, string> = {
  REPORT_READY: '📊', STAGNATION: '⚠️', PR: '💪', REMINDER: '🔔',
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/** 서버 인박스 알림 리스트(임베드용). 포커스 시 로드 + 읽음 처리 → 배지 0. */
export default function NotificationList() {
  const router = useRouter();
  const setUnread = useUiStore(s => s.setUnread);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getNotifications();
      setItems(r.items);
      if (r.unreadCount > 0) markAllNotificationsRead().catch(() => {});
      setUnread(0);
    } catch {
      setItems([]);
    }
  }, [setUnread]);

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

  if (!items) return <View style={styles.center}><ActivityIndicator color={RT.action} size="large" /></View>;
  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 10 }}>📭</Text>
        <Text style={styles.dim}>아직 받은 소식이 없어요.</Text>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={styles.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RT.action} />}
    >
      {items.map(n => (
        <Pressable key={n.id} style={[styles.bub, n.linkPath ? styles.bubLink : null]} disabled={!n.linkPath} onPress={() => openLink(n)}>
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
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  dim: { color: RT.ink2, fontSize: 13 },
  body: { padding: 14, paddingBottom: 24, gap: 8 },
  bub: { alignSelf: 'stretch', backgroundColor: RT.surface, borderRadius: 14, borderWidth: 1, borderColor: RT.hair, paddingHorizontal: 13, paddingVertical: 11 },
  bubLink: { borderColor: RT.purpleLine },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  kindIcon: { fontSize: 14 },
  title: { color: RT.ink, fontSize: 13.5, fontWeight: '800', flex: 1 },
  time: { color: RT.ink3, fontSize: 10.5, fontVariant: ['tabular-nums'] },
  bodyText: { color: RT.ink, fontSize: 14, lineHeight: 20 },
  go: { color: RT.purple, fontSize: 12.5, fontWeight: '700', marginTop: 7 },
});
