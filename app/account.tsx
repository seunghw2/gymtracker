import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SEM } from '../constants/colors';
import { SettingIcon } from '../components/SettingIcon';
import { useAuthStore } from '../store/useAuthStore';

function providerLabel(p?: string): string {
  switch (p) {
    case 'APPLE': return 'Apple';
    case 'GOOGLE': return 'Google';
    case 'KAKAO': return '카카오';
    case 'LOCAL': return '이메일';
    default: return p ?? '—';
  }
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout, deleteAccount } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // 회원탈퇴 — 이중 확인 후 모든 데이터 영구 삭제(기존 로직 재사용)
  const handleDeleteAccount = () => {
    Alert.alert('회원탈퇴', '계정과 모든 운동 기록이 영구 삭제됩니다.\n이 작업은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '계속', style: 'destructive', onPress: () => {
          Alert.alert('정말 탈퇴할까요?', '삭제된 데이터는 복구할 수 없습니다.', [
            { text: '취소', style: 'cancel' },
            {
              text: '영구 삭제', style: 'destructive', onPress: async () => {
                try { await deleteAccount(); } catch { Alert.alert('탈퇴 실패', '잠시 후 다시 시도해 주세요.'); }
              },
            },
          ]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.navBack}>‹ 설정</Text></Pressable>
        <Text style={s.navTitle}>계정</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* 프로필 카드 */}
        <View style={s.prof}>
          <View style={s.avatar}><Text style={s.avatarT}>{(user?.name?.[0] ?? '?').toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.profName} numberOfLines={1}>{user?.name ?? '사용자'}</Text>
            <View style={s.profSubRow}>
              <Text style={s.profEmail} numberOfLines={1}>{user?.email ?? '카카오 로그인'}</Text>
              {!!user?.provider && <Text style={s.badge}>{user.provider}</Text>}
            </View>
          </View>
        </View>

        <Text style={s.sectionHd}>계정 정보</Text>
        <View style={s.group}>
          <View style={s.row}><Text style={s.rowK}>이메일</Text><Text style={s.rowV} numberOfLines={1}>{user?.email ?? '—'}</Text></View>
          <View style={[s.row, s.rowDivider]}><Text style={s.rowK}>로그인 수단</Text><Text style={s.rowV}>{providerLabel(user?.provider)}</Text></View>
        </View>

        <View style={[s.group, { marginTop: 18 }]}>
          <Pressable onPress={handleLogout} style={s.logoutRow}>
            <View style={s.iconChip}><SettingIcon name="logout" color={SEM.brand} /></View>
            <Text style={s.logoutT}>로그아웃</Text>
          </Pressable>
        </View>

        <View style={s.danger}>
          <Pressable onPress={handleDeleteAccount} hitSlop={8}><Text style={s.dangerT}>회원탈퇴</Text></Pressable>
          <Text style={s.dangerHint}>모든 운동 기록이 삭제되며 되돌릴 수 없어요.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SEM.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  navBack: { color: SEM.brand, fontSize: 16, fontWeight: '600' },
  navTitle: { color: SEM.ink1, fontSize: 17, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },

  prof: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 16, padding: 15, marginBottom: 6 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: SEM.surface3, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: SEM.ink2, fontSize: 19, fontWeight: '800' },
  profName: { color: SEM.ink1, fontSize: 16, fontWeight: '800' },
  profSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  profEmail: { color: SEM.ink3, fontSize: 12.5, flexShrink: 1 },
  badge: { color: SEM.ink2, fontSize: 9, fontWeight: '700', borderWidth: 1, borderColor: SEM.line, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },

  sectionHd: { color: SEM.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderTopWidth: 1, borderTopColor: SEM.line },
  rowK: { color: SEM.ink1, fontSize: 14.5, fontWeight: '600' },
  rowV: { color: SEM.ink3, fontSize: 13.5, flexShrink: 1, textAlign: 'right' },

  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 13 },
  iconChip: { width: 30, height: 30, borderRadius: 8, backgroundColor: SEM.surface3, alignItems: 'center', justifyContent: 'center' },
  logoutT: { color: SEM.brand, fontSize: 15, fontWeight: '700' },

  danger: { alignItems: 'center', marginTop: 26 },
  dangerT: { color: SEM.danger, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  dangerHint: { color: SEM.ink3, fontSize: 11, marginTop: 2 },
});
