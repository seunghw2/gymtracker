import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AI } from '../../constants/colors';
import { askReportChat, ChatTurn, ReportPeriodType } from '../../db/queries';

const PERIOD_LABEL: Record<string, string> = {
  week: '지난주', month: '지난달', quarter: '3개월', half: '6개월', year: '연간', session: '세션',
};

export default function AiReportChat() {
  const router = useRouter();
  const params = useLocalSearchParams<{ reportId?: string; period?: string }>();
  const reportId = params.reportId ?? '';
  const period = (params.period ?? 'week') as ReportPeriodType;
  const scrollRef = useRef<ScrollView>(null);

  const [msgs, setMsgs] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);

  const label = PERIOD_LABEL[period] ?? period;

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || sending) return;
    const history = msgs;
    setMsgs(m => [...m, { role: 'user', content: question }]);
    setInput('');
    setSuggested([]);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const reply = await askReportChat({ reportId, period, question, history });
      setMsgs(m => [...m, { role: 'ai', content: reply.content }]);
      setSuggested(reply.suggestedQuestions ?? []);
    } catch {
      setMsgs(m => [...m, { role: 'ai', content: '답변을 못 받았어요. 다시 시도해 주세요.' }]);
      setInput(question); // 실패 시 입력 복원
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
          <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hName}>애널리스트<Text style={styles.hScope}>  {label} 기준</Text></Text>
            <Text style={styles.hSub}>그 기간에 대해 답해요</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.scope}><Text style={styles.scopeText}>📅 {label} 리포트에 대해 이야기 중</Text></View>
          <Bubble ai>{label}에 대해 뭐든 물어보세요.</Bubble>
          {msgs.map((m, i) => <Bubble key={i} ai={m.role === 'ai'}>{m.content}</Bubble>)}
          {sending && <View style={[styles.bub, styles.aiBub]}><ActivityIndicator color={AI.accent} /></View>}

          {!sending && suggested.length > 0 && (
            <>
              <Text style={styles.qrLabel}>{label} 기준 추천 질문</Text>
              <View style={styles.qr}>
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
            placeholder="메시지 입력…"
            placeholderTextColor={AI.faint}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable style={[styles.snd, (!input.trim() || sending) && { opacity: 0.4 }]} disabled={!input.trim() || sending} onPress={() => send(input)}>
            <Text style={styles.sndText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <View style={[styles.bub, ai ? styles.aiBub : styles.usrBub]}>
      <Text style={ai ? styles.aiText : styles.usrText}>{children}</Text>
    </View>
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

  body: { padding: 14, paddingBottom: 16, gap: 8 },
  scope: { alignSelf: 'flex-start', backgroundColor: AI.tint, borderColor: 'rgba(157,123,255,.4)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4 },
  scopeText: { color: AI.accent, fontSize: 11, fontWeight: '600' },

  bub: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  aiBub: { alignSelf: 'flex-start', backgroundColor: AI.bubble, borderTopLeftRadius: 5 },
  usrBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderTopRightRadius: 5 },
  aiText: { color: '#EDEDF0', fontSize: 14, lineHeight: 20 },
  usrText: { color: AI.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  qrLabel: { color: AI.faint, fontSize: 10, marginTop: 4, marginLeft: 2 },
  qr: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  qrBtn: { borderColor: AI.accent, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  qrText: { color: AI.accent, fontSize: 12.5, fontWeight: '600' },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: AI.line },
  inp: { flex: 1, backgroundColor: AI.bubble, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, color: '#fff', fontSize: 13.5 },
  snd: { width: 36, height: 36, borderRadius: 18, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  sndText: { color: AI.ink, fontSize: 18, fontWeight: '800' },
});
