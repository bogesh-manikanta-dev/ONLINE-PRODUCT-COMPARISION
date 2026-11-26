import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { AuthUserDTO } from '../../shared/types.ts';
import { apiRequest, setAuthToken } from '../lib/api.ts';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextValue {
  user: AuthUserDTO | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<AuthUserDTO>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<AuthUserDTO>;
  loginWithGoogle: () => Promise<AuthUserDTO>;
  claimAdminAccess: (payload: { passcode: string; email?: string; name?: string }) => Promise<AuthUserDTO>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setAuthToken(idToken);
          const res = await apiRequest<{ user: AuthUserDTO }>('/api/auth/firebase-sync', {
            method: 'POST',
            tokenOverride: idToken,
          });
          setUser(res.user);
        } catch {
          // Keep existing custom session if active
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUserDTO }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const registerWithEmail = useCallback(async (name: string, email: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUserDTO }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setAuthToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    setAuthToken(idToken);
    const res = await apiRequest<{ user: AuthUserDTO }>('/api/auth/firebase-sync', {
      method: 'POST',
      tokenOverride: idToken,
    });
    setUser(res.user);
    return res.user;
  }, []);

  const claimAdminAccess = useCallback(
    async (payload: { passcode: string; email?: string; name?: string }) => {
      const res = await apiRequest<{ token: string; user: AuthUserDTO }>('/api/auth/admin-bootstrap', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(res.token);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: AuthUserDTO }>('/api/auth/me');
      setUser(res.user);
    } catch {
      // Ignore if not signed in
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        claimAdminAccess,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
