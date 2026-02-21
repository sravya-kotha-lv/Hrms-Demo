export const TOKEN_KEY = "auth_token";
export const PERM_KEY = "auth_permissions";

/**
 * Store token. Accepts either "Bearer <token>" or "<token>".
 */
export function setToken(header: string | null) {
  if (!header) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  const token = header.replace(/^Bearer\s+/i, "");
  localStorage.setItem(TOKEN_KEY, token);
}

/** Return stored token (no "Bearer " prefix) or null */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Clear stored auth data */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PERM_KEY);
}

/** Set permissions array for current user */
export function setPermissions(perms: string[] | null) {
  if (!perms) {
    localStorage.removeItem(PERM_KEY);
    return;
  }
  localStorage.setItem(PERM_KEY, JSON.stringify(perms));
}

/** Get permissions array */
export function getPermissions(): string[] {
  try {
    const raw = localStorage.getItem(PERM_KEY) || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Return true if user has any of the required permissions */
export function hasAnyPermission(required: string[] = []): boolean {
  if (!required || required.length === 0) return true;
  const perms = getPermissions();
  return required.some((p) => perms.includes(p));
}