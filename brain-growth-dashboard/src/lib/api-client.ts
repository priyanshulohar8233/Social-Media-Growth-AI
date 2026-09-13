"use client";

const TOKEN_KEY = "braingrow-token";
const USER_KEY = "braingrow-user";
const COMPANY_KEY = "braingrow-company";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(COMPANY_KEY);
}

// Password-based auth routes authenticate with their own credentials and must
// not send the stored token — and must never trigger the Bearer 401 retry.
const CREDENTIAL_ROUTES = ["/api/auth/login", "/api/auth/register"];

function isCredentialRoute(url: string) {
  return CREDENTIAL_ROUTES.some((route) => url.startsWith(route));
}

/**
 * Single frontend entry point for all authed API calls.
 * - Attaches `Authorization: Bearer <stored token>` from one place.
 * - Always sends `credentials: "include"` so the httpOnly session cookie travels too.
 * - If a stored Bearer token is rejected (401), the token is stale/invalid:
 *   clear it and retry ONCE without it — the httpOnly cookie may still be valid.
 *   Never fake success and never loop.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const credentialRoute = isCredentialRoute(url);

  const headers = new Headers(init.headers ?? {});
  if (token && !credentialRoute) headers.set("Authorization", `Bearer ${token}`);

  const fetchInit: RequestInit = {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  };

  const res = await fetch(url, fetchInit);

  if (res.status === 401 && token && !credentialRoute) {
    // The stored token failed server-side; it is stale or signed with an older
    // secret. Remove it so it stops masking every request, then retry once with
    // the cookie-only session.
    clearStoredToken();
    const retryHeaders = new Headers(fetchInit.headers as Headers);
    retryHeaders.delete("Authorization");
    const retry = await fetch(url, { ...fetchInit, headers: retryHeaders });
    if (retry.status === 401) clearStoredAuth();
    return retry;
  }

  return res;
}