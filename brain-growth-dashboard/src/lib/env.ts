/**
 * Environment variable access helpers.
 *
 * Production env values can arrive with stray control characters (CR/LF from
 * copy-pasted secrets, or a value that was uploaded with a trailing newline).
 * Node keeps those characters verbatim, so a base URL becomes
 * "https://host/v1\r\n" — `.replace(/\/$/, "")` does not clean it and the
 * request URL turns invalid, which silently downgraded real LLM calls to the
 * mock adapter and mangled verification/OAuth links.
 *
 * Every server-side read of an env value goes through `envStr` so those
 * characters can never leak into URLs, headers or tokens.
 */

/** Control characters that must never survive inside an env value. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Read an env var as a clean string: surrounding whitespace/quotes removed and
 * control characters (CR, LF, NUL, …) stripped. Returns "" when unset.
 */
export function envStr(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== "string") return "";
  // Order matters: strip control characters, then whitespace, then a wrapping
  // quote pair (a quoted value can itself be padded), then whitespace again.
  return raw
    .replace(CONTROL_CHARS, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/** True when the env var holds a non-empty, usable value. */
export function envHas(name: string): boolean {
  return envStr(name).length > 0;
}

/**
 * Absolute base URL for links and OAuth redirects.
 *
 * Prefers NEXT_PUBLIC_APP_URL (stable across deployments) and only falls back
 * to the request origin when it is unset or not a valid http(s) URL — so a
 * malformed env value can never poison redirect URIs.
 */
export function appBaseUrl(requestOrigin?: string): string {
  const configured = envStr("NEXT_PUBLIC_APP_URL");
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin + parsed.pathname.replace(/\/$/, "");
      }
    } catch {
      // fall through to request origin
    }
  }
  return requestOrigin || "http://localhost:3000";
}

/** Strip trailing slashes from a URL-ish string. */
export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
