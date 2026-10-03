import { NextResponse } from "next/server";
import { appBaseUrl, envStr } from "@/lib/env";

export async function GET(request: Request) {
  const clientId = envStr("GOOGLE_CLIENT_ID");
  const baseUrl = appBaseUrl(new URL(request.url).origin);
  const redirectUri = envStr("GOOGLE_REDIRECT_URI") || `${baseUrl}/api/auth/callback/google`;

  // Dev fallback: if no real credentials, use mock Google user (so button still works without setup)
  if (!clientId) {
    // Mock behavior — redirect with flag so frontend can fallback to mock loginWithProvider
    return NextResponse.redirect(new URL("/?google_mock=1", baseUrl));
  }

  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  // Store state in cookie for verification
  res.cookies.set("google_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
