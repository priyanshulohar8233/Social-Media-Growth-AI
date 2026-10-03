import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";
import { runGeoSweep, geoShareOfVoice, GEO_PROMPT_SETS } from "@/lib/geo/tracker";
import { auditLog, getClientIp } from "@/lib/audit";

/** Recent GEO rows + current share-of-voice coverage. */
export async function GET(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const [rows, coverage] = await Promise.all([
    prisma.geoVisibility.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 30 }),
    geoShareOfVoice(companyId),
  ]);
  return NextResponse.json({ rows, coverage, promptSets: GEO_PROMPT_SETS });
}

/** Run a fresh GEO sweep (3 prompt sets through the gateway, rows attributed). */
export async function POST(request: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await assertMembership(auth.userId, companyId);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const result = await runGeoSweep({ companyId, userId: auth.userId });
  await auditLog({
    companyId,
    userId: auth.userId,
    action: "geo.sweep",
    entity: "GeoVisibility",
    meta: { rows: result.rows, mentioned: result.mentioned, provider: result.provider },
    ip: getClientIp(request),
  });
  const coverage = await geoShareOfVoice(companyId);
  return NextResponse.json({ success: true, data: { ...result, coverage } }, { status: 201 });
}
