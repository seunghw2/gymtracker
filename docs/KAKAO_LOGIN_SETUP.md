# 카카오 로그인 셋업 가이드

GymTracker는 **모바일이 카카오에서 직접 OAuth 인증 → Kakao Access Token 획득 → 백엔드로 전달**하는 방식을 사용합니다.

## 1. Kakao Developers 앱 등록

1. https://developers.kakao.com 접속 → 로그인
2. **내 애플리케이션 → 애플리케이션 추가하기**
3. 앱 이름: `GymTracker`, 사업자명: 본인 이름 → 저장
4. **앱 키** 탭에서 **REST API 키** 복사 (이게 클라이언트 ID 역할)

## 2. 플랫폼 등록

**플랫폼 → iOS/Android 등록** (Expo Go로 테스트 시 둘 다 등록 권장)

| 항목 | 값 |
|------|------|
| iOS 번들 ID | `com.gymtracker` 또는 `host.exp.Exponent` (Expo Go) |
| Android 패키지명 | `com.gymtracker` 또는 `host.exp.exponent` (Expo Go) |

## 3. Redirect URI 등록

**카카오 로그인 → Redirect URI** 에 다음 등록:

### 개발 (Expo Go)
Expo Go에서 사용되는 URI를 확인하려면 앱을 한 번 실행한 뒤 로그인 버튼을 눌렀을 때 콘솔에 찍히는 redirect URI를 보세요. 보통 다음 형식:

```
exp://192.168.x.x:8081/--/auth/kakao
```

LAN IP가 바뀌면 매번 다시 등록해야 합니다. **개발 빌드 사용을 권장**합니다.

### 개발 빌드 / 운영 빌드
```
gymtracker://auth/kakao
```

## 4. 카카오 로그인 활성화

**카카오 로그인** 탭 → **활성화 설정 ON**

**동의항목** 탭에서 아래 정보 활성화:
- 닉네임 (필수)
- 프로필 사진 (필수)
- 카카오계정 (이메일) (선택)

## 5. RN 앱 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
cd "/Users/shstl/Claude Code/gymtracker"
cp .env.example .env
```

`.env` 편집:
```
EXPO_PUBLIC_KAKAO_REST_API_KEY=여기에_REST_API_키_붙여넣기
```

## 6. Expo 재시작

환경변수 반영을 위해 캐시 클리어 후 재시작:

```bash
npx expo start --clear
```

## 7. 테스트

앱 → 로그인 화면 → **카카오로 시작하기** 버튼 탭

1. 브라우저가 열리며 카카오 로그인 페이지 표시
2. 카카오 계정으로 로그인
3. 권한 동의 화면 → 동의
4. 앱으로 복귀하며 자동 로그인 완료

## 트러블슈팅

### `KOE006` (잘못된 redirect URI)
Kakao Developers의 Redirect URI와 앱에서 사용하는 URI가 일치하지 않음.

디버깅: `lib/kakaoAuth.ts`의 `getKakaoRedirectUri()` 호출 결과를 콘솔에 찍어서 등록한 URI와 비교.

### `Cancelled`
사용자가 로그인을 취소했거나 브라우저를 닫은 경우. 에러로 처리하지 않습니다.

### `EXPO_PUBLIC_KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다`
`.env` 파일이 없거나 키가 비어있음. 위 5번 단계 확인 후 `npx expo start --clear`로 재시작.

### Expo Go에서 동작은 하지만 콜백이 안 옴
Expo Go의 Redirect URI(`exp://`)는 단말기 IP에 종속됩니다. 개발 빌드(`npx expo run:ios`)를 사용하면 `gymtracker://` 스킴이 동작합니다.

## 백엔드 환경변수

백엔드는 카카오 토큰 검증을 위해 Kakao Open API (`kapi.kakao.com`)에 요청을 보냅니다. **별도 환경변수 불필요** (REST API 키나 시크릿 키 없이도 access token만 있으면 user info 조회 가능).
