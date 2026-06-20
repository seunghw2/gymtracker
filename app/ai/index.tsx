import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../../constants/colors';
import { generateAiReport, AiReportResult, AiBriefing } from '../../db/queries';

function fmtMD(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default function AiBriefingChat() {
  const router = useRouter();
  const [result, setResult] = useState<AiReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [extra, setExtra] = useState<{ from: 'ai' | 'usr'; text: string }[]>([]);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setExtra([]);
    try {
      const r = await generateAiReport({ force });
      setResult(r);
    } catch {
      setResult({ status: 'FAILED', generatedAt: null, periodFrom: null, periodTo: null, model: null, report: null, stagnation: null, notesQuote: null, message: '네트워크 오류로 생성에 실패했어요.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    // 프로필 설정 후 돌아왔을 때 등 재진입마다 최신 상태로(캐시 있으면 즉시)
    if (result == null) load(false);
  }, [result, load]));

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
      <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.hName}>애널리스트</Text>
        <Text style={styles.hSub}>
          {result?.report ? `${fmtMD(result.periodFrom)}–${fmtMD(result.periodTo)} 브리핑` : '온라인'}
        </Text>
      </View>
      {result?.report && (
        <Pressable onPress={() => load(true)} hitSlop={8}><Text style={styles.refresh}>새로 생성</Text></Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {header}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.center}>
            <View style={styles.typing}><ActivityIndicator color={AI.accent} /></View>
            <Text style={styles.dim}>이번 주 기록을 분석 중…</Text>
          </View>
        ) : result?.status === 'SUCCESS' && result.report ? (
          <Briefing b={result.report} onWhy={(why) => setExtra(e => [...e, { from: 'usr', text: '왜 그런데?' }, { from: 'ai', text: why }])}
            onOk={() => setExtra(e => [...e, { from: 'usr', text: '좋아, 해볼게' }, { from: 'ai', text: '좋아요. 다음 주에 이행했는지 같이 확인할게요. 💪' }])}
            extra={extra}
            onDetail={() => router.push('/ai/reports')} />
        ) : result?.status === 'PROFILE_REQUIRED' ? (
          <Empty icon="🎯" title="먼저 목표를 알려주세요"
            desc={result.message ?? '목표 체형·우선 부위를 설정하면 분석을 시작해요.'}
            cta="설정하기" onPress={() => router.push('/ai/intake')} />
        ) : result?.status === 'INSUFFICIENT_DATA' ? (
          <Empty icon="📭" title="이번 주 기록이 없어요"
            desc={result.message ?? '완료된 운동이 있어야 분석할 수 있어요.'}
            cta="운동하러 가기" onPress={() => router.replace('/workout')} />
        ) : (
          <Empty icon="⚠️" title="브리핑을 만들지 못했어요"
            desc={result?.message ?? '잠시 후 다시 시도해 주세요.'}
            cta="다시 시도" onPress={() => load(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Briefing({ b, extra, onWhy, onOk, onDetail }: {
  b: AiBriefing;
  extra: { from: 'ai' | 'usr'; text: string }[];
  onWhy: (why: string) => void;
  onOk: () => void;
  onDetail: () => void;
}) {
  const [acted, setActed] = useState(false);
  return (
    <View style={styles.chat}>
      <Bubble ai>이번 주 브리핑 나왔어요 👋</Bubble>
      <Bubble ai bold>{b.headline}</Bubble>

      {b.summaryMetrics.length > 0 && (
        <View style={[styles.bub, styles.aiBub, styles.metricBub]}>
          {b.summaryMetrics.slice(0, 3).map((m, i) => (
            <View key={i} style={styles.metric}>
              <Text style={styles.metricV}>{m.value}</Text>
              <Text style={styles.metricL}>
                {m.label}{m.delta ? ' ' : ''}
                {m.delta ? <Text style={[styles.metricD, m.direction === 'down' ? styles.dDown : m.direction === 'up' ? styles.dUp : styles.dFlat]}>{m.delta}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      )}

      {b.watchouts[0] && <Bubble ai>{b.watchouts[0]}</Bubble>}
      {b.confidence === 'low' && b.dataCaveat && (
        <View style={styles.caveat}><Text style={styles.caveatText}>⚠︎ {b.dataCaveat}</Text></View>
      )}

      <View style={[styles.bub, styles.rxBub]}>
        <Text style={styles.rxCap}>💊 이번 주 딱 하나</Text>
        <Text style={styles.rxAct}>{b.prescription.action}</Text>
      </View>

      {extra.map((e, i) => <Bubble key={i} ai={e.from === 'ai'}>{e.text}</Bubble>)}

      {!acted && (
        <View style={styles.qr}>
          <Pressable style={styles.qrBtn} onPress={() => { onWhy(b.prescription.why); }}>
            <Text style={styles.qrText}>왜 그런데?</Text>
          </Pressable>
          <Pressable style={styles.qrBtn} onPress={() => { setActed(true); onOk(); }}>
            <Text style={styles.qrText}>좋아, 해볼게</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.detail} onPress={onDetail}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle}>📊 상세 리포트 보기</Text>
          <Text style={styles.detailSub}>강점·주의·정체까지 데이터로</Text>
        </View>
        <Text style={styles.detailGo}>›</Text>
      </Pressable>
    </View>
  );
}

function Bubble({ children, ai, bold }: { children: React.ReactNode; ai?: boolean; bold?: boolean }) {
  return (
    <View style={[styles.bub, ai ? styles.aiBub : styles.usrBub]}>
      <Text style={[ai ? styles.aiText : styles.usrText, bold && styles.bold]}>{children}</Text>
    </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 30, fontWeight: '400', width: 24, marginTop: -4 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  hName: { color: AI.text, fontSize: 14, fontWeight: '800' },
  hSub: { color: AI.textSub, fontSize: 11, marginTop: 1 },
  refresh: { color: AI.accent, fontSize: 13, fontWeight: '700' },

  body: { padding: 14, paddingBottom: 40, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 6 },
  typing: { width: 64, height: 40, borderRadius: 16, backgroundColor: AI.bubble, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  dim: { color: AI.textSub, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  emptyTitle: { color: AI.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  cta: { marginTop: 20, backgroundColor: AI.accent, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 28 },
  ctaText: { color: AI.ink, fontSize: 15, fontWeight: '800' },

  chat: { gap: 8 },
  bub: { maxWidth: '88%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  aiBub: { alignSelf: 'flex-start', backgroundColor: AI.bubble, borderTopLeftRadius: 5 },
  usrBub: { alignSelf: 'flex-end', backgroundColor: AI.accent, borderTopRightRadius: 5 },
  aiText: { color: '#EDEDF0', fontSize: 14, lineHeight: 20 },
  usrText: { color: AI.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  bold: { fontWeight: '800', color: '#fff' },

  metricBub: { flexDirection: 'row', gap: 16 },
  metric: { alignItems: 'flex-start' },
  metricV: { color: '#fff', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricL: { color: AI.textSub, fontSize: 11, marginTop: 2 },
  metricD: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  dDown: { color: AI.danger }, dUp: { color: '#30D158' }, dFlat: { color: AI.faint },

  caveat: { alignSelf: 'flex-start', maxWidth: '88%', backgroundColor: 'rgba(255,159,10,.10)', borderColor: 'rgba(255,159,10,.3)', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  caveatText: { color: '#E0A33A', fontSize: 12, lineHeight: 18 },

  rxBub: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: AI.tint, borderColor: AI.accent, borderWidth: 1, borderTopLeftRadius: 5 },
  rxCap: { color: AI.accent, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  rxAct: { color: '#fff', fontSize: 14.5, fontWeight: '800', lineHeight: 20 },

  qr: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  qrBtn: { borderColor: AI.accent, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  qrText: { color: AI.accent, fontSize: 13, fontWeight: '700' },

  detail: { marginTop: 12, backgroundColor: AI.bubble, borderColor: AI.accent, borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center' },
  detailTitle: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  detailSub: { color: AI.textSub, fontSize: 11, marginTop: 2 },
  detailGo: { color: AI.accent, fontSize: 20, fontWeight: '800' },
});
