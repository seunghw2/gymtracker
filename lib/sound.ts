import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let keepAlive: AudioPlayer | null = null;
let setPlayer: AudioPlayer | null = null;
let configured = false;

/**
 * 앱 시작 시 1회 호출. 무음 스위치를 무시하고(playsInSilentMode), 음악과 함께
 * 재생되며(mixWithOthers), 백그라운드에서도 오디오 세션을 유지(shouldPlayInBackground).
 * 휴식 중 keep-alive(무음 루프)를 켜두면 앱이 백그라운드에서도 살아 있어
 * 카운트다운 타이머가 계속 돌고 종료음이 무음/잠금 상태에서도 난다.
 */
export async function configureAudio() {
  if (configured) return;
  configured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: true,
    });
    player = createAudioPlayer(require('../assets/sounds/rest-done.wav'));
    keepAlive = createAudioPlayer(require('../assets/sounds/rest-done.wav'));
    keepAlive.loop = true;
    keepAlive.volume = 0; // 무음 — 음악/세션에 영향 없이 앱만 살려둠
  } catch {
    /* 오디오 미지원 환경 무시 */
  }
}

/** 휴식 시작 시: 무음 루프로 백그라운드 오디오 세션 유지(앱·타이머 살아있게). */
export function startRestKeepAlive() {
  try {
    if (!keepAlive) {
      keepAlive = createAudioPlayer(require('../assets/sounds/rest-done.wav'));
      keepAlive.loop = true;
      keepAlive.volume = 0;
    }
    keepAlive.seekTo(0);
    keepAlive.play();
  } catch {
    /* 무시 */
  }
}

/** 휴식 종료/건너뛰기 시: keep-alive 정지(배터리 보호). */
export function stopRestKeepAlive() {
  try {
    keepAlive?.pause();
  } catch {
    /* 무시 */
  }
}

/** 세트 완료 체크 시 짧은 확인음. 휴식 종료음과 같은 음원을 약간 작게 재생. */
export function playSetDoneSound() {
  try {
    if (!setPlayer) {
      setPlayer = createAudioPlayer(require('../assets/sounds/rest-done.wav'));
      setPlayer.volume = 0.6;
    }
    setPlayer.seekTo(0);
    setPlayer.play();
  } catch {
    /* 무시 */
  }
}

/** 휴식 완료 알림음 재생 (무음 모드에서도, keep-alive 중이면 백그라운드에서도 들림). */
export function playRestDoneSound() {
  try {
    if (!player) {
      player = createAudioPlayer(require('../assets/sounds/rest-done.wav'));
    }
    player.seekTo(0);
    player.play();
  } catch {
    /* 무시 */
  }
}
