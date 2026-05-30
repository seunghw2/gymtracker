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
} from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { get1RMHistory, getBodyLogs, getVolumeStats, getTrainedExercises, TrainedExercise, BodyLog, VolumeStats } from '../../db/queries';
import { useSettingsStore } from '../../store/useStore';
import OneRMChart from '../../components/OneRMChart';
import { toDisplay, unitLabel } from '../../lib/units';

type Chip = '1RM 성장' | '체중' | '체지방' | '볼륨';

const WIDTH = Dimensions.get('window').width - 40;

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

const volumeChartConfig = {
  backgroundColor: '#1C1C1E',
  backgroundGradientFrom: '#1C1C1E',
  backgroundGradientTo: '#1C1C1E',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(48, 209, 88, ${opacity})`,
  labelColor: () => '#8E8E93',
  style: { borderRadius: 12 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#30D158' },
  barPercentage: 0.7,
  formatYLabel: (y: string) => formatVolume(Number(y)),
};

export default function StatsScreen() {
  const [activeChip, setActiveChip] = useState<Chip>('1RM 성장');
  const [trainedExercises, setTrainedExercises] = useState<TrainedExercise[] | null>(null);
  const [selectedEx, setSelectedEx] = useState<TrainedExercise | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ormData, setOrmData] = useState<{ date: string; estimated_1rm: number }[]>([]);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [volume, setVolume] = useState<VolumeStats | null>(null);
  const { goalWeightKg, goalBodyFatPct, unitKg } = useSettingsStore();
  const u = unitLabel(unitKg);

  const load = useCallback(async () => {
    const logs = await getBodyLogs(30);
    setBodyLogs(logs.reverse());
  }, []);

  useEffect(() => {
    if (activeChip === '1RM 성장' && !trainedExercises) {
      getTrainedExercises()
        .then(list => {
          setTrainedExercises(list);
          if (list.length > 0) setSelectedEx(prev => prev ?? list[0]);
        })
        .catch(() => setTrainedExercises([]));
    }
    if (activeChip === '볼륨' && !volume) {
      getVolumeStats().then(setVolume).catch(() => setVolume({ daily: [], byMuscle: [] }));
    }
  }, [activeChip, trainedExercises, volume]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selectedEx) {
      get1RMHistory(selectedEx.id).then(setOrmData);
    }
  }, [selectedEx]);

  const chips: Chip[] = ['1RM 성장', '체중', '체지방', '볼륨'];

  const currentWeight = bodyLogs.length > 0 ? bodyLogs[bodyLogs.length - 1].weight_kg ?? 0 : 0;
  const goalProgress = goalWeightKg > 0
    ? Math.max(0, Math.min(1, (currentWeight - goalWeightKg) / (100 - goalWeightKg)))
    : 0;

  const bodyChartData = bodyLogs.slice(-14).filter(l => l.weight_kg);
  const hasBodyData = bodyChartData.length >= 2;
  const fatChartData = bodyLogs.slice(-14).filter(l => l.body_fat_pct != null);
  const hasFatData = fatChartData.length >= 2;
  const currentFat = fatChartData.length > 0 ? fatChartData[fatChartData.length - 1].body_fat_pct ?? 0 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>통계</Text>

        <View style={styles.chips}>
          {chips.map(c => (
            <Pressable
              key={c}
              style={[styles.chip, activeChip === c && styles.chipActive]}
              onPress={() => setActiveChip(c)}
            >
              <Text style={[styles.chipText, activeChip === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        {activeChip === '1RM 성장' && (
          <View>
            {trainedExercises && trainedExercises.length === 0 ? (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>기록된 운동이 없습니다</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>종목</Text>
                <Pressable style={styles.exSelectBtn} onPress={() => setPickerOpen(true)}>
                  <Text style={styles.exSelectText} numberOfLines={1}>
                    {selectedEx
                      ? `${selectedEx.name}${selectedEx.brand ? ` (${selectedEx.brand})` : ''}`
                      : '종목 선택'}
                  </Text>
                  <Text style={styles.exSelectChevron}>⌄</Text>
                </Pressable>

                {selectedEx ? (
                  <OneRMChart data={ormData} title={`${selectedEx.name} 추정 1RM`} unitKg={unitKg} />
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
                <FlatList
                  data={trainedExercises ?? []}
                  keyExtractor={item => String(item.id)}
                  contentContainerStyle={styles.modalContent}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.exItem, selectedEx?.id === item.id && styles.exItemActive]}
                      onPress={() => { setSelectedEx(item); setPickerOpen(false); }}
                    >
                      <View>
                        <Text style={styles.exItemName}>{item.name}</Text>
                        {item.brand && <Text style={styles.exItemBrand}>{item.brand}</Text>}
                      </View>
                      {selectedEx?.id === item.id && <Text style={styles.exItemCheck}>✓</Text>}
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.placeholderText}>기록된 운동이 없습니다</Text>
                  }
                />
              </SafeAreaView>
            </Modal>
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
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#30D158' },
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
                  : '홈에서 체지방을 입력하세요'}
              </Text>
            </View>
          </View>
        )}

        {activeChip === '볼륨' && (
          <View>
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
                <Text style={styles.sectionTitle}>일자별 총볼륨 ({u}, 최근 8회)</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
  },
  chipActive: { backgroundColor: '#30D158' },
  chipText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#000000' },

  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 10 },

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
  exSelectChevron: { color: '#30D158', fontSize: 18, marginLeft: 8 },

  modalSafe: { flex: 1, backgroundColor: '#000000' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  modalBack: { color: '#30D158', fontSize: 16, width: 60 },
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
  exItemActive: { borderColor: '#30D158', borderWidth: 1 },
  exItemName: { color: '#FFFFFF', fontSize: 16 },
  exItemBrand: { color: '#8E8E93', fontSize: 13, marginTop: 2 },
  exItemCheck: { color: '#30D158', fontSize: 18, fontWeight: '700' },

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
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  goalLabel: { color: '#8E8E93', fontSize: 14 },
  progressBar: { height: 8, backgroundColor: '#2C2C2E', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#30D158', borderRadius: 4 },
  goalValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 8, textAlign: 'center' },
});
