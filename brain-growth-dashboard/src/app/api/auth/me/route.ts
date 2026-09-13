import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, signToken } from "@/lib/auth-server";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, image: true },
  });
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { company: { select: { id: true, name: true, slug: true } } },
  });

  const token = await signToken({ userId: user.id, email: user.email });

  const res = NextResponse.json({
    authenticated: true,
    user,
    token,
    memberships: memberships.map((m) => ({ company: m.company, role: m.role })),
  });
  res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, image } = body as { name?: string; image?: string };

  const update: Record<string, string> = {};
  if (typeof name === "string" && name.trim()) update.name = name.trim();
  if (typeof image === "string" && image.trim()) update.image = image.trim();
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: update,
    select: { id: true, email: true, name: true, image: true },
  });
  return NextResponse.json({ user });
}
