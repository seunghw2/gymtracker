import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// 웹 브라우저 콜백 자동 처리 (iOS Safari/Chrome → 앱으로 복귀)
WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: 'https://kauth.kakao.com/oauth/token',
};

export type KakaoLoginResult = {
  accessToken: string;
};

/**
 * 카카오 로그인을 수행하고 Kakao Access Token을 반환.
 * 이후 백엔드의 /api/v1/auth/kakao 에 전달하면 GymTracker JWT 발급.
 */
export async function loginWithKakao(): Promise<KakaoLoginResult> {
  if (!KAKAO_REST_API_KEY) {
    throw new Error(
      'EXPO_PUBLIC_KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.\n' +
      'Kakao Developers에서 REST API 키를 받아 .env 파일에 추가하세요.'
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'gymtracker',
    path: 'auth/kakao',
  });

  const request = new AuthSession.AuthRequest({
    clientId: KAKAO_REST_API_KEY,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['profile_nickname', 'profile_image', 'account_email'],
    usePKCE: false, // Kakao는 PKCE 미지원
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('카카오 로그인이 취소되었습니다.');
  }
  if (result.type === 'error') {
    throw new Error(result.error?.message ?? '카카오 로그인 중 오류가 발생했습니다.');
  }
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('인증 코드를 받지 못했습니다.');
  }

  // Authorization Code → Access Token 교환
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: KAKAO_REST_API_KEY,
      code: result.params.code,
      redirectUri,
      extraParams: {
        grant_type: 'authorization_code',
      },
    },
    discovery
  );

  if (!tokenResult.accessToken) {
    throw new Error('카카오 액세스 토큰을 받지 못했습니다.');
  }

  return { accessToken: tokenResult.accessToken };
}

/**
 * 현재 디바이스의 Redirect URI를 반환 (Kakao Developers에 등록할 값).
 * 디버그용.
 */
export function getKakaoRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'gymtracker',
    path: 'auth/kakao',
  });
}
