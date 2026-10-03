import { describe, it, expect, afterEach } from "vitest";
import { envStr, envHas, appBaseUrl, trimTrailingSlash } from "@/lib/env";

const KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "FREELLMAPI_BASE_URL",
  "FREELLMAPI_API_KEY",
  "JWT_SECRET",
  "ENCRYPTION_SECRET",
  "CRON_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "WORKER_KEY",
];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("envStr — control-character hardening", () => {
  it("strips a trailing CRLF that was baked into a stored env value", () => {
    // This exact corruption shipped to production once: "https://host/v1\r\n".
    process.env.FREELLMAPI_BASE_URL = "https://freellmapi.onrender.com/v1\r\n";
    expect(envStr("FREELLMAPI_BASE_URL")).toBe("https://freellmapi.onrender.com/v1");
  });

  it("strips a trailing newline used to terminate a pasted secret", () => {
    process.env.CRON_SECRET = "s3cret\n";
    expect(envStr("CRON_SECRET")).toBe("s3cret");
  });

  it("keeps the secret value itself intact (no truncation)", () => {
    const secret = "a".repeat(64);
    process.env.JWT_SECRET = `${secret}\n`;
    expect(envStr("JWT_SECRET")).toBe(secret);
    expect(envStr("JWT_SECRET")).toHaveLength(64);
  });

  it("removes surrounding quotes and whitespace", () => {
    process.env.GOOGLE_CLIENT_ID = '  "123.apps.googleusercontent.com"  ';
    expect(envStr("GOOGLE_CLIENT_ID")).toBe("123.apps.googleusercontent.com");
  });

  it("removes interior tabs and other control whitespace", () => {
    process.env.WORKER_KEY = "wo\trk\ter";
    expect(envStr("WORKER_KEY")).toBe("worker");
  });

  it("returns empty string for unset, empty and whitespace-only values", () => {
    expect(envStr("CRON_SECRET")).toBe("");
    process.env.CRON_SECRET = "";
    expect(envStr("CRON_SECRET")).toBe("");
    process.env.CRON_SECRET = "   \n  ";
    expect(envStr("CRON_SECRET")).toBe("");
  });

  it("envHas mirrors emptiness after sanitising", () => {
    process.env.RESEND_API_KEY = "re_x\n";
    expect(envHas("RESEND_API_KEY")).toBe(true);
    process.env.RESEND_API_KEY = "\n\n";
    expect(envHas("RESEND_API_KEY")).toBe(false);
  });
});

describe("appBaseUrl — OAuth + verification links", () => {
  it("prefers the stable configured app URL over the request origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://brain-growth-dashboard.vercel.app";
    expect(appBaseUrl("https://brain-growth-dashboard-abc123-xyz.vercel.app")).toBe(
      "https://brain-growth-dashboard.vercel.app"
    );
  });

  it("still returns a clean URL when the stored value had trailing CRLF", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://brain-growth-dashboard.vercel.app\r\n";
    expect(appBaseUrl("https://per-deploy.vercel.app")).toBe(
      "https://brain-growth-dashboard.vercel.app"
    );
  });

  it("falls back to the request origin when unset", () => {
    expect(appBaseUrl("https://fallback.vercel.app")).toBe("https://fallback.vercel.app");
  });

  it("falls back to the request origin when the configured value is not a URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
    expect(appBaseUrl("https://fallback.vercel.app")).toBe("https://fallback.vercel.app");
  });

  it("rejects a non-http scheme instead of emitting an unusable redirect URI", () => {
    process.env.NEXT_PUBLIC_APP_URL = "javascript:alert(1)";
    expect(appBaseUrl("https://fallback.vercel.app")).toBe("https://fallback.vercel.app");
  });

  it("strips a trailing slash from a configured sub-path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://host.example.com/app/";
    expect(appBaseUrl("https://ignored")).toBe("https://host.example.com/app");
  });
});

describe("trimTrailingSlash", () => {
  it("removes one or many trailing slashes", () => {
    expect(trimTrailingSlash("https://a.test/v1")).toBe("https://a.test/v1");
    expect(trimTrailingSlash("https://a.test/v1/")).toBe("https://a.test/v1");
    expect(trimTrailingSlash("https://a.test/v1///")).toBe("https://a.test/v1");
  });
});
