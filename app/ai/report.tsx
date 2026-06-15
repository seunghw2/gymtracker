import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../../constants/colors';
import { getLatestAiReport, AiReportResult } from '../../db/queries';

function fmtKorDate(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(m)}월 ${Number(d)}일`;
}

const CONF_LABEL: Record<string, string> = { high: '신뢰도 높음', medium: '신뢰도 보통', low: '신뢰도 낮음' };

export default function AiReportScreen() {
  const router = useRouter();
  const [res, setRes] = useState<AiReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let alive = true;
    setLoading(true);
    getLatestAiReport()
      .then(r => { if (alive) setRes(r); })
      .catch(() => { if (alive) setRes(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []));

  const b = res?.report;
  const low = b?.confidence === 'low';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹ 채팅</Text></Pressable>
        <Text style={styles.title}>상세 리포트</Text>
        <View style={{ width: 52 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={AI.accent} size="large" /></View>
      ) : !b ? (
        <View style={styles.center}><Text style={styles.dim}>표시할 리포트가 없어요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.period}>{fmtKorDate(res?.periodFrom)} – {fmtKorDate(res?.periodTo)}</Text>

          <View style={[styles.badge, low ? styles.badgeLow : styles.badgeOk]}>
            <Text style={[styles.badgeText, low ? styles.badgeTextLow : styles.badgeTextOk]}>
              {low ? '⚠ ' : '● '}{CONF_LABEL[b.confidence] ?? b.confidence}
            </Text>
          </View>

          <Text style={styles.headline}>{b.headline}</Text>
          {low && b.dataCaveat && <Text style={styles.caveat}>ⓘ {b.dataCaveat}</Text>}

          {b.summaryMetrics.length > 0 && (
            <View style={styles.mx}>
              {b.summaryMetrics.slice(0, 3).map((m, i) => (
                <View key={i} style={styles.m}>
                  <Text style={styles.mv}>{m.value}</Text>
                  <Text style={styles.ml}>{m.label}</Text>
                  <Text style={[styles.md, m.direction === 'down' ? styles.dDown : m.direction === 'up' ? styles.dUp : styles.dFlat]}>
                    {m.delta ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {b.strengths.length > 0 && (
            <>
              <Text style={styles.sh}>잘한 점</Text>
              {b.strengths.map((s, i) => (
                <View key={i} style={styles.li}><Text style={[styles.mk, styles.mkGood]}>▲</Text><Text style={styles.liText}>{s}</Text></View>
              ))}
            </>
          )}

          {b.watchouts.length > 0 && (
            <>
              <Text style={styles.sh}>주의</Text>
              {b.watchouts.map((s, i) => (
                <View key={i} style={styles.li}><Text style={[styles.mk, styles.mkWarn]}>●</Text><Text style={styles.liText}>{s}</Text></View>
              ))}
            </>
          )}

          {(res?.stagnation ?? []).map((g, i) => (
            <View key={i} style={styles.stag}>
              <Text style={styles.stagText}>⚡ 정체 — {g.exercise} {g.weeksFlat}주째 flat</Text>
            </View>
          ))}

          <View style={styles.rx}>
            <Text style={styles.rxCap}>💊 처방</Text>
            <Text style={styles.rxAct}>{b.prescription.action}</Text>
            <Text style={styles.rxRow}><Text style={styles.rxK}>왜</Text> · {b.prescription.why}</Text>
            <Text style={styles.rxRow}><Text style={styles.rxK}>이번 주</Text> · {b.prescription.thisWeek}</Text>
          </View>

          {res?.notesQuote && <Text style={styles.memo}>🗒 “{res.notesQuote}”</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 15, fontWeight: '600', width: 52 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: AI.textSub, fontSize: 14 },

  body: { padding: 16, paddingBottom: 48 },
  period: { color: AI.textSub, fontSize: 12, fontVariant: ['tabular-nums'], marginBottom: 10 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  badgeLow: { backgroundColor: 'rgba(255,159,10,.14)', borderColor: 'rgba(255,159,10,.4)' },
  badgeOk: { backgroundColor: 'rgba(48,209,88,.14)', borderColor: 'rgba(48,209,88,.4)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextLow: { color: AI.warn }, badgeTextOk: { color: '#30D158' },

  headline: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 30, letterSpacing: -0.3, marginTop: 12 },
  caveat: { color: '#E0A33A', fontSize: 12.5, lineHeight: 19, marginTop: 10 },

  mx: { flexDirection: 'row', gap: 8, marginTop: 16 },
  m: { flex: 1, backgroundColor: AI.bubble, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  mv: { color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  ml: { color: AI.textSub, fontSize: 11, marginTop: 4 },
  md: { fontSize: 11, fontWeight: '700', marginTop: 5, fontVariant: ['tabular-nums'] },
  dDown: { color: AI.danger }, dUp: { color: '#30D158' }, dFlat: { color: AI.faint },

  sh: { color: AI.textSub, fontSize: 13, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  li: { flexDirection: 'row', gap: 9, backgroundColor: AI.card, borderRadius: 12, padding: 11, marginBottom: 6 },
  mk: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  mkGood: { color: AI.accent }, mkWarn: { color: AI.warn },
  liText: { flex: 1, color: '#E8E8EA', fontSize: 13.5, lineHeight: 20 },

  stag: { backgroundColor: 'rgba(255,69,58,.1)', borderColor: 'rgba(255,69,58,.3)', borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 10 },
  stagText: { color: '#FF8A80', fontSize: 13, fontWeight: '700' },

  rx: { backgroundColor: AI.tint, borderColor: AI.accent, borderWidth: 1.5, borderRadius: 16, padding: 14, marginTop: 18 },
  rxCap: { color: AI.accent, fontSize: 11, fontWeight: '800' },
  rxAct: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 22, marginTop: 7 },
  rxRow: { color: '#D0C6EE', fontSize: 13, lineHeight: 20, marginTop: 7 },
  rxK: { color: '#fff', fontWeight: '700' },

  memo: { color: AI.textSub, fontSize: 12.5, fontStyle: 'italic', marginTop: 14 },
});
