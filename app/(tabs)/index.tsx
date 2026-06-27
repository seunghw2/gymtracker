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
import ExerciseGoalSheet from '../../components/ExerciseGoalSheet';

const MG_KOR: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체',
  Arms: '팔', Core: '코어', Cardio: '유산소',
};

function weekdayLabel() {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()] + '요일';
}

/** 주간 도트 바: ●●●○○ */
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
  const [sheetGoal, setSheetGoal] = useState<ExerciseGoalDto | null>(null);

  const load = useCallback(async () => {
    await Promise.all([loadGoalSetting(), loadExerciseGoals()]);
    const sum = await getWeeklySummary();
    setSummary(sum);
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
  const volumes = summary?.bodyPartVolumes ?? [];

  // 핵심/보조 분리, 각 그룹 내 증량준비 → 진행중 → hold 순
  const coreGoals = exerciseGoals.filter(g => g.role === 'core');
  const supportGoals = exerciseGoals.filter(g => g.role === 'support');
  const logOnlyGoals = exerciseGoals.filter(g => g.role === 'log_only');

  return (
    <SafeAreaView style={s.safe}>
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
        <Text style={s.greet}>{weekdayLabel()} · 점진적으로 강해지는 중</Text>

        {summary?.comment ? (
          <View style={s.commentRow}>
            <Text style={s.commentIcon}>💬</Text>
            <Text style={s.commentText}>{summary.comment}</Text>
          </View>
        ) : null}

        {/* 이번 주 목표 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>이번 주 목표</Text>

          <View style={s.goalRow}>
            <Text style={s.goalLabel}>출석</Text>
            <DotBar done={att?.done ?? 0} total={att?.target ?? goalSetting.weeklyFrequency} />
            <Text style={s.goalVal}>{att ? `${att.done}/${att.target}회` : `0/${goalSetting.weeklyFrequency}회`}</Text>
          </View>

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
        </View>

        {/* 부위별 주간 세트 진행도 */}
        {volumes.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>목표 부위 주간 세트</Text>
            {volumes.map(v => {
              const pct = Math.min(1, v.targetSets > 0 ? v.currentSets / v.targetSets : 0);
              const enough = v.currentSets >= v.targetSets;
              return (
                <View key={v.part} style={s.volRow}>
                  <Text style={s.volName}>{v.korPart}</Text>
                  <View style={s.volTrack}>
                    <View style={[s.volFill, {
                      width: `${Math.round(pct * 100)}%`,
                      backgroundColor: enough ? SEM.good : ACCENT,
                    }]} />
                  </View>
                  <Text style={[s.volVal, enough && { color: SEM.good }]}>
                    {v.currentSets}/{v.targetSets}세트
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* 오늘 운동하면 */}
        {summary?.todayPlan && (
          <View style={s.todayCard}>
            <Text style={s.todayLabel}>오늘 운동하면</Text>
            <Text style={s.todayPlan}>{summary.todayPlan}</Text>
            {att && <Text style={s.todayAttend}>출석 {att.done + 1}/{att.target}회 달성</Text>}
          </View>
        )}

        {/* 핵심 종목 */}
        {coreGoals.length > 0 && (
          <>
            <View style={s.secH}><Text style={s.secHT}>핵심 종목</Text></View>
            {coreGoals.map(g => <GoalCard key={g.id} goal={g} onPress={() => setSheetGoal(g)} />)}
          </>
        )}

        {/* 보조 종목 */}
        {supportGoals.length > 0 && (
          <>
            <View style={s.secH}><Text style={s.secHT}>보조 종목</Text></View>
            {supportGoals.map(g => <GoalCard key={g.id} goal={g} onPress={() => setSheetGoal(g)} compact />)}
          </>
        )}

        {/* 기록만 */}
        {logOnlyGoals.length > 0 && (
          <>
            <View style={s.secH}><Text style={s.secHT}>기록만</Text></View>
            {logOnlyGoals.map(g => <GoalCard key={g.id} goal={g} onPress={() => setSheetGoal(g)} compact />)}
          </>
        )}

        {exerciseGoals.length === 0 && (
          <Pressable style={s.setupCta} onPress={() => router.navigate('/onboarding')}>
            <Text style={s.setupCtaT}>목표 설정하기</Text>
          </Pressable>
        )}
      </ScrollView>

      <Pressable style={s.chatFab} onPress={() => router.navigate('/(tabs)/chat')}>
        <Text style={s.chatFabIcon}>💬</Text>
      </Pressable>

      <ExerciseGoalSheet goal={sheetGoal} onClose={() => setSheetGoal(null)} />
    </SafeAreaView>
  );
}

function GoalCard({ goal, onPress, compact }: { goal: ExerciseGoalDto; onPress: () => void; compact?: boolean }) {
  const ready = goal.stage === 'READY_TO_INCREASE';
  const needBase = goal.stage === 'NEED_BASELINE';
  const stall = goal.stage === 'STALL_REVIEW' || goal.stage === 'DELOAD_OR_RESET';

  return (
    <Pressable style={[s.pcard, ready && s.pcardReady, stall && s.pcardStall]} onPress={onPress}>
      <View style={s.pcardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.pcardName}>{goal.exerciseName ?? '—'}</Text>
          <Text style={s.pcardType}>{ruleLabel(goal.ruleType)}</Text>
        </View>
        <View style={[s.stageBadge, stageBadgeStyle(goal.stage)]}>
          <Text style={[s.stageBadgeT, { color: stageTextColor(goal.stage) }]}>{goal.stageLabel}</Text>
        </View>
      </View>

      {/* 기준 기록 or 오늘 목표 */}
      <View style={s.pcardGoalRow}>
        {!needBase && goal.lastRecord && (
          <Text style={s.pcardLast}>지난 기록 {goal.lastRecord}</Text>
        )}
        <Text style={s.pcardToday} numberOfLines={2}>
          {needBase ? goal.todayTarget : `오늘 ${goal.todayTarget}`}
        </Text>
      </View>

      {!compact && (
        <Text style={s.pcardCond} numberOfLines={2}>
          {goal.caution ?? goal.nextCondition}
        </Text>
      )}
    </Pressable>
  );
}

function stageBadgeStyle(stage: string) {
  if (stage === 'READY_TO_INCREASE') return { backgroundColor: 'rgba(43,217,106,0.14)', borderColor: 'rgba(43,217,106,0.4)' };
  if (stage === 'NEED_BASELINE') return { backgroundColor: '#1f1f23', borderColor: '#2c2c2e' };
  if (stage === 'STALL_REVIEW' || stage === 'DELOAD_OR_RESET') return { backgroundColor: 'rgba(255,138,0,0.12)', borderColor: 'rgba(255,138,0,0.35)' };
  return { backgroundColor: 'rgba(255,59,48,0.12)', borderColor: 'rgba(255,59,48,0.35)' };
}
function stageTextColor(stage: string) {
  if (stage === 'READY_TO_INCREASE') return SEM.good;
  if (stage === 'NEED_BASELINE') return '#9a9aa1';
  if (stage === 'STALL_REVIEW' || stage === 'DELOAD_OR_RESET') return SEM.bad;
  return ACCENT;
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
    backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1e1e22', borderRadius: 12, padding: 12 },
  commentIcon: { fontSize: 14, marginTop: 1 },
  commentText: { flex: 1, fontSize: 13.5, color: '#d0d0d8', lineHeight: 20 },

  card: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 16, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: SEM.muted, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 14 },

  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalLabel: { fontSize: 13, fontWeight: '700', color: '#fff', width: 40 },
  goalVal: { fontSize: 13, fontWeight: '800', color: '#fff', marginLeft: 12, minWidth: 48, textAlign: 'right' },
  dotRow: { flex: 1, flexDirection: 'row', gap: 5, marginLeft: 8, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: ACCENT },
  dotOff: { backgroundColor: '#2a2a2f' },
  noDataText: { flex: 1, fontSize: 12, color: '#555', marginLeft: 8, fontStyle: 'italic' },

  volRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  volName: { fontSize: 13, fontWeight: '700', color: '#fff', width: 40 },
  volTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: SEM.surface2, marginLeft: 8, overflow: 'hidden' },
  volFill: { height: '100%', borderRadius: 4 },
  volVal: { fontSize: 12, color: SEM.muted, marginLeft: 10, minWidth: 56, textAlign: 'right', fontWeight: '600' },

  todayCard: { backgroundColor: '#0a0f0a', borderWidth: 1, borderColor: 'rgba(43,217,106,0.2)',
    borderRadius: 14, padding: 16, marginBottom: 14 },
  todayLabel: { fontSize: 11, fontWeight: '800', color: SEM.good, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 6 },
  todayPlan: { fontSize: 14.5, fontWeight: '700', color: '#fff', lineHeight: 21 },
  todayAttend: { fontSize: 12, color: SEM.muted, marginTop: 6 },

  secH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 18, marginBottom: 10 },
  secHT: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },

  pcard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 16, marginBottom: 10 },
  pcardReady: { borderColor: 'rgba(43,217,106,0.4)' },
  pcardStall: { borderColor: 'rgba(255,138,0,0.35)' },
  pcardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  pcardName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  pcardType: { fontSize: 11, fontWeight: '700', color: '#555', marginTop: 3 },
  stageBadge: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  stageBadgeT: { fontSize: 11, fontWeight: '800' },
  pcardGoalRow: { marginTop: 12 },
  pcardLast: { fontSize: 12, color: '#6a6a6e', marginBottom: 3 },
  pcardToday: { fontSize: 14.5, fontWeight: '800', color: '#fff', lineHeight: 20 },
  pcardCond: { fontSize: 12, color: SEM.muted, marginTop: 8, lineHeight: 17 },

  setupCta: { marginTop: 20, height: 52, borderRadius: 14, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center' },
  setupCtaT: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
