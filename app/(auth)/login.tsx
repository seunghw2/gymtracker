import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Alert,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { ApiException } from '../../lib/api';
import { loginWithKakao } from '../../lib/kakaoAuth';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore(s => s.login);
  const kakao = useAuthStore(s => s.kakao);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);

  const handleKakao = async () => {
    setKakaoLoading(true);
    try {
      const { accessToken } = await loginWithKakao();
      await kakao(accessToken);
    } catch (e) {
      if (e instanceof ApiException) {
        Alert.alert('카카오 로그인 실패', e.body.message);
      } else if (e instanceof Error && !e.message.includes('취소')) {
        Alert.alert('카카오 로그인 실패', e.message);
      }
    } finally {
      setKakaoLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력하세요.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      const msg = e instanceof ApiException ? e.body.message : '로그인에 실패했습니다.';
      Alert.alert('로그인 실패', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>💪</Text>
          <Text style={styles.title}>GymTracker</Text>
          <Text style={styles.subtitle}>로그인하고 운동 기록을 시작하세요</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#48484A"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#48484A"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <Pressable
            style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryBtnText}>로그인</Text>}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={[styles.kakaoBtn, kakaoLoading && { opacity: 0.5 }]}
            onPress={handleKakao}
            disabled={loading || kakaoLoading}
          >
            {kakaoLoading
              ? <ActivityIndicator color="#000" />
              : (
                <>
                  <Text style={styles.kakaoIcon}>💬</Text>
                  <Text style={styles.kakaoBtnText}>카카오로 시작하기</Text>
                </>
              )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/signup')}
            disabled={loading || kakaoLoading}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>아직 계정이 없나요? <Text style={styles.linkAccent}>회원가입</Text></Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#8E8E93', fontSize: 14, marginTop: 8 },
  form: { gap: 4 },
  label: { color: '#8E8E93', fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: '#30D158',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryBtnText: { color: '#000000', fontSize: 17, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 20, padding: 8 },
  linkText: { color: '#8E8E93', fontSize: 14 },
  linkAccent: { color: '#30D158', fontWeight: '600' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2C2C2E' },
  dividerText: { color: '#8E8E93', fontSize: 12 },
  kakaoBtn: {
    backgroundColor: '#FEE500',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  kakaoIcon: { fontSize: 18 },
  kakaoBtnText: { color: '#000000', fontSize: 16, fontWeight: '700' },
});
