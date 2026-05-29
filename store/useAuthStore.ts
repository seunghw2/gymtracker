import { create } from 'zustand';
import { authApi, UserSummary } from '../lib/api';
import { tokenStore } from '../lib/tokenStore';

type AuthState = {
  status: 'unknown' | 'authenticated' | 'guest';
  user: UserSummary | null;

  bootstrap: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  kakao: (kakaoAccessToken: string) => Promise<void>;
  logout: () => Promise<void>;
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

  signup: async (email, password, name) => {
    const res = await authApi.signup(email, password, name);
    await tokenStore.saveTokens(res.accessToken, res.refreshToken);
    set({ status: 'authenticated', user: res.user });
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password);
    await tokenStore.saveTokens(res.accessToken, res.refreshToken);
    set({ status: 'authenticated', user: res.user });
  },

  kakao: async (kakaoAccessToken) => {
    const res = await authApi.kakao(kakaoAccessToken);
    await tokenStore.saveTokens(res.accessToken, res.refreshToken);
    set({ status: 'authenticated', user: res.user });
  },

  logout: async () => {
    const refreshToken = await tokenStore.getRefreshToken();
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch { /* ignore */ }
    }
    await tokenStore.clear();
    set({ status: 'guest', user: null });
  },
}));
