import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SEM, ACCENT_TINT } from '../../constants/colors';
import { MUSCLE_KO, MUSCLE_COLOR } from '../../constants/exercises';
import {
  getExerciseSummaries, getExercises, getSetting, setSetting, ExerciseSummary, Exercise,
  listGroups, createGroup, updateGroup, deleteGroup, reorderGroups, getTrainedExerciseIds, ExerciseGroup,
} from '../../db/queries';
import { loadPinned, savePinned, togglePin, isPin } from '../../lib/pinnedLifts';
import { bucketExercises, SortKey, SORTS } from '../../lib/exerciseSections';
import { buildPellets, groupRows, systemRows, Pellet, SystemKind, addMembers, moveMember } from '../../lib/exerciseGroups';
import { readCache, writeCache } from '../../lib/diskCache';
import { toDateStr } from '../../lib/date';

const KO_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(MUSCLE_KO).map(([en, ko]) => [ko, MUSCLE_COLOR[en] ?? SEM.ink3]),
);
const partColor = (ko: string | null) => (ko && KO_COLOR[ko]) || SEM.ink3;
// 추가 버튼(그룹·종목) = 액션 → 레드 액센트(이 화면 파랑 info 제거).
const INFO = SEM.brand;

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
  const [brandById, setBrandById] = useState<Map<number, string | null>>(new Map());
  const [thisWeekIds, setThisWeekIds] = useState<Set<number>>(new Set());
  const [lastWeekIds, setLastWeekIds] = useState<Set<number>>(new Set());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('1rm');
  const [showSort, setShowSort] = useState(false);
  const [q, setQ] = useState('');
  const [selKey, setSelKey] = useState<string>('sys:all');   // 'sys:all'|'sys:thisWeek'|'sys:lastWeek'|'custom:<id>'
  const [edit, setEdit] = useState(false);
  const [menuGroup, setMenuGroup] = useState<ExerciseGroup | null>(null);
  const [defaultIds, setDefaultIds] = useState<number[]>([]);   // '기본' 그룹 멤버(설정 저장)

  const saveDefaultIds = (ids: number[]) => {
    setDefaultIds(ids);
    setSetting('default_group_ids', ids.join(',')).catch(() => {});
  };

  const lastLoadRef = useRef(0);
  const FOCUS_TTL_MS = 30_000;   // 탭 포커스마다 재요청 방지(이 시간 내 재진입은 캐시 유지)
  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - lastLoadRef.current < FOCUS_TTL_MS) return;
    lastLoadRef.current = Date.now();
    try {
      const [list, pins, gs] = await Promise.all([getExerciseSummaries(), loadPinned(), listGroups().catch(() => [] as ExerciseGroup[])]);
      setRows(list); setPinned(pins); setGroups(gs);
      writeCache('exercise:summaries', list);
      writeCache('exercise:groups', gs);
      getExercises().then(ex => setBrandById(new Map(ex.map(e => [e.id, e.brand])))).catch(() => {});
      getSetting('default_group_ids', '').then(csv =>
        setDefaultIds(csv ? csv.split(',').map(Number).filter(n => Number.isFinite(n)) : [])).catch(() => {});
      const { thisFrom, thisTo, lastFrom, lastTo } = weekRanges();
      getTrainedExerciseIds(thisFrom, thisTo).then(ids => setThisWeekIds(new Set(ids))).catch(() => {});
      getTrainedExerciseIds(lastFrom, lastTo).then(ids => setLastWeekIds(new Set(ids))).catch(() => {});
    } catch { lastLoadRef.current = 0; /* 실패 시 throttle 해제해 다음 진입에 재시도 */ }
  }, []);

  useEffect(() => {
    readCache<ExerciseSummary[]>('exercise:summaries').then(c => { if (c?.length) setRows(prev => prev.length ? prev : c); });
    readCache<ExerciseGroup[]>('exercise:groups').then(c => { if (c?.length) setGroups(prev => prev.length ? prev : c); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(true); setRefreshing(false); }, [load]);

  const toggleFav = (name: string) => {
    const next = togglePin(name, pinned);
    setPinned(next);
    savePinned(next).catch(() => {});
  };
  const goReport = (r: ExerciseSummary) =>
    router.push({ pathname: '/exercise/[name]', params: { name: r.name, id: String(r.exerciseId) } });

  const pellets = useMemo(() => buildPellets(groups), [groups]);
  const sel: Pellet = useMemo(() => {
    const found = pellets.find(p => (p.kind === 'system' ? `sys:${p.key}` : `custom:${p.id}`) === selKey);
    return found ?? pellets[0];
  }, [pellets, selKey]);

  const byId = useMemo(() => new Map(rows.map(r => [r.exerciseId, r])), [rows]);
  const filterSearch = (list: ExerciseSummary[]) => {
    const f = q.trim().toLowerCase();
    return f ? list.filter(r => r.name.toLowerCase().includes(f)) : list;
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
  // 커스텀 그룹 멤버 드래그 정렬
  const reorderMembers = (g: ExerciseGroup, from: number, to: number) => {
    const ids = moveMember(g.exerciseIds, from, to);
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, exerciseIds: ids } : x));
    updateGroup(g.id, { exerciseIds: ids }).catch(() => {});
  };
  const removeMemberFromGroup = (g: ExerciseGroup, exId: number) => {
    const ids = g.exerciseIds.filter(id => id !== exId);
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, exerciseIds: ids } : x));
    updateGroup(g.id, { exerciseIds: ids }).catch(() => {});
  };

  const sortLabel = SORTS.find(([k]) => k === sort)![1];
  const customGroups = useMemo(() => [...groups].sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id), [groups]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headTop}>
        <Text style={s.title}>종목</Text>
        {edit && <Pressable onPress={() => setEdit(false)} hitSlop={10}><Text style={s.doneT}>완료</Text></Pressable>}
      </View>

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

      <View style={s.flex1}>
      {sel?.kind === 'custom'
        ? <CustomGroupView
            group={groups.find(g => g.id === sel.id)!}
            rows={groupRows(groups.find(g => g.id === sel.id)?.exerciseIds ?? [], byId)}
            search={filterSearch}
            brandById={brandById}
            onReorder={(from, to) => reorderMembers(groups.find(g => g.id === sel.id)!, from, to)}
            onRemove={(exId) => removeMemberFromGroup(groups.find(g => g.id === sel.id)!, exId)}
            onAdd={() => router.push({ pathname: '/exercise-add', params: { target: 'group', groupId: String(sel.id) } })}
            onRow={goReport}
            refreshing={refreshing} onRefresh={onRefresh} />
        : (sel as { key: SystemKind }).key === 'all'
        ? <CustomGroupView
            group={{ id: -1, name: '기본', exerciseIds: defaultIds, sortIndex: -1 } as ExerciseGroup}
            rows={groupRows(defaultIds, byId)}
            search={filterSearch} brandById={brandById}
            onReorder={(from, to) => saveDefaultIds(moveMember(defaultIds, from, to))}
            onRemove={(exId) => saveDefaultIds(defaultIds.filter(id => id !== exId))}
            onAdd={() => router.push({ pathname: '/exercise-add', params: { target: 'default' } })}
            onRow={goReport} refreshing={refreshing} onRefresh={onRefresh} />
        : <SystemGroupView
            kind={(sel as { key: SystemKind }).key}
            rows={filterSearch(systemRows((sel as { key: SystemKind }).key, rows, (sel as { key: SystemKind }).key === 'thisWeek' ? thisWeekIds : lastWeekIds))}
            pinned={pinned} sort={sort} sortLabel={sortLabel}
            onSort={() => setShowSort(true)} toggleFav={toggleFav} goReport={goReport}
            refreshing={refreshing} onRefresh={onRefresh} />}
      </View>

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

