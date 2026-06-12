import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useAuthStore } from '../../store/useAuthStore';
import { ApiException } from '../../lib/api';
import { loginWithKakao } from '../../lib/kakaoAuth';
import { GOOGLE_CLIENT_IDS, googleConfigured } from '../../lib/googleAuth';

export default function LoginScreen() {
  const kakao = useAuthStore(s => s.kakao);
  const apple = useAuthStore(s => s.apple);
  const google = useAuthStore(s => s.google);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Google 로그인 (클라이언트 ID 미설정 시 버튼 미노출 — docs/SOCIAL_LOGIN_SETUP.md)
  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_CLIENT_IDS.ios,
    androidClientId: GOOGLE_CLIENT_IDS.android,
    webClientId: GOOGLE_CLIENT_IDS.web,
    clientId: GOOGLE_CLIENT_IDS.web ?? 'not-configured.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (googleResponse?.type === 'success' && googleResponse.params.id_token) {
      google(googleResponse.params.id_token).catch((e: unknown) => {
        const msg = e instanceof ApiException ? e.body.message : 'Google 로그인에 실패했습니다.';
        Alert.alert('Google 로그인 실패', msg);
      });
    } else if (googleResponse?.type === 'error') {
      Alert.alert('Google 로그인 실패', googleResponse.error?.message ?? '오류가 발생했습니다.');
    }
  }, [googleResponse]);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
    }
  }, []);

  const handleApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('identityToken 없음');
      // 이름은 최초 로그인 시에만 내려옴 — 백엔드에 함께 전달
      const name = [credential.fullName?.familyName, credential.fullName?.givenName]
        .filter(Boolean).join('') || null;
      await apple(credential.identityToken, name);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === 'ERR_REQUEST_CANCELED') return; // 사용자가 취소
      const msg = e instanceof ApiException ? e.body.message : 'Apple 로그인에 실패했습니다.';
      Alert.alert('Apple 로그인 실패', msg);
    }
  };

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.logo}>💪</Text>
          <Text style={styles.title}>GymTracker</Text>
          <Text style={styles.subtitle}>간편하게 로그인하고 운동 기록을 시작하세요</Text>
        </View>

        <View style={styles.buttons}>
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={styles.appleBtn}
              onPress={handleApple}
            />
          )}

          {googleConfigured && (
            <Pressable
              style={[styles.googleBtn, !googleRequest && { opacity: 0.5 }]}
              onPress={() => promptGoogle()}
              disabled={kakaoLoading || !googleRequest}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Google로 시작하기</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.kakaoBtn, kakaoLoading && { opacity: 0.5 }]}
            onPress={handleKakao}
            disabled={kakaoLoading}
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
        </View>

        <Text style={styles.terms}>
          로그인하면 운동 기록이 계정에 안전하게 보관됩니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 56, marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#8E8E93', fontSize: 14, marginTop: 8 },
  buttons: { gap: 0 },
  appleBtn: { height: 56, marginBottom: 12 },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  googleIcon: { fontSize: 17, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { color: '#1F1F1F', fontSize: 16, fontWeight: '700' },
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
  terms: { color: '#48484A', fontSize: 12, textAlign: 'center', marginTop: 28 },
});
