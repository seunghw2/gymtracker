import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getWorkoutDates, getMonthStats, getAllWorkoutDates, getSessionHistory, SessionSummary } from '../../db/queries';
import { formatShortWithDay, formatShortWithWeekday, todayStr, toDateStr, addDaysStr } from '../../lib/date';
import { formatDuration } from '../../lib/format';
import SessionCard from '../../components/SessionCard';
import SessionPreviewSheet from '../../components/SessionPreviewSheet';
import { ACCENT, AI } from '../../constants/colors';
import { useWorkoutStore } from '../../store/useStore';

function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  const cur = new Date(); cur.setHours(0, 0, 0, 0);
  let current = toDateStr(cur);
  let streak = 0;
  for (const d of sorted) {
    if (d === current) {
      streak++;
      cur.setDate(cur.getDate() - 1);
      current = toDateStr(cur);
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
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}
function diffDays(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}
function mdShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** 세션을 이번 주 / 지난주 / N월로 버킷팅(시간 역순). */
function bucketLabel(iso: string): string {
  const today = new Date();
  const thisMon = mondayOf(today);
  const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  if (d >= thisMon) return '이번 주';
  if (d >= lastMon) return '지난주';
  return `${d.getMonth() + 1}월`;
}

export default function HistoryScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({ count: 0, totalSec: 0 });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'month'>('timeline');
  const [preview, setPreview] = useState<SessionSummary | null>(null);
  const today = todayStr();

  const load = useCallback(async () => {
    const [dates, allDates, monthStats, hist] = await Promise.all([
      getWorkoutDates(year, month),
      getAllWorkoutDates(),
      getMonthStats(year, month),
      getSessionHistory(90).catch(() => [] as SessionSummary[]),
    ]);
    setWorkoutDates(dates);
    setStreak(calcStreak(allDates));
    setStats(monthStats);
    setSessions(hist);
  }, [year, month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];
  const bannerActive = useWorkoutStore(s => s.activeSessionId != null);

  // 타임라인: 역순 정렬 + 버킷 헤더 + 휴식 갭
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, bannerActive && styles.bannerPad]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.header}>기록</Text>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>{streak}일 연속</Text>
            </View>
          )}
        </View>

        {/* 보기 토글 */}
        <View style={styles.segment}>
          {([['timeline', '타임라인'], ['month', '월별']] as const).map(([key, label]) => (
            <Pressable key={key} style={[styles.segmentBtn, viewMode === key && styles.segmentBtnOn]} onPress={() => setViewMode(key)}>
              <Text style={[styles.segmentText, viewMode === key && styles.segmentTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── 타임라인 ── */}
        {viewMode === 'timeline' && (
          sorted.length === 0 ? (
            <Text style={styles.emptyText}>아직 운동 기록이 없어요.</Text>
          ) : (
            <View>
              {sorted.map((s, i) => {
                const prevLabel = i === 0 ? '' : bucketLabel(sorted[i - 1].date);
                const label = bucketLabel(s.date);
                const showHeader = label !== prevLabel;
                // 휴식 갭(이 세션 이후 더 오래된 세션과의 간격)
                const older = sorted[i + 1];
                const gap = older ? diffDays(s.date, older.date) - 1 : 0;
                const tags = s.tags ? s.tags.split(',').filter(Boolean) : [];
                return (
                  <React.Fragment key={s.id}>
                    {showHeader && <Text style={styles.bucket}>{label}</Text>}
                    <Pressable style={styles.tlRow} onPress={() => setPreview(s)}>
                      <View style={styles.rail}>
                        <View style={styles.dot} />
                        <View style={styles.railLine} />
                      </View>
                      <View style={styles.tlBody}>
                        <View style={styles.tlTop}>
                          <Text style={styles.tlDate}>{formatShortWithWeekday(s.date)}</Text>
                          {tags.length > 0 && (
                            <View style={styles.tagCapsule}>
                              <Text style={styles.tagText}>{tags.join('·')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.tlTitle} numberOfLines={1}>{s.title?.trim() || '운동'}</Text>
                        <Text style={styles.tlStats}>
                          {s.set_count}세트{s.duration_sec ? ` · ${formatDuration(s.duration_sec)}` : ''} · {s.exercise_count}종목
                        </Text>
                      </View>
                    </Pressable>
                    {gap >= 2 && (
                      <View style={styles.tlRow}>
                        <View style={styles.rail}><View style={styles.dotEmpty} /><View style={styles.railLine} /></View>
                        <Text style={styles.restText}>
                          {mdShort(addDaysStr(older.date, 1))}–{mdShort(addDaysStr(s.date, -1))} 휴식 {gap}일
                        </Text>
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )
        )}

        {/* ── 월별 ── */}
        {viewMode === 'month' && (<>
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} style={styles.navBtn}><Text style={styles.navArrow}>‹</Text></Pressable>
            <Text style={styles.monthLabel}>{year}년 {month}월</Text>
            <Pressable onPress={nextMonth} style={styles.navBtn}><Text style={styles.navArrow}>›</Text></Pressable>
          </View>
          <View style={styles.dayRow}>
            {dayLabels.map(d => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.cell} />;
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const hasWorkout = workoutDates.includes(dateStr);
              const isSelected = dateStr === selectedDate;
              return (
                <Pressable key={idx} style={styles.cell} onPress={() => setSelectedDate(dateStr)}>
                  <View style={[styles.dayCircle, hasWorkout && styles.dayCircleWorkout, isToday && styles.dayCircleToday, isSelected && styles.dayCircleSelected]}>
                    <Text style={[styles.dayText, hasWorkout && styles.dayTextWorkout, isToday && styles.dayTextToday]}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}><Text style={styles.summaryValue}>{stats.count}회</Text><Text style={styles.summaryLabel}>운동 횟수</Text></View>
            <View style={styles.summaryCard}><Text style={styles.summaryValue}>{stats.totalSec > 0 ? formatDuration(stats.totalSec) : '-'}</Text><Text style={styles.summaryLabel}>총 운동 시간</Text></View>
          </View>
          {selectedDate && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{formatShortWithDay(selectedDate)}</Text>
              {sessions.filter(s => s.date === selectedDate).length > 0
                ? sessions.filter(s => s.date === selectedDate).map(s => <SessionCard key={s.id} session={s} onChanged={load} />)
                : <Text style={styles.emptyText}>이 날은 운동 기록이 없습니다</Text>}
            </View>
          )}
        </>)}
      </ScrollView>

      <SessionPreviewSheet session={preview} onClose={() => setPreview(null)} />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  bannerPad: { paddingBottom: 100 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },

  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2A1113', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 6, gap: 5 },
  streakEmoji: { fontSize: 15 },
  streakText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  segment: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 12, padding: 4, marginBottom: 20 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentBtnOn: { backgroundColor: ACCENT },
  segmentText: { color: '#8E8E93', fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: '#FFFFFF' },

  // 타임라인
  bucket: { color: AI.textSub, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  tlRow: { flexDirection: 'row', gap: 12 },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT, marginTop: 5 },
  dotEmpty: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#3A3A3C', marginTop: 5 },
  railLine: { flex: 1, width: 2, backgroundColor: '#26262B', marginTop: 2 },
  tlBody: { flex: 1, paddingBottom: 16 },
  tlTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tlDate: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  tagCapsule: { backgroundColor: '#2C2C2E', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { color: '#C7C7CC', fontSize: 10.5, fontWeight: '600' },
  tlTitle: { color: '#EDEDF0', fontSize: 15, fontWeight: '700', marginTop: 3 },
  tlStats: { color: AI.textSub, fontSize: 12, marginTop: 3, fontVariant: ['tabular-nums'] },
  restText: { color: '#48484A', fontSize: 11.5, paddingBottom: 16, paddingTop: 2 },

  // 월별
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 8 },
  navArrow: { color: ACCENT, fontSize: 28, fontWeight: '300' },
  monthLabel: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
  dayRow: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', color: '#8E8E93', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayCircleWorkout: { backgroundColor: '#2A1113' },
  dayCircleToday: { backgroundColor: ACCENT },
  dayCircleSelected: { borderWidth: 2, borderColor: '#FFFFFF' },
  dayText: { color: '#8E8E93', fontSize: 14 },
  dayTextWorkout: { color: ACCENT, fontWeight: '600' },
  dayTextToday: { color: '#FFFFFF', fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, alignItems: 'center' },
  summaryValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  summaryLabel: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: '#48484A', fontSize: 14, paddingVertical: 8 },
});
