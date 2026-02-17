'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getMeetings, type Meeting } from '@/lib/api/meetings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function SitzungenPage() {
  const { hasMinRole } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasMinRole('mitarbeiter')) return;
    getMeetings()
      .then(setMeetings)
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  if (!hasMinRole('mitarbeiter')) return null;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 text-2xl font-semibold">Sitzungen</h1>
      <p className="mb-6 text-muted-foreground">
        Einladungen und Protokolle erstellen (Word-Vorlagen → PDF).
      </p>

      {hasMinRole('leitung') && (
        <div className="mb-6">
          <Button asChild>
            <Link href="/dokumente/sitzungen/neu">
              <Plus className="mr-1 h-4 w-4" /> Neue Sitzung
            </Link>
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : meetings.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Sitzungen angelegt.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Link key={m.id} href={`/dokumente/sitzungen/${m.id}`}>
              <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4" />
                    {m.titel}
                  </CardTitle>
                  <Badge variant="secondary">{m.typ}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(m.datum), 'EEEE, d. MMMM yyyy', { locale: de })}
                    {m.ort && ` · ${m.ort}`}
                  </p>
                  <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                    {m.einladung_pfad && <span>Einladung vorhanden</span>}
                    {m.protokoll_pfad && <span>Protokoll vorhanden</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
