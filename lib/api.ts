const API_URL =
  import.meta.env.VITE_API_URL || "https://duckline-api.vercel.app";

const TOKEN_KEY = "duckline_token";
const USER_KEY = "duckline_user";

let authToken: string | null = localStorage.getItem(TOKEN_KEY);

function authHeaders(): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function opts(): RequestInit {
  return { credentials: "include", headers: authHeaders() };
}

/* ── Token persistence ── */

export function setAuth(token: string, user: User): void {
  authToken = token;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  authToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function syncAuthFromStorage(): void {
  authToken = localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  return !!authToken;
}

/* ── Types ── */

export interface User {
  id: string;
  name: string;
  image: string;
  plan?: string;
}

export interface TimelineSummary {
  id: string;
  title: string;
  updatedAt: number;
}

/* ── Session ── */

export async function fetchSession(): Promise<{ user: User } | null> {
  try {
    const res = await fetch(`${API_URL}/api/me`, opts());
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ? { user: data.user } : null;
  } catch {
    return null;
  }
}

/* ── Auth code exchange (one-time code → JWT + user) ── */

export async function exchangeAuthCode(
  code: string
): Promise<{ user: User; token: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.token && data.user) {
      setAuth(data.token, data.user);
    }
    return data;
  } catch {
    return null;
  }
}

/* ── Timeline CRUD ── */

export async function fetchTimelines(): Promise<{
  timelines: TimelineSummary[];
}> {
  const res = await fetch(`${API_URL}/api/timelines`, opts());
  if (!res.ok) throw new Error("Failed to fetch timelines");
  return res.json();
}

export async function createTimeline(
  title: string,
  items: unknown[]
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/api/timelines`, {
    ...opts(),
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title, items }),
  });
  if (!res.ok) throw new Error("Failed to create timeline");
  return res.json();
}

export async function getTimeline(
  id: string
): Promise<{ id: string; title: string; items: unknown[]; updatedAt: number }> {
  const res = await fetch(`${API_URL}/api/timelines/${id}`, opts());
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function updateTimeline(
  id: string,
  title: string,
  items: unknown[]
): Promise<{ ok: true }> {
  const res = await fetch(`${API_URL}/api/timelines/${id}`, {
    ...opts(),
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ title, items }),
  });
  if (!res.ok) throw new Error("Failed to update timeline");
  return res.json();
}

export async function deleteTimeline(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_URL}/api/timelines/${id}`, {
    ...opts(),
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete timeline");
  return res.json();
}

/* ── Sign-in URL ── */

export function getSignInUrl(): string {
  const frontendUrl = window.location.origin;
  const callbackUrl = `${API_URL}/api/auth/complete?frontendUrl=${encodeURIComponent(frontendUrl)}`;
  return `${API_URL}/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/* ── Sign-out ── */

export async function signOut(): Promise<void> {
  clearAuth();
  // Best-effort cookie sign-out (may fail cross-origin, that's OK)
  try {
    const csrfRes = await fetch(`${API_URL}/api/auth/csrf`, {
      credentials: "include",
    });
    const { csrfToken } = await csrfRes.json();
    await fetch(`${API_URL}/api/auth/signout`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `csrfToken=${csrfToken}`,
    });
  } catch {
    // Token already cleared, cookie sign-out is optional
  }
}
