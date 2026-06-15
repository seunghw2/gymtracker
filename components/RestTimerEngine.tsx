import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore, useSettingsStore } from '../store/useStore';
import { scheduleRestEnd, cancelRest } from '../lib/notifications';
import { playRestDoneSound, startRestKeepAlive, stopRestKeepAlive } from '../lib/sound';

/**
 * 휴식 타이머 "엔진" — UI 없음(전역 1개만 마운트).
 * 화면 어디에 있든 휴식 종료 시각(restTimerEnd)에 맞춰 햅틱·사운드·로컬알림을 처리하고
 * 0초가 되면 타이머를 종료한다. 화면별 표시는 각 컴포넌트가 restTimerEnd로 직접 계산한다.
 */
export default function RestTimerEngine() {
  const { restTimerActive, restTimerEnd, stopRestTimer } = useWorkoutStore();
  const notifId = useRef<string | null>(null);

  // 완료 감지 + keep-alive
  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) {
      stopRestKeepAlive();
      cancelRest(notifId.current);
      notifId.current = null;
      return;
    }
    if (useSettingsStore.getState().soundOnSilent) startRestKeepAlive();
    const tick = () => {
      if (Date.now() >= restTimerEnd) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (useSettingsStore.getState().soundOnSilent) playRestDoneSound();
        stopRestKeepAlive();
        stopRestTimer();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restTimerActive, restTimerEnd]);

  // 로컬 알림 (재)예약 — 백그라운드/잠금 화면 소리
  useEffect(() => {
    if (!restTimerActive || !restTimerEnd) return;
    let cancelled = false;
    const prev = notifId.current;
    const secs = Math.max(0, Math.round((restTimerEnd - Date.now()) / 1000));
    (async () => {
      await cancelRest(prev);
      if (cancelled) return;
      notifId.current = await scheduleRestEnd(secs);
    })();
    return () => { cancelled = true; };
  }, [restTimerActive, restTimerEnd]);

  return null;
}
