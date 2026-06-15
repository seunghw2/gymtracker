import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { AI } from '../../constants/colors';
import { getAiProfile, putAiProfile } from '../../db/queries';

const GOALS: { v: string; label: string }[] = [
  { v: 'lean_muscle', label: '린매스' },
  { v: 'strength', label: '근력' },
  { v: 'fat_loss', label: '체지방 감소' },
  { v: 'maintain', label: '체형 유지' },
];
const MUSCLES: { v: string; label: string }[] = [
  { v: 'chest', label: '가슴' }, { v: 'back', label: '등' }, { v: 'shoulders', label: '어깨' },
  { v: 'legs', label: '하체' }, { v: 'arms', label: '팔' }, { v: 'core', label: '코어' },
];

export default function AiIntake() {
  const router = useRouter();
  const [goal, setGoal] = useState<string | null>(null);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [pain, setPain] = useState('');
  const [step, setStep] = useState(0); // 0 goal · 1 muscles · 2 pain
  const [saving, setSaving] = useState(false);

  // 기존 프로필 프리필(편집)
  useEffect(() => {
    getAiProfile().then(p => {
      if (!p) return;
      setGoal(p.goalPhysique ?? null);
      setMuscles(p.priorityMuscles ?? []);
      setPain((p.constraints ?? []).join(', '));
      setStep(2);
    }).catch(() => {});
  }, []);

  const goalLabel = GOALS.find(g => g.v === goal)?.label;
  const muscleLabels = muscles.map(m => MUSCLES.find(x => x.v === m)?.label ?? m).join('·');

  const toggleMuscle = (v: string) =>
    setMuscles(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const save = async () => {
    if (!goal || muscles.length === 0) return;
    setSaving(true);
    try {
      await putAiProfile({
        goalPhysique: goal,
        priorityMuscles: muscles,
        constraints: pain.trim() ? pain.split(',').map(s => s.trim()).filter(Boolean) : [],
      });
      router.replace('/ai');
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const canContinue = step === 0 ? !!goal : step === 1 ? muscles.length > 0 : true;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
          <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hName}>애널리스트</Text>
            <Text style={styles.hSub}>{Math.min(step + 1, 3)} / 3</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Bubble ai><Text style={styles.b}>처음이니까 몇 개만 물어볼게요. </Text>어떤 몸을 목표로 해요?</Bubble>
          {goalLabel && step > 0 && <Bubble usr>{goalLabel}</Bubble>}

          {step >= 1 && (
            <>
              <Bubble ai>좋아요. <Text style={styles.b}>집중하고 싶은 부위</Text>는요? (여러 개 OK)</Bubble>
              {step > 1 && muscleLabels ? <Bubble usr>{muscleLabels}</Bubble> : null}
            </>
          )}

          {step >= 2 && (
            <Bubble ai>혹시 <Text style={styles.b}>아픈 데</Text> 있어요? (없으면 비워도 돼요)</Bubble>
          )}

          {/* 현재 단계 입력 컨트롤 */}
          {step === 0 && (
            <View style={styles.chips}>
              {GOALS.map(g => (
                <Pressable key={g.v} style={[styles.chip, goal === g.v && styles.chipOn]} onPress={() => setGoal(g.v)}>
                  <Text style={[styles.chipText, goal === g.v && styles.chipTextOn]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {step === 1 && (
            <View style={styles.chips}>
              {MUSCLES.map(m => {
                const on = muscles.includes(m.v);
                return (
                  <Pressable key={m.v} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleMuscle(m.v)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.label}{on ? ' ✓' : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {step === 2 && (
            <TextInput
              style={styles.input}
              placeholder="예: 왼 어깨가 좀 시큰함"
              placeholderTextColor={AI.faint}
              value={pain}
              onChangeText={setPain}
              multiline
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.cta, (!canContinue || saving) && { opacity: 0.4 }]}
            disabled={!canContinue || saving}
            onPress={() => { if (step < 2) setStep(step + 1); else save(); }}
          >
            {saving ? <ActivityIndicator color={AI.ink} /> : <Text style={styles.ctaText}>{step < 2 ? '계속' : '저장하고 분석 시작'}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ children, ai, usr }: { children: React.ReactNode; ai?: boolean; usr?: boolean }) {
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
  hSub: { color: AI.textSub, fontSize: 11, marginTop: 1 },

  body: { padding: 14, paddingBottom: 24, gap: 8 },
  bub: { maxWidth: '85%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  aiBub: { alignSelf: 'flex-start', backgroundColor: AI.bubble, borderTopLeftRadius: 5 },
  usrBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderTopRightRadius: 5 },
  aiText: { color: '#EDEDF0', fontSize: 14, lineHeight: 20 },
  usrText: { color: AI.ink, fontSize: 14, fontWeight: '600' },
  b: { fontWeight: '800', color: '#fff' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderColor: AI.accent, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15 },
  chipOn: { backgroundColor: AI.tint },
  chipText: { color: AI.accent, fontSize: 13.5, fontWeight: '700' },
  chipTextOn: { color: '#C9B6FF' },

  input: { backgroundColor: AI.bubble, borderRadius: 12, padding: 13, color: '#fff', fontSize: 14, marginTop: 4, minHeight: 48 },

  footer: { padding: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: AI.line },
  cta: { backgroundColor: AI.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: AI.ink, fontSize: 15, fontWeight: '800' },
});
