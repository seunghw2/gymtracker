import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ACCENT, SEM } from '../../constants/colors';
import { useOverloadStore } from '../../store/useOverloadStore';
import { getWeeklySummary } from '../../db/api/overload';
import type { WeeklySummaryDto, ExerciseGoalDto } from '../../db/api/overload';

const MG_KOR: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체',
  Arms: '팔', Core: '코어', Cardio: '유산소',
};
function korPart(p: string) { return MG_KOR[p] ?? p; }

function weekdayLabel() {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()] + '요일';
}

/** 주간 무기 바: ●●●○○ */
function DotBar({ done, total }: { done: number; total: number }) {
  const n = Math.max(total, 1);
  return (
    <View style={s.dotRow}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.dot, i < done ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { goalSetting, exerciseGoals, loadGoalSetting, loadExerciseGoals } = useOverloadStore();
  const [summary, setSummary] = useState<WeeklySummaryDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await Promise.all([loadGoalSetting(), loadExerciseGoals()]);
    const s = await getWeeklySummary();
    setSummary(s);
  }, [loadGoalSetting, loadExerciseGoals]);

  useFocusEffect(useCallback(() => {
    loadGoalSetting().then(() => {
      const gs = useOverloadStore.getState().goalSetting;
      if (!gs?.onboarded) { router.replace('/onboarding'); return; }
      load();
    });
  }, [load, loadGoalSetting, router]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  if (!goalSetting?.onboarded) return <View style={{ flex: 1, backgroundColor: '#000' }} />;

  const att = summary?.attendance;
  const imp = summary?.improvements;
  const gaps = summary?.bodyPartGaps ?? [];

  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.headerRow}>
        <View />
        <Pressable onPress={() => router.navigate('/settings')} hitSlop={10}>
          <Text style={s.gearIcon}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {/* 날짜 + 요약 제목 */}
        <Text style={s.greet}>{weekdayLabel()} · 점진적으로 강해지는 중</Text>

        {/* AI 코멘트 (규칙 기반) */}
        {summary?.comment ? (
          <View style={s.commentRow}>
            <Text style={s.commentIcon}>💬</Text>
            <Text style={s.commentText}>{summary.comment}</Text>
          </View>
        ) : null}

        {/* 이번 주 목표 카드 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>이번 주 목표</Text>

          {/* 출석 */}
          <View style={s.goalRow}>
            <Text style={s.goalLabel}>출석</Text>
            <DotBar done={att?.done ?? 0} total={att?.target ?? goalSetting.weeklyFrequency} />
            <Text style={s.goalVal}>
              {att ? `${att.done}/${att.target}회` : `0/${goalSetting.weeklyFrequency}회`}
            </Text>
          </View>

          {/* 종목 개선 */}
          <View style={s.goalRow}>
            <Text style={s.goalLabel}>개선</Text>
            {imp?.hasData ? (
              <>
                <DotBar done={imp.done} total={Math.max(imp.total, 1)} />
                <Text style={s.goalVal}>{imp.done}/{imp.total}개</Text>
              </>
            ) : (
              <Text style={s.noDataText}>다음 운동부터 추적 시작</Text>
            )}
          </View>

          {/* 부위 부족 */}
          {gaps.length > 0 && (
            <View style={s.gapRow}>
              {gaps.map(g => (
                <View key={g.part} style={s.gapChip}>
                  <Text style={s.gapChipT}>{g.korPart} {g.missing}회 부족</Text>
                </View>
              ))}
            </View>
          )}
          {gaps.length === 0 && att && att.done > 0 && (
            <View style={[s.gapRow]}>
              <View style={[s.gapChip, { backgroundColor: 'rgba(43,217,106,0.12)', borderColor: 'rgba(43,217,106,0.3)' }]}>
                <Text style={[s.gapChipT, { color: SEM.good }]}>이번 주 부위 목표 달성 ✓</Text>
              </View>
            </View>
          )}
        </View>

        {/* 오늘 운동하면 */}
        {summary?.todayPlan && (
          <View style={s.todayCard}>
            <Text style={s.todayLabel}>오늘 운동하면</Text>
            <Text style={s.todayPlan}>{summary.todayPlan}</Text>
            {att && (
              <Text style={s.todayAttend}>
                출석 {att.done + 1}/{att.target}회 달성
              </Text>
            )}
          </View>
        )}

        {/* 종목별 진행도 */}
        {exerciseGoals.length > 0 && (
          <>
            <View style={s.secH}>
              <Text style={s.secHT}>종목별 진행도</Text>
              <Text style={s.secHR}>증량 준비순 ↓</Text>
            </View>
            {exerciseGoals.map(g => <GoalCard key={g.id} goal={g} />)}
          </>
        )}

        {exerciseGoals.length === 0 && (
          <Pressable style={s.setupCta} onPress={() => router.navigate('/onboarding')}>
            <Text style={s.setupCtaT}>목표 설정하기</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* 채팅 FAB */}
      <Pressable style={s.chatFab} onPress={() => router.navigate('/(tabs)/chat')}>
        <Text style={s.chatFabIcon}>💬</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function GoalCard({ goal }: { goal: ExerciseGoalDto }) {
  const ready = goal.status === 'ready_to_increase';
  const hold = goal.status === 'hold';
  const fromLabel = goal.currentValue != null
    ? (goal.ruleType === 'bodyweight' ? `${goal.currentValue}회` : `${goal.currentValue}kg`)
    : '—';

  return (
    <View style={[s.pcard, ready && s.pcardReady]}>
      <View style={s.pcardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.pcardName}>{goal.exerciseName ?? '—'}</Text>
          <Text style={s.pcardType}>{ruleLabel(goal.ruleType)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.pcardFrom}>{fromLabel}</Text>
          <Text style={[s.pcardNext, hold && { color: SEM.muted }]}>→ {goal.nextTarget ?? '—'}</Text>
        </View>
      </View>
      <View style={s.pcardBar}>
        <View style={[s.pcardFill, {
          width: ready || hold ? '100%' : '60%',
          backgroundColor: ready ? SEM.good : ACCENT,
        }]} />
      </View>
      {ready ? (
        <View style={s.readyTag}>
          <View style={[s.readyDot, { backgroundColor: SEM.good }]} />
          <Text style={[s.readyT, { color: SEM.good }]}>증량 준비됨</Text>
        </View>
      ) : !hold ? (
        <Text style={s.pcardCond}>{condText(goal)}</Text>
      ) : null}
    </View>
  );
}

function condText(g: ExerciseGoalDto): string {
  if (g.ruleType === 'barbell_main') return `목표 ${g.targetReps ?? '—'}회 ${g.targetSets ?? '—'}세트 달성 시 증량`;
  if (g.ruleType === 'machine_cable') return `반복 범위 ${g.repRangeMin ?? '—'}–${g.repRangeMax ?? '—'}회 채우는 중`;
  if (g.ruleType === 'bodyweight') return `총 반복수 늘리는 중`;
  return '반복 범위 유지';
}

function ruleLabel(rt: string): string {
  const m: Record<string, string> = {
    barbell_main: '바벨 메인', machine_cable: '머신 / 케이블',
    bodyweight: '맨몸', isolation: '고립',
  };
  return m[rt] ?? rt;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  gearIcon: { fontSize: 22 },
  chatFab: { position: 'absolute', right: 18, bottom: 18, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1a1a1f', borderWidth: 1, borderColor: '#2a2a2f',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  chatFabIcon: { fontSize: 22 },
  body: { padding: 18, paddingBottom: 90 },

  greet: { fontSize: 13, color: SEM.muted, marginBottom: 8 },

  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14,
    backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1e1e22',
    borderRadius: 12, padding: 12 },
  commentIcon: { fontSize: 14, marginTop: 1 },
  commentText: { flex: 1, fontSize: 13.5, color: '#d0d0d8', lineHeight: 20 },

  card: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 16, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: SEM.muted, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 14 },

  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalLabel: { fontSize: 13, fontWeight: '700', color: '#fff', width: 40 },
  goalVal: { fontSize: 13, fontWeight: '800', color: '#fff', marginLeft: 12, minWidth: 48, textAlign: 'right' },
  dotRow: { flex: 1, flexDirection: 'row', gap: 5, marginLeft: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: ACCENT },
  dotOff: { backgroundColor: '#2a2a2f' },
  noDataText: { flex: 1, fontSize: 12, color: '#555', marginLeft: 8, fontStyle: 'italic' },

  gapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  gapChip: { backgroundColor: 'rgba(255,138,0,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.3)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5 },
  gapChipT: { fontSize: 12, fontWeight: '700', color: SEM.bad },

  todayCard: { backgroundColor: '#0a0f0a', borderWidth: 1, borderColor: 'rgba(43,217,106,0.2)',
    borderRadius: 14, padding: 16, marginBottom: 14 },
  todayLabel: { fontSize: 11, fontWeight: '800', color: SEM.good, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 6 },
  todayPlan: { fontSize: 14.5, fontWeight: '700', color: '#fff', lineHeight: 21 },
  todayAttend: { fontSize: 12, color: SEM.muted, marginTop: 6 },

  secH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 12 },
  secHT: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  secHR: { fontSize: 12, color: SEM.muted },

  pcard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 16, marginBottom: 10 },
  pcardReady: { borderColor: 'rgba(43,217,106,0.4)' },
  pcardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  pcardName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  pcardType: { fontSize: 11, fontWeight: '700', color: '#555', marginTop: 3 },
  pcardFrom: { fontSize: 12.5, color: SEM.muted, fontWeight: '600' },
  pcardNext: { fontSize: 16, fontWeight: '800', color: SEM.good },
  pcardBar: { height: 6, borderRadius: 3, backgroundColor: SEM.surface2, marginVertical: 12, overflow: 'hidden' },
  pcardFill: { height: '100%', borderRadius: 3 },
  pcardCond: { fontSize: 12, color: SEM.muted },
  readyTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readyDot: { width: 6, height: 6, borderRadius: 3 },
  readyT: { fontSize: 11, fontWeight: '800' },

  setupCta: { marginTop: 20, height: 52, borderRadius: 14, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center' },
  setupCtaT: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
