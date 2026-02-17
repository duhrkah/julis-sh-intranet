'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'julis-intranet-theme';

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

/** Embed-Kalender unter /kalender/embed darf keinen Dark Mode haben. */
function isCalendarEmbedPath(pathname: string | null): boolean {
  return pathname === '/kalender/embed' || (pathname?.startsWith('/kalender/embed/') ?? false);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setThemeState(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const embedForcesLight = isCalendarEmbedPath(pathname);
    const resolvedTheme = embedForcesLight ? 'light' : (theme === 'system' ? getSystemTheme() : theme);
    setResolved(resolvedTheme);
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [theme, mounted, pathname]);

  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (isCalendarEmbedPath(pathname)) return;
      setResolved(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, mounted, pathname]);

  const setTheme = (value: Theme) => {
    setThemeState(value);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, value);
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolved: mounted ? resolved : 'light',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
