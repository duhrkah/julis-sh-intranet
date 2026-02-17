'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function VerwaltungPage() {
  const { hasMinRole } = useAuth();
  if (!hasMinRole('admin')) return null;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Verwaltung</h1>
      <p className="mt-1 text-muted-foreground">
        Benutzer, Stammdaten und Audit-Log (nur Administrator).
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {hasMinRole('admin') && (
          <Card>
            <CardHeader>
              <CardTitle>Benutzer</CardTitle>
              <CardDescription>Benutzer und Rollen verwalten</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/verwaltung/benutzer">Benutzer verwalten</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {hasMinRole('admin') && (
          <Card>
            <CardHeader>
              <CardTitle>Kreise</CardTitle>
              <CardDescription>Kreisverbände anlegen, bearbeiten oder deaktivieren</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/verwaltung/kreise">Kreise verwalten</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {hasMinRole('admin') && (
          <Card>
            <CardHeader>
              <CardTitle>Stammdaten</CardTitle>
              <CardDescription>System-Stammdaten pflegen</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/verwaltung/stammdaten">Stammdaten</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {hasMinRole('admin') && (
          <Card>
            <CardHeader>
              <CardTitle>Audit-Log</CardTitle>
              <CardDescription>Aktivitätsprotokoll einsehen</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/verwaltung/audit">Zum Audit-Log</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
