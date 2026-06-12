# 소셜 로그인 실제 적용 가이드 (Apple / Kakao / Google)

코드는 3가지 소셜 로그인이 모두 구현돼 있다. **실제로 동작하려면 각 플랫폼 콘솔
설정이 필요**하며, 이 문서는 그 절차를 정리한다.

## 공통 구조

```
[앱] 소셜 SDK/OAuth로 토큰 획득
  → [백엔드] POST /api/v1/auth/{apple|kakao|google} 로 토큰 전달
  → 백엔드가 토큰 검증(Apple/Google: JWKS 서명, Kakao: 사용자 정보 API)
  → 유저 찾기/생성 후 GymTracker JWT(access+refresh) 발급
```

| | 프론트 | 백엔드 검증 | 유저 식별 |
|---|---|---|---|
| Apple | `expo-apple-authentication` | JWKS (`appleid.apple.com`) | `apple_sub` |
| Kakao | `expo-auth-session` (lib/kakaoAuth.ts) | kapi 사용자 정보 조회 | `kakao_id` |
| Google | `expo-auth-session/providers/google` | JWKS (`googleapis.com`) | `google_sub` |

---

## 1. Apple (Sign in with Apple)

**현재 상태**: 코드 완성. Expo Go(iOS)에서 바로 테스트 가능.

**실제 적용에 필요한 일:**
1. **Apple Developer Program 가입** (연 $99) — 스토어 출시의 선결 조건이기도 함.
2. [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles →
   Identifiers → App ID `com.seunghw2.gymtracker` 생성(없으면) → **Sign in with Apple** capability 체크.
3. EAS 빌드는 `app.json`의 `"usesAppleSignIn": true` 덕에 entitlement를 자동 포함 — 별도 작업 없음.
4. 백엔드 허용 audience는 `application.yml`의 `app.apple.client-ids`:
   - `com.seunghw2.gymtracker` (실제 앱) + `host.exp.Exponent` (Expo Go 개발용)
   - **출시 시 `host.exp.Exponent`는 제거 권장** (Expo Go로 발급된 토큰 차단).

**App Store 심사 주의**: 소셜 로그인(카카오/구글)을 제공하는 앱은 Apple 로그인을
**반드시 함께** 제공해야 함(가이드라인 4.8) — 이미 충족.

---

## 2. Kakao

**현재 상태**: 코드 완성(`lib/kakaoAuth.ts` — authorization code 플로우).
동작하려면 카카오 콘솔 설정 필요. (기존 문서: `docs/KAKAO_LOGIN_SETUP.md` 참고)

**실제 적용에 필요한 일:**
1. [developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 앱 생성.
2. **앱 키 > REST API 키** 복사 → 프론트 `.env`의 `EXPO_PUBLIC_KAKAO_REST_API_KEY` (이미 설정돼 있음 — 본인 앱의 키인지 확인).
3. **카카오 로그인 활성화**: 제품 설정 > 카카오 로그인 > 활성화 ON.
4. **Redirect URI 등록**: 제품 설정 > 카카오 로그인 > Redirect URI에
   - `gymtracker://auth/kakao` (스토어/개발 빌드용)
   - Expo Go 테스트 시에는 `exp://...` 형태가 필요 — 앱에서 `getKakaoRedirectUri()`(lib/kakaoAuth.ts)를
     호출해 콘솔에 찍히는 값을 그대로 등록.
5. **동의항목**: 제품 설정 > 카카오 로그인 > 동의항목에서
   닉네임(필수), 프로필 사진(선택), **카카오계정 이메일(선택 동의)** 설정.
   - 이메일은 **비즈 앱 전환**(사업자 등록 또는 개인 개발자 비즈앱) 후에만 요청 가능.
6. **플랫폼 등록**: 앱 설정 > 플랫폼 > iOS에 번들 ID `com.seunghw2.gymtracker` 등록
   (Android 출시 시 패키지명 + 키 해시도).
7. (출시 전) 카카오 로그인 사용 앱은 **검수 불필요**하지만, 이메일 등 추가 동의항목은
   항목별 검수가 있을 수 있음 — 콘솔 안내에 따름.

---

## 3. Google

**현재 상태**: 코드 완성. **클라이언트 ID 미설정 시 버튼이 숨겨짐**(.env에 ID를 넣으면 노출).

> ⚠️ **Google 로그인은 Expo Go에서 동작하지 않는다** (Google이 `exp://` redirect를
> 허용하지 않음). 개발 빌드(`eas build --profile development`) 또는 스토어 빌드에서만 테스트 가능.

**실제 적용에 필요한 일:**
1. [console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 생성.
2. **OAuth 동의 화면** 구성: External, 앱 이름/지원 이메일, scope는 기본(openid/email/profile)이면 검수 불필요.
3. **사용자 인증 정보 > OAuth 클라이언트 ID** 3종 생성:
   - **iOS**: 번들 ID `com.seunghw2.gymtracker`
   - **Android**: 패키지명 + SHA-1 (EAS 빌드 키의 SHA-1은 `eas credentials`로 확인)
   - **웹 애플리케이션**: (id_token 검증·웹 폴백용)
4. 프론트 `.env`에 추가:
   ```
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxx.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=yyy.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=zzz.apps.googleusercontent.com
   ```
5. **백엔드** `gymtracker-backend/.env`에 추가(콤마 구분, 발급받은 ID 전부):
   ```
   GOOGLE_CLIENT_IDS=xxx.apps...,yyy.apps...,zzz.apps...
   ```
   → `./run-backend.sh` 재시작. (미설정 시 placeholder라 모든 구글 토큰이 거부됨 — 안전한 기본값)
6. iOS 빌드: `app.json`에 iOS용 **URL scheme**(역방향 클라이언트 ID,
   `com.googleusercontent.apps.xxx`) 추가 필요 — 클라이언트 ID 발급 후:
   ```json
   "ios": { "infoPlist": { "CFBundleURLTypes": [{ "CFBundleURLSchemes": ["com.googleusercontent.apps.xxx"] }] } }
   ```

---

## 4. 체크리스트 (출시 전)

- [ ] Apple Developer Program 가입 + App ID에 Sign in with Apple capability
- [ ] Kakao 콘솔: Redirect URI(`gymtracker://auth/kakao`) + iOS 플랫폼(번들 ID) 등록
- [ ] Kakao 이메일 동의항목 필요 시 비즈앱 전환
- [ ] Google Cloud: OAuth 클라이언트 ID 3종 발급 → 프론트 `.env` + 백엔드 `GOOGLE_CLIENT_IDS`
- [ ] `app.json`에 Google iOS URL scheme 추가
- [ ] 출시 빌드 전 백엔드 `app.apple.client-ids`에서 `host.exp.Exponent` 제거
- [ ] 실기기(개발 빌드)에서 3개 로그인 전부 스모크 테스트
- [ ] **Apple 토큰 폐기(revocation)**: Apple은 회원탈퇴 시 Sign in with Apple 토큰을
  `https://appleid.apple.com/auth/revoke`로 폐기하도록 요구(2022.6.30~).
  이 호출에는 Apple Developer 계정의 **Service Key(.p8)로 서명한 client_secret**이
  필요해서 Developer Program 가입 후에만 구현 가능 — 가입 후 `UserAccountService.deleteAccount`에
  APPLE provider일 때 revoke 호출 추가할 것.
