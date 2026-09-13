export interface KPI {
  key: string;
  title: string;
  subtitle: string;
  value: string;
  raw: number;
  change: number;
  icon: string;
  spark: number[];
}

export interface PerformanceRow {
  date: string;
  instagram: number;
  youtube: number;
  linkedin: number;
  facebook: number;
  twitter: number;
  tiktok: number;
}

export interface PlatformSlice {
  platform: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
  engagementRate: number;
}

export interface TopContentItem {
  id: string;
  title: string;
  type: string;
  date: string;
  platform: string;
  platformColor: string;
  reach: string;
  engagement: string;
  engRate: number;
  body: string;
}

export interface ActivityItem {
  id: string;
  platform: string;
  color: string;
  label: string;
  title: string;
  subtitle: string;
  time: string;
}

export interface CalendarDay {
  day: string;
  date: number;
  isToday: boolean;
  posts: Array<{ platform: string; color: string; label: string }>;
  count: number;
}

export interface Recommendation {
  id: string;
  icon: string;
  iconBg: string;
  badge: string;
  description: string;
  action: string;
}

export interface DashboardData {
  company: { id: string; name: string; industry?: string | null; profileType?: string } | null;
  kpis: KPI[];
  engagementRate: number;
  performance: PerformanceRow[];
  platforms: PlatformSlice[];
  topContent: TopContentItem[];
  recentActivity: ActivityItem[];
  calendar: { days: CalendarDay[]; counts: { scheduled: number; draft: number } };
  recommendations: Recommendation[];
  audience: { total: number; change: number; age: Array<{ name: string; value: number }> };
  generatedAt: string;
}

export const ICON_BY_KEY: Record<string, string> = {
  globe: "globe",
  heart: "heart",
  users: "users",
  mouse: "mouse",
  target: "target",
  rupee: "rupee",
  camera: "camera",
  clock: "clock",
  chart: "chart",
  message: "message",
  gift: "gift",
};