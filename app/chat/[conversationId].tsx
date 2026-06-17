import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AI } from '../../constants/colors';
import { useChatStore } from '../../store/useChatStore';

/** AI 코치 대화 상세 — 메시지 + 클라 청크 스트리밍 + 후속 질문 칩. */
export default function ConversationDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId: string; title?: string; seed?: string; ctx?: string }>();
  const convId = Number(params.conversationId);
  const title = params.title || '대화';

  const messages = useChatStore(s => s.messagesByConv[convId]);
  const loadMessages = useChatStore(s => s.loadMessages);
  const appendLocal = useChatStore(s => s.appendLocal);
  const send = useChatStore(s => s.send);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seeded = useRef(false);

  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);

  useEffect(() => {
    loadMessages(convId);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [convId]);

  // 진입 시 seed 질문 자동 전송(중복 방지)
  useEffect(() => {
    if (params.seed && !seeded.current && messages !== undefined) {
      seeded.current = true;
      handleSend(params.seed);
    }
  }, [messages, params.seed]);

  const streamIn = (full: string) => {
    setStreaming('');
    let i = 0;
    const step = Math.max(1, Math.ceil(full.length / 60));
    timer.current = setInterval(() => {
      i += step;
      setStreaming(full.slice(0, i));
      scrollEnd();
      if (i >= full.length) {
        if (timer.current) clearInterval(timer.current);
        setStreaming(null);
        appendLocal(convId, 'assistant', full);   // ← 실제 SSE 스트리밍 연결 지점(현재는 클라 청크)
      }
    }, 28);
  };

  const handleSend = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setInput('');
    setSuggested([]);
    setSending(true);
    appendLocal(convId, 'user', text);
    scrollEnd();
    const res = await send(convId, text);
    setSending(false);
    if (res) {
      setSuggested(res.suggestedQuestions ?? []);
      streamIn(res.assistantMessage.text);
    } else {
      appendLocal(convId, 'assistant', '지금은 답하기 어려워요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const list = messages ?? [];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Text style={s.back}>‹</Text></Pressable>
          <View style={s.avatar}><Text style={{ fontSize: 15 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.hName} numberOfLines={1}>{title}</Text>
            <Text style={s.hSub}>AI 코치</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollEnd}>
          {!!params.ctx && <Text style={s.ctxChip}>📊 {params.ctx}</Text>}

          {/* 빈 새 대화 — AI 코치가 먼저 말 걸기 + 추천 질문 */}
          {list.length === 0 && !params.seed && streaming === null && !sending && (
            <>
              <View style={[s.bub, s.aBub]}><Text style={s.aText}>{params.ctx ? '이거 같이 보면서 얘기해보자. 궁금한 거 있어? 💪' : '안녕! 오늘 운동은 어땠어? 궁금한 거 편하게 물어봐 💪'}</Text></View>
              <View style={s.qr}>
                {['이번 주 어땠어?', '내 약점이 뭐야?', '루틴 짜줘'].map((q, i) => (
                  <Pressable key={i} style={s.qrChip} onPress={() => handleSend(q)}><Text style={s.qrText}>{q}</Text></Pressable>
                ))}
              </View>
            </>
          )}

          {list.map(m => (
            <View key={m.id} style={[s.bub, m.role === 'user' ? s.uBub : s.aBub]}>
              <Text style={m.role === 'user' ? s.uText : s.aText}>{m.text}</Text>
            </View>
          ))}

          {streaming !== null && (
            <View style={[s.bub, s.aBub]}><Text style={s.aText}>{streaming || '…'}</Text></View>
          )}
          {sending && streaming === null && (
            <View style={[s.bub, s.aBub]}>
              <View style={s.typing}><Dot d={0} /><Dot d={150} /><Dot d={300} /></View>
            </View>
          )}

          {!sending && streaming === null && suggested.length > 0 && (
            <View style={s.qr}>
              {suggested.map((q, i) => (
                <Pressable key={i} style={s.qrChip} onPress={() => handleSend(q)}><Text style={s.qrText}>{q}</Text></Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={s.composer}>
          <TextInput style={s.inp} placeholder="AI 코치에게 물어보기…" placeholderTextColor={AI.faint}
            value={input} onChangeText={setInput} onSubmitEditing={() => handleSend(input)} returnKeyType="send" />
          <Pressable style={[s.snd, (!input.trim() || sending) && { opacity: 0.4 }]} disabled={!input.trim() || sending} onPress={() => handleSend(input)}>
            <Text style={s.sndText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Dot({ d }: { d: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setOn(o => !o), 500);
    const s = setTimeout(() => setOn(true), d);
    return () => { clearInterval(t); clearTimeout(s); };
  }, [d]);
  return <View style={[s.dot, { opacity: on ? 1 : 0.3 }]} />;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 28, width: 22, marginTop: -3 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: AI.tint, borderWidth: 1, borderColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  hName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 10.5, marginTop: 1 },

  body: { padding: 14, paddingBottom: 24, gap: 9 },
  ctxChip: { alignSelf: 'flex-start', color: '#c3a8e8', backgroundColor: 'rgba(155,123,214,0.14)', borderWidth: 1, borderColor: 'rgba(155,123,214,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  bub: { maxWidth: '86%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  aBub: { alignSelf: 'flex-start', backgroundColor: '#141416', borderWidth: 1, borderColor: '#1c1c22', borderBottomLeftRadius: 4 },
  uBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderBottomRightRadius: 4 },
  aText: { color: '#EDEDF0', fontSize: 14.5, lineHeight: 21 },
  uText: { color: '#fff', fontSize: 14.5, lineHeight: 21, fontWeight: '600' },

  typing: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: AI.textSub },

  qr: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  qrChip: { borderWidth: 1, borderColor: AI.accent, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  qrText: { color: AI.accent, fontSize: 12.5, fontWeight: '700' },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: AI.line },
  inp: { flex: 1, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 22, paddingHorizontal: 15, paddingVertical: 11, color: '#fff', fontSize: 14 },
  snd: { width: 38, height: 38, borderRadius: 19, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  sndText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
