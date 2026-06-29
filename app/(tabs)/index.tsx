import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ACCENT, ACCENT_INK, SEM } from '../../constants/colors';
import { useOverloadStore } from '../../store/useOverloadStore';
import { useWorkoutStore } from '../../store/useStore';
import { getWeeklySummary } from '../../db/api/overload';
import type { WeeklySummaryDto, ExerciseGoalDto } from '../../db/api/overload';
import { buildExerciseEntry } from '../../lib/exerciseEntry';
import { createWorkoutSession } from '../../db/queries';
import { todayStr } from '../../lib/date';
import ExerciseGoalSheet from '../../components/ExerciseGoalSheet';
import { SettingIcon } from '../../components/SettingIcon';

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
  const [showMore, setShowMore] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);

  // 블록1 종목을 오늘 운동에 바로 담기 — 진행 중 세션이 있으면 추가, 없으면 새로 시작
  const addGoalToWorkout = useCallback(async (goal: ExerciseGoalDto) => {
    if (adding !== null) return;
    setAdding(goal.id);
    try {
      const entry = await buildExerciseEntry({
        id: goal.exerciseId,
        name: goal.exerciseName ?? '종목',
        brand: null,
      });
      const ws = useWorkoutStore.getState();
      if (!ws.activeSessionId) {
        const date = todayStr();
        const newId = await createWorkoutSession(date);
        ws.startSession(newId, date, null);
      }
      useWorkoutStore.getState().addExercise(entry);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/workout');
    } catch {
      Alert.alert('추가 실패', '운동에 담지 못했어요. 다시 시도해 주세요.');
    } finally {
      setAdding(null);
    }
  }, [adding, router]);

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
  const gaps = summary?.bodyPartGaps ?? [];
  const volumes = summary?.bodyPartVolumes ?? [];

  // 이번 주 활동 유무 — 출석 0회 + 누적 세트 0이면 "아직 시작 안 함"으로 본다.
  const totalSets = volumes.reduce((sum, v) => sum + v.currentSets, 0);
  const weekStarted = (att?.done ?? 0) > 0 || totalSets > 0;

  // 블록3용 역할 분리
  const coreGoals = exerciseGoals.filter(g => g.role === 'core');
  const supportGoals = exerciseGoals.filter(g => g.role === 'support');
  const logOnlyGoals = exerciseGoals.filter(g => g.role === 'log_only');
  const collapsedGoals = [...supportGoals, ...logOnlyGoals];

  // 블록1: 오늘 행동 필요 — 확인 필요(증량 준비 + 정체 점검) / 기준 만들기
  const needCheck = exerciseGoals.filter(
    g => g.stage === 'READY_TO_INCREASE' || g.stage === 'STALL_REVIEW' || g.stage === 'DELOAD_OR_RESET'
  );
  const needBaseline = exerciseGoals.filter(g => g.stage === 'NEED_BASELINE');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerRow}>
        <View />
        <Pressable
          onPress={() => router.navigate('/settings')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="설정"
          style={s.iconBtn}
        >
          <SettingIcon name="gear" size={22} color={SEM.ink2} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        <Text style={s.greet}>{weekdayLabel()} · 점진적으로 강해지는 중</Text>

        {/* 블록1 — 오늘 행동 필요 종목 */}
        {(needCheck.length > 0 || needBaseline.length > 0) ? (
          <View style={s.actionWrap}>
            <Text style={s.actionTitle}>오늘 확인 필요</Text>
            {needCheck.map(g => (
              <ActionRow key={g.id} goal={g} kind="check"
                onPress={() => setSheetGoal(g)}
                onAdd={() => addGoalToWorkout(g)} adding={adding === g.id} />
            ))}
            {needBaseline.map(g => (
              <ActionRow key={g.id} goal={g} kind="baseline"
                onPress={() => setSheetGoal(g)}
                onAdd={() => addGoalToWorkout(g)} adding={adding === g.id} />
            ))}
          </View>
        ) : exerciseGoals.length > 0 ? (
          <View style={s.actionWrap}>
            <Text style={s.actionTitle}>오늘 확인 필요</Text>
            <Text style={s.actionEmpty}>지금 따로 챙길 종목은 없어요. 평소대로 기록만 쌓으면 돼요.</Text>
          </View>
        ) : null}

        {/* 블록2 — 이번 주 한 줄 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>이번 주</Text>

          <View style={s.goalRow}>
            <Text style={s.goalLabel}>출석</Text>
            <DotBar done={att?.done ?? 0} total={att?.target ?? goalSetting.weeklyFrequency} />
            <Text style={s.goalVal}>{att ? `${att.done}/${att.target}회` : `0/${goalSetting.weeklyFrequency}회`}</Text>
          </View>

          {!weekStarted ? (
            <View style={s.weekStartBlock}>
              <Text style={s.weekStartTitle}>이번 주 아직 시작 안 했어요</Text>
              <Text style={s.weekStartSub}>오늘 첫 운동을 기록하면 부위별 진행이 여기 채워져요.</Text>
            </View>
          ) : (
            <>
              {volumes.length > 0 ? (
                <View style={s.volBlock}>
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
              ) : null}

              {gaps.length > 0 ? (
                <Text style={s.gapLine}>
                  부족한 부위 · {gaps.map(gp => `${gp.korPart} ${gp.missing}세트`).join(', ')}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* 블록3 — 종목 리스트 (핵심 펼침 / 보조·기록만 접힘) */}
        {coreGoals.length > 0 && (
          <>
            <View style={s.secH}><Text style={s.secHT}>핵심 종목</Text></View>
            {coreGoals.map(g => <GoalCard key={g.id} goal={g} onPress={() => setSheetGoal(g)} />)}
          </>
        )}

        {collapsedGoals.length > 0 && (
          <>
            <Pressable style={s.moreToggle} onPress={() => setShowMore(v => !v)}>
              <Text style={s.moreToggleT}>
                보조 · 기록만 {collapsedGoals.length}개
              </Text>
              <Text style={s.moreChevron}>{showMore ? '▴' : '▾'}</Text>
            </Pressable>
            {showMore && collapsedGoals.map(g => (
              <GoalCard key={g.id} goal={g} onPress={() => setSheetGoal(g)} compact />
            ))}
          </>
        )}

        {exerciseGoals.length === 0 && (
          <Pressable style={s.setupCta} onPress={() => router.navigate('/onboarding')}>
            <Text style={s.setupCtaT}>목표 설정하기</Text>
          </Pressable>
        )}
      </ScrollView>

      <Pressable
        style={s.chatFab}
        onPress={() => router.navigate('/(tabs)/chat')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="AI 코치"
      >
        <SettingIcon name="chat" size={24} color={SEM.ink1} />
      </Pressable>

      <ExerciseGoalSheet goal={sheetGoal} onClose={() => setSheetGoal(null)} />
    </SafeAreaView>
  );
}

