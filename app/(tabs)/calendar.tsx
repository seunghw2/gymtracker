import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { getWorkoutDates, getMonthStats, getAllWorkoutDates, getSessionHistory, SessionSummary } from '../../db/queries';
import { formatShortWithDay } from '../../lib/date';

function getWeekRangeStr() {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(mon), end: fmt(sun) };
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

  const today = now.toISOString().slice(0, 10);
  const week = getWeekRangeStr();

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
    <View key={s.id} style={styles.sessionCard}>
      <View style={styles.sessionCardTop}>
        <Text style={styles.sessionTitle} numberOfLines={1}>
          {s.title?.trim() || formatShortWithDay(s.date)}
        </Text>
        <Text style={styles.sessionMeta}>
          {s.exercise_count}종목·{s.set_count}세트{s.duration_sec ? `·${formatDuration(s.duration_sec)}` : ''}
        </Text>
      </View>
      {s.title?.trim() ? <Text style={styles.sessionDate}>{formatShortWithDay(s.date)}</Text> : null}
      {s.exercise_names ? <Text style={styles.sessionExercises} numberOfLines={1}>{s.exercise_names}</Text> : null}
    </View>
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

        {/* 스트릭 뱃지 */}
        <View style={styles.streakBadge}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>{streak}일 연속</Text>
        </View>

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

        {/* 월 요약 */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.count}</Text>
            <Text style={styles.summaryLabel}>이번달 운동</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.totalSec > 0 ? formatDuration(stats.totalSec) : '-'}</Text>
            <Text style={styles.summaryLabel}>총 운동 시간</Text>
          </View>
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

        {/* 이번 주 운동 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이번 주 운동</Text>
          {(() => {
            const wk = sessions
              .filter(s => s.date >= week.start && s.date <= week.end)
              .sort((a, b) => b.date.localeCompare(a.date));
            return wk.length > 0
              ? wk.map(renderSessionCard)
              : <Text style={styles.emptyText}>이번 주 운동이 없습니다</Text>;
          })()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 16 },

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
  sessionExercises: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
});
