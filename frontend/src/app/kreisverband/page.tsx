'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getKreisverbande, type Kreisverband } from '@/lib/api/kreisverband';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronRight, Users } from 'lucide-react';

export default function KreisverbandPage() {
  const { hasMinRole } = useAuth();
  const [list, setList] = useState<Kreisverband[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasMinRole('vorstand')) return;
    getKreisverbande()
      .then(setList)
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  if (!hasMinRole('vorstand')) return null;

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Lade Kreisverbände …</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kreisverbände</h1>
          <p className="mt-1 text-muted-foreground">
            Übersicht aller Kreisverbände mit Kürzel und Status. Klicke auf einen Eintrag für Details, Vorstand und Protokolle.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/kreisverband/uebersicht" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Vorstandsübersicht Landesverband
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((kv: Kreisverband) => (
          <Link key={kv.id} href={`/kreisverband/${kv.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{kv.name}</CardTitle>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {kv.kuerzel && (
                    <Badge variant="secondary">{kv.kuerzel}</Badge>
                  )}
                  {!kv.ist_aktiv && (
                    <Badge variant="outline">inaktiv</Badge>
                  )}
                </div>
                {kv.email && (
                  <CardDescription className="mt-2 truncate">{kv.email}</CardDescription>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <p className="text-muted-foreground">Keine Kreisverbände vorhanden.</p>
      )}
    </div>
  );
}
