import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth-server";
import { registerSchema } from "@/lib/validators";
import { auditLog, getClientIp } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email, password } = parsed.data;
    const lowerEmail = email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: lowerEmail, name, passwordHash },
    });

    const token = await signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
    res.cookies.set("token", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    await auditLog({ userId: user.id, action: "auth.register", entity: "User", entityId: user.id, ip: getClientIp(request) });
    return res;
  } catch (e) {
    console.error("[auth/register]", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
