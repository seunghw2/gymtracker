import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { getReportV2, AiReportV2 } from '../db/queries';
import { ACCENT, AI } from '../constants/colors';

/**
 * 운동 중 상단 코칭 배너 — 이번 주 브리핑의 처방을 "오늘 세션" 맥락으로 보여준다.
 * 브리핑(v2 주간 리포트)과 운동 화면을 잇는 고리. 데이터 없으면 아무것도 그리지 않는다.
 */
export default function WorkoutCoachBanner() {
  const router = useRouter();
  const [report, setReport] = useState<AiReportV2 | null>(null);

  useEffect(() => {
    let alive = true;
    getReportV2('week')
      .then(r => { if (alive && r.status === 'SUCCESS') setReport(r.report); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const rx = report?.prescription;
  if (!rx?.action) return null;

  return (
    <Pressable style={styles.card} onPress={() => router.push('/ai/reports')}>
      <Text style={styles.cap}>처방 · 오늘 세션</Text>
      <Text style={styles.action}>{rx.action}</Text>
      {!!rx.why && <Text style={styles.why} numberOfLines={2}>{rx.why}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#161618', borderLeftWidth: 3, borderLeftColor: ACCENT, borderRadius: 12, padding: 13, marginBottom: 14 },
  cap: { color: ACCENT, fontSize: 10.5, fontWeight: '800' },
  action: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700', lineHeight: 21, marginTop: 5 },
  why: { color: AI.textSub, fontSize: 12, lineHeight: 17, marginTop: 6 },
});
