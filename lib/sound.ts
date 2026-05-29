import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let configured = false;

/**
 * 앱 시작 시 1회 호출. iOS 무음 스위치를 무시하고 재생하도록 오디오 세션 설정.
 * (포그라운드 한정 — 백그라운드 무음 무시는 Critical Alerts 권한 필요)
 */
export async function configureAudio() {
  if (configured) return;
  configured = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
    player = createAudioPlayer(require('../assets/sounds/rest-done.wav'));
  } catch {
    /* 오디오 미지원 환경 무시 */
  }
}

/** 휴식 완료 알림음 재생 (무음 모드에서도 들림, 앱이 포그라운드일 때). */
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
