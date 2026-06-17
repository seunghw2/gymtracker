import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, RefreshControl, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SEM } from '../../constants/colors';
import { getExerciseSummaries, ExerciseSummary } from '../../db/queries';
import { loadPinned, savePinned, togglePin, isPin } from '../../lib/pinnedLifts';

type SortKey = '1rm' | 'plateau' | 'recent';
const SORTS: [SortKey, string][] = [['1rm', '1RM순'], ['plateau', '정체순'], ['recent', '최근순']];

/** 종목 허브(watchlist) — ★보유/관심 섹션, 미니 스파크, 1RM·등락칩, 정렬·검색. 행 탭 → 종목 리포트. */
export default function ExercisesTab() {
  const router = useRouter();
  const [rows, setRows] = useState<ExerciseSummary[]>([]);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('1rm');
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, pins] = await Promise.all([getExerciseSummaries(), loadPinned()]);
      setRows(list);
      setPinned(pins);
    } catch {
      setRows([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const toggleFav = async (name: string) => {
    const next = togglePin(name, pinned);
    setPinned(next);
    savePinned(next).catch(() => {});
  };

  const sorted = useMemo(() => {
    const f = q.trim().toLowerCase();
    const filtered = f ? rows.filter(r => r.name.toLowerCase().includes(f)) : rows;
    const cmp = (a: ExerciseSummary, b: ExerciseSummary) => {
      if (sort === 'plateau') return b.plateauWeeks - a.plateauWeeks;
      if (sort === 'recent') return (b.lastDate ?? '').localeCompare(a.lastDate ?? '');
      return (b.currentE1rm ?? 0) - (a.currentE1rm ?? 0);
    };
    return [...filtered].sort(cmp);
  }, [rows, q, sort]);

  const fav = sorted.filter(r => isPin(r.name, pinned));
  const rest = sorted.filter(r => !isPin(r.name, pinned));

  const goReport = (r: ExerciseSummary) =>
    router.push({ pathname: '/exercise/[name]', params: { name: r.name, id: String(r.exerciseId) } });

  const cycleSort = () => {
    const i = SORTS.findIndex(([k]) => k === sort);
    setSort(SORTS[(i + 1) % SORTS.length][0]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headTop}>
        <Text style={s.title}>종목</Text>
        <Pressable onPress={() => setShowSearch(v => !v)} hitSlop={10}>
          <Ionicons name={showSearch ? 'close' : 'search'} size={20} color="#8a8a8e" />
        </Pressable>
      </View>

      {showSearch && (
        <TextInput
          style={s.search} placeholder="종목 검색…" placeholderTextColor="#5a5a5e"
          value={q} onChangeText={setQ} autoFocus autoCapitalize="none"
        />
      )}

      <ScrollView contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SEM.brand} />}>

        {rows.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 34, marginBottom: 10 }}>🏋️</Text>
            <Text style={s.emptyT}>운동을 기록하면 종목별 추이가 여기 모여요.</Text>
          </View>
        )}

        {fav.length > 0 && (
          <>
            <View style={s.sech}><Text style={s.star}>★</Text><Text style={s.sechT}>보유 (즐겨찾기)</Text></View>
            {fav.map(r => <Row key={r.exerciseId} r={r} fav onPress={() => goReport(r)} onStar={() => toggleFav(r.name)} />)}
          </>
        )}

        {rest.length > 0 && (
          <>
            <View style={s.sech}>
              <Text style={s.sechT}>{fav.length > 0 ? '관심 (전체)' : '전체'}</Text>
              <Pressable onPress={cycleSort} hitSlop={8} style={s.sortBtn}>
                <Text style={s.sortT}>{SORTS.find(([k]) => k === sort)![1]} ⌄</Text>
              </Pressable>
            </View>
            {rest.map(r => <Row key={r.exerciseId} r={r} onPress={() => goReport(r)} onStar={() => toggleFav(r.name)} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ r, fav, onPress, onStar }: { r: ExerciseSummary; fav?: boolean; onPress: () => void; onStar: () => void }) {
  const chip = trendChip(r);
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Pressable onPress={onStar} hitSlop={8} style={s.starHit}>
        <Text style={[s.rowStar, { color: fav ? '#FFD60A' : '#3a3a3e' }]}>{fav ? '★' : '☆'}</Text>
      </Pressable>
      <View style={s.nameWrap}>
        <Text style={s.name} numberOfLines={1}>{r.name}</Text>
        <Text style={s.part}>{r.bodyPart}</Text>
      </View>
      <Spark data={r.spark} up={r.trend !== 'flat'} />
      <View style={s.valWrap}>
        <Text style={s.val}>{r.currentE1rm != null ? r.currentE1rm : '–'}</Text>
        <Text style={[s.chip, { color: chip.color }]} numberOfLines={1}>{chip.text}</Text>
      </View>
    </Pressable>
  );
}

function Spark({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <View style={s.spark} />;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  return (
    <View style={s.spark}>
      {data.map((v, i) => {
        const h = 4 + ((v - min) / range) * 16;
        const isLast = i === data.length - 1;
        return <View key={i} style={{ flex: 1, height: h, borderRadius: 1, backgroundColor: isLast && up ? SEM.good : '#2a2a30' }} />;
      })}
    </View>
  );
}

function trendChip(r: ExerciseSummary): { text: string; color: string } {
  if (r.trend === 'new') return { text: '▲ 신기록', color: SEM.good };
  if (r.trend === 'flat') return { text: r.plateauWeeks > 0 ? `▬ 정체 ${r.plateauWeeks}주` : '▬', color: SEM.bad };
  const d = r.delta ?? 0;
  return { text: d > 0 ? `▲ +${trim(d)}` : '▲', color: SEM.good };
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  search: { marginHorizontal: 14, marginBottom: 6, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14 },
  body: { paddingBottom: 24 },

  sech: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  star: { color: '#FFD60A', fontSize: 11 },
  sechT: { color: '#6a6a6e', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  sortBtn: { marginLeft: 'auto' },
  sortT: { color: '#7a7a7e', fontSize: 10.5, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#15151a' },
  starHit: { paddingRight: 2 },
  rowStar: { fontSize: 14 },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontSize: 14, fontWeight: '800' },
  part: { color: '#8a8a8e', fontSize: 10.5, marginTop: 2 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 20, width: 44 },
  valWrap: { alignItems: 'flex-end', minWidth: 66 },
  val: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  chip: { fontSize: 9.5, fontWeight: '800', marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyT: { color: '#8a8a8e', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
});
