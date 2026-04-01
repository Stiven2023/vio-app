import { create } from "zustand";

export interface User {
  id: string;
  name: string | null;
  role: string | null;
  avatarUrl?: string | null;
}

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  setSession: (user: User) => void;
  clearSession: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  verifySession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  setSession: (user) => set({ user, isAuthenticated: true }),
  clearSession: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    set({ user: null, isAuthenticated: false });
  },
  login: async (username, password) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) return false;
      const data = await res.json();

      set({ user: data.user, isAuthenticated: true });

      return true;
    } catch {
      return false;
    }
  },
  verifySession: async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });

      if (res.ok) {
        const data = await res.json();

        set({ user: data.user, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
