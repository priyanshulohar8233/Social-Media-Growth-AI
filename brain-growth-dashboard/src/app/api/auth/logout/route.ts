import { NextResponse } from "next/server";
import { auditLog, getClientIp } from "@/lib/audit";
import { requireAuth } from "@/lib/auth-server";

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth) {
    await auditLog({ userId: auth.userId, action: "auth.logout", entity: "User", entityId: auth.userId, ip: getClientIp(request) });
  }
  const res = NextResponse.json({ success: true, message: "Logged out" });
  res.cookies.set("token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
