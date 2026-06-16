import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, SafeAreaView, Modal, AccessibilityInfo } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AI, COLORS } from '../../constants/colors';
import { getReportV2, getAllWorkoutDates, AiReportV2Response } from '../../db/queries';
import { PERIOD_UNITS, PeriodUnit, buildBuckets, earliestDate } from '../../lib/periods';
import ReportTabs from '../../components/report/ReportTabs';
import BriefingLoading from '../../components/BriefingLoading';

const GREEN = COLORS.green;
const UNIT_NOUN: Record<PeriodUnit, string> = { week: '주', month: '월', quarter: '분기', half: '반기' };

export default function AiReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const initUnit = PERIOD_UNITS.find(u => u.type === params.type)?.unit ?? 'week';

  const [unit, setUnit] = useState<PeriodUnit>(initUnit);
  const [index, setIndex] = useState(0);
  const [firstISO, setFirstISO] = useState<string | null>(null);
  const [datesLoaded, setDatesLoaded] = useState(false);
  const [res, setRes] = useState<AiReportV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    getAllWorkoutDates()
      .then(ds => setFirstISO(earliestDate(ds)))
      .catch(() => setFirstISO(null))
      .finally(() => setDatesLoaded(true));
  }, []);

  // 단위별 기간 버킷(최신이 맨 앞). 최초 기록일~현재.
  const buckets = useMemo(() => buildBuckets(unit, firstISO), [unit, firstISO]);
  const safeIndex = Math.min(index, Math.max(0, buckets.length - 1));
  const selected = buckets[safeIndex];
  const unitType = PERIOD_UNITS.find(u => u.unit === unit)!.type;

  const load = useCallback((force = false) => {
    if (!selected) return;
    setLoading(true);
    getReportV2(unitType, 0, force, { from: selected.start, to: selected.end, label: selected.label })
      .then(setRes)
      .catch(() => setRes({ status: 'FAILED', message: '네트워크 오류로 불러오지 못했어요.', report: null }))
      .finally(() => setLoading(false));
  }, [unitType, selected?.start, selected?.end, selected?.label]);

  useFocusEffect(useCallback(() => {
    if (datesLoaded && selected) load(false);
  }, [datesLoaded, selected?.start, selected?.end, load]));

  // 생성 중이면 2초 폴링(스피너 토글 없이 res만 갱신) → 완료 시 자동 교체
  useEffect(() => {
    if (res?.status !== 'GENERATING' || !selected) return;
    const id = setTimeout(() => {
      getReportV2(unitType, 0, false, { from: selected.start, to: selected.end, label: selected.label })
        .then(setRes).catch(() => {});
    }, 2000);
    return () => clearTimeout(id);
  }, [res, selected?.start, selected?.end, unitType]);

  const pickUnit = (u: PeriodUnit) => { setUnit(u); setIndex(0); };
  const pickIndex = (i: number) => { setIndex(i); setSheetOpen(false); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>리포트</Text>
        <Pressable
          onPress={() => load(true)}
          hitSlop={8}
          disabled={loading || res?.status === 'GENERATING'}
          accessibilityLabel="리포트 다시 받기"
        >
          <Text style={[styles.regen, (loading || res?.status === 'GENERATING') && { opacity: 0.4 }]}>↻ 다시 받기</Text>
        </Pressable>
      </View>

      {/* 단위 세그먼트 */}
      <View style={styles.segRow}>
        {PERIOD_UNITS.map(u => {
          const on = unit === u.unit;
          return (
            <Pressable key={u.unit} style={[styles.segItem, on && styles.segItemOn]} onPress={() => pickUnit(u.unit)}>
              <Text style={[styles.segText, on && styles.segTextOn]}>{u.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 좌측 고정 📅 + 우측 가로 스크롤 칩 */}
      <View style={styles.navRow}>
        <Pressable style={styles.calBtn} onPress={() => setSheetOpen(true)} hitSlop={6} accessibilityLabel={`${UNIT_NOUN[unit]} 선택`}>
          <Text style={styles.calIcon}>📅</Text>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {buckets.map((b, i) => {
            const on = i === safeIndex;
            return (
              <Pressable key={b.start} style={[styles.chip, on && styles.chipOn]} onPress={() => setIndex(i)}>
                <Text style={[styles.chipMain, on && styles.chipMainOn]}>{b.label}</Text>
                <Text style={[styles.chipSub, on && styles.chipSubOn]}>{b.isCurrent ? '진행 중' : b.sublabel}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {res?.status === 'GENERATING' ? (
          <BriefingLoading percent={res.percent} step={res.step} />
        ) : loading ? (
          <View style={styles.center}><ActivityIndicator color={AI.accent} size="large" /><Text style={styles.dim}>분석 중…</Text></View>
        ) : res?.status === 'SUCCESS' && res.report ? (
          <>
            {res.report.period.nextReportEtaDays != null && (
              <View style={styles.eta}><Text style={styles.etaText}>🔓 {res.report.period.label} · 진행 중 (D-{res.report.period.nextReportEtaDays})</Text></View>
            )}
            <ReportTabs r={res.report} onReload={() => load(false)} onAsk={() => router.push({ pathname: '/ai/chat', params: { reportId: res.report!.id, period: unitType } })} />
          </>
        ) : res?.status === 'PROFILE_REQUIRED' ? (
          <Empty icon="🎯" title="먼저 목표를 알려주세요" desc={res.message ?? '목표 체형·우선 부위를 설정하면 분석을 시작해요.'} cta="설정하기" onPress={() => router.push('/ai/intake')} />
        ) : res?.status === 'INSUFFICIENT_DATA' ? (
          <Empty icon="📭" title="이 기간 기록이 없어요" desc={res.message ?? '완료된 운동이 있어야 분석할 수 있어요.'} cta="운동하러 가기" onPress={() => router.replace('/workout')} />
        ) : (
          <Empty icon="⚠️" title="리포트를 불러오지 못했어요" desc={res?.message ?? '잠시 후 다시 시도해 주세요.'} cta="다시 시도" onPress={() => load(true)} />
        )}
      </ScrollView>

      {/* 바텀시트 — 임의 기간 점프 */}
      <Modal visible={sheetOpen} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.grip} />
          <Text style={styles.sheetTitle}>{UNIT_NOUN[unit]} 선택</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {buckets.map((b, i) => {
              const on = i === safeIndex;
              return (
                <Pressable key={b.start} style={styles.sheetRow} onPress={() => pickIndex(i)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetLabel}>{b.label}{b.isCurrent ? '  · 진행 중' : ''}</Text>
                    <Text style={styles.sheetSub}>{b.sublabel}</Text>
                  </View>
                  {on && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
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
  regen: { color: AI.accent, fontSize: 12.5, fontWeight: '700' },

  // 단위 세그먼트
  segRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: AI.card, alignItems: 'center' },
  segItemOn: { backgroundColor: GREEN },
  segText: { color: AI.textSub, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: COLORS.greenInk, fontWeight: '800' },

  // 📅 + 칩 한 줄
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  calBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: AI.card, alignItems: 'center', justifyContent: 'center' },
  calIcon: { fontSize: 19 },
  chips: { gap: 7, paddingRight: 14, alignItems: 'stretch' },
  chip: { borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: AI.card, borderWidth: 1, borderColor: AI.line, justifyContent: 'center', minWidth: 72 },
  chipOn: { backgroundColor: GREEN, borderColor: GREEN },
  chipMain: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  chipMainOn: { color: COLORS.greenInk },
  chipSub: { color: AI.textSub, fontSize: 10.5, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  chipSubOn: { color: COLORS.greenInk, opacity: 0.75 },

  body: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  dim: { color: AI.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cta: { marginTop: 20, backgroundColor: AI.accent, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 28 },
  ctaText: { color: AI.ink, fontSize: 15, fontWeight: '800' },

  eta: { backgroundColor: AI.card, borderRadius: 8, padding: 9, marginBottom: 12 },
  etaText: { color: AI.textSub, fontSize: 11.5 },

  // 바텀시트
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#161618', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 36 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', marginTop: 10, marginBottom: 12 },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: AI.line },
  sheetLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetSub: { color: AI.textSub, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  check: { color: GREEN, fontSize: 18, fontWeight: '800', marginLeft: 12 },
});
