import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Modal,
} from 'react-native';
import { getWorkoutDates, getMonthStats, getAllWorkoutDates, getSessionHistory, getSessionSets, getSessionExerciseNotes, SessionSummary, SessionSetRow } from '../../db/queries';
import { formatShortWithDay, formatDateWithDay } from '../../lib/date';
import { useSettingsStore } from '../../store/useStore';
import { toDisplay, unitLabel } from '../../lib/units';
import SessionCard from '../../components/SessionCard';

const SET_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  WARMUP: { label: 'W', color: '#FF9F0A' },
  DROP: { label: 'D', color: '#BF5AF2' },
  FAILURE: { label: 'F', color: '#FF453A' },
};

function getWeekRange(offset = 0) {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const label = `${mon.getMonth() + 1}/${mon.getDate()} ~ ${sun.getMonth() + 1}/${sun.getDate()}`;
  return { start: fmt(mon), end: fmt(sun), label };
}

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let current = today;
  for (const d of sorted) {
    if (d === current) {
      streak++;
      const prev = new Date(current);
      prev.setDate(prev.getDate() - 1);
      current = prev.toISOString().slice(0, 10);
    } else if (d < current) {
      break;
    }
  }
  return streak;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay();
  return (day + 6) % 7;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({ count: 0, totalSec: 0 });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [detailSession, setDetailSession] = useState<SessionSummary | null>(null);
  const [detailSets, setDetailSets] = useState<SessionSetRow[]>([]);
  const [detailNotes, setDetailNotes] = useState<Record<number, string>>({});
  const { unitKg } = useSettingsStore();
  const u = unitLabel(unitKg);

  const today = now.toISOString().slice(0, 10);
  const week = getWeekRange(weekOffset);

  const openSessionDetail = async (s: SessionSummary) => {
    const [sets, notes] = await Promise.all([
      getSessionSets(s.id).catch(() => [] as SessionSetRow[]),
      getSessionExerciseNotes(s.id).catch(() => []),
    ]);
    setDetailSets(sets);
    const nm: Record<number, string> = {};
    for (const n of notes) if (n.note) nm[n.exercise_id] = n.note;
    setDetailNotes(nm);
    setDetailSession(s);
  };

  const load = useCallback(async () => {
    const [dates, allDates, monthStats, hist] = await Promise.all([
      getWorkoutDates(year, month),
      getAllWorkoutDates(),
      getMonthStats(year, month),
      getSessionHistory(60).catch(() => [] as SessionSummary[]),
    ]);
    setWorkoutDates(dates);
    setStreak(calcStreak(allDates));
    setStats(monthStats);
    setSessions(hist);
  }, [year, month]);

  const renderSessionCard = (s: SessionSummary) => (
    <SessionCard key={s.id} session={s} onPress={() => openSessionDetail(s)} onChanged={load} />
  );

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>캘린더</Text>

        {/* 보기 토글 */}
        <View style={styles.segment}>
          {([['month', '월별'], ['week', '이번주']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.segmentBtn, viewMode === key && styles.segmentBtnOn]}
              onPress={() => setViewMode(key)}
            >
              <Text style={[styles.segmentText, viewMode === key && styles.segmentTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {viewMode === 'month' && (<>
        {/* 월 선택 */}
        <View style={styles.monthNav}>
          <Pressable onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>{year}년 {month}월</Text>
          <Pressable onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>

        {/* 요일 헤더 */}
        <View style={styles.dayRow}>
          {dayLabels.map(d => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* 달력 격자 */}
        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (!day) return <View key={idx} style={styles.cell} />;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const hasWorkout = workoutDates.includes(dateStr);
            const isSelected = dateStr === selectedDate;
            return (
              <Pressable
                key={idx}
                style={styles.cell}
                disabled={!hasWorkout}
                onPress={() => setSelectedDate(dateStr)}
              >
                <View style={[
                  styles.dayCircle,
                  hasWorkout && styles.dayCircleWorkout,
                  isToday && styles.dayCircleToday,
                  isSelected && styles.dayCircleSelected,
                ]}>
                  <Text style={[
                    styles.dayText,
                    hasWorkout && styles.dayTextWorkout,
                    isToday && styles.dayTextToday,
                  ]}>
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 선택한 날짜 요약 */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{formatShortWithDay(selectedDate)}</Text>
            {sessions.filter(s => s.date === selectedDate).length > 0
              ? sessions.filter(s => s.date === selectedDate).map(renderSessionCard)
              : <Text style={styles.emptyText}>이 날은 운동 기록이 없습니다</Text>}
          </View>
        )}
        </>)}

        {viewMode === 'week' && (
          <View>
            <View style={styles.monthNav}>
              <Pressable onPress={() => setWeekOffset(o => o - 1)} style={styles.navBtn}>
                <Text style={styles.navArrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{weekOffset === 0 ? `이번 주 (${week.label})` : week.label}</Text>
              <Pressable onPress={() => setWeekOffset(o => Math.min(0, o + 1))} style={styles.navBtn}>
                <Text style={[styles.navArrow, weekOffset >= 0 && styles.navArrowDisabled]}>›</Text>
              </Pressable>
            </View>
            {(() => {
              const wk = sessions
                .filter(s => s.date >= week.start && s.date <= week.end)
                .sort((a, b) => a.date.localeCompare(b.date));
              return wk.length > 0
                ? wk.map(renderSessionCard)
                : <Text style={styles.emptyText}>이 주에는 운동이 없습니다</Text>;
            })()}
          </View>
        )}
      </ScrollView>

      {/* 운동 상세 (보기 전용) */}
      <Modal visible={!!detailSession} animationType="slide" transparent onRequestClose={() => setDetailSession(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {detailSession?.title?.trim() || (detailSession ? formatDateWithDay(detailSession.date) : '')}
              </Text>
              <Pressable onPress={() => setDetailSession(null)} hitSlop={8}>
                <Text style={styles.detailClose}>닫기</Text>
              </Pressable>
            </View>
            {detailSession && (
              <Text style={styles.detailSub}>
                {formatDateWithDay(detailSession.date)}
                {detailSession.duration_sec ? ` · ${formatDuration(detailSession.duration_sec)}` : ''}
              </Text>
            )}
            {detailSession?.tags ? (
              <View style={styles.tagBadgeRow}>
                {detailSession.tags.split(',').filter(Boolean).map(t => <Text key={t} style={styles.tagBadge}>{t}</Text>)}
              </View>
            ) : null}
            {detailSession?.note?.trim() ? (
              <Text style={styles.detailNote}>📝 {detailSession.note}</Text>
            ) : null}
            <ScrollView style={{ marginTop: 8 }}>
              {(() => {
                const groups: { id: number; name: string; brand: string | null; sets: SessionSetRow[] }[] = [];
                const map: Record<number, number> = {};
                for (const s of detailSets) {
                  if (map[s.exercise_id] === undefined) {
                    map[s.exercise_id] = groups.length;
                    groups.push({ id: s.exercise_id, name: s.exercise_name, brand: s.brand, sets: [] });
                  }
                  groups[map[s.exercise_id]].sets.push(s);
                }
                if (groups.length === 0) return <Text style={styles.emptyText}>세트 기록이 없습니다</Text>;
                return groups.map(g => (
                  <View key={g.id} style={styles.detailExCard}>
                    <Text style={styles.detailExName}>{g.name}{g.brand ? ` · ${g.brand}` : ''}</Text>
                    {detailNotes[g.id] ? <Text style={styles.detailExNote}>📝 {detailNotes[g.id]}</Text> : null}
                    {g.sets.map(s => {
                      const badge = SET_TYPE_BADGE[s.set_type];
                      return (
                        <View key={s.id} style={styles.detailSetRow}>
                          <Text style={styles.detailSetNum}>
                            {badge ? <Text style={{ color: badge.color }}>{badge.label}</Text> : s.set_order}
                          </Text>
                          <Text style={styles.detailSetVal}>
                            {s.duration_sec != null
                              ? `${s.duration_sec}초`
                              : `${toDisplay(s.weight_kg, unitKg)}${u} × ${s.reps}`}
                          </Text>
                          <Text style={styles.detailSet1rm}>{s.estimated_1rm ? `1RM ${toDisplay(s.estimated_1rm, unitKg)}${u}` : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 16 },

  segment: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4, marginBottom: 20 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: '#30D158' },
  segmentText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: '#000000' },

  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A3D27',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
    gap: 6,
  },
  streakEmoji: { fontSize: 18 },
  streakText: { color: '#30D158', fontSize: 15, fontWeight: '700' },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: { padding: 8 },
  navArrow: { color: '#30D158', fontSize: 28, fontWeight: '300' },
  monthLabel: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },

  dayRow: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: 13 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleWorkout: { backgroundColor: '#1A3D27' },
  dayCircleToday: { backgroundColor: '#30D158' },
  dayText: { color: '#8E8E93', fontSize: 14 },
  dayTextWorkout: { color: '#30D158', fontWeight: '600' },
  dayTextToday: { color: '#000000', fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  summaryValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  summaryLabel: { color: '#8E8E93', fontSize: 13, marginTop: 4 },

  dayCircleSelected: { borderWidth: 2, borderColor: '#FFFFFF' },

  section: { marginTop: 24 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: '#48484A', fontSize: 14, paddingVertical: 8 },
  sessionCard: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 14, marginBottom: 8 },
  sessionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  sessionMeta: { color: '#30D158', fontSize: 12, fontWeight: '600' },
  sessionDate: { color: '#8E8E93', fontSize: 12, marginTop: 3 },
  sessionDateTop: { color: '#30D158', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  sessionExercises: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  tagBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagBadge: { color: '#5AB0FF', fontSize: 11, fontWeight: '600', backgroundColor: '#0A2A4A', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  navArrowDisabled: { color: '#3A3A3C' },

  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '700', flex: 1, marginRight: 12 },
  detailClose: { color: '#30D158', fontSize: 16, fontWeight: '600' },
  detailSub: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  detailNote: { color: '#E5E5EA', fontSize: 13, marginTop: 8, backgroundColor: '#2C2C2E', borderRadius: 8, padding: 10 },
  detailExCard: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 14, marginBottom: 8 },
  detailExName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  detailExNote: { color: '#E5C07B', fontSize: 12, marginTop: 4 },
  detailSetRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  detailSetNum: { color: '#8E8E93', fontSize: 14, width: 28, fontWeight: '700' },
  detailSetVal: { color: '#FFFFFF', fontSize: 15, flex: 1, fontVariant: ['tabular-nums'] },
  detailSet1rm: { color: '#30D158', fontSize: 12, fontVariant: ['tabular-nums'] },
});
