"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "./auth";
import { apiFetch } from "./api-client";

interface Company {
  id: string;
  name: string;
  slug: string;
  industry?: string | null;
  website?: string | null;
  role?: string;
}

interface CompanyContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (c: Company | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  createCompany: (data: { name: string; industry?: string; website?: string; description?: string }) => Promise<{ success: boolean; company?: Company; error?: string }>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCompanies([]);
      setCurrentCompanyState(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        const list: Company[] = data.companies || [];
        setCompanies(list);

        // Restore current from localStorage or pick first
        const storedId = localStorage.getItem("braingrow-company");
        let current: Company | null = null;
        if (storedId) current = list.find((c) => c.id === storedId) || null;
        if (!current && list.length > 0) current = list[0];
        setCurrentCompanyState(current);
        if (current) localStorage.setItem("braingrow-company", current.id);
      } else {
        setCompanies([]);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  const setCurrentCompany = useCallback((c: Company | null) => {
    setCurrentCompanyState(c);
    if (c) localStorage.setItem("braingrow-company", c.id);
    else localStorage.removeItem("braingrow-company");
  }, []);

  const createCompany = useCallback(async (data: { name: string; industry?: string; website?: string; description?: string; profileType?: string; creatorNiche?: string; contentNiche?: string; creatorGoals?: string }) => {
    try {
      const res = await apiFetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok && json.company) {
        await refresh();
        // auto-select new company
        setCurrentCompanyState(json.company);
        localStorage.setItem("braingrow-company", json.company.id);
        // auto-seed demo data in the background (non-blocking)
        apiFetch(`/api/companies/${json.company.id}/seed`, { method: "POST" }).catch(() => {});
        return { success: true, company: json.company };
      }
      return { success: false, error: json.error || "Failed to create company" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, [refresh]);

  return (
    <CompanyContext.Provider value={{ companies, currentCompany, setCurrentCompany, loading, refresh, createCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be within CompanyProvider");
  return ctx;
}
