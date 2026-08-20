import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin" | "Customer" | "Admin" | "Manager" | "manager" | "Waiter" | "waiter";
  isCodDisabled?: boolean;
  mobile?: string;
  address?: string;
  profileImage?: string;
  selectedAddress?: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthModalOpen: boolean;
  authMode: "login" | "register";
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
  isWaiter: () => boolean;
  isStaff: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthModalOpen: false,
      authMode: "login",

      setUser: (user) => set({ user }),
      setToken: (token) => {
        if (token) localStorage.setItem("auth_token", token);
        else localStorage.removeItem("auth_token");
        set({ token });
      },

      logout: () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("foodie-location"); // clear persisted location
        // Also clear in-memory state immediately (no refresh needed)
        // Lazy import to avoid circular dependency
        import("./useLocationStore").then(({ useLocationStore }) => {
          useLocationStore.getState().clearSelectedAddress();
        });
        set({ user: null, token: null });
      },

      openAuthModal: (mode = "login") => set({ isAuthModalOpen: true, authMode: mode }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      isAuthenticated: () => !!get().token,
      isAdmin: () => get().user?.role === "admin" || get().user?.role === "Admin",
      isManager: () => get().user?.role === "manager" || get().user?.role === "Manager",
      isWaiter: () => get().user?.role === "waiter" || get().user?.role === "Waiter",
      isStaff: () => ["admin", "Admin", "manager", "Manager", "waiter", "Waiter"].includes(get().user?.role || ""),
    }),
    {
      name: "swiggy-auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
