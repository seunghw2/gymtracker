import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let configured = false;

/**
 * 앱 시작 시 1회 호출. 포그라운드에서는 소리만(배너 X),
 * 백그라운드/잠금 화면에서는 OS가 기본 배너+소리로 표시.
 */
export function configureNotifications() {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: false,
      shouldShowList: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('rest-timer', {
      name: '휴식 타이머',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }).catch(() => {});
  }
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** 휴식 종료 시각에 로컬 알림 예약. id 반환(실패 시 null). */
export async function scheduleRestEnd(seconds: number): Promise<string | null> {
  if (seconds <= 0) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: '휴식 완료 💪',
        body: '다음 세트를 시작하세요!',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: Platform.OS === 'android' ? 'rest-timer' : undefined,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRest(id: string | null) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
}
