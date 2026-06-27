import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ACCENT, SEM } from '../constants/colors';
import { MUSCLE_GROUPS } from '../constants/exercises';
import type { Exercise } from '../db/api/types';
import { getExercises } from '../db/api/exercises';
import { classifyRuleType } from '../lib/overload';
import { useOverloadStore } from '../store/useOverloadStore';
import type { GoalType, ProgressionTrigger } from '../db/api/overload';

const TOTAL_STEPS = 5;

const GOALS: { type: GoalType; label: string; desc: string }[] = [
  { type: 'hypertrophy', label: '근비대', desc: '근육 크기를 키우는 게 목표' },
  { type: 'strength', label: '근력 향상', desc: '더 무거운 무게를 드는 게 목표' },
  { type: 'fatloss', label: '체지방 감소', desc: '근육은 지키면서 체지방만' },
  { type: 'endurance', label: '근지구력', desc: '더 많은 반복을 버티는 게 목표' },
];

const RULE_META: Record<string, { label: string; desc: string }> = {
  barbell_main: { label: '바벨 메인', desc: '목표 반복수 달성 후 소폭 증량' },
  machine_cable: { label: '머신 / 케이블', desc: '반복수 범위 채운 뒤 증량' },
  bodyweight: { label: '맨몸', desc: '총 반복수 증가' },
  isolation: { label: '고립', desc: '반복 범위 유지' },
};

const TRIGGER_META: { key: ProgressionTrigger; label: string; hint: string }[] = [
  { key: 'single', label: '한 세션 달성', hint: '목표 반복수×세트를 한 번이라도 채우면 증량 신호' },
  { key: 'two_sessions', label: '2세션 연속', hint: '두 세션 연속 달성해야 신호 — 더 안전하게' },
  { key: 'rpe', label: '+RPE 여유', hint: '목표 달성 + 마지막 세트에 힘이 남았을 때만' },
];

const EQ_LABEL: Record<string, string> = {
  Barbell: '바벨', Dumbbell: '덤벨', Machine: '머신', Cable: '케이블', Bodyweight: '맨몸',
};

