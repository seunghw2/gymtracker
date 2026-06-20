import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { SEM, ACCENT } from '../../constants/colors';
import { MUSCLE_KO, MUSCLE_COLOR, PART_ORDER } from '../../constants/exercises';
import {
  getExerciseSummaries, getExercises, getSetting, setSetting, ExerciseSummary,
  listGroups, createGroup, updateGroup, deleteGroup, getTrainedExerciseIds, ExerciseGroup,
} from '../../db/queries';
import { buildPellets, groupRows, systemRows, Pellet, SystemKind, moveMember } from '../../lib/exerciseGroups';
import { deriveCard } from '../../lib/exerciseCard';
import { sortItems, SortKey, SORT_OPTIONS } from '../../lib/exerciseSort';
import ExerciseGrid, { GridItem } from '../../components/exercises/ExerciseGrid';
import SortSheet from '../../components/exercises/SortSheet';
import { readCache, writeCache } from '../../lib/diskCache';
import { toDateStr } from '../../lib/date';

const KO_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(MUSCLE_KO).map(([en, ko]) => [ko, MUSCLE_COLOR[en] ?? SEM.ink3]),
);
const partColor = (ko: string | null) => (ko && KO_COLOR[ko]) || SEM.ink3;
const PART_ORDER_KO = PART_ORDER.map(en => MUSCLE_KO[en]).filter(Boolean);

type ExMeta = { equip: string | null; brand: string | null };
type Row = GridItem & { part: string; weight: number; lastDate: string | null };

function weekRanges() {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7);
  const lastSun = new Date(mon); lastSun.setDate(mon.getDate() - 1);
  return {
    thisFrom: toDateStr(mon), thisTo: toDateStr(d),
    lastFrom: toDateStr(lastMon), lastTo: toDateStr(lastSun),
  };
}

export default function ExercisesTab() {
  const router = useRouter();
  const [rows, setRows] = useState<ExerciseSummary[]>([]);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [metaById, setMetaById] = useState<Map<number, ExMeta>>(new Map());
  const [thisWeekIds, setThisWeekIds] = useState<Set<number>>(new Set());
  const [lastWeekIds, setLastWeekIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('manual');
  const [sortOpen, setSortOpen] = useState(false);
  const [selKey, setSelKey] = useState<string>('sys:all');
  const [edit, setEdit] = useState(false);
  const [menuGroup, setMenuGroup] = useState<ExerciseGroup | null>(null);
  const [defaultIds, setDefaultIds] = useState<number[]>([]);

  const saveDefaultIds = (ids: number[]) => {
    setDefaultIds(ids);
    setSetting('default_group_ids', ids.join(',')).catch(() => {});
  };

  const lastLoadRef = useRef(0);
  const FOCUS_TTL_MS = 30_000;
  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - lastLoadRef.current < FOCUS_TTL_MS) return;
    lastLoadRef.current = Date.now();
    try {
      const [list, gs] = await Promise.all([getExerciseSummaries(), listGroups().catch(() => [] as ExerciseGroup[])]);
      setRows(list); setGroups(gs);
      writeCache('exercise:summaries', list);
      writeCache('exercise:groups', gs);
      getExercises().then(ex => setMetaById(new Map(ex.map(e => [e.id, { equip: e.equipment_type, brand: e.brand }])))).catch(() => {});
      getSetting('default_group_ids', '').then(csv =>
        setDefaultIds(csv ? csv.split(',').map(Number).filter(n => Number.isFinite(n)) : [])).catch(() => {});
      const { thisFrom, thisTo, lastFrom, lastTo } = weekRanges();
      getTrainedExerciseIds(thisFrom, thisTo).then(ids => setThisWeekIds(new Set(ids))).catch(() => {});
      getTrainedExerciseIds(lastFrom, lastTo).then(ids => setLastWeekIds(new Set(ids))).catch(() => {});
    } catch { lastLoadRef.current = 0; }
  }, []);

  useEffect(() => {
    readCache<ExerciseSummary[]>('exercise:summaries').then(c => { if (c?.length) setRows(prev => prev.length ? prev : c); });
    readCache<ExerciseGroup[]>('exercise:groups').then(c => { if (c?.length) setGroups(prev => prev.length ? prev : c); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(true); setRefreshing(false); }, [load]);

  const goDetail = (id: number, name: string) =>
    router.push({ pathname: '/exercise/[name]', params: { name, id: String(id) } });

  const pellets = useMemo(() => buildPellets(groups), [groups]);
  const sel: Pellet = useMemo(() => {
    const found = pellets.find(p => (p.kind === 'system' ? `sys:${p.key}` : `custom:${p.id}`) === selKey);
    return found ?? pellets[0];
  }, [pellets, selKey]);
  const customGroups = useMemo(() => [...groups].sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id), [groups]);
  const byId = useMemo(() => new Map(rows.map(r => [r.exerciseId, r])), [rows]);

  // 선택 그룹의 종목 행 + 편집 가능 여부 + 추가 타깃
  const selInfo = useMemo(() => {
    if (sel?.kind === 'custom') {
      const g = groups.find(x => x.id === sel.id);
      return { rows: groupRows(g?.exerciseIds ?? [], byId), editable: true, kind: 'custom' as const, group: g };
    }
    const key = (sel as { key: SystemKind }).key;
    if (key === 'all') return { rows: groupRows(defaultIds, byId), editable: true, kind: 'all' as const, group: undefined };
    const weekIds = key === 'thisWeek' ? thisWeekIds : lastWeekIds;
    return { rows: systemRows(key, rows, weekIds), editable: false, kind: key, group: undefined };
  }, [sel, groups, byId, defaultIds, rows, thisWeekIds, lastWeekIds]);

  const items: Row[] = useMemo(() => {
    const base: Row[] = selInfo.rows.map(r => {
      const meta = metaById.get(r.exerciseId);
      const equip = (meta?.brand?.trim()) || meta?.equip || '';
      return {
        exerciseId: r.exerciseId, name: r.name, partLabel: r.bodyPart, equipLabel: equip,
        dotColor: partColor(r.bodyPart), data: deriveCard(r),
        part: r.bodyPart, weight: r.recentTopWeightKg ?? 0, lastDate: r.lastDate,
      };
    });
    return sortItems(base, sortKey, PART_ORDER_KO);
  }, [selInfo, metaById, sortKey]);

  const draggable = edit && sortKey === 'manual' && selInfo.editable;

  const onReorder = (from: number, to: number) => {
    if (selInfo.kind === 'custom' && selInfo.group) {
      const ids = moveMember(selInfo.group.exerciseIds, from, to);
      setGroups(prev => prev.map(x => x.id === selInfo.group!.id ? { ...x, exerciseIds: ids } : x));
      updateGroup(selInfo.group.id, { exerciseIds: ids }).catch(() => {});
    } else if (selInfo.kind === 'all') {
      saveDefaultIds(moveMember(defaultIds, from, to));
    }
  };
  const onRemoveItem = (exId: number) => {
    if (selInfo.kind === 'custom' && selInfo.group) {
      const ids = selInfo.group.exerciseIds.filter(id => id !== exId);
      setGroups(prev => prev.map(x => x.id === selInfo.group!.id ? { ...x, exerciseIds: ids } : x));
      updateGroup(selInfo.group.id, { exerciseIds: ids }).catch(() => {});
    } else if (selInfo.kind === 'all') {
      saveDefaultIds(defaultIds.filter(id => id !== exId));
    }
  };
  const onAdd = () => {
    if (selInfo.kind === 'custom' && selInfo.group) {
      router.push({ pathname: '/exercise-add', params: { target: 'group', groupId: String(selInfo.group.id) } });
    } else if (selInfo.kind === 'all') {
      router.push({ pathname: '/exercise-add', params: { target: 'default' } });
    }
  };

  const selectPellet = (key: string) => { setSelKey(key); setEdit(false); };

  const addGroup = async () => {
    Alert.prompt?.('새 그룹', '그룹 이름을 입력하세요', async (name?: string) => {
      const t = (name ?? '').trim(); if (!t) return;
      const g = await createGroup(t).catch(() => null);
      if (g) { setGroups(prev => [...prev, g]); setSelKey(`custom:${g.id}`); }
    });
    if (!Alert.prompt) { const g = await createGroup('새 그룹').catch(() => null); if (g) { setGroups(p => [...p, g]); setSelKey(`custom:${g.id}`); } }
  };
  const renameGroup = (g: ExerciseGroup) => {
    Alert.prompt?.('이름 변경', '', async (name?: string) => {
      const t = (name ?? '').trim(); if (!t) return;
      setGroups(prev => prev.map(x => x.id === g.id ? { ...x, name: t } : x));
      updateGroup(g.id, { name: t }).catch(() => {});
    }, 'plain-text', g.name);
  };
  const removeGroup = (g: ExerciseGroup) => {
    Alert.alert('그룹 삭제', `"${g.name}" 그룹을 삭제할까요?\n(담긴 종목 기록은 그대로예요)`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => {
        setGroups(prev => prev.filter(x => x.id !== g.id));
        if (selKey === `custom:${g.id}`) setSelKey('sys:all');
        deleteGroup(g.id).catch(() => {});
      } },
    ]);
  };

  const sortLabel = SORT_OPTIONS.find(([k]) => k === sortKey)![1];
  const emptyLabel = selInfo.kind === 'thisWeek' || selInfo.kind === 'lastWeek'
    ? '이 기간에 한 운동이 없어요' : '이 그룹에 담긴 종목이 없어요';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headTop}><Text style={s.title}>종목</Text></View>

      {/* 그룹 펠릿 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pelletBar} contentContainerStyle={s.pellets}>
        {pellets.filter(p => p.kind === 'system').map(p => p.kind === 'system' && (
          <GroupPellet key={`sys:${p.key}`} label={p.name} locked active={selKey === `sys:${p.key}`} onPress={() => selectPellet(`sys:${p.key}`)} />
        ))}
        {customGroups.map(g => (
          <GroupPellet key={`custom:${g.id}`} label={g.name} active={selKey === `custom:${g.id}`} edit={edit}
            onPress={() => selectPellet(`custom:${g.id}`)}
            onLongPress={() => setMenuGroup(g)}
            onDelete={() => removeGroup(g)} />
        ))}
        {!edit && <Pressable style={s.addPellet} onPress={addGroup}><Text style={s.addPelletT}>+ 그룹추가</Text></Pressable>}
      </ScrollView>

      {/* 컨트롤바: 그룹·정렬 라벨 + 정렬 + 편집 */}
      <View style={s.ctrlbar}>
        <Text style={s.ctrlL} numberOfLines={1}>{sel?.name ?? ''} · {sortLabel}</Text>
        <Pressable style={s.sortBtn} onPress={() => setSortOpen(true)} hitSlop={6}><Text style={s.sortBtnT}>{sortLabel} ⌄</Text></Pressable>
        {selInfo.editable && (
          <Pressable onPress={() => setEdit(e => !e)} hitSlop={8}><Text style={s.editBtn}>{edit ? '완료' : '편집'}</Text></Pressable>
        )}
      </View>

      <View style={s.flex1}>
        <ExerciseGrid
          items={items}
          editing={edit && selInfo.editable}
          draggable={draggable}
          canAdd={selInfo.editable}
          emptyLabel={emptyLabel}
          onPressItem={(id) => { const r = byId.get(id); if (r) goDetail(id, r.name); }}
          onRemoveItem={onRemoveItem}
          onReorder={onReorder}
          onAdd={onAdd}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </View>

      <SortSheet visible={sortOpen} current={sortKey} onSelect={setSortKey} onClose={() => setSortOpen(false)} />

      {/* 그룹 관리 시트(롱프레스) */}
      <Modal visible={!!menuGroup} transparent animationType="slide" onRequestClose={() => setMenuGroup(null)}>
        <Pressable style={s.scrim} onPress={() => setMenuGroup(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.sheetTitle}>{menuGroup?.name}</Text>
            <Pressable style={s.sopt} onPress={() => { const g = menuGroup!; setMenuGroup(null); renameGroup(g); }}>
              <Text style={s.soptT}>✏️ 이름 변경</Text>
            </Pressable>
            <Pressable style={s.sopt} onPress={() => { setMenuGroup(null); setEdit(true); }}>
              <Text style={s.soptT}>↕️ 순서 변경</Text>
            </Pressable>
            <Pressable style={s.sopt} onPress={() => { const g = menuGroup!; setMenuGroup(null); removeGroup(g); }}>
              <Text style={[s.soptT, { color: SEM.danger }]}>🗑️ 삭제</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function GroupPellet({ label, locked, active, edit, onPress, onLongPress, onDelete }: {
  label: string; locked?: boolean; active: boolean; edit?: boolean; onPress: () => void; onLongPress?: () => void; onDelete?: () => void;
}) {
  return (
    <View>
      {edit && onDelete && <Pressable style={s.pelletX} onPress={onDelete} hitSlop={6}><Text style={s.pelletXT}>✕</Text></Pressable>}
      <Pressable style={[s.pellet, active && s.pelletOn]} onPress={onPress} onLongPress={onLongPress} delayLongPress={450}>
        <Text style={[s.pelletT, active && s.pelletTOn]}>{label}{locked ? ' 🔒' : ''}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  flex1: { flex: 1 },
  headTop: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 6 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },

  pelletBar: { flexGrow: 0, flexShrink: 0, height: 52 },
  pellets: { gap: 8, paddingHorizontal: 16, alignItems: 'center', height: 52 },
  pellet: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, backgroundColor: '#16161a' },
  pelletOn: { backgroundColor: '#2a2a34' },
  pelletT: { color: SEM.ink3, fontSize: 15, fontWeight: '700' },
  pelletTOn: { color: '#fff' },
  pelletX: { position: 'absolute', top: -6, left: -6, zIndex: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: SEM.brand, alignItems: 'center', justifyContent: 'center' },
  pelletXT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  addPellet: { paddingHorizontal: 12, paddingVertical: 9 },
  addPelletT: { color: ACCENT, fontSize: 15, fontWeight: '700' },

  ctrlbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 2, paddingBottom: 10 },
  ctrlL: { flex: 1, color: SEM.ink3, fontSize: 13, fontWeight: '700' },
  sortBtn: { backgroundColor: '#1a1a1e', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 },
  sortBtnT: { color: '#ddd', fontSize: 13, fontWeight: '700' },
  editBtn: { color: ACCENT, fontSize: 13, fontWeight: '800', paddingHorizontal: 2, paddingVertical: 6 },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: SEM.surface3, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30 },
  sheetTitle: { color: SEM.ink3, fontSize: 14, fontWeight: '700', margin: 16, marginBottom: 4 },
  sopt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: 1, borderTopColor: SEM.line2 },
  soptT: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
