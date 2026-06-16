import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AI } from '../../constants/colors';
import { getReportV2, AiReportV2Response, ReportPeriodType } from '../../db/queries';
import ReportView from '../../components/ReportView';

const PERIODS: { t: ReportPeriodType; label: string }[] = [
  { t: 'week', label: '지난주' },
  { t: 'month', label: '지난달' },
  { t: 'quarter', label: '3개월' },
  { t: 'half', label: '6개월' },
  { t: 'year', label: '1년' },
];

export default function AiReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; back?: string }>();
  const initType = (params.type as ReportPeriodType) ?? 'week';
  const initBack = Number(params.back ?? 0);
  const [period, setPeriod] = useState<ReportPeriodType>(initType);
  const [back, setBack] = useState<number>(initBack);
  const [res, setRes] = useState<AiReportV2Response | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((t: ReportPeriodType, b: number, force = false) => {
    setLoading(true);
    getReportV2(t, b, force)
      .then(setRes)
      .catch(() => setRes({ status: 'FAILED', message: '네트워크 오류로 불러오지 못했어요.', report: null }))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(period, back); }, [period, back, load]));

  const pick = (t: ReportPeriodType) => { setBack(0); setPeriod(t); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>리포트</Text>
        <Pressable onPress={() => router.push('/ai/archive')} hitSlop={8}><Text style={styles.archive}>📚</Text></Pressable>
      </View>

      {period !== 'session' && back === 0 && (
        <View style={styles.segWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seg}>
            {PERIODS.map(p => (
              <Pressable key={p.t} style={[styles.chip, period === p.t && styles.chipOn]} onPress={() => pick(p.t)}>
                <Text style={[styles.chipText, period === p.t && styles.chipTextOn]}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={AI.accent} size="large" /><Text style={styles.dim}>분석 중…</Text></View>
        ) : res?.status === 'SUCCESS' && res.report ? (
          <>
            {res.report.period.nextReportEtaDays != null && (
              <View style={styles.eta}><Text style={styles.etaText}>🔓 {res.report.period.label} 리포트 · 다음까지 D-{res.report.period.nextReportEtaDays}</Text></View>
            )}
            <ReportView r={res.report} onAsk={() => router.push({ pathname: '/ai/chat', params: { reportId: res.report!.id, period } })} />
          </>
        ) : res?.status === 'PROFILE_REQUIRED' ? (
          <Empty icon="🎯" title="먼저 목표를 알려주세요" desc={res.message ?? '목표 체형·우선 부위를 설정하면 분석을 시작해요.'} cta="설정하기" onPress={() => router.push('/ai/intake')} />
        ) : res?.status === 'INSUFFICIENT_DATA' ? (
          <Empty icon="📭" title="이 기간 기록이 없어요" desc={res.message ?? '완료된 운동이 있어야 분석할 수 있어요.'} cta="운동하러 가기" onPress={() => router.replace('/(tabs)/workout')} />
        ) : (
          <Empty icon="⚠️" title="리포트를 불러오지 못했어요" desc={res?.message ?? '잠시 후 다시 시도해 주세요.'} cta="다시 시도" onPress={() => load(period, back, true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty({ icon, title, desc, cta, onPress }: { icon: string; title: string; desc: string; cta: string; onPress: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.dim}>{desc}</Text>
      <Pressable style={styles.cta} onPress={onPress}><Text style={styles.ctaText}>{cta}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 30, width: 24, marginTop: -4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  archive: { fontSize: 18 },

  segWrap: { borderBottomWidth: 1, borderBottomColor: AI.line },
  seg: { gap: 7, paddingHorizontal: 14, paddingVertical: 10 },
  chip: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: AI.card, borderWidth: 1, borderColor: AI.line },
  chipOn: { backgroundColor: AI.accent, borderColor: AI.accent },
  chipText: { color: AI.textSub, fontSize: 12.5, fontWeight: '700' },
  chipTextOn: { color: AI.ink },

  body: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  dim: { color: AI.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cta: { marginTop: 20, backgroundColor: AI.accent, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 28 },
  ctaText: { color: AI.ink, fontSize: 15, fontWeight: '800' },

  eta: { backgroundColor: AI.card, borderRadius: 8, padding: 9, marginBottom: 12 },
  etaText: { color: AI.textSub, fontSize: 11.5 },
});
