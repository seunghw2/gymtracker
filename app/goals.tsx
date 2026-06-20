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

/** 목표 설정 전용 페이지 — 체중·체지방·기본 휴식 + 단위(kg) 통합. */
export default function GoalsScreen() {
  const router = useRouter();
  const { goalWeightKg, goalBodyFatPct, restDurationSec, unitKg, setGoalWeight, setGoalBodyFat, setRestDuration, setUnitKg } = useSettingsStore();
  const [w, setW] = useState(String(goalWeightKg));
  const [f, setF] = useState(String(goalBodyFatPct));
  const [r, setR] = useState(String(restDurationSec));

  useEffect(() => {
    (async () => {
      setW(await getSetting('goal_weight_kg', String(goalWeightKg)));
      setF(await getSetting('goal_body_fat_pct', String(goalBodyFatPct)));
      setR(await getSetting('rest_duration_sec', String(restDurationSec)));
    })().catch(() => {});
  }, []);

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
  save: { backgroundColor: SEM.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveT: { color: SEM.onBrand, fontSize: 15, fontWeight: '800' },
});
