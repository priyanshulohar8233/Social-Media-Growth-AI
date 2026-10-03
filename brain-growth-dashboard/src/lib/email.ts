/**
 * Email delivery service with production provider support and local development fallback.
 * Sends professional verification emails.
 *
 * Delivery is reported honestly: when no provider is configured the caller gets
 * `delivered: false` and a `devLink`, so the API/UI can say "email not
 * configured" instead of falsely claiming a message was sent.
 */
import { envStr } from "@/lib/env";

export interface SendVerificationEmailResult {
  success: boolean;
  /** True only when a real provider accepted the message. */
  delivered: boolean;
  /** Which transport actually handled it: "resend" | "log". */
  transport: "resend" | "log";
  messageId?: string;
  devLink?: string;
}

interface SendVerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
  expiresInHours?: number;
}

export async function sendVerificationEmail({
  to,
  name,
  verificationUrl,
  expiresInHours = 24,
}: SendVerificationEmailParams): Promise<SendVerificationEmailResult> {
  const appName = "BrainGrow";
  const fromEmail = envStr("EMAIL_FROM") || "noreply@braingrow.ai";
  const subject = `Verify your email for ${appName}`;

  const textContent = `Welcome to ${appName}

Hi ${name},

Thanks for creating your account.

Please verify your email address to continue setting up your account by opening this link:
${verificationUrl}

This verification link will expire in ${expiresInHours} hours.

If you did not create this account, you can safely ignore this email.
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d12; color: #f3f4f6; margin: 0; padding: 24px; }
    .container { max-width: 540px; margin: 0 auto; background-color: #161821; border-radius: 12px; border: 1px solid #232738; padding: 36px 32px; }
    .brand { font-size: 20px; font-weight: 700; color: #ffffff; display: flex; align-items: center; margin-bottom: 24px; letter-spacing: -0.5px; }
    .brand span { color: #818cf8; margin-left: 4px; }
    h1 { font-size: 22px; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #9ca3af; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #6366f1; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; margin: 12px 0 24px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); }
    .footer { font-size: 13px; color: #6b7280; border-top: 1px solid #232738; padding-top: 20px; margin-top: 28px; }
    .url { word-break: break-all; color: #818cf8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">BrainGrow<span>AI</span></div>
    <h1>Welcome to BrainGrow</h1>
    <p>Hi ${name},</p>
    <p>Thanks for creating your account. Please verify your email address to continue setting up your account.</p>
    <div>
      <a href="${verificationUrl}" class="btn">Verify My Email</a>
    </div>
    <p>Or paste this link into your browser:<br/><span class="url">${verificationUrl}</span></p>
    <div class="footer">
      <p>This verification link will expire in ${expiresInHours} hours. If you did not create this account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

  // 1. Resend API integration if configured
  const resendKey = envStr("RESEND_API_KEY");
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, delivered: true, transport: "resend", messageId: data.id };
      }
      console.warn("[email] Resend API responded with error, falling back to log:", await res.text());
    } catch (e) {
      console.error("[email] Resend delivery error:", e);
    }
  }

  // 2. Local / Development fallback — structured console logger.
  // NOT a delivery: the caller must surface this as unconfigured, not as "sent".
  console.log("=================================================");
  console.log(`[EMAIL DISPATCH] To: ${to} | Subject: ${subject}`);
  console.log(`[VERIFICATION LINK]: ${verificationUrl}`);
  console.log("=================================================");

  return {
    success: true,
    delivered: false,
    transport: "log",
    messageId: `dev-${Date.now()}`,
    devLink: verificationUrl,
  };
}
