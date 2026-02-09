// src/utils/auth.ts

export type ActiveRole = {
  roleId: number;
  roleName: string;
  homePage: string;
};

export type Profile = {
  email: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  activeRole: ActiveRole;
  availableRoles: ActiveRole[];
};

/* ---------- STORAGE HELPERS ---------- */

export const getProfile = (): Profile | null => {
  try {
    const data = localStorage.getItem("profile");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const setProfile = (profile: Profile) => {
  localStorage.setItem("profile", JSON.stringify(profile));
};

export const getToken = (): string | null => {
  return sessionStorage.getItem("token");
};

export const setToken = (token: string) => {
  sessionStorage.setItem("token", token);
};

export const clearAuth = () => {
  localStorage.removeItem("profile");
  localStorage.removeItem("permissions");
  localStorage.removeItem("userProfile");
  sessionStorage.removeItem("token");
};

/* ---------- LEGACY USER PROFILE (LOGIN RESPONSE) ---------- */

export const getUserProfile = (): any | null => {
  try {
    const data = localStorage.getItem("userProfile");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const setUserProfile = (profile: any) => {
  localStorage.setItem("userProfile", JSON.stringify(profile));
};

export const getActiveRoleFromProfile = (): any | null => {
  const profile = getUserProfile();
  return profile?.activeRole || profile?.roles?.[0] || null;
};

export const updateActiveRoleInProfile = (role: any) => {
  const profile = getUserProfile();
  if (!profile) return;
  profile.activeRole = role;
  setUserProfile(profile);
};

/* ---------- ROLE HELPERS ---------- */

export const getActiveRole = (): ActiveRole | null => {
  return getProfile()?.activeRole || null;
};

export const getActiveRoleId = (): number | null => {
  return getProfile()?.activeRole?.roleId ?? null;
};

export const hasRole = (allowedRoles: number[]): boolean => {
  const roleId = getActiveRoleId();
  return roleId !== null && allowedRoles.includes(roleId);
};

/* ---------- PERMISSION HELPERS ---------- */

export const setPermissions = (permissions: string[]) => {
  localStorage.setItem("permissions", JSON.stringify(permissions || []));
};

export const getPermissions = (): string[] => {
  try {
    const data = localStorage.getItem("permissions");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const hasPermission = (code: string): boolean => {
  const permissions = getPermissions();
  if (permissions.includes("*")) return true;
  return permissions.includes(code);
};

export const hasAnyPermission = (codes: string[]): boolean => {
  if (!codes || codes.length === 0) return true;
  return codes.some((code) => hasPermission(code));
};

export const getActiveRoleIdFromProfile = (): string | null => {
  const active = getActiveRoleFromProfile();
  return active?._id || null;
};
