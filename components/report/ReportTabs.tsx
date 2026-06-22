import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getSetting, setSetting, getSessionHistory, SessionSummary } from '../../db/queries';
import { useSettingsStore } from '../../store/useStore';
import { useChatStore } from '../../store/useChatStore';
import type { AiReportV2, RCoachItem } from '../../db/api/ai';
import SessionPreviewSheet from '../SessionPreviewSheet';
import { RT, toneColor } from './theme';
import {
  Eyebrow, Card, Tile, Ring, Donut, VBars, StackedBar, BalanceSplit, ProgressRow,
  BandRow, Sparkline, MiniLine, Strip, StatGrid, BigNum, Delta, StatusDot,
} from './charts';
import { ACCENT, ACCENT_TINT } from '../../constants/colors';

const HIDDEN_KEY = 'ai_report_hidden';
const TONE_KEY = 'ai_coach_tone';
const PINNED_KEY = 'ai_pinned_lifts';
const TONES: [string, string][] = [['plain', '담백'], ['cheer', '응원'], ['blunt', '직설']];
const COMPOUND = ['squat', 'bench', 'deadlift', 'press', 'row', 'pulldown', 'pull up', 'pullup', 'lunge', 'dip', 'chin'];
const PINNED = ['squat', 'bench press', 'deadlift', 'overhead press', 'lat pulldown'];
const isCompound = (n: string) => COMPOUND.some(k => n.toLowerCase().includes(k));
const isPinned = (n: string) => PINNED.some(k => n.toLowerCase().includes(k));
const WD = ['일', '월', '화', '수', '목', '금', '토'];