function SystemGroupView({ kind, rows, pinned, sort, sortLabel, onSort, toggleFav, goReport, refreshing, onRefresh }: {
  kind: SystemKind; rows: ExerciseSummary[]; pinned: Set<string>; sort: SortKey; sortLabel: string;
  onSort: () => void; toggleFav: (n: string) => void; goReport: (r: ExerciseSummary) => void; refreshing: boolean; onRefresh: () => void;
}) {
  const b = bucketExercises(rows, name => isPin(name, pinned), sort);
  const [staleOpen, setStaleOpen] = useState(false);
  return (
    <ScrollView style={s.flex1} contentContainerStyle={s.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SEM.brand} />}>
      {rows.length === 0 && <View style={s.empty}><Text style={s.emptyT}>{kind === 'all' ? '운동을 기록하면 종목별 추이가 여기 모여요.' : '이 기간에 한 운동이 없어요.'}</Text></View>}
      {b.pinned.length > 0 && <Section title="★ 보유">{b.pinned.map(r => <ExRow key={r.exerciseId} r={r} fav onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}</Section>}
      {b.highlight.length > 0 && <Section title="▲ 주목 · 신기록" tint={SEM.good}>{b.highlight.map(r => <ExRow key={r.exerciseId} r={r} fav={isPin(r.name, pinned)} onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}</Section>}
      {b.watch.length > 0 && (
        <Section title="관심 종목" right={<Pressable onPress={onSort} hitSlop={8}><Text style={s.sortT}>{sortLabel} ⌄</Text></Pressable>}>
          {b.watch.map(r => <ExRow key={r.exerciseId} r={r} fav={false} onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}
        </Section>
      )}
      {b.stale.length > 0 && (
        <>
          <Pressable style={s.staleHead} onPress={() => setStaleOpen(o => !o)}>
            <Text style={s.staleL}>💤 한동안 멈춤</Text>
            <Text style={s.staleC}>{b.stale.length}개 · {staleOpen ? '접기 ⌃' : '펼치기 ⌄'}</Text>
          </Pressable>
          {staleOpen && b.stale.map(r => <ExRow key={r.exerciseId} r={r} fav={false} onStar={() => toggleFav(r.name)} onReport={() => goReport(r)} />)}
        </>
      )}
    </ScrollView>
  );
}

function CustomGroupView({ group, rows, search, brandById, onReorder, onRemove, onAdd, onRow, refreshing, onRefresh }: {
  group: ExerciseGroup; rows: ExerciseSummary[]; search: (l: ExerciseSummary[]) => ExerciseSummary[];
  brandById: Map<number, string | null>; onReorder: (from: number, to: number) => void; onRemove: (exId: number) => void;
  onAdd: () => void; onRow: (r: ExerciseSummary) => void; refreshing: boolean; onRefresh: () => void;
}) {
  const data = search(rows);
  const header = <View style={s.sech}><Text style={s.sechT}>{group.name} · 담은 순서</Text></View>;
  const addBtn = (
    <Pressable style={s.addRow} onPress={onAdd}>
      <View style={s.addPlus}><Text style={{ color: INFO, fontSize: 18, fontWeight: '700' }}>＋</Text></View>
      <Text style={s.addRowT}>종목 추가하기</Text>
    </Pressable>
  );
  // 빈 그룹 — DraggableFlatList는 데이터 없으면 header/footer를 안 그려서, 일반 뷰로 항상 표시
  if (data.length === 0) {
    return (
      <ScrollView style={s.flex1} contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SEM.brand} />}>
        {header}
        <View style={s.empty}><Text style={s.emptyT}>이 그룹에 담긴 종목이 없어요</Text></View>
        {addBtn}
      </ScrollView>
    );
  }
  const renderItem = ({ item, drag, isActive }: RenderItemParams<ExerciseSummary>) => (
    <Pressable style={[s.row, isActive && { backgroundColor: '#111' }]} onPress={() => onRow(item)}>
      <Pressable onPressIn={drag} hitSlop={8}><Text style={s.handle}>≡</Text></Pressable>
      <View style={[s.partDot, { backgroundColor: partColor(item.bodyPart) }]} />
      <View style={s.nameWrap}>
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>
        <Text style={s.part}>{[item.bodyPart, brandById.get(item.exerciseId)].filter(Boolean).join(' · ')}</Text>
      </View>
      <TrendVal r={item} />
      <Pressable onPress={() => onRemove(item.exerciseId)} hitSlop={8}><Text style={s.memDel}>✕</Text></Pressable>
    </Pressable>
  );
  return (
    <DraggableFlatList
      data={data}
      keyExtractor={r => String(r.exerciseId)}
      onDragEnd={({ from, to }) => onReorder(from, to)}
      activationDistance={12}
      style={s.flex1}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SEM.brand} />}
      ListHeaderComponent={header}
      ListFooterComponent={addBtn}
      renderItem={renderItem}
    />
  );
}

