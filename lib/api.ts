import { API_URL } from './config';
import { tokenStore } from './tokenStore';

export type ApiError = { code: string; message: string; details?: Record<string, string> };

export class ApiException extends Error {
  status: number;
  body: ApiError;
  constructor(status: number, body: ApiError) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      await tokenStore.saveTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

type RequestOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  retried?: boolean;
};

export async function apiRequest<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retried = false } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await tokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !retried) {
    const ok = await tryRefresh();
    if (ok) return apiRequest<T>(path, { ...opts, retried: true });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiException(res.status, data ?? { code: 'UNKNOWN', message: '요청 실패' });
  }
  return data as T;
}

/** 원시 텍스트(예: CSV) 응답용. 인증 헤더 포함. */
export async function apiText(path: string): Promise<string> {
  const headers: Record<string, string> = {};
  const token = await tokenStore.getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) throw new ApiException(res.status, { code: 'UNKNOWN', message: '내보내기 실패' });
  return res.text();
}

// 도메인별 wrapper
export const authApi = {
  kakao: (accessToken: string) =>
    apiRequest<TokenResponse>('/api/v1/auth/kakao', {
      method: 'POST', auth: false, body: { accessToken },
    }),
  apple: (identityToken: string, name?: string | null) =>
    apiRequest<TokenResponse>('/api/v1/auth/apple', {
      method: 'POST', auth: false, body: { identityToken, name: name ?? null },
    }),
  google: (idToken: string) =>
    apiRequest<TokenResponse>('/api/v1/auth/google', {
      method: 'POST', auth: false, body: { idToken },
    }),
  logout: (refreshToken: string) =>
    apiRequest<void>('/api/v1/auth/logout', {
      method: 'POST', auth: false, body: { refreshToken },
    }),
  me: () => apiRequest<UserSummary>('/api/v1/auth/me'),
  /** 회원탈퇴 — 계정과 모든 데이터 영구 삭제. */
  deleteAccount: () => apiRequest<void>('/api/v1/auth/me', { method: 'DELETE' }),
};

export type UserSummary = {
  id: number;
  email: string;
  name: string;
  profileImage: string | null;
  provider: 'LOCAL' | 'KAKAO';
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
};