/** 리포트 3서브탭(브리핑·데이터·코치) + 편집모드 + 톤. */
export default function ReportTabs({ r, onAsk, onReload }: { r: AiReportV2; onAsk?: () => void; onReload?: () => void }) {
  const [tab, setTab] = useState<'brief' | 'data' | 'coach'>('brief');
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState('plain');
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSetting(HIDDEN_KEY, '[]').then(v => { try { setHidden(new Set(JSON.parse(v))); } catch {} }).catch(() => {});
    getSetting(TONE_KEY, 'plain').then(setTone).catch(() => {});
    getSetting(PINNED_KEY, '').then(v => setPinned(new Set(v.split(',').map(s => s.trim()).filter(Boolean)))).catch(() => {});
  }, []);

  const togglePin = (name: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      setSetting(PINNED_KEY, [...next].join(',')).catch(() => {});
      return next;
    });
  };
  const toggleHidden = (key: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      setSetting(HIDDEN_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };
  const changeTone = (t: string) => {
    setTone(t);
    setSetting(TONE_KEY, t).then(() => onReload?.()).catch(() => {});
  };

  return (
    <View>
      <View style={s.topRow}>
        <View style={s.seg}>
          {([['brief', '브리핑'], ['data', '데이터'], ['coach', '코치']] as const).map(([k, label]) => (
            <Pressable key={k} style={[s.segItem, tab === k && s.segItemOn]} onPress={() => setTab(k)}>
              <Text style={[s.segText, tab === k && s.segTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setEditing(e => !e)} hitSlop={8}><Text style={s.edit}>{editing ? '완료' : '편집'}</Text></Pressable>
      </View>
      {tab === 'brief' && <BriefTab r={r} editing={editing} hidden={hidden} toggle={toggleHidden} />}
      {tab === 'data' && <DataTab r={r} editing={editing} hidden={hidden} toggle={toggleHidden} pinned={pinned} togglePin={togglePin} />}
      {tab === 'coach' && <CoachTab r={r} onAsk={onAsk} editing={editing} hidden={hidden} toggle={toggleHidden} tone={tone} onTone={changeTone} />}
    </View>
  );
}

function EditDot({ on, onPress }: { on: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} hitSlop={8}><Text style={[s.editDot, { color: on ? RT.ink3 : RT.action }]}>{on ? '추가' : '숨김'}</Text></Pressable>;
}

// ── 브리핑 ──────────────────────────────────────────────────────────
function BriefTab({ r, editing, hidden, toggle }: { r: AiReportV2; editing: boolean; hidden: Set<string>; toggle: (k: string) => void }) {
  const c = r.consistency;
  const cards = r.cards;
  const stallN = r.detail.stagnation?.length ?? 0;
  const vol = cards?.volumeBars?.map(b => b.tons) ?? r.detail.trends?.find(t => t.metric.includes('볼륨'))?.points.map(p => p.y) ?? [];
  const w = r.bodyComposition?.weight;
  const show = (k: string) => editing || !hidden.has(k);
  const editDot = (k: string) => editing ? <View style={s.kpiEdit}><EditDot on={hidden.has(k)} onPress={() => toggle(k)} /></View> : null;
  const up = (r.monthGrowth?.volumeGrowthPct ?? 0) >= 0;
  return (
    <View>
      <Text style={s.hero}>{r.headline}</Text>

      {r.period.type === 'month' && (r.monthScore || r.monthGrowth) && (
        <View style={s.mg}>
          <Text style={s.mgCap}>📈 이번 달 성장</Text>
          {r.monthScore && (
            <View style={s.mgScoreRow}>
              <Text style={s.mgScore}>{r.monthScore.total}<Text style={s.mgScoreUnit}>점</Text></Text>
              <Text style={s.mgAxes}>꾸준 {r.monthScore.consistency} · 성장 {r.monthScore.growth} · 밸런스 {r.monthScore.balance}</Text>
            </View>
          )}
          {r.monthGrowth && (
          <View style={s.mgRow}>
            <Text style={[s.mgPct, { color: up ? RT.good : RT.bad }]}>
              {up ? '▲' : '▼'} {Math.abs(r.monthGrowth.volumeGrowthPct)}%
            </Text>
            <Text style={s.mgSub}>{r.monthGrowth.prevLabel} 대비 총 볼륨</Text>
          </View>
          )}
          {(r.detail.growth?.length ?? 0) > 0 && (
            <View style={s.mgGrow}>
              {r.detail.growth!.slice(0, 3).map((g, i) => (
                <View key={i} style={s.mgItem}>
                  <Text style={s.mgName} numberOfLines={1}>{g.name}</Text>
                  <Text style={s.mgVal}>{g.change}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.kpiGrid}>
        {show('kpi_attendance') && <View style={[s.kpiWrap, editing && hidden.has('kpi_attendance') && { opacity: 0.4 }]}><Kpi v={c ? `${c.attendancePct}%` : '–'} l="출석률" sub={c ? `${c.sessions}/${c.planned}` : undefined} tone={c && c.attendancePct < 80 ? 'warn' : 'good'} />{editDot('kpi_attendance')}</View>}
        {show('kpi_weight') && <View style={[s.kpiWrap, editing && hidden.has('kpi_weight') && { opacity: 0.4 }]}><Kpi v={w?.current != null ? `${w.current}kg` : '–'} l="체중" sub={w?.delta ?? undefined} tone={w?.delta?.startsWith('-') ? 'good' : undefined} />{editDot('kpi_weight')}</View>}
        {show('kpi_volume') && <View style={[s.kpiWrap, editing && hidden.has('kpi_volume') && { opacity: 0.4 }]}><View style={s.kpi}><Sparkline points={vol.length ? vol : [0]} color="#9A9A9E" /><Text style={s.kpiL}>주간 볼륨</Text></View>{editDot('kpi_volume')}</View>}
        {show('kpi_stall') && <View style={[s.kpiWrap, editing && hidden.has('kpi_stall') && { opacity: 0.4 }]}><Kpi v={`${stallN}건`} l="정체 종목" tone={stallN > 0 ? 'warn' : 'good'} />{editDot('kpi_stall')}</View>}
      </View>

      {cards?.highlights && cards.highlights.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hlRow}>
          {cards.highlights.map((h, i) => (
            <View key={i} style={s.hl}>
              <Text style={s.hlL}>{h.label}</Text>
              <View style={s.hlVRow}>
                <Text style={s.hlV}>{h.value}</Text>
                <StatusDot tone={h.tone} size={7} />
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {!!r.summary.oneLiner && (
        <View style={[s.insight, s.diag]}><Text style={[s.insightK, { color: RT.purple }]}>진단</Text><Text style={s.insightX}>{r.summary.oneLiner}</Text></View>
      )}
      {!!r.prescription?.action && (
        <View style={[s.insight, s.presc]}><Text style={[s.insightK, { color: ACCENT }]}>처방 · 딱 하나</Text><Text style={s.insightX}>{r.prescription.action}</Text></View>
      )}
      <View style={s.drill}><Text style={s.drillT}>숫자는 데이터 탭 · 해설은 코치 탭에서</Text></View>
    </View>
  );
}

// ── 데이터 ──────────────────────────────────────────────────────────
function DataTab({ r, editing, hidden, toggle, pinned, togglePin }: { r: AiReportV2; editing: boolean; hidden: Set<string>; toggle: (k: string) => void; pinned: Set<string>; togglePin: (n: string) => void }) {
  const c = r.consistency;
  const bc = r.bodyComposition;
  const d = r.cards;
  const router = useRouter();
  const goalWeight = useSettingsStore(st => st.goalWeightKg);
  const [exFilter, setExFilter] = useState<'pinned' | 'compound' | 'all'>('pinned');
  const [refOpen, setRefOpen] = useState(false);   // '참고' 그룹 기본 접힘
  const [order, setOrder] = useState<Record<string, string[]>>({});
  useEffect(() => { getSetting('ai_report_order', '{}').then(v => { try { setOrder(JSON.parse(v)); } catch {} }).catch(() => {}); }, []);
  const move = (group: string, naturalKeys: string[], key: string, dir: -1 | 1) => {
    setOrder(prev => {
      const cur = (prev[group] ?? naturalKeys).filter(k => naturalKeys.includes(k));
      naturalKeys.forEach(k => { if (!cur.includes(k)) cur.push(k); });
      const i = cur.indexOf(key), j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return prev;
      [cur[i], cur[j]] = [cur[j], cur[i]];
      const next = { ...prev, [group]: cur };
      setSetting('ai_report_order', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const show = (k: string) => editing || !hidden.has(k);
  const isPin = (name: string) => pinned.size > 0 ? pinned.has(name) : isPinned(name);

  const exRows = [
    ...(r.detail.growth ?? []).map(g => ({ name: g.name, val: g.change, tone: 'good' as const })),
    ...(r.detail.stagnation ?? []).map(st => ({ name: st.name, val: `${st.weeksFlat}주 정체`, tone: 'warn' as const })),
  ];
  const exFiltered = exRows.filter(e => exFilter === 'all' ? true : exFilter === 'compound' ? isCompound(e.name) : isPin(e.name));

  // ⚠ 이번 주 주의(자동) — 기존 값에서 파생(새 쿼리 없음)
  const alerts: { tone: string; text: string }[] = [];
  (r.detail.stagnation ?? []).slice(0, 2).forEach(st => alerts.push({ tone: 'warn', text: `${st.name} ${st.weeksFlat}주째 정체` }));
  (r.detail.balance ?? []).filter(b => b.status === 'low').slice(0, 2).forEach(b => alerts.push({ tone: 'bad', text: `${b.part} 하드세트 부족(주 ${b.sets})` }));
  if (c && c.longestGapDays >= 5) alerts.push({ tone: 'bad', text: `최장 공백 ${c.longestGapDays}일` });

  // ── 블록 레지스트리(P4: 그룹 내 표시·순서 커스텀) ──
  const blocks: { key: string; group: string; node: React.ReactNode }[] = [];
  const add = (key: string, group: string, cond: any, node: React.ReactNode) => { if (cond) blocks.push({ key, group, node }); };

  add('card_alerts', 'alert', alerts.length > 0 && show('card_alerts'),
    <Card title="⚠ 이번 주 주의" editing={editing} hidden={hidden.has('card_alerts')} onHide={() => toggle('card_alerts')}>
      {alerts.map((a, i) => (
        <View key={i} style={s.alertRow}><View style={[s.alertDot, { backgroundColor: toneColor(a.tone) }]} /><Text style={s.alertText}>{a.text}</Text></View>
      ))}
    </Card>);

  add('card_volume', 'trend', d?.volumeBars && d.volumeBars.length > 0 && show('card_volume'),
    <Card title="주별 볼륨 추세" chip={d?.volumeBars ? volTone(d.volumeBars) : undefined} editing={editing} hidden={hidden.has('card_volume')} onHide={() => toggle('card_volume')}>
      <View style={s.bigRow}><BigNum value={(d?.volumeBars ?? []).reduce((a, b) => a + b.tons, 0).toFixed(1)} unit="톤" /></View>
      <VBars data={(d?.volumeBars ?? []).map(b => ({ label: b.label, value: b.tons, sub: `${b.tons}t`, color: b.tone === 'bad' ? RT.bad : b.tone === 'warn' ? RT.warn : RT.c3 }))} />
    </Card>);

  add('card_exercises', 'trend', exRows.length > 0 && show('card_exercises'),
    <Card title="1RM 성장 · 종목별" caption="3회+ 수행 · 탭하면 상세" editing={editing} hidden={hidden.has('card_exercises')} onHide={() => toggle('card_exercises')}>
      <View style={s.chips}>
        {([['pinned', '주력'], ['compound', '대형 복합'], ['all', '전체']] as const).map(([k, label]) => (
          <Pressable key={k} style={[s.fchip, exFilter === k && s.fchipOn]} onPress={() => setExFilter(k)}>
            <Text style={[s.fchipText, exFilter === k && s.fchipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {exFiltered.length === 0 ? <Text style={s.exEmpty}>해당 종목이 없어요.</Text> :
        exFiltered.map((e, i) => (
          <Pressable key={i} style={s.exRow} disabled={editing} onPress={() => router.push({ pathname: '/exercise/[name]', params: { name: e.name } })}>
            {editing && (
              <Pressable onPress={() => togglePin(e.name)} hitSlop={6}>
                <Text style={[s.pinStar, { color: isPin(e.name) ? '#FFD60A' : RT.ink3 }]}>{isPin(e.name) ? '★' : '☆'}</Text>
              </Pressable>
            )}
            <Text style={s.exName}>{!editing && isPin(e.name) ? '★ ' : ''}{e.name}</Text>
            <Text style={[s.exVal, { color: toneColor(e.tone) }]}>{e.val}</Text>
            {!editing && <Text style={s.exGo}>›</Text>}
          </Pressable>
        ))}
      {editing ? <Text style={s.exHint}>★ 탭하여 주력 종목 지정/해제</Text> : <Text style={s.exHint}>종목을 탭하면 1RM 추세 상세를 볼 수 있어요</Text>}
    </Card>);

  add('card_consistency', 'trend', c && show('card_consistency'),
    <Card title="일관성" caption="출석 · 빈도 · 준수율" chip={c && c.attendancePct < 80 ? { tone: 'warn', label: '주의' } : { tone: 'good', label: '양호' }} editing={editing} hidden={hidden.has('card_consistency')} onHide={() => toggle('card_consistency')}>
      {c && <>
        <View style={s.ringRow}>
          <Ring pct={c.attendancePct} label="출석" tone={c.attendancePct < 80 ? 'warn' : 'good'} />
          <View style={s.tiles}>
            <Tile v={`${c.sessions}/${c.planned}`} l="세션" />
            <Tile v={`${c.longestGapDays}일`} l="최장 공백" tone={c.longestGapDays >= 5 ? 'bad' : undefined} />
            <Tile v={`${c.weeklyAvg}`} l="주 평균" />
            <Tile v={`${c.streak}`} l="연속" />
          </View>
        </View>
        {c.strip.length > 0 && <Strip cells={c.strip} />}
      </>}
      {d?.weekdayFreq && (
        <View style={{ marginTop: 14 }}>
          <Text style={s.subh}>요일별 세션</Text>
          <VBars height={56} data={d.weekdayFreq.map(b => ({ label: b.day, value: b.count, color: b.active ? RT.good : RT.c5 }))} />
        </View>
      )}
      {d?.routineAdherence && (
        <View style={s.freq}>
          <Text style={s.subh}>루틴 준수율(근사)</Text>
          <ProgressRow name="완료 세션" value={`${d.routineAdherence.completedSessions} / ${d.routineAdherence.plannedSessions}`} pct={pct(d.routineAdherence.completedSessions, d.routineAdherence.plannedSessions)} tone={tone3(pct(d.routineAdherence.completedSessions, d.routineAdherence.plannedSessions))} />
        </View>
      )}
    </Card>);

  add('card_balance', 'comp', r.detail.balance && show('card_balance'),
    <Card title="부위 하드세트 / 주" caption="권장 10–20" editing={editing} hidden={hidden.has('card_balance')} onHide={() => toggle('card_balance')}>
      {(r.detail.balance ?? []).map((b, i) => <BandRow key={i} part={b.part} sets={b.sets} status={b.status} />)}
      {d?.muscleFreqDays && d.muscleFreqDays.length > 0 && (
        <View style={s.freq}>
          <Text style={s.subh}>부위별 빈도 · 주 2–3회 권장</Text>
          {d.muscleFreqDays.map((m, i) => (
            <View key={i} style={s.frow}><Text style={s.fn}>{m.part}</Text><Text style={[s.ff, m.low && { color: toneColor('bad') }]}>주 {m.perWeek}회{m.low ? ' 부족' : ''}</Text></View>
          ))}
        </View>
      )}
    </Card>);

  add('card_share', 'comp', d?.muscleVolumeShare && d.muscleVolumeShare.length > 0 && show('card_share'),
    <Card title="부위별 볼륨 분배" caption="총 볼륨이 어디에 쏠렸나" editing={editing} hidden={hidden.has('card_share')} onHide={() => toggle('card_share')}>
      <Donut slices={d?.muscleVolumeShare ?? []} />
    </Card>);

  add('card_mbalance', 'comp', d?.muscleBalance && d.muscleBalance.length > 0 && show('card_mbalance'),
    <Card title="근육군 밸런스" caption="밀기·당기기 / 상·하체 / 컴파운드·아이솔레이션" editing={editing} hidden={hidden.has('card_mbalance')} onHide={() => toggle('card_mbalance')}>
      {(d?.muscleBalance ?? []).map((b, i) => <BalanceSplit key={i} {...b} />)}
    </Card>);

  add('card_reprange', 'comp', d?.repRange && show('card_reprange'),
    <Card title="강도 · 렙 구간" caption={d?.repRange ? `평균 ${d.repRange.avgE1rmPct}% e1RM · 근비대 구간 비중` : undefined} editing={editing} hidden={hidden.has('card_reprange')} onHide={() => toggle('card_reprange')}>
      {d?.repRange && <>
        <StackedBar segments={[
          { pct: d.repRange.strengthPct, color: RT.c4, label: d.repRange.strengthPct >= 12 ? '근력' : undefined },
          { pct: d.repRange.hyperPct, color: RT.c1, label: d.repRange.hyperPct >= 20 ? `근비대 ${d.repRange.hyperPct}%` : undefined, dark: true },
          { pct: d.repRange.endurancePct, color: RT.c3, label: d.repRange.endurancePct >= 12 ? '지구력' : undefined, dark: true },
        ]} />
        <View style={s.legRow2}>
          <Text style={s.leg2}><Text style={{ color: RT.c4 }}>■</Text> 1–5렙 {d.repRange.strengthPct}%</Text>
          <Text style={s.leg2}><Text style={{ color: RT.c1 }}>■</Text> 6–12렙 {d.repRange.hyperPct}%</Text>
          <Text style={s.leg2}><Text style={{ color: RT.c3 }}>■</Text> 13+렙 {d.repRange.endurancePct}%</Text>
        </View>
      </>}
    </Card>);

  add('card_rel', 'strength', d?.relativeStrength && d.relativeStrength.length > 0 && show('card_rel'),
    <Card title="상대 강도" caption="체중 대비 배수 · 표준 등급" editing={editing} hidden={hidden.has('card_rel')} onHide={() => toggle('card_rel')}>
      {(d?.relativeStrength ?? []).map((rs, i) => (
        <ProgressRow key={i} name={rs.lift} value={`${rs.multiple}×BW · ${rs.grade}`} pct={rs.barPct} tone={rs.barPct >= 66 ? 'good' : rs.barPct >= 40 ? 'warn' : 'bad'} />
      ))}
    </Card>);

  add('card_pr', 'strength', d?.prTimeline && d.prTimeline.length > 0 && show('card_pr'),
    <Card title="PR" chip={{ tone: 'good', label: `${d?.prTimeline?.length ?? 0}건` }} editing={editing} hidden={hidden.has('card_pr')} onHide={() => toggle('card_pr')}>
      {(d?.prTimeline ?? []).map((p, i) => (
        <View key={i} style={s.lrow}><Text style={[s.lst, { color: p.isNew ? RT.good : RT.ink2 }]}>{p.isNew ? '＋' : '●'}</Text><Text style={s.lnm}>{p.name}</Text><Text style={[s.lvl, { color: RT.good }]}>{p.isNew ? '신규' : p.value}</Text></View>
      ))}
    </Card>);

  add('card_body', 'body', bc && bc.display !== 'none' && bc.weight && show('card_body'),
    <Card title="몸" caption="체성분 · 7일 이동평균" right={bc?.weight?.delta ? <Delta text={bc.weight.delta} tone={bc.weight.delta.startsWith('-') ? 'good' : undefined} /> : undefined} editing={editing} hidden={hidden.has('card_body')} onHide={() => toggle('card_body')}>
      {bc?.weight && <>
        <View style={s.bigRow}><BigNum value={bc.weight.current ?? '–'} unit="kg" /></View>
        {bc.weight.trend && bc.weight.trend.length >= 2 && (
          <MiniLine points={bc.weight.trend.map(p => p.y)} band={goalWeight ? [goalWeight - 1, goalWeight + 1] : undefined} />
        )}
        <View style={s.tiles}>
          {bc.bodyFat?.current != null && <Tile v={`${bc.bodyFat.current}%`} l="체지방" />}
          {bc.waist?.current != null && <Tile v={`${bc.waist.current}`} l="허리(cm)" sub={bc.waist.delta ?? undefined} />}
          {d?.lbm?.current != null && <Tile v={`${d.lbm.current}`} l="제지방 kg" />}
          {!!bc.recomp && <Tile v="↓" l={bc.recomp} tone="good" />}
        </View>
      </>}
      {!!d?.lbm?.comment && <Text style={s.cnote}>{d.lbm.comment}</Text>}
      {d?.goals && d.goals.length > 0 && (
        <View style={s.freq}>
          <Text style={s.subh}>목표 진행률</Text>
          {d.goals.map((g, i) => <ProgressRow key={i} name={g.label} value={g.detail} pct={g.pct} tone={g.tone} />)}
        </View>
      )}
    </Card>);

  add('card_overload', 'ref', d?.overload && show('card_overload'),
    <Card title="점진적 과부하" caption="지난 수행 대비 무게·렙이 오른 비율" chip={{ tone: (d?.overload?.pct ?? 0) >= 50 ? 'good' : 'warn', label: (d?.overload?.pct ?? 0) >= 50 ? '양호' : '주의' }} editing={editing} hidden={hidden.has('card_overload')} onHide={() => toggle('card_overload')}>
      {d?.overload && (
        <View style={s.ringRow}>
          <Ring pct={d.overload.pct} label="진행" tone={d.overload.pct >= 50 ? 'good' : 'warn'} />
          <View style={s.tiles}>
            <Tile v={`${d.overload.up}`} l="상승" tone="good" />
            <Tile v={`${d.overload.hold}`} l="유지" />
            <Tile v={`${d.overload.stall}`} l="정체" tone={d.overload.stall > 0 ? 'warn' : undefined} />
            <Tile v={`${d.overload.total}`} l="전체" />
          </View>
        </View>
      )}
    </Card>);

  add('card_recovery', 'ref', d?.recovery && d.recovery.length > 0 && show('card_recovery'),
    <Card title="부위별 회복 간격" caption="마지막 자극 후 경과일" editing={editing} hidden={hidden.has('card_recovery')} onHide={() => toggle('card_recovery')}>
      {(d?.recovery ?? []).map((rc, i) => (
        <View key={i} style={s.lrow}><Text style={s.lnm}>{rc.part}</Text><Text style={[s.lvl, { color: toneColor(rc.tone) }]}>{rc.days}일</Text></View>
      ))}
    </Card>);

  add('card_sessionstats', 'ref', d?.sessionStats && show('card_sessionstats'),
    <Card title="세션 통계" editing={editing} hidden={hidden.has('card_sessionstats')} onHide={() => toggle('card_sessionstats')}>
      {d?.sessionStats && <StatGrid items={[
        { v: `${d.sessionStats.sessions}`, l: '총 세션' }, { v: `${d.sessionStats.sets}`, l: '총 세트' }, { v: `${d.sessionStats.reps}`, l: '총 렙' },
        { v: `${d.sessionStats.avgMin}분`, l: '평균 시간' }, { v: `${d.sessionStats.setsPerSession}`, l: '세션당 세트' }, { v: `${d.sessionStats.prs}`, l: 'PR' },
      ]} />}
    </Card>);

  const GROUPS: [string, string][] = [['alert', ''], ['trend', '추세'], ['comp', '구성'], ['strength', '강도 · 진행'], ['body', '몸'], ['ref', '참고']];
  const renderGroup = ([group, label]: [string, string]) => {
    const gb = blocks.filter(b => b.group === group);
    if (gb.length === 0) return null;
    const natural = gb.map(b => b.key);
    const ord = (order[group] ?? natural).filter(k => natural.includes(k));
    natural.forEach(k => { if (!ord.includes(k)) ord.push(k); });
    const sorted = ord.map(k => gb.find(b => b.key === k)!).filter(Boolean);
    const collapsed = group === 'ref' && !refOpen && !editing;
    return (
      <View key={group}>
        {group === 'ref'
          ? <Pressable style={s.refHead} onPress={() => setRefOpen(o => !o)}><Text style={s.refLabel}>참고</Text><Text style={s.refChevron}>{refOpen ? '⌄' : '›'}</Text></Pressable>
          : label ? <Eyebrow label={label} /> : null}
        {!collapsed && sorted.map((b, idx) => (
          <View key={b.key}>
            {editing && (
              <View style={s.reorder}>
                <Pressable disabled={idx === 0} onPress={() => move(group, natural, b.key, -1)} hitSlop={6}><Text style={[s.reBtn, idx === 0 && s.reOff]}>↑</Text></Pressable>
                <Pressable disabled={idx === sorted.length - 1} onPress={() => move(group, natural, b.key, 1)} hitSlop={6}><Text style={[s.reBtn, idx === sorted.length - 1 && s.reOff]}>↓</Text></Pressable>
              </View>
            )}
            {b.node}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View>
      <PeriodSessions start={r.period.start} end={r.period.end} />
      {GROUPS.map(renderGroup)}
    </View>
  );
}

// ── 이 기간 운동 기록(세션 목록) ──────────────────────────────────────
function PeriodSessions({ start, end }: { start: string; end: string }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [preview, setPreview] = useState<SessionSummary | null>(null);
  useEffect(() => {
    getSessionHistory(150)
      .then(all => setSessions(all.filter(x => x.date >= start && x.date <= end)))
      .catch(() => setSessions([]));
  }, [start, end]);
  if (sessions.length === 0) return null;
  return (
    <Card title="이 기간 운동 기록" caption={`${sessions.length}회 · 탭하면 상세`}>
      {sessions.map(se => {
        const dt = new Date(se.date + 'T00:00:00');
        const dlabel = `${dt.getMonth() + 1}/${dt.getDate()} ${WD[dt.getDay()]}`;
        const tags = (se.tags ?? '').split(/[,·]/).map(t => t.trim()).filter(Boolean);
        const mins = se.duration_sec ? Math.round(se.duration_sec / 60) : null;
        return (
          <Pressable key={se.id} style={s.psRow} onPress={() => setPreview(se)}>
            <Text style={s.psDate}>{dlabel}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.psTitle} numberOfLines={1}>{se.title || tags.join(' · ') || '운동'}</Text>
              <Text style={s.psSub}>{se.set_count}세트{mins ? ` · ${mins}분` : ''} · {se.exercise_count}종목</Text>
            </View>
            <Text style={s.psGo}>›</Text>
          </Pressable>
        );
      })}
      <SessionPreviewSheet session={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}

// ── 코치 ────────────────────────────────────────────────────────────
const CHAPTERS = [{ n: 1, label: '진단 · 무슨 일이 있었나' }, { n: 2, label: '처방 · 뭘 하면 되나' }, { n: 3, label: '계속 가기 · 동기' }];
function CoachTab({ r, editing, hidden, toggle, tone, onTone }: { r: AiReportV2; onAsk?: () => void; editing: boolean; hidden: Set<string>; toggle: (k: string) => void; tone: string; onTone: (t: string) => void }) {
  const router = useRouter();
  const findOrCreateByKey = useChatStore(st => st.findOrCreateByKey);
  const all = r.coaching ?? [];
  const visible = (it: RCoachItem) => editing ? true : (it.defaultOn && !hidden.has('coach_' + it.key));
  const items = all.filter(visible);

  // 주차당 1세션 이어가기(중복 방지) — 같은 리포트면 기존 대화로 복귀
  const continueChat = async (seed?: string) => {
    const conv = await findOrCreateByKey({
      source: 'report',
      sourceKey: `report:${r.period.type}:${r.period.start}`,
      title: `${r.period.label} 회고`,
      periodType: r.period.type,
      from: r.period.start,
      to: r.period.end,
    });
    if (conv) router.push({ pathname: '/chat/[conversationId]', params: { conversationId: String(conv.id), title: conv.title, ctx: `${r.period.label} 리포트에서 이어옴`, ...(seed ? { seed } : {}) } });
  };

  return (
    <View>
      <View style={s.aTrans}>
        <View style={s.av}><Text style={{ fontSize: 18 }}>🤖</Text></View>
        <View style={{ flex: 1 }}><Text style={s.aNm}>AI 코치가 이렇게 읽었어</Text><Text style={s.aSub}>{r.period.label} · 단계로 풀어줄게</Text></View>
      </View>
      <View style={s.tl}>
        {CHAPTERS.map(ch => {
          const chItems = items.filter(it => it.chapter === ch.n);
          if (chItems.length === 0) return null;
          const mkColor = ch.n === 1 ? RT.purple : ch.n === 2 ? RT.good : RT.purpleD;
          return (
            <View key={ch.n}>
              <View style={s.ph}>
                <View style={[s.mk, { backgroundColor: mkColor }]}><Text style={s.mkN}>{ch.n}</Text></View>
                <Text style={s.pt}>{ch.label}</Text>
              </View>
              {chItems.map((it, i) => {
                const isAction = it.key === 'action';
                const isHidden = hidden.has('coach_' + it.key);
                if (isAction) {
                  return (
                    <View key={i} style={[s.tnAct, editing && isHidden && { opacity: 0.4 }]}>
                      <View style={s.tnHead}><Text style={s.tactL}>{it.icon} {it.title}</Text>{editing && <View style={{ marginLeft: 'auto' }}><EditDot on={isHidden} onPress={() => toggle('coach_' + it.key)} /></View>}</View>
                      <Text style={s.tactT}>{it.body}</Text>
                    </View>
                  );
                }
                return (
                  <View key={i} style={[s.tn, editing && isHidden && { opacity: 0.4 }]}>
                    <View style={s.tnHead}>
                      <Text style={s.tnLab}>{it.icon} {it.title}</Text>
                      {!!it.badge && !editing && <Text style={s.tnBadge}>{it.badge}</Text>}
                      {editing && <View style={{ marginLeft: 'auto' }}><EditDot on={isHidden} onPress={() => toggle('coach_' + it.key)} /></View>}
                    </View>
                    <Text style={s.tnBody}>{it.body}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
      {r.suggestedQuestions?.length > 0 && (
        <View style={s.qa}>
          <Text style={s.qh}>💬 더 물어보기</Text>
          <View style={s.qchips}>{r.suggestedQuestions.map((q, i) => <Pressable key={i} style={s.qchip} onPress={() => continueChat(q)}><Text style={s.qtext}>{q}</Text></Pressable>)}</View>
        </View>
      )}
      <Pressable style={s.ask} onPress={() => continueChat()}><Text style={s.askText}>AI 코치랑 대화 이어가기</Text></Pressable>
    </View>
  );
}

// ── 소형 ────────────────────────────────────────────────────────────
function Kpi({ v, l, sub, tone }: { v: string; l: string; sub?: string; tone?: string }) {
  return (
    <View style={s.kpi}>
      <View style={s.kpiTop}>
        <Text style={s.kpiV}>{v}</Text>
        <StatusDot tone={tone} />
      </View>
      <Text style={s.kpiL}>{l}</Text>
      {!!sub && <Text style={s.kpiSub}>{sub}</Text>}
    </View>
  );
}
// ── 헬퍼 ────────────────────────────────────────────────────────────
const pct = (a: number, b: number) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
const tone3 = (p: number) => p >= 80 ? 'good' : p >= 50 ? 'warn' : 'bad';
function volTone(bars: { tone: string }[]): { tone: string; label: string } | undefined {
  const last = bars[bars.length - 1];
  if (last?.tone === 'bad') return { tone: 'bad', label: '하락' };
  if (bars.some(b => b.tone === 'warn')) return { tone: 'warn', label: '둔화' };
  return { tone: 'good', label: '양호' };
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  seg: { flex: 1, flexDirection: 'row', backgroundColor: RT.surface, borderRadius: 13, padding: 4 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segItemOn: { backgroundColor: '#f5f5f7' },
  segText: { color: RT.ink2, fontSize: 13.5, fontWeight: '700' },
  segTextOn: { color: '#000' },
  edit: { color: RT.action, fontSize: 14, fontWeight: '700' },
  editDot: { fontSize: 11.5, fontWeight: '800' },

  // 브리핑
  hero: { color: RT.ink, fontSize: 23, fontWeight: '800', lineHeight: 31, letterSpacing: -0.5, marginVertical: 8 },
  // 월간 '성장' 히어로
  mg: { backgroundColor: RT.goodBg, borderRadius: 14, padding: 14, marginBottom: 11, gap: 8 },
  mgCap: { color: RT.good, fontSize: 12, fontWeight: '800' },
  mgScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  mgScore: { color: RT.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  mgScoreUnit: { color: RT.ink3, fontSize: 14, fontWeight: '700' },
  mgAxes: { color: RT.ink3, fontSize: 12, fontWeight: '600', flex: 1 },
  mgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  mgPct: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  mgSub: { color: RT.ink3, fontSize: 12.5, fontWeight: '600' },
  mgGrow: { gap: 5, marginTop: 2 },
  mgItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  mgName: { color: RT.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  mgVal: { color: RT.good, fontSize: 13, fontWeight: '800' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 11 },
  kpiWrap: { width: '48%', position: 'relative' },
  kpiEdit: { position: 'absolute', top: 6, right: 8 },
  kpi: { width: '100%', backgroundColor: RT.surface, borderWidth: 1, borderColor: RT.hair, borderRadius: 14, padding: 13, minHeight: 74, justifyContent: 'center' },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kpiV: { color: RT.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  kpiL: { color: RT.ink2, fontSize: 11, marginTop: 5 },
  kpiSub: { color: RT.ink3, fontSize: 11, marginTop: 3, fontVariant: ['tabular-nums'] },
  hlRow: { gap: 8, paddingBottom: 12 },
  hl: { backgroundColor: RT.surface, borderWidth: 1, borderColor: RT.hair, borderRadius: 13, padding: 11, paddingHorizontal: 13, minWidth: 124 },
  hlL: { color: RT.ink2, fontSize: 11 },
  hlVRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  hlV: { color: RT.ink, fontSize: 14, fontWeight: '800' },
  insight: { backgroundColor: RT.surface, borderWidth: 1, borderColor: RT.hair, borderRadius: 14, padding: 13, paddingHorizontal: 14, marginBottom: 9 },
  diag: { borderLeftWidth: 3, borderLeftColor: RT.purple },
  presc: { borderLeftWidth: 3, borderLeftColor: ACCENT, backgroundColor: ACCENT_TINT },
  insightK: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginBottom: 4 },
  insightX: { color: RT.ink, fontSize: 13.5, lineHeight: 20 },
  drill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: RT.hair, borderStyle: 'dashed', borderRadius: 13, padding: 12, paddingHorizontal: 14, marginTop: 3 },
  drillT: { color: RT.ink2, fontSize: 12 },

  // 데이터 공용
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  cnote: { color: RT.ink2, fontSize: 12, marginTop: 10, lineHeight: 18 },
  freq: { marginTop: 12, borderTopWidth: 1, borderTopColor: RT.hair, paddingTop: 8 },
  subh: { color: RT.ink3, fontSize: 11.5, fontWeight: '800', marginBottom: 4 },
  frow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: RT.hair },
  fn: { color: RT.ink2, fontSize: 12.5 },
  ff: { color: RT.ink, fontSize: 12.5, fontWeight: '800' },
  legRow2: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 11 },
  leg2: { color: RT.ink2, fontSize: 11.5 },

  chips: { flexDirection: 'row', gap: 7, marginBottom: 6 },
  fchip: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 15, backgroundColor: RT.surface2 },
  fchipOn: { backgroundColor: RT.good },
  fchipText: { color: RT.ink2, fontSize: 13, fontWeight: '600' },
  fchipTextOn: { color: '#06270d', fontWeight: '800' },
  exEmpty: { color: RT.ink3, fontSize: 12, paddingVertical: 6 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: RT.hair },
  exName: { color: RT.ink, fontSize: 14.5, flex: 1 },
  exVal: { fontSize: 14.5, fontWeight: '800' },
  exGo: { color: RT.ink3, fontSize: 16, marginLeft: 8 },
  pinStar: { fontSize: 16, width: 20 },
  exHint: { color: RT.ink3, fontSize: 11, marginTop: 8 },

  psRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: RT.hair },
  psDate: { color: RT.ink2, fontSize: 12, fontWeight: '700', width: 52, fontVariant: ['tabular-nums'] },
  psTitle: { color: RT.ink, fontSize: 14, fontWeight: '600' },
  psSub: { color: RT.ink3, fontSize: 11.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  psGo: { color: RT.ink3, fontSize: 18 },

  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertText: { color: RT.ink, fontSize: 14, fontWeight: '600' },
  refHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 9, paddingHorizontal: 4 },
  refLabel: { color: RT.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  refChevron: { color: RT.ink3, fontSize: 16, fontWeight: '800' },
  reorder: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, paddingRight: 6, marginBottom: -4 },
  reBtn: { color: RT.action, fontSize: 18, fontWeight: '800' },
  reOff: { color: RT.ink3, opacity: 0.4 },

  lrow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: RT.hair },
  lst: { width: 16, textAlign: 'center', fontSize: 13 },
  lnm: { color: RT.ink, fontSize: 14.5, flex: 1 },
  lvl: { fontSize: 14.5, fontWeight: '800' },

  // 코치
  toneRow: { flexDirection: 'row', gap: 6, marginBottom: 13 },
  toneChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11, backgroundColor: RT.surface, borderWidth: 1, borderColor: RT.hair },
  toneChipOn: { backgroundColor: RT.purple, borderColor: RT.purple },
  toneText: { color: RT.ink2, fontSize: 12.5, fontWeight: '700' },
  toneTextOn: { color: '#fff', fontWeight: '800' },
  aTrans: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: '#1b1922', borderWidth: 1, borderColor: RT.purpleLine },
  av: { width: 40, height: 40, borderRadius: 13, backgroundColor: RT.purpleD, alignItems: 'center', justifyContent: 'center' },
  aNm: { color: RT.ink, fontSize: 14.5, fontWeight: '800' },
  aSub: { color: RT.ink2, fontSize: 11.5, marginTop: 2 },
  tl: { borderLeftWidth: 2, borderLeftColor: RT.purpleLine, marginLeft: 14, paddingLeft: 24 },
  ph: { marginBottom: 10, marginTop: 4 },
  mk: { position: 'absolute', left: -39, top: -2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: RT.bg },
  mkN: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pt: { color: RT.ink, fontSize: 14, fontWeight: '800' },
  tn: { marginBottom: 12, paddingLeft: 2 },
  tnHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tnLab: { color: RT.ink3, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  tnBadge: { color: RT.warn, fontSize: 10.5, fontWeight: '800' },
  tnBody: { color: RT.ink2, fontSize: 13, lineHeight: 19 },
  tnAct: { backgroundColor: RT.goodBg, borderWidth: 1, borderColor: 'rgba(48,209,88,0.4)', borderRadius: 13, padding: 13, paddingHorizontal: 14, marginBottom: 12 },
  tactL: { color: RT.good, fontSize: 10.5, fontWeight: '800' },
  tactT: { color: RT.ink, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 5 },
  qa: { marginTop: 8, paddingTop: 15, borderTopWidth: 1, borderTopColor: RT.hair },
  qh: { color: RT.purple, fontSize: 11, fontWeight: '800', letterSpacing: 0.3, marginBottom: 9 },
  qchips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  qchip: { borderWidth: 1.3, borderColor: RT.purpleLine, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  qtext: { color: RT.ink, fontSize: 12.5, fontWeight: '600' },
  ask: { backgroundColor: RT.purple, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  askText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
