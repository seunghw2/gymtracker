import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SEM } from '../constants/colors';
import { getExercises, getSetting, setSetting, setExerciseRest, Exercise } from '../db/queries';
import { useSettingsStore } from '../store/useStore';

/** 종목별 휴식시간 — 기본값(스텝퍼) + 오버라이드된 종목만 노출 + 검색으로 추가. */
export default function ExerciseRestScreen() {
  const router = useRouter();
  const { restDurationSec, setRestDuration } = useSettingsStore();
  const [all, setAll] = useState<Exercise[]>([]);
  const [over, setOver] = useState<Record<number, number>>({});   // exerciseId → 초 (오버라이드만)
  const [def, setDef] = useState(restDurationSec);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const list = await getExercises().catch(() => [] as Exercise[]);
    setAll(list);
    const rd = await getSetting('rest_duration_sec', String(restDurationSec));
    setDef(parseInt(rd, 10) || restDurationSec);
    const map: Record<number, number> = {};
    for (const ex of list) {
      const raw = await getSetting(`rest_ex_${ex.id}`, '');
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) map[ex.id] = n;
    }
    setOver(map);
  }, [restDurationSec]);

  useEffect(() => { load(); }, [load]);

  const changeDefault = (delta: number) => {
    const next = Math.max(15, Math.min(600, def + delta));
    setDef(next);
    setRestDuration(next);
    setSetting('rest_duration_sec', String(next)).catch(() => {});
  };

  const setOverride = (id: number, sec: number) => {
    setOver(prev => ({ ...prev, [id]: sec }));
    setExerciseRest(id, sec).catch(() => {});
  };
  const editOverride = (id: number, text: string) => {
    const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
    setOver(prev => ({ ...prev, [id]: Number.isFinite(n) ? n : 0 }));
  };
  const commitOverride = (id: number) => {
    const n = over[id];
    if (Number.isFinite(n) && n > 0) setExerciseRest(id, n).catch(() => {});
    else removeOverride(id);
  };
  const removeOverride = (id: number) => {
    setOver(prev => { const c = { ...prev }; delete c[id]; return c; });
    setSetting(`rest_ex_${id}`, '').catch(() => {});   // 빈 값 = 기본값 적용
  };

  const byId = (id: number) => all.find(e => e.id === id);
  const overrideIds = Object.keys(over).map(Number);
  const q = query.trim().toLowerCase();
  const addable = all.filter(e => over[e.id] === undefined && (!q || e.name.toLowerCase().includes(q)));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.navBack}>‹ 설정</Text></Pressable>
        <Text style={s.navTitle}>종목별 휴식시간</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* 기본값 */}
        <View style={s.defCard}>
          <Text style={s.defLbl}>기본 휴식 시간</Text>
          <View style={s.stepper}>
            <Pressable style={s.stepBtn} onPress={() => changeDefault(-15)}><Text style={s.stepT}>−</Text></Pressable>
            <Text style={s.defVal}>{def}초</Text>
            <Pressable style={s.stepBtn} onPress={() => changeDefault(15)}><Text style={s.stepT}>+</Text></Pressable>
          </View>
          <Text style={s.defHint}>모든 종목 기본 적용</Text>
        </View>

        <Text style={s.sectionHd}>개별 설정 · {overrideIds.length}</Text>
        <View style={s.group}>
          {overrideIds.length === 0 && <Text style={s.empty}>개별 설정된 종목이 없어요</Text>}
          {overrideIds.map((id, i) => {
            const ex = byId(id);
            if (!ex) return null;
            return (
              <View key={id} style={[s.exr, i > 0 && s.rowDivider]}>
                <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
                <View style={s.pill}>
                  <TextInput
                    style={s.pillInput}
                    value={String(over[id] ?? '')}
                    onChangeText={t => editOverride(id, t)}
                    onEndEditing={() => commitOverride(id)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <Text style={s.pillUnit}>초</Text>
                </View>
                <Pressable onPress={() => removeOverride(id)} hitSlop={8}><Text style={s.del}>삭제</Text></Pressable>
              </View>
            );
          })}
        </View>

        <Pressable style={s.addBtn} onPress={() => { setQuery(''); setPicking(true); }}>
          <Text style={s.addBtnT}>+ 종목 휴식시간 추가</Text>
        </Pressable>
      </ScrollView>

      {/* 종목 선택 모달 */}
      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable style={s.backdrop} onPress={() => setPicking(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>종목 선택</Text>
            <TextInput style={s.search} placeholder="종목 검색" placeholderTextColor={SEM.ink4} value={query} onChangeText={setQuery} autoFocus />
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {addable.map(e => (
                <Pressable key={e.id} style={s.pickRow} onPress={() => { setOverride(e.id, def); setPicking(false); }}>
                  <Text style={s.pickName} numberOfLines={1}>{e.name}</Text>
                  {e.brand && <Text style={s.pickBrand} numberOfLines={1}>{e.brand}</Text>}
                </Pressable>
              ))}
              {addable.length === 0 && <Text style={s.empty}>검색 결과가 없어요</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SEM.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  navBack: { color: SEM.brand, fontSize: 16, fontWeight: '600' },
  navTitle: { color: SEM.ink1, fontSize: 17, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },

  defCard: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, padding: 16, alignItems: 'center' },
  defLbl: { color: SEM.ink2, fontSize: 12, marginBottom: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: SEM.surface3, alignItems: 'center', justifyContent: 'center' },
  stepT: { color: SEM.brand, fontSize: 20, fontWeight: '800' },
  defVal: { color: SEM.ink1, fontSize: 22, fontWeight: '800', minWidth: 78, textAlign: 'center', fontVariant: ['tabular-nums'] },
  defHint: { color: SEM.ink3, fontSize: 10.5, marginTop: 8 },

  sectionHd: { color: SEM.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, overflow: 'hidden' },
  rowDivider: { borderTopWidth: 1, borderTopColor: SEM.line },
  empty: { color: SEM.ink4, fontSize: 13, textAlign: 'center', paddingVertical: 18 },

  exr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  exName: { color: SEM.ink1, fontSize: 14, fontWeight: '700', flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,59,48,0.14)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pillInput: { color: SEM.brand, fontSize: 14, fontWeight: '800', minWidth: 30, textAlign: 'center', padding: 0, fontVariant: ['tabular-nums'] },
  pillUnit: { color: SEM.brand, fontSize: 11, fontWeight: '700' },
  del: { color: SEM.danger, fontSize: 13, fontWeight: '600' },

  addBtn: { borderWidth: 1, borderColor: '#3a2422', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  addBtnT: { color: SEM.brand, fontSize: 14, fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: SEM.surface3, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 30 },
  sheetTitle: { color: SEM.ink1, fontSize: 16, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  search: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line2, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: SEM.ink1, fontSize: 14, marginBottom: 8 },
  pickRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: SEM.line },
  pickName: { color: SEM.ink1, fontSize: 14, fontWeight: '600' },
  pickBrand: { color: SEM.ink3, fontSize: 11, marginTop: 2 },
});
