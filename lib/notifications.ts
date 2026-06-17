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
    // 휴식 타이머는 포그라운드에서 소리만(배너 X). 리포트·리마인더 등 data.banner=true 알림은 배너+목록 표시.
    handleNotification: async (n) => {
      const banner = !!(n.request.content.data as any)?.banner;
      return {
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: banner,
        shouldShowList: banner,
      };
    },
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('rest-timer', {
      name: '휴식 타이머',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }).catch(() => {});
    Notifications.setNotificationChannelAsync('general', {
      name: '리포트·리마인더',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }).catch(() => {});
  }
}

/** 즉시 로컬 알림 표시(앱이 살아있을 때 서버 이벤트 브리지용). data.banner로 포그라운드 배너 보장. */
export async function presentLocalNow(title: string, body: string, link?: string, params?: Record<string, string>): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { banner: true, link: link ?? null, params: params ?? null } },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
}

/** 특정 시각에 로컬 알림 예약. id 반환(실패 시 null). */
export async function scheduleLocalAt(date: Date, title: string, body: string, link?: string): Promise<string | null> {
  if (date.getTime() <= Date.now()) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title, body, sound: 'default',
        data: { banner: true, link: link ?? null },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: Platform.OS === 'android' ? 'general' : undefined,
      },
    });
  } catch {
    return null;
  }
}

/** 예약 알림 취소(id). */
export async function cancelScheduled(id: string | null) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
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
