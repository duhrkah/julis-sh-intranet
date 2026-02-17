'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const isLoginPage = pathname === '/login';
  const isPublicCalendarSubmit = pathname === '/kalender/einreichen';
  const isPublicCalendarView = pathname === '/kalender/oeffentlich';
  const isCalendarEmbed = pathname === '/kalender/embed' || pathname.startsWith('/kalender/embed/');
  const isPublicRoute =
    isPublicCalendarSubmit || isPublicCalendarView || isCalendarEmbed;
  const isProtectedRoute = !isLoginPage && !isPublicRoute;

  useEffect(() => {
    if (!loading && !isAuthenticated && isProtectedRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, isAuthenticated, isProtectedRoute, pathname, router]);

  const showShell = isAuthenticated && !isLoginPage && !isPublicRoute && !loading;

  if (showShell) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
