import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { toDisplay, unitLabel } from '../lib/units';

type DataPoint = { date: string; estimated_1rm: number };
type Props = { data: DataPoint[]; title?: string; unitKg?: boolean };

const WIDTH = Dimensions.get('window').width - 40;
const HEIGHT = 210;
const PAD = { left: 38, right: 18, top: 18, bottom: 26 };

function niceStep(range: number): number {
  const target = range / 3; // 눈금 3~4개 목표
  const steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200];
  return steps.find(s => s >= target) ?? 500;
}

export default function OneRMChart({ data, title, unitKg = true }: Props) {
  const u = unitLabel(unitKg);

  if (data.length === 0) {
    return (
      <View style={styles.empty}><Text style={styles.emptyText}>아직 기록이 없습니다</Text></View>
    );
  }

  const recent = data.slice(-8);
  const values = recent.map(d => Math.round(toDisplay(d.estimated_1rm, unitKg)));
  const dates = recent.map(d => d.date.slice(5)); // MM-DD
  const n = values.length;

  // 0이 아닌 베이스라인 + 라운드 눈금
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  let lo = rawMin, hi = rawMax;
  if (lo === hi) { lo -= 5; hi += 5; }
  lo = lo - (hi - lo) * 0.15; // 최솟값이 바닥에 붙지 않게 약간 여유
  const step = niceStep(hi - lo);
  const baseline = Math.floor(lo / step) * step;
  const top = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = baseline; v <= top + 1e-6; v += step) ticks.push(v);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => n === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (n - 1)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - baseline) / (top - baseline)) * plotH;

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const areaPath = `M ${x(0)},${y(values[0])} ` +
    values.map((v, i) => `L ${x(i)},${y(v)}`).join(' ') +
    ` L ${x(n - 1)},${PAD.top + plotH} L ${x(0)},${PAD.top + plotH} Z`;

  // X 라벨: 시작·중간·끝만
  const labelIdx = n <= 1 ? [0] : Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  // 요약
  const first = values[0], last = values[n - 1], maxV = rawMax;
  const diff = last - first;
  const pct = first > 0 ? Math.round((diff / first) * 100) : 0;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={WIDTH} height={HEIGHT}>
        <Defs>
          <LinearGradient id="rmFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF3B30" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FF3B30" stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Y 눈금선 + 라벨 */}
        {ticks.map((t, i) => (
          <React.Fragment key={i}>
            <Line x1={PAD.left} y1={y(t)} x2={WIDTH - PAD.right} y2={y(t)} stroke="#2C2C2E" strokeWidth={1} />
            <SvgText x={PAD.left - 6} y={y(t) + 4} fill="#8E8E93" fontSize={11} textAnchor="end">{t}</SvgText>
          </React.Fragment>
        ))}

        {/* 영역 + 라인 */}
        {n > 1 && <Path d={areaPath} fill="url(#rmFill)" />}
        {n > 1 && <Polyline points={points} fill="none" stroke="#FF3B30" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}

        {/* 점 — 마지막 점 강조 */}
        {values.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 6 : 3.5}
            fill={i === n - 1 ? '#FF3B30' : '#0B0B0B'} stroke="#FF3B30" strokeWidth={2} />
        ))}

        {/* 마지막 값 라벨 */}
        <SvgText x={x(n - 1)} y={Math.max(PAD.top + 10, y(last) - 12)} fill="#FFFFFF" fontSize={15} fontWeight="700" textAnchor={n === 1 ? 'middle' : 'end'}>
          {`${last}${u}`}
        </SvgText>

        {/* X 라벨 */}
        {labelIdx.map(i => (
          <SvgText key={i} x={x(i)} y={HEIGHT - 8} fill="#8E8E93" fontSize={11}
            textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{dates[i]}</SvgText>
        ))}
      </Svg>

      {/* 한 줄 요약 */}
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryDelta, { color: diff >= 0 ? '#30D158' : '#FF453A' }]}>
          최근 {n}회 {diff >= 0 ? '+' : ''}{diff}{u} ({pct >= 0 ? '+' : ''}{pct}%)
        </Text>
        <Text style={styles.summaryMax}>최고 {maxV}{u}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingHorizontal: 4 },
  summaryDelta: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryMax: { color: '#8E8E93', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C1E', borderRadius: 12 },
  emptyText: { color: '#48484A', fontSize: 14 },
});
