import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Polyline, Rect, Path } from 'react-native-svg';
import { RT, toneColor, toneBg, catColor } from './theme';
import { ACCENT, COLORS } from '../../constants/colors';

/** 상태 점 — 데이터 상태 표시 전용(good=초록, warn/bad=주황). 액션색(레드) 아님. */
export function StatusDot({ tone, size = 8 }: { tone?: string; size?: number }) {
  if (!tone || tone === 'flat' || tone === 'plain') return null;
  const color = tone === 'good' ? COLORS.green : COLORS.orange;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

// ── 타이포/공용 ────────────────────────────────────────────────────────
export function Eyebrow({ label }: { label: string }) {
  return (
    <View style={cs.eyebrowRow}>
      <Text style={cs.eyebrow}>{label}</Text>
      <View style={cs.eyebrowLine} />
    </View>
  );
}

export function StatusChip({ tone, label }: { tone?: string; label: string }) {
  return <Text style={[cs.chip, { color: toneColor(tone), backgroundColor: toneBg(tone) }]}>{label}</Text>;
}

export function Delta({ text, tone }: { text: string; tone?: string }) {
  return <Text style={[cs.delta, { color: toneColor(tone) }]}>{text}</Text>;
}

export function BigNum({ value, unit }: { value: string | number; unit?: string }) {
  return (
    <Text style={cs.big}>{value}{unit ? <Text style={cs.bigUnit}> {unit}</Text> : null}</Text>
  );
}

function EditDot({ on, onPress }: { on: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} hitSlop={8}><Text style={[cs.editDot, { color: on ? RT.ink3 : ACCENT }]}>{on ? '추가' : '숨김'}</Text></Pressable>;
}

export function Card({ title, caption, chip, right, editing, hidden, onHide, children }: {
  title: string; caption?: string; chip?: { tone?: string; label: string }; right?: React.ReactNode;
  editing?: boolean; hidden?: boolean; onHide?: () => void; children: React.ReactNode;
}) {
  return (
    <View style={[cs.card, editing && hidden && { opacity: 0.4 }]}>
      <View style={cs.head}>
        <Text style={cs.title}>{title}</Text>
        {chip && !editing && <View style={{ marginLeft: 'auto' }}><StatusChip tone={chip.tone} label={chip.label} /></View>}
        {right && !editing && !chip && <View style={{ marginLeft: 'auto' }}>{right}</View>}
        {editing && onHide && <View style={{ marginLeft: 'auto' }}><EditDot on={!!hidden} onPress={onHide} /></View>}
      </View>
      {!!caption && <Text style={cs.caption}>{caption}</Text>}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

export function Tile({ v, l, sub, tone }: { v: string; l: string; sub?: string; tone?: string }) {
  return (
    <View style={cs.tile}>
      <Text style={[cs.tileV, tone && { color: toneColor(tone) }]}>{v}</Text>
      <Text style={cs.tileL} numberOfLines={1}>{l}</Text>
      {!!sub && <Text style={cs.tileSub}>{sub}</Text>}
    </View>
  );
}

// ── 링(상태색) ─────────────────────────────────────────────────────────
export function Ring({ pct, label, tone }: { pct: number; label: string; tone?: string }) {
  const size = 100, sw = 9, rad = (size - sw) / 2, circ = 2 * Math.PI * rad;
  const color = toneColor(tone);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={RT.track} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={color} strokeWidth={sw} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - Math.min(100, pct) / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={cs.ringPct}>{pct}%</Text><Text style={cs.ringLbl}>{label}</Text>
      </View>
    </View>
  );
}

// ── 도넛(분배 — c1~c5) ─────────────────────────────────────────────────
export function Donut({ slices }: { slices: { label: string; pct: number; rank: number }[] }) {
  const size = 108, sw = 22, rad = (size - sw) / 2, circ = 2 * Math.PI * rad;
  let acc = 0;
  return (
    <View style={cs.donutRow}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={RT.track} strokeWidth={sw} fill="none" />
        {slices.map((s, i) => {
          const len = (s.pct / 100) * circ;
          const el = (
            <Circle key={i} cx={size / 2} cy={size / 2} r={rad} stroke={catColor(s.rank)} strokeWidth={sw} fill="none"
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
          acc += len;
          return el;
        })}
      </Svg>
      <View style={cs.legend}>
        {slices.map((s, i) => (
          <View key={i} style={cs.legRow}>
            <View style={[cs.legDot, { backgroundColor: catColor(s.rank) }]} />
            <Text style={cs.legName}>{s.label}</Text>
            <Text style={cs.legPct}>{s.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 세로 막대(단일 톤) ──────────────────────────────────────────────────
export function VBars({ data, height = 84, maxOverride }: {
  data: { label: string; value: number; color?: string; sub?: string }[]; height?: number; maxOverride?: number;
}) {
  const max = maxOverride ?? Math.max(...data.map(d => d.value), 1);
  return (
    <View style={[cs.vbars, { height }]}>
      {data.map((d, i) => (
        <View key={i} style={cs.vcol}>
          <Text style={cs.vct}>{d.sub ?? (d.value || '')}</Text>
          <View style={[cs.vbar, { height: `${d.value ? Math.max(6, (d.value / max) * 100) : 5}%`, backgroundColor: d.color ?? RT.c2 }]} />
          <Text style={cs.vdy}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── 스택바(분배) ────────────────────────────────────────────────────────
export function StackedBar({ segments }: { segments: { pct: number; color: string; label?: string; dark?: boolean }[] }) {
  return (
    <View style={cs.stack}>
      {segments.map((s, i) => s.pct > 0 && (
        <View key={i} style={{ width: `${s.pct}%`, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
          {!!s.label && <Text style={[cs.stackTxt, { color: s.dark ? '#06270d' : RT.ink2 }]} numberOfLines={1}>{s.label}</Text>}
        </View>
      ))}
    </View>
  );
}

// ── 밸런스 분할 막대 ────────────────────────────────────────────────────
export function BalanceSplit({ leftLabel, leftPct, rightLabel, rightPct }: { leftLabel: string; leftPct: number; rightLabel: string; rightPct: number }) {
  // 주축(큰 쪽) c1, 보조 c4
  const leftMain = leftPct >= rightPct;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={cs.balLab}><Text style={cs.balL}>{leftLabel}</Text><Text style={cs.balL}>{rightLabel}</Text></View>
      <View style={cs.balTrack}>
        <View style={{ width: `${leftPct}%`, backgroundColor: leftMain ? RT.c1 : RT.c4 }} />
        <View style={{ width: `${rightPct}%`, backgroundColor: leftMain ? RT.c4 : RT.c1 }} />
      </View>
      <View style={[cs.balLab, { marginTop: 5 }]}><Text style={cs.balV}>{leftPct}%</Text><Text style={cs.balV}>{rightPct}%</Text></View>
    </View>
  );
}

// ── 진행바 ─────────────────────────────────────────────────────────────
export function ProgressRow({ name, value, pct, tone }: { name: string; value: string; pct: number; tone?: string }) {
  return (
    <View style={cs.prow}>
      <View style={cs.plab}><Text style={cs.pname}>{name}</Text><Text style={cs.pval}>{value}</Text></View>
      <View style={cs.ptrack}><View style={[cs.pfill, { width: `${Math.min(100, pct)}%`, backgroundColor: toneColor(tone) }]} /></View>
    </View>
  );
}

// ── 하드세트 권장밴드 막대 ──────────────────────────────────────────────
export function BandRow({ part, sets, max = 25, status }: { part: string; sets: number; max?: number; status: string }) {
  const color = status === 'low' ? RT.bad : status === 'over' ? RT.warn : RT.good;
  return (
    <View style={cs.bandRow}>
      <Text style={cs.bandPart}>{part}</Text>
      <View style={cs.bandTrack}>
        <View style={cs.bandZone} />
        <View style={[cs.bandFill, { width: `${Math.min(100, (sets / max) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[cs.bandNum, { color }]}>{sets}</Text>
      {status !== 'ok' && <Text style={[cs.bandBadge, { color }]}>{status === 'low' ? '부족' : '많음'}</Text>}
    </View>
  );
}

// ── 스파크라인 ──────────────────────────────────────────────────────────
export function Sparkline({ points, color = RT.c3, height = 22 }: { points: number[]; color?: string; height?: number }) {
  const max = Math.max(...points, 1);
  return (
    <View style={[cs.spark, { height }]}>
      {points.slice(-8).map((p, i) => <View key={i} style={[cs.sparkBar, { height: `${Math.max(8, (p / max) * 100)}%`, backgroundColor: color }]} />)}
    </View>
  );
}

// ── 라인 차트(+ 목표 밴드) ──────────────────────────────────────────────
export function MiniLine({ points, color = RT.good, band, height = 76 }: { points: number[]; color?: string; band?: [number, number]; height?: number }) {
  if (!points || points.length < 2) return null;
  const W = 300, pad = 8;
  const vals = band ? [...points, band[0], band[1]] : points;
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(0.1, max - min);
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const pts = points.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <View style={{ marginTop: 4 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
        {band && <Rect x={0} y={y(band[1])} width={W} height={Math.max(2, y(band[0]) - y(band[1]))} fill="rgba(48,209,88,0.14)" rx={4} />}
        <Polyline points={pts} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} />)}
      </Svg>
    </View>
  );
}

// ── 출석 스트립 ─────────────────────────────────────────────────────────
export function Strip({ cells }: { cells: number[] }) {
  return (
    <View style={cs.strip}>
      {cells.map((on, i) => <View key={i} style={[cs.stripCell, on ? { backgroundColor: RT.good } : null]} />)}
    </View>
  );
}

// ── 스탯 그리드 ─────────────────────────────────────────────────────────
export function StatGrid({ items }: { items: { v: string; l: string; tone?: string }[] }) {
  return (
    <View style={cs.statg}>
      {items.map((s, i) => (
        <View key={i} style={cs.stat}><Text style={[cs.statV, s.tone && { color: toneColor(s.tone) }]}>{s.v}</Text><Text style={cs.statL}>{s.l}</Text></View>
      ))}
    </View>
  );
}

const cs = StyleSheet.create({
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 9, paddingHorizontal: 4 },
  eyebrow: { color: RT.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  eyebrowLine: { flex: 1, height: 1, backgroundColor: RT.hair },

  chip: { fontSize: 11.5, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  delta: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  big: { color: RT.ink, fontSize: 31, fontWeight: '800', letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  bigUnit: { color: RT.ink2, fontSize: 15, fontWeight: '700' },
  editDot: { fontSize: 11.5, fontWeight: '800' },

  card: { backgroundColor: RT.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: RT.hair, marginBottom: 11 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: RT.ink, fontSize: 15.5, fontWeight: '700', letterSpacing: -0.1 },
  caption: { color: RT.ink3, fontSize: 12, marginTop: 3 },

  tile: { flexGrow: 1, minWidth: '30%', backgroundColor: RT.surface2, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  tileV: { color: RT.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  tileL: { color: RT.ink2, fontSize: 11, marginTop: 3 },
  tileSub: { color: RT.ink3, fontSize: 10, marginTop: 1, fontVariant: ['tabular-nums'] },

  ringPct: { color: RT.ink, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLbl: { color: RT.ink2, fontSize: 10.5, marginTop: 1 },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  legend: { flex: 1 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  legName: { color: RT.ink2, fontSize: 13, flex: 1 },
  legPct: { color: RT.ink, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },

  vbars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  vcol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 5 },
  vbar: { width: '100%', maxWidth: 44, borderRadius: 5, minHeight: 5 },
  vct: { color: RT.ink2, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  vdy: { color: RT.ink3, fontSize: 10.5 },

  stack: { flexDirection: 'row', height: 28, borderRadius: 8, overflow: 'hidden' },
  stackTxt: { fontSize: 11, fontWeight: '800' },

  balLab: { flexDirection: 'row', justifyContent: 'space-between' },
  balL: { color: RT.ink2, fontSize: 12.5 },
  balV: { color: RT.ink, fontSize: 12.5, fontWeight: '800' },
  balTrack: { flexDirection: 'row', height: 14, borderRadius: 999, overflow: 'hidden', backgroundColor: '#26262b', marginTop: 6 },

  prow: { marginBottom: 14 },
  plab: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  pname: { color: RT.ink, fontSize: 13, fontWeight: '600' },
  pval: { color: RT.ink2, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ptrack: { height: 10, backgroundColor: '#26262b', borderRadius: 999, overflow: 'hidden' },
  pfill: { height: '100%', borderRadius: 999 },

  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  bandPart: { color: RT.ink, fontSize: 14, width: 38 },
  bandTrack: { flex: 1, height: 14, justifyContent: 'center' },
  bandZone: { position: 'absolute', left: '40%', width: '40%', top: 0, bottom: 0, backgroundColor: 'rgba(48,209,88,0.16)', borderRadius: 999 },
  bandFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  bandNum: { fontSize: 14, fontWeight: '800', width: 26, textAlign: 'right', fontVariant: ['tabular-nums'] },
  bandBadge: { fontSize: 11, fontWeight: '700', width: 28 },

  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  sparkBar: { flex: 1, borderRadius: 2 },

  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  stripCell: { width: 8, height: 16, borderRadius: 3, backgroundColor: '#26262b' },

  statg: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  stat: { width: '31%', flexGrow: 1, backgroundColor: RT.surface2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  statV: { color: RT.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statL: { color: RT.ink2, fontSize: 10.5, marginTop: 4 },
});
