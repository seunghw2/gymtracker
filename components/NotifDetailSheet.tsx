import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { getTrainedExercises, get1RMHistory, getReportV2 } from '../db/queries';
import { parseLinkParams } from '../db/api/notifications';
import { NotifGroup, stallExercise } from '../lib/groupNotifications';
import { useChatStore } from '../store/useChatStore';

const C = { warn: '#FFC53D', bad: '#FF8A00', good: '#2BD96A', rep: '#5b8def', red: '#FF3B30' };
const ICON: Record<string, string> = { REPORT_READY: '📊', STAGNATION: '⚠️', PR: '💪', REMINDER: '🔔' };
const iconBg: Record<string, string> = {
  STAGNATION: 'rgba(255,197,61,0.14)', REPORT_READY: 'rgba(91,141,239,0.16)',
  PR: 'rgba(43,217,106,0.16)', REMINDER: 'rgba(255,138,0,0.16)',
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 새 소식 행 탭 시 뜨는 타입별 리치 디테일 시트(viz + 액션). */
export default function NotifDetailSheet({ group, onClose }: { group: NotifGroup | null; onClose: () => void }) {
  const router = useRouter();
  const findOrCreateByKey = useChatStore(s => s.findOrCreateByKey);
  const [plateau, setPlateau] = useState<number[] | null>(null);
  const [metrics, setMetrics] = useState<{ att: string; attBad: boolean; vol: string; volBad: boolean; streak: string } | null>(null);

  const g = group;
  const ex = g ? (g.type === 'PR' ? g.title.replace(/\s*신기록.*$/, '').trim() : stallExercise(g.body)) : null;

  // viz 데이터 로드
  useEffect(() => {
    setPlateau(null); setMetrics(null);
    if (!g) return;
    if (g.type === 'STAGNATION' && ex) {
      (async () => {
        try {
          const list = await getTrainedExercises();
          const match = list.find(e => e.name === ex);
          if (!match) return;
          const hist = await get1RMHistory(match.id);
          setPlateau(hist.slice(-8).map(p => p.estimated_1rm));
        } catch { /* ignore */ }
      })();
    }
    if (g.type === 'REPORT_READY') {
      (async () => {
        try {
          const type = parseLinkParams(g.linkParams)?.type ?? 'month';
          const r = await getReportV2(type as never);
          const rep = r.report;
          if (!rep) return;
          const c = rep.consistency;
          const volT = (rep.cards?.volumeBars ?? []).reduce((a, b) => a + b.tons, 0);
          setMetrics({
            att: c ? `${c.sessions}/${c.planned}` : '–',
            attBad: !!c && c.attendancePct < 80,
            vol: `${volT.toFixed(1)}t`,
            volBad: (rep.cards?.volumeBars ?? []).some(b => b.tone === 'bad'),
            streak: c ? `${c.streak}` : '–',
          });
        } catch { /* ignore */ }
      })();
    }
  }, [g?.dedupKey]);

  if (!g) return null;

  const pr = g.type === 'PR' ? parsePr(g.body) : null;
  const isStreak = g.type === 'REMINDER' && (g.title.includes('연속') || g.title.includes('🔥'));

  const goChat = async (sourceKey: string, title: string, source: 'alert' | 'report', seed?: string) => {
    const conv = await findOrCreateByKey({ source, sourceKey, title });
    onClose();
    if (conv) router.push({ pathname: '/chat/[conversationId]', params: { conversationId: String(conv.id), title: conv.title, ctx: g.title, ...(seed ? { seed } : {}) } });
  };
  const goExercise = () => { onClose(); if (ex) router.push({ pathname: '/exercise-detail', params: { name: ex } }); };
  const goReport = () => { onClose(); router.push({ pathname: '/ai/reports', params: { type: parseLinkParams(g.linkParams)?.type ?? 'month' } }); };
  const goWorkout = () => { onClose(); router.push('/workout'); };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.dim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grab} />
        <View style={s.body}>
          <View style={[s.icon, { backgroundColor: iconBg[g.type] }]}><Text style={{ fontSize: 19 }}>{ICON[g.type] ?? '🔔'}</Text></View>
          <View style={s.titleRow}>
            <Text style={s.title}>{g.title}</Text>
            {g.count > 1 && <Text style={s.badge}>{g.count}번</Text>}
          </View>
          <Text style={s.bodyText}>{g.body}</Text>
          {g.count > 1 && <Text style={s.dup}>최근 {g.times.slice(0, 3).map(fmtTime).join(' · ')} (묶음)</Text>}

          {/* viz */}
          {g.type === 'STAGNATION' && plateau && plateau.length > 0 && (
            <View style={s.viz}>
              <Text style={s.vizLabel}>{ex} 1RM · 최근 {plateau.length}주</Text>
              <MiniPlateau points={plateau} />
            </View>
          )}
          {g.type === 'PR' && pr && (
            <View style={s.viz}>
              <Text style={s.vizLabel}>추정 1RM</Text>
              <PrCompare prev={pr.prev} now={pr.now} />
            </View>
          )}
          {g.type === 'REPORT_READY' && metrics && (
            <View style={s.viz}>
              <Text style={s.vizLabel}>핵심 지표</Text>
              <View style={s.met}>
                <Metric n={metrics.att} l="출석" bad={metrics.attBad} />
                <Metric n={metrics.vol} l="볼륨" bad={metrics.volBad} />
                <Metric n={metrics.streak} l="스트릭" />
              </View>
            </View>
          )}

          {/* 액션 */}
          <View style={s.acts}>
            {g.type === 'STAGNATION' && <>
              <Pressable style={[s.primary, { backgroundColor: C.red }]} onPress={() => goChat(`stall:${ex}`, `${ex} 정체`, 'alert', `${ex} 정체 어떻게 풀어?`)}><Text style={s.primaryT}>💬 대화로 풀기</Text></Pressable>
              <Pressable style={s.secondary} onPress={goExercise}><Text style={s.secondaryT}>📄 {ex} 기록 보기</Text></Pressable>
            </>}
            {g.type === 'PR' && (
              <Pressable style={[s.primary, { backgroundColor: C.good }]} onPress={goExercise}><Text style={[s.primaryT, { color: '#06210f' }]}>🏆 기록으로 보기</Text></Pressable>
            )}
            {g.type === 'REPORT_READY' && <>
              <Pressable style={[s.primary, { backgroundColor: C.rep }]} onPress={goReport}><Text style={[s.primaryT, { color: '#04122e' }]}>📄 리포트 보기</Text></Pressable>
              <Pressable style={s.secondary} onPress={() => goChat(`report:${parseLinkParams(g.linkParams)?.type ?? 'month'}`, g.title.replace(' 리포트가 나왔어요', ' 회고'), 'report')}><Text style={s.secondaryT}>💬 대화로 풀기</Text></Pressable>
            </>}
            {g.type === 'REMINDER' && (isStreak
              ? <Pressable style={s.secondary} onPress={onClose}><Text style={s.secondaryT}>확인</Text></Pressable>
              : <>
                  <Pressable style={[s.primary, { backgroundColor: C.bad }]} onPress={goWorkout}><Text style={[s.primaryT, { color: '#241a00' }]}>▶ 운동 시작</Text></Pressable>
                  <Pressable style={s.secondary} onPress={onClose}><Text style={s.secondaryT}>나중에</Text></Pressable>
                </>)}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function parsePr(body: string): { prev: number; now: number } | null {
  const m = body.match(/추정\s*1RM\s*([\d.]+).*?이전\s*최고\s*([\d.]+)/);
  if (!m) return null;
  return { now: parseFloat(m[1]), prev: parseFloat(m[2]) };
}

function MiniPlateau({ points }: { points: number[] }) {
  const max = Math.max(...points, 1), min = Math.min(...points);
  const span = Math.max(0.1, max - min);
  return (
    <View style={s.flat}>
      {points.map((p, i) => {
        const h = 40 + ((p - min) / span) * 56;   // 40~96%
        return <View key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 2, backgroundColor: i === points.length - 1 ? C.warn : '#2a2a30' }} />;
      })}
    </View>
  );
}

