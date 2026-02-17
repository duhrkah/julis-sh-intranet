'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { submitPublicEvent } from '@/lib/api/publicEvents';
import { getPublicCalendars } from '@/lib/api/publicCalendar';
import { formatKreisverbandDisplayName } from '@/lib/formatKreisverband';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function KalenderEinreichenPage() {
  const [kreisverbandList, setKreisverbandList] = useState<{ id: number; name: string }[]>([]);
  const [tenantId, setTenantId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getPublicCalendars()
      .then((cal) => {
        const kv = cal.kreisverband || [];
        setKreisverbandList(kv);
        if (kv.length === 1) setTenantId(kv[0].id);
      })
      .catch(() => setKreisverbandList([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tid = tenantId === '' ? undefined : Number(tenantId);
    if (!title.trim() || !startDate || !organizer.trim() || !submitterName.trim() || !submitterEmail.trim()) return;
    if (kreisverbandList.length > 0 && (tid === undefined || tid === 0)) {
      setError('Bitte wählen Sie einen Kreisverband.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await submitPublicEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        start_time: startTime || undefined,
        end_date: endDate || undefined,
        end_time: endTime || undefined,
        location: location.trim() || undefined,
        location_url: locationUrl.trim() || undefined,
        organizer: organizer.trim(),
        submitter_name: submitterName.trim(),
        submitter_email: submitterEmail.trim(),
        tenant_id: tid ?? undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einreichung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-sidebar-border">
          <CardHeader>
            <CardTitle className="text-xl text-green-600 dark:text-green-400">Termin eingereicht</CardTitle>
            <CardDescription>
              Vielen Dank. Ihr Termin wurde übermittelt und wird nach Prüfung durch den Vorstand im Kalender veröffentlicht.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/kalender/einreichen">
              <Button variant="outline">Weiteren Termin einreichen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-sidebar-border">
        <CardHeader>
          <CardTitle className="text-2xl">Termin einreichen</CardTitle>
          <CardDescription>
            Reichen Sie hier einen Termin für einen Kreisverband ein. Nach Prüfung durch den Vorstand wird er im Kalender der Kreisverbände veröffentlicht. Kein Login nötig.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kreisverbandList.length === 0 && (
            <p className="mb-4 text-sm text-muted-foreground">
              Derzeit sind keine Kreisverbände für Einreichungen konfiguriert.
            </p>
          )}
          {kreisverbandList.length > 0 && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Kreisverband *</label>
              <p className="mb-2 text-xs text-muted-foreground">
                Wählen Sie den Kreisverband, für den der Termin eingereicht werden soll.
              </p>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Bitte Kreisverband wählen …</option>
                {kreisverbandList.map((kv) => (
                  <option key={kv.id} value={kv.id}>
                    {formatKreisverbandDisplayName(kv.name)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && (
            <p className="mb-4 text-sm text-destructive rounded-md bg-destructive/10 p-3">{error}</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titel *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Landesausschuss"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Beschreibung</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurzbeschreibung …"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Startdatum *</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Startzeit</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Enddatum</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Endzeit</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ort</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Veranstaltungsort"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Link (z. B. Karte)</label>
              <Input
                type="url"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Veranstalter *</label>
              <Input
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="z. B. JuLis SH"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Ihr Name *</label>
                <Input
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Name"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ihre E-Mail *</label>
                <Input
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="email@example.de"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="submit"
                disabled={
                  loading ||
                  kreisverbandList.length === 0 ||
                  tenantId === '' ||
                  tenantId === undefined
                }
              >
                {loading ? 'Wird eingereicht …' : 'Termin einreichen'}
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/login">Zum Login (bereits registriert?)</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
