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
import { getArchive, ArchiveEntry } from '../../db/queries';

function fmtMD(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default function AiArchiveScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ArchiveEntry[] | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    getArchive().then(r => { if (alive) setItems(r.items); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={styles.back}>‹</Text></Pressable>
        <Text style={styles.title}>지난 기록</Text>
        <View style={{ width: 24 }} />
      </View>

      {!items ? (
        <View style={styles.center}><ActivityIndicator color={AI.accent} size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}><Text style={styles.dim}>아직 지난 리포트가 없어요.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {items.map(it => (
            <Pressable
              key={it.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/ai/reports', params: { type: it.type, back: String(it.back) } })}
            >
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{it.label} · {fmtMD(it.start)}–{fmtMD(it.end)}</Text>
                <Text style={styles.rowSub}>{TYPE_KO[it.type] ?? it.type} 리포트</Text>
              </View>
              <Text style={styles.go}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const TYPE_KO: Record<string, string> = {
  week: '주간', month: '월간', quarter: '분기', half: '반기', year: '연간', session: '세션',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AI.line },
  back: { color: AI.accent, fontSize: 30, width: 24, marginTop: -4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  body: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: AI.textSub, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: AI.line },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AI.accent },
  rowTitle: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  rowSub: { color: AI.textSub, fontSize: 11, marginTop: 2 },
  go: { color: AI.accent, fontSize: 20, fontWeight: '800' },
});
