import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearStoredSession,
  loadStoredSession,
  storeSession,
} from '../utils/sessionStorage';

export type SessionPayload = {
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
  sessionExpiredMessage: string | null;
  setSessionExpiredMessage: (message: string | null) => void;
  clearSessionExpiredMessage: () => void;
  loginSuccessMessage: string | null;
  setLoginSuccessMessage: (message: string | null) => void;
  clearLoginSuccessMessage: () => void;
  logoutSuccessMessage: string | null;
  setLogoutSuccessMessage: (message: string | null) => void;
  clearLogoutSuccessMessage: () => void;
  authReady: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);
  const [logoutSuccessMessage, setLogoutSuccessMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      const storedSession = await loadStoredSession();
      if (!mounted) return;

      setSession(storedSession);
      setAuthReady(true);
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const persistSession = async () => {
      if (session) {
        await storeSession(session);
        return;
      }

      await clearStoredSession();
    };

    persistSession();
  }, [authReady, session]);

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

  const clearSessionExpiredMessage = () => setSessionExpiredMessage(null);
  const clearLoginSuccessMessage = () => setLoginSuccessMessage(null);
  const clearLogoutSuccessMessage = () => setLogoutSuccessMessage(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      setSession,
      updateProfile,
      updatePermissions,
      updateToken,
      logout,
      sessionExpiredMessage,
      setSessionExpiredMessage,
      clearSessionExpiredMessage,
      loginSuccessMessage,
      setLoginSuccessMessage,
      clearLoginSuccessMessage,
      logoutSuccessMessage,
      setLogoutSuccessMessage,
      clearLogoutSuccessMessage,
      authReady,
    }),
    [session, sessionExpiredMessage, loginSuccessMessage, logoutSuccessMessage, authReady]
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
