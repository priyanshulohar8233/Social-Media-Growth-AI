import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-server";
import { assertMembership } from "@/lib/tenant";

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

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || `${new Date().getMonth() + 1}`);
  const year = parseInt(searchParams.get("year") || `${new Date().getFullYear()}`);

  let calendar = await prisma.contentCalendar.findUnique({
    where: { companyId_month_year: { companyId, month, year } },
    include: { items: { orderBy: { date: "asc" } } },
  });

  if (!calendar) {
    // Return empty but valid structure — calendar is created on first item
    return NextResponse.json({ calendar: null, items: [] });
  }

  return NextResponse.json({ calendar, items: calendar.items });
}

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

  const body = await request.json();
  const { month, year, date, platform, title, contentId } = body as {
    month: number; year: number; date: string; platform: string; title?: string; contentId?: string;
  };
  if (!month || !year || !date || !platform) return NextResponse.json({ error: "month, year, date, platform required" }, { status: 400 });

  const calendar = await prisma.contentCalendar.upsert({
    where: { companyId_month_year: { companyId, month: Number(month), year: Number(year) } },
    update: {},
    create: { companyId, month: Number(month), year: Number(year), name: `${year}-${month}` },
  });

  const item = await prisma.calendarItem.create({
    data: {
      companyId,
      calendarId: calendar.id,
      contentId: contentId || null,
      date: new Date(date),
      platform,
      title: title || null,
      status: "DRAFT",
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
