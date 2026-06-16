import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AI, ACCENT, COLORS } from '../../constants/colors';
import type { AiReportV2 } from '../../db/api/ai';

const UP = COLORS.green;
const WARN = '#FF9F0A';

/** 리포트 3서브탭(브리핑·데이터·코치) — period.type 무관 단일 렌더. */
export default function ReportTabs({ r, onAsk }: { r: AiReportV2; onAsk?: () => void }) {
  const [tab, setTab] = useState<'brief' | 'data' | 'coach'>('brief');
  return (
    <View>
      <View style={styles.seg}>
        {([['brief', '브리핑'], ['data', '데이터'], ['coach', '코치']] as const).map(([k, label]) => (
          <Pressable key={k} style={[styles.segItem, tab === k && styles.segItemOn]} onPress={() => setTab(k)}>
            <Text style={[styles.segText, tab === k && styles.segTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'brief' && <BriefTab r={r} />}
      {tab === 'data' && <DataTab r={r} />}
      {tab === 'coach' && <CoachTab r={r} onAsk={onAsk} />}
    </View>
  );
}

// ── 브리핑 ──────────────────────────────────────────────────────────
function BriefTab({ r }: { r: AiReportV2 }) {
  const c = r.consistency;
  const stallN = r.detail.stagnation?.length ?? 0;
  const vol = r.detail.trends?.find(t => t.metric.includes('볼륨'))?.points.map(p => p.y) ?? [];
  const w = r.bodyComposition?.weight;
  return (
    <View>
      <Text style={styles.hero}>{r.headline}</Text>
      <View style={styles.kpiGrid}>
        <Kpi v={c ? `${c.attendancePct}%` : '–'} l="출석률" sub={c ? `${c.sessions}/${c.planned}` : undefined} tone={c && c.attendancePct < 80 ? 'warn' : 'up'} />
        <Kpi v={w?.current != null ? `${w.current}kg` : '–'} l="체중" sub={w?.delta ?? undefined} />
        <KpiSpark points={vol} l="주간 볼륨" />
        <Kpi v={`${stallN}건`} l="정체 종목" tone={stallN > 0 ? 'warn' : 'up'} />
      </View>
      {!!r.summary.oneLiner && (
        <View style={styles.insight}><Text style={styles.insightK}>진단</Text><Text style={styles.insightX}>{r.summary.oneLiner}</Text></View>
      )}
      {!!r.prescription?.action && (
        <View style={[styles.insight, styles.rxInsight]}><Text style={[styles.insightK, { color: ACCENT }]}>처방</Text><Text style={styles.insightX}>{r.prescription.action}</Text></View>
      )}
      <Text style={styles.drill}>숫자는 데이터 탭 · 해설은 코치 탭</Text>
    </View>
  );
}

// ── 데이터 ──────────────────────────────────────────────────────────
function DataTab({ r }: { r: AiReportV2 }) {
  const c = r.consistency;
  const bc = r.bodyComposition;
  return (
    <View style={{ gap: 12 }}>
      {/* 일관성 */}
      {c && (
        <Card title="🎯 일관성" badge={c.attendancePct < 80 ? { text: '주의', tone: 'warn' } : undefined}>
          <View style={styles.ringRow}>
            <Ring pct={c.attendancePct} />
            <View style={styles.tiles}>
              <Tile v={`${c.sessions}/${c.planned}`} l="세션" />
              <Tile v={`${c.longestGapDays}일`} l="최장 공백" tone={c.longestGapDays >= 5 ? 'bad' : undefined} />
              <Tile v={`${c.weeklyAvg}`} l="주 평균" />
              <Tile v={`${c.streak}`} l="연속" />
            </View>
          </View>
          {c.strip.length > 0 && (
            <View style={styles.strip}>
              {c.strip.map((on, i) => <View key={i} style={[styles.stripCell, on ? styles.stripOn : null]} />)}
            </View>
          )}
        </Card>
      )}

      {/* 부위 하드세트/주 */}
      {r.detail.balance && (
        <Card title="🏋️ 부위 하드세트 / 주" sub="권장 10–20">
          {r.detail.balance.map((b, i) => {
            const color = b.status === 'low' ? COLORS.red : b.status === 'over' ? WARN : UP;
            const pct = Math.min(100, (b.sets / 20) * 100);
            return (
              <View key={i} style={styles.barRow}>
                <Text style={styles.barPart}>{b.part}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barBand]} />
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.barNum, { color }]}>{b.sets}</Text>
                {b.status !== 'ok' && <Text style={[styles.barBadge, { color }]}>{b.status === 'low' ? '부족' : '많음'}</Text>}
              </View>
            );
          })}
        </Card>
      )}

      {/* 체성분 */}
      {bc && bc.display !== 'none' && bc.weight && (
        <Card title="📉 체성분">
          <View style={styles.bodyTop}>
            <Text style={styles.bodyWeight}>{bc.weight.current}<Text style={styles.bodyUnit}>kg</Text></Text>
            {!!bc.weight.delta && <Text style={[styles.bodyDelta, { color: (bc.weight.delta.startsWith('-') ? UP : AI.textSub) }]}>{bc.weight.delta}</Text>}
          </View>
          <View style={styles.tiles}>
            {bc.bodyFat?.current != null && <Tile v={`${bc.bodyFat.current}%`} l="체지방" />}
            {bc.waist?.current != null && <Tile v={`${bc.waist.current}`} l="허리(cm)" sub={bc.waist.delta ?? undefined} />}
            {!!bc.recomp && <Tile v="↓" l={bc.recomp} />}
          </View>
        </Card>
      )}

      {/* 종목 추적 */}
      {(r.detail.growth || r.detail.stagnation) && (
        <Card title="📈 종목">
          {r.detail.growth?.map((g, i) => (
            <View key={'g' + i} style={styles.exRow}><Text style={styles.exName}>{g.name}</Text><Text style={[styles.exVal, { color: UP }]}>{g.change}</Text></View>
          ))}
          {r.detail.stagnation?.map((s, i) => (
            <View key={'s' + i} style={styles.exRow}><Text style={styles.exName}>{s.name}</Text><Text style={[styles.exVal, { color: WARN }]}>{s.weeksFlat}주 정체</Text></View>
          ))}
        </Card>
      )}
    </View>
  );
}

// ── 코치 ────────────────────────────────────────────────────────────
const CHAPTERS = [
  { n: 1, label: '진단 · 무슨 일이 있었나' },
  { n: 2, label: '처방 · 뭘 하면 되나' },
  { n: 3, label: '계속 가기 · 동기' },
];
function CoachTab({ r, onAsk }: { r: AiReportV2; onAsk?: () => void }) {
  const items = r.coaching ?? [];
  return (
    <View>
      <View style={styles.coachBanner}>
        <Text style={styles.coachBannerText}>🤖 애널리스트가 이렇게 읽었어</Text>
      </View>
      {CHAPTERS.map(ch => {
        const chItems = items.filter(it => it.chapter === ch.n);
        if (chItems.length === 0) return null;
        return (
          <View key={ch.n} style={styles.chapter}>
            <Text style={styles.chapterTitle}><Text style={styles.chapterNum}>{ch.n}</Text>  {ch.label}</Text>
            {chItems.map((it, i) => {
              const isAction = it.key === 'action';
              return (
                <View key={i} style={[styles.node, isAction && styles.nodeAction]}>
                  <View style={styles.nodeHead}>
                    <Text style={styles.nodeTitle}>{it.icon} {it.title}</Text>
                    {!!it.badge && <Text style={styles.nodeBadge}>{it.badge}</Text>}
                  </View>
                  <Text style={[styles.nodeBody, isAction && styles.nodeBodyAction]}>{it.body}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
      {r.suggestedQuestions?.length > 0 && (
        <>
          <Text style={styles.qrLabel}>이 기간 추천 질문</Text>
          <View style={styles.qr}>
            {r.suggestedQuestions.map((q, i) => (
              <Pressable key={i} style={styles.qrChip} onPress={onAsk}><Text style={styles.qrText}>{q}</Text></Pressable>
            ))}
          </View>
        </>
      )}
      {onAsk && (
        <Pressable style={styles.ask} onPress={onAsk}><Text style={styles.askText}>💬 애널리스트랑 대화 이어가기</Text></Pressable>
      )}
    </View>
  );
}

// ── 공용 ────────────────────────────────────────────────────────────
function Card({ title, sub, badge, children }: { title: string; sub?: string; badge?: { text: string; tone: string }; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {sub && <Text style={styles.cardSub}>{sub}</Text>}
        {badge && <Text style={styles.cardBadge}>{badge.text}</Text>}
      </View>
      {children}
    </View>
  );
}
function Kpi({ v, l, sub, tone }: { v: string; l: string; sub?: string; tone?: 'up' | 'warn' }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiV, tone === 'warn' && { color: WARN }, tone === 'up' && { color: UP }]}>{v}</Text>
      <Text style={styles.kpiL}>{l}</Text>
      {!!sub && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
}
function KpiSpark({ points, l }: { points: number[]; l: string }) {
  const max = Math.max(...points, 1);
  return (
    <View style={styles.kpi}>
      <View style={styles.spark}>
        {points.slice(-6).map((p, i) => <View key={i} style={[styles.sparkBar, { height: `${Math.max(8, (p / max) * 100)}%` }]} />)}
      </View>
      <Text style={styles.kpiL}>{l}</Text>
    </View>
  );
}
function Tile({ v, l, sub, tone }: { v: string; l: string; sub?: string; tone?: 'bad' }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileV, tone === 'bad' && { color: COLORS.red }]}>{v}</Text>
      <Text style={styles.tileL} numberOfLines={1}>{l}</Text>
      {!!sub && <Text style={styles.tileSub}>{sub}</Text>}
    </View>
  );
}
function Ring({ pct }: { pct: number }) {
  const size = 84, sw = 9, rad = (size - sw) / 2, circ = 2 * Math.PI * rad;
  const color = pct >= 90 ? UP : pct >= 80 ? UP : WARN;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke="#2C2C2E" strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={rad} stroke={color} strokeWidth={sw} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={styles.ringPct}>{pct}%</Text>
        <Text style={styles.ringLbl}>출석</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: AI.bubble, borderRadius: 12, padding: 4, marginBottom: 16 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segItemOn: { backgroundColor: '#fff' },
  segText: { color: AI.textSub, fontSize: 13.5, fontWeight: '700' },
  segTextOn: { color: '#000' },

  hero: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 30, letterSpacing: -0.4, marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  kpi: { width: '48%', backgroundColor: AI.card, borderRadius: 12, padding: 14, minHeight: 72, justifyContent: 'center' },
  kpiV: { color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  kpiL: { color: AI.textSub, fontSize: 11.5, marginTop: 3 },
  kpiSub: { color: AI.faint, fontSize: 11, marginTop: 1, fontVariant: ['tabular-nums'] },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 26 },
  sparkBar: { flex: 1, backgroundColor: WARN, borderRadius: 2, opacity: 0.9 },

  insight: { backgroundColor: AI.card, borderRadius: 12, padding: 13, marginBottom: 8 },
  rxInsight: { borderLeftWidth: 3, borderLeftColor: ACCENT },
  insightK: { color: AI.textSub, fontSize: 10.5, fontWeight: '800' },
  insightX: { color: '#EDEDF0', fontSize: 14, lineHeight: 20, marginTop: 4 },
  drill: { color: AI.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },

  card: { backgroundColor: AI.card, borderRadius: 14, padding: 15 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cardSub: { color: AI.textSub, fontSize: 11, marginLeft: 8 },
  cardBadge: { marginLeft: 'auto', color: WARN, fontSize: 11, fontWeight: '800', backgroundColor: 'rgba(255,159,10,.12)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },

  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringPct: { color: '#fff', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ringLbl: { color: AI.textSub, fontSize: 10 },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { flexGrow: 1, minWidth: '30%', backgroundColor: AI.bubble, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  tileV: { color: '#fff', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileL: { color: AI.textSub, fontSize: 10, marginTop: 2 },
  tileSub: { color: AI.faint, fontSize: 9.5, marginTop: 1 },

  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 12 },
  stripCell: { width: 7, height: 12, borderRadius: 2, backgroundColor: '#26262B' },
  stripOn: { backgroundColor: UP },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  barPart: { color: '#EDEDF0', fontSize: 12, width: 34 },
  barTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: AI.bubble, overflow: 'hidden', justifyContent: 'center' },
  barBand: { position: 'absolute', left: '50%', width: '50%', top: 0, bottom: 0, backgroundColor: 'rgba(48,209,88,0.10)' },
  barFill: { height: 9, borderRadius: 5 },
  barNum: { fontSize: 12, fontWeight: '800', width: 22, textAlign: 'right', fontVariant: ['tabular-nums'] },
  barBadge: { fontSize: 10, fontWeight: '700', width: 26 },

  bodyTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  bodyWeight: { color: '#fff', fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bodyUnit: { color: AI.textSub, fontSize: 15, fontWeight: '600' },
  bodyDelta: { fontSize: 13, fontWeight: '700' },

  exRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  exName: { color: '#EDEDF0', fontSize: 13 },
  exVal: { fontSize: 13, fontWeight: '800' },

  coachBanner: { backgroundColor: AI.tint, borderRadius: 10, padding: 11, marginBottom: 14 },
  coachBannerText: { color: ACCENT, fontSize: 12.5, fontWeight: '700' },
  chapter: { marginBottom: 14 },
  chapterTitle: { color: '#fff', fontSize: 13.5, fontWeight: '800', marginBottom: 10 },
  chapterNum: { color: ACCENT },
  node: { backgroundColor: AI.card, borderRadius: 11, padding: 12, marginBottom: 8 },
  nodeAction: { backgroundColor: 'rgba(48,209,88,0.10)', borderWidth: 1, borderColor: 'rgba(48,209,88,0.4)' },
  nodeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nodeTitle: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  nodeBadge: { marginLeft: 'auto', color: WARN, fontSize: 10.5, fontWeight: '800' },
  nodeBody: { color: '#D8D8DD', fontSize: 13, lineHeight: 19, marginTop: 5 },
  nodeBodyAction: { color: '#fff', fontWeight: '600' },

  qrLabel: { color: AI.faint, fontSize: 10, marginTop: 4, marginBottom: 6 },
  qr: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  qrChip: { borderColor: ACCENT, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  qrText: { color: ACCENT, fontSize: 12.5, fontWeight: '600' },
  ask: { marginTop: 14, backgroundColor: ACCENT, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  askText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