function Section({ title, tint, right, children }: { title: string; tint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <View style={s.sech}><Text style={[s.sechT, tint ? { color: tint } : null]}>{title}</Text>{right ?? null}</View>
      {children}
    </>
  );
}

function TrendVal({ r }: { r: ExerciseSummary }) {
  const up = r.trend === 'new' || r.trend === 'up';
  return (
    <View style={s.valWrap}>
      <Text style={[s.trendDot, up ? { color: SEM.good } : { color: SEM.ink3 }]}>{up ? '▲' : '·'}</Text>
      <Text style={s.val}>{r.currentE1rm != null ? r.currentE1rm : '–'}</Text>
    </View>
  );
}

function ExRow({ r, fav, onStar, onReport }: { r: ExerciseSummary; fav: boolean; onStar: () => void; onReport: () => void }) {
  const up = r.trend === 'new' || r.trend === 'up';
  const renderRight = () => (
    <View style={s.swipeWrap}>
      <Pressable style={[s.swipeBtn, { backgroundColor: '#3a3a1a' }]} onPress={onStar}><Text style={[s.swipeT, { color: '#FFD60A' }]}>★</Text></Pressable>
      <Pressable style={[s.swipeBtn, { backgroundColor: SEM.brand }]} onPress={onReport}><Text style={[s.swipeT, { color: '#fff' }]}>리포트</Text></Pressable>
    </View>
  );
  return (
    <Swipeable renderRightActions={renderRight} overshootRight={false}>
      <Pressable style={s.row} onPress={onReport}>
        <Pressable onPress={onStar} hitSlop={8} style={s.starHit}><Text style={[s.rowStar, { color: fav ? '#FFD60A' : '#3a3a3e' }]}>{fav ? '★' : '☆'}</Text></Pressable>
        <View style={[s.partDot, { backgroundColor: partColor(r.bodyPart) }]} />
        <View style={s.nameWrap}>
          <Text style={s.name} numberOfLines={1}>{r.name}</Text>
          {!!r.bodyPart && <Text style={s.part}>{r.bodyPart}</Text>}
        </View>
        <Spark data={r.spark} up={up} />
        <TrendVal r={r} />
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
  flex1: { flex: 1 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 6 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  doneT: { color: SEM.brand, fontSize: 16, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 16, marginVertical: 6, backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, padding: 0 },

  pelletBar: { flexGrow: 0, flexShrink: 0, height: 52 },
  pellets: { gap: 8, paddingHorizontal: 16, alignItems: 'center', height: 52 },
  pellet: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 11, backgroundColor: '#16161a' },
  pelletOn: { backgroundColor: '#2a2a34' },
  pelletT: { color: SEM.ink3, fontSize: 15, fontWeight: '700' },
  pelletTOn: { color: '#fff' },
  pelletX: { position: 'absolute', top: -6, left: -6, zIndex: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: SEM.brand, alignItems: 'center', justifyContent: 'center' },
  pelletXT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  addPellet: { paddingHorizontal: 12, paddingVertical: 9 },
  addPelletT: { color: INFO, fontSize: 15, fontWeight: '700' },

  body: { paddingBottom: 28 },
  sech: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6 },
  sechT: { color: SEM.ink3, fontSize: 13, fontWeight: '700', flex: 1 },
  sortT: { color: SEM.brand, fontSize: 13, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 22, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#161616', backgroundColor: '#000' },
  handle: { color: '#4a4a4e', fontSize: 17 },
  starHit: { paddingRight: 1 },
  rowStar: { fontSize: 15, width: 15, textAlign: 'center' },
  partDot: { width: 9, height: 9, borderRadius: 5 },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  part: { color: SEM.ink4, fontSize: 12, marginTop: 2 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22, width: 48 },
  valWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, minWidth: 64 },
  trendDot: { fontSize: 12, fontWeight: '800' },
  val: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  memDel: { color: SEM.ink3, fontSize: 15, paddingLeft: 4 },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 18 },
  addPlus: { width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENT_TINT, alignItems: 'center', justifyContent: 'center' },
  addRowT: { color: INFO, fontSize: 16, fontWeight: '700' },

  staleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: SEM.surface2, borderRadius: 13 },
  staleL: { color: SEM.ink3, fontSize: 14, fontWeight: '700' },
  staleC: { color: SEM.ink4, fontSize: 12 },

  swipeWrap: { flexDirection: 'row' },
  swipeBtn: { width: 72, justifyContent: 'center', alignItems: 'center' },
  swipeT: { fontSize: 14, fontWeight: '800' },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: SEM.surface3, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 30 },
  sheetTitle: { color: SEM.ink3, fontSize: 14, fontWeight: '700', margin: 16, marginBottom: 4 },
  sopt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: 1, borderTopColor: SEM.line2 },
  soptT: { color: '#fff', fontSize: 16, fontWeight: '600' },
  soptCk: { color: SEM.brand, fontSize: 16, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyT: { color: '#8a8a8e', fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
});
