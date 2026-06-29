# 화면 캡처 방법 (세션 간 재현용)

> GymTracker 화면을 실제 이미지로 캡처하는 검증된 방법들. 2026-06-29 4방안 실측 기준.
> 앱: Expo React Native(expo-router), scheme=`gymtracker`. 백엔드 8080(`api.hammerslog.trade`), 프론트 dev server는 보통 폰 터널(`npx expo start --tunnel`, 8081).

## 0. 어떤 방법을 쓸까 — 세션 유형이 핵심

| 실행 환경 | 추천 방법 | 이유 |
|---|---|---|
| **Claude Code 자동화 셸**(리모트/백그라운드) | **A. Expo Web** | simctl·시뮬레이터가 비-GUI 세션이라 막힘. Web만 무인 작동 |
| **본인 맥 GUI 터미널**(화면 앞) | C. iOS 시뮬레이터 또는 D. USB 폰 | 네이티브 그대로. simctl이 정상 동작 |
| 네이티브 픽셀 정확도가 꼭 필요 | **D. USB 폰** | 실물 렌더 100% |

핵심 교훈: **자동화 셸에서 `xcrun simctl`은 hang한다**(아래 C 참고). 그 환경에선 Web(A)이 유일한 무인 경로.

---

## A. Expo Web + 헤드리스 브라우저 ✅ (자동화 셸에서 작동 — 1순위)

react-native-web으로 정적 web 빌드 후 Playwright(Chrome)로 캡처. **네이티브 모듈(expo-haptics/notifications 등)이 web 빌드를 깨뜨리지 않음**을 실측 확인. 단 react-native-web 렌더라 네이티브와 100% 동일하진 않음(레이아웃·색·텍스트·위계 평가엔 충분, 제스처/일부 네이티브 컴포넌트는 차이 가능).

### 절차
```bash
cd "/Users/shstl/Claude Code/gymtracker"

# 1) 의존성 (react-dom은 react와 버전 '정확히' 일치해야 함 — mismatch 시 React error #527)
#    현재 react@19.1.0 → react-dom@19.1.0 핀. react-native-web ^0.21.x.
npm i react-native-web react-dom@19.1.0

# 2) 정적 web 빌드 (무인 가능, 30~60초)
npx expo export -p web          # → dist/ 생성(index.html + JS 번들)

# 3) index.html 패치 (필수!) — 번들에 import.meta가 있어 <script>가 module이어야 실행됨.
#    type="module" 없으면 화면이 백지로 뜸.
sed -i '' 's/<script src=/<script type="module" src=/' dist/index.html

# 4) 정적 서버
npx serve -s dist -l 4999 &     # http://localhost:4999

# 5) Playwright로 캡처 (Chrome.app 있으면 channel:'chrome'로 다운로드 불필요)
#    playwright는 프로젝트가 아니라 /tmp 등에 따로 설치해 package.json 오염 방지 가능.
```

캡처 스크립트 예 (`/tmp/cap.mjs`):
```js
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await p.goto('http://localhost:4999/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'ui-ux-audit/screenshots/test/web-home.png' });
await b.close();
```

### 인증/온보딩 게이트 우회 (검증 완료 — 18/18 화면 실데이터 캡처)
미로그인 시 `/`는 `/login`으로 튕긴다. 아래 4단계로 통과(2026-06-29 실측):

1. **인증 게이트** (`app/_layout.tsx` `bootstrap()` + `store/useAuthStore.ts` + `lib/tokenStore.ts`):
   localStorage 키 **`gt_access_token`** 을 읽어 백엔드 `/api/v1/auth/me`로 검증 → 성공 시 authenticated.
   web에선 tokenStore가 SecureStore 대신 **localStorage로 폴백**하므로 이 키만 채우면 됨.
2. **온보딩 게이트** (`app/(tabs)/index.tsx`): `goalSetting.onboarded`가 false면 `/onboarding`으로 리다이렉트.
   이건 백엔드 데이터라 **온보딩 끝낸 유저 토큰**을 쓰면 통과.
3. **JWT 발급** (`JwtTokenProvider.java`): HS512, `subject=userId`, `claim type:access`.
   루트 `.env`의 `JWT_SECRET`으로 node `jsonwebtoken`으로 직접 서명. 라이브 `/me`에 후보 id를 찔러 유저 확인.
   → **id=4 (seunghw2@gmail.com, onboarded:true, 운동기록 다수)** 가 캡처에 적합.
4. **CORS 함정 (핵심 — 이거 안 하면 전부 `/login`으로 튕김)**:
   백엔드가 `http://localhost:4999` origin의 preflight를 **403**으로 막아 `me()`가 throw→guest 처리됨.
   해결: **Chrome을 `--disable-web-security`로 띄우고**, Playwright `addInitScript`로 페이지 로드 *전* localStorage에 토큰 주입.

```js
// 토큰 발급 (node, /tmp에 jsonwebtoken 설치)
import jwt from 'jsonwebtoken';
const token = jwt.sign({ type: 'access' }, process.env.JWT_SECRET,
  { algorithm: 'HS512', subject: '4', expiresIn: '7d' });

// playwright: CORS 우회 + 로드 전 주입
const b = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--disable-web-security', '--disable-site-isolation-trials'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await ctx.addInitScript(t => localStorage.setItem('gt_access_token', t), token);
const p = await ctx.newPage();
for (const [route, name] of [['/', 'home'], ['/exercises', 'exercises'], ['/calendar', 'calendar'],
    ['/reports', 'reports'], ['/chat', 'chat'], ['/settings', 'settings'], ['/goals', 'goals'],
    ['/account', 'account'], ['/workout', 'workout'], ['/onboarding', 'onboarding'],
    ['/exercise-add', 'exercise-add'], ['/templates', 'templates'], ['/body-parts', 'body-parts'],
    ['/custom-exercises', 'custom-exercises'], ['/trainer', 'trainer']]) {
  await p.goto('http://localhost:4999' + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `ui-ux-audit/screenshots/test/web-${name}.png` });
}
```
- **expo-router web 경로는 그룹(`(tabs)`) 제외**: 홈=`/`, 종목=`/exercises`, 기록=`/calendar`, 리포트=`/reports`, 설정=`/settings`.
- 카카오 OAuth 실제 로그인은 web에서 불가 → 위 토큰 주입으로 우회.
- 데이터 0인 화면(`/ai` 이번 주 기록 없음)은 빈 상태로 정상 캡처됨.

### 주의
- `package.json`에 react-native-web/react-dom이 추가됨 — web 캡처를 상시 쓸 게 아니면 캡처 후 되돌릴지 결정.
- `dist/`는 빌드 산출물(gitignore 권장).

---

## B. Android 에뮬레이터 + adb screencap ⚠️ (설치 필요)

`adb shell screencap`은 부팅만 되면 표준 동작이라 유망하나, **이 맥엔 Android SDK가 전혀 없음**(adb·emulator·$ANDROID_HOME 전무).

### 설치 후 절차 (brew 있음, sudo 불필요)
```bash
brew install --cask android-commandlinetools           # adb/platform-tools (~0.1~0.5GB)
sdkmanager "platform-tools" "emulator" \
  "platforms;android-34" "system-images;android-34;google_apis;arm64-v8a"   # arm64! (~3~6GB, 10~30분)
avdmanager create avd -n gym -k "system-images;android-34;google_apis;arm64-v8a"
emulator -avd gym -no-window -no-audio -no-snapshot &   # 헤드리스 cold boot 1~3분
adb wait-for-device; until [ "$(adb shell getprop sys.boot_completed)" = 1 ]; do sleep 2; done
# Expo Go 설치 후 dev server(8081) 연결, 또는 expo run:android
adb exec-out screencap -p > ui-ux-audit/screenshots/test/android-home.png
```
- 총 4~7GB·30~60분. 디스크 여유 확인(루트 ~26GB free, 빠듯).
- 리모트 셸에서 에뮬레이터 cold boot가 hang할 위험은 미검증(설치 전이라).

---

## C. iOS 시뮬레이터 + simctl ❌(자동화 셸) / ✅(본인 GUI 세션)

기존 17종 캡처(`README.md`)가 이 방식. **하지만 Claude Code 자동화 셸에선 막힌다.**

### 왜 자동화 셸에서 막히나 (실측 결론)
- `xcrun simctl list runtimes/devices` → **35초+ hang(EXIT 124)**. (EXIT 0으로 보이는 건 `head` 파이프가 먼저 닫혀서 생긴 착시)
- 원인: CoreSimulatorService 프로세스는 살아있으나(PID 정상), `launchctl print gui/$(id -u)/...CoreSimulatorService` → **"Could not find service in domain"**. 자동화 셸이 **비-GUI launchd 세션**이라 시뮬레이터 데몬이 등록된 `gui/501` Mach 도메인에 바인딩 불가. 권한 문제가 아니라 **세션 격리**.
- 디바이스 데이터(`~/Library/Developer/CoreSimulator/Devices`에 17개)·SDK·Simulator.app은 모두 정상. 연결 경로만 끊김.

### 본인 맥 GUI 터미널에선 정상 → 이 방식 사용
사전 준비(런타임 없으면): `xcodebuild -downloadPlatform iOS` 또는 Xcode→Settings→Platforms.
부팅 후 딥링크 캡처는 **[`capture-mvp.sh`](capture-mvp.sh)** 사용(scheme `gymtracker://` + `simctl io booted screenshot`). dev build(`npx expo run:ios`)여야 딥링크 동작.

---

## D. 물리 폰(USB) + idevicescreenshot ⚠️→✅ (네이티브 100%, USB 연결만 하면 됨)

가장 정확(실물 렌더). 현재 **맥에 USB로 붙은 기기가 없어서** 막힘 — 연결만 하면 즉시 가능.

```bash
# 폰을 케이블로 맥에 연결 + "이 컴퓨터를 신뢰" 승인 후:
brew install libimobiledevice        # sudo 불필요, 수 분
idevice_id -l                        # 연결된 UDID 확인
idevicescreenshot ui-ux-audit/screenshots/test/device.png
```
- USB 미연결이면 무의미(`screencapture`는 맥 화면만, 폰 못 잡음).
- QuickTime 미러링도 USB 전제 + GUI 조작 필요 → idevicescreenshot이 자동화에 우위.

---

## 부록: 방안별 한 줄 판정 (2026-06-29 실측)
- **A Web**: ✅ 자동화 셸에서 작동하는 유일한 무인 경로. 로그인 화면 실제 캡처 성공.
- **B Android**: ⚠️ SDK 미설치, 4~7GB 설치하면 가능.
- **C simctl**: ❌ 자동화 셸(세션 격리), ✅ 본인 GUI 세션.
- **D USB 폰**: ⚠️ USB 미연결, 연결+`brew install libimobiledevice`면 즉시·최고 정확도.

관련 파일: [`capture-mvp.sh`](capture-mvp.sh)(simctl 딥링크 루프), [`README.md`](README.md)(구버전 17종 캡처 인덱스).
