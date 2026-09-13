"use client";

import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    const handleToggle = () => setSidebarCollapsed((prev) => !prev);
    document.addEventListener("sidebar-collapse", handleToggle);
    return () => document.removeEventListener("sidebar-collapse", handleToggle);
  }, []);

  const sidebarWidth = isDesktop ? (sidebarCollapsed ? 72 : 264) : 0;

  return (
    <div className="min-h-screen bg-app">
      <Sidebar onCollapse={setSidebarCollapsed} />
      <div
        className="flex min-h-screen flex-col transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <Header />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}