import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getExercises, get1RMHistory, getBodyLogs, Exercise, BodyLog } from '../../db/queries';
import { useSettingsStore } from '../../store/useStore';
import OneRMChart from '../../components/OneRMChart';

type Chip = '1RM 성장' | '체중' | '볼륨';

const WIDTH = Dimensions.get('window').width - 40;

export default function StatsScreen() {
  const [activeChip, setActiveChip] = useState<Chip>('1RM 성장');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedEx, setSelectedEx] = useState<Exercise | null>(null);
  const [ormData, setOrmData] = useState<{ date: string; estimated_1rm: number }[]>([]);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const { goalWeightKg } = useSettingsStore();

  const load = useCallback(async () => {
    const exList = await getExercises();
    setExercises(exList);
    const logs = await getBodyLogs(30);
    setBodyLogs(logs.reverse());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selectedEx) {
      get1RMHistory(selectedEx.id).then(setOrmData);
    }
  }, [selectedEx]);

  const chips: Chip[] = ['1RM 성장', '체중', '볼륨'];

  const currentWeight = bodyLogs.length > 0 ? bodyLogs[bodyLogs.length - 1].weight_kg ?? 0 : 0;
  const goalProgress = goalWeightKg > 0
    ? Math.max(0, Math.min(1, (currentWeight - goalWeightKg) / (100 - goalWeightKg)))
    : 0;

  const bodyChartData = bodyLogs.slice(-14).filter(l => l.weight_kg);
  const hasBodyData = bodyChartData.length >= 2;

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
            <Text style={styles.sectionTitle}>종목 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exScroll}>
              {exercises.map(ex => (
                <Pressable
                  key={ex.id}
                  style={[styles.exChip, selectedEx?.id === ex.id && styles.exChipActive]}
                  onPress={() => setSelectedEx(ex)}
                >
                  <Text style={[styles.exChipText, selectedEx?.id === ex.id && styles.exChipTextActive]}>
                    {ex.name}{ex.brand ? ` (${ex.brand})` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {selectedEx && (
              <OneRMChart
                data={ormData}
                title={`${selectedEx.name} 추정 1RM`}
              />
            )}
            {!selectedEx && (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>종목을 선택하면 그래프가 표시됩니다</Text>
              </View>
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
                <Text style={styles.goalLabel}>현재</Text>
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

        {activeChip === '볼륨' && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>볼륨 통계 준비 중</Text>
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

  exScroll: { marginBottom: 16 },
  exChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    marginRight: 8,
  },
  exChipActive: { backgroundColor: '#1A3D27', borderColor: '#30D158', borderWidth: 1 },
  exChipText: { color: '#8E8E93', fontSize: 13 },
  exChipTextActive: { color: '#30D158' },

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
