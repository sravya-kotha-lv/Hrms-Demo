export const ORG_TIMEZONE_KEY = "org_timezone";

export function setOrgTimeZone(tz: string | null | undefined): void {
  if (!tz) return;
  try {
    localStorage.setItem(ORG_TIMEZONE_KEY, tz);
  } catch {
    // ignore storage errors in non-browser environments
  }
}

export function getOrgTimeZone(): string | null {
  try {
    return localStorage.getItem(ORG_TIMEZONE_KEY);
  } catch {
    return null;
  }
}

export function clearOrgTimeZone(): void {
  try {
    localStorage.removeItem(ORG_TIMEZONE_KEY);
  } catch {}
}
