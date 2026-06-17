import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { getNotifications, parseLinkParams } from '../db/api/notifications';
import { presentLocalNow } from '../lib/notifications';

/**
 * 서버 인박스 알림 → 로컬 알림 브리지(Expo Go 한계 내 최대치).
 * 앱이 살아있는 동안(포그라운드) 주기적으로 새 알림을 폴링해, 새로 생긴 항목을
 * 로컬 알림 배너로 띄운다. 화면을 떠나 있어도 리포트 완료 등을 알 수 있다.
 * (앱을 완전히 종료한 동안엔 동작하지 않음 — 그건 원격 푸시가 필요.)
 */
const POLL_MS = 20000;

export default function NotificationBridge() {
  const router = useRouter();
  const lastSeenId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 탭 시 딥링크 이동
    const sub = Notifications.addNotificationResponseReceivedListener(res => {
      const data = res.notification.request.content.data as any;
      const link = data?.link as string | undefined;
      if (!link) return;
      const params = data?.params ?? undefined;
      try {
        router.push(params ? ({ pathname: link, params } as any) : (link as any));
      } catch { /* ignore */ }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    let mounted = true;

    const poll = async (silent: boolean) => {
      try {
        const r = await getNotifications();
        if (!mounted) return;
        const maxId = r.items.reduce((m, n) => Math.max(m, n.id), 0);
        if (lastSeenId.current == null) {
          lastSeenId.current = maxId; // 최초엔 기준선만(기존 알림으로 울리지 않음)
          return;
        }
        if (silent) { lastSeenId.current = Math.max(lastSeenId.current, maxId); return; }
        const fresh = r.items
          .filter(n => n.id > (lastSeenId.current ?? 0) && !n.read)
          .sort((a, b) => a.id - b.id);
        for (const n of fresh) {
          await presentLocalNow(n.title, n.body, n.linkPath ?? undefined, parseLinkParams(n.linkParams));
        }
        lastSeenId.current = Math.max(lastSeenId.current, maxId);
      } catch { /* 네트워크 실패는 조용히 무시 */ }
    };

    const start = () => {
      if (timer.current) return;
      poll(false);
      timer.current = setInterval(() => poll(false), POLL_MS);
    };
    const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

    start(); // 첫 폴은 기준선만 설정(기존 알림으로 울리지 않음)

    const onState = (st: AppStateStatus) => { st === 'active' ? start() : stop(); };
    const appSub = AppState.addEventListener('change', onState);

    return () => { mounted = false; stop(); appSub.remove(); };
  }, []);

  return null;
}
