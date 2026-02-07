import { create } from "zustand";

export interface User {
  name: string | null;
  role: string | null;
}

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  setSession: (user: User) => void;
  clearSession: () => void;
  login: (email: string, password: string) => Promise<boolean>;
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
  login: async (email, password) => {
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
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
    const res = await fetch("/api/auth/me", { credentials: "include" });

    if (res.ok) {
      const data = await res.json();

      set({ user: data.user, isAuthenticated: true });
    } else {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