export default function Onboarding() {
  const router = useRouter();
  const { saveGoalSetting, bulkCreateGoals } = useOverloadStore();

  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [selectedExIds, setSelectedExIds] = useState<Set<number>>(new Set());
  const [frequency, setFrequency] = useState(4);
  const [trigger, setTrigger] = useState<ProgressionTrigger>('single');
  const [incUpper, setIncUpper] = useState(1.25);
  const [incLower, setIncLower] = useState(2.5);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getExercises().then(setExercises).catch(() => {}); }, []);

  const valid = step === 1 ? !!goalType : step === 2 ? selectedExIds.size > 0 : true;

  const exercisesByGroup = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const mg of MUSCLE_GROUPS) map.set(mg, []);
    for (const ex of exercises) {
      if (ex.is_system) map.get(ex.muscle_group)?.push(ex);
    }
    return map;
  }, [exercises]);

  const ruleMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const ex of exercises) {
      if (!selectedExIds.has(ex.id)) continue;
      const rt = classifyRuleType(ex.equipment_type, ex.muscle_group);
      if (!map.has(rt)) map.set(rt, []);
      map.get(rt)!.push(ex.name);
    }
    return map;
  }, [exercises, selectedExIds]);

  const toggleEx = useCallback((id: number) => {
    setSelectedExIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const triggerHint = TRIGGER_META.find(t => t.key === trigger)?.hint ?? '';

  const freqHint = frequency >= 5
    ? '고빈도 — 부위 분할을 추천해요'
    : frequency <= 2 ? '저빈도 — 전신 위주가 좋아요'
    : '주 3~4회 — 상하체 분할에 적합';

  const handleNext = async () => {
    if (!valid) return;
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }

    setSaving(true);
    const gs = await saveGoalSetting({
      goalType: goalType!,
      weeklyFrequency: frequency,
      incUpper,
      incLower,
      progressionTrigger: trigger,
      complete: true,
    });
    if (gs) {
      await bulkCreateGoals({ exercises: [...selectedExIds].map(id => ({ exerciseId: id })) });
    }
    setSaving(false);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* 진행 바 */}
      <View style={s.progRow}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View key={i} style={[s.progSeg, i < step && s.progDone]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Text style={s.stepNo}>1 / 5 · 목표</Text>
            <Text style={s.q}>어떤 목표로{'\n'}운동하세요?</Text>
            <Text style={s.sub}>목표에 맞춰 과부하 방식을 다르게 잡아드려요.</Text>
            {GOALS.map(g => (
              <Pressable key={g.type} style={[s.opt, goalType === g.type && s.optSel]}
                onPress={() => setGoalType(g.type)}>
                <View>
                  <Text style={s.optT}>{g.label}</Text>
                  <Text style={s.optD}>{g.desc}</Text>
                </View>
                <View style={[s.tick, goalType === g.type && s.tickSel]} />
              </Pressable>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.stepNo}>2 / 5 · 추적 종목</Text>
            <Text style={s.q}>어떤 종목을{'\n'}추적할까요?</Text>
            <Text style={s.sub}>선택한 종목만 진행도와 증량 알림을 받아요.</Text>
            {[...exercisesByGroup.entries()].map(([mg, exList]) => exList.length === 0 ? null : (
              <View key={mg}>
                <Text style={s.grpLabel}>{mg}</Text>
                <View style={s.chips}>
                  {exList.map(ex => (
                    <Pressable key={ex.id} style={[s.chip, selectedExIds.has(ex.id) && s.chipSel]}
                      onPress={() => toggleEx(ex.id)}>
                      <Text style={[s.chipT, selectedExIds.has(ex.id) && s.chipTSel]}>{ex.name}</Text>
                      <Text style={[s.chipBadge, selectedExIds.has(ex.id) && s.chipBadgeSel]}>
                        {EQ_LABEL[ex.equipment_type] ?? ex.equipment_type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.stepNo}>3 / 5 · 빈도</Text>
            <Text style={s.q}>일주일에 몇 번{'\n'}운동하세요?</Text>
            <Text style={s.sub}>주간 패턴 분석과 부위 배분의 기준이 돼요.</Text>
            <View style={s.freq}>
              <Pressable style={s.freqBtn} onPress={() => setFrequency(f => Math.max(1, f - 1))}>
                <Text style={s.freqBtnT}>−</Text>
              </Pressable>
              <Text style={s.freqNum}>{frequency}</Text>
              <Pressable style={s.freqBtn} onPress={() => setFrequency(f => Math.min(7, f + 1))}>
                <Text style={s.freqBtnT}>+</Text>
              </Pressable>
            </View>
            <Text style={s.freqUnit}>주 {frequency}회</Text>
            <Text style={s.freqHint}>{freqHint}</Text>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={s.stepNo}>4 / 5 · 종목별 규칙</Text>
            <Text style={s.q}>과부하 규칙이에요</Text>
            <Text style={s.sub}>종목 타입별로 자동 적용했어요. 언제든 개별 수정할 수 있어요.</Text>
            {(['barbell_main', 'machine_cable', 'bodyweight', 'isolation'] as const)
              .filter(rt => ruleMap.has(rt))
              .map(rt => (
                <View key={rt} style={s.ruleCard}>
                  <View style={s.ruleHead}>
                    <Text style={s.ruleTtl}>{RULE_META[rt].label}</Text>
                  </View>
                  <Text style={s.ruleDesc}>{RULE_META[rt].desc}</Text>
                  <View style={s.ruleEx}>
                    {ruleMap.get(rt)!.map(name => (
                      <Text key={name} style={s.ruleExItem}>{name}</Text>
                    ))}
                  </View>
                </View>
              ))}
            <Text style={s.grpLabel}>증량 판정 시점</Text>
            <View style={s.seg}>
              {TRIGGER_META.map(t => (
                <Pressable key={t.key} style={[s.segBtn, trigger === t.key && s.segBtnOn]}
                  onPress={() => setTrigger(t.key)}>
                  <Text style={[s.segBtnT, trigger === t.key && s.segBtnTOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.segHint}>{triggerHint}</Text>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={s.stepNo}>5 / 5 · 증량 단위</Text>
            <Text style={s.q}>얼마씩 올릴까요?</Text>
            <Text style={s.sub}>증량 준비가 되면 이 단위로 다음 목표를 제안해요.</Text>
            <IncRow label="상체" desc="벤치·OHP·로우 등" value={incUpper} step={1.25}
              onChange={setIncUpper} />
            <IncRow label="하체" desc="스쿼트·데드·레그프레스" value={incLower} step={2.5}
              onChange={setIncLower} />
            <Text style={s.incNote}>머신은 핀 간격, 맨몸은 반복수로 자동 환산돼요.</Text>
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step > 1 && (
          <Pressable style={s.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={s.backBtnT}>이전</Text>
          </Pressable>
        )}
        <Pressable style={[s.cta, !valid && s.ctaGhost, step > 1 && { flex: 1 }]}
          onPress={handleNext} disabled={!valid || saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={[s.ctaT, !valid && s.ctaTGhost]}>{step < TOTAL_STEPS ? '다음' : '시작하기'}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function IncRow({ label, desc, value, step: stepVal, onChange }: {
  label: string; desc: string; value: number; step: number; onChange: (v: number) => void;
}) {
  const fmtKg = (v: number) => Number.isInteger(v) ? `${v}kg` : `${v}kg`;
  return (
    <View style={s.incRow}>
      <View>
        <Text style={s.incL}>{label}</Text>
        <Text style={s.incD}>{desc}</Text>
      </View>
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(stepVal, Math.round((value - stepVal) * 100) / 100))}>
          <Text style={s.stepBtnT}>−</Text>
        </Pressable>
        <Text style={s.stepVal}>{fmtKg(value)}</Text>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.round((value + stepVal) * 100) / 100)}>
          <Text style={s.stepBtnT}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  progRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  progSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: SEM.surface3 },
  progDone: { backgroundColor: ACCENT },
  body: { padding: 22, paddingBottom: 20 },

  stepNo: { fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 0.5, marginBottom: 10 },
  q: { fontSize: 25, fontWeight: '800', lineHeight: 33, letterSpacing: -0.6, marginBottom: 8 },
  sub: { fontSize: 14, color: SEM.muted, lineHeight: 21, marginBottom: 24 },

  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: SEM.surface1, borderWidth: 1.5, borderColor: SEM.line,
    borderRadius: 14, padding: 17, marginBottom: 11 },
  optSel: { borderColor: ACCENT, backgroundColor: 'rgba(255,59,48,0.08)' },
  optT: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3, color: '#fff' },
  optD: { fontSize: 12.5, color: SEM.muted, marginTop: 3 },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#555' },
  tickSel: { borderColor: ACCENT, backgroundColor: ACCENT },

  grpLabel: { fontSize: 11.5, fontWeight: '800', color: SEM.muted, letterSpacing: 0.3,
    marginTop: 18, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: SEM.surface1,
    borderWidth: 1.5, borderColor: SEM.line, borderRadius: 12, padding: 11 },
  chipSel: { borderColor: ACCENT, backgroundColor: 'rgba(255,59,48,0.1)' },
  chipT: { fontSize: 14, fontWeight: '600', color: '#e4e4ea' },
  chipTSel: { color: '#fff' },
  chipBadge: { fontSize: 10, fontWeight: '700', color: SEM.muted, backgroundColor: SEM.surface2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  chipBadgeSel: { color: ACCENT },

  freq: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginTop: 30 },
  freqBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: SEM.line,
    backgroundColor: SEM.surface1, alignItems: 'center', justifyContent: 'center' },
  freqBtnT: { fontSize: 26, fontWeight: '300', color: '#fff' },
  freqNum: { fontSize: 70, fontWeight: '800', letterSpacing: -2, minWidth: 90, textAlign: 'center', color: '#fff' },
  freqUnit: { textAlign: 'center', color: SEM.muted, fontSize: 14, marginTop: 16 },
  freqHint: { textAlign: 'center', color: '#555', fontSize: 13, marginTop: 8 },

  ruleCard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 15, marginBottom: 12 },
  ruleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  ruleTtl: { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  ruleDesc: { fontSize: 13, color: SEM.muted, lineHeight: 19 },
  ruleEx: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  ruleExItem: { fontSize: 12, color: '#fff', backgroundColor: SEM.surface2,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, overflow: 'hidden' },

  seg: { flexDirection: 'row', gap: 5, backgroundColor: SEM.surface1, borderWidth: 1,
    borderColor: SEM.line, borderRadius: 13, padding: 5 },
  segBtn: { flex: 1, borderRadius: 9, paddingVertical: 11, alignItems: 'center' },
  segBtnOn: { backgroundColor: ACCENT },
  segBtnT: { fontSize: 12.5, fontWeight: '700', color: SEM.muted, letterSpacing: -0.3 },
  segBtnTOn: { color: '#fff' },
  segHint: { fontSize: 12.5, color: '#555', marginTop: 10, lineHeight: 18 },

  incRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 16, marginBottom: 12 },
  incL: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  incD: { fontSize: 12.5, color: SEM.muted, marginTop: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  stepBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: SEM.line,
    backgroundColor: SEM.surface2, alignItems: 'center', justifyContent: 'center' },
  stepBtnT: { fontSize: 20, fontWeight: '300', color: '#fff' },
  stepVal: { fontSize: 17, fontWeight: '800', minWidth: 64, textAlign: 'center', color: '#fff' },
  incNote: { fontSize: 12.5, color: '#555', marginTop: 6, lineHeight: 18 },

  footer: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  backBtn: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: SEM.line,
    backgroundColor: SEM.surface1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 22 },
  backBtnT: { fontSize: 15, fontWeight: '700', color: SEM.muted },
  cta: { height: 54, flex: 1, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  ctaGhost: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line },
  ctaT: { fontSize: 16.5, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  ctaTGhost: { color: SEM.muted },
});
