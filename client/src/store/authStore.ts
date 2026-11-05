import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionUser } from "@/types/auth";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  setSession: (session: { accessToken: string; refreshToken: string; user: SessionUser }) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "tm-ems-auth" },
  ),
);
