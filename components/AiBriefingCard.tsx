import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AI } from '../constants/colors';
import { getLatestAiReport } from '../db/queries';

/**
 * 홈 진입 카드 — "애널리스트"가 보낸 최근 브리핑 미리보기. 탭하면 브리핑 채팅(/ai)으로.
 * 최근 성공 리포트가 있으면 헤드라인을 미리 보여주고, 없으면 생성 유도.
 */
export default function AiBriefingCard() {
  const router = useRouter();
  const [headline, setHeadline] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    let alive = true;
    getLatestAiReport()
      .then(r => { if (alive) setHeadline(r.status === 'SUCCESS' && r.report ? r.report.headline : null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []));

  return (
    <Pressable style={styles.card} onPress={() => router.push('/ai')}>
      <View style={styles.avatar}><Text style={{ fontSize: 18 }}>🤖</Text></View>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          <Text style={styles.name}>애널리스트</Text>
          <Text style={styles.tag}>AI 주간 브리핑</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>
          {!loaded ? '불러오는 중…' : headline ?? '이번 주 운동을 분석해 드릴게요. 탭해서 브리핑을 받아보세요.'}
        </Text>
        <Text style={styles.cta}>{headline ? '열어보기 ›' : '브리핑 받기 ›'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: AI.bubble, borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(157,123,255,0.35)',
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: AI.accent, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 14, fontWeight: '800' },
  tag: { color: AI.accent, fontSize: 11, fontWeight: '700' },
  preview: { color: '#D6D6DA', fontSize: 13, lineHeight: 19, marginTop: 4 },
  cta: { color: AI.accent, fontSize: 12.5, fontWeight: '700', marginTop: 9 },
});
