import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { generateSecureToken } from "@/lib/crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const normPlatform = platform.toLowerCase();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const callbackUrl = `${baseUrl}/api/social/callback/${normPlatform}`;
  const state = generateSecureToken(16);

  let authUrl = "";

  switch (normPlatform) {
    case "instagram": {
      const clientId = process.env.INSTAGRAM_CLIENT_ID;
      if (!clientId) {
        // Safe dev fallback simulation URL
        authUrl = `${callbackUrl}?code=dev_insta_code&state=${state}`;
      } else {
        const scopes = encodeURIComponent("user_profile,user_media");
        authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scopes}&response_type=code&state=${state}`;
      }
      break;
    }
    case "facebook": {
      const clientId = process.env.FACEBOOK_CLIENT_ID;
      if (!clientId) {
        authUrl = `${callbackUrl}?code=dev_fb_code&state=${state}`;
      } else {
        const scopes = encodeURIComponent("pages_show_list,pages_read_engagement");
        authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scopes}&state=${state}`;
      }
      break;
    }
    case "linkedin": {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      if (!clientId) {
        authUrl = `${callbackUrl}?code=dev_li_code&state=${state}`;
      } else {
        const scopes = encodeURIComponent("openid profile email w_member_social");
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=${scopes}`;
      }
      break;
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        authUrl = `${callbackUrl}?code=dev_yt_code&state=${state}`;
      } else {
        const scopes = encodeURIComponent("https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload");
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${scopes}&access_type=offline&state=${state}`;
      }
      break;
    }
    case "twitter": {
      const clientId = process.env.TWITTER_CLIENT_ID;
      if (!clientId) {
        authUrl = `${callbackUrl}?code=dev_x_code&state=${state}`;
      } else {
        const scopes = encodeURIComponent("tweet.read tweet.write users.read offline.access");
        authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scopes}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
      }
      break;
    }
    case "tiktok": {
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      if (!clientKey) {
        authUrl = `${callbackUrl}?code=dev_tt_code&state=${state}`;
      } else {
        const scopes = encodeURIComponent("user.info.basic,video.list");
        authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}`;
      }
      break;
    }
    default:
      return NextResponse.json(
        { success: false, error: { code: "UNSUPPORTED_PLATFORM", message: `Platform ${platform} is not supported.` } },
        { status: 400 }
      );
  }

  const res = NextResponse.json({
    success: true,
    data: { authUrl },
  });

  // Set CSRF state cookie
  res.cookies.set(`oauth_state_${normPlatform}`, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return res;
}