function PrCompare({ prev, now }: { prev: number; now: number }) {
  const max = Math.max(prev, now, 1);
  return (
    <View style={s.cmp}>
      <View style={s.cmpBar}><Text style={[s.cmpV, { color: '#8a8a8e' }]}>{prev}</Text><View style={{ width: '100%', height: `${(prev / max) * 100}%`, minHeight: 6, borderRadius: 3, backgroundColor: '#3a3a40' }} /></View>
      <View style={s.cmpBar}><Text style={[s.cmpV, { color: C.good }]}>{now} 🏆</Text><View style={{ width: '100%', height: `${(now / max) * 100}%`, minHeight: 6, borderRadius: 3, backgroundColor: C.good }} /></View>
    </View>
  );
}

function Metric({ n, l, bad }: { n: string; l: string; bad?: boolean }) {
  return <View style={s.metBox}><Text style={[s.metN, bad && { color: C.bad }]}>{n}</Text><Text style={s.metL}>{l}</Text></View>;
}

const s = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: '#141416', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, paddingBottom: 26 },
  grab: { width: 36, height: 4, borderRadius: 3, backgroundColor: '#33333a', alignSelf: 'center', marginVertical: 6 },
  body: { paddingHorizontal: 18, paddingTop: 6 },
  icon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  badge: { color: '#fff', fontSize: 9.5, fontWeight: '800', backgroundColor: C.bad, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  bodyText: { color: '#c8c8ce', fontSize: 12.5, lineHeight: 19, marginTop: 7 },
  dup: { color: '#6a6a6e', fontSize: 9.5, marginTop: 7 },

  viz: { marginTop: 13, backgroundColor: '#0c0c0e', borderWidth: 1, borderColor: '#1c1c22', borderRadius: 11, padding: 12 },
  vizLabel: { color: '#7a7a7e', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 9 },
  flat: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 34 },
  cmp: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 16, height: 52 },
  cmpBar: { flex: 1, maxWidth: 64, alignItems: 'center', gap: 4 },
  cmpV: { fontSize: 10.5, fontWeight: '800' },
  met: { flexDirection: 'row', gap: 8 },
  metBox: { flex: 1, backgroundColor: '#0c0c0e', borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  metN: { color: '#fff', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metL: { color: '#6a6a6e', fontSize: 8.5, marginTop: 2 },

  acts: { gap: 8, marginTop: 15 },
  primary: { borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  primaryT: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  secondary: { backgroundColor: '#1f1f24', borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  secondaryT: { color: '#e4e4ea', fontSize: 12.5, fontWeight: '700' },
});
