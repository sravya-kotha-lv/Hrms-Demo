import React, { createContext, useContext, useMemo, useState } from 'react';

type SessionPayload = {
  token: string;
  loginData: any;
  profile: any | null;
  permissions: string[];
};

type AuthContextValue = {
  session: SessionPayload | null;
  setSession: (payload: SessionPayload | null) => void;
  updateProfile: (profile: any | null) => void;
  updatePermissions: (permissions: string[]) => void;
  updateToken: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<SessionPayload | null>(null);

  const updateProfile = (profile: any | null) => {
    setSession((current) => (current ? { ...current, profile } : current));
  };

  const updatePermissions = (permissions: string[]) => {
    setSession((current) => (current ? { ...current, permissions } : current));
  };

  const updateToken = (token: string) => {
    setSession((current) => (current ? { ...current, token } : current));
  };

  const logout = () => setSession(null);

  const value = useMemo<AuthContextValue>(
    () => ({ session, setSession, updateProfile, updatePermissions, updateToken, logout }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
