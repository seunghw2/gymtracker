import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getWeeklySummary,
  getWeeklyProgression,
  getExerciseGoals,
  type WeeklySummaryDto,
  type WeeklyProgressionDto,
  type ExerciseGoalDto,
} from '../../db/api/overload';
import { RT, toneColor } from './theme';
import { Ring, BandRow, Card } from './charts';

// 이번 주 리포트 = 결정론(엔진/통계) 단일 소스. LLM 브리핑 없음(§0-2, §15).
// 정체는 엔진 stalling(weeklyProgression.stallReview) 한 곳만 사용 — 홈·시트·리포트 동일.

type ReportData = {
  summary: WeeklySummaryDto | null;
  progression: WeeklyProgressionDto | null;
  goals: ExerciseGoalDto[];
};

/** 부위 세트 권장밴드 상태 — 홈/리포트 공통 기준. */
function bandStatus(current: number, target: number): string {
  if (target <= 0) return 'ok';
  if (current < target * 0.6) return 'low';
  if (current > target * 1.6) return 'over';
  return 'ok';
}

/** 리포트 화면 본문. showBack=true면 상세(뒤로가기), false면 탭 진입(뒤로가기 없음). */
export function ReportScreen({ showBack = true }: { showBack?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [summary, progression, goals] = await Promise.all([
      getWeeklySummary().catch(() => null),
      getWeeklyProgression().catch(() => null),
      getExerciseGoals().catch(() => [] as ExerciseGoalDto[]),
    ]);
    setData({ summary, progression, goals });
  }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {showBack
          ? <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
          : <View style={{ width: 24 }} />}
        <Text style={styles.title}>이번 주 리포트</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RT.action} />}
      >
        {loading && !data ? (
          <View style={styles.center}><ActivityIndicator color={RT.action} size="large" /><Text style={styles.dim}>로딩 중…</Text></View>
        ) : (
          <ReportBody data={data} onGoWorkout={() => router.replace('/workout')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportBody({ data, onGoWorkout }: { data: ReportData | null; onGoWorkout: () => void }) {
  const summary = data?.summary ?? null;
  const prog = data?.progression ?? null;
  const goals = data?.goals ?? [];

  const att = summary?.attendance;
  const volumes = summary?.bodyPartVolumes ?? [];

  const actions = prog?.nextActions ?? [];
  const improved = prog?.repImproved ?? [];
  const ready = prog?.readyToIncrease ?? [];
  const baseline = prog?.baselineCreated ?? [];
  const stall = prog?.stallReview ?? [];

  // 추적 중인 종목이 없으면(온보딩 직후 등) 빈 상태
  const hasAnything =
    !!att || volumes.length > 0 || actions.length > 0 ||
    improved.length > 0 || ready.length > 0 || baseline.length > 0 || stall.length > 0 || goals.length > 0;

  if (!hasAnything) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>📭</Text>
        <Text style={styles.emptyTitle}>아직 보여줄 게 없어요</Text>
        <Text style={styles.dim}>운동을 기록하면 이번 주 진행 상황이 여기에 정리돼요.</Text>
        <Pressable style={styles.cta} onPress={onGoWorkout}><Text style={styles.ctaText}>운동하러 가기</Text></Pressable>
      </View>
    );
  }

  const attPct = att && att.target > 0 ? Math.round((att.done / att.target) * 100) : 0;
  const attTone = !att ? 'good' : att.done >= att.target ? 'good' : attPct >= 60 ? 'warn' : 'bad';

  return (
    <View>
      {/* ── 다음 주 액션 — 가장 크게(다음 행동 연결) ── */}
      <View style={styles.actionCard}>
        <Text style={styles.actionEyebrow}>다음 주 액션</Text>
        {actions.length > 0 ? (
          actions.slice(0, 3).map((a, i) => (
            <View key={i} style={styles.actionRow}>
              <View style={styles.actionNum}><Text style={styles.actionNumT}>{i + 1}</Text></View>
              <Text style={styles.actionText}>{a}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.actionEmpty}>이번 주 흐름 좋아요 — 같은 루틴을 한 번 더 쌓아봐요.</Text>
        )}
        <Pressable style={styles.actionCta} onPress={onGoWorkout}>
          <Text style={styles.actionCtaT}>오늘 운동 시작하기 ›</Text>
        </Pressable>
      </View>

      {/* ── 핵심 종목 변화(엔진 stage·evaluate) ── */}
      {(baseline.length > 0 || improved.length > 0 || ready.length > 0) && (
        <Card title="핵심 종목 변화" caption="이번 주 점진적 과부하 단계">
          <ChangeRow label="증량 준비" items={ready} tone="good" badge="↑" />
          <ChangeRow label="반복수 개선" items={improved} tone="good" badge="＋" />
          <ChangeRow label="기준 생성" items={baseline} tone="info" badge="●" />
        </Card>
      )}

      {/* ── 정체 점검 종목(엔진 stalling 단일 소스) ── */}
      {stall.length > 0 && (
        <Card title="정체 점검" caption="막혔을 때 — 같은 조건 한 번 더 기록부터" chip={{ tone: 'warn', label: `${stall.length}건` }}>
          {stall.map((name, i) => (
            <View key={i} style={styles.stallRow}>
              <View style={[styles.dot, { backgroundColor: RT.warn }]} />
              <Text style={styles.stallName}>{name}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* ── 이번 주 출석 ── */}
      {att && (
        <Card title="이번 주 출석" chip={att.done >= att.target ? { tone: 'good', label: '달성' } : { tone: attTone, label: '진행 중' }}>
          <View style={styles.ringRow}>
            <Ring pct={attPct} label="출석" tone={attTone} />
            <View style={styles.attMeta}>
              <Text style={styles.attBig}>{att.done}<Text style={styles.attUnit}> / {att.target}회</Text></Text>
              <Text style={styles.attSub}>
                {att.done >= att.target
                  ? '이번 주 목표를 채웠어요 💪'
                  : `목표까지 ${Math.max(0, att.target - att.done)}회 남았어요`}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* ── 목표 부위 주간 세트 ── */}
      {volumes.length > 0 && (
        <Card title="목표 부위 주간 세트" caption="권장 세트 대비 이번 주 진행">
          {volumes.map((v, i) => (
            <BandRow key={i} part={v.korPart} sets={v.currentSets} max={Math.max(v.targetSets * 1.6, 20)} status={bandStatus(v.currentSets, v.targetSets)} />
          ))}
          <Text style={styles.bandHint}>초록 구간이 권장 범위예요</Text>
        </Card>
      )}
    </View>
  );
}

/** 핵심 종목 변화 한 줄(빈 항목이면 숨김). */
function ChangeRow({ label, items, tone, badge }: { label: string; items: string[]; tone: string; badge: string }) {
  if (items.length === 0) return null;
  const color = tone === 'info' ? '#5AB0FF' : toneColor(tone);
  return (
    <View style={styles.changeRow}>
      <Text style={[styles.changeLabel, { color }]}>{badge} {label}</Text>
      {items.map((it, i) => <Text key={i} style={styles.changeItem}>{it}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RT.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: RT.hair },
  back: { color: RT.action, fontSize: 30, width: 24, marginTop: -4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },

  body: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  dim: { color: RT.ink2, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cta: { marginTop: 20, backgroundColor: RT.action, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 28 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // 다음 주 액션(히어로)
  actionCard: { backgroundColor: RT.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: RT.hair, marginBottom: 14 },
  actionEyebrow: { color: RT.action, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  actionNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: RT.action, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  actionNumT: { color: '#fff', fontSize: 13, fontWeight: '800' },
  actionText: { flex: 1, color: RT.ink, fontSize: 16, fontWeight: '700', lineHeight: 23, letterSpacing: -0.2 },
  actionEmpty: { color: RT.ink, fontSize: 15.5, fontWeight: '700', lineHeight: 23, marginBottom: 10 },
  actionCta: { marginTop: 2, backgroundColor: RT.action, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  actionCtaT: { color: '#fff', fontSize: 14.5, fontWeight: '800' },

  // 핵심 종목 변화
  changeRow: { marginBottom: 12 },
  changeLabel: { fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  changeItem: { color: RT.ink2, fontSize: 14, lineHeight: 21 },

  // 정체
  stallRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stallName: { color: RT.ink, fontSize: 14.5, fontWeight: '600' },

  // 출석
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  attMeta: { flex: 1 },
  attBig: { color: RT.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  attUnit: { color: RT.ink2, fontSize: 15, fontWeight: '700' },
  attSub: { color: RT.ink2, fontSize: 13, marginTop: 6, lineHeight: 19 },

  // 부위 세트
  bandHint: { color: RT.ink3, fontSize: 11, marginTop: 6 },
});
