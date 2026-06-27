import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI, ACCENT, SEM } from '../../constants/colors';
import { useChatStore } from '../../store/useChatStore';
import { useUiStore } from '../../store/useUiStore';
import { useOverloadStore } from '../../store/useOverloadStore';
import { markAllNotificationsRead } from '../../db/api/notifications';
import { weeklyCheckIn, saveWeeklyFocus, getWeeklyFocus } from '../../db/api/overload';
import { buildNextWeekGoals } from '../../lib/overload';
import type { ExerciseGoalForBuild } from '../../lib/overload';

const GENERAL_KEY = 'general';
const CHECKIN_WEEK_KEY = 'weekly_checkin_week';

const MG_KOR: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체',
  Arms: '팔', Core: '코어', Cardio: '유산소',
};

function getMonday(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().split('T')[0];
}

export default function ChatTab() {
  const setUnread = useUiStore(s => s.setUnread);
  const findOrCreateByKey = useChatStore(s => s.findOrCreateByKey);
  const messages = useChatStore(s => s.messagesByConv);
  const loadMessages = useChatStore(s => s.loadMessages);
  const appendLocal = useChatStore(s => s.appendLocal);
  const send = useChatStore(s => s.send);
  const { exerciseGoals } = useOverloadStore();

  const [convId, setConvId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);

  // 월요일 체크인 상태
  const [checkinMsgId, setCheckinMsgId] = useState<number | null>(null);
  const [checkinBodyParts, setCheckinBodyParts] = useState<string[]>([]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [goalLines, setGoalLines] = useState<{ exerciseName: string; from: string; to: string; isHold: boolean }[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);

  useFocusEffect(useCallback(() => {
    setUnread(0);
    markAllNotificationsRead().catch(() => {});

    findOrCreateByKey({ source: 'direct', sourceKey: GENERAL_KEY, title: 'AI 코치' }).then(async conv => {
      if (!conv) return;
      setConvId(conv.id);
      await loadMessages(conv.id);
      scrollEnd();

      // 월요일 체크인
      const now = new Date();
      const isMonday = now.getDay() === 1;
      const weekStart = getMonday(now);

      if (isMonday) {
        const [lastWeek, existingFocus] = await Promise.all([
          AsyncStorage.getItem(CHECKIN_WEEK_KEY).catch(() => null),
          getWeeklyFocus(weekStart).catch(() => null),
        ]);

        if (existingFocus) {
          setSelectedPart(existingFocus.bodyPart);
        } else if (lastWeek !== weekStart) {
          const result = await weeklyCheckIn().catch(() => null);
          if (result) {
            await loadMessages(conv.id);
            setCheckinMsgId(result.messageId);
            setCheckinBodyParts(result.bodyParts);
            AsyncStorage.setItem(CHECKIN_WEEK_KEY, weekStart).catch(() => {});
            scrollEnd();
          }
        }
      }
    });
  }, [findOrCreateByKey, loadMessages, setUnread]));

  const streamIn = (full: string, id: number) => {
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
        appendLocal(id, 'assistant', full);
      }
    }, 28);
  };

  const handleSend = async (raw: string) => {
    if (!convId) return;
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
      streamIn(res.assistantMessage.text, convId);
    } else {
      appendLocal(convId, 'assistant', '지금은 답하기 어려워요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handlePartSelect = async (part: string) => {
    setSelectedPart(part);
    setCheckinBodyParts([]);
    const weekStart = getMonday(new Date());
    await saveWeeklyFocus(part, weekStart).catch(() => {});

    // 다음 주 목표 카드 생성
    const forBuild: ExerciseGoalForBuild[] = exerciseGoals
      .filter(g => g.exerciseName && g.muscleGroup)
      .map(g => ({
        exerciseName: g.exerciseName!,
        ruleType: g.ruleType as any,
        currentValue: g.currentValue,
        nextTargetLabel: g.nextTarget ?? '—',
        muscleGroup: g.muscleGroup!,
      }));
    setGoalLines(buildNextWeekGoals(part, forBuild));
    scrollEnd();
  };

  const list = convId ? (messages[convId] ?? []) : [];

  const isCheckinMsg = (id: number) => checkinMsgId !== null && id === checkinMsgId;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <View style={s.avatar}><Text style={{ fontSize: 15 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.hName}>AI 코치</Text>
            <Text style={s.hSub}>운동에 대해 뭐든 물어보세요</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollEnd}>

          {list.length === 0 && streaming === null && !sending && (
            <>
              <View style={[s.bub, s.aBub]}>
                <Text style={s.aText}>안녕! 오늘 운동은 어땠어? 궁금한 거 편하게 물어봐 💪</Text>
              </View>
              <View style={s.qr}>
                {['이번 주 어땠어?', '내 약점이 뭐야?', '루틴 짜줘'].map((q, i) => (
                  <Pressable key={i} style={s.qrChip} onPress={() => handleSend(q)}>
                    <Text style={s.qrText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {list.map(m => (
            <React.Fragment key={m.id}>
              <View style={[s.bub, m.role === 'user' ? s.uBub : s.aBub]}>
                <Text style={m.role === 'user' ? s.uText : s.aText}>{m.text}</Text>
              </View>

              {/* 월요일 체크인 메시지 아래 부위 칩 */}
              {isCheckinMsg(m.id) && checkinBodyParts.length > 0 && !selectedPart && (
                <View style={s.qr}>
                  {checkinBodyParts.map(part => (
                    <Pressable key={part} style={s.qrChip} onPress={() => handlePartSelect(part)}>
                      <Text style={s.qrText}>{MG_KOR[part] ?? part}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* 선택 후 목표 카드 */}
              {isCheckinMsg(m.id) && selectedPart && goalLines.length > 0 && (
                <>
                  <View style={[s.bub, s.uBub, { alignSelf: 'flex-end' }]}>
                    <Text style={s.uText}>{MG_KOR[selectedPart] ?? selectedPart}</Text>
                  </View>
                  <View style={[s.bub, s.aBub]}>
                    <Text style={[s.aText, { fontWeight: '700', marginBottom: 10 }]}>
                      좋아요. {MG_KOR[selectedPart] ?? selectedPart}에 집중해서 다음 주 목표를 올렸어요.
                    </Text>
                    <View style={s.goalCard}>
                      <View style={s.goalCardH}>
                        <View style={s.goalDot} />
                        <Text style={s.goalCardTitle}>다음 주 {MG_KOR[selectedPart] ?? selectedPart} 목표</Text>
                      </View>
                      {goalLines.map((gl, i) => (
                        <View key={i} style={[s.goalLine, i > 0 && s.goalLineBorder]}>
                          <Text style={s.goalLineName}>{gl.exerciseName}</Text>
                          {gl.isHold
                            ? <Text style={s.goalLineKeep}>{gl.from} 유지</Text>
                            : <Text style={s.goalLineTo}>{gl.from} → {gl.to}</Text>}
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </React.Fragment>
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
                <Pressable key={i} style={s.qrChip} onPress={() => handleSend(q)}>
                  <Text style={s.qrText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={s.composer}>
          <TextInput style={s.inp} placeholder="AI 코치에게 물어보기…" placeholderTextColor={AI.faint}
            value={input} onChangeText={setInput} onSubmitEditing={() => handleSend(input)} returnKeyType="send" />
          <Pressable style={[s.snd, (!input.trim() || sending) && { opacity: 0.4 }]}
            disabled={!input.trim() || sending} onPress={() => handleSend(input)}>
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
    const to = setTimeout(() => setOn(true), d);
    return () => { clearInterval(t); clearTimeout(to); };
  }, [d]);
  return <View style={[s.dot, { opacity: on ? 1 : 0.3 }]} />;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: AI.line },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: AI.tint,
    borderWidth: 1, borderColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  hName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 11, marginTop: 1 },

  body: { padding: 14, paddingBottom: 24, gap: 9 },
  bub: { maxWidth: '88%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  aBub: { alignSelf: 'flex-start', backgroundColor: '#141416', borderWidth: 1,
    borderColor: '#1c1c22', borderBottomLeftRadius: 4 },
  uBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderBottomRightRadius: 4 },
  aText: { color: '#EDEDF0', fontSize: 14.5, lineHeight: 21 },
  uText: { color: '#fff', fontSize: 14.5, lineHeight: 21, fontWeight: '600' },

  typing: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: AI.textSub },

  qr: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  qrChip: { borderWidth: 1, borderColor: AI.accent, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 12 },
  qrText: { color: AI.accent, fontSize: 12.5, fontWeight: '700' },

  goalCard: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 11, padding: 12, marginTop: 10 },
  goalCardH: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  goalDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT },
  goalCardTitle: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  goalLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6 },
  goalLineBorder: { borderTopWidth: 1, borderTopColor: SEM.line },
  goalLineName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  goalLineTo: { fontSize: 13, color: SEM.good, fontWeight: '800' },
  goalLineKeep: { fontSize: 13, color: SEM.muted, fontWeight: '700' },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: AI.line },
  inp: { flex: 1, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22',
    borderRadius: 22, paddingHorizontal: 15, paddingVertical: 11, color: '#fff', fontSize: 14 },
  snd: { width: 38, height: 38, borderRadius: 19, backgroundColor: AI.accent,
    alignItems: 'center', justifyContent: 'center' },
  sndText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
