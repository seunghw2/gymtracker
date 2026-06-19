import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, RefreshControl, TextInput, Modal,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SEM } from '../../constants/colors';
import { MUSCLE_KO, MUSCLE_COLOR } from '../../constants/exercises';
import { getExerciseSummaries, ExerciseSummary } from '../../db/queries';
import { loadPinned, savePinned, togglePin, isPin } from '../../lib/pinnedLifts';
import { bucketExercises, sortExercises, SortKey, SORTS } from '../../lib/exerciseSections';
import { readCache, writeCache } from '../../lib/diskCache';

// 부위(한글 라벨) → 식별 색. 기존 MUSCLE_KO/MUSCLE_COLOR(영문키) 재사용.
const KO_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(MUSCLE_KO).map(([en, ko]) => [ko, MUSCLE_COLOR[en] ?? SEM.ink3]),
);
const PART_ORDER = ['등', '어깨', '하체', '가슴', '팔', '코어', '유산소'];
const partColor = (ko: string | null) => (ko && KO_COLOR[ko]) || SEM.ink3;

/** 종목 허브(watchlist) — 검색·부위칩·보유/주목/관심/멈춤 섹션·티커행·정렬시트·스와이프. */
export default function ExercisesTab() {
  const router = useRouter();
  const [rows, setRows] = useState<ExerciseSummary[]>([]);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('1rm');
  const [showSort, setShowSort] = useState(false);
  const [q, setQ] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [staleOpen, setStaleOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, pins] = await Promise.all([getExerciseSummaries(), loadPinned()]);
      setRows(list);
      setPinned(pins);
      writeCache('exercise:summaries', list);   // 다음 콜드 스타트용
    } catch {
      /* 네트워크 실패 시 캐시된 행 유지 */
    }
  }, []);

  // 콜드 스타트 즉시 표시: 마지막 종목 목록을 디스크에서 바로 띄움(load가 백그라운드 갱신)
  useEffect(() => {
    readCache<ExerciseSummary[]>('exercise:summaries').then(c => {
      if (c && c.length) setRows(prev => (prev.length ? prev : c));
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const toggleFav = (name: string) => {
    const next = togglePin(name, pinned);
    setPinned(next);
    savePinned(next).catch(() => {});
  };
  const goReport = (r: ExerciseSummary) =>
    router.push({ pathname: '/exercise/[name]', params: { name: r.name, id: String(r.exerciseId) } });

  // 부위 칩 — 데이터에 있는 부위만, 정해진 순서로
  const partsPresent = useMemo(() => {
    const set = new Set(rows.map(r => r.bodyPart).filter(Boolean) as string[]);
    return PART_ORDER.filter(p => set.has(p));
  }, [rows]);

  const buckets = useMemo(() => {
    const f = q.trim().toLowerCase();
    let filtered = rows;
    if (part) filtered = filtered.filter(r => r.bodyPart === part);
    if (f) filtered = filtered.filter(r => r.name.toLowerCase().includes(f));
    return bucketExercises(filtered, name => isPin(name, pinned), sort);
  }, [rows, q, part, sort, pinned]);

  const sortLabel = SORTS.find(([k]) => k === sort)![1];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headTop}><Text style={s.title}>종목</Text></View>

      {/* 검색바 + 개수 */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={SEM.ink4} />
        <TextInput
          style={s.searchInput} value={q} onChangeText={setQ} autoCapitalize="none"
          placeholder={`종목 검색 · ${rows.length}개`} placeholderTextColor={SEM.ink4}
        />
        {q.length > 0 && <Pressable onPress={() => setQ('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={SEM.ink4} /></Pressable>}
      </View>

      {/* 부위 칩 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="전체" active={part === null} onPress={() => setPart(null)} />
        {partsPresent.map(p => (
          <Chip key={p} label={p} dot={partColor(p)} active={part === p} onPress={() => setPart(part === p ? null : p)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SEM.brand} />}>

        {rows.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 34, marginBottom: 10 }}>🏋️</Text>
            <Text style={s.emptyT}>운동을 기록하면 종목별 추이가 여기 모여요.</Text>
          </View>
        )}

        {buckets.pinned.length > 0 && (
          <Section title="★ 보유">
            {buckets.pinned.map(r => <ExRow key={r.exerciseId} r={r} fav onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}
          </Section>
        )}

        {buckets.highlight.length > 0 && (
          <Section title="▲ 주목 · 신기록" tint={SEM.good}>
            {buckets.highlight.map(r => <ExRow key={r.exerciseId} r={r} fav={isPin(r.name, pinned)} onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}
          </Section>
        )}

        {buckets.watch.length > 0 && (
          <Section title="관심 종목" right={
            <Pressable onPress={() => setShowSort(true)} hitSlop={8}><Text style={s.sortT}>{sortLabel} ⌄</Text></Pressable>
          }>
            {buckets.watch.map(r => <ExRow key={r.exerciseId} r={r} fav={false} onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}
          </Section>
        )}

        {buckets.stale.length > 0 && (
          <>
            <Pressable style={s.staleHead} onPress={() => setStaleOpen(o => !o)}>
              <Text style={s.staleL}>💤 한동안 멈춤</Text>
              <Text style={s.staleC}>{buckets.stale.length}개 · {staleOpen ? '접기 ⌃' : '펼치기 ⌄'}</Text>
            </Pressable>
            {staleOpen && buckets.stale.map(r => <ExRow key={r.exerciseId} r={r} fav={false} onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}
          </>
        )}

        <Text style={s.hint}>← 행을 밀면 ★즐겨찾기 · 리포트</Text>
      </ScrollView>

      {/* 정렬 시트 */}
      <Modal visible={showSort} transparent animationType="slide" onRequestClose={() => setShowSort(false)}>
        <Pressable style={s.scrim} onPress={() => setShowSort(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>정렬</Text>
            {SORTS.map(([k, label]) => (
              <Pressable key={k} style={s.sopt} onPress={() => { setSort(k); setShowSort(false); }}>
                <Text style={[s.soptT, sort === k && { color: SEM.brand, fontWeight: '800' }]}>{label}</Text>
                {sort === k && <Text style={s.soptCk}>✓</Text>}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, dot, active, onPress }: { label: string; dot?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, active && s.chipOn]} onPress={onPress}>
      {dot && <View style={[s.chipDot, { backgroundColor: dot }]} />}
      <Text style={[s.chipT, active && s.chipTOn]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, tint, right, children }: { title: string; tint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <View style={s.sech}>
        <Text style={[s.sechT, tint ? { color: tint } : null]}>{title}</Text>
        {right ?? null}
      </View>
      {children}
    </>
  );
}

function ExRow({ r, fav, onStar, onReport }: { r: ExerciseSummary; fav: boolean; onStar: () => void; onReport: () => void }) {
  const up = r.trend === 'new' || r.trend === 'up';
  const renderRight = () => (
    <View style={s.swipeWrap}>
      <Pressable style={[s.swipeBtn, { backgroundColor: '#3a3a1a' }]} onPress={onStar}>
        <Text style={[s.swipeT, { color: '#FFD60A' }]}>★</Text>
      </Pressable>
      <Pressable style={[s.swipeBtn, { backgroundColor: SEM.brand }]} onPress={onReport}>
        <Text style={[s.swipeT, { color: '#fff' }]}>리포트</Text>
      </Pressable>
    </View>
  );
  return (
    <Swipeable renderRightActions={renderRight} overshootRight={false}>
      <Pressable style={s.row} onPress={onReport}>
        <Pressable onPress={onStar} hitSlop={8} style={s.starHit}>
          <Text style={[s.rowStar, { color: fav ? '#FFD60A' : '#3a3a3e' }]}>{fav ? '★' : '☆'}</Text>
        </Pressable>
        <View style={[s.partDot, { backgroundColor: partColor(r.bodyPart) }]} />
        <View style={s.nameWrap}>
          <Text style={s.name} numberOfLines={1}>{r.name}</Text>
          {!!r.bodyPart && <Text style={s.part}>{r.bodyPart}</Text>}
        </View>
        <Spark data={r.spark} up={up} />
        <View style={s.valWrap}>
          <Text style={[s.trendDot, up ? { color: SEM.good } : { color: SEM.ink3 }]}>{up ? '▲' : '·'}</Text>
          <Text style={s.val}>{r.currentE1rm != null ? r.currentE1rm : '–'}</Text>
        </View>
      </Pressable>
    </Swipeable>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  headTop: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 6 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 16, marginVertical: 6, backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, padding: 0 },

  chips: { gap: 7, paddingHorizontal: 16, paddingVertical: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1a1a1c' },
  chipOn: { backgroundColor: SEM.brand },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipT: { color: SEM.ink3, fontSize: 13.5, fontWeight: '700' },
  chipTOn: { color: '#fff' },

  body: { paddingBottom: 28 },
  sech: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6 },
  sechT: { color: SEM.ink3, fontSize: 13, fontWeight: '700', flex: 1 },
  sortT: { color: SEM.brand, fontSize: 13, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 22, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#161616', backgroundColor: '#000' },
  starHit: { paddingRight: 1 },
  rowStar: { fontSize: 15, width: 15, textAlign: 'center' },
  partDot: { width: 9, height: 9, borderRadius: 5 },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  part: { color: SEM.ink4, fontSize: 12, marginTop: 2 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22, width: 48 },
  valWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, minWidth: 70 },
  trendDot: { fontSize: 12, fontWeight: '800' },
  val: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },

  staleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: SEM.surface2, borderRadius: 13 },
  staleL: { color: SEM.ink3, fontSize: 14, fontWeight: '700' },
  staleC: { color: SEM.ink4, fontSize: 12 },

  hint: { color: SEM.ink4, fontSize: 11.5, textAlign: 'center', paddingVertical: 16 },

  swipeWrap: { flexDirection: 'row' },
  swipeBtn: { width: 72, justifyContent: 'center', alignItems: 'center' },
  swipeT: { fontSize: 14, fontWeight: '800' },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: SEM.surface3, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30 },
  sheetTitle: { color: SEM.ink3, fontSize: 14, fontWeight: '700', margin: 16, marginBottom: 4 },
  sopt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: 1, borderTopColor: SEM.line2 },
  soptT: { color: '#fff', fontSize: 16, fontWeight: '600' },
  soptCk: { color: SEM.brand, fontSize: 16, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyT: { color: '#8a8a8e', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
});
