import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SEM } from '../constants/colors';
import { getSetting, setSetting } from '../db/queries';
import { useSettingsStore } from '../store/useStore';
import { useOverloadStore } from '../store/useOverloadStore';
import { GoalType } from '../db/api/overload';

/** 운동 목적 선택지 — 온보딩과 동일한 라벨/설명. */
const GOAL_OPTS: { type: GoalType; label: string; desc: string }[] = [
  { type: 'hypertrophy', label: '근비대', desc: '근육 크기를 키우는 게 목표' },
  { type: 'strength', label: '근력 향상', desc: '더 무거운 무게를 드는 게 목표' },
  { type: 'fatloss', label: '체지방 감소', desc: '근육은 지키면서 체지방만' },
  { type: 'endurance', label: '근지구력', desc: '더 많은 반복을 버티는 게 목표' },
];

/** 목표 설정 전용 페이지 — 체중·체지방·기본 휴식 + 단위(kg) + 트레이닝 코어값 통합. */
export default function GoalsScreen() {
  const router = useRouter();
  const { goalWeightKg, goalBodyFatPct, restDurationSec, unitKg, setGoalWeight, setGoalBodyFat, setRestDuration, setUnitKg } = useSettingsStore();
  const { goalSetting, loadGoalSetting, saveGoalSetting } = useOverloadStore();
  const [w, setW] = useState(String(goalWeightKg));
  const [f, setF] = useState(String(goalBodyFatPct));
  const [r, setR] = useState(String(restDurationSec));

  // 온보딩 코어값 — goalSetting에서 현재값으로 초기화
  const [goalType, setGoalType] = useState<GoalType>(goalSetting?.goalType ?? 'hypertrophy');
  const [frequency, setFrequency] = useState(goalSetting?.weeklyFrequency ?? 3);
  const [incUpper, setIncUpper] = useState(goalSetting?.incUpper ?? 1.25);
  const [incLower, setIncLower] = useState(goalSetting?.incLower ?? 2.5);

  useEffect(() => {
    (async () => {
      setW(await getSetting('goal_weight_kg', String(goalWeightKg)));
      setF(await getSetting('goal_body_fat_pct', String(goalBodyFatPct)));
      setR(await getSetting('rest_duration_sec', String(restDurationSec)));
    })().catch(() => {});
    loadGoalSetting().catch(() => {});
  }, []);

  // 서버에서 goalSetting을 받아오면 코어값 입력을 현재값으로 동기화
  useEffect(() => {
    if (!goalSetting) return;
    setGoalType(goalSetting.goalType);
    setFrequency(goalSetting.weeklyFrequency);
    setIncUpper(goalSetting.incUpper);
    setIncLower(goalSetting.incLower);
  }, [goalSetting]);

  const toggleUnit = async (v: boolean) => { setUnitKg(v); await setSetting('unit_kg', v ? '1' : '0').catch(() => {}); };

  const save = async () => {
    const gw = parseFloat(w), gf = parseFloat(f), rd = parseInt(r, 10);
    if (isNaN(gw) || isNaN(gf) || isNaN(rd)) { Alert.alert('오류', '올바른 숫자를 입력하세요.'); return; }
    try {
      await Promise.all([
        setSetting('goal_weight_kg', String(gw)),
        setSetting('goal_body_fat_pct', String(gf)),
        setSetting('rest_duration_sec', String(rd)),
      ]);
      setGoalWeight(gw); setGoalBodyFat(gf); setRestDuration(rd);
      // 코어값 저장 — complete=false로 보내 onboarded 플래그는 건드리지 않음(현재값 유지)
      await saveGoalSetting({
        goalType,
        weeklyFrequency: frequency,
        incUpper,
        incLower,
        progressionTrigger: goalSetting?.progressionTrigger ?? 'two_sessions',
        complete: false,
      });
      router.back();
    } catch {
      Alert.alert('저장 실패', '잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.navBack}>‹ 설정</Text></Pressable>
        <Text style={s.navTitle}>목표 설정</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.group}>
          <Field label="목표 체중" value={w} onChange={setW} unit="kg" />
          <Field label="목표 체지방률" value={f} onChange={setF} unit="%" divider />
          <Field label="기본 휴식 시간" value={r} onChange={setR} unit="초" divider intOnly />
        </View>

        <Text style={s.sectionHd}>운동 목적</Text>
        <View style={s.group}>
          {GOAL_OPTS.map((g, i) => (
            <Pressable key={g.type} onPress={() => setGoalType(g.type)} style={[s.opt, i > 0 && s.rowDivider]}>
              <View style={{ flex: 1 }}>
                <Text style={s.optL}>{g.label}</Text>
                <Text style={s.optD}>{g.desc}</Text>
              </View>
              <View style={[s.tick, goalType === g.type && s.tickSel]} />
            </Pressable>
          ))}
        </View>

        <Text style={s.sectionHd}>주간 운동 횟수</Text>
        <View style={s.group}>
          <View style={s.row}>
            <Text style={s.rowK}>주 {frequency}회</Text>
            <View style={s.stepper}>
              <Pressable style={s.stepBtn} onPress={() => setFrequency(v => Math.max(1, v - 1))}><Text style={s.stepBtnT}>−</Text></Pressable>
              <Text style={s.stepNum}>{frequency}</Text>
              <Pressable style={s.stepBtn} onPress={() => setFrequency(v => Math.min(7, v + 1))}><Text style={s.stepBtnT}>＋</Text></Pressable>
            </View>
          </View>
        </View>

        <Text style={s.sectionHd}>증량 단위</Text>
        <View style={s.group}>
          <IncRow label="상체" desc="벤치·OHP·로우 등" value={incUpper} step={1.25} onChange={setIncUpper} />
          <IncRow label="하체" desc="스쿼트·데드·레그프레스" value={incLower} step={2.5} onChange={setIncLower} divider />
        </View>
        <Text style={s.note}>증량 준비가 되면 이 단위로 다음 목표를 제안해요. 머신은 핀 간격, 맨몸은 반복수로 자동 환산돼요.</Text>

        <Text style={s.sectionHd}>단위</Text>
        <View style={s.group}>
          <View style={s.row}>
            <Text style={s.rowK}>kg 단위 사용</Text>
            <Switch value={unitKg} onValueChange={toggleUnit} trackColor={{ false: '#3A3A3C', true: SEM.brand }} thumbColor="#FFFFFF" />
          </View>
        </View>

        <Pressable style={s.save} onPress={save}><Text style={s.saveT}>저장</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function IncRow({ label, desc, value, step, onChange, divider }: {
  label: string; desc: string; value: number; step: number; onChange: (v: number) => void; divider?: boolean;
}) {
  return (
    <View style={[s.row, divider && s.rowDivider]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowK}>{label}</Text>
        <Text style={s.optD}>{desc}</Text>
      </View>
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(step, Math.round((value - step) * 100) / 100))}><Text style={s.stepBtnT}>−</Text></Pressable>
        <Text style={s.stepNum}>{value}kg</Text>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.round((value + step) * 100) / 100)}><Text style={s.stepBtnT}>＋</Text></Pressable>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, unit, divider, intOnly }: {
  label: string; value: string; onChange: (t: string) => void; unit: string; divider?: boolean; intOnly?: boolean;
}) {
  return (
    <View style={[s.frow, divider && s.rowDivider]}>
      <Text style={s.rowK}>{label}</Text>
      <View style={s.fv}>
        <TextInput
          style={s.finput}
          value={value}
          onChangeText={t => onChange(intOnly ? t.replace(/[^0-9]/g, '') : t)}
          keyboardType={intOnly ? 'number-pad' : 'decimal-pad'}
          selectTextOnFocus
        />
        <Text style={s.funit}>{unit}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SEM.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  navBack: { color: SEM.brand, fontSize: 16, fontWeight: '600' },
  navTitle: { color: SEM.ink1, fontSize: 17, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  sectionHd: { color: SEM.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: SEM.line },
  rowK: { color: SEM.ink1, fontSize: 15, fontWeight: '600' },
  frow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  fv: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  finput: { color: SEM.ink1, fontSize: 18, fontWeight: '800', textAlign: 'right', minWidth: 56, fontVariant: ['tabular-nums'] },
  funit: { color: SEM.ink3, fontSize: 11 },

  // 운동 목적 선택지
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  optL: { color: SEM.ink1, fontSize: 15, fontWeight: '700' },
  optD: { color: SEM.ink3, fontSize: 12.5, marginTop: 2 },
  tick: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: SEM.line2 },
  tickSel: { borderColor: SEM.brand, backgroundColor: SEM.brand },

  // 횟수·증량 스테퍼
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: SEM.surface3, borderWidth: 1, borderColor: SEM.line2, alignItems: 'center', justifyContent: 'center' },
  stepBtnT: { color: SEM.ink1, fontSize: 18, fontWeight: '800' },
  stepNum: { color: SEM.ink1, fontSize: 16, fontWeight: '800', minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
  note: { color: SEM.ink3, fontSize: 12, lineHeight: 17, marginTop: 8, marginHorizontal: 4 },

  save: { backgroundColor: SEM.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveT: { color: SEM.onBrand, fontSize: 15, fontWeight: '800' },
});
