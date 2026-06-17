import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, SafeAreaView, Alert, Modal, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExercises, getExerciseUsage, addCustomExercise, updateExercise, deleteCustomExercise, Exercise } from '../db/queries';
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, MUSCLE_KO, EQUIP_KO, MUSCLE_COLOR, PART_ORDER } from '../constants/exercises';
import { GREEN, COLORS } from '../constants/colors';
import { useWorkoutStore } from '../store/useStore';
import { buildExerciseEntry } from '../lib/exerciseEntry';

const FAVORITE_BRANDS_KEY = '@gymtracker/favorite_brands';

function Dot({ group }: { group: string }) {
  return <View style={[styles.dot, { backgroundColor: MUSCLE_COLOR[group] ?? '#8E8E93' }]} />;
}

export default function ExerciseAddScreen() {
  const router = useRouter();
  const addExercises = useWorkoutStore(s => s.addExercises);

  const [all, setAll] = useState<Exercise[]>([]);
  const [usage, setUsage] = useState<Record<number, { count: number; last: string | null }>>({});
  const [search, setSearch] = useState('');
  const [part, setPart] = useState<string>('ALL');
  const [equip, setEquip] = useState<string>('ALL');
  const [brand, setBrand] = useState<string>('ALL');
  const [pickedList, setPickedList] = useState<Exercise[]>([]);
  const [mode, setMode] = useState<'browse' | 'custom'>('browse');

  // 사용자가 직접 추가한 브랜드(기기 저장) + 브랜드 칩 정렬 모드
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  const [brandSort, setBrandSort] = useState<'asc' | 'desc' | 'recent' | 'frequent'>('asc');
  const [showBrandAdd, setShowBrandAdd] = useState(false);
  const [brandAddInput, setBrandAddInput] = useState('');
  // 브랜드 선택 바텀시트 + 즐겨찾기
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [brandPanelTop, setBrandPanelTop] = useState(0);
  const brandPanelRef = useRef<View>(null);
  const { height: winH } = useWindowDimensions();
  // 브랜드 목록 높이를 화면에 맞게 제한 — 하단 완료 바(절대 위치) 뒤로 "+ 새 브랜드 추가"가
  // 가려지지 않도록 패널의 실제 화면 위치(measureInWindow)에서 검색칸·하단바·여백을 뺀 만큼만 사용.
  // (검색칸 ~52 + 하단바 ~110 + 여백)
  // 검색칸 ~52 + 하단바 ~110 + '새 브랜드 추가' 고정행 ~48 + 여백
  const brandListMaxH = brandPanelTop > 0
    ? Math.max(140, winH - brandPanelTop - 52 - 110 - 48 - 12)
    : 280;
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>([]);

  // 직접 등록 폼
  const [cName, setCName] = useState('');
  const [cPart, setCPart] = useState<string | null>(null);
  const [cEquip, setCEquip] = useState<string | null>(null);
  const [cBrand, setCBrand] = useState('');
  const [cTime, setCTime] = useState(false);

  // 종목 편집 시트
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [eName, setEName] = useState('');
  const [ePart, setEPart] = useState<string | null>(null);
  const [eEquip, setEEquip] = useState<string | null>(null);
  const [eBrand, setEBrand] = useState('');
  const [eTime, setETime] = useState(false);
  const pickedIds = useMemo(() => new Set(pickedList.map(e => e.id)), [pickedList]);

  useEffect(() => {
    getExercises().then(setAll).catch(() => {});
    getExerciseUsage().then(list => {
      const m: Record<number, { count: number; last: string | null }> = {};
      for (const r of list) m[r.exercise_id] = { count: r.count, last: r.last_date };
      setUsage(m);
    }).catch(() => {});
    AsyncStorage.getItem('custom_brands').then(v => { if (v) setCustomBrands(JSON.parse(v)); }).catch(() => {});
    AsyncStorage.getItem('brand_sort').then(v => { if (v === 'asc' || v === 'desc' || v === 'recent' || v === 'frequent') setBrandSort(v); }).catch(() => {});
    AsyncStorage.getItem(FAVORITE_BRANDS_KEY).then(v => { if (v) setFavoriteBrands(JSON.parse(v)); }).catch(() => {});
  }, []);

  const toggleFavoriteBrand = (b: string) => {
    Haptics.selectionAsync();
    setFavoriteBrands(prev => {
      const next = prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b];
      AsyncStorage.setItem(FAVORITE_BRANDS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // 선택 장비에 실제 존재하는 브랜드들 (머신/케이블에서만)
  const brandsForEquip = useMemo(() => {
    if (equip !== 'Machine' && equip !== 'Cable') return [];
    const set = new Set<string>();
    for (const e of all) if (e.equipment_type === equip && e.brand) set.add(e.brand);
    return Array.from(set);
  }, [all, equip]);

  // 브랜드별 최신 사용일 (최근순 정렬용)
  const brandRecency = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of all) {
      if (!e.brand) continue;
      const last = usage[e.id]?.last;
      if (last && (!m[e.brand] || last > m[e.brand])) m[e.brand] = last;
    }
    return m;
  }, [all, usage]);

  // 브랜드별 누적 사용횟수 (자주순 정렬용)
  const brandFreq = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of all) {
      if (!e.brand) continue;
      m[e.brand] = (m[e.brand] ?? 0) + (usage[e.id]?.count ?? 0);
    }
    return m;
  }, [all, usage]);

  // 화면에 노출할 브랜드 칩 = 종목추출 ∪ 직접추가, 정렬 적용 (머신/케이블에서만)
  const brandChips = useMemo(() => {
    if (equip !== 'Machine' && equip !== 'Cable') return [];
    const arr = Array.from(new Set<string>([...brandsForEquip, ...customBrands]));
    if (brandSort === 'recent') {
      arr.sort((a, b) => (brandRecency[b] ?? '').localeCompare(brandRecency[a] ?? '') || a.localeCompare(b));
    } else if (brandSort === 'frequent') {
      arr.sort((a, b) => (brandFreq[b] ?? 0) - (brandFreq[a] ?? 0) || a.localeCompare(b));
    } else {
      arr.sort((a, b) => a.localeCompare(b));
      if (brandSort === 'desc') arr.reverse();
    }
    return arr;
  }, [equip, brandsForEquip, customBrands, brandSort, brandRecency, brandFreq]);

  const cycleBrandSort = () => {
    const order = ['asc', 'desc', 'recent', 'frequent'] as const;
    const next = order[(order.indexOf(brandSort) + 1) % order.length];
    setBrandSort(next);
    AsyncStorage.setItem('brand_sort', next).catch(() => {});
  };

  const addBrand = () => {
    const b = brandAddInput.trim();
    if (!b) return;
    if (!customBrands.includes(b) && !brandsForEquip.includes(b)) {
      const next = [...customBrands, b];
      setCustomBrands(next);
      AsyncStorage.setItem('custom_brands', JSON.stringify(next)).catch(() => {});
    }
    setBrand(b);
    setBrandAddInput('');
    setShowBrandAdd(false);
  };

  const SORT_LABEL: Record<typeof brandSort, string> = { asc: '이름 ↑', desc: '이름 ↓', recent: '최근순', frequent: '자주순' };

  const q = search.trim().toLowerCase();
  const filtersActive = q !== '' || part !== 'ALL' || equip !== 'ALL' || brand !== 'ALL';

  const matches = (e: Exercise) =>
    (part === 'ALL' || e.muscle_group === part) &&
    (equip === 'ALL' || e.equipment_type === equip) &&
    (brand === 'ALL' || e.brand === brand) &&
    (!q || e.name.toLowerCase().includes(q) || (e.brand ?? '').toLowerCase().includes(q));

  const filtered = all.filter(matches);

  // 최근·자주 (사용 빈도순 상위 5)
  const frequent = useMemo(() =>
    all.filter(e => (usage[e.id]?.count ?? 0) > 0)
      .sort((a, b) => (usage[b.id]?.count ?? 0) - (usage[a.id]?.count ?? 0) || (usage[b.id]?.last ?? '').localeCompare(usage[a.id]?.last ?? ''))
      .slice(0, 5),
    [all, usage]);

  const pickedCount = pickedList.length;
  const toggle = (e: Exercise) => {
    Haptics.selectionAsync();
    setPickedList(prev => prev.some(x => x.id === e.id) ? prev.filter(x => x.id !== e.id) : [...prev, e]);
  };

  const onEquip = (eq: string) => { setEquip(prev => prev === eq ? 'ALL' : eq); setBrand('ALL'); };

  const handleDone = async () => {
    if (pickedList.length === 0) return;
    // 담은 순서대로 (처음 담은 종목이 세션 맨 위)
    const entries = await Promise.all(pickedList.map(buildExerciseEntry));
    addExercises(entries);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  // ── 종목 편집/삭제 ──
  const openEdit = (e: Exercise) => {
    Haptics.selectionAsync();
    setEditing(e);
    setEName(e.name);
    setEPart(e.muscle_group);
    setEEquip(e.equipment_type);
    setEBrand(e.brand ?? '');
    setETime(e.tracking_type === 'TIME');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const isCustom = editing.is_custom === 1;
    if (!eName.trim()) return;
    try {
      if (isCustom) {
        await updateExercise(editing.id, {
          name: eName.trim(), muscle_group: ePart ?? undefined, equipment_type: eEquip ?? undefined,
          brand: eBrand.trim() || null, tracking_type: eTime ? 'TIME' : 'REPS',
        });
      } else {
        // 기본 종목: 이름 + 측정 방식만 변경(분류는 공유 데이터라 불가)
        await updateExercise(editing.id, { name: eName.trim(), tracking_type: eTime ? 'TIME' : 'REPS' });
      }
      const list = await getExercises();
      setAll(list);
      setPickedList(prev => prev.map(x => list.find(n => n.id === x.id) ?? x));
      setEditing(null);
    } catch { Alert.alert('수정 실패', '다시 시도해 주세요.'); }
  };

  const deleteEdit = () => {
    if (!editing) return;
    const target = editing;
    Alert.alert('종목 삭제', `'${target.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        try {
          await deleteCustomExercise(target.id);
          setAll(prev => prev.filter(e => e.id !== target.id));
          setPickedList(prev => prev.filter(e => e.id !== target.id));
          setEditing(null);
        } catch { Alert.alert('삭제 실패', '다시 시도해 주세요.'); }
      } },
    ]);
  };

  const saveCustom = async () => {
    if (!cName.trim() || !cPart || !cEquip) return;
    const id = await addCustomExercise(cName.trim(), cPart, cEquip, cBrand.trim() || undefined, cTime ? 'TIME' : 'REPS');
    const list = await getExercises().catch(() => all);
    setAll(list);
    const created = list.find(e => e.id === id);
    if (created) setPickedList(prev => [...prev, created]);
    setCName(''); setCBrand(''); setCPart(null); setCEquip(null); setCTime(false);
    setMode('browse');
  };

  // 직접 등록 진입 — 현재 필터(부위/장비/브랜드)·검색어를 폼에 미리 채움
  const openCustom = () => {
    if (part !== 'ALL') setCPart(part);
    if (equip !== 'ALL') setCEquip(equip);
    if (brand !== 'ALL') setCBrand(brand);
    if (q) setCName(search.trim());
    setMode('custom');
  };

  const Row = ({ e }: { e: Exercise }) => {
    const on = pickedIds.has(e.id);
    const sub = [EQUIP_KO[e.equipment_type] ?? e.equipment_type, e.brand].filter(Boolean).join(' · ');
    return (
      <Pressable style={styles.row} onPress={() => toggle(e)} onLongPress={() => openEdit(e)} delayLongPress={300} accessibilityRole="button" accessibilityLabel={`${e.name} 담기`}>
        <Dot group={e.muscle_group} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.rowName} numberOfLines={1}>{e.name}</Text>
          {!!sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
        </View>
        <View style={[styles.plus, on && styles.plusOn]}>
          <Text style={[styles.plusText, on && styles.plusTextOn]}>{on ? '✓' : '+'}</Text>
        </View>
      </Pressable>
    );
  };

  // ── 직접 등록 모드 ──
  if (mode === 'custom') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => setMode('browse')} hitSlop={8}><Text style={styles.back}>← 뒤로</Text></Pressable>
          <Text style={styles.title}>직접 등록</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>운동 이름</Text>
          <TextInput style={styles.input} placeholder="예: 케이블 크런치" placeholderTextColor="#48484A" value={cName} onChangeText={setCName} />
          <Text style={styles.label}>부위</Text>
          <View style={styles.wrap}>
            {MUSCLE_GROUPS.map(m => (
              <Pressable key={m} style={[styles.choice, cPart === m && styles.choiceOn]} onPress={() => setCPart(m)}>
                <Text style={[styles.choiceText, cPart === m && styles.choiceTextOn]}>{MUSCLE_KO[m] ?? m}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>장비</Text>
          <View style={styles.wrap}>
            {EQUIPMENT_TYPES.map(eq => (
              <Pressable key={eq} style={[styles.choice, cEquip === eq && styles.choiceOn]} onPress={() => setCEquip(eq)}>
                <Text style={[styles.choiceText, cEquip === eq && styles.choiceTextOn]}>{EQUIP_KO[eq] ?? eq}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>브랜드 (선택)</Text>
          <TextInput style={styles.input} placeholder="예: Hammer Strength" placeholderTextColor="#48484A" value={cBrand} onChangeText={setCBrand} />
          <Text style={styles.label}>측정 방식</Text>
          <View style={styles.wrap}>
            {([['reps', '횟수·무게'], ['time', '시간(초)']] as const).map(([k, lbl]) => {
              const on = (k === 'time') === cTime;
              return (
                <Pressable key={k} style={[styles.choice, on && styles.choiceOn]} onPress={() => setCTime(k === 'time')}>
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{lbl}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={[styles.saveBtn, (!cName.trim() || !cPart || !cEquip) && { opacity: 0.4 }]} onPress={saveCustom} disabled={!cName.trim() || !cPart || !cEquip}>
            <Text style={styles.saveBtnText}>저장하고 담기</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>← 뒤로</Text></Pressable>
        <Text style={styles.title}>운동 추가</Text>
        <View style={{ width: 56 }} />
      </View>

      {/* 검색 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <TextInput style={styles.input} placeholder="종목 검색" placeholderTextColor="#48484A" value={search} onChangeText={setSearch} clearButtonMode="while-editing" />
      </View>

      {/* 부위 필터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        <Pressable style={[styles.chip, part === 'ALL' && styles.chipOn]} onPress={() => setPart('ALL')}>
          <Text style={[styles.chipText, part === 'ALL' && styles.chipTextOn]}>전체</Text>
        </Pressable>
        {PART_ORDER.map(p => (
          <Pressable key={p} style={[styles.chip, part === p && styles.chipOn]} onPress={() => setPart(prev => prev === p ? 'ALL' : p)}>
            <View style={[styles.dot, { backgroundColor: MUSCLE_COLOR[p] }]} />
            <Text style={[styles.chipText, part === p && styles.chipTextOn]}>{MUSCLE_KO[p] ?? p}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 장비 필터 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
        <Pressable style={[styles.chip, equip === 'ALL' && styles.chipOn]} onPress={() => { setEquip('ALL'); setBrand('ALL'); }}>
          <Text style={[styles.chipText, equip === 'ALL' && styles.chipTextOn]}>장비 전체</Text>
        </Pressable>
        {EQUIPMENT_TYPES.map(eq => (
          <Pressable key={eq} style={[styles.chip, equip === eq && styles.chipOn]} onPress={() => onEquip(eq)}>
            <Text style={[styles.chipText, equip === eq && styles.chipTextOn]}>{EQUIP_KO[eq] ?? eq}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 브랜드 필터 (머신/케이블일 때만) — 정렬 버튼 + 인라인 아코디언 드롭다운 */}
      {(equip === 'Machine' || equip === 'Cable') && brandChips.length > 0 && (
        <View>
          <View style={styles.brandBar}>
            <Pressable style={styles.sortChip} onPress={cycleBrandSort}>
              <Text style={styles.sortChipText}>{SORT_LABEL[brandSort]}</Text>
            </Pressable>
            <Pressable style={styles.brandDropdown} onPress={() => { setBrandSearch(''); setBrandOpen(o => !o); }}>
              <Text style={[styles.brandDropdownText, brand !== 'ALL' && styles.brandDropdownTextOn]} numberOfLines={1}>
                브랜드 {brand === 'ALL' ? '전체' : brand}
              </Text>
              <Text style={[styles.caretDown, brand !== 'ALL' && styles.brandDropdownTextOn]}>{brandOpen ? '▴' : '▾'}</Text>
            </Pressable>
          </View>

          <Modal visible={brandOpen} transparent animationType="slide" onRequestClose={() => setBrandOpen(false)}>
            <Pressable style={styles.brandBackdrop} onPress={() => setBrandOpen(false)} />
            <View style={styles.brandSheet}>
              <View style={styles.brandGrab} />
              <Text style={styles.brandSheetTitle}>브랜드 선택</Text>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                placeholder="브랜드 검색"
                placeholderTextColor="#48484A"
                value={brandSearch}
                onChangeText={setBrandSearch}
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
              <ScrollView style={{ maxHeight: winH * 0.42 }} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
                {/* 고정: 브랜드 전체 (검색과 무관하게 항상 맨 위) */}
                <Pressable style={styles.brandRow} onPress={() => { setBrand('ALL'); setBrandOpen(false); }}>
                  <View style={styles.starBtn} />
                  <Text style={styles.brandRowText}>브랜드 전체</Text>
                  {brand === 'ALL' && <Text style={styles.brandCheck}>✓</Text>}
                </Pressable>

                {(() => {
                  const bq = brandSearch.trim().toLowerCase();
                  const matchB = (b: string) => !bq || b.toLowerCase().includes(bq);
                  const favs = brandChips.filter(b => favoriteBrands.includes(b) && matchB(b));
                  const others = brandChips.filter(b => !favoriteBrands.includes(b) && matchB(b));
                  const renderRow = (b: string) => {
                    const fav = favoriteBrands.includes(b);
                    return (
                      <Pressable key={b} style={styles.brandRow} onPress={() => { setBrand(b); setBrandOpen(false); }}>
                        <Pressable style={styles.starBtn} hitSlop={8} onPress={() => toggleFavoriteBrand(b)}>
                          <Text style={[styles.star, fav && styles.starOn]}>{fav ? '★' : '☆'}</Text>
                        </Pressable>
                        <Text style={styles.brandRowText} numberOfLines={1}>{b}</Text>
                        {brand === b && <Text style={styles.brandCheck}>✓</Text>}
                      </Pressable>
                    );
                  };
                  return (
                    <>
                      {favs.length > 0 && (
                        <>
                          <Text style={styles.brandSectionHeader}>★ 즐겨찾는 머신</Text>
                          {favs.map(renderRow)}
                        </>
                      )}
                      <Text style={styles.brandSectionHeader}>전체 머신</Text>
                      {others.length > 0
                        ? others.map(renderRow)
                        : <Text style={styles.brandEmpty}>검색 결과가 없어요</Text>}
                    </>
                  );
                })()}
              </ScrollView>

              {/* 목록과 무관하게 항상 보이는 고정 푸터 — 끝까지 스크롤 안 해도 보임 */}
              <Pressable
                style={styles.brandAddRow}
                onPress={() => { setBrandOpen(false); setBrandAddInput(''); setTimeout(() => setShowBrandAdd(true), 220); }}
              >
                <Text style={styles.brandAddRowText}>+ 새 브랜드 추가</Text>
              </Pressable>
            </View>
          </Modal>
        </View>
      )}

      {/* 리스트 */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }} keyboardShouldPersistTaps="handled">
        {filtersActive ? (
          filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{q ? `'${search.trim()}' 검색 결과가 없어요` : '해당 조건의 종목이 없어요'}</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {filtered.map((e, i) => (
                <View key={e.id}>{i > 0 && <View style={styles.hair} />}<Row e={e} /></View>
              ))}
            </View>
          )
        ) : (
          <>
            {frequent.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <Text style={styles.sectionTitle}>최근 · 자주</Text>
                <View style={styles.card}>
                  {frequent.map((e, i) => (
                    <View key={e.id}>{i > 0 && <View style={styles.hair} />}<Row e={e} /></View>
                  ))}
                </View>
              </View>
            )}
            {PART_ORDER.map(p => {
              const items = all.filter(e => e.muscle_group === p);
              if (items.length === 0) return null;
              return (
                <View key={p} style={{ marginBottom: 18 }}>
                  <View style={styles.sectionHead}>
                    <Dot group={p} />
                    <Text style={styles.sectionTitle}>{MUSCLE_KO[p] ?? p}</Text>
                  </View>
                  <View style={styles.card}>
                    {items.map((e, i) => (
                      <View key={e.id}>{i > 0 && <View style={styles.hair} />}<Row e={e} /></View>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
        <Pressable style={styles.outlineBtn} onPress={() => openCustom()}><Text style={styles.outlineBtnText}>+ 직접 등록</Text></Pressable>
      </ScrollView>

      {/* 하단 완료 바 */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.doneBtn, pickedCount === 0 && styles.doneBtnOff]}
          onPress={handleDone}
          disabled={pickedCount === 0}
        >
          <Text style={[styles.doneText, pickedCount === 0 && styles.doneTextOff]}>
            {pickedCount > 0 ? `${pickedCount}개 담기 · 완료` : '운동을 담아주세요'}
          </Text>
        </Pressable>
      </View>

      {/* 종목 편집 시트 (길게 누르기) */}
      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setEditing(null)} />
        <View style={styles.sheet}>
          {editing && (() => {
            const isCustom = editing.is_custom === 1;
            return (
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.sheetGrip} />
                <Text style={styles.sheetTitle}>종목 수정</Text>
                {!isCustom && <Text style={styles.sheetHint}>기본 종목은 이름과 측정 방식만 바꿀 수 있어요.</Text>}

                <Text style={styles.label}>운동 이름</Text>
                <TextInput style={styles.input} placeholderTextColor="#48484A" value={eName} onChangeText={setEName} />

                {isCustom && (
                  <>
                    <Text style={styles.label}>부위</Text>
                    <View style={styles.wrap}>
                      {MUSCLE_GROUPS.map(m => (
                        <Pressable key={m} style={[styles.choice, ePart === m && styles.choiceOn]} onPress={() => setEPart(m)}>
                          <Text style={[styles.choiceText, ePart === m && styles.choiceTextOn]}>{MUSCLE_KO[m] ?? m}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>장비</Text>
                    <View style={styles.wrap}>
                      {EQUIPMENT_TYPES.map(eq => (
                        <Pressable key={eq} style={[styles.choice, eEquip === eq && styles.choiceOn]} onPress={() => setEEquip(eq)}>
                          <Text style={[styles.choiceText, eEquip === eq && styles.choiceTextOn]}>{EQUIP_KO[eq] ?? eq}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>브랜드 (선택)</Text>
                    <TextInput style={styles.input} placeholder="없음" placeholderTextColor="#48484A" value={eBrand} onChangeText={setEBrand} />
                  </>
                )}

                <Text style={styles.label}>측정 방식</Text>
                <View style={styles.wrap}>
                  {([['reps', '횟수·무게'], ['time', '시간(초)']] as const).map(([k, lbl]) => {
                    const on = (k === 'time') === eTime;
                    return (
                      <Pressable key={k} style={[styles.choice, on && styles.choiceOn]} onPress={() => setETime(k === 'time')}>
                        <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{lbl}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable style={[styles.saveBtn, !eName.trim() && { opacity: 0.4 }]} onPress={saveEdit} disabled={!eName.trim()}>
                  <Text style={styles.saveBtnText}>저장</Text>
                </Pressable>
                {isCustom && (
                  <Pressable style={styles.deleteBtn} onPress={deleteEdit}>
                    <Text style={styles.deleteBtnText}>삭제</Text>
                  </Pressable>
                )}
                <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)}>
                  <Text style={styles.cancelBtnText}>취소</Text>
                </Pressable>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* 브랜드 추가 모달 */}
      <Modal visible={showBrandAdd} transparent animationType="fade" onRequestClose={() => setShowBrandAdd(false)}>
        <KeyboardAvoidingView style={styles.centerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBrandAdd(false)} />
          <View style={styles.brandAddBox}>
            <Text style={styles.sheetTitle}>브랜드 추가</Text>
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="예: Technogym, Matrix"
              placeholderTextColor="#48484A"
              value={brandAddInput}
              onChangeText={setBrandAddInput}
              autoFocus
              onSubmitEditing={addBrand}
              returnKeyType="done"
            />
            <Pressable style={[styles.saveBtn, !brandAddInput.trim() && { opacity: 0.4 }]} onPress={addBrand} disabled={!brandAddInput.trim()}>
              <Text style={styles.saveBtnText}>추가</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
  back: { color: GREEN, fontSize: 16, fontWeight: '600', width: 56 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  input: { backgroundColor: '#1C1C1E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#FFFFFF', fontSize: 15 },

  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C1C1E', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36 },
  chipOn: { backgroundColor: GREEN },
  chipText: { color: '#8E8E93', fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: '#06210F' },
  sortChip: { backgroundColor: '#2C2C2E', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  sortChipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  addBrandChip: { borderWidth: 1, borderColor: GREEN, backgroundColor: 'transparent' },

  // 브랜드 드롭다운 줄
  brandBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  brandDropdown: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1C1C1E', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36 },
  brandDropdownText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  brandDropdownTextOn: { color: GREEN },
  caretDown: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginLeft: 8 },

  // 브랜드 선택 인라인 패널
  brandPanel: { backgroundColor: '#161618', borderRadius: 14, marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  brandBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  brandSheet: { backgroundColor: '#161618', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  brandGrab: { width: 36, height: 4, borderRadius: 3, backgroundColor: '#33333a', alignSelf: 'center', marginVertical: 6 },
  brandSheetTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 6 },
  brandRowText: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: '600' },
  brandCheck: { color: GREEN, fontSize: 16, fontWeight: '800', marginLeft: 10 },
  starBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  star: { color: '#48484A', fontSize: 20 },
  starOn: { color: COLORS.gold },
  brandSectionHeader: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  brandEmpty: { color: '#48484A', fontSize: 14, paddingVertical: 12 },
  brandAddRow: { marginTop: 16, borderWidth: 1, borderColor: GREEN, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  brandAddRowText: { color: GREEN, fontSize: 15, fontWeight: '700' },
  centerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  brandAddBox: { backgroundColor: '#161618', borderRadius: 16, padding: 20, alignSelf: 'stretch' },
  dot: { width: 9, height: 9, borderRadius: 5 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: '#161618', borderRadius: 14, overflow: 'hidden' },
  hair: { height: 1, backgroundColor: '#26262A', marginLeft: 16 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14, paddingVertical: 8 },
  rowName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  plus: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#3A3A3C', alignItems: 'center', justifyContent: 'center' },
  plusOn: { backgroundColor: GREEN, borderColor: GREEN },
  plusText: { color: '#8E8E93', fontSize: 20, fontWeight: '700', marginTop: -2 },
  plusTextOn: { color: '#06210F' },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  emptyText: { color: '#8E8E93', fontSize: 15 },
  outlineBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  outlineBtnText: { color: GREEN, fontSize: 15, fontWeight: '700' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: 'rgba(0,0,0,0.9)', borderTopWidth: 1, borderTopColor: '#1C1C1E' },
  doneBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  doneBtnOff: { backgroundColor: '#1C1C1E' },
  doneText: { color: '#06210F', fontSize: 17, fontWeight: '800' },
  doneTextOff: { color: '#8E8E93' },

  label: { color: '#8E8E93', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  choiceOn: { backgroundColor: GREEN },
  choiceText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  choiceTextOn: { color: '#06210F' },
  saveBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#06210F', fontSize: 16, fontWeight: '800' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#161618', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 28, maxHeight: '85%' },
  sheetGrip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', marginTop: 10, marginBottom: 12 },
  sheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sheetHint: { color: '#8E8E93', fontSize: 13, marginBottom: 4 },
  deleteBtn: { borderWidth: 1, borderColor: '#FF453A', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  deleteBtnText: { color: '#FF453A', fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
});
