'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getEmailRecipients, type EmailRecipient } from '@/lib/api/members';
import { getApiErrorMessage } from '@/lib/apiError';
import { getKreisverbande as getKvList } from '@/lib/api/kreisverband';
import type { Kreisverband } from '@/lib/api/kreisverband';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users } from 'lucide-react';

export default function EmpfaengerPage() {
  const { hasMinRole } = useAuth();
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [kvList, setKvList] = useState<Kreisverband[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formKvId, setFormKvId] = useState<number | ''>('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRolle, setFormRolle] = useState('Vorsitzender');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasMinRole('leitung')) return;
    Promise.all([getEmailRecipients(), getKvList()])
      .then(([r, kv]) => {
        setRecipients(r);
        setKvList(kv);
      })
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  const refresh = () => getEmailRecipients().then(setRecipients);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKvId || !formName.trim() || !formEmail.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const { createEmailRecipient } = await import('@/lib/api/members');
      await createEmailRecipient({
        kreisverband_id: Number(formKvId),
        name: formName.trim(),
        email: formEmail.trim(),
        rolle: formRolle,
      });
      setFormKvId('');
      setFormName('');
      setFormEmail('');
      setShowForm(false);
      refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSubmitting(false);
    }
  };

  const kvName = (id: number) => kvList.find((k) => k.id === id)?.name ?? `KV #${id}`;

  if (!hasMinRole('leitung')) return null;

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/mitglieder" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-2 text-2xl font-semibold">E-Mail-Empfänger</h1>
      <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-foreground">Empfänger aus dem KV-Modul</p>
        <p className="mt-1 text-muted-foreground">
          Bei Mitgliederänderungen erhalten <strong>Kreisvorsitzender</strong> und <strong>Kreisschatzmeister</strong> aus dem Kreisverband-Vorstand die E-Mails. Diese werden im Modul <strong>Kreisverbände</strong> → jeweiliger KV → Vorstand gepflegt (Name, E-Mail, Rolle). Eine separate Empfänger-Liste wird für den E-Mail-Versand nicht mehr verwendet.
        </p>
      </div>
      <p className="mb-4 text-muted-foreground">
        Die folgende Liste zeigt bisher manuell angelegte Empfänger (optional, z. B. für andere Zwecke).
      </p>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-6">
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'outline' : 'default'}>
          <Users className="mr-1 h-4 w-4" />
          {showForm ? 'Abbrechen' : 'Empfänger hinzufügen'}
        </Button>
        {showForm && (
          <form onSubmit={handleCreate} className="mt-4 max-w-md space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Kreisverband *</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formKvId}
                onChange={(e) => setFormKvId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">Bitte wählen</option>
                {kvList.map((kv) => (
                  <option key={kv.id} value={kv.id}>{kv.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Name"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-Mail *</label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@example.de"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rolle</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formRolle}
                onChange={(e) => setFormRolle(e.target.value)}
              >
                <option value="Vorsitzender">Vorsitzender</option>
                <option value="Schatzmeister">Schatzmeister</option>
                <option value="Stellvertreter">Stellvertreter</option>
                <option value="Sonstige">Sonstige</option>
              </select>
            </div>
            <Button type="submit" disabled={submitting}>Speichern</Button>
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : recipients.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Empfänger angelegt.</p>
      ) : (
        <div className="space-y-3">
          {recipients.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{r.name}</CardTitle>
                <Badge variant="secondary">{kvName(r.kreisverband_id)}</Badge>
              </CardHeader>
              <CardContent className="text-sm">
                <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a>
                <span className="ml-2 text-muted-foreground">– {r.rolle}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
