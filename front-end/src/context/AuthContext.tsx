import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { getApiWithToken } from "@/services/apiWrapper";
import {
  getPermissions,
  getUserProfile,
  setPermissions as setPermissionsLocal,
  setUserProfile as setUserProfileLocal,
} from "@/utils/auth";

type AuthContextValue = {
  profile: any | null;
  permissions: string[];
  isSuperAdmin: boolean;
  setProfile: (profile: any | null) => void;
  setPermissions: (permissions: string[]) => void;
  refresh: () => void;
  hasAnyPermission: (codes: string[]) => boolean;
  loadProfile: () => Promise<void>;
  loadPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const readIsSuperAdmin = (profile: any | null) => {
  if (profile?.activeRole?.slug === "superadmin") return true;
  if (profile?.roles?.some((r: any) => r?.slug === "superadmin")) return true;
  return localStorage.getItem("isSuperAdmin") === "true";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfileState] = useState<any | null>(getUserProfile());
  const [permissions, setPermissionsState] = useState<string[]>(getPermissions());

  const isSuperAdmin = useMemo(() => readIsSuperAdmin(profile), [profile]);

  const setProfile = (nextProfile: any | null) => {
    if (nextProfile) {
      setUserProfileLocal(nextProfile);
    } else {
      localStorage.removeItem("userProfile");
    }
    setProfileState(nextProfile);

    if (nextProfile?.activeRole?.slug === "superadmin") {
      localStorage.setItem("isSuperAdmin", "true");
    } else {
      localStorage.removeItem("isSuperAdmin");
    }
  };

  const setPermissions = (nextPermissions: string[]) => {
    setPermissionsLocal(nextPermissions || []);
    setPermissionsState(nextPermissions || []);
  };

  const refresh = () => {
    setProfileState(getUserProfile());
    setPermissionsState(getPermissions());
  };

  const hasAnyPermission = useCallback((codes: string[]) => {
    if (!codes || codes.length === 0) return true;
    if (permissions.includes("*")) return true;
    return codes.some((code) => permissions.includes(code));
  }, [permissions]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await getApiWithToken("/users/me/profile");
      if (res?.success && res?.data) {
        const current = getUserProfile() || {};
        const merged = { ...current, ...res.data };
        setProfile(merged);
      }
    } catch {
      // no-op
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const res = await getApiWithToken("/users/me/permissions");
      if (res?.success) {
        setPermissions(res.data || []);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (token) {
      loadProfile();
      loadPermissions();
    }
  }, [loadPermissions, loadProfile]);

  const lastRoleIdRef = useRef<string | null>(null);
  const bootstrappedPermissionsRef = useRef(false);
  useEffect(() => {
    const roleId = profile?.activeRole?._id || null;
    if (!roleId) return;
    if (!bootstrappedPermissionsRef.current) {
      bootstrappedPermissionsRef.current = true;
      lastRoleIdRef.current = roleId;
      return;
    }
    if (roleId !== lastRoleIdRef.current) {
      lastRoleIdRef.current = roleId;
      loadPermissions();
    }
  }, [loadPermissions, profile?.activeRole?._id]);

  return (
    <AuthContext.Provider
      value={{
        profile,
        permissions,
        isSuperAdmin,
        setProfile,
        setPermissions,
        refresh,
        hasAnyPermission,
        loadProfile,
        loadPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
