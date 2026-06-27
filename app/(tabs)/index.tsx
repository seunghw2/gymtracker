import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ACCENT, SEM } from '../../constants/colors';
import { useOverloadStore } from '../../store/useOverloadStore';
import { getWeeklyPattern } from '../../db/api/overload';
import type { PartSummaryDto, ExerciseGoalDto } from '../../db/api/overload';

const MG_KOR: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체',
  Arms: '팔', Core: '코어', Cardio: '유산소',
};

function korPart(p: string) { return MG_KOR[p] ?? p; }

export default function Dashboard() {
  const router = useRouter();
  const { goalSetting, exerciseGoals, loadGoalSetting, loadExerciseGoals } = useOverloadStore();

  const [pattern, setPattern] = useState<PartSummaryDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await Promise.all([loadGoalSetting(), loadExerciseGoals()]);
    const p = await getWeeklyPattern().catch(() => [] as PartSummaryDto[]);
    setPattern(p);
  }, [loadGoalSetting, loadExerciseGoals]);

  useFocusEffect(useCallback(() => {
    loadGoalSetting().then(() => {
      const gs = useOverloadStore.getState().goalSetting;
      if (!gs?.onboarded) {
        router.replace('/onboarding');
        return;
      }
      load();
    });
  }, [load, loadGoalSetting, router]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const maxSets = pattern.length > 0 ? pattern[0].setCount : 1;

  // 다음 운동: 빈도 대비 이번 주 세션 가장 적은 부위
  const nextPart = (() => {
    if (!goalSetting || pattern.length === 0) return null;
    const perWeek = goalSetting.weeklyFrequency;
    let minRatio = Infinity;
    let minPart: PartSummaryDto | null = null;
    for (const p of pattern) {
      const ratio = p.sessionCount / perWeek;
      if (ratio < minRatio) { minRatio = ratio; minPart = p; }
    }
    return minPart;
  })();

  if (!goalSetting?.onboarded) return (
    <View style={{ flex: 1, backgroundColor: '#000' }} />
  );

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
        <Text style={s.greet}>{weekdayLabel()} · 이번 주 {totalSessions(pattern)}일째</Text>
        <Text style={s.title}>점진적으로 강해지는 중 💪</Text>

        {/* 이번 주 패턴 */}
        {pattern.length > 0 && (
          <>
            <SectionHeader title="이번 주 패턴" />
            <View style={s.patCard}>
              {pattern.map(p => (
                <View key={p.part} style={s.patRow}>
                  <Text style={s.patName}>{korPart(p.part)}</Text>
                  <View style={s.patTrack}>
                    <View style={[s.patFill, {
                      width: `${Math.round(p.setCount / maxSets * 100)}%`,
                      backgroundColor: p.part === pattern[0].part ? ACCENT : '#3a3a3e',
                    }]} />
                  </View>
                  <Text style={s.patVal}>{p.sessionCount}회 · {p.setCount}세트</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 종목별 진행도 */}
        {exerciseGoals.length > 0 && (
          <>
            <SectionHeader title="종목별 진행도" right="증량 준비순 ↓" />
            {exerciseGoals.map(g => <GoalCard key={g.id} goal={g} />)}
          </>
        )}

        {exerciseGoals.length === 0 && pattern.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyT}>종목을 선택하면{'\n'}진행도가 여기 보여요.</Text>
          </View>
        )}

        {/* 다음 운동 */}
        {nextPart && (
          <>
            <SectionHeader title="다음 운동" />
            <Pressable style={s.nextCard} onPress={() => router.navigate('/workout')}>
              <View style={s.nextIco}><Text style={{ fontSize: 22 }}>{partEmoji(nextPart.part)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.nextTitle}>{korPart(nextPart.part)} 차례예요</Text>
                <Text style={s.nextSub}>이번 주 {nextPart.setCount}세트 · 가장 적게 한 부위</Text>
              </View>
              <Text style={s.nextArrow}>›</Text>
            </Pressable>
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

  const progress = (() => {
    if (ready || hold) return 1;
    return 0.6; // server-computed in future; placeholder
  })();

  return (
    <View style={[s.pcard, ready && s.pcardReady]}>
      <View style={s.pcardTop}>
        <View>
          <Text style={s.pcardName}>{goal.exerciseName ?? '—'}</Text>
          <Text style={s.pcardType}>{ruleLabel(goal.ruleType)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.pcardFrom}>{fromLabel}</Text>
          <Text style={[s.pcardNext, hold && { color: SEM.muted }]}>
            → {goal.nextTarget ?? '—'}
          </Text>
        </View>
      </View>
      <View style={s.pcardBar}>
        <View style={[s.pcardFill, {
          width: `${Math.round(progress * 100)}%`,
          backgroundColor: ready ? SEM.good : ACCENT,
        }]} />
      </View>
      {ready && (
        <View style={s.readyTag}>
          <View style={[s.readyDot, { backgroundColor: SEM.good }]} />
          <Text style={[s.readyT, { color: SEM.good }]}>증량 준비됨</Text>
        </View>
      )}
      {!ready && !hold && (
        <Text style={s.pcardCond}>
          {condText(goal)}
        </Text>
      )}
    </View>
  );
}

function condText(g: ExerciseGoalDto): string {
  if (g.ruleType === 'barbell_main') {
    return `목표 ${g.targetReps ?? '—'}회 ${g.targetSets ?? '—'}세트 달성 시 증량`;
  }
  if (g.ruleType === 'machine_cable') {
    return `반복 범위 ${g.repRangeMin ?? '—'}–${g.repRangeMax ?? '—'}회 채우는 중`;
  }
  if (g.ruleType === 'bodyweight') {
    return `총 반복수 늘리는 중`;
  }
  return '반복 범위 유지';
}

function ruleLabel(rt: string): string {
  const map: Record<string, string> = {
    barbell_main: '바벨 메인', machine_cable: '머신 / 케이블',
    bodyweight: '맨몸', isolation: '고립',
  };
  return map[rt] ?? rt;
}

function partEmoji(part: string): string {
  const map: Record<string, string> = {
    Chest: '🫁', Back: '🔙', Shoulder: '🏋️', Legs: '🦵',
    Arms: '💪', Core: '🧘', Cardio: '🏃',
  };
  return map[part] ?? '🏋️';
}

function weekdayLabel() {
  const d = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return d[new Date().getDay()];
}

function totalSessions(pattern: PartSummaryDto[]) {
  if (pattern.length === 0) return 0;
  return Math.max(...pattern.map(p => p.sessionCount));
}

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={s.secH}>
      <Text style={s.secHT}>{title}</Text>
      {right && <Text style={s.secHR}>{right}</Text>}
    </View>
  );
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
  body: { padding: 20, paddingBottom: 90 },

  greet: { fontSize: 13, color: SEM.muted, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginBottom: 22 },

  secH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 26, marginBottom: 13 },
  secHT: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  secHR: { fontSize: 12.5, color: SEM.muted },

  patCard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 6 },
  patRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9,
    borderTopWidth: 0 },
  patName: { fontSize: 13.5, fontWeight: '700', width: 36, color: '#fff' },
  patTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: SEM.surface2, overflow: 'hidden' },
  patFill: { height: '100%', borderRadius: 4 },
  patVal: { fontSize: 12, color: SEM.muted, width: 84, textAlign: 'right' },

  pcard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 16, marginBottom: 11 },
  pcardReady: { borderColor: 'rgba(43,217,106,0.4)' },
  pcardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pcardName: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  pcardType: { fontSize: 11, fontWeight: '700', color: '#555', marginTop: 3 },
  pcardFrom: { fontSize: 13, color: SEM.muted, fontWeight: '600' },
  pcardNext: { fontSize: 17, fontWeight: '800', color: SEM.good },
  pcardBar: { height: 7, borderRadius: 4, backgroundColor: SEM.surface2, marginVertical: 13, overflow: 'hidden' },
  pcardFill: { height: '100%', borderRadius: 4 },
  pcardCond: { fontSize: 12, color: SEM.muted },
  readyTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readyDot: { width: 6, height: 6, borderRadius: 3 },
  readyT: { fontSize: 11, fontWeight: '800' },

  nextCard: { backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  nextIco: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(255,59,48,0.14)',
    alignItems: 'center', justifyContent: 'center' },
  nextTitle: { fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3, color: '#fff' },
  nextSub: { fontSize: 12.5, color: SEM.muted, marginTop: 3 },
  nextArrow: { marginLeft: 'auto', color: ACCENT, fontSize: 20, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyT: { color: SEM.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  setupCta: { marginTop: 20, height: 52, borderRadius: 14, backgroundColor: ACCENT,
    alignItems: 'center', justifyContent: 'center' },
  setupCtaT: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
