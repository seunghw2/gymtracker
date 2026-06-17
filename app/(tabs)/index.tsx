import React, { useCallback, useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import {
  getTodayBodyLog,
  getLatestBodyLog,
  getBodyLogs,
  upsertBodyLog,
  getWeeklyWorkoutCount,
  getAllWorkoutDates,
  getSetting,
  getReportV2,
  AiReportV2,
  BodyLog,
} from '../../db/queries';
import { useSettingsStore } from '../../store/useStore';
import RulerPicker from '../../components/RulerPicker';
import BriefingLoading from '../../components/BriefingLoading';
import { ACCENT, ACCENT_INK, AI } from '../../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEIGHT_PROMPT_KEY = 'weight_prompt_dismissed';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function getWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: iso(mon), end: iso(sun) };
}
/** 오늘(또는 어제)부터 거꾸로 이어진 연속 운동일 수. */
function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  const d = new Date();
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
  let s = 0;
  while (set.has(iso(d))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

export default function BriefingHome() {
  const router = useRouter();
  const { goalWeightKg } = useSettingsStore();
  const [report, setReport] = useState<AiReportV2 | null>(null);
  const [reportStatus, setReportStatus] = useState<string>('');
  const [reportPct, setReportPct] = useState(0);
  const [reportStep, setReportStep] = useState<string | null>(null);
  const [weekCount, setWeekCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayWeight, setTodayWeight] = useState<number | null>(null);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [dialValue, setDialValue] = useState(70);
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [todayBodyFat, setTodayBodyFat] = useState<number | null>(null);
  const [waistInput, setWaistInput] = useState('');
  const [todayWaist, setTodayWaist] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const today = getTodayStr();
    const { start, end } = getWeekRange();
    try {
      const [count, todayLog, latestLog, allDates] = await Promise.all([
        getWeeklyWorkoutCount(start, end),
        getTodayBodyLog(today),
        getLatestBodyLog(),
        getAllWorkoutDates(),
      ]);
      setWeekCount(count);
      setStreak(computeStreak(allDates));

      if (todayLog?.weight_kg) {
        setTodayWeight(todayLog.weight_kg);
        setTodayBodyFat(todayLog.body_fat_pct ?? null);
        setTodayWaist(todayLog.waist_cm ?? null);
      } else {
        const enabled = await getSetting('weight_prompt_enabled', '1').catch(() => '1');
        const dismissed = await AsyncStorage.getItem(WEIGHT_PROMPT_KEY).catch(() => null);
        if (enabled !== '0' && dismissed !== today) setShowWeightModal(true);
        setDialValue(latestLog?.weight_kg ?? 70);
        setBodyFatInput(latestLog?.body_fat_pct ? String(latestLog.body_fat_pct) : '');
        setWaistInput(latestLog?.waist_cm ? String(latestLog.waist_cm) : '');
      }
    } catch {
      // 무시 — 폴백 UI
    }
    setLoaded(true);

    // v2 주간 브리핑(비동기 — 생성 중이면 GENERATING, 폴링으로 완성 감지)
    try {
      const r = await getReportV2('week');
      setReportStatus(r.status);
      setReport(r.report);
      setReportPct(r.percent ?? 0);
      setReportStep(r.step ?? null);
    } catch {
      setReportStatus('FAILED');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 생성 중이면 2초 폴링 → 완료 시 헤드라인/처방으로 교체
  useEffect(() => {
    if (reportStatus !== 'GENERATING') return;
    const id = setTimeout(() => {
      getReportV2('week').then(r => {
        setReportStatus(r.status); setReport(r.report);
        setReportPct(r.percent ?? 0); setReportStep(r.step ?? null);
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(id);
  }, [reportStatus, reportPct]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openWeightModal = () => {
    setDialValue(todayWeight ?? dialValue);
    setBodyFatInput(todayBodyFat != null ? String(todayBodyFat) : bodyFatInput);
    setWaistInput(todayWaist != null ? String(todayWaist) : waistInput);
    setShowWeightModal(true);
  };
  const handleSaveWeight = async () => {
    const fat = parseFloat(bodyFatInput);
    const fatValue = Number.isFinite(fat) && fat > 0 ? fat : todayBodyFat ?? undefined;
    const waist = parseFloat(waistInput);
    const waistValue = Number.isFinite(waist) && waist > 0 ? waist : todayWaist ?? undefined;
    try { await upsertBodyLog(getTodayStr(), dialValue, fatValue, waistValue); } catch {}
    setTodayWeight(dialValue);
    if (fatValue != null) setTodayBodyFat(fatValue);
    if (waistValue != null) setTodayWaist(waistValue);
    AsyncStorage.setItem(WEIGHT_PROMPT_KEY, getTodayStr()).catch(() => {});
    setShowWeightModal(false);
  };
  const closeWeightModal = () => {
    AsyncStorage.setItem(WEIGHT_PROMPT_KEY, getTodayStr()).catch(() => {});
    setShowWeightModal(false);
  };

  const now = new Date();
  const dateChip = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DAYS[now.getDay()]} · 브리핑`;
  const goalDiff = todayWeight != null ? todayWeight - goalWeightKg : null;
  const profileNeeded = reportStatus === 'PROFILE_REQUIRED';

  // 헤드라인/처방: v2 리포트 있으면 사용, 없으면 폴백
  const headline = report?.headline
    ?? (profileNeeded ? 'AI 분석을 켜볼까요?' : weekCount > 0 ? '이번 주, 잘 쌓고 있어요.' : '오늘부터 다시 시작.');
  const rx = report?.prescription;

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {/* 헤더 */}
        <View style={styles.headerRow}>
          <Text style={styles.brand}>브리핑</Text>
          <View style={styles.headerIcons}>
            <Pressable hitSlop={10} onPress={() => router.push('/(tabs)/settings')}>
              <Ionicons name="settings-outline" size={22} color={AI.textSub} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.dateChip}>{dateChip}</Text>

        {reportStatus === 'GENERATING' ? (
          <View style={{ height: 300 }}>
            <BriefingLoading percent={reportPct} step={reportStep} />
          </View>
        ) : (<>
        {/* 큰 헤드라인 */}
        <Pressable onPress={() => router.push('/ai/reports')}>
          <Text style={styles.headline}>{headline}</Text>
        </Pressable>

        {/* 처방 / CTA */}
        {profileNeeded ? (
          <Pressable style={styles.rxCard} onPress={() => router.push('/ai/intake')}>
            <Text style={styles.rxCap}>시작하기</Text>
            <Text style={styles.rxAction}>목표를 알려주면 매주 브리핑을 만들어줄게요.</Text>
            <Text style={styles.rxTodo}>탭하여 1분 설정 →</Text>
          </Pressable>
        ) : rx ? (
          <Pressable style={styles.rxCard} onPress={() => router.push('/ai/reports')}>
            <Text style={styles.rxCap}>처방 · 이번 주</Text>
            <Text style={styles.rxAction}>{rx.action}</Text>
            {!!rx.todo && <Text style={styles.rxTodo}>{rx.todo}</Text>}
          </Pressable>
        ) : null}
        </>)}

        {/* 핵심 지표 3 */}
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricV}>{weekCount}</Text>
            <Text style={styles.metricL}>이번 주</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricV}>{streak}</Text>
            <Text style={styles.metricL}>스트릭</Text>
          </View>
          <Pressable style={styles.metric} onPress={openWeightModal}>
            <Text style={styles.metricV}>{goalDiff != null ? `${Math.abs(goalDiff).toFixed(1)}` : '–'}</Text>
            <Text style={styles.metricL}>{goalDiff == null ? '체중 입력' : `목표까지 kg`}</Text>
          </Pressable>
        </View>

        {/* 운동 시작 */}
        <Pressable style={styles.startBtn} onPress={() => router.push('/workout')}>
          <Ionicons name="play" size={18} color={ACCENT_INK} />
          <Text style={styles.startBtnText}>운동 시작</Text>
        </Pressable>
      </ScrollView>

      {/* 체중 입력 모달 */}
      <Modal visible={showWeightModal} transparent animationType="slide" onRequestClose={closeWeightModal}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.modalOverlay} onPress={closeWeightModal}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>오늘의 체중</Text>
                <Text style={styles.weightReadout}>{dialValue.toFixed(1)}<Text style={styles.weightUnit}>kg</Text></Text>
                <RulerPicker initial={dialValue} onChange={v => setDialValue(v)} />
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
                <View style={styles.fatRow}>
                  <Text style={styles.fatLabel}>허리</Text>
                  <TextInput
                    style={styles.fatInput}
                    value={waistInput}
                    onChangeText={setWaistInput}
                    placeholder="선택"
                    placeholderTextColor="#48484A"
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                  <Text style={styles.fatUnit}>cm</Text>
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  brand: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  dateChip: { color: AI.textSub, fontSize: 12, marginTop: 6, fontVariant: ['tabular-nums'] },

  headline: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', lineHeight: 38, letterSpacing: -0.5, marginTop: 18 },

  rxCard: { backgroundColor: '#161618', borderLeftWidth: 3, borderLeftColor: ACCENT, borderRadius: 12, padding: 15, marginTop: 18 },
  rxCap: { color: ACCENT, fontSize: 11, fontWeight: '800' },
  rxAction: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '700', lineHeight: 22, marginTop: 6 },
  rxTodo: { color: AI.textSub, fontSize: 12.5, lineHeight: 18, marginTop: 8 },

  metrics: { flexDirection: 'row', gap: 10, marginTop: 18 },
  metric: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  metricV: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricL: { color: AI.textSub, fontSize: 11.5, marginTop: 4 },

  startBtn: { flexDirection: 'row', gap: 7, backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  startBtnText: { color: ACCENT_INK, fontSize: 17, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 44, alignItems: 'center' },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  weightReadout: { color: '#FFFFFF', fontSize: 56, fontWeight: '800', letterSpacing: -1, marginTop: 4 },
  weightUnit: { color: '#8E8E93', fontSize: 24, fontWeight: '600' },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: 'center', alignSelf: 'stretch', marginTop: 20 },
  saveBtnText: { color: ACCENT_INK, fontSize: 17, fontWeight: '700' },
  fatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  fatLabel: { color: '#8E8E93', fontSize: 15 },
  fatInput: { backgroundColor: '#2C2C2E', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 16, minWidth: 90, textAlign: 'center' },
  fatUnit: { color: '#8E8E93', fontSize: 15 },
});
