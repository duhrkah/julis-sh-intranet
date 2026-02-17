'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createEvent } from '@/lib/api/events';
import { getTenantTree } from '@/lib/api/tenants';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatKreisverbandDisplayName } from '@/lib/formatKreisverband';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

type TenantOption = { id: number; name: string; parent_id: number | null };

function flattenTenants(
  node: { id: number; name: string; parent_id: number | null; children?: TenantOption[] }
): TenantOption[] {
  return [
    { id: node.id, name: node.name, parent_id: node.parent_id },
    ...(node.children || []).flatMap(flattenTenants),
  ];
}

export default function KalenderNeuPage() {
  const router = useRouter();
  const { hasMinRole, user } = useAuth();
  const [tenantTree, setTenantTree] = useState<{ id: number; name: string; parent_id: number | null; children?: unknown[] }[]>([]);
  const [calendarType, setCalendarType] = useState<'landesverband' | 'kreisverband'>('landesverband');
  const [targetTenantId, setTargetTenantId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { landesverbandOptions, kreisverbandOptions } = useMemo(() => {
    const all = tenantTree.flatMap((n) =>
      flattenTenants(n as { id: number; name: string; parent_id: number | null; children?: TenantOption[] })
    );
    const lv = all.filter((t) => t.parent_id === null);
    const kv = all.filter((t) => t.parent_id !== null);
    return { landesverbandOptions: lv, kreisverbandOptions: kv };
  }, [tenantTree]);

  useEffect(() => {
    if (!hasMinRole('mitarbeiter')) return;
    getTenantTree()
      .then(setTenantTree)
      .catch(() => setTenantTree([]));
  }, [hasMinRole]);

  useEffect(() => {
    if (calendarType === 'landesverband' && landesverbandOptions.length > 0) {
      setTargetTenantId(landesverbandOptions[0].id);
    } else if (calendarType === 'kreisverband' && kreisverbandOptions.length > 0 && !kreisverbandOptions.some((k) => k.id === targetTenantId)) {
      setTargetTenantId(kreisverbandOptions[0].id);
    } else if (calendarType === 'kreisverband' && kreisverbandOptions.length === 0) {
      setTargetTenantId('');
    } else if (calendarType === 'landesverband') {
      setTargetTenantId(landesverbandOptions[0]?.id ?? '');
    }
  }, [calendarType, landesverbandOptions, kreisverbandOptions, targetTenantId]);

  if (!hasMinRole('mitarbeiter')) {
    router.replace('/kalender');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !organizer.trim()) return;
    const tenantId =
      calendarType === 'landesverband'
        ? (targetTenantId !== '' ? targetTenantId : landesverbandOptions[0]?.id)
        : (targetTenantId === '' ? undefined : targetTenantId);
    if (calendarType === 'kreisverband' && tenantId == null) {
      setError('Bitte wählen Sie einen Kreisverband.');
      return;
    }
    if (calendarType === 'landesverband' && !tenantId) {
      setError('Kein Landesverband verfügbar.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        start_time: startTime || undefined,
        end_date: endDate || undefined,
        end_time: endTime || undefined,
        location: location.trim() || undefined,
        location_url: locationUrl.trim() || undefined,
        organizer: organizer.trim(),
        is_public: isPublic,
        target_tenant_id: tenantId ?? undefined,
      });
      router.push('/kalender');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/kalender" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-6 text-2xl font-semibold">Event anlegen</h1>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Veranstaltung</CardTitle>
          <CardDescription>
            Termin anlegen. Landesverbands-Termine erscheinen sofort; Kreisverbands-Termine müssen ggf. freigegeben werden (Vorstand genehmigt sofort).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3 rounded-lg border border-input p-4">
              <label className="block text-sm font-medium">Art des Termins *</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="calendarType"
                    checked={calendarType === 'landesverband'}
                    onChange={() => setCalendarType('landesverband')}
                    className="rounded-full border-input"
                  />
                  <span>LV-Termin (Landesverband)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="calendarType"
                    checked={calendarType === 'kreisverband'}
                    onChange={() => {
                      setCalendarType('kreisverband');
                      if (!organizer.trim()) setOrganizer(user?.full_name ?? user?.username ?? '');
                    }}
                    className="rounded-full border-input"
                  />
                  <span>KV-Termin (Kreisverband)</span>
                </label>
              </div>
              {calendarType === 'landesverband' && landesverbandOptions.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Termin erscheint im Kalender des Landesverbands.
                  {landesverbandOptions.length > 1 && (
                    <select
                      className="ml-2 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={targetTenantId}
                      onChange={(e) => setTargetTenantId(Number(e.target.value))}
                    >
                      {landesverbandOptions.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}
                </p>
              )}
              {calendarType === 'kreisverband' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Kreisverband *</label>
                  <select
                    className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={targetTenantId}
                    onChange={(e) => setTargetTenantId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">Bitte Kreisverband wählen …</option>
                    {kreisverbandOptions.map((kv) => (
                      <option key={kv.id} value={kv.id}>{formatKreisverbandDisplayName(kv.name)}</option>
                    ))}
                  </select>
                  {kreisverbandOptions.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Keine Kreisverbände angelegt.</p>
                  )}
                </div>
              )}
            </div>
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="is_public" className="text-sm">
                Öffentlich anzeigen
              </label>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Speichern …' : 'Event anlegen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
