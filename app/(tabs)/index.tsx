import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  SafeAreaView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  getTodayBodyLog,
  getLatestBodyLog,
  getBodyLogs,
  upsertBodyLog,
  getWeeklyWorkoutCount,
  getAllWorkoutDates,
  getSetting,
  BodyLog,
} from '../../db/queries';
import { useSettingsStore, useWorkoutStore } from '../../store/useStore';
import RulerPicker from '../../components/RulerPicker';
import HeaderTimerButton from '../../components/HeaderTimerButton';
import AiBriefingCard from '../../components/AiBriefingCard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEIGHT_PROMPT_KEY = 'weight_prompt_dismissed';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().slice(0, 10),
    end: sun.toISOString().slice(0, 10),
    monday: new Date(mon),
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { goalWeightKg, goalBodyFatPct } = useSettingsStore();
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [todayWeight, setTodayWeight] = useState<number | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [dialValue, setDialValue] = useState(70);
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [todayBodyFat, setTodayBodyFat] = useState<number | null>(null);
  const [weekDots, setWeekDots] = useState<boolean[]>(Array(7).fill(false));
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [baselineWeight, setBaselineWeight] = useState<number | null>(null);

  const load = useCallback(async () => {
    const today = getTodayStr();
    const { start, end, monday } = getWeekRange();

    let count: number, todayLog: BodyLog | null, latestLog: BodyLog | null, allDates: string[], logs: BodyLog[];
    try {
      [count, todayLog, latestLog, allDates, logs] = await Promise.all([
        getWeeklyWorkoutCount(start, end),
        getTodayBodyLog(today),
        getLatestBodyLog(),
        getAllWorkoutDates(),
        getBodyLogs(90).catch(() => [] as BodyLog[]),
      ]);
    } catch {
      setLoaded(true);
      return;
    }

    // 진행바 기준점: 최근 기록 중 가장 오래된 체중 (감량/증량 실제 진행률 계산용)
    const oldest = logs.length > 0 ? logs[logs.length - 1] : null;
    setBaselineWeight(oldest?.weight_kg ?? null);

    setWeekCount(count);
    const ym = today.slice(0, 7);
    setMonthCount(allDates.filter(d => d.startsWith(ym)).length);

    if (todayLog?.weight_kg) {
      setTodayWeight(todayLog.weight_kg);
      setTodayBodyFat(todayLog.body_fat_pct ?? null);
    } else {
      // 설정에서 자동 팝업을 껐거나, 오늘 이미 "나중에"로 닫았으면 안 띄움
      const enabled = await getSetting('weight_prompt_enabled', '1').catch(() => '1');
      const dismissed = await AsyncStorage.getItem(WEIGHT_PROMPT_KEY).catch(() => null);
      if (enabled !== '0' && dismissed !== today) setShowWeightModal(true);
      setDialValue(latestLog?.weight_kg ?? 70);
      setBodyFatInput(latestLog?.body_fat_pct ? String(latestLog.body_fat_pct) : '');
    }

    const dots = Array(7).fill(false);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      dots[i] = allDates.includes(ds);
    }
    setWeekDots(dots);
    setLoaded(true);
  }, []);

  // 탭에 들어올 때마다 새로고침 (운동 완료 후 돌아와도 최신 상태 유지)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openWeightModal = () => {
    setDialValue(todayWeight ?? dialValue);
    setBodyFatInput(todayBodyFat != null ? String(todayBodyFat) : bodyFatInput);
    setShowWeightModal(true);
  };

  // 저장 버튼으로 명시 저장 (체지방도 함께 입력 가능)
  const handleSaveWeight = async () => {
    const fat = parseFloat(bodyFatInput);
    const fatValue = Number.isFinite(fat) && fat > 0 ? fat : todayBodyFat ?? undefined;
    try {
      await upsertBodyLog(getTodayStr(), dialValue, fatValue);
    } catch {
      // 저장 실패 무시
    }
    setTodayWeight(dialValue);
    if (fatValue != null) setTodayBodyFat(fatValue);
    AsyncStorage.setItem(WEIGHT_PROMPT_KEY, getTodayStr()).catch(() => {});
    setShowWeightModal(false);
  };

  // 바깥 화면 탭으로 닫기 (오늘은 자동 팝업 재등장 방지)
  const closeWeightModal = () => {
    AsyncStorage.setItem(WEIGHT_PROMPT_KEY, getTodayStr()).catch(() => {});
    setShowWeightModal(false);
  };

  const currentWeight = todayWeight ?? dialValue;
  const goalDiff = currentWeight - goalWeightKg; // +면 감량 목표, -면 증량 목표
  const goalReached = Math.abs(goalDiff) < 0.1;
  // 진행률: 시작 체중(최근 기록 중 가장 오래된 것) → 목표 체중 사이에서 실제 진행도.
  // 기준점이 없거나 목표와 같으면 기존 근접도(10kg 이내 채움) 방식으로 폴백.
  const goalFraction = (() => {
    if (goalReached) return 1;
    if (baselineWeight != null && Math.abs(baselineWeight - goalWeightKg) > 0.5) {
      return Math.max(0, Math.min(1, (baselineWeight - currentWeight) / (baselineWeight - goalWeightKg)));
    }
    return Math.max(0, Math.min(1, 1 - Math.abs(goalDiff) / 10));
  })();

  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const bannerActive = useWorkoutStore(s => s.activeSessionId != null);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#30D158" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, bannerActive && styles.bannerPad]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#30D158" />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={[styles.header, { marginBottom: 0 }]}>GymTracker</Text>
          <HeaderTimerButton />
        </View>

        {/* 이번주 통계 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{monthCount}</Text>
            <Text style={styles.statLabel}>이번달 운동</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{weekCount}</Text>
            <Text style={styles.statLabel}>이번주 운동</Text>
          </View>
        </View>

        {/* AI 주간 브리핑 진입 */}
        <AiBriefingCard />

        {/* 목표 체중 카드 (탭하여 기록) */}
        <Pressable style={styles.goalCard} onPress={openWeightModal}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>목표 체중</Text>
            <Text style={styles.goalTarget}>{goalWeightKg} kg</Text>
          </View>
          <View style={styles.goalRow}>
            <Text style={styles.currentWeight}>
              현재: {todayWeight ? `${todayWeight.toFixed(1)} kg` : '미입력'}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${goalFraction * 100}%` }]} />
          </View>
          <Text style={styles.progressHint}>
            {!todayWeight
              ? '체중을 입력하세요'
              : goalReached
                ? '목표 달성! 🎉'
                : `목표까지 ${Math.abs(goalDiff).toFixed(1)} kg ${goalDiff > 0 ? '감량' : '증량'}`}
          </Text>
          {todayBodyFat != null && (
            <Text style={styles.fatHint}>
              체지방 {todayBodyFat.toFixed(1)}% · 목표 {goalBodyFatPct}%
            </Text>
          )}
          <Text style={styles.tapHint}>탭하여 체중·체지방 기록</Text>
        </Pressable>

        {/* 이번주 스트릭 도트 */}
        <View style={styles.weekCard}>
          <Text style={styles.weekTitle}>이번주</Text>
          <View style={styles.dotsRow}>
            {days.map((d, i) => (
              <View key={i} style={styles.dotItem}>
                <View style={[styles.dot, weekDots[i] && styles.dotActive]} />
                <Text style={styles.dotLabel}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 운동 시작 버튼 */}
        <Pressable
          style={styles.startBtn}
          onPress={() => router.push('/(tabs)/workout')}
        >
          <Text style={styles.startBtnText}>운동 시작</Text>
        </Pressable>
      </ScrollView>

      {/* 체중 입력 모달 — 눈금자 + 자동 저장, 바깥 탭하면 닫힘 */}
      <Modal visible={showWeightModal} transparent animationType="slide" onRequestClose={closeWeightModal}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalOverlay} onPress={closeWeightModal}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>오늘의 체중</Text>
              <Text style={styles.weightReadout}>{dialValue.toFixed(1)}<Text style={styles.weightUnit}>kg</Text></Text>
              <RulerPicker
                initial={dialValue}
                onChange={v => setDialValue(v)}
              />
              <View style={styles.fatRow}>
                <Text style={styles.fatLabel}>체지방</Text>
                <TextInput
                  style={styles.fatInput}
                  value={bodyFatInput}
                  onChangeText={setBodyFatInput}
                  placeholder="선택"
                  placeholderTextColor="#48484A"
                  keyboardType="decimal-pad"
                  maxLength={4}
                />
                <Text style={styles.fatUnit}>%</Text>
              </View>
              <Pressable style={styles.saveBtn} onPress={handleSaveWeight}>
                <Text style={styles.saveBtnText}>저장</Text>
              </Pressable>
            </View>
          </Pressable>
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  bannerPad: { paddingBottom: 100 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statValue: { color: '#30D158', fontSize: 36, fontWeight: '700' },
  statLabel: { color: '#8E8E93', fontSize: 13, marginTop: 4 },

  goalCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  goalTarget: { color: '#30D158', fontSize: 17, fontWeight: '600' },
  goalRow: { marginTop: 8 },
  currentWeight: { color: '#8E8E93', fontSize: 14 },
  progressBar: {
    height: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#30D158', borderRadius: 4 },
  progressHint: { color: '#8E8E93', fontSize: 12, marginTop: 6 },
  fatHint: { color: '#30D158', fontSize: 12, marginTop: 4 },
  tapHint: { color: '#48484A', fontSize: 11, marginTop: 8, textAlign: 'right' },

  weekCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  weekTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 16 },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dotItem: { alignItems: 'center', gap: 6 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2C2C2E' },
  dotActive: { backgroundColor: '#30D158' },
  dotLabel: { color: '#8E8E93', fontSize: 11 },

  startBtn: {
    backgroundColor: '#30D158',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  startBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
    alignItems: 'center',
  },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  weightReadout: { color: '#FFFFFF', fontSize: 56, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  weightUnit: { color: '#8E8E93', fontSize: 24, fontWeight: '600' },
  saveBtn: { backgroundColor: '#30D158', borderRadius: 14, paddingVertical: 14, alignItems: 'center', alignSelf: 'stretch', marginTop: 20 },
  saveBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },
  fatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  fatLabel: { color: '#8E8E93', fontSize: 15 },
  fatInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    minWidth: 90,
    textAlign: 'center',
  },
  fatUnit: { color: '#8E8E93', fontSize: 15 },
});
