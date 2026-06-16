import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Dimensions,
  Modal,
  FlatList,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { get1RMHistory, getBodyLogs, getVolumeStats, getTrainedExercises, getExercises, getRecords, getMuscleFrequency, getPeriodSummary, upsertBodyLog, getExerciseRmBasis, setExerciseRmBasis, convertRm, getActualRmHistory, TrainedExercise, BodyLog, VolumeStats, ExerciseRecord, MuscleFrequency, PeriodSummary, VolumeRange } from '../../db/queries';
import { useSettingsStore, useWorkoutStore } from '../../store/useStore';
import OneRMChart from '../../components/OneRMChart';
import { toDisplay, unitLabel } from '../../lib/units';
import { MUSCLE_KO, MUSCLE_COLOR } from '../../constants/exercises';

type Chip = '부위별' | '1RM 성장' | 'PR' | '체중' | '체지방' | '볼륨';

const MUSCLE_ORDER = ['Chest', 'Back', 'Shoulder', 'Legs', 'Arms', 'Core'];
const REC_MIN = 10;   // 권장 주당 최소 세트
const REC_MAX = 20;   // 권장 주당 최대 세트
const BAR_MAX = 24;   // 막대 채움 기준 최대치

function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtMD(d: Date) { return `${d.getMonth() + 1}월 ${d.getDate()}일`; }
function fmtHM(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h}시간${m > 0 ? ` ${m}분` : ''}`;
  return `${m}분`;
}

const RANGE_LABELS: { key: VolumeRange; label: string }[] = [
  { key: 'recent', label: '최근' },
  { key: 'week', label: '1주' },
  { key: 'month', label: '1달' },
  { key: 'quarter', label: '3달' },
];

const WIDTH = Dimensions.get('window').width - 40;

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

// 이번/지난 주 (월~일), 이번/지난 달 범위 + 표시 라벨 + 환산용 주 수
function periodRange(period: 'week' | 'month', offset = 0): { from: Date; to: Date; label: string; weeks: number } {
  const now = new Date();
  if (period === 'week') {
    const mon = mondayOf(now);
    mon.setDate(mon.getDate() + offset * 7);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: mon, to: sun, label: `${fmtMD(mon)} – ${fmtMD(sun)}`, weeks: 1 };
  }
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  // 평균 환산 기준: 현재 달은 오늘까지 경과 주수, 지난 달은 전체 주수
  const endForWeeks = offset === 0 ? now : last;
  const days = Math.max(1, Math.round((endForWeeks.getTime() - first.getTime()) / 86400000) + 1);
  return { from: first, to: last, label: `${first.getMonth() + 1}월`, weeks: Math.max(1, days / 7) };
}

// 이번 주 월요일~일요일 (ISO 날짜)
function thisWeekRange(): { from: string; to: string } {
  const r = periodRange('week', 0);
  return { from: iso(r.from), to: iso(r.to) };
}

const volumeChartConfig = {
  backgroundColor: '#1C1C1E',
  backgroundGradientFrom: '#1C1C1E',
  backgroundGradientTo: '#1C1C1E',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(48, 209, 88, ${opacity})`,
  labelColor: () => '#8E8E93',
  style: { borderRadius: 12 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF3B30' },
  barPercentage: 0.7,
  formatYLabel: (y: string) => formatVolume(Number(y)),
};

