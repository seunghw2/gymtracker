import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../../constants/colors';
import { askGeneralChat, ChatTurn } from '../../db/api/ai';
import { getNotifications, markAllNotificationsRead, parseLinkParams, AppNotification, NotificationType } from '../../db/api/notifications';
import { useUiStore } from '../../store/useUiStore';

const NOTIF_ICON: Record<NotificationType, string> = {
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

export default function ChatTab() {
  const router = useRouter();
  const setUnread = useUiStore(s => s.setUnread);
  const scrollRef = useRef<ScrollView>(null);

  const [notifs, setNotifs] = useState<AppNotification[] | null>(null);
  const [msgs, setMsgs] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getNotifications();
      setNotifs(r.items);
      if (r.unreadCount > 0) markAllNotificationsRead().catch(() => {});
      setUnread(0);
    } catch {
      setNotifs([]);
    }
  }, [setUnread]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openNotif = (n: AppNotification) => {
    if (!n.linkPath) return;
    router.push({ pathname: n.linkPath as never, params: parseLinkParams(n.linkParams) as never });
  };

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || sending) return;
    const history = [...msgs];
    setMsgs(m => [...m, { role: 'user', content: question }]);
    setInput('');
    setSuggested([]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const reply = await askGeneralChat(question, history);
      setMsgs(m => [...m, { role: 'ai', content: reply.content }]);
      setSuggested(reply.suggestedQuestions ?? []);
    } catch {
      setMsgs(m => [...m, { role: 'ai', content: '지금은 답하기 어려워요. 다시 시도해 주세요.' }]);
      setInput(question);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const hasMsgs = msgs.length > 0;
  const hasNotifs = notifs !== null && notifs.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hName}>AI 코치</Text>
            <Text style={styles.hSub}>운동에 대해 뭐든 물어보세요</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => hasMsgs && scrollRef.current?.scrollToEnd({ animated: true })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AI.accent} />}
        >
          {notifs === null && <ActivityIndicator color={AI.accent} style={{ marginVertical: 20 }} />}

          {/* 알림 → AI 버블 */}
          {notifs !== null && notifs.map(n => (
            <Pressable
              key={n.id}
              style={[styles.bub, styles.aiBub, !!n.linkPath && styles.linkBub]}
              disabled={!n.linkPath}
              onPress={() => openNotif(n)}
            >
              <View style={styles.notifRow}>
                <Text style={styles.notifIcon}>{NOTIF_ICON[n.type] ?? '🔔'}</Text>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifTime}>{fmtTime(n.createdAt)}</Text>
              </View>
              <Text style={styles.aiText}>{n.body}</Text>
              {!!n.linkPath && <Text style={styles.goText}>보기 ›</Text>}
            </Pressable>
          ))}

          {/* 알림·대화 모두 없을 때 빈 상태 */}
          {notifs !== null && !hasNotifs && !hasMsgs && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🤖</Text>
              <Text style={styles.emptyText}>안녕하세요!{'\n'}운동에 대해 뭐든 물어보세요.</Text>
            </View>
          )}

          {/* 알림과 직접 대화 사이 구분선 */}
          {hasMsgs && hasNotifs && (
            <View style={styles.divider}><Text style={styles.dividerText}>직접 대화</Text></View>
          )}

          {/* 채팅 메시지 */}
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bub, m.role === 'ai' ? styles.aiBub : styles.usrBub]}>
              <Text style={m.role === 'ai' ? styles.aiText : styles.usrText}>{m.content}</Text>
            </View>
          ))}

          {sending && (
            <View style={[styles.bub, styles.aiBub]}>
              <ActivityIndicator color={AI.accent} />
            </View>
          )}

          {!sending && suggested.length > 0 && (
            <>
              <Text style={styles.qrLabel}>추천 질문</Text>
              <View style={styles.qrRow}>
                {suggested.map((s, i) => (
                  <Pressable key={i} style={styles.qrBtn} onPress={() => send(s)}>
                    <Text style={styles.qrText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.inp}
            placeholder="AI 코치에게 물어보기…"
            placeholderTextColor={AI.faint}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.snd, (!input.trim() || sending) && { opacity: 0.4 }]}
            disabled={!input.trim() || sending}
            onPress={() => send(input)}
          >
            <Text style={styles.sndText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: AI.line,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: AI.tint, borderWidth: 1, borderColor: AI.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  hName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 11, marginTop: 1 },

  body: { padding: 14, paddingBottom: 16, gap: 8 },

  bub: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  aiBub: { alignSelf: 'flex-start', backgroundColor: AI.bubble, borderTopLeftRadius: 5 },
  usrBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderTopRightRadius: 5 },
  linkBub: { borderWidth: 1, borderColor: 'rgba(255,59,48,0.35)' },

  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  notifIcon: { fontSize: 13 },
  notifTitle: { color: '#fff', fontSize: 12.5, fontWeight: '700', flex: 1 },
  notifTime: { color: AI.faint, fontSize: 10, fontVariant: ['tabular-nums'] },
  goText: { color: AI.accent, fontSize: 11.5, fontWeight: '700', marginTop: 6 },

  aiText: { color: '#EDEDF0', fontSize: 14, lineHeight: 20 },
  usrText: { color: AI.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  divider: { alignItems: 'center', paddingVertical: 2 },
  dividerText: { color: AI.faint, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: AI.textSub, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  qrLabel: { color: AI.faint, fontSize: 10, marginTop: 4, marginLeft: 2 },
  qrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  qrBtn: { borderColor: AI.accent, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  qrText: { color: AI.accent, fontSize: 12.5, fontWeight: '600' },

  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderTopWidth: 1, borderTopColor: AI.line,
  },
  inp: {
    flex: 1, backgroundColor: AI.bubble, borderRadius: 999,
    paddingHorizontal: 15, paddingVertical: 10,
    color: '#fff', fontSize: 13.5,
  },
  snd: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center',
  },
  sndText: { color: AI.ink, fontSize: 18, fontWeight: '800' },
});
