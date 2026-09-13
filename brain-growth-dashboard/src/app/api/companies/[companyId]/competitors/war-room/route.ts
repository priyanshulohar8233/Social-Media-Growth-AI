import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { buildWarRoom } from "@/lib/competitors/warroom";
import { auditLog, getClientIp } from "@/lib/audit";

export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await assertMembership(auth.userId, companyId); } catch (e: unknown) { const err = e as { status?: number; message?: string }; return NextResponse.json({ error: err.message }, { status: err.status || 403 }); }

  const report = await buildWarRoom({ companyId, userId: auth.userId });

  await auditLog({
    companyId,
    userId: auth.userId,
    action: "war-room.view",
    entity: "Competitor",
    meta: { total: report.totalCompetitors, avgThreat: report.avgThreat },
    ip: getClientIp(request),
  });

  return NextResponse.json(report);
}