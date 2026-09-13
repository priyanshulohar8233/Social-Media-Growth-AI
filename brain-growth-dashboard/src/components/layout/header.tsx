"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Bell, Settings, LogOut, HelpCircle, LayoutDashboard, BarChart3, Calendar, Users, TrendingUp, Sparkles, Search, Command, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { apiFetch } from "@/lib/api-client";

const commandItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Content", href: "/dashboard/content", icon: Calendar },
  { name: "Audience", href: "/dashboard/audience", icon: Users },
  { name: "Growth", href: "/dashboard/growth", icon: TrendingUp },
  { name: "AI Studio", href: "/dashboard/ai", icon: Sparkles },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "Help", href: "/dashboard/help", icon: HelpCircle },
];

interface Notification {
  id: string;
  title: string;
  platform: string | null;
  type: "approval" | "job_failed";
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentCompany } = useCompany();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const pageTitle = React.useMemo(() => {
    const match = commandItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    return match?.name || "Overview";
  }, [pathname]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCommandOpen(true); }
      if (e.key === "Escape") { setCommandOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!currentCompany?.id) return;
    let active = true;
    apiFetch(`/api/companies/${currentCompany.id}/usage`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const items: Notification[] = (data.latestPending || []).map((a: { id: string; title: string; platform: string | null }) => ({
          id: a.id,
          title: `Approval pending: ${a.title}`,
          platform: a.platform,
          type: "approval",
        }));
        setNotifications(items);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentCompany?.id]);

  const role = currentCompany?.role || "Member";

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-header backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => document.dispatchEvent(new CustomEvent("sidebar-toggle"))} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="hidden text-sm font-semibold text-ink sm:block">{pageTitle}</h2>
        </div>

        {/* Search */}
        <div className="flex-1 flex items-center max-w-md">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs text-ink-3 transition-colors hover:border-accent/50"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-3" />
            <span className="truncate">Search anything... (Cmd + K)</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {/* Notifications — real pending approvals */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink-3 hover:text-ink transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] font-bold text-white shadow-sm">
                  {notifications.length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl z-50"
                >
                  <div className="border-b border-line px-4 py-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">Notifications</p>
                    {notifications.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-500/15 text-danger-500">{notifications.length} pending</span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2 space-y-1.5 text-xs">
                    {notifications.length === 0 && (
                      <p className="px-3 py-6 text-center text-ink-3">All caught up — no pending approvals.</p>
                    )}
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => { setNotificationsOpen(false); router.push("/dashboard/approvals"); }}
                        className="w-full text-left rounded-lg bg-sunken p-2.5 border border-line hover:border-accent/50 transition-colors"
                      >
                        <p className="font-semibold text-ink">{n.title}</p>
                        {n.platform && <p className="text-[11px] text-ink-3 capitalize">{n.platform}</p>}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Help Icon */}
          <button
            onClick={() => router.push("/dashboard/help")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink-3 hover:text-ink transition-colors"
            title="Help & Support"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* User Profile Pill */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-xl border border-line bg-surface pl-1.5 pr-3 py-1 hover:border-accent/50 transition-colors group text-left">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-accent to-brand-600 text-white font-bold text-xs shadow-sm">
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-xs font-bold text-ink group-hover:text-accent transition-colors">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] text-ink-3 capitalize">{role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl border border-line bg-surface text-ink shadow-2xl p-1.5" align="end" forceMount>
              <div className="px-3 py-2 border-b border-line">
                <p className="text-xs font-bold text-ink">{user?.name || "User"}</p>
                <p className="text-[11px] text-ink-3">{user?.email || ""}</p>
              </div>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="rounded-lg text-xs py-2 hover:bg-sunken cursor-pointer">
                <Settings className="mr-2 h-3.5 w-3.5 text-ink-3" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/help")} className="rounded-lg text-xs py-2 hover:bg-sunken cursor-pointer">
                <HelpCircle className="mr-2 h-3.5 w-3.5 text-ink-3" />
                <span>Help & Docs</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-line" />
              <DropdownMenuItem className="rounded-lg text-xs py-2 text-danger-500 hover:bg-danger-500/10 cursor-pointer" onClick={logout}>
                <LogOut className="mr-2 h-3.5 w-3.5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Command palette */}
      <AnimatePresence>
        {commandOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-overlay" onClick={() => setCommandOpen(false)} />
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md px-4"
              >
                <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-pop)]">
                  <div className="flex items-center border-b border-line px-3.5">
                    <Search className="mr-2.5 h-4 w-4 shrink-0 text-ink-3" />
                    <input
                      placeholder="Type to search…"
                      className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Escape") setCommandOpen(false); }}
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    <p className="px-2 py-1.5 text-[11px] font-medium text-ink-3">Navigate</p>
                    {commandItems.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => { router.push(item.href); setCommandOpen(false); }}
                        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-ink transition-colors hover:bg-sunken"
                      >
                        <item.icon className="h-4 w-4 text-ink-3" />
                        <span className="flex-1 text-left">{item.name}</span>
                        <Command className="hidden h-3 w-3 text-ink-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}