import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AI } from '../constants/colors';
import type { AiReportV2 } from '../db/api/ai';

const CONF_LABEL: Record<string, string> = { high: '신뢰도 높음', medium: '신뢰도 보통', low: '신뢰도 낮음' };
const HORIZON_LABEL: Record<string, string> = {
  nextSession: '다음 운동', thisWeek: '이번 주', nextMonth: '다음 달', nextQuarter: '다음 분기', nextYear: '내년',
};

function fmtMD(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** 통합 리포트(명세 §7) 2층 렌더 — period.type 무관 단일 컴포넌트. */
export default function ReportView({ r, onAsk }: { r: AiReportV2; onAsk?: () => void }) {
  const [open, setOpen] = useState(false);
  const low = r.confidence === 'low';
  const d = r.detail;
  const hasDetail =
    (d.timeline?.length ?? 0) > 0 || d.exercises || d.balance || d.growth || d.stagnation ||
    d.milestones || d.trends || r.bodyComposition?.weight || r.goalProgress;

  return (
    <View>
      {/* ── ① 요약/회고 층 ── */}
      <Text style={styles.period}>{r.period.label} · {fmtMD(r.period.start)}–{fmtMD(r.period.end)}</Text>
      <Text style={styles.headline}>{r.headline}</Text>

      {low && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>⚠ {CONF_LABEL[r.confidence]}</Text>
        </View>
      )}
      {low && r.dataCaveat && <Text style={styles.caveat}>ⓘ {r.dataCaveat}</Text>}

      {r.summary.score && (
        <View style={styles.scoreRow}>
          <Text style={styles.scoreV}>{r.summary.score.value}{r.summary.score.unit}</Text>
          <Text style={styles.scoreL}>{r.summary.score.label}</Text>
        </View>
      )}

      {r.summary.metrics.length > 0 && (
        <View style={styles.mx}>
          {r.summary.metrics.slice(0, 3).map((m, i) => (
            <View key={i} style={styles.m}>
              <Text style={styles.mv}>{m.value}</Text>
              <Text style={styles.ml}>{m.label}</Text>
              {m.delta && (
                <Text style={[styles.md, m.direction === 'down' ? styles.dDown : m.direction === 'up' ? styles.dUp : styles.dFlat]}>
                  {m.delta}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {!!r.summary.oneLiner && (
        <View style={styles.aibox}>
          <Text style={styles.aiK}>🤖 애널리스트</Text>
          <Text style={styles.aiX}>{r.summary.oneLiner}</Text>
        </View>
      )}

      {/* 처방 — 항상 1개 */}
      <View style={styles.rx}>
        <Text style={styles.rxCap}>💊 {HORIZON_LABEL[r.prescription.horizon] ?? '처방'} 딱 하나</Text>
        <Text style={styles.rxAct}>{r.prescription.action}</Text>
        {!!r.prescription.todo && <Text style={styles.rxTodo}>{r.prescription.todo}</Text>}
      </View>

      {/* ── ② 펼치기 상세 층 ── */}
      {hasDetail && (
        <Pressable style={styles.toggle} onPress={() => setOpen(o => !o)}>
          <Text style={styles.toggleText}>{open ? '상세 접기 ▴' : '상세 보기 ▾'}</Text>
        </Pressable>
      )}

      {open && (
        <View style={styles.detail}>
          {d.exercises && (
            <Section title="종목별">
              {d.exercises.map((e, i) => (
                <View key={i} style={styles.lineRow}>
                  <Text style={styles.lineName}>{e.name}{e.isPR ? ' 🏅' : ''}</Text>
                  <Text style={styles.exSets}>{e.sets}{e.prevDelta ? ` · ${e.prevDelta}` : ''}</Text>
                </View>
              ))}
            </Section>
          )}

          {r.goalProgress && (
            <Section title="🎯 목표 진척">
              <View style={styles.gauge}><View style={[styles.gaugeFill, { width: `${Math.round(r.goalProgress.value * 100)}%` }]} /></View>
              <Text style={styles.goalLabel}>{r.goalProgress.goalLabel} · {Math.round(r.goalProgress.value * 100)}%</Text>
              {!!r.goalProgress.comment && <Text style={styles.dim}>{r.goalProgress.comment}</Text>}
            </Section>
          )}

          {d.balance && (
            <Section title="부위 밸런스">
              {d.balance.map((b, i) => (
                <View key={i} style={styles.balRow}>
                  <Text style={styles.balPart}>{b.part}</Text>
                  <View style={styles.balBarBg}>
                    <View style={[styles.balBar, { width: `${Math.min(100, (b.sets / Math.max(b.target, 1)) * 100)}%`, backgroundColor: b.status === 'low' ? AI.warn : AI.accent }]} />
                  </View>
                  <Text style={styles.balNum}>{b.sets}/{b.target}</Text>
                </View>
              ))}
            </Section>
          )}

          {d.growth && (
            <Section title="성장 종목">
              {d.growth.map((g, i) => (
                <View key={i} style={styles.lineRow}><Text style={styles.lineName}>{g.name}</Text><Text style={styles.up}>{g.change}</Text></View>
              ))}
            </Section>
          )}

          {d.stagnation && (
            <Section title="정체 구간">
              {d.stagnation.map((s, i) => (
                <View key={i} style={styles.lineRow}><Text style={styles.lineName}>{s.name}</Text><Text style={styles.warn}>{s.weeksFlat}주째</Text></View>
              ))}
            </Section>
          )}

          {d.milestones && (
            <Section title="마일스톤">
              {d.milestones.map((m, i) => <Text key={i} style={styles.milestone}>{m.icon} {m.text}</Text>)}
            </Section>
          )}

          {d.trends && d.trends.map((t, ti) => (
            <Section key={ti} title={`추세 · ${t.metric}`}>
              <Sparkline points={t.points.map(p => p.y)} />
            </Section>
          ))}

          {r.bodyComposition && r.bodyComposition.display !== 'none' && r.bodyComposition.weight && (
            <Section title="체성분">
              <View style={styles.lineRow}>
                <Text style={styles.lineName}>체중</Text>
                <Text style={styles.lineName}>{r.bodyComposition.weight.current}kg {r.bodyComposition.weight.delta ?? ''}</Text>
              </View>
              {r.bodyComposition.bodyFat?.current != null && (
                <View style={styles.lineRow}><Text style={styles.lineName}>체지방</Text><Text style={styles.lineName}>{r.bodyComposition.bodyFat.current}%</Text></View>
              )}
              {!!r.bodyComposition.comment && <Text style={styles.dim}>{r.bodyComposition.comment}</Text>}
            </Section>
          )}

          {!!r.notesQuote && (
            <Section title="메모">
              <Text style={styles.quote}>“{r.notesQuote}”</Text>
            </Section>
          )}
        </View>
      )}

      {onAsk && (
        <Pressable style={styles.ask} onPress={onAsk}>
          <Text style={styles.askText}>💬 이 기간에 대해 물어보기</Text>
        </Pressable>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  return (
    <View style={styles.spark}>
      {points.map((v, i) => (
        <View key={i} style={[styles.sparkBar, { height: `${Math.max(6, (v / max) * 100)}%` }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  period: { color: AI.textSub, fontSize: 12, fontVariant: ['tabular-nums'] },
  headline: { color: '#fff', fontSize: 21, fontWeight: '800', lineHeight: 28, marginTop: 4 },
  badge: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(255,159,10,.12)', borderColor: 'rgba(255,159,10,.35)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: '#E0A33A', fontSize: 11.5, fontWeight: '700' },
  caveat: { color: '#E0A33A', fontSize: 12, lineHeight: 18, marginTop: 6 },

  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 },
  scoreV: { color: '#fff', fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreL: { color: AI.textSub, fontSize: 13 },

  mx: { flexDirection: 'row', gap: 8, marginTop: 14 },
  m: { flex: 1, backgroundColor: AI.bubble, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  mv: { color: '#fff', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ml: { color: AI.textSub, fontSize: 10.5, marginTop: 3 },
  md: { fontSize: 11, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  dDown: { color: AI.danger }, dUp: { color: '#30D158' }, dFlat: { color: AI.faint },

  aibox: { backgroundColor: AI.bubble, borderLeftWidth: 3, borderLeftColor: AI.accent, borderRadius: 10, padding: 12, marginTop: 14 },
  aiK: { color: AI.accent, fontSize: 10.5, fontWeight: '800' },
  aiX: { color: '#E6E6EA', fontSize: 13.5, lineHeight: 20, marginTop: 5 },

  rx: { backgroundColor: AI.tint, borderColor: AI.accent, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 12 },
  rxCap: { color: AI.accent, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  rxAct: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  rxTodo: { color: AI.textSub, fontSize: 12.5, lineHeight: 18, marginTop: 6 },

  toggle: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  toggleText: { color: AI.accent, fontSize: 13, fontWeight: '700' },

  detail: { gap: 4 },
  section: { backgroundColor: AI.card, borderRadius: 12, padding: 13, marginBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 10 },
  dim: { color: AI.textSub, fontSize: 12, lineHeight: 18, marginTop: 6 },

  gauge: { height: 8, borderRadius: 4, backgroundColor: AI.bubble, overflow: 'hidden' },
  gaugeFill: { height: 8, backgroundColor: AI.accent, borderRadius: 4 },
  goalLabel: { color: '#fff', fontSize: 12.5, fontWeight: '700', marginTop: 8 },

  balRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balPart: { color: '#EDEDF0', fontSize: 12, width: 36 },
  balBarBg: { flex: 1, height: 7, borderRadius: 4, backgroundColor: AI.bubble, overflow: 'hidden' },
  balBar: { height: 7, borderRadius: 4 },
  balNum: { color: AI.textSub, fontSize: 11, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },

  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  lineName: { color: '#EDEDF0', fontSize: 13 },
  exSets: { color: AI.textSub, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  up: { color: '#30D158', fontSize: 13, fontWeight: '800' },
  warn: { color: AI.warn, fontSize: 12.5, fontWeight: '700' },
  milestone: { color: '#EDEDF0', fontSize: 13, lineHeight: 22 },

  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 48 },
  sparkBar: { flex: 1, backgroundColor: AI.accent, borderRadius: 2, opacity: 0.85 },

  quote: { color: '#EDEDF0', fontSize: 13.5, fontStyle: 'italic', lineHeight: 20 },

  ask: { marginTop: 14, backgroundColor: AI.accent, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  askText: { color: AI.ink, fontSize: 14, fontWeight: '800' },
});
