'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const { user, loading, isAuthenticated, hasMinRole, canAccessMemberChanges } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Lade …</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          Willkommen im JuLis SH Intranet
        </h1>
        <p className="mb-8 text-muted-foreground">
          Hallo {user?.full_name || user?.username}, hier ist dein Dashboard.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hasMinRole('mitarbeiter') && (
            <Card className="border-sidebar-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Kalender</CardTitle>
                <CardDescription>Termine für den Landesverband eintragen</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="default" className="w-full">
                  <Link href="/kalender">Zum Kalender</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {canAccessMemberChanges() && (
            <Card className="border-sidebar-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Mitgliederänderungen</CardTitle>
                <CardDescription>Eintritt, Austritt, Verbandswechsel</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="default" className="w-full">
                  <Link href="/mitglieder">Zu Mitgliederänderungen</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {hasMinRole('mitarbeiter') && (
            <Card className="border-sidebar-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Kreisverbände</CardTitle>
                <CardDescription>Einsehen und Protokolle hinterlegen</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="default" className="w-full">
                  <Link href="/kreisverband">Zu Kreisverbänden</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {hasMinRole('vorstand') && (
            <Card className="border-sidebar-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Dokumente</CardTitle>
                <CardDescription>Satzung, GO, Sitzungen</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="default" className="w-full">
                  <Link href="/dokumente/satzung">Zu Dokumenten</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {hasMinRole('mitarbeiter') && (
            <Card className="border-sidebar-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Sitzungen</CardTitle>
                <CardDescription>Protokolle schreiben</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="default" className="w-full">
                  <Link href="/dokumente/sitzungen">Zu Sitzungen</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {hasMinRole('admin') && (
            <Card className="border-sidebar-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Verwaltung</CardTitle>
                <CardDescription>Benutzer, Stammdaten, Audit</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/verwaltung">Zur Verwaltung</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
