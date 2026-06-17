import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView, Dimensions, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Polyline, Polygon, Circle, Rect, Line } from 'react-native-svg';
import { SEM } from '../../constants/colors';
import {
  getExerciseProgress, getTrainedExercises, ExerciseProgress, SeriesPoint,
} from '../../db/queries';
import { loadPinned, savePinned, togglePin, isPin } from '../../lib/pinnedLifts';
import { useChatStore } from '../../store/useChatStore';

type Metric = '1rm' | 'maxw' | 'vol' | 'freq';
const METRICS: [Metric, string][] = [['1rm', '1RM'], ['maxw', '최대무게'], ['vol', '볼륨'], ['freq', '빈도']];
type Period = '3m' | '6m' | '1y' | 'all';
const PERIODS: [Period, string][] = [['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['all', '전체']];
const PERIOD_DAYS: Record<Period, number> = { '3m': 90, '6m': 182, '1y': 365, all: 1e9 };

const W = Dimensions.get('window').width - 28 - 24; // 카드 안쪽 폭

/** 종목 리포트 — 큰 숫자 헤더 + 지표 토글 차트 + 코드 템플릿 코치. */
export default function ExerciseReport() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; id?: string }>();
  const name = params.name ?? '';

  const [data, setData] = useState<ExerciseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [metric, setMetric] = useState<Metric>('1rm');
  const [period, setPeriod] = useState<Period>('1y');
  const findOrCreateByKey = useChatStore(s => s.findOrCreateByKey);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        let id = params.id ? Number(params.id) : undefined;
        if (!id) id = (await getTrainedExercises()).find(e => e.name === name)?.id;
        if (id) {
          const d = await getExerciseProgress(id);
          if (on) setData(d);
        }
      } catch { /* keep null */ }
      finally { if (on) setLoading(false); }
    })();
    loadPinned().then(p => on && setPinned(p)).catch(() => {});
    return () => { on = false; };
  }, [name, params.id]);

  const fav = isPin(name, pinned);
  const toggleFav = () => {
    const next = togglePin(name, pinned);
    setPinned(next);
    savePinned(next).catch(() => {});
  };

  const goChat = async (seed?: string) => {
    const conv = await findOrCreateByKey({ source: 'alert', sourceKey: `stall:${name}`, title: `${name} 정체` });
    if (conv) router.push({ pathname: '/chat/[conversationId]', params: { conversationId: String(conv.id), title: conv.title, ...(seed ? { seed } : {}) } });
  };

  const coach = useMemo(() => data && buildCoach(data, name), [data, name]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hd}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={s.back}>‹</Text></Pressable>
        <Text style={s.hdTitle} numberOfLines={1}>{name}</Text>
        <Pressable onPress={toggleFav} hitSlop={8}><Text style={[s.hdStar, { color: fav ? '#FFD60A' : '#3a3a3e' }]}>{fav ? '★' : '☆'}</Text></Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={SEM.brand} /></View>
      ) : !data || data.e1rm.length === 0 ? (
        <View style={s.center}><Text style={s.emptyT}>아직 기록이 충분하지 않아요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {/* 히어로 */}
          <View style={s.hero}>
            <Text style={s.hcat}>{data.bodyPart}{data.bodyPart ? ' · ' : ''}{name}</Text>
            <View style={s.hbig}>
              <Text style={s.hv}>{data.currentE1rm ?? '–'}</Text>
              <Text style={s.hu}>kg · 추정 1RM</Text>
            </View>
            <View style={s.hbadges}>
              {data.prE1rm != null && <Text style={[s.rb, s.rbPr]}>★ PR {data.prE1rm}</Text>}
              {data.trend === 'flat' && data.plateauWeeks > 0 && <Text style={[s.rb, s.rbFlat]}>▬ {data.plateauWeeks}주째 정체</Text>}
              {data.trend !== 'flat' && data.prDate === lastDate(data.e1rm) && <Text style={[s.rb, s.rbPr]}>▲ 최근 신기록</Text>}
            </View>
          </View>
          {coach && <Text style={s.hline}>{coach.headline}</Text>}

          {/* 차트 카드 */}
          <View style={s.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mtog}>
              {METRICS.map(([k, lbl]) => (
                <Pressable key={k} onPress={() => setMetric(k)} style={[s.mt, metric === k && (isLine(k) ? s.mtOn : s.mtOnB)]}>
                  <Text style={[s.mtT, metric === k && s.mtTOn]}>{lbl}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {isLine(metric) && (
              <View style={s.periodRow}>
                {PERIODS.map(([k, lbl]) => (
                  <Pressable key={k} onPress={() => setPeriod(k)} style={[s.pc, period === k && s.pcOn]}>
                    <Text style={[s.pcT, period === k && s.pcTOn]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <ChartArea data={data} metric={metric} period={period} />
          </View>

          {/* 코치 */}
          <Text style={s.secttl}>🤖 AI 코치</Text>
          {coach && (
            <View style={s.dig}>
              <View style={s.dh}><View style={s.da}><Text style={{ fontSize: 13 }}>🤖</Text></View><Text style={s.dn}>{name}은 이렇게 봤어</Text></View>
              <CoachRow tag="진단" tagBg="rgba(255,138,0,0.18)" tagColor={SEM.bad} x={coach.dx} />
              <CoachRow tag="처방" tagBg="rgba(43,217,106,0.18)" tagColor={SEM.good} x={coach.rx} />
              <CoachRow tag="동기" tagBg="rgba(155,123,214,0.18)" tagColor="#c3a8e8" x={coach.mt} />
            </View>
          )}
          <Pressable style={s.cta} onPress={() => goChat()}><Text style={s.ctaT}>💬 대화로 풀기</Text></Pressable>
          <View style={s.chips}>
            {['왜 멈췄어?', '리셋 방법', '대체 운동'].map(c => (
              <Pressable key={c} style={s.chip} onPress={() => goChat(`${name} ${c}`)}><Text style={s.chipT}>{c}</Text></Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const isLine = (m: Metric) => m === '1rm' || m === 'maxw';
const lastDate = (pts: SeriesPoint[]) => (pts.length ? pts[pts.length - 1].date : null);

function CoachRow({ tag, tagBg, tagColor, x }: { tag: string; tagBg: string; tagColor: string; x: string }) {
  return (
    <View style={s.dr}>
      <Text style={[s.tg, { backgroundColor: tagBg, color: tagColor }]}>{tag}</Text>
      <Text style={s.drx}>{x}</Text>
    </View>
  );
}

// ── 차트 ─────────────────────────────────────────────────
const CH = 150;

function ChartArea({ data, metric, period }: { data: ExerciseProgress; metric: Metric; period: Period }) {
  if (metric === '1rm' || metric === 'maxw') {
    const all = metric === '1rm' ? data.e1rm : data.maxWeight;
    const cut = Date.now() - PERIOD_DAYS[period] * 86400000;
    const pts = period === 'all' ? all : all.filter(p => new Date(p.date).getTime() >= cut);
    const unit = metric === '1rm' ? '추정 1RM' : '최대 수행 무게';
    return <LineChart pts={pts.length >= 2 ? pts : all} unit={`kg · ${unit}`}
      prDate={metric === '1rm' ? data.prDate : null} plateauWeeks={metric === '1rm' ? data.plateauWeeks : 0} />;
  }
  const pts = (metric === 'vol' ? data.weeklyVolume : data.weeklyFreq).slice(-12);
  return <BarChart pts={pts} unit={metric === 'vol' ? '주간 볼륨' : '주 운동 횟수'} isVol={metric === 'vol'} />;
}

function LineChart({ pts, unit, prDate, plateauWeeks }: { pts: SeriesPoint[]; unit: string; prDate: string | null; plateauWeeks: number }) {
  if (pts.length < 2) return <Empty />;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * W);
  const vals = pts.map(p => p.value);
  const max = Math.max(...vals), min = Math.min(...vals);
  const range = max - min || 1;
  const y = (v: number) => 8 + (1 - (v - min) / range) * (CH - 20);
  const poly = pts.map((p, i) => `${xs[i].toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${poly} ${W},${CH} 0,${CH}`;
  const prIdx = prDate ? pts.findIndex(p => p.date === prDate) : -1;
  // 정체 음영: PR 이후 구간
  const showPlateau = plateauWeeks >= 4 && prIdx >= 0 && prIdx < pts.length - 1;

  return (
    <>
      <View style={s.clabel}><Text style={s.clT}>kg</Text><Text style={s.clT}>{unit}</Text></View>
      <Svg width={W} height={CH}>
        {showPlateau && <Rect x={xs[prIdx]} y={0} width={W - xs[prIdx]} height={CH - 6} fill="rgba(255,138,0,0.12)" />}
        {showPlateau && <Line x1={xs[prIdx]} y1={0} x2={xs[prIdx]} y2={CH - 6} stroke="rgba(255,138,0,0.4)" strokeWidth={1} strokeDasharray="3 3" />}
        <Polygon points={area} fill="rgba(43,217,106,0.10)" />
        <Polyline points={poly} fill="none" stroke={SEM.good} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {prIdx >= 0 && <Circle cx={xs[prIdx]} cy={y(pts[prIdx].value)} r={4.5} fill="#FFC53D" stroke="#000" strokeWidth={1.5} />}
      </Svg>
      <View style={s.legend}>
        <Legend color={SEM.good} label={unit.split('·').pop()?.trim() ?? ''} />
        {showPlateau && <Legend color="rgba(255,138,0,0.5)" label="정체 구간" />}
        <Legend color="#FFC53D" label="PR" />
      </View>
    </>
  );
}

function BarChart({ pts, unit, isVol }: { pts: SeriesPoint[]; unit: string; isVol: boolean }) {
  if (pts.length < 1) return <Empty />;
  const max = Math.max(...pts.map(p => p.value)) || 1;
  const last = pts[pts.length - 1];
  const drop = pts.length >= 2 && last.value < pts[pts.length - 2].value;
  return (
    <>
      <View style={s.clabel}><Text style={s.clT}>{isVol ? 't' : '회'}</Text><Text style={s.clT}>{unit} · {pts.length}주</Text></View>
      <View style={s.barrow}>
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1;
          return <View key={i} style={{ flex: 1, height: Math.max(3, (p.value / max) * 92), borderRadius: 3, backgroundColor: isLast && drop ? SEM.bad : '#26262e' }} />;
        })}
      </View>
      <View style={s.legend}>
        <Text style={[s.legT, drop && { color: SEM.bad }]}>
          이번 주 {isVol ? `${(last.value / 1000).toFixed(1)}t` : `${last.value}회`}{drop ? ' · 직전보다 감소' : ''}
        </Text>
      </View>
    </>
  );
}

const Empty = () => <View style={[s.barrow, { alignItems: 'center', justifyContent: 'center' }]}><Text style={s.clT}>데이터가 부족해요</Text></View>;
const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={s.lg}><View style={[s.lgDot, { backgroundColor: color }]} /><Text style={s.legT}>{label}</Text></View>
);

// ── 코드 템플릿 코치 ─────────────────────────────────────
function buildCoach(d: ExerciseProgress, name: string) {
  const cur = d.currentE1rm ?? 0;
  const pr = d.prE1rm ?? cur;
  const wk = d.plateauWeeks;
  const volDrop = d.weeklyVolume.length >= 2 && d.weeklyVolume[d.weeklyVolume.length - 1].value < d.weeklyVolume[d.weeklyVolume.length - 2].value;

  if (d.trend === 'flat') {
    const reset = Math.round(cur * 0.88 / 2.5) * 2.5;
    return {
      headline: `${wk}주 전 PR 이후 변화가 없어. 무게 리셋이나 빈도 조정이 필요한 시점.`,
      dx: `${wk}주째 ${cur}kg 정체.${volDrop ? ' 볼륨·빈도도 같이 빠졌어.' : ''}`,
      rx: `${reset}kg로 리셋해 주당 +2.5kg, 또는 주 2회로 빈도를 올려봐.`,
      mt: '한 번만 흐름을 깨면 금방 다시 PR 갈 수 있어 💪',
    };
  }
  if (d.trend === 'new' || d.prDate === lastDate(d.e1rm)) {
    return {
      headline: `최근 ${pr}kg로 신기록을 세웠어. 흐름이 좋아.`,
      dx: `최근 신기록 ${pr}kg 경신. 우상향 중.`,
      rx: `지금 강도 유지하면서 다음 목표는 ${trim(cur + 2.5)}kg.`,
      mt: '잘하고 있어 — 이대로 쭉 가자 🔥',
    };
  }
  return {
    headline: `현재 ${cur}kg, 꾸준히 올라오는 중이야.`,
    dx: `최근 추세 우상향, 현재 ${cur}kg.`,
    rx: `점진적 과부하 유지 — 다음 목표 ${trim(cur + 2.5)}kg.`,
    mt: '페이스 좋아, 계속 쌓아가자 💪',
  };
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  hd: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  back: { color: SEM.brand, fontSize: 28, width: 20, marginTop: -3 },
  hdTitle: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  hdStar: { fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyT: { color: '#8a8a8e', fontSize: 13 },

  hero: { paddingHorizontal: 16, paddingTop: 4 },
  hcat: { color: '#8a8a8e', fontSize: 11, fontWeight: '700' },
  hbig: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  hv: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1.4, lineHeight: 46 },
  hu: { color: '#8a8a8e', fontSize: 12, fontWeight: '700' },
  hbadges: { flexDirection: 'row', gap: 7, marginTop: 12, flexWrap: 'wrap' },
  rb: { fontSize: 10, fontWeight: '800', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  rbPr: { backgroundColor: 'rgba(255,197,61,0.16)', color: '#FFC53D' },
  rbFlat: { backgroundColor: 'rgba(255,138,0,0.16)', color: SEM.bad },
  hline: { color: '#9a9aa2', fontSize: 12, lineHeight: 18, marginTop: 11, paddingHorizontal: 16 },

  card: { marginHorizontal: 14, marginTop: 14, backgroundColor: '#0a0a0c', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 14, padding: 12 },
  mtog: { gap: 6, paddingRight: 4 },
  mt: { borderWidth: 1, borderColor: '#2a2a30', borderRadius: 13, paddingVertical: 6, paddingHorizontal: 12 },
  mtOn: { backgroundColor: SEM.good, borderColor: SEM.good },
  mtOnB: { backgroundColor: '#5b8def', borderColor: '#5b8def' },
  mtT: { color: '#cfcfd6', fontSize: 11, fontWeight: '800' },
  mtTOn: { color: '#06210f' },
  periodRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  pc: { borderWidth: 1, borderColor: '#2a2a30', borderRadius: 11, paddingVertical: 4, paddingHorizontal: 11 },
  pcOn: { backgroundColor: '#1c1c22', borderColor: '#3a3a42' },
  pcT: { color: '#7a7a7e', fontSize: 10.5, fontWeight: '700' },
  pcTOn: { color: '#fff' },

  clabel: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  clT: { color: '#6a6a6e', fontSize: 9.5 },
  barrow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 92, paddingTop: 4 },
  legend: { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lgDot: { width: 8, height: 8, borderRadius: 4 },
  legT: { color: '#9a9aa2', fontSize: 9.5 },

  secttl: { color: '#8a8a8e', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginHorizontal: 16, marginTop: 16, marginBottom: 7 },
  dig: { marginHorizontal: 14, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 14, padding: 13 },
  dh: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  da: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: SEM.brand, alignItems: 'center', justifyContent: 'center' },
  dn: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  dr: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  tg: { fontSize: 8.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, overflow: 'hidden', alignSelf: 'flex-start' },
  drx: { color: '#e4e4ea', fontSize: 11, lineHeight: 16, fontWeight: '600', flex: 1 },
  cta: { marginHorizontal: 14, marginTop: 11, backgroundColor: SEM.brand, borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  ctaT: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: 14, marginTop: 9 },
  chip: { borderWidth: 1, borderColor: '#2a2230', borderRadius: 13, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: '#0d0d0f' },
  chipT: { color: SEM.brand, fontSize: 10.5, fontWeight: '700' },
});
