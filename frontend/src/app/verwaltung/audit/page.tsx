'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getAuditLogs, type AuditLogEntry } from '@/lib/api/audit';
import { getUsers } from '@/lib/api/users';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const LIMIT = 100;

export default function AuditPage() {
  const { hasMinRole } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [action, setAction] = useState('');

  const load = () => {
    setLoading(true);
    const params: { entity_type?: string; user_id?: number; action?: string; limit: number; skip: number } = {
      limit: LIMIT,
      skip: 0,
    };
    if (entityType.trim()) params.entity_type = entityType.trim();
    if (userId) params.user_id = Number(userId);
    if (action.trim()) params.action = action.trim();
    getAuditLogs(params)
      .then(setEntries)
      .catch((e) => setError(getApiErrorMessage(e, 'Laden fehlgeschlagen')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!hasMinRole('admin')) return;
    getUsers()
      .then((list) => {
        const map: Record<number, string> = {};
        list.forEach((u) => { map[u.id] = u.full_name || u.username; });
        setUserNames(map);
      })
      .catch(() => {});
  }, [hasMinRole]);

  useEffect(() => {
    if (!hasMinRole('admin')) return;
    load();
  }, [hasMinRole]);

  const onFilter = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  if (!hasMinRole('admin')) return null;

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/verwaltung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Verwaltung
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold">Audit-Log</h1>
      <p className="mt-1 text-muted-foreground">
        Wer hat wann was geändert (nur Admin).
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Einträge nach Typ, Benutzer oder Aktion filtern.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onFilter} className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Entity-Typ</label>
              <input
                type="text"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-40"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                placeholder="z. B. event"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Benutzer-ID</label>
              <input
                type="number"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-24"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="—"
                min={1}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Aktion</label>
              <input
                type="text"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-32"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="z. B. create"
              />
            </div>
            <Button type="submit">Anwenden</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Einträge</CardTitle>
          <CardDescription>
            {entries.length === LIMIT ? `Letzte ${LIMIT} Einträge.` : `${entries.length} Einträge.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Lade …</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground">Keine Einträge (oder keine Treffer für die Filter).</p>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Zeit</th>
                    <th className="pb-2 pr-4 font-medium">Benutzer</th>
                    <th className="pb-2 pr-4 font-medium">Aktion</th>
                    <th className="pb-2 pr-4 font-medium">Typ</th>
                    <th className="pb-2 pr-4 font-medium">ID</th>
                    <th className="pb-2 pr-4 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {format(new Date(entry.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </td>
                      <td className="py-2 pr-4">
                        {userNames[entry.user_id] ?? `#${entry.user_id}`}
                      </td>
                      <td className="py-2 pr-4">{entry.action}</td>
                      <td className="py-2 pr-4">{entry.entity_type}</td>
                      <td className="py-2 pr-4">{entry.entity_id ?? '—'}</td>
                      <td className="py-2 pr-4 max-w-xs truncate" title={entry.details ?? ''}>
                        {entry.details ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