/** 블록1 행: 중립적인 "확인 필요" 묶음 + 기준 만들기. 행 탭=상세 시트, 우측 버튼=오늘 운동에 추가 */
function ActionRow({ goal, kind, onPress, onAdd, adding }: {
  goal: ExerciseGoalDto; kind: 'check' | 'baseline';
  onPress: () => void; onAdd: () => void; adding: boolean;
}) {
  const baseline = kind === 'baseline';
  return (
    <View style={[s.actionRow, baseline ? s.actionRowBase : s.actionRowCheck]}>
      <Pressable style={s.actionInfo} onPress={onPress}>
        <Text style={s.actionName}>{goal.exerciseName ?? '—'}</Text>
        <Text style={s.actionTarget} numberOfLines={2}>
          {baseline ? '오늘 기준 만들기' : goal.todayTarget}
        </Text>
      </Pressable>
      <Pressable style={[s.actionAddBtn, adding && s.actionAddBtnBusy]} onPress={onAdd} disabled={adding}>
        <Text style={s.actionAddT}>{adding ? '추가 중…' : '운동에 추가'}</Text>
      </Pressable>
    </View>
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
  iconBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32 },
  chatFab: { position: 'absolute', right: 18, bottom: 18, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1a1a1f', borderWidth: 1, borderColor: '#2a2a2f',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  body: { padding: 18, paddingBottom: 90 },

  greet: { fontSize: 13, color: SEM.ink3, marginBottom: 12 },

  // 블록1
  actionWrap: { marginBottom: 16 },
  actionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff', marginBottom: 10 },
  actionEmpty: { fontSize: 13, color: SEM.ink3, lineHeight: 19,
    backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line, borderRadius: 12, padding: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13,
    padding: 14, marginBottom: 9, backgroundColor: SEM.surface1 },
  actionRowCheck: { borderColor: 'rgba(43,217,106,0.32)' },
  actionRowBase: { borderColor: '#2c2c2e' },
  actionInfo: { flex: 1, paddingRight: 10 },
  actionName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  actionTarget: { fontSize: 13.5, fontWeight: '600', color: '#d0d0d8', marginTop: 4, lineHeight: 19 },
  actionAddBtn: { backgroundColor: ACCENT, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  actionAddBtnBusy: { opacity: 0.6 },
  actionAddT: { color: ACCENT_INK, fontSize: 13, fontWeight: '800' },

  // 블록2
  card: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 16, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 11, fontWeight: '800', color: SEM.ink3, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 14 },

  goalRow: { flexDirection: 'row', alignItems: 'center' },
  goalLabel: { fontSize: 13, fontWeight: '700', color: '#fff', width: 40 },
  goalVal: { fontSize: 13, fontWeight: '800', color: '#fff', marginLeft: 12, minWidth: 48, textAlign: 'right' },
  dotRow: { flex: 1, flexDirection: 'row', gap: 5, marginLeft: 8, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: ACCENT },
  dotOff: { backgroundColor: '#2a2a2f' },

  volBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: SEM.line },
  volRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  volName: { fontSize: 13, fontWeight: '700', color: '#fff', width: 40 },
  volTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: SEM.surface2, marginLeft: 8, overflow: 'hidden' },
  volFill: { height: '100%', borderRadius: 4 },
  volVal: { fontSize: 12, color: SEM.ink3, marginLeft: 10, minWidth: 56, textAlign: 'right', fontWeight: '600' },
  gapLine: { fontSize: 12.5, color: SEM.ink3, marginTop: 4, lineHeight: 18 },

  // 블록2 빈 상태(이번 주 미시작) — 빈 막대 대신 격려·중립 안내
  weekStartBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: SEM.line },
  weekStartTitle: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  weekStartSub: { fontSize: 13, color: SEM.ink3, marginTop: 5, lineHeight: 19 },

  // 블록3
  secH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 18, marginBottom: 10 },
  secHT: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },

  moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, marginBottom: 6, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line, borderRadius: 12 },
  moreToggleT: { fontSize: 13.5, fontWeight: '700', color: '#c4c4cc' },
  moreChevron: { fontSize: 13, color: SEM.ink3 },

  pcard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 16, marginBottom: 10 },
  pcardReady: { borderColor: 'rgba(43,217,106,0.4)' },
  pcardStall: { borderColor: 'rgba(255,138,0,0.35)' },
  pcardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  pcardName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  pcardType: { fontSize: 11, fontWeight: '700', color: SEM.ink3, marginTop: 3 },
  stageBadge: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  stageBadgeT: { fontSize: 11, fontWeight: '800' },
  pcardGoalRow: { marginTop: 12 },
  pcardLast: { fontSize: 12, color: SEM.ink3, marginBottom: 3 },
  pcardToday: { fontSize: 14.5, fontWeight: '800', color: '#fff', lineHeight: 20 },
  pcardCond: { fontSize: 12, color: SEM.ink3, marginTop: 8, lineHeight: 17 },

  setupCta: { marginTop: 20, height: 52, borderRadius: 14, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center' },
  setupCtaT: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
