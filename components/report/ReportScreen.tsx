import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReportV2, getAllWorkoutDates, getSetting, AiReportV2Response } from '../../db/queries';
import { PERIOD_UNITS, PeriodUnit, buildBuckets, earliestDate } from '../../lib/periods';
import ReportTabs from '../../components/report/ReportTabs';
import BriefingLoading from '../../components/BriefingLoading';
import { RT } from '../../components/report/theme';

// 기간탭·주차칩·선택체크 = 네비/액션 → 레드 액센트(상태색 아님).
const GREEN = RT.action;
const GREEN_INK = '#FFFFFF';
const UNIT_NOUN: Record<PeriodUnit, string> = { week: '주', month: '월' };

// 성공 리포트 캐시 — 한 번 본 기간은 재방문 시 스피너 없이 즉시 표시.
// 메모리 + AsyncStorage 영속(앱을 껐다 켜도 마지막 본 리포트가 바로 뜸). 최근 16개로 제한.
const reportCache = new Map<string, AiReportV2Response>();
const CACHE_KEY = 'ai_report_cache_v1';
const CACHE_MAX = 16;
const FIRST_KEY = 'ai_first_workout_iso';   // 첫 기록일(기간 버킷 계산용) — 콜드 스타트 시 네트워크 대기 제거

function persistCache() {
  try {
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(reportCache))).catch(() => {});
  } catch { /* ignore */ }
}
/** 성공 리포트만 캐시에 저장(+영속). 최근순 유지. */
function cacheSet(key: string, r: AiReportV2Response) {
  if (r.status !== 'SUCCESS') return;
  reportCache.delete(key);
  reportCache.set(key, r);
  while (reportCache.size > CACHE_MAX) reportCache.delete(reportCache.keys().next().value as string);
  persistCache();
}
async function hydrateCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, AiReportV2Response>;
    for (const [k, v] of Object.entries(obj)) reportCache.set(k, v);
  } catch { /* ignore */ }
}

