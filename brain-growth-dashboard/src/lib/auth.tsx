"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiFetch, setStoredToken, clearStoredAuth } from "./api-client";

interface User {
  id: string;
  name: string;
  email: string;
  provider?: string;
  emailVerified?: boolean;
  onboardingStep?: string;
  onboardingCompleted?: boolean;
  onboardingTourCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          localStorage.setItem("braingrow-user", JSON.stringify(data.user));
          if (data.token) setStoredToken(data.token);
          else if (data.user.token) setStoredToken(data.user.token);
          return;
        }
      }
      // Not authenticated by the server — never fall back to unverified local state.
      setUser(null);
      clearStoredAuth();
    } catch {
      setUser(null);
      clearStoredAuth();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) return { success: false, error: "Email and password are required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Invalid email address" };
    if (password.length < 6) return { success: false, error: "Password must be at least 6 characters" };

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem("braingrow-user", JSON.stringify(data.user));
        if (data.token) setStoredToken(data.token);
        return { success: true };
      }
      return { success: false, error: data.error || "Login failed" };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    if (!name.trim()) return { success: false, error: "Name is required" };
    if (!email || !password) return { success: false, error: "Email and password are required" };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Invalid email address" };
    if (password.length < 6) return { success: false, error: "Password must be at least 6 characters" };

    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        const u = data.data?.user || data.user;
        const t = data.data?.token || data.token;
        setUser(u);
        localStorage.setItem("braingrow-user", JSON.stringify(u));
        if (t) setStoredToken(t);
        return { success: true };
      }
      const errMsg = typeof data.error === "object" ? data.error?.message : data.error;
      return { success: false, error: errMsg || "Registration failed" };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const loginWithProvider = useCallback(async (provider: string) => {
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem("braingrow-user", JSON.stringify(data.user));
        if (data.token) setStoredToken(data.token);
        return { success: true };
      }
      return { success: false, error: data.error || "OAuth failed" };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    clearStoredAuth();
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithProvider, logout, isAuthenticated: !!user, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
