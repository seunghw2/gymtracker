import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { getWorkoutDates, getMonthStats, getAllWorkoutDates } from '../../db/queries';

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

  const today = now.toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const [dates, allDates, monthStats] = await Promise.all([
      getWorkoutDates(year, month),
      getAllWorkoutDates(),
      getMonthStats(year, month),
    ]);
    setWorkoutDates(dates);
    setStreak(calcStreak(allDates));
    setStats(monthStats);
  }, [year, month]);

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
            return (
              <View key={idx} style={styles.cell}>
                <View style={[
                  styles.dayCircle,
                  hasWorkout && styles.dayCircleWorkout,
                  isToday && styles.dayCircleToday,
                ]}>
                  <Text style={[
                    styles.dayText,
                    hasWorkout && styles.dayTextWorkout,
                    isToday && styles.dayTextToday,
                  ]}>
                    {day}
                  </Text>
                </View>
              </View>
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
});