/** 리포트 화면 본문. showBack=true면 상세(뒤로가기), false면 탭 진입(뒤로가기 없음). */
export function ReportScreen({ showBack = true }: { showBack?: boolean }) {
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
  const [tonePref, setTonePref] = useState<string | null>(null);
  const latestKey = useRef('');

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    (async () => {
      await hydrateCache();   // 영속 캐시 먼저 메모리에 올림 → 첫 load도 즉시
      // 첫 기록일도 로컬에서 먼저 읽어 기간 버킷을 바로 만든다(네트워크 대기 없이 캐시 리포트 즉시 표시)
      try {
        const cachedFirst = await AsyncStorage.getItem(FIRST_KEY);
        if (cachedFirst) { setFirstISO(cachedFirst); setDatesLoaded(true); }
      } catch { /* ignore */ }
      try {
        const f = earliestDate(await getAllWorkoutDates());
        setFirstISO(f);
        if (f) AsyncStorage.setItem(FIRST_KEY, f).catch(() => {});
      } catch { /* 캐시 first 있으면 그대로 사용 */ }
      setDatesLoaded(true);
    })();
  }, []);

  // 단위별 기간 버킷(최신이 맨 앞). 최초 기록일~현재.
  const buckets = useMemo(() => buildBuckets(unit, firstISO), [unit, firstISO]);
  const safeIndex = Math.min(index, Math.max(0, buckets.length - 1));
  const selected = buckets[safeIndex];
  const unitType = PERIOD_UNITS.find(u => u.unit === unit)!.type;

  const load = useCallback((force = false) => {
    if (!selected) return;
    const key = `${unitType}:${selected.start}:${selected.end}`;
    latestKey.current = key;
    const cached = reportCache.get(key);
    if (cached && !force) {
      setRes(cached);        // 캐시 즉시 표시 — 스피너 없이
      setLoading(false);
    } else {
      setLoading(true);
    }
    // 백그라운드 갱신(stale-while-revalidate)
    getReportV2(unitType, 0, force, { from: selected.start, to: selected.end, label: selected.label })
      .then(r => {
        cacheSet(key, r);
        if (latestKey.current === key) setRes(r);   // 그새 기간 바뀌었으면 무시
      })
      .catch(() => { if (latestKey.current === key && !cached) setRes({ status: 'FAILED', message: '네트워크 오류로 불러오지 못했어요.', report: null }); })
      .finally(() => { if (latestKey.current === key) setLoading(false); });
  }, [unitType, selected?.start, selected?.end, selected?.label]);

  useFocusEffect(useCallback(() => {
    getSetting('ai_coach_tone', 'plain').then(setTonePref).catch(() => {});
    if (datesLoaded && selected) load(false);
  }, [datesLoaded, selected?.start, selected?.end, load]));

  // 설정에서 톤이 바뀌면, 캐시된 리포트의 톤과 달라 → 그 기간만 1회 자동 재생성(채팅은 즉시 반영됨)
  useEffect(() => {
    if (loading) return;
    const t = res?.report?.tone;
    if (res?.status === 'SUCCESS' && t && tonePref && t !== tonePref) load(true);
  }, [res, tonePref]);

  // 생성 중이면 2초 폴링(스피너 토글 없이 res만 갱신) → 완료 시 자동 교체
  useEffect(() => {
    if (res?.status !== 'GENERATING' || !selected) return;
    const id = setTimeout(() => {
      getReportV2(unitType, 0, false, { from: selected.start, to: selected.end, label: selected.label })
        .then(r => {
          cacheSet(`${unitType}:${selected.start}:${selected.end}`, r);
          setRes(r);
        }).catch(() => {});
    }, 2000);
    return () => clearTimeout(id);
  }, [res, selected?.start, selected?.end, unitType]);

  const pickUnit = (u: PeriodUnit) => { setUnit(u); setIndex(0); };
  const pickIndex = (i: number) => { setIndex(i); setSheetOpen(false); };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {showBack
          ? <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
          : <View style={{ width: 24 }} />}
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
                <Text style={[styles.chipSub, on && styles.chipSubOn]}>{b.sublabel}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {res?.status === 'GENERATING' ? (
          <BriefingLoading percent={res.percent} step={res.step} />
        ) : loading ? (
          <View style={styles.center}><ActivityIndicator color={RT.action} size="large" /><Text style={styles.dim}>로딩 중…</Text></View>
        ) : res?.status === 'SUCCESS' && res.report ? (
          <ReportTabs r={res.report} onReload={() => load(false)} onAsk={() => router.push({ pathname: '/ai/chat', params: { reportId: res.report!.id, period: unitType } })} />
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
                    <Text style={styles.sheetLabel}>{b.label}</Text>
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
  safe: { flex: 1, backgroundColor: RT.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: RT.hair },
  back: { color: RT.action, fontSize: 30, width: 24, marginTop: -4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  regen: { color: RT.action, fontSize: 12.5, fontWeight: '700' },

  // 단위 세그먼트
  segRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: RT.surface, alignItems: 'center' },
  segItemOn: { backgroundColor: GREEN },
  segText: { color: RT.ink2, fontSize: 13, fontWeight: '700' },
  segTextOn: { color: GREEN_INK, fontWeight: '800' },

  // 📅 + 칩 한 줄
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: RT.hair },
  calBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: RT.surface, alignItems: 'center', justifyContent: 'center' },
  calIcon: { fontSize: 19 },
  chips: { gap: 7, paddingRight: 14, alignItems: 'stretch' },
  chip: { borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: RT.surface, borderWidth: 1, borderColor: RT.hair, justifyContent: 'center', minWidth: 72 },
  chipOn: { backgroundColor: GREEN, borderColor: GREEN },
  chipMain: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  chipMainOn: { color: GREEN_INK },
  chipSub: { color: RT.ink2, fontSize: 10.5, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  chipSubOn: { color: GREEN_INK, opacity: 0.75 },

  body: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  dim: { color: RT.ink2, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cta: { marginTop: 20, backgroundColor: RT.action, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 28 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  eta: { backgroundColor: RT.surface, borderRadius: 8, padding: 9, marginBottom: 12 },
  etaText: { color: RT.ink2, fontSize: 11.5 },

  // 바텀시트
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: RT.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 36 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3C', marginTop: 10, marginBottom: 12 },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: RT.hair },
  sheetLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetSub: { color: RT.ink2, fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  check: { color: GREEN, fontSize: 18, fontWeight: '800', marginLeft: 12 },
});