export default function StatsScreen() {
  const [activeChip, setActiveChip] = useState<Chip>('부위별');
  const [summaryPeriod, setSummaryPeriod] = useState<'week' | 'month'>('week');
  const [periodCur, setPeriodCur] = useState<PeriodSummary | null>(null);
  const [periodPrev, setPeriodPrev] = useState<PeriodSummary | null>(null);
  const [trainedExercises, setTrainedExercises] = useState<TrainedExercise[] | null>(null);
  const [selectedEx, setSelectedEx] = useState<TrainedExercise | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerPart, setPickerPart] = useState<string>('ALL');
  const [exMuscle, setExMuscle] = useState<Record<number, string>>({});
  const [ormData, setOrmData] = useState<{ date: string; estimated_1rm: number }[]>([]);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [volume, setVolume] = useState<VolumeStats | null>(null);
  const [volumeRange, setVolumeRange] = useState<VolumeRange>('recent');
  const [records, setRecords] = useState<ExerciseRecord[] | null>(null);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSort, setRecordSort] = useState<'1rm' | 'name'>('1rm');
  const [muscleFreq, setMuscleFreq] = useState<MuscleFrequency[]>([]);
  const [fatInput, setFatInput] = useState('');
  const [rmBasis, setRmBasis] = useState(10);
  const [rmMode, setRmMode] = useState<'est' | 'actual'>('est');
  const [actualData, setActualData] = useState<{ date: string; estimated_1rm: number }[]>([]);
  const { goalWeightKg, goalBodyFatPct, unitKg } = useSettingsStore();
  const u = unitLabel(unitKg);

  const load = useCallback(async () => {
    const logs = await getBodyLogs(30);
    setBodyLogs(logs.reverse());
  }, []);

  const saveFat = async () => {
    const fat = parseFloat(fatInput);
    if (!Number.isFinite(fat) || fat <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const todayLog = bodyLogs.find(l => l.date === today);
    const latestWeight = bodyLogs.length > 0 ? bodyLogs[bodyLogs.length - 1].weight_kg ?? 0 : 0;
    const weight = todayLog?.weight_kg ?? latestWeight;
    try {
      await upsertBodyLog(today, weight, fat);
      setFatInput('');
      await load();
    } catch {
      /* 무시 */
    }
  };

  // 탭 포커스/새로고침 시 칩 데이터 다시 불러오기 위한 틱
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (activeChip === '1RM 성장') {
      getTrainedExercises()
        .then(list => {
          setTrainedExercises(list);
          if (list.length > 0) setSelectedEx(prev => prev ?? list[0]);
        })
        .catch(() => setTrainedExercises([]));
      // 종목별 부위(색·필터용) 매핑
      getExercises().then(all => {
        const m: Record<number, string> = {};
        for (const e of all) m[e.id] = e.muscle_group;
        setExMuscle(m);
      }).catch(() => {});
    }
    if (activeChip === '볼륨') {
      getVolumeStats(volumeRange).then(setVolume).catch(() => setVolume({ daily: [], byMuscle: [] }));
    }
    if (activeChip === '부위별') {
      const cur = periodRange(summaryPeriod, 0);
      const prev = periodRange(summaryPeriod, -1);
      getMuscleFrequency(8, { from: iso(cur.from), to: iso(cur.to) }).then(setMuscleFreq).catch(() => setMuscleFreq([]));
      getPeriodSummary(iso(cur.from), iso(cur.to)).then(setPeriodCur).catch(() => setPeriodCur(null));
      getPeriodSummary(iso(prev.from), iso(prev.to)).then(setPeriodPrev).catch(() => setPeriodPrev(null));
    }
    if (activeChip === 'PR') {
      getRecords().then(setRecords).catch(() => setRecords([]));
    }
  }, [activeChip, volumeRange, summaryPeriod, reloadTick]);

  // 탭에 들어올 때마다 새로고침 (운동 직후 통계 즉시 반영)
  useFocusEffect(useCallback(() => {
    load();
    setReloadTick(t => t + 1);
  }, [load]));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setReloadTick(t => t + 1);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    if (selectedEx) {
      get1RMHistory(selectedEx.id).then(setOrmData);
      getExerciseRmBasis(selectedEx.id).then(setRmBasis).catch(() => setRmBasis(1));
    }
  }, [selectedEx, reloadTick]);

  const changeRmBasis = (n: number) => {
    setRmBasis(n);
    if (selectedEx) setExerciseRmBasis(selectedEx.id, n).catch(() => {});
  };

  // 실제 모드: 선택 종목·반복수의 실제 최고무게 로드
  useEffect(() => {
    if (rmMode === 'actual' && selectedEx) {
      getActualRmHistory(selectedEx.id, rmBasis).then(setActualData).catch(() => setActualData([]));
    }
  }, [rmMode, rmBasis, selectedEx]);

  const RM_OPTIONS = [1, 3, 5, 8, 10, 12];

  const chips: Chip[] = ['부위별', '1RM 성장', 'PR', '체중', '체지방', '볼륨'];

  const currentWeight = bodyLogs.length > 0 ? bodyLogs[bodyLogs.length - 1].weight_kg ?? 0 : 0;
  const goalProgress = goalWeightKg > 0
    ? Math.max(0, Math.min(1, (currentWeight - goalWeightKg) / (100 - goalWeightKg)))
    : 0;

  const bodyChartData = bodyLogs.slice(-14).filter(l => l.weight_kg);
  const hasBodyData = bodyChartData.length >= 2;
  const fatChartData = bodyLogs.slice(-14).filter(l => l.body_fat_pct != null);
  const hasFatData = fatChartData.length >= 2;
  const currentFat = fatChartData.length > 0 ? fatChartData[fatChartData.length - 1].body_fat_pct ?? 0 : 0;

  const bannerActive = useWorkoutStore(s => s.activeSessionId != null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, bannerActive && styles.bannerPad]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF3B30" />}
      >
        <Text style={styles.header}>통계</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map(c => (
            <Pressable
              key={c}
              style={[styles.chip, activeChip === c && styles.chipActive]}
              onPress={() => setActiveChip(c)}
            >
              <Text style={[styles.chipText, activeChip === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeChip === '1RM 성장' && (
          <View>
            {trainedExercises && trainedExercises.length === 0 ? (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>기록된 운동이 없습니다</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>종목</Text>
                <Pressable style={styles.exSelectBtn} onPress={() => { setPickerSearch(''); setPickerPart('ALL'); setPickerOpen(true); }}>
                  <Text style={styles.exSelectText} numberOfLines={1}>
                    {selectedEx
                      ? `${selectedEx.name}${selectedEx.brand ? ` (${selectedEx.brand})` : ''}`
                      : '종목 선택'}
                  </Text>
                  <Text style={styles.exSelectChevron}>⌄</Text>
                </Pressable>

                {selectedEx ? (
                  <>
                    <View style={styles.rmModeRow}>
                      <Text style={styles.rmModeLabel}>표시 기준</Text>
                      <View style={styles.rmModeSeg}>
                        {(['est', 'actual'] as const).map(m => (
                          <Pressable
                            key={m}
                            style={[styles.rmModeCell, rmMode === m && styles.rmCellOn]}
                            onPress={() => setRmMode(m)}
                          >
                            <Text style={[styles.rmText, rmMode === m && styles.rmTextOn]}>
                              {m === 'est' ? '추정' : '실제'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={styles.rmGrid}>
                      {RM_OPTIONS.map(n => (
                        <Pressable
                          key={n}
                          style={[styles.rmGridCell, rmBasis === n && styles.rmCellOn]}
                          onPress={() => changeRmBasis(n)}
                        >
                          <Text style={[styles.rmText, rmBasis === n && styles.rmTextOn]}>{n}RM</Text>
                        </Pressable>
                      ))}
                    </View>
                    {rmMode === 'est' ? (
                      <OneRMChart
                        data={ormData.map(d => ({ ...d, estimated_1rm: convertRm(d.estimated_1rm, rmBasis) }))}
                        title={`${selectedEx.name} 추정 ${rmBasis}RM`}
                        unitKg={unitKg}
                      />
                    ) : actualData.length > 0 ? (
                      <OneRMChart data={actualData} title={`${selectedEx.name} 실제 ${rmBasis}RM`} unitKg={unitKg} />
                    ) : (
                      <View style={styles.placeholder}>
                        <Text style={styles.placeholderText}>{rmBasis}회로 실제 수행한 기록이 없습니다</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>종목을 선택하면 그래프가 표시됩니다</Text>
                  </View>
                )}
              </>
            )}

            <Modal visible={pickerOpen} animationType="slide">
              <SafeAreaView style={styles.modalSafe}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setPickerOpen(false)}>
                    <Text style={styles.modalBack}>✕ 닫기</Text>
                  </Pressable>
                  <Text style={styles.modalTitle}>종목 선택</Text>
                  <View style={{ width: 60 }} />
                </View>
                {(() => {
                  const all = trainedExercises ?? [];
                  const parts = MUSCLE_ORDER.filter(p => all.some(e => exMuscle[e.id] === p));
                  const q = pickerSearch.trim().toLowerCase();
                  const list = all.filter(e =>
                    (pickerPart === 'ALL' || exMuscle[e.id] === pickerPart) &&
                    (!q || e.name.toLowerCase().includes(q))
                  );
                  return (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partRow}>
                        <Pressable style={[styles.partChip, pickerPart === 'ALL' && styles.partChipOn]} onPress={() => setPickerPart('ALL')}>
                          <Text style={[styles.partChipText, pickerPart === 'ALL' && styles.partChipTextOn]}>전체</Text>
                        </Pressable>
                        {parts.map(p => (
                          <Pressable key={p} style={[styles.partChip, pickerPart === p && styles.partChipOn]} onPress={() => setPickerPart(p)}>
                            <View style={[styles.partDot, { backgroundColor: MUSCLE_COLOR[p] }]} />
                            <Text style={[styles.partChipText, pickerPart === p && styles.partChipTextOn]}>{MUSCLE_KO[p] ?? p}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                        <TextInput
                          style={styles.recordSearch}
                          placeholder="종목 검색"
                          placeholderTextColor="#48484A"
                          value={pickerSearch}
                          onChangeText={setPickerSearch}
                          clearButtonMode="while-editing"
                        />
                      </View>
                      <FlatList
                        data={list}
                        keyExtractor={item => String(item.id)}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.modalContent}
                        renderItem={({ item }) => (
                          <Pressable
                            style={styles.exRow}
                            onPress={() => { setSelectedEx(item); setPickerOpen(false); }}
                          >
                            <View style={[styles.partDot, { backgroundColor: MUSCLE_COLOR[exMuscle[item.id]] ?? '#8E8E93' }]} />
                            <Text style={styles.exRowName} numberOfLines={1}>{item.name}</Text>
                            {item.brand && <Text style={styles.exRowBrand} numberOfLines={1}> · {item.brand}</Text>}
                            {selectedEx?.id === item.id && <Text style={styles.exItemCheck}>✓</Text>}
                          </Pressable>
                        )}
                        ListEmptyComponent={<Text style={[styles.placeholderText, { textAlign: 'center', marginTop: 24 }]}>종목이 없습니다</Text>}
                      />
                    </>
                  );
                })()}
              </SafeAreaView>
            </Modal>
          </View>
        )}

        {activeChip === 'PR' && (
          <View>
            {records && records.length > 0 && (
              <>
                <TextInput
                  style={styles.recordSearch}
                  placeholder="종목 검색"
                  placeholderTextColor="#48484A"
                  value={recordSearch}
                  onChangeText={setRecordSearch}
                  clearButtonMode="while-editing"
                />
                <View style={styles.recordSortRow}>
                  {([['1rm', '최고 1RM순'], ['name', '이름순']] as const).map(([key, label]) => (
                    <Pressable key={key} style={[styles.recordSortBtn, recordSort === key && styles.recordSortOn]} onPress={() => setRecordSort(key)}>
                      <Text style={[styles.recordSortText, recordSort === key && styles.recordSortTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {!records ? (
              <View style={styles.placeholder}><Text style={styles.placeholderText}>불러오는 중…</Text></View>
            ) : records.length === 0 ? (
              <View style={styles.placeholder}><Text style={styles.placeholderText}>기록이 없습니다</Text></View>
            ) : (
              records
                .filter(r => r.name.toLowerCase().includes(recordSearch.trim().toLowerCase()))
                .sort((a, b) => recordSort === 'name'
                  ? a.name.localeCompare(b.name)
                  : (b.best_1rm ?? 0) - (a.best_1rm ?? 0))
                .map(r => (
                <View key={r.exercise_id} style={styles.recordCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordName}>{r.name}</Text>
                    {r.brand && <Text style={styles.recordBrand}>{r.brand}</Text>}
                  </View>
                  <View style={styles.recordStats}>
                    <Text style={styles.recordStat}>🏆 1RM {r.best_1rm ? `${toDisplay(r.best_1rm, unitKg)}${u}` : '-'}</Text>
                    <Text style={styles.recordSub}>
                      최고중량 {r.max_weight ? `${toDisplay(r.max_weight, unitKg)}${u}` : '-'} · 최고볼륨 {r.best_session_volume ? `${Math.round(toDisplay(r.best_session_volume, unitKg)).toLocaleString()}${u}` : '-'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeChip === '체중' && (
          <View>
            {hasBodyData ? (
              <LineChart
                data={{
                  labels: bodyChartData.map(l => l.date.slice(5)),
                  datasets: [{ data: bodyChartData.map(l => l.weight_kg ?? 0) }],
                }}
                width={WIDTH}
                height={220}
                yAxisSuffix="kg"
                chartConfig={{
                  backgroundColor: '#1C1C1E',
                  backgroundGradientFrom: '#1C1C1E',
                  backgroundGradientTo: '#1C1C1E',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(48, 209, 88, ${opacity})`,
                  labelColor: () => '#8E8E93',
                  style: { borderRadius: 12 },
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF3B30' },
                }}
                bezier
                style={{ borderRadius: 12, marginBottom: 16 }}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>체중 기록이 부족합니다 (최소 2개)</Text>
              </View>
            )}

            {/* 목표 진도 */}
            <View style={styles.goalCard}>
              <View style={styles.goalRow}>
                <Text style={styles.goalLabel}>현재 {currentWeight > 0 ? `${currentWeight.toFixed(1)}kg` : '미입력'}</Text>
                <Text style={styles.goalLabel}>목표 {goalWeightKg}kg</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(1 - goalProgress) * 100}%` }]} />
              </View>
              <Text style={styles.goalValue}>
                {currentWeight > 0
                  ? currentWeight > goalWeightKg
                    ? `${(currentWeight - goalWeightKg).toFixed(1)} kg 남음`
                    : '목표 달성!'
                  : '체중 미입력'}
              </Text>
            </View>
          </View>
        )}

        {activeChip === '체지방' && (
          <View>
            <View style={styles.fatEntryRow}>
              <Text style={styles.fatEntryLabel}>오늘 체지방률</Text>
              <TextInput
                style={styles.fatEntryInput}
                value={fatInput}
                onChangeText={t => setFatInput(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder={currentFat > 0 ? String(currentFat) : '예: 15'}
                placeholderTextColor="#48484A"
                selectTextOnFocus
              />
              <Text style={styles.fatEntryUnit}>%</Text>
              <Pressable style={[styles.fatEntrySave, !fatInput && { opacity: 0.4 }]} onPress={saveFat} disabled={!fatInput}>
                <Text style={styles.fatEntrySaveText}>저장</Text>
              </Pressable>
            </View>
            {hasFatData ? (
              <LineChart
                data={{
                  labels: fatChartData.map(l => l.date.slice(5)),
                  datasets: [{ data: fatChartData.map(l => l.body_fat_pct ?? 0) }],
                }}
                width={WIDTH}
                height={220}
                yAxisSuffix="%"
                chartConfig={{
                  backgroundColor: '#1C1C1E',
                  backgroundGradientFrom: '#1C1C1E',
                  backgroundGradientTo: '#1C1C1E',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 159, 10, ${opacity})`,
                  labelColor: () => '#8E8E93',
                  style: { borderRadius: 12 },
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF9F0A' },
                }}
                bezier
                style={{ borderRadius: 12, marginBottom: 16 }}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>체지방 기록이 부족합니다 (최소 2개)</Text>
              </View>
            )}
            <View style={styles.goalCard}>
              <View style={styles.goalRow}>
                <Text style={styles.goalLabel}>현재 {currentFat > 0 ? `${currentFat.toFixed(1)}%` : '미입력'}</Text>
                <Text style={styles.goalLabel}>목표 {goalBodyFatPct}%</Text>
              </View>
              <Text style={styles.goalValue}>
                {currentFat > 0
                  ? currentFat > goalBodyFatPct
                    ? `${(currentFat - goalBodyFatPct).toFixed(1)}% 남음`
                    : '목표 달성!'
                  : '위에서 체지방을 입력하세요'}
              </Text>
            </View>
          </View>
        )}

        {activeChip === '볼륨' && (
          <View>
            <View style={styles.rangeRow}>
              {RANGE_LABELS.map(r => (
                <Pressable
                  key={r.key}
                  style={[styles.rangeBtn, volumeRange === r.key && styles.rangeBtnActive]}
                  onPress={() => { setVolumeRange(r.key); setVolume(null); }}
                >
                  <Text style={[styles.rangeText, volumeRange === r.key && styles.rangeTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            {!volume ? (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>불러오는 중…</Text>
              </View>
            ) : volume.daily.length === 0 ? (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>볼륨 기록이 없습니다</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>일자별 총볼륨 ({u})</Text>
                <BarChart
                  data={{
                    labels: volume.daily.slice(-8).map(d => d.date.slice(5)),
                    datasets: [{ data: volume.daily.slice(-8).map(d => Math.round(toDisplay(d.volume, unitKg))) }],
                  }}
                  width={WIDTH}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  fromZero
                  chartConfig={volumeChartConfig}
                  style={{ borderRadius: 12, marginBottom: 24 }}
                  showValuesOnTopOfBars
                />

                {volume.byMuscle.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>부위별 볼륨 ({u})</Text>
                    <BarChart
                      data={{
                        labels: volume.byMuscle.map(m => m.muscleGroup),
                        datasets: [{ data: volume.byMuscle.map(m => Math.round(toDisplay(m.volume, unitKg))) }],
                      }}
                      width={WIDTH}
                      height={220}
                      yAxisLabel=""
                      yAxisSuffix=""
                      fromZero
                      chartConfig={volumeChartConfig}
                      style={{ borderRadius: 12 }}
                      showValuesOnTopOfBars
                    />
                  </>
                )}

              </>
            )}
          </View>
        )}

        {activeChip === '부위별' && (() => {
          const cur = periodRange(summaryPeriod, 0);
          const byMuscle: Record<string, number> = {};
          for (const m of muscleFreq) byMuscle[m.muscle_group] = m.set_count;
          const perWeek = (raw: number) => summaryPeriod === 'month' ? Math.round(raw / cur.weeks) : raw;
          const totalSets = periodCur?.set_count ?? 0;
          const dSets = totalSets - (periodPrev?.set_count ?? 0);
          const dDur = (periodCur?.total_duration_sec ?? 0) - (periodPrev?.total_duration_sec ?? 0);
          const dCnt = (periodCur?.session_count ?? 0) - (periodPrev?.session_count ?? 0);
          const delta = (n: number, fmt?: (x: number) => string) =>
            n === 0 ? null : (
              <Text style={[styles.deltaText, { color: n > 0 ? '#30D158' : '#FF453A' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {n > 0 ? '▲' : '▼'} {fmt ? fmt(Math.abs(n)) : Math.abs(n)}
              </Text>
            );
          return (
            <View>
              <Text style={styles.rangeLabel}>{cur.label}</Text>
              <View style={styles.segment}>
                {(['week', 'month'] as const).map(p => (
                  <Pressable key={p} style={[styles.segmentBtn, summaryPeriod === p && styles.segmentBtnOn]} onPress={() => setSummaryPeriod(p)}>
                    <Text style={[styles.segmentText, summaryPeriod === p && styles.segmentTextOn]}>{p === 'week' ? '이번주' : '이번달'}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHead}>
                  <View>
                    <Text style={styles.summaryTitle}>부위별 세트</Text>
                    <Text style={styles.summarySub}>{summaryPeriod === 'week' ? '이번 주에 부위별로 수행한 총 세트 수' : '이번 달 주당 평균 세트 수'}</Text>
                  </View>
                  <View style={styles.summaryBadge}><Text style={styles.summaryBadgeText}>{summaryPeriod === 'week' ? '주간 합계' : '주당 평균'}</Text></View>
                </View>

                {MUSCLE_ORDER.map(g => {
                  const val = perWeek(byMuscle[g] ?? 0);
                  const low = val < REC_MIN;
                  const fill = Math.max(0.04, Math.min(1, val / BAR_MAX));
                  return (
                    <View key={g} style={styles.barRow}>
                      <Text style={styles.barLabel}>{MUSCLE_KO[g] ?? g}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: low ? '#FF9F0A' : '#30D158' }]} />
                        <View style={[styles.barMarker, { left: `${(REC_MIN / BAR_MAX) * 100}%` }]} />
                        <View style={[styles.barMarker, { left: `${(REC_MAX / BAR_MAX) * 100}%` }]} />
                      </View>
                      <Text style={styles.barValue}>{val}</Text>
                    </View>
                  );
                })}
                <Text style={styles.recHint}>⌷ 권장 범위 (주당 {REC_MIN}–{REC_MAX}세트)</Text>
              </View>

              <View style={styles.statCardsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statCardLabel}>총 세트</Text>
                  <Text style={styles.statCardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{totalSets}</Text>
                  {delta(dSets)}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statCardLabel}>운동 시간</Text>
                  <Text style={styles.statCardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{fmtHM(periodCur?.total_duration_sec ?? 0)}</Text>
                  {delta(dDur, fmtHM)}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statCardLabel}>운동 횟수</Text>
                  <Text style={styles.statCardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{periodCur?.session_count ?? 0}<Text style={styles.statCardUnit}>회</Text></Text>
                  {delta(dCnt, n => `${n}`)}
                </View>
              </View>
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  bannerPad: { paddingBottom: 100 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },

  chipsScroll: { marginHorizontal: -20, marginBottom: 20 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
  },
  chipActive: { backgroundColor: '#FF3B30' },
  chipText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#000000' },

  rangeLabel: { color: '#8E8E93', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  segment: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4, marginBottom: 16 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: '#2C2C2E' },
  segmentText: { color: '#8E8E93', fontSize: 15, fontWeight: '700' },
  segmentTextOn: { color: '#FFFFFF' },

  summaryCard: { backgroundColor: '#161616', borderRadius: 20, borderLeftWidth: 3, borderLeftColor: '#FF3B30', padding: 20, marginBottom: 16 },
  summaryCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  summaryTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  summarySub: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  summaryBadge: { backgroundColor: '#173A26', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  summaryBadgeText: { color: '#FF3B30', fontSize: 13, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 7 },
  barLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', width: 44 },
  barTrack: { flex: 1, height: 22, backgroundColor: '#2C2C2E', borderRadius: 11, marginHorizontal: 12, overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 11 },
  barMarker: { position: 'absolute', top: 3, bottom: 3, width: 0, borderLeftWidth: 1, borderColor: '#6E6E73', borderStyle: 'dashed' },
  barValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  recHint: { color: '#6E6E73', fontSize: 13, marginTop: 14 },

  statCardsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16 },
  statCardLabel: { color: '#8E8E93', fontSize: 13, marginBottom: 8 },
  statCardValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  statCardUnit: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
  deltaText: { fontSize: 13, fontWeight: '700', marginTop: 6 },

  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 10 },

  rmModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 },
  rmModeLabel: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  rmModeSeg: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4 },
  rmModeCell: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  rmGrid: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4, marginBottom: 22 },
  rmGridCell: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  rmCellOn: { backgroundColor: '#FF3B30' },
  rmText: { color: '#8E8E93', fontSize: 14, fontWeight: '700' },
  rmTextOn: { color: '#000000' },
  exSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  exSelectText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
  exSelectChevron: { color: '#FF3B30', fontSize: 18, marginLeft: 8 },

  modalSafe: { flex: 1, backgroundColor: '#000000' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  modalBack: { color: '#FF3B30', fontSize: 16, width: 60 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  modalContent: { padding: 16 },
  exItem: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exItemActive: { borderColor: '#FF3B30', borderWidth: 1 },
  exItemName: { color: '#FFFFFF', fontSize: 16 },
  exItemBrand: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  exItemCheck: { color: '#FF3B30', fontSize: 18, fontWeight: '700', marginLeft: 6 },

  // 시안 C — 부위 필터 + 평면 리스트
  partRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  partChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C1C1E', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  partChipOn: { backgroundColor: '#FF3B30' },
  partChipText: { color: '#8E8E93', fontSize: 14, fontWeight: '700' },
  partChipTextOn: { color: '#000000' },
  partDot: { width: 8, height: 8, borderRadius: 4 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
  exRowName: { color: '#FFFFFF', fontSize: 16 },
  exRowBrand: { color: '#8E8E93', fontSize: 13, flexShrink: 1 },

  placeholder: {
    height: 200,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderText: { color: '#48484A', fontSize: 14 },

  goalCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
  },
  fatEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, marginBottom: 16 },
  fatEntryLabel: { color: '#8E8E93', fontSize: 14, flex: 1 },
  fatEntryInput: { backgroundColor: '#2C2C2E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFFFFF', fontSize: 16, minWidth: 70, textAlign: 'center' },
  fatEntryUnit: { color: '#8E8E93', fontSize: 15 },
  fatEntrySave: { backgroundColor: '#FF9F0A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  fatEntrySaveText: { color: '#000000', fontSize: 15, fontWeight: '700' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  goalLabel: { color: '#8E8E93', fontSize: 14 },
  progressBar: { height: 8, backgroundColor: '#2C2C2E', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FF3B30', borderRadius: 4 },
  goalValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  recordName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  recordBrand: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  recordStats: { alignItems: 'flex-end' },
  recordStat: { color: '#FF3B30', fontSize: 15, fontWeight: '700' },
  recordSub: { color: '#8E8E93', fontSize: 11, marginTop: 3, textAlign: 'right' },
  recordSearch: { backgroundColor: '#1C1C1E', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFFFFF', fontSize: 15, marginBottom: 10 },
  recordSortRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  recordSortBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#1C1C1E' },
  recordSortOn: { backgroundColor: '#FF3B30' },
  recordSortText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  recordSortTextOn: { color: '#000000' },

  rangeRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1C1C1E', alignItems: 'center' },
  rangeBtnActive: { backgroundColor: '#FF3B30' },
  rangeText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  rangeTextActive: { color: '#000000' },

  freqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
  },
  freqMuscle: { color: '#FFFFFF', fontSize: 15 },
  freqValue: { color: '#FF3B30', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
