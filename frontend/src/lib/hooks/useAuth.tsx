'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, getCurrentUser } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/apiError';

export type Role = 'admin' | 'leitung' | 'vorstand' | 'mitarbeiter';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  leitung: 3,
  vorstand: 2,
  mitarbeiter: 1,
};

const ROLE_DISPLAY: Record<Role, string> = {
  admin: 'Boss',
  leitung: 'Leitung',
  vorstand: 'Vorstand',
  mitarbeiter: 'Mitarbeiter',
};

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  role: Role;
  is_active: boolean;
  tenant_id?: number | null;
  kreisverband_id?: number;
  kreisverband_name?: string;
  display_role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isLeitung: boolean;
  isVorstand: boolean;
  isMitarbeiter: boolean;
  hasMinRole: (role: Role) => boolean;
  isAuthenticated: boolean;
  displayRole: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const userData = await getCurrentUser();
      setUser(userData as User);
      localStorage.setItem('user', JSON.stringify(userData));
      setError(null);
    } catch {
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const response = await apiLogin({ username, password });
      localStorage.setItem('access_token', response.access_token);
      const userData = await getCurrentUser();
      setUser(userData as User);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
  }, []);

  const hasMinRole = useCallback(
    (role: Role): boolean => {
      if (!user) return false;
      const userRole = user.role as Role;
      return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[role];
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    refreshUser,
    isAdmin: user?.role === 'admin',
    isLeitung: hasMinRole('leitung'),
    isVorstand: hasMinRole('vorstand'),
    isMitarbeiter: hasMinRole('mitarbeiter'),
    hasMinRole,
    isAuthenticated: !!user,
    displayRole: user ? ROLE_DISPLAY[user.role as Role] : '',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
