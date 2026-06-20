import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllWorkoutDates } from '../db/queries';
import { scheduleLocalAt, scheduleWeekly, cancelScheduled } from './notifications';

/**
 * 운동 리마인더(기기-로컬). "마지막 운동 + N일째 HH시"에 한 번 로컬 알림을 예약한다.
 * 운동을 완료하거나 앱을 켤 때마다 다시 계산해 미뤄지므로, 쉰 날에만 울린다(매일 X).
 * 로컬 예약이라 앱이 닫혀 있어도 OS가 띄워준다(Expo Go OK).
 */
const K_ENABLED = 'reminder_enabled';
const K_DAYS = 'reminder_days';
const K_HOUR = 'reminder_hour';
const K_SCHED_ID = 'reminder_sched_id';

export type ReminderSettings = { enabled: boolean; days: number; hour: number };

export async function getReminderSettings(): Promise<ReminderSettings> {
  const [en, days, hour] = await Promise.all([
    AsyncStorage.getItem(K_ENABLED),
    AsyncStorage.getItem(K_DAYS),
    AsyncStorage.getItem(K_HOUR),
  ]);
  return {
    enabled: en === '1',
    days: clampInt(days, 2, 1, 14),
    hour: clampInt(hour, 19, 0, 23),
  };
}

export async function setReminderSettings(next: ReminderSettings): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(K_ENABLED, next.enabled ? '1' : '0'),
    AsyncStorage.setItem(K_DAYS, String(next.days)),
    AsyncStorage.setItem(K_HOUR, String(next.hour)),
  ]);
  await refreshWorkoutReminder();
}

/** 설정과 마지막 운동일을 보고 다음 리마인더를 (재)예약. 끄면 취소만. */
export async function refreshWorkoutReminder(): Promise<void> {
  const prevId = await AsyncStorage.getItem(K_SCHED_ID);
  await cancelScheduled(prevId);
  await AsyncStorage.removeItem(K_SCHED_ID);

  const s = await getReminderSettings();
  if (!s.enabled) return;

  let last: Date | null = null;
  try {
    const dates = await getAllWorkoutDates(); // ISO 'YYYY-MM-DD'
    if (dates && dates.length) {
      const max = dates.reduce((a, b) => (a > b ? a : b));
      last = new Date(max + 'T00:00:00');
    }
  } catch {
    /* ignore — last 없이도 진행 */
  }
  const base = last ?? new Date();
  const fire = new Date(base);
  fire.setDate(fire.getDate() + s.days);
  fire.setHours(s.hour, 0, 0, 0);
  // 이미 지난 시각이면 다음 날 같은 시각으로
  while (fire.getTime() <= Date.now()) fire.setDate(fire.getDate() + 1);

  const id = await scheduleLocalAt(
    fire,
    '운동할 시간이야 💪',
    `${s.days}일째 쉬고 있어. 가볍게라도 다녀오면 흐름이 안 끊겨.`,
    '/workout',   // 워크아웃은 독립 라우트(app/workout.tsx). (tabs)/workout 은 라우트 개편으로 삭제됨.
  );
  if (id) await AsyncStorage.setItem(K_SCHED_ID, id);
}

/**
 * 주간 코치 알림 — 매주 월요일 06:00에 한 번. 탭하면 코치 탭(주간 채팅)으로.
 * 실제 요약은 앱이 열릴 때 백엔드에서 로드되고, 여기선 "도착했어요" 배너만 띄운다.
 */
const K_WEEKLY_COACH_ID = 'weekly_coach_sched_id';
export async function refreshWeeklyCoachNotification(): Promise<void> {
  const prev = await AsyncStorage.getItem(K_WEEKLY_COACH_ID);
  await cancelScheduled(prev);
  // weekday: 1=일 … 2=월
  const id = await scheduleWeekly(2, 6, 0,
    '이번 주 코치 메시지 📋',
    '지난주 요약과 이번 주 코치 메시지가 도착했어요.',
    '/(tabs)/chat',
  );
  if (id) await AsyncStorage.setItem(K_WEEKLY_COACH_ID, id);
  else await AsyncStorage.removeItem(K_WEEKLY_COACH_ID);
}

function clampInt(v: string | null, def: number, lo: number, hi: number): number {
  const n = v == null ? def : parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
