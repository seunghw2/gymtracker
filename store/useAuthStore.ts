import { create } from 'zustand';
import { authApi, UserSummary } from '../lib/api';
import { tokenStore } from '../lib/tokenStore';
import { clearAllCache } from '../lib/cache';
import { clearSettingsCache } from '../db/api/settings';

type AuthState = {
  status: 'unknown' | 'authenticated' | 'guest';
  user: UserSummary | null;

  bootstrap: () => Promise<void>;
  kakao: (kakaoAccessToken: string) => Promise<void>;
  apple: (identityToken: string, name?: string | null) => Promise<void>;
  google: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,

  bootstrap: async () => {
    const token = await tokenStore.getAccessToken();
    if (!token) {
      set({ status: 'guest', user: null });
      return;
    }
    try {
      const user = await authApi.me();
      set({ status: 'authenticated', user });
    } catch {
      await tokenStore.clear();
      set({ status: 'guest', user: null });
    }
  },

  kakao: async (kakaoAccessToken) => {
    const res = await authApi.kakao(kakaoAccessToken);
    await tokenStore.saveTokens(res.accessToken, res.refreshToken);
    set({ status: 'authenticated', user: res.user });
  },

  apple: async (identityToken, name) => {
    const res = await authApi.apple(identityToken, name);
    await tokenStore.saveTokens(res.accessToken, res.refreshToken);
    set({ status: 'authenticated', user: res.user });
  },

  google: async (idToken) => {
    const res = await authApi.google(idToken);
    await tokenStore.saveTokens(res.accessToken, res.refreshToken);
    set({ status: 'authenticated', user: res.user });
  },

  logout: async () => {
    const refreshToken = await tokenStore.getRefreshToken();
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch { /* ignore */ }
    }
    await tokenStore.clear();
    clearAllCache();
    clearSettingsCache();
    set({ status: 'guest', user: null });
  },

  deleteAccount: async () => {
    await authApi.deleteAccount(); // 실패 시 throw — 화면에서 안내
    await tokenStore.clear();
    clearAllCache();
    clearSettingsCache();
    set({ status: 'guest', user: null });
  },
}));
