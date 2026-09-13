"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Brain,
  Calendar,
  Sparkles,
  Inbox,
  BarChart2,
  Swords,
  TrendingUp,
  DollarSign,
  Bot,
  FolderOpen,
  CheckSquare,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
}

interface UsageStats {
  usage: { totalCalls: number; totalTokens: number; cost: number };
  content: { total: number };
  pendingApprovals: number;
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Company Brain", href: "/dashboard/brain", icon: Brain },
  { name: "Content", href: "/dashboard/content", icon: Calendar },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "AI Studio", href: "/dashboard/ai", icon: Sparkles },
  { name: "Social Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart2 },
  { name: "Audience", href: "/dashboard/audience", icon: BarChart2 },
  { name: "Competitor War Room", href: "/dashboard/competitors", icon: Swords },
  { name: "Growth Intelligence", href: "/dashboard/growth", icon: TrendingUp },
  { name: "Leads & ROI", href: "/dashboard/leads", icon: DollarSign },
  { name: "AI Agents", href: "/dashboard/agents", icon: Bot },
  { name: "Media Library", href: "/dashboard/media", icon: FolderOpen },
  { name: "Approvals", href: "/dashboard/approvals", icon: CheckSquare, badgeKey: "pendingApprovals" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { currentCompany, companies } = useCompany();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [stats, setStats] = React.useState<UsageStats | null>(null);

  React.useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    document.addEventListener("sidebar-toggle", handleToggle);
    return () => document.removeEventListener("sidebar-toggle", handleToggle);
  }, []);

  React.useEffect(() => {
    if (!currentCompany?.id) return;
    let active = true;
    apiFetch(`/api/companies/${currentCompany.id}/usage`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setStats(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentCompany?.id]);

  const handleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapse?.(next);
  };

  const role = currentCompany?.role || "Viewer";
  const planLabel = currentCompany ? `${companies.length} workspace${companies.length === 1 ? "" : "s"} · ${role}` : "No workspace";

  const sidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-sidebar text-ink border-r border-line-2">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-line-2">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-brand-600 text-white shadow-md shadow-accent/20">
            <Brain className="h-5 w-5" />
          </div>
          {(!collapsed || isMobile) && (
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-base text-ink tracking-tight">BrainGrow</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-accent-soft text-accent">AI</span>
              </div>
              <p className="text-[10px] text-ink-3 -mt-0.5">Business Growth OS</p>
            </div>
          )}
        </Link>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Workspace Switcher */}
      {(!collapsed || isMobile) && (
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3 px-2 mb-2">Workspace</p>
          <Link
            href="/dashboard/settings"
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface border border-line hover:border-accent/50 transition-colors group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-brand-600 text-white text-xs font-bold shrink-0 shadow-sm">
                {(currentCompany?.name || "W").charAt(0).toUpperCase()}
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold text-ink truncate group-hover:text-accent">
                  {currentCompany?.name || "No workspace"}
                </p>
                <p className="text-[10px] text-ink-3 truncate">{planLabel}</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-ink-3 shrink-0 group-hover:text-ink transition-transform" />
          </Link>
        </div>
      )}

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const badge = item.badgeKey ? stats?.pendingApprovals ?? 0 : 0;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed && !isMobile ? item.name : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                collapsed && !isMobile && "justify-center px-0 py-2.5",
                isActive
                  ? "bg-accent text-white font-semibold shadow-lg shadow-accent/25"
                  : "text-ink-2 hover:bg-sunken hover:text-ink"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-ink-3 group-hover:text-ink-2")} />
              {(!collapsed || isMobile) && (
                <>
                  <span className="flex-1 truncate">{item.name}</span>
                  {badge > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 text-[10px] font-bold rounded-full",
                      isActive ? "bg-white/20 text-white" : "bg-accent-soft text-accent"
                    )}>
                      {badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle (desktop) */}
      <div className="px-3 pb-1 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCollapse}
          className={cn("w-full justify-center text-ink-3 hover:text-ink", collapsed && "hidden")}
          title={collapsed ? "Expand" : "Collapse"}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
        {collapsed && (
          <Button variant="ghost" size="icon" onClick={handleCollapse} className="mx-auto block h-8 w-8 text-ink-3 hover:text-ink" aria-label="Expand sidebar">
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Bottom Real-Usage Card */}
      {(!collapsed || isMobile) && (
        <div className="p-3 border-t border-line-2 bg-sidebar">
          <div className="rounded-xl bg-surface border border-line p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Workspace Usage</span>
              <Zap className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-ink-3">Content posts</span>
                <span className="font-semibold text-ink">{stats?.content.total ?? "—"}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-ink-3">AI calls</span>
                <span className="font-semibold text-ink">{stats?.usage.totalCalls ?? "—"}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-ink-3">Tokens</span>
                <span className="font-semibold text-ink">{stats ? (stats.usage.totalTokens / 1000).toFixed(1) + "k" : "—"}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-ink-3">AI spend</span>
                <span className="font-semibold text-ink">
                  {stats ? `$${stats.usage.cost.toFixed(2)}` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-overlay"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute left-0 top-0 h-full w-[260px] shadow-2xl"
            >
              {sidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col transition-all duration-300 lg:flex shadow-xl"
        )}
        style={{ width: collapsed ? "72px" : "250px" }}
      >
        {sidebarContent(false)}
      </aside>
    </>
  );
}