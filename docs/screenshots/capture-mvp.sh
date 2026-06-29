#!/usr/bin/env bash
# GymTracker — 현재(MVP) 화면 자동 캡처
# 예전 방식 재현: iOS 시뮬레이터 + gymtracker:// 딥링크 진입 + simctl screenshot.
#
# 사전 준비 (GUI 터미널에서, 한 번):
#   1) Xcode 또는: xcodebuild -downloadPlatform iOS        # 시뮬레이터 런타임 설치
#   2) xcrun simctl list devices                            # 부팅할 iPhone 확인/생성
#      필요시: xcrun simctl create "iPhone 17 Pro" "iPhone 17 Pro" "iOS26.5"
#   3) xcrun simctl boot "iPhone 17 Pro" && open -a Simulator
#   4) npx expo run:ios                                     # dev build 설치(scheme: gymtracker)
#      (dev build여야 gymtracker:// 딥링크가 동작. Expo Go는 exp:// 형태라 별도)
#   5) 앱에서 로그인/온보딩 1회 통과(게이트 해제) 후 아래 실행:
#        bash docs/screenshots/capture-mvp.sh
#
# 주의: 인증/온보딩 게이트가 걸려 있으면 딥링크가 홈으로 튕길 수 있음 → 먼저 1회 수동 통과.

set -uo pipefail
OUT="$(cd "$(dirname "$0")" && pwd)/mvp"
mkdir -p "$OUT"
DELAY="${DELAY:-2.5}"   # 화면 전환 대기(초). 느리면 DELAY=4 로 실행.

shot() { # $1=deeplink path  $2=filename(번호-이름)
  xcrun simctl openurl booted "gymtracker://$1" >/dev/null 2>&1 || true
  sleep "$DELAY"
  xcrun simctl io booted screenshot "$OUT/$2.png" >/dev/null 2>&1 \
    && echo "  ✓ $2  ($1)" || echo "  ✗ $2  (캡처 실패 — 시뮬레이터 부팅/앱 실행 확인)"
}

echo "캡처 시작 → $OUT"
# 탭
shot ""                 "01-home"
shot "exercises"        "02-exercises"
shot "calendar"         "03-record"
shot "reports"          "04-reports"
shot "chat"             "05-chat"
shot "settings"         "06-settings"
# 스택/모달
shot "goals"            "07-goals"
shot "account"          "08-account"
shot "workout"          "09-workout"
shot "exercise-add"     "10-exercise-add"
shot "onboarding"       "11-onboarding"
shot "custom-exercises" "12-custom-exercises"
shot "body-parts"       "13-body-parts"
shot "exercise-rest"    "14-exercise-rest"
shot "workout-reminder" "15-workout-reminder"
echo "완료. 종목 상세(exercise/[name])·바텀시트는 앱 내 탭으로 진입해 수동 캡처 권장."
echo "→ $OUT 의 PNG를 확인하세요."
