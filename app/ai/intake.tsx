import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AI } from '../../constants/colors';
import { getAiProfile, putAiProfile } from '../../db/queries';

// ── 선택지 ────────────────────────────────────────────────────────────────
type Opt = { v: string | number; label: string };

const GOALS: Opt[] = [
  { v: 'lean_muscle', label: '린매스' },
  { v: 'strength', label: '근력' },
  { v: 'fat_loss', label: '체지방 감소' },
  { v: 'maintain', label: '체형 유지' },
];
const EXPERIENCE: Opt[] = [
  { v: 'beginner', label: '막 시작했어요' },
  { v: 'intermediate', label: '기본기는 있어요' },
  { v: 'advanced', label: '베테랑이에요' },
];
const DURATION: Opt[] = [
  { v: 3, label: '6개월 미만' },
  { v: 9, label: '6개월~1년' },
  { v: 24, label: '1~3년' },
  { v: 48, label: '3년 이상' },
];
const FREQ: Opt[] = [
  { v: 2, label: '주 2회' }, { v: 3, label: '주 3회' }, { v: 4, label: '주 4회' },
  { v: 5, label: '주 5회' }, { v: 6, label: '주 6회+' },
];
const SPLIT: Opt[] = [
  { v: 'full_body', label: '무분할 (전신)' },
  { v: 'split_2_3', label: '2~3분할' },
  { v: 'split_4_5', label: '4~5분할' },
  { v: 'ppl', label: 'PPL (밀기·당기기·다리)' },
  { v: 'unsure', label: '아직 잘 몰라요' },
];
const SESSION_MIN: Opt[] = [
  { v: 30, label: '30분' }, { v: 45, label: '45분' }, { v: 60, label: '60분' }, { v: 90, label: '90분+' },
];
const MUSCLES: Opt[] = [
  { v: 'chest', label: '가슴' }, { v: 'back', label: '등' }, { v: 'shoulders', label: '어깨' },
  { v: 'legs', label: '하체' }, { v: 'arms', label: '팔' }, { v: 'core', label: '코어' },
];
const PAIN_CHIPS: Opt[] = [
  { v: '어깨', label: '어깨' }, { v: '허리', label: '허리' }, { v: '무릎', label: '무릎' },
  { v: '손목', label: '손목' }, { v: '팔꿈치', label: '팔꿈치' }, { v: '목', label: '목' },
];

const B = ({ children }: { children: React.ReactNode }) => <Text style={styles.b}>{children}</Text>;

type QType = 'single' | 'multi' | 'constraints' | 'note';
type Question = { id: string; type: QType; prompt: React.ReactNode; options?: Opt[] };

const QUESTIONS: Question[] = [
  { id: 'goal', type: 'single', options: GOALS, prompt: <>반가워요! 더 정확히 분석하려고 몇 가지만 물어볼게요. 먼저, 요즘 <B>어떤 몸</B>을 만들고 싶어요?</> },
  { id: 'experience', type: 'single', options: EXPERIENCE, prompt: <>지금 <B>운동 실력</B>은 어느 쪽에 가까워요?</> },
  { id: 'trainingMonths', type: 'single', options: DURATION, prompt: <>운동을 <B>꾸준히 한 지</B>는 얼마나 됐어요?</> },
  { id: 'frequency', type: 'single', options: FREQ, prompt: <>일주일에 보통 <B>며칠</B> 운동해요?</> },
  { id: 'split', type: 'single', options: SPLIT, prompt: <>운동을 <B>어떻게 나눠서</B> 해요?</> },
  { id: 'sessionMinutes', type: 'single', options: SESSION_MIN, prompt: <>한 번 운동하면 보통 <B>얼마나</B> 걸려요?</> },
  { id: 'muscles', type: 'multi', options: MUSCLES, prompt: <>특히 <B>키우고 싶은 부위</B>가 있어요? <Text style={{ color: AI.textSub, fontWeight: '400' }}>(여러 개 골라도 돼요)</Text></> },
  { id: 'constraints', type: 'constraints', options: PAIN_CHIPS, prompt: <>혹시 <B>아프거나 조심해야</B> 할 곳이 있어요? <Text style={{ color: AI.textSub, fontWeight: '400' }}>(없으면 넘어가도 돼요)</Text></> },
  { id: 'note', type: 'note', prompt: <>마지막! 분석할 때 <B>참고하면 좋을</B> 내용이 더 있을까요? <Text style={{ color: AI.textSub, fontWeight: '400' }}>(없으면 건너뛰어도 돼요)</Text></> },
];

