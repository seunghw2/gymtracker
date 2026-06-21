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
import { toggleMulti, answersToProfile, successOptions } from '../../lib/onboarding';

// ── 선택지 ────────────────────────────────────────────────────────────────
type Opt = { v: string | number; label: string };

const GOALS: Opt[] = [
  { v: 'lean_muscle', label: '💪 근육을 키우고 싶어요' },
  { v: 'strength', label: '🏋️ 더 강해지고 싶어요' },
  { v: 'fat_loss', label: '🔥 체지방을 줄이고 싶어요' },
  { v: 'habit', label: '📅 운동 습관을 만들고 싶어요' },
  { v: 'health', label: '❤️ 건강하게 유지하고 싶어요' },
  { v: 'unsure', label: '🤔 잘 모르겠어요' },
];
const WEIGHT_GOAL: Opt[] = [
  { v: 'gain', label: '증량 중' },
  { v: 'maintain', label: '유지 중' },
  { v: 'loss', label: '감량 중' },
  { v: 'unknown', label: '잘 모르겠음' },
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
const SumRow = ({ k, v, accent }: { k: string; v: string; accent?: boolean }) => (
  <View style={styles.sumRow}>
    <Text style={styles.sumK}>{k}</Text>
    <Text style={[styles.sumV, accent && styles.sumVAccent]} numberOfLines={2}>{v}</Text>
  </View>
);

type QType = 'single' | 'multi' | 'constraints' | 'note';
type Question = { id: string; type: QType; prompt: React.ReactNode; options?: Opt[] };

// 성공 기준(successGoal)은 목표(goal)에 따라 옵션·질문이 분기 — 런타임에 successOptions로 채운다.
const QUESTIONS: Question[] = [
  { id: 'goal', type: 'single', options: GOALS, prompt: <>반가워요! 먼저, <B>운동하는 가장 큰 이유</B>는 무엇인가요?</> },
  { id: 'successGoal', type: 'single', prompt: <></> }, // 동적(분기)
  { id: 'muscles', type: 'multi', options: MUSCLES, prompt: <>특히 <B>집중하고 싶은 부위</B>가 있나요? <Text style={{ color: AI.textSub, fontWeight: '400' }}>(여러 개 골라도 돼요)</Text></> },
  { id: 'frequency', type: 'single', options: FREQ, prompt: <>일주일에 <B>몇 번</B> 운동 가능하신가요?</> },
  { id: 'sessionMinutes', type: 'single', options: SESSION_MIN, prompt: <>한 번 운동 시 <B>얼마나</B> 가능하신가요?</> },
  { id: 'weightGoal', type: 'single', options: WEIGHT_GOAL, prompt: <>현재 <B>체중</B>은 어느 쪽인가요?</> },
  { id: 'trainingMonths', type: 'single', options: DURATION, prompt: <><B>운동 경력</B>이 얼마나 되었나요?</> },
  { id: 'constraints', type: 'constraints', options: PAIN_CHIPS, prompt: <>현재 <B>운동에 영향을 주는 통증</B>이 있나요? <Text style={{ color: AI.textSub, fontWeight: '400' }}>(없으면 넘어가도 돼요)</Text></> },
  { id: 'note', type: 'note', prompt: <>마지막! <B>AI에게 알려주고 싶은 점</B>이 있을까요? <Text style={{ color: AI.textSub, fontWeight: '400' }}>(없으면 건너뛰어도 돼요)</Text></> },
];

type Msg = { id: string; role: 'ai' | 'user'; content: React.ReactNode };
type Answers = {
  goal?: string;
  successGoal?: string;
  weightGoal?: string;
  trainingMonths?: number;
  frequency?: number;
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
  const [draft, setDraft] = useState(''); // 하단 입력바 자유 입력
  const [reviewing, setReviewing] = useState(false); // 'AI가 이해한 목표' 요약 화면

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
      // 성공 기준은 목표에 따라 질문이 분기
      const prompt = QUESTIONS[i].id === 'successGoal'
        ? successOptions(answersRef.current.goal).prompt
        : QUESTIONS[i].prompt;
      push('ai', prompt);
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
        if (p.successGoal) a.successGoal = p.successGoal;
        if (p.weightGoal) a.weightGoal = p.weightGoal;
        if (p.trainingMonths != null) a.trainingMonths = p.trainingMonths;
        if (p.weeklyFrequencyTarget != null) a.frequency = p.weeklyFrequencyTarget;
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
    if (i >= QUESTIONS.length - 1) {
      // 마지막 → 저장 대신 'AI가 이해한 목표' 요약 화면
      setActiveIndex(-1);
      setTyping(true);
      timerRef.current = setTimeout(() => {
        if (!mounted.current) return;
        setTyping(false);
        setReviewing(true);
      }, 700);
    } else {
      askQuestion(i + 1);
    }
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
    }
    // 메모가 있으면 이미 입력바에서 보낸 말풍선이 있으므로 추가 push 안 함
    setActiveIndex(-1);
    advance(i);
  };

  const toggleMuscle = (v: string) => setAnswer({ muscles: toggleMulti(answersRef.current.muscles ?? [], v) });
  const togglePain = (v: string) => setAnswer({ constraintChips: toggleMulti(answersRef.current.constraintChips ?? [], v) });

  // 하단 입력바: 자유 입력을 현재 스텝 텍스트 필드로(메모/제약), 칩 스텝에선 freeNote로 모음. 진행은 칩/버튼이 담당.
  const sendDraft = () => {
    const t = draft.trim();
    if (!t) return;
    push('user', t);
    if (q?.type === 'note') setAnswer({ note: t });
    else if (q?.type === 'constraints') setAnswer({ constraintText: [answersRef.current.constraintText, t].filter(Boolean).join(', ') });
    else setAnswer({ note: [answersRef.current.note, t].filter(Boolean).join(' / ') });
    setDraft('');
  };

  // ── 저장 ──────────────────────────────────────────────────────────────
  const save = async () => {
    setActiveIndex(-1);
    setTyping(true);
    setSaving(true);
    try {
      await putAiProfile(answersToProfile(answersRef.current));
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

  // '수정할게요' — 답변 유지한 채 처음부터 다시(칩에 프리필 표시)
  const editAgain = () => { setReviewing(false); setMessages([]); idRef.current = 0; askQuestion(0); };

  // 요약 라벨
  const labelOf = (opts: { v: string | number; label: string }[], v?: string | number) => opts.find(o => o.v === v)?.label;
  const goalLabel = labelOf(GOALS, answers.goal)?.replace(/^\S+\s/, '') ?? '—'; // 이모지 제거
  const successLabel = labelOf(successOptions(answers.goal).options, answers.successGoal) ?? '—';
  const muscleLabel = (answers.muscles ?? []).map(v => labelOf(MUSCLES, v)).filter(Boolean).join(', ') || '—';
  const careerLabel = labelOf(DURATION, answers.trainingMonths) ?? '—';
  const weightLabel = labelOf(WEIGHT_GOAL, answers.weightGoal) ?? '—';
  const availLabel = `${answers.frequency ? `주 ${answers.frequency}회` : '—'} / ${answers.sessionMinutes ? `${answers.sessionMinutes}분` : '—'}`;
  const cautionLabel = [...(answers.constraintChips ?? []), (answers.constraintText ?? '').trim()].filter(Boolean).join(', ') || '없음';

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
                {(q.id === 'successGoal' ? successOptions(answers.goal).options : q.options!).map(o => {
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
                <Text style={styles.hint}>그 외엔 아래 입력창에 적어 주세요</Text>
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
                <Text style={styles.hint}>아래 입력창에 자유롭게 적어 주세요</Text>
                <View style={styles.row}>
                  <Pressable style={[styles.cta, styles.ghost]} onPress={() => onNote(activeIndex, true)}>
                    <Text style={styles.ghostText}>건너뛰기</Text>
                  </Pressable>
                  <Pressable style={[styles.cta, { flex: 1 }]} onPress={() => onNote(activeIndex, false)}>
                    <Text style={styles.ctaText}>다음</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
          )}

          {reviewing && (
            <View style={styles.summary}>
              <Text style={styles.sumTitle}>🎯 AI가 이해한 목표</Text>
              <SumRow k="주 목표" v={goalLabel} />
              <SumRow k="세부 목표" v={successLabel} accent />
              <SumRow k="집중 부위" v={muscleLabel} />
              <SumRow k="운동 가능" v={availLabel} />
              <SumRow k="체중" v={weightLabel} />
              <SumRow k="경력" v={careerLabel} />
              <SumRow k="주의" v={cautionLabel} />
              <Text style={styles.sumNote}>앞으로 모든 브리핑과 리포트는 이 목표를 기준으로 분석할게요.</Text>
              <View style={styles.row}>
                <Pressable style={[styles.cta, styles.ghost]} onPress={editAgain}><Text style={styles.ghostText}>수정할게요</Text></Pressable>
                <Pressable style={[styles.cta, { flex: 1 }]} onPress={save}><Text style={styles.ctaText}>좋아요</Text></Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        {saving ? (
          <View style={styles.savingBar}>
            <ActivityIndicator color={AI.accent} />
            <Text style={styles.savingText}>분석을 준비하고 있어요…</Text>
          </View>
        ) : reviewing ? null : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.barInput}
              placeholder="메시지 입력…"
              placeholderTextColor={AI.faint}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={sendDraft}
              returnKeyType="send"
            />
            <Pressable style={[styles.sendBtn, !draft.trim() && { opacity: 0.4 }]} disabled={!draft.trim()} onPress={sendDraft} hitSlop={6}>
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
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
  // 답변 칩 — 우측 균일폭 세로 스택, 중립 다크(빨강은 보낸 말풍선에만)
  chips: { gap: 8, alignSelf: 'stretch' },
  chip: { alignSelf: 'flex-end', width: '74%', alignItems: 'center', backgroundColor: AI.chipBg, borderColor: AI.chipBorder, borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16 },
  chipOn: { borderColor: AI.accent },          // 복수 대기상태: 빨강 테두리(배경 중립 유지)
  chipText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  hint: { color: AI.textSub, fontSize: 12.5, alignSelf: 'flex-end' },

  row: { flexDirection: 'row', gap: 8 },
  cta: { backgroundColor: AI.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  ctaText: { color: AI.ink, fontSize: 15, fontWeight: '800' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: AI.line },
  ghostText: { color: AI.textSub, fontSize: 15, fontWeight: '700' },

  savingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  savingText: { color: AI.textSub, fontSize: 13 },

  // 'AI가 이해한 목표' 요약 카드
  summary: { backgroundColor: AI.card, borderWidth: 1, borderColor: AI.line, borderRadius: 16, padding: 16, marginTop: 6, gap: 9 },
  sumTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sumRow: { flexDirection: 'row', gap: 12 },
  sumK: { color: AI.textSub, fontSize: 13, width: 64 },
  sumV: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  sumVAccent: { color: AI.accent, fontWeight: '800' },
  sumNote: { color: AI.textSub, fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 4 },

  // 하단 입력바
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: AI.line },
  barInput: { flex: 1, backgroundColor: AI.bubble, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: AI.ink, fontSize: 19, fontWeight: '800', marginTop: -1 },
});
