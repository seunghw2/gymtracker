import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import NotificationList from '../../components/NotificationList';
import { RT } from '../../components/report/theme';

/** Chat 탭 — 우선 알림(인박스)을 보여준다. 추후 애널리스트 대화로 확장 예정. */
export default function ChatTab() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={{ fontSize: 16 }}>🤖</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>애널리스트<Text style={styles.scope}>  · 알림</Text></Text>
          <Text style={styles.sub}>새 소식을 모아서 알려드려요</Text>
        </View>
      </View>
      <NotificationList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RT.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: RT.hair },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: RT.purpleD, alignItems: 'center', justifyContent: 'center' },
  name: { color: RT.ink, fontSize: 15, fontWeight: '800' },
  scope: { color: RT.ink2, fontSize: 11.5, fontWeight: '500' },
  sub: { color: RT.ink2, fontSize: 11.5, marginTop: 1 },
});
