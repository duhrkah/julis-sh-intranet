'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getPendingEvents,
  approveEvent,
  rejectEvent,
  type Event,
} from '@/lib/api/events';
import { getApiErrorMessage } from '@/lib/apiError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, MapPin, User, Mail } from 'lucide-react';

export default function KalenderAdminFreigabePage() {
  const { hasMinRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!hasMinRole('vorstand')) {
      router.replace('/');
      return;
    }
  }, [authLoading, hasMinRole, router]);

  const loadEvents = () => {
    if (!hasMinRole('vorstand')) return;
    setLoading(true);
    setError(null);
    getPendingEvents()
      .then(setEvents)
      .catch((e) => {
        setError(getApiErrorMessage(e, 'Fehler beim Laden der ausstehenden Termine'));
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && hasMinRole('vorstand')) {
      loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, hasMinRole]);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleApprove = async (id: number) => {
    setActionLoading(true);
    setError(null);
    try {
      await approveEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      showSuccess('Termin wurde freigegeben.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Fehler beim Freigeben'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOpen = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const handleRejectSubmit = async () => {
    if (rejectingId == null || !rejectReason.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await rejectEvent(rejectingId, rejectReason.trim());
      setEvents((prev) => prev.filter((e) => e.id !== rejectingId));
      setRejectingId(null);
      setRejectReason('');
      showSuccess('Termin wurde abgelehnt.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Fehler beim Ablehnen'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string, timeStr?: string | null) => {
    try {
      const d = new Date(dateStr);
      let s = format(d, 'dd.MM.yyyy', { locale: de });
      if (timeStr) s += ` ${String(timeStr).slice(0, 5)}`;
      return s;
    } catch {
      return dateStr;
    }
  };

  if (authLoading || !hasMinRole('vorstand')) return null;

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kalender">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Kalender
          </Link>
        </Button>
      </div>

      <h1 className="mb-2 text-2xl font-semibold">Terminfreigabe</h1>
      <p className="mb-6 text-muted-foreground">
        Eingereichte Termine prüfen, freigeben oder ablehnen.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Reject-Modal */}
      {rejectingId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Ablehnungsgrund</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Grund für die Ablehnung (wird dem Einreicher angezeigt)..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim() || actionLoading}
                  variant="destructive"
                >
                  Ablehnen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectingId(null);
                    setRejectReason('');
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Lade ...</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine ausstehenden Termine zur Freigabe.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      <Link
                        href={`/kalender/${event.id}`}
                        className="hover:underline"
                      >
                        {event.title}
                      </Link>
                    </CardTitle>
                    <Badge variant="secondary">Ausstehend</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(event.start_date, event.start_time)}
                    {event.end_date && ` – ${formatDate(event.end_date, event.end_time)}`}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {event.location && (
                  <p className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {event.location}
                  </p>
                )}
                {(event.submitter_name || event.submitter_email) && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    {event.submitter_name}
                    {event.submitter_email && (
                      <>
                        <Mail className="h-4 w-4 shrink-0" />
                        {event.submitter_email}
                      </>
                    )}
                  </p>
                )}
                {event.source_tenant_id != null && (
                  <p className="text-sm text-muted-foreground">
                    Tenant-ID: {event.source_tenant_id ?? event.tenant_id}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => handleApprove(event.id)}
                    disabled={actionLoading}
                  >
                    Freigeben
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRejectOpen(event.id)}
                    disabled={actionLoading}
                  >
                    Ablehnen
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/kalender/${event.id}`}>Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
