import { apiRequest } from '../../lib/api';

// ── 애널리스트 알림(인박스) — 백엔드 camelCase 응답과 1:1 ──────────────

export type NotificationType = 'REPORT_READY' | 'STAGNATION' | 'PR' | 'REMINDER';

export type AppNotification = {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  linkPath: string | null;
  linkParams: string | null; // JSON 문자열
  createdAt: string;          // ISO LocalDateTime
};

export type NotificationList = {
  items: AppNotification[];
  unreadCount: number;
};

/** 알림 목록 + 안읽음 수(리마인드/스트릭은 서버가 조회 시 지연 생성). */
export async function getNotifications(): Promise<NotificationList> {
  return apiRequest<NotificationList>('/api/v1/notifications', { method: 'GET' });
}

/** 배지용 안읽음 수만. */
export async function getUnreadCount(): Promise<number> {
  const r = await apiRequest<{ unreadCount: number }>('/api/v1/notifications/unread-count', { method: 'GET' });
  return r.unreadCount;
}

/** 전체 읽음 처리. */
export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<void>('/api/v1/notifications/read-all', { method: 'POST' });
}

/** 기기 Expo 푸시 토큰 등록(원격 푸시 — 앱 종료 상태 알림용). */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  await apiRequest<void>('/api/v1/push/token', { method: 'POST', body: { token, platform } });
}

/** linkParams(JSON 문자열)를 라우터 params 객체로 파싱. 실패 시 undefined. */
export function parseLinkParams(raw: string | null): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : undefined;
  } catch {
    return undefined;
  }
}
