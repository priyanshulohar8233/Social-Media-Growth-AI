import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { buildWarRoom } from "@/lib/competitors/warroom";
import { auditLog, getClientIp } from "@/lib/audit";

/**
 * Minimal MCP-style tool endpoint so external agents (Claude/ChatGPT/opencode)
 * can act on a workspace with the user's own credentials.
 * Every tool enforces membership + audit. publishPost only queues a scheduled
 * draft — live dispatch stays behind platform OAuth and is never faked.
 */

const TOOLS = [
  { name: "createContent", description: "Create a content draft (title, platform, optional body).", args: ["companyId", "title", "platform"] },
  { name: "getAnalytics", description: "14-day totals: views, engagement, followers, reach.", args: ["companyId"] },
  { name: "warRoomReport", description: "Full competitor war-room report with threat scores.", args: ["companyId"] },
  { name: "publishPost", description: "Queue a post for publishing (scheduled draft; live dispatch needs platform OAuth).", args: ["companyId"] },
];

export async function GET() {
  return NextResponse.json({ tools: TOOLS });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { tool, args } = (body || {}) as { tool?: string; args?: Record<string, unknown> };
  const companyId = typeof args?.companyId === "string" ? args.companyId : "";
  if (!tool || !companyId) return NextResponse.json({ error: "tool and args.companyId required" }, { status: 400 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  try {
    switch (tool) {
      case "createContent": {
        const title = typeof args?.title === "string" ? args.title.trim() : "";
        const platform = typeof args?.platform === "string" ? args.platform : "instagram";
        if (!title) return NextResponse.json({ error: "args.title required" }, { status: 400 });
        const content = await prisma.content.create({
          data: {
            companyId,
            title,
            body: typeof args?.body === "string" ? args.body : null,
            platform,
            contentType: typeof args?.contentType === "string" ? args.contentType : "POST",
            status: "DRAFT",
          },
        });
        await auditLog({ companyId, userId: auth.userId, action: "mcp.createContent", entity: "Content", entityId: content.id, ip: getClientIp(request) });
        return NextResponse.json({ success: true, data: content }, { status: 201 });
      }
      case "getAnalytics": {
        const since = new Date(Date.now() - 14 * 864e5);
        const events = await prisma.analyticsEvent.findMany({
          where: { companyId, createdAt: { gte: since } },
          select: { eventType: true, value: true },
          take: 2000,
        });
        const totals = { views: 0, engagement: 0, followers: 0, reach: 0 };
        for (const e of events) {
          const v = e.value ?? 1;
          if (e.eventType === "view") totals.views += v;
          else if (["like", "comment", "share"].includes(e.eventType)) totals.engagement += v;
        }
        const reachRows = await prisma.performanceMetric.aggregate({
          where: { companyId, metric: "reach", createdAt: { gte: since } },
          _sum: { value: true },
        });
        totals.reach = reachRows._sum.value ?? 0;
        const followRows = await prisma.performanceMetric.aggregate({
          where: { companyId, metric: "followers", createdAt: { gte: since } },
          _sum: { value: true },
        });
        totals.followers = followRows._sum.value ?? 0;
        return NextResponse.json({ success: true, data: { totals, windowDays: 14 } });
      }
      case "warRoomReport": {
        const report = await buildWarRoom({ companyId, userId: auth.userId });
        return NextResponse.json({ success: true, data: report });
      }
      case "publishPost": {
        const contentId = typeof args?.contentId === "string" ? args.contentId : null;
        let content = contentId
          ? await prisma.content.findFirst({ where: { id: contentId, companyId } })
          : null;
        if (!content) {
          const title = typeof args?.title === "string" && args.title.trim() ? args.title.trim() : "MCP scheduled post";
          const platform = typeof args?.platform === "string" ? args.platform : "instagram";
          content = await prisma.content.create({
            data: { companyId, title, platform, contentType: "POST", status: "DRAFT" },
          });
        }
        const post = await prisma.socialPost.create({
          data: {
            companyId,
            accountId: null,
            platform: content.platform,
            contentId: content.id,
            caption: content.body || content.title,
            status: "scheduled",
          },
        });
        await auditLog({ companyId, userId: auth.userId, action: "mcp.publishPost", entity: "SocialPost", entityId: post.id, ip: getClientIp(request) });
        return NextResponse.json(
          {
            success: true,
            data: {
              post,
              scheduled: true,
              live: false,
              note: "Queued as a scheduled draft. Live dispatch requires platform OAuth credentials, which are not configured — nothing was posted.",
            },
          },
          { status: 201 }
        );
      }
      default:
        return NextResponse.json({ error: `unknown tool: ${tool}`, tools: TOOLS.map((t) => t.name) }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "tool execution failed" }, { status: 500 });
  }
}
