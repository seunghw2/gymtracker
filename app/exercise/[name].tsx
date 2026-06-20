import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Polyline, Polygon, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';
import { SEM } from '../../constants/colors';
import {
  getExerciseProgress, getTrainedExercises, updateExerciseNote, getExerciseCoachLine, ExerciseProgress, SeriesPoint,
  getRepMaxes, RepMax,
} from '../../db/queries';
import { loadPinned, savePinned, togglePin, isPin } from '../../lib/pinnedLifts';
import { useChatStore } from '../../store/useChatStore';
import RangePickerSheet from '../../components/RangePickerSheet';

type DateRange = { start: string; end: string };

type Metric = '1rm' | 'maxw' | 'vol' | 'freq' | 'reps';
const METRICS: [Metric, string][] = [['1rm', '1RM'], ['maxw', '최대무게'], ['vol', '볼륨'], ['freq', '빈도'], ['reps', '렙기록']];
type Period = '1m' | '3m' | '6m' | '1y' | 'all' | 'custom';
const PERIODS: [Period, string][] = [['1m', '1M'], ['3m', '3M'], ['6m', '6M'], ['1y', '1Y'], ['all', '전체'], ['custom', '기간 지정']];
const PERIOD_DAYS: Record<Period, number> = { '1m': 30, '3m': 90, '6m': 182, '1y': 365, all: 1e9, custom: 1e9 };

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
  const [range, setRange] = useState<DateRange | null>(null); // '기간 지정' 직접 선택 범위
  const [rangeOpen, setRangeOpen] = useState(false);
  const [repMaxes, setRepMaxes] = useState<RepMax[] | null>(null); // 렙기록 탭 데이터(지연 로드)
  const [exId, setExId] = useState<number | null>(null);
  const [items, setItems] = useState<{ text: string; done: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [llmLine, setLlmLine] = useState<string | null>(null);
  const findOrCreateByKey = useChatStore(s => s.findOrCreateByKey);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        let id = params.id ? Number(params.id) : undefined;
        if (!id) id = (await getTrainedExercises()).find(e => e.name === name)?.id;
        if (id) {
          if (on) setExId(id);
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

  // 체크리스트는 코드 계산값으로 프리필(사용자 편집 가능)
  useEffect(() => { if (data) setItems(buildChecklist(data)); }, [data]);

  // 렙기록 탭 진입 시 1회 로드(반복수 1~12 역대 최고)
  useEffect(() => {
    if (metric !== 'reps' || !exId || repMaxes) return;
    let on = true;
    getRepMaxes(exId).then(r => { if (on) setRepMaxes(r); }).catch(() => {});
    return () => { on = false; };
  }, [metric, exId, repMaxes]);

  // 코치 한 줄 = LLM 해석(비동기·실패 시 코드 템플릿 폴백)
  useEffect(() => {
    if (!exId) return;
    let on = true;
    getExerciseCoachLine(exId).then(l => { if (on && l) setLlmLine(l); }).catch(() => {});
    return () => { on = false; };
  }, [exId]);

  // 목표·방법 = 코드값. 코치 한 줄(whyLine)은 지금은 코드 템플릿(추후 LLM로 교체).
  const cur = data?.currentE1rm ?? 0;
  const pr = data?.prE1rm ?? cur;
  const isFlat = !!data && data.trend === 'flat' && data.plateauWeeks > 0;
  const reset = Math.round((cur * 0.88) / 2.5) * 2.5;
  const goalMethod = isFlat
    ? `${trim(pr)}kg 회복 · ${trim(reset)} 리셋, 주당 +2.5kg`
    : `다음 목표 ${trim(cur + 2.5)}kg · 점진적 과부하`;
  const whyLine = llmLine ?? coach?.headline ?? '';

  const saveMemo = async () => {
    if (!exId) return;
    setSaving(true);
    const text = items.filter(it => it.text.trim()).map(it => `☐ ${it.text.trim()}`).join('\n');
    try { await updateExerciseNote(exId, text); setSaved(true); } catch { /* keep silent */ } finally { setSaving(false); }
  };
  const editItem = (i: number, t: string) => { setSaved(false); setItems(arr => arr.map((x, j) => (j === i ? { ...x, text: t } : x))); };
  const toggleItem = (i: number) => setItems(arr => arr.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
  const removeItem = (i: number) => { setSaved(false); setItems(arr => arr.filter((_, j) => j !== i)); };
  const addItem = () => { setSaved(false); setItems(arr => [...arr, { text: '', done: false }]); };

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
          {/* 티커 헤더 — 부위·종목 eyebrow + 큰 1RM + 등락칩 + PR 기준선 스파크 */}
          <View style={s.hero}>
            <Text style={s.hcat}>{data.bodyPart}{data.bodyPart ? ' · ' : ''}{name}</Text>
            <View style={s.tickRow}>
              <View style={s.hbig}>
                <Text style={s.hv}>{data.currentE1rm ?? '–'}</Text>
                <Text style={s.hu}>kg · 추정 1RM</Text>
              </View>
              <DeltaChip data={data} />
              <Sparkline data={data} />
            </View>
          </View>

          {/* 지표 세그먼트(활성=레드) + 기간 */}
          <View style={s.seg}>
            {METRICS.map(([k, lbl]) => (
              <Pressable key={k} onPress={() => setMetric(k)} style={[s.segItem, metric === k && s.segOn]}>
                <Text style={[s.segT, metric === k && s.segTOn]}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
          {metric !== 'reps' && (
            <View style={s.periodRow}>
              {PERIODS.map(([k, lbl]) => (
                <Pressable key={k} onPress={() => (k === 'custom' ? setRangeOpen(true) : setPeriod(k))} style={[s.pc, period === k && s.pcOn]}>
                  <Text style={[s.pcT, period === k && s.pcTOn]}>
                    {k === 'custom' && period === 'custom' && range ? `${fmtDate(range.start)}~${fmtDate(range.end)}` : lbl}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* 차트 카드 (렙기록은 표) */}
          <View style={s.card}>
            {metric === 'reps'
              ? <RepTable rows={repMaxes} />
              : <ChartArea data={data} metric={metric} period={period} range={range} />}
          </View>

          {/* 진단 + 핵심 지표 */}
          <Diagnosis data={data} />
          <KeyStats data={data} />

          {/* 코치 — 목표·방법(코드) + 해석 한 줄 + 편집 가능 체크리스트 메모 */}
          <Text style={s.secttl}>🤖 AI 코치</Text>
          <View style={s.cbox}>
            <View style={s.rx}>
              <Text style={s.rxK}>목표·방법</Text>
              <Text style={s.rxB}>{goalMethod}</Text>
            </View>
            {whyLine ? <Text style={s.rxWhy}>{whyLine}</Text> : null}

            <View style={s.memo}>
              <View style={s.memoH}>
                <Text style={s.memoHT} numberOfLines={1}>📝 다음 {name} 세션 체크리스트</Text>
                <Text style={s.memoHEd}>✏️ 편집 가능</Text>
              </View>
              {items.map((it, i) => (
                <View key={i} style={s.ck}>
                  <Pressable onPress={() => toggleItem(i)} style={[s.ckBox, it.done && s.ckBoxOn]} hitSlop={6}>
                    {it.done && <Text style={s.ckMark}>✓</Text>}
                  </Pressable>
                  <TextInput
                    style={s.ckInput}
                    value={it.text}
                    onChangeText={t => editItem(i, t)}
                    placeholder="할 일 입력"
                    placeholderTextColor="#5a5030"
                  />
                  <Pressable onPress={() => removeItem(i)} hitSlop={8}><Text style={s.ckDel}>×</Text></Pressable>
                </View>
              ))}
              <Pressable onPress={addItem} hitSlop={6}><Text style={s.addRowT}>+ 항목 추가</Text></Pressable>
            </View>

            <View style={s.acts}>
              <Pressable style={[s.pbtn, saved && s.pbtnDone]} onPress={saveMemo} disabled={saving}>
                <Text style={s.pbtnT}>{saved ? '저장됨 ✓' : saving ? '저장 중…' : '메모에 저장'}</Text>
              </Pressable>
              <Pressable style={s.sbtn} onPress={() => goChat()}><Text style={s.sbtnT}>💬 대화로 풀기</Text></Pressable>
            </View>
            <View style={s.chips}>
              {['왜 멈췄어?', '대체 운동'].map(c => (
                <Pressable key={c} style={s.chip} onPress={() => goChat(`${name} ${c}`)}><Text style={s.chipT}>{c}</Text></Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
      <RangePickerSheet
        visible={rangeOpen}
        start={range?.start ?? ymd(new Date(Date.now() - 30 * 86400000))}
        end={range?.end ?? ymd(new Date())}
        onClose={() => setRangeOpen(false)}
        onConfirm={(s2, e2) => { setRange({ start: s2, end: e2 }); setPeriod('custom'); setRangeOpen(false); }}
      />
    </SafeAreaView>
  );
}

const isLine = (m: Metric) => m === '1rm' || m === 'maxw';
const lastDate = (pts: SeriesPoint[]) => (pts.length ? pts[pts.length - 1].date : null);

/** 등락 칩 — 정체=주황 보합, 신기록/상승=초록. (의미색, 브랜드 레드와 분리) */
function DeltaChip({ data }: { data: ExerciseProgress }) {
  const isNewPr = data.trend === 'new' || (data.prDate != null && data.prDate === lastDate(data.e1rm));
  if (data.trend === 'flat' && data.plateauWeeks > 0) return <Text style={[s.chipD, s.chipBad]}>▬ {data.plateauWeeks}주 보합</Text>;
  if (isNewPr) return <Text style={[s.chipD, s.chipGood]}>▲ 신기록</Text>;
  if (data.trend === 'up') return <Text style={[s.chipD, s.chipGood]}>▲ 상승세</Text>;
  if (data.trend === 'down') return <Text style={[s.chipD, s.chipBad]}>▼ 하락</Text>;
  return null;
}

/** PR 기준선 스파크라인 — 최근 추세선 + PR 점선 기준선 + PR 마커(노랑). 추세색=상태색. */
function Sparkline({ data }: { data: ExerciseProgress }) {
  const pts = data.e1rm.slice(-8);
  if (pts.length < 2) return null;
  const w = 84, h = 28;
  const vals = pts.map(p => p.value);
  const pr = data.prE1rm ?? Math.max(...vals);
  const max = Math.max(...vals, pr), min = Math.min(...vals, pr), range = max - min || 1;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => 4 + (1 - (v - min) / range) * (h - 8);
  const poly = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const color = data.trend === 'flat' || data.trend === 'down' ? SEM.bad : SEM.good;
  const prIdx = data.prDate ? pts.findIndex(p => p.date === data.prDate) : -1;
  return (
    <Svg width={w} height={h} style={{ marginLeft: 'auto' }}>
      <Line x1={0} y1={y(pr)} x2={w} y2={y(pr)} stroke={SEM.warn} strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
      <Polyline points={poly} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      {prIdx >= 0 && <Circle cx={x(prIdx)} cy={y(pts[prIdx].value)} r={2.4} fill={SEM.warn} />}
    </Svg>
  );
}

/** 체크리스트 기본값 — 숫자는 코드 계산값으로 프리필(사용자 수정 가능). */
function buildChecklist(d: ExerciseProgress): { text: string; done: boolean }[] {
  const cur = d.currentE1rm ?? 0;
  const isFlat = d.trend === 'flat' && d.plateauWeeks > 0;
  if (isFlat) {
    const reset = Math.round((cur * 0.88) / 2.5) * 2.5;
    return [
      { text: `${trim(reset)}kg로 첫 세트 시작`, done: false },
      { text: '주당 +2.5kg 점증', done: false },
      { text: '볼륨 1세트 추가', done: false },
    ];
  }
  return [
    { text: `다음 목표 ${trim(cur + 2.5)}kg 도전`, done: false },
    { text: '점진적 과부하 유지', done: false },
  ];
}

// ── 차트 ─────────────────────────────────────────────────
const CH = 150;

function ChartArea({ data, metric, period, range }: { data: ExerciseProgress; metric: Metric; period: Period; range: DateRange | null }) {
  // 선택한 기간만 — 기록이 없으면 전체로 폴백하지 않고 "기간 내 기록 없음"을 보여준다.
  const custom = period === 'custom' && range ? range : null;
  const cut = Date.now() - PERIOD_DAYS[period] * 86400000;
  const rs = custom ? parseLocal(custom.start).getTime() : 0;
  const re = custom ? parseLocal(custom.end).getTime() + 86400000 - 1 : 0; // 끝날 하루 전체 포함
  const inRange = (p: SeriesPoint) => {
    if (period === 'all') return true;
    const t = parseLocal(p.date).getTime();
    return custom ? (t >= rs && t <= re) : t >= cut;
  };
  const periodLabel = period === 'custom' ? '선택 기간' : (PERIODS.find(([k]) => k === period)?.[1] ?? '');

  if (metric === '1rm' || metric === 'maxw') {
    const pts = (metric === '1rm' ? data.e1rm : data.maxWeight).filter(inRange);
    if (pts.length < 2) return <Empty
      label={pts.length === 0 ? `${periodLabel} 동안 기록이 없어요` : `기록이 ${pts.length}개뿐이에요`}
      sub="추세 그래프는 최소 2개부터 그려져요" />;
    const unit = metric === '1rm' ? '추정 1RM' : '최대 수행 무게';
    return <LineChart pts={pts} unit={`kg · ${unit}`}
      prDate={metric === '1rm' ? data.prDate : null} plateauWeeks={metric === '1rm' ? data.plateauWeeks : 0} />;
  }
  if (metric === 'vol') {
    // 볼륨도 1RM·최대무게와 같은 선 그래프 방식으로(주간 볼륨 추세)
    const vpts = data.weeklyVolume.filter(inRange);
    if (vpts.length < 2) return <Empty
      label={vpts.length === 0 ? `${periodLabel} 동안 기록이 없어요` : `기록이 ${vpts.length}개뿐이에요`}
      sub="추세 그래프는 최소 2개부터 그려져요" />;
    return <LineChart pts={vpts} unit="t · 주간 볼륨" prDate={null} plateauWeeks={0}
      fmtY={v => `${(v / 1000).toFixed(1)}t`} unitShort="t" />;
  }
  // 빈도 → 막대 그래프
  const src = data.weeklyFreq;
  if (src.filter(inRange).length < 1) return <Empty
    label={`${periodLabel} 동안 기록이 없어요`} sub="그래프는 기록 1개부터 그려져요" />;
  // 1년 이상(1Y·전체·범위≥365일)이면 주별 52칸이 빽빽 → 월별 빈도로 집계
  const longSpan = period === '1y' || period === 'all' || (!!custom && re - rs >= 365 * 86400000);
  if (longSpan) {
    const mpts = fillMonths(src, period, custom).slice(-36); // 최근 3년치까지
    return <BarChart pts={mpts} unit="월 운동 횟수" isVol={false} bucket="month" />;
  }
  // 쉰 주를 0으로 메우고(고스트 막대), 너무 많으면 최근 ~1년치(52주)까지만(주로 '전체' 보호).
  const pts = fillWeeks(src, period, custom).slice(-52);
  return <BarChart pts={pts} unit="주 운동 횟수" isVol={false} bucket="week" />;
}

function LineChart({ pts, unit, prDate, plateauWeeks, fmtY = (v: number) => `${trim(v)}kg`, unitShort = 'kg' }:
  { pts: SeriesPoint[]; unit: string; prDate: string | null; plateauWeeks: number; fmtY?: (v: number) => string; unitShort?: string }) {
  const [act, setAct] = useState<number | null>(null);
  if (pts.length < 2) return <Empty />;
  // x축은 '점 순서'가 아니라 '실제 날짜'에 비례 — 16일치 데이터가 3개월처럼 늘어나 보이는 착시 방지
  const times = pts.map(p => parseLocal(p.date).getTime());
  const tMin = times[0], tMax = times[times.length - 1], tSpan = tMax - tMin || 1;
  const xs = times.map(t => ((t - tMin) / tSpan) * W);
  const vals = pts.map(p => p.value);
  const rawMax = Math.max(...vals), rawMin = Math.min(...vals);
  // 값 범위에 위아래 여백을 둬서 작은 차이가 화면 전체 높이로 과장되지 않게 한다.
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.05);
  const lo = rawMin - span * 0.35, hi = rawMax + span * 0.35;
  const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (CH - 20);
  const poly = pts.map((p, i) => `${xs[i].toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${poly} ${W},${CH} 0,${CH}`;
  const prIdx = prDate ? pts.findIndex(p => p.date === prDate) : -1;
  // 정체 음영: PR 이후 구간
  const showPlateau = plateauWeeks >= 4 && prIdx >= 0 && prIdx < pts.length - 1;
  // 누르고 있는 지점 → x가 가장 가까운 데이터 인덱스(시간 비례 좌표라 거리로 찾는다)
  const pick = (x: number) => {
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    setAct(best);
  };
  // 지표·기간 변경으로 점 개수가 줄어도 안전하도록 범위 가드
  const a = act != null && act < pts.length ? act : null;
  // 점이 빽빽하지 않게: 직전 표시점과 최소 간격(px) 이상일 때만 점 표시(첫·끝은 항상)
  const dotSet = new Set<number>();
  let prevDotX = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (i === pts.length - 1 || xs[i] - prevDotX >= 9) { dotSet.add(i); prevDotX = xs[i]; }
  }

  return (
    <>
      <View style={s.clabel}>
        {a == null ? (
          <><Text style={s.clT}>{unitShort}</Text><Text style={s.clT}>{unit}</Text></>
        ) : (
          <><Text style={s.clT}>{fmtDate(pts[a].date)}</Text><Text style={[s.clT, s.clActive]}>{fmtY(pts[a].value)}</Text></>
        )}
      </View>
      <View
        style={{ width: W, height: CH }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => pick(e.nativeEvent.locationX)}
        onResponderMove={e => pick(e.nativeEvent.locationX)}
      >
        <Svg width={W} height={CH}>
          {/* y축 눈금: 최대·최소값 라벨로 그래프 높이가 몇 kg인지 한눈에 */}
          <Line x1={0} y1={y(rawMax)} x2={W} y2={y(rawMax)} stroke="#3a3a42" strokeWidth={1} strokeDasharray="3 4" opacity={0.55} />
          <Line x1={0} y1={y(rawMin)} x2={W} y2={y(rawMin)} stroke="#3a3a42" strokeWidth={1} strokeDasharray="3 4" opacity={0.55} />
          <SvgText x={W - 3} y={y(rawMax) - 4} fill="#8a8a90" fontSize={9.5} textAnchor="end">{fmtY(rawMax)}</SvgText>
          {rawMax !== rawMin && <SvgText x={W - 3} y={y(rawMin) + 12} fill="#6a6a6e" fontSize={9.5} textAnchor="end">{fmtY(rawMin)}</SvgText>}
          {showPlateau && <Rect x={xs[prIdx]} y={0} width={W - xs[prIdx]} height={CH - 6} fill="rgba(255,138,0,0.12)" />}
          {showPlateau && <Line x1={xs[prIdx]} y1={0} x2={xs[prIdx]} y2={CH - 6} stroke="rgba(255,138,0,0.4)" strokeWidth={1} strokeDasharray="3 3" />}
          <Polygon points={area} fill="rgba(43,217,106,0.10)" />
          <Polyline points={poly} fill="none" stroke={SEM.good} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* 운동한 날 = 작은 흰 점 (특수 마커는 아래에서 덮어써 강조) */}
          {pts.map((p, i) => dotSet.has(i) ? <Circle key={`d${i}`} cx={xs[i]} cy={y(p.value)} r={2} fill="#fff" opacity={0.85} /> : null)}
          {/* x축 날짜: 실제 기간이 며칠인지 양 끝에 표시 */}
          <SvgText x={1} y={CH - 3} fill="#6a6a6e" fontSize={9} textAnchor="start">{fmtDate(pts[0].date)}</SvgText>
          {tMax !== tMin && <SvgText x={W - 1} y={CH - 3} fill="#6a6a6e" fontSize={9} textAnchor="end">{fmtDate(pts[pts.length - 1].date)}</SvgText>}
          {prIdx >= 0 && <Circle cx={xs[prIdx]} cy={y(pts[prIdx].value)} r={4.5} fill="#FFC53D" stroke="#000" strokeWidth={1.5} />}
          <Circle cx={xs[xs.length - 1]} cy={y(pts[pts.length - 1].value)} r={3.5} fill={SEM.good} stroke="#000" strokeWidth={1.5} />
          {a != null && <Line x1={xs[a]} y1={0} x2={xs[a]} y2={CH - 6} stroke="#fff" strokeWidth={1} opacity={0.55} />}
          {a != null && <Circle cx={xs[a]} cy={y(pts[a].value)} r={4.5} fill="#fff" stroke="#000" strokeWidth={1.5} />}
        </Svg>
      </View>
      <View style={s.legend}>
        <Legend color={SEM.good} label={unit.split('·').pop()?.trim() ?? ''} />
        {showPlateau && <Legend color="rgba(255,138,0,0.5)" label="정체 구간" />}
        {prIdx >= 0 && <Legend color="#FFC53D" label="PR" />}
      </View>
    </>
  );
}

function BarChart({ pts, unit, isVol, bucket = 'week' }: { pts: SeriesPoint[]; unit: string; isVol: boolean; bucket?: 'week' | 'month' }) {
  const [act, setAct] = useState<number | null>(null);
  const [bw, setBw] = useState(W); // 막대줄 실제 너비(onLayout으로 측정)
  if (pts.length < 1) return <Empty />;
  const unitName = bucket === 'month' ? '개월' : '주';
  const max = Math.max(...pts.map(p => p.value)) || 1;
  // 가장 최근 "활동한" 칸(0은 건너뜀) 기준으로 요약·강조
  const active = pts.filter(p => p.value > 0);
  const lastActive = active.length ? active[active.length - 1] : pts[pts.length - 1];
  let lastActiveIdx = -1;
  for (let i = pts.length - 1; i >= 0; i--) { if (pts[i].value > 0) { lastActiveIdx = i; break; } }
  const drop = active.length >= 2 && active[active.length - 1].value < active[active.length - 2].value;
  // 주/월당 빈도수 = 운동한 칸들의 평균 세션 수
  const periodAvg = active.length ? active.reduce((sum, p) => sum + p.value, 0) / active.length : 0;
  const fmtVal = (v: number) => (isVol ? `${(v / 1000).toFixed(1)}t` : `${v}회`);
  const fmtBarDate = (d: string) => (bucket === 'month' ? `${d.slice(2, 4)}.${Number(d.slice(5, 7))}` : fmtDate(d));
  // 누른 x에 '가장 가까운 막대 중심'을 선택 — gap·flex 레이아웃에서도 정확(모든 막대 터치 가능)
  const GAP = 5;
  const barW = (bw - GAP * (pts.length - 1)) / pts.length;
  const centerX = (i: number) => i * (barW + GAP) + barW / 2;
  const pick = (x: number) => {
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(centerX(i) - x) < Math.abs(centerX(best) - x)) best = i;
    setAct(best);
  };
  // 기간 변경으로 주 개수가 줄어도 안전하도록 범위 가드
  const a = act != null && act < pts.length ? act : null;

  return (
    <>
      <View style={s.clabel}>
        {a == null ? (
          <><Text style={s.clT}>최대 {fmtVal(max)}</Text><Text style={s.clT}>{unit} · {pts.length}{unitName}</Text></>
        ) : (
          <><Text style={s.clT}>{fmtBarDate(pts[a].date)}</Text><Text style={[s.clT, s.clActive]}>{fmtVal(pts[a].value)}</Text></>
        )}
      </View>
      <View
        style={s.barrow}
        onLayout={e => setBw(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => pick(e.nativeEvent.locationX)}
        onResponderMove={e => pick(e.nativeEvent.locationX)}
      >
        {/* 천장(=최대) 기준선 + 절반선: 막대 높이가 어느 정도인지 눈금 */}
        <View pointerEvents="none" style={[s.barGrid, { top: 4 }]} />
        <View pointerEvents="none" style={[s.barGrid, { top: 50 }]} />
        {pts.map((p, i) => {
          // 쉰 주(값 0) = 점선 고스트 막대로 — "텅 빈 화면" 방지
          if (p.value <= 0) return <View key={i} style={[s.ghostBar, i === a && { borderColor: '#fff', opacity: 1 }]} />;
          const color = i === a ? '#fff' : i === lastActiveIdx ? (drop ? SEM.bad : SEM.brand) : '#3a3a42';
          return <View key={i} style={{ flex: 1, height: Math.max(4, (p.value / max) * 92), borderRadius: 3, backgroundColor: color }} />;
        })}
      </View>
      <View style={s.legend}>
        <Text style={[s.legT, drop && { color: SEM.bad }]}>
          {!isVol && active.length ? `${unitName === '개월' ? '월' : '주'} 평균 ${periodAvg.toFixed(1)}회 · ` : ''}최근 {fmtVal(lastActive.value)}{drop ? ' · 직전보다 감소' : ''}
        </Text>
      </View>
    </>
  );
}

const Empty = ({ label, sub }: { label?: string; sub?: string }) => (
  <View style={[s.barrow, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: CH, gap: 5 }]}>
    <Text style={[s.clT, { fontSize: 12.5, color: '#c7c7cc' }]}>{label ?? '데이터가 부족해요'}</Text>
    {sub ? <Text style={s.clT}>{sub}</Text> : null}
  </View>
);
const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={s.lg}><View style={[s.lgDot, { backgroundColor: color }]} /><Text style={s.legT}>{label}</Text></View>
);

// 렙기록 표 — 반복수 1~12별 역대 최고 실측(무게×횟수)과 Epley 추정 1RM. 최고 추정 1RM 행 강조(🔥).
function RepTable({ rows }: { rows: RepMax[] | null }) {
  if (!rows) return <Empty label="불러오는 중…" />;
  const withData = rows.filter(r => r.weight > 0);
  if (withData.length === 0) return <Empty label="아직 렙별 기록이 없어요" sub="세트를 완료하면 반복수별 최고기록이 쌓여요" />;
  const bestE1rm = Math.max(...withData.map(r => r.e1rm));
  return (
    <View>
      <View style={s.rtHead}>
        <Text style={[s.rtH, s.rtRep]}>반복</Text>
        <Text style={[s.rtH, s.rtRec]}>실측 기록</Text>
        <Text style={[s.rtH, s.rtRm]}>추정 1RM</Text>
      </View>
      {rows.map(r => {
        const has = r.weight > 0;
        const best = has && r.e1rm === bestE1rm;
        return (
          <View key={r.reps} style={[s.rtRow, best && s.rtRowBest]}>
            <Text style={[s.rtRep, s.rtRepT]}>{r.reps}RM</Text>
            <Text style={[s.rtRec, s.rtCell, !has && s.rtMuted]}>{has ? `${trim(r.weight)} × ${r.reps}` : '—'}</Text>
            <Text style={[s.rtRm, s.rtCell, best && s.rtBestT, !has && s.rtMuted]}>{has ? `${trim(r.e1rm)}kg${best ? '  🔥' : ''}` : '—'}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── 진단 카드 + 핵심 지표 ─────────────────────────────────
type Dir = 'up' | 'down' | 'flat';
const seriesDir = (pts: SeriesPoint[]): Dir => {
  if (pts.length < 2) return 'flat';
  const a = pts[pts.length - 1].value, b = pts[pts.length - 2].value;
  if (a > b * 1.02) return 'up';
  if (a < b * 0.98) return 'down';
  return 'flat';
};
const arrow = (d: Dir) => (d === 'up' ? '▲' : d === 'down' ? '▼' : '▬');
function fmtAgo(date: string | null) {
  if (!date) return '–';
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (d <= 0) return '오늘';
  if (d === 1) return '어제';
  return `${d}일 전`;
}
// 스크럽 라벨용 날짜 — 'YY.M.D'
function fmtDate(date: string) {
  const parts = String(date).slice(0, 10).split('-');
  if (parts.length !== 3) return String(date);
  return `${parts[0].slice(2)}.${Number(parts[1])}.${Number(parts[2])}`;
}

// 'YYYY-MM-DD' → 로컬 자정 Date(타임존 안전)
const parseLocal = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const mondayOf = (dt: Date) => { const x = new Date(dt); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

/**
 * 주간 시계열의 빈 주(쉰 주)를 0으로 메운다 — 백엔드는 활동한 주만 주므로
 * 프론트에서 기간 시작(또는 첫 기록)부터 이번 주까지 연속 주를 채워 고스트 막대가 뜨게 한다.
 */
function fillWeeks(all: SeriesPoint[], period: Period, range?: DateRange | null): SeriesPoint[] {
  if (all.length === 0) return [];
  const map = new Map(all.map(p => [p.date.slice(0, 10), p.value]));
  const firstData = mondayOf(parseLocal(all[0].date));
  let end = mondayOf(new Date());
  let start = firstData;
  if (period === 'custom' && range) {
    const rs = mondayOf(parseLocal(range.start));
    start = rs > firstData ? rs : firstData;
    end = mondayOf(parseLocal(range.end));
  } else if (period !== 'all') {
    const cut = mondayOf(new Date(Date.now() - PERIOD_DAYS[period] * 86400000));
    start = cut > firstData ? cut : firstData;
  }
  const out: SeriesPoint[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
    const key = ymd(d);
    out.push({ date: key, value: map.get(key) ?? 0 });
  }
  return out;
}

const firstOfMonth = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), 1);
/** 주간 빈도를 '월'로 합산(빈 달은 0). 1년 이상 기간에서 막대가 빽빽해지는 걸 방지. */
function fillMonths(all: SeriesPoint[], period: Period, range?: DateRange | null): SeriesPoint[] {
  if (all.length === 0) return [];
  const sum = new Map<string, number>(); // 'YYYY-MM' → 세션 수 합
  for (const p of all) { const k = p.date.slice(0, 7); sum.set(k, (sum.get(k) ?? 0) + p.value); }
  const firstData = firstOfMonth(parseLocal(all[0].date));
  let end = firstOfMonth(new Date());
  let start = firstData;
  if (period === 'custom' && range) {
    const rs = firstOfMonth(parseLocal(range.start));
    start = rs > firstData ? rs : firstData;
    end = firstOfMonth(parseLocal(range.end));
  } else if (period !== 'all') {
    const cut = firstOfMonth(new Date(Date.now() - PERIOD_DAYS[period] * 86400000));
    start = cut > firstData ? cut : firstData;
  }
  const out: SeriesPoint[] = [];
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ date: `${k}-01`, value: sum.get(k) ?? 0 });
  }
  return out;
}

function Cause({ label, dir }: { label: string; dir: Dir }) {
  return <Text style={[s.cause, dir === 'up' && s.causeUp, dir === 'down' && s.causeBad]}>{label} {arrow(dir)}</Text>;
}

/** 사실 진단 — 정체=주황 카드, 신기록/성장=초록 카드 + 원인 칩(볼륨·빈도·무게). */
function Diagnosis({ data }: { data: ExerciseProgress }) {
  const chips = (
    <View style={s.dchips}>
      <Cause label="볼륨" dir={seriesDir(data.weeklyVolume)} />
      <Cause label="빈도" dir={seriesDir(data.weeklyFreq)} />
      <Cause label="무게" dir={seriesDir(data.maxWeight)} />
    </View>
  );
  const isFlat = data.trend === 'flat' && data.plateauWeeks > 0;
  const isNewPr = data.trend === 'new' || (data.prDate != null && data.prDate === lastDate(data.e1rm));
  const e = data.e1rm;
  const dk = e.length >= 2 ? Math.round((e[e.length - 1].value - e[e.length - 2].value) * 10) / 10 : 0;

  let bad = false, head = '';
  if (isFlat) { bad = true; head = `🩺 진단 · 정체 ${data.plateauWeeks}주`; }
  else if (isNewPr) { head = `✅ 신기록${dk > 0 ? ` · 직전보다 +${trim(dk)}kg` : ''}`; }
  else if (data.trend === 'down') { bad = true; head = `🩺 하락 · 최근 ${trim(dk)}kg`; }
  else { head = `📈 성장 중${dk > 0 ? ` · 최근 +${trim(dk)}kg` : ''}`; }

  return (
    <View style={[s.dcard, bad ? s.dcardBad : s.dcardGood]}>
      <Text style={[s.dcardH, { color: bad ? SEM.bad : SEM.good }]}>{head}</Text>
      {chips}
    </View>
  );
}

function KV({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return <View style={s.kv}><Text style={s.kvK}>{k}</Text><Text style={[s.kvV, bad && { color: SEM.bad }]}>{v}</Text></View>;
}

/** 핵심 지표 2×2 — 최대무게·주간볼륨·주빈도·마지막 수행. 모두 코드 계산값. */
function KeyStats({ data }: { data: ExerciseProgress }) {
  // 역대 최고 무게(전체 최댓값) — 차트의 피크와 일치. 마지막 세션 값이 아님.
  const maxW = data.maxWeight.length ? Math.max(...data.maxWeight.map(p => p.value)) : null;
  const vol = data.weeklyVolume.length ? data.weeklyVolume[data.weeklyVolume.length - 1].value : 0;
  const volDown = seriesDir(data.weeklyVolume) === 'down';
  const freq = data.weeklyFreq.length ? data.weeklyFreq[data.weeklyFreq.length - 1].value : 0;
  const freqDown = seriesDir(data.weeklyFreq) === 'down';
  return (
    <>
      <Text style={s.secttl}>핵심 지표</Text>
      <View style={s.kvgrid}>
        <KV k="최대무게" v={maxW != null ? `${trim(maxW)}kg` : '–'} />
        <KV k="주간 볼륨" v={`${(vol / 1000).toFixed(1)}t${volDown ? ' ▼' : ''}`} bad={volDown} />
        <KV k="주 빈도" v={`${freq}회${freqDown ? ' ▼' : ''}`} bad={freqDown} />
        <KV k="마지막" v={fmtAgo(lastDate(data.e1rm))} />
      </View>
    </>
  );
}

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
  hbig: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  hv: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1.4, lineHeight: 46 },
  hu: { color: '#8a8a8e', fontSize: 12, fontWeight: '700' },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  chipD: { fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },
  chipBad: { color: SEM.bad, backgroundColor: 'rgba(255,138,0,0.14)' },
  chipGood: { color: SEM.good, backgroundColor: 'rgba(43,217,106,0.14)' },

  card: { marginHorizontal: 14, marginTop: 8, backgroundColor: '#0a0a0c', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 14, padding: 12 },
  seg: { flexDirection: 'row', gap: 5, marginHorizontal: 16, marginTop: 14 },
  segItem: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a30', borderRadius: 999, paddingVertical: 6 },
  segOn: { backgroundColor: SEM.brand, borderColor: SEM.brand },
  segT: { color: '#cfcfd6', fontSize: 11.5, fontWeight: '800' },
  segTOn: { color: SEM.onBrand },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, rowGap: 6, marginHorizontal: 16, marginTop: 8, marginBottom: 2 },
  pc: { borderWidth: 1, borderColor: '#2a2a30', borderRadius: 11, paddingVertical: 4, paddingHorizontal: 11 },
  pcOn: { backgroundColor: '#1c1c22', borderColor: '#3a3a42' },
  pcT: { color: '#7a7a7e', fontSize: 10.5, fontWeight: '700' },
  pcTOn: { color: '#fff' },

  clabel: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 },
  clT: { color: '#6a6a6e', fontSize: 9.5 },
  clActive: { color: '#fff', fontSize: 12, fontWeight: '800' },
  barrow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 92, paddingTop: 4, position: 'relative' },
  barGrid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#2a2a30', opacity: 0.6 },
  ghostBar: { flex: 1, height: 14, borderRadius: 3, borderWidth: 1, borderColor: '#2a2a30', borderStyle: 'dashed', opacity: 0.7 },
  legend: { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lgDot: { width: 8, height: 8, borderRadius: 4 },
  legT: { color: '#9a9aa2', fontSize: 9.5 },
  // 렙기록 표
  rtHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a30' },
  rtH: { color: '#7a7a7e', fontSize: 11, fontWeight: '700' },
  rtRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#242427', borderRadius: 8 },
  rtRowBest: { backgroundColor: 'rgba(43,217,106,0.12)' },
  rtRep: { width: 56 },
  rtRec: { flex: 1, textAlign: 'right', paddingRight: 14 },
  rtRm: { width: 96, textAlign: 'right' },
  rtRepT: { color: '#fff', fontSize: 14, fontWeight: '800' },
  rtCell: { color: '#EDEDF0', fontSize: 14, fontWeight: '600' },
  rtBestT: { color: SEM.good, fontWeight: '800' },
  rtMuted: { color: '#48484A' },

  dcard: { marginHorizontal: 14, marginTop: 12, borderWidth: 1, borderRadius: 13, padding: 12 },
  dcardBad: { borderColor: 'rgba(255,138,0,0.45)', backgroundColor: 'rgba(255,138,0,0.07)' },
  dcardGood: { borderColor: 'rgba(43,217,106,0.4)', backgroundColor: 'rgba(43,217,106,0.06)' },
  dcardH: { fontSize: 13.5, fontWeight: '800', marginBottom: 9 },
  dchips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cause: { fontSize: 11, fontWeight: '700', color: '#cfcfd6', backgroundColor: '#1c1c22', borderWidth: 1, borderColor: '#2a2a30', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  causeUp: { color: SEM.good, borderColor: 'rgba(43,217,106,0.4)' },
  causeBad: { color: SEM.bad, borderColor: 'rgba(255,138,0,0.45)' },
  kvgrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 14, marginTop: 2 },
  kv: { width: '47%', flexGrow: 1, backgroundColor: '#0a0a0c', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  kvK: { color: '#8a8a8e', fontSize: 11 },
  kvV: { color: '#fff', fontSize: 14, fontWeight: '800' },

  secttl: { color: '#8a8a8e', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginHorizontal: 16, marginTop: 16, marginBottom: 7 },
  dig: { marginHorizontal: 14, backgroundColor: '#0d0d0f', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 14, padding: 13 },
  dh: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  da: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: SEM.brand, alignItems: 'center', justifyContent: 'center' },
  dn: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  dr: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  tg: { fontSize: 8.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, overflow: 'hidden', alignSelf: 'flex-start' },
  drx: { color: '#e4e4ea', fontSize: 11, lineHeight: 16, fontWeight: '600', flex: 1 },
  cbox: { marginHorizontal: 14, backgroundColor: '#0a0a0c', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 14, padding: 13 },
  rx: { gap: 2 },
  rxK: { color: SEM.good, fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  rxB: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  rxWhy: { color: '#9a9aa2', fontSize: 12, lineHeight: 17, marginTop: 7, marginBottom: 4 },
  memo: { backgroundColor: '#14130d', borderWidth: 1, borderColor: '#3a3320', borderRadius: 11, padding: 11, marginTop: 11 },
  memoH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  memoHT: { color: '#caa94a', fontSize: 10.5, fontWeight: '800', flex: 1, marginRight: 8 },
  memoHEd: { color: '#8fb4ff', fontSize: 10, fontWeight: '700' },
  ck: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  ckBox: { width: 16, height: 16, borderWidth: 1.5, borderColor: '#6a5e38', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  ckBoxOn: { backgroundColor: '#caa94a', borderColor: '#caa94a' },
  ckMark: { color: '#14130d', fontSize: 11, fontWeight: '900', lineHeight: 12 },
  ckInput: { flex: 1, color: '#e7dcc0', fontSize: 12.5, fontWeight: '600', paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: '#3a3320' },
  ckDel: { color: '#6a5e38', fontSize: 18, fontWeight: '700', paddingHorizontal: 2 },
  addRowT: { color: '#8fb4ff', fontSize: 11, fontWeight: '700', marginTop: 8 },
  acts: { gap: 8, marginTop: 12 },
  pbtn: { backgroundColor: SEM.brand, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  pbtnDone: { backgroundColor: '#1c3a24', borderWidth: 1, borderColor: SEM.good },
  pbtnT: { color: '#fff', fontSize: 14, fontWeight: '800' },
  sbtn: { borderWidth: 1, borderColor: '#2a2a30', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sbtnT: { color: '#fff', fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  chip: { borderWidth: 1, borderColor: '#2a2230', borderRadius: 13, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: '#0d0d0f' },
  chipT: { color: SEM.brand, fontSize: 10.5, fontWeight: '700' },
});
