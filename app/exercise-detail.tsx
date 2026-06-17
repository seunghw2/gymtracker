import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, Modal, TextInput, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  getTrainedExercises, getExercises, get1RMHistory, getActualRmHistory,
  getExerciseRmBasis, setExerciseRmBasis, convertRm, TrainedExercise,
} from '../db/queries';
import OneRMChart from '../components/OneRMChart';
import { MUSCLE_KO, MUSCLE_COLOR } from '../constants/exercises';
import { useSettingsStore } from '../store/useStore';
import { RT } from '../components/report/theme';

const RM_OPTIONS = [1, 3, 5, 8, 10, 12];

/** 종목 상세 — 통계 탭에서 흡수한 탐색형 도구(1RM 추세·실제/추정 RM). 리포트 종목 카드에서 진입. */
export default function ExerciseDetail() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { unitKg } = useSettingsStore();

  const [exercises, setExercises] = useState<TrainedExercise[] | null>(null);
  const [exMuscle, setExMuscle] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<TrainedExercise | null>(null);
  const [ormData, setOrmData] = useState<{ date: string; estimated_1rm: number }[]>([]);
  const [actualData, setActualData] = useState<{ date: string; estimated_1rm: number }[]>([]);
  const [rmBasis, setRmBasis] = useState(1);
  const [rmMode, setRmMode] = useState<'est' | 'actual'>('est');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerPart, setPickerPart] = useState('ALL');

  useEffect(() => {
    getTrainedExercises().then(list => {
      setExercises(list);
      const match = name ? list.find(e => e.name === name) : null;
      setSelected(prev => prev ?? match ?? list[0] ?? null);
    }).catch(() => setExercises([]));
    getExercises().then(all => {
      const m: Record<number, string> = {};
      for (const e of all) m[e.id] = e.muscle_group;
      setExMuscle(m);
    }).catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!selected) return;
    get1RMHistory(selected.id).then(setOrmData).catch(() => setOrmData([]));
    getExerciseRmBasis(selected.id).then(setRmBasis).catch(() => setRmBasis(1));
  }, [selected]);

  useEffect(() => {
    if (rmMode === 'actual' && selected) {
      getActualRmHistory(selected.id, rmBasis).then(setActualData).catch(() => setActualData([]));
    }
  }, [rmMode, rmBasis, selected]);

  const changeRmBasis = (n: number) => {
    setRmBasis(n);
    if (selected) setExerciseRmBasis(selected.id, n).catch(() => {});
  };

  const bestE1rm = useMemo(() => ormData.reduce((m, d) => Math.max(m, d.estimated_1rm), 0), [ormData]);

  const parts = useMemo(() => {
    const all = exercises ?? [];
    const set = new Set(all.map(e => exMuscle[e.id]).filter(Boolean));
    return Array.from(set);
  }, [exercises, exMuscle]);

  const list = useMemo(() => {
    const all = exercises ?? [];
    const q = pickerSearch.trim().toLowerCase();
    return all.filter(e =>
      (pickerPart === 'ALL' || exMuscle[e.id] === pickerPart) &&
      (!q || e.name.toLowerCase().includes(q)));
  }, [exercises, exMuscle, pickerSearch, pickerPart]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>종목 상세</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Pressable style={styles.exSelect} onPress={() => { setPickerSearch(''); setPickerPart('ALL'); setPickerOpen(true); }}>
          <Text style={styles.exSelectText} numberOfLines={1}>
            {selected ? `${selected.name}${selected.brand ? ` (${selected.brand})` : ''}` : '종목 선택'}
          </Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>

        {selected ? (
          <>
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statV}>{bestE1rm ? Math.round(bestE1rm) : '–'}</Text>
                <Text style={styles.statL}>최고 추정 1RM</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statV}>{ormData.length}</Text>
                <Text style={styles.statL}>기록 수</Text>
              </View>
            </View>

            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>표시 기준</Text>
              <View style={styles.seg}>
                {(['est', 'actual'] as const).map(m => (
                  <Pressable key={m} style={[styles.segCell, rmMode === m && styles.cellOn]} onPress={() => setRmMode(m)}>
                    <Text style={[styles.cellText, rmMode === m && styles.cellTextOn]}>{m === 'est' ? '추정' : '실제'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.rmGrid}>
              {RM_OPTIONS.map(n => (
                <Pressable key={n} style={[styles.rmCell, rmBasis === n && styles.cellOn]} onPress={() => changeRmBasis(n)}>
                  <Text style={[styles.cellText, rmBasis === n && styles.cellTextOn]}>{n}RM</Text>
                </Pressable>
              ))}
            </View>

            {rmMode === 'est' ? (
              <OneRMChart data={ormData.map(d => ({ ...d, estimated_1rm: convertRm(d.estimated_1rm, rmBasis) }))} title={`${selected.name} 추정 ${rmBasis}RM`} unitKg={unitKg} />
            ) : actualData.length > 0 ? (
              <OneRMChart data={actualData} title={`${selected.name} 실제 ${rmBasis}RM`} unitKg={unitKg} />
            ) : (
              <View style={styles.placeholder}><Text style={styles.placeholderText}>{rmBasis}회로 실제 수행한 기록이 없어요</Text></View>
            )}
          </>
        ) : (
          <View style={styles.placeholder}><Text style={styles.placeholderText}>종목을 선택하면 그래프가 표시돼요</Text></View>
        )}
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}><Text style={styles.modalBack}>✕</Text></Pressable>
            <Text style={styles.title}>종목 선택</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partRow}>
            <Pressable style={[styles.partChip, pickerPart === 'ALL' && styles.partChipOn]} onPress={() => setPickerPart('ALL')}>
              <Text style={[styles.partChipText, pickerPart === 'ALL' && styles.partChipTextOn]}>전체</Text>
            </Pressable>
            {parts.map(p => (
              <Pressable key={p} style={[styles.partChip, pickerPart === p && styles.partChipOn]} onPress={() => setPickerPart(p)}>
                <View style={[styles.dot, { backgroundColor: MUSCLE_COLOR[p] ?? RT.ink3 }]} />
                <Text style={[styles.partChipText, pickerPart === p && styles.partChipTextOn]}>{MUSCLE_KO[p] ?? p}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <TextInput style={styles.search} placeholder="종목 검색" placeholderTextColor={RT.ink3} value={pickerSearch} onChangeText={setPickerSearch} clearButtonMode="while-editing" />
          </View>
          <FlatList
            data={list}
            keyExtractor={i => String(i.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => { setSelected(item); setPickerOpen(false); }}>
                <View style={[styles.dot, { backgroundColor: MUSCLE_COLOR[exMuscle[item.id]] ?? RT.ink3 }]} />
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                {selected?.id === item.id && <Text style={styles.check}>✓</Text>}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[styles.placeholderText, { textAlign: 'center', marginTop: 24 }]}>종목이 없어요</Text>}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RT.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: RT.hair },
  back: { color: RT.action, fontSize: 30, width: 24, marginTop: -4 },
  modalBack: { color: RT.action, fontSize: 20, width: 24 },
  title: { color: RT.ink, fontSize: 16, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40 },

  exSelect: { flexDirection: 'row', alignItems: 'center', backgroundColor: RT.surface, borderRadius: 12, borderWidth: 1, borderColor: RT.hair, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  exSelectText: { color: RT.ink, fontSize: 15, fontWeight: '700', flex: 1 },
  chevron: { color: RT.ink2, fontSize: 16 },

  statRow: { flexDirection: 'row', gap: 9, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: RT.surface, borderRadius: 14, borderWidth: 1, borderColor: RT.hair, paddingVertical: 14, alignItems: 'center' },
  statV: { color: RT.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statL: { color: RT.ink2, fontSize: 11, marginTop: 4 },

  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modeLabel: { color: RT.ink2, fontSize: 12.5, fontWeight: '700' },
  seg: { flexDirection: 'row', backgroundColor: RT.surface, borderRadius: 10, padding: 3 },
  segCell: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8 },
  rmGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  rmCell: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9, backgroundColor: RT.surface },
  cellOn: { backgroundColor: RT.good },
  cellText: { color: RT.ink2, fontSize: 13, fontWeight: '700' },
  cellTextOn: { color: '#06270d', fontWeight: '800' },

  placeholder: { backgroundColor: RT.surface, borderRadius: 14, padding: 30, alignItems: 'center', marginTop: 6 },
  placeholderText: { color: RT.ink3, fontSize: 13 },

  partRow: { gap: 7, paddingHorizontal: 16, paddingVertical: 10 },
  partChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: RT.surface2 },
  partChipOn: { backgroundColor: RT.good },
  partChipText: { color: RT.ink2, fontSize: 12.5, fontWeight: '700' },
  partChipTextOn: { color: '#06270d', fontWeight: '800' },
  dot: { width: 9, height: 9, borderRadius: 3 },
  search: { backgroundColor: RT.surface, borderRadius: 11, borderWidth: 1, borderColor: RT.hair, color: RT.ink, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: RT.hair },
  rowName: { color: RT.ink, fontSize: 15, flex: 1 },
  check: { color: RT.good, fontSize: 16, fontWeight: '800' },
});
