'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getPendingEvents } from '@/lib/api/events';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, Calendar } from 'lucide-react';

export default function KalenderAdminPage() {
  const { hasMinRole } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!hasMinRole('vorstand')) return;
    getPendingEvents()
      .then((list) => setPendingCount(list.length))
      .catch(() => setPendingCount(0));
  }, [hasMinRole]);

  if (!hasMinRole('vorstand')) return null;

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">Kalender-Admin</h1>
      <p className="mb-6 text-muted-foreground">
        Terminfreigabe und Verwaltung der eingereichten Veranstaltungen.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/kalender/admin/freigabe">
          <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Terminfreigabe</CardTitle>
                <CardDescription>
                  Eingereichte Termine genehmigen oder ablehnen
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {pendingCount !== null && (
                <p className="text-sm font-medium text-muted-foreground">
                  {pendingCount} ausstehend{pendingCount !== 0 ? ' – jetzt prüfen' : ''}
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/kalender">
          <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Zum Kalender</CardTitle>
                <CardDescription>
                  Alle Termine anzeigen und Events anlegen
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </>
  );
}