type Msg = { id: string; role: 'ai' | 'user'; content: React.ReactNode };
type Answers = {
  goal?: string;
  experience?: string;
  trainingMonths?: number;
  frequency?: number;
  split?: string;
  sessionMinutes?: number;
  muscles?: string[];
  constraintChips?: string[];
  constraintText?: string;
  note?: string;
};

export default function AiIntake() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const answersRef = useRef<Answers>({});

  const [messages, setMessages] = useState<Msg[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [activeIndex, setActiveIndex] = useState(-1); // 입력 노출 중인 질문(-1=타이핑 중/없음)
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState(1);
  const [saving, setSaving] = useState(false);

  const setAnswer = (patch: Partial<Answers>) => {
    answersRef.current = { ...answersRef.current, ...patch };
    setAnswers(answersRef.current);
  };
  const push = (role: 'ai' | 'user', content: React.ReactNode) =>
    setMessages(m => [...m, { id: String(idRef.current++), role, content }]);

  // 질문 i를 타이핑 인디케이터 후 등장시킨다.
  const askQuestion = (i: number) => {
    setActiveIndex(-1);
    setTyping(true);
    setProgress(i + 1);
    timerRef.current = setTimeout(() => {
      if (!mounted.current) return;
      setTyping(false);
      push('ai', QUESTIONS[i].prompt);
      setActiveIndex(i);
    }, i === 0 ? 450 : 700);
  };

  // 기존 프로필 프리필 후 채팅 시작
  useEffect(() => {
    mounted.current = true;
    getAiProfile().then(p => {
      if (p) {
        const a: Answers = {};
        if (p.goalPhysique) a.goal = p.goalPhysique;
        if (p.experienceLevel) a.experience = p.experienceLevel;
        if (p.trainingMonths != null) a.trainingMonths = p.trainingMonths;
        if (p.weeklyFrequencyTarget != null) a.frequency = p.weeklyFrequencyTarget;
        if (p.splitStyle) a.split = p.splitStyle;
        if (p.sessionMinutes != null) a.sessionMinutes = p.sessionMinutes;
        if (p.priorityMuscles?.length) a.muscles = p.priorityMuscles;
        const known = new Set(PAIN_CHIPS.map(c => c.v));
        const chips: string[] = []; const rest: string[] = [];
        (p.constraints ?? []).forEach(c => (known.has(c) ? chips.push(c) : rest.push(c)));
        a.constraintChips = chips;
        a.constraintText = rest.join(', ');
        if (p.freeNote) a.note = p.freeNote;
        answersRef.current = a;
        setAnswers(a);
      }
    }).catch(() => {}).finally(() => {
      if (mounted.current) askQuestion(0);
    });
    return () => {
      mounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const advance = (i: number) => {
    if (i >= QUESTIONS.length - 1) save();
    else askQuestion(i + 1);
  };

  // ── 입력 핸들러 ───────────────────────────────────────────────────────
  const onSingle = (i: number, opt: Opt) => {
    setAnswer({ [QUESTIONS[i].id]: opt.v } as Partial<Answers>);
    push('user', opt.label);
    setActiveIndex(-1);
    advance(i);
  };

  const onMulti = (i: number) => {
    const sel = answersRef.current.muscles ?? [];
    if (sel.length === 0) return;
    const labels = sel.map(v => MUSCLES.find(m => m.v === v)?.label ?? v).join('·');
    push('user', labels);
    setActiveIndex(-1);
    advance(i);
  };

  const onConstraints = (i: number) => {
    const chips = answersRef.current.constraintChips ?? [];
    const text = (answersRef.current.constraintText ?? '').trim();
    const all = [...chips, ...(text ? [text] : [])];
    push('user', all.length ? all.join(', ') : '없어요');
    setActiveIndex(-1);
    advance(i);
  };

  const onNote = (i: number, skip: boolean) => {
    const text = (answersRef.current.note ?? '').trim();
    if (skip || !text) {
      setAnswer({ note: '' });
      push('user', '건너뛸게요');
    } else {
      push('user', text);
    }
    setActiveIndex(-1);
    advance(i);
  };

  const toggleMuscle = (v: string) => {
    const cur = answersRef.current.muscles ?? [];
    setAnswer({ muscles: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] });
  };
  const togglePain = (v: string) => {
    const cur = answersRef.current.constraintChips ?? [];
    setAnswer({ constraintChips: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] });
  };

  // ── 저장 ──────────────────────────────────────────────────────────────
  const save = async () => {
    setActiveIndex(-1);
    setTyping(true);
    setSaving(true);
    const a = answersRef.current;
    const constraints = [
      ...(a.constraintChips ?? []),
      ...((a.constraintText ?? '').split(',').map(s => s.trim()).filter(Boolean)),
    ];
    try {
      await putAiProfile({
        goalPhysique: a.goal!,
        priorityMuscles: a.muscles ?? [],
        weeklyFrequencyTarget: a.frequency ?? null,
        constraints,
        experienceLevel: a.experience ?? null,
        trainingMonths: a.trainingMonths ?? null,
        splitStyle: a.split ?? null,
        sessionMinutes: a.sessionMinutes ?? null,
        freeNote: (a.note ?? '').trim() || null,
      });
      if (mounted.current) router.replace('/ai');
    } catch {
      if (!mounted.current) return;
      setTyping(false);
      setSaving(false);
      setActiveIndex(QUESTIONS.length - 1);
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
    }
  };

  const q = activeIndex >= 0 ? QUESTIONS[activeIndex] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
          <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hName}>애널리스트</Text>
            <Text style={styles.hSub}>{Math.min(progress, QUESTIONS.length)} / {QUESTIONS.length}</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map(m => <Bubble key={m.id} role={m.role}>{m.content}</Bubble>)}
          {typing && <TypingBubble />}

          {/* 현재 활성 질문의 입력 컨트롤 — 질문 버블 바로 아래 인라인 */}
          {q && (
          <View style={styles.controls}>
            {q.type === 'single' && (
              <View style={styles.chips}>
                {q.options!.map(o => {
                  const on = (answers as any)[q.id] === o.v;
                  return (
                    <Pressable key={String(o.v)} style={[styles.chip, on && styles.chipOn]} onPress={() => onSingle(activeIndex, o)}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {q.type === 'multi' && (
              <>
                <View style={styles.chips}>
                  {q.options!.map(o => {
                    const on = (answers.muscles ?? []).includes(o.v as string);
                    return (
                      <Pressable key={String(o.v)} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleMuscle(o.v as string)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}{on ? ' ✓' : ''}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  style={[styles.cta, (answers.muscles ?? []).length === 0 && { opacity: 0.4 }]}
                  disabled={(answers.muscles ?? []).length === 0}
                  onPress={() => onMulti(activeIndex)}
                >
                  <Text style={styles.ctaText}>다음</Text>
                </Pressable>
              </>
            )}

            {q.type === 'constraints' && (
              <>
                <View style={styles.chips}>
                  {q.options!.map(o => {
                    const on = (answers.constraintChips ?? []).includes(o.v as string);
                    return (
                      <Pressable key={String(o.v)} style={[styles.chip, on && styles.chipOn]} onPress={() => togglePain(o.v as string)}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}{on ? ' ✓' : ''}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="직접 입력 (예: 왼 어깨가 시큰함)"
                  placeholderTextColor={AI.faint}
                  defaultValue={answers.constraintText}
                  onChangeText={t => setAnswer({ constraintText: t })}
                  multiline
                />
                <View style={styles.row}>
                  <Pressable style={[styles.cta, styles.ghost]} onPress={() => onConstraints(activeIndex)}>
                    <Text style={styles.ghostText}>없어요</Text>
                  </Pressable>
                  <Pressable style={[styles.cta, { flex: 1 }]} onPress={() => onConstraints(activeIndex)}>
                    <Text style={styles.ctaText}>다음</Text>
                  </Pressable>
                </View>
              </>
            )}

            {q.type === 'note' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="자유롭게 적어 주세요"
                  placeholderTextColor={AI.faint}
                  defaultValue={answers.note}
                  onChangeText={t => setAnswer({ note: t })}
                  multiline
                />
                <View style={styles.row}>
                  <Pressable style={[styles.cta, styles.ghost]} onPress={() => onNote(activeIndex, true)}>
                    <Text style={styles.ghostText}>건너뛰기</Text>
                  </Pressable>
                  <Pressable style={[styles.cta, { flex: 1 }]} onPress={() => onNote(activeIndex, false)}>
                    <Text style={styles.ctaText}>저장하고 분석 시작</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
          )}
        </ScrollView>

        {saving && (
          <View style={styles.savingBar}>
            <ActivityIndicator color={AI.accent} />
            <Text style={styles.savingText}>분석을 준비하고 있어요…</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── 말풍선(등장 애니메이션) ─────────────────────────────────────────────
function Bubble({ children, role }: { children: React.ReactNode; role: 'ai' | 'user' }) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);
  const ai = role === 'ai';
  return (
    <Animated.View style={[styles.bub, ai ? styles.aiBub : styles.usrBub, { opacity: op, transform: [{ translateY: ty }] }]}>
      <Text style={ai ? styles.aiText : styles.usrText}>{children}</Text>
    </Animated.View>
  );
}

// ── 타이핑 인디케이터(점 3개 bounce) ────────────────────────────────────
function TypingBubble() {
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const dots = [d0, d1, d2];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 320, useNativeDriver: true }),
      ])),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={[styles.bub, styles.aiBub, styles.typing]}>
      {dots.map((d, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }], opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 30, width: 24, marginTop: -4 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  hName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 11, marginTop: 1 },

  body: { padding: 14, paddingBottom: 20, gap: 8 },
  bub: { maxWidth: '85%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  aiBub: { alignSelf: 'flex-start', backgroundColor: AI.bubble, borderTopLeftRadius: 5 },
  usrBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderTopRightRadius: 5 },
  aiText: { color: '#EDEDF0', fontSize: 14, lineHeight: 20 },
  usrText: { color: AI.ink, fontSize: 14, fontWeight: '600' },
  b: { fontWeight: '800', color: '#fff' },

  typing: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: AI.textSub },

  controls: { gap: 10, marginTop: 6, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderColor: AI.accent, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15 },
  chipOn: { backgroundColor: AI.tint },
  chipText: { color: AI.accent, fontSize: 13.5, fontWeight: '700' },
  chipTextOn: { color: '#FF9F97' },

  input: { backgroundColor: AI.bubble, borderRadius: 12, padding: 13, color: '#fff', fontSize: 14, minHeight: 48 },

  row: { flexDirection: 'row', gap: 8 },
  cta: { backgroundColor: AI.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  ctaText: { color: AI.ink, fontSize: 15, fontWeight: '800' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: AI.line },
  ghostText: { color: AI.textSub, fontSize: 15, fontWeight: '700' },

  savingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  savingText: { color: AI.textSub, fontSize: 13 },
});
