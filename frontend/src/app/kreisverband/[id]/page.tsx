'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getKreisverbandById,
  getVorstand,
  getProtokolle,
  createVorstandsmitglied,
  uploadProtokoll,
  deleteVorstandsmitglied,
  deleteProtokoll,
  type Kreisverband,
  type Vorstandsmitglied,
  type KVProtokoll,
} from '@/lib/api/kreisverband';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, UserPlus, FileUp, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const ROLEN = ['Kreisvorsitzender', 'stv. Kreisvorsitzender für Programmatik', 'stv. Kreisvorsitzender für Organisation', 'stv. Kreisvorsitzender für Presse- und Öffentlichkeitsarbeit', 'Kreisschatzmeister', 'Beisitzer für Organisation', 'Beisitzer für Programmatik', 'Beisitzer für Presse- und Öffentlichkeitsarbeit', 'Sonstige'];
const PROTYPEN = ['Kreiskongress', 'Kreisvorstandssitzung', 'Sonstige'];

export default function KreisverbandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { hasMinRole, isAdmin } = useAuth();

  const [kv, setKv] = useState<Kreisverband | null>(null);
  const [vorstand, setVorstand] = useState<Vorstandsmitglied[]>([]);
  const [protokolle, setProtokolle] = useState<KVProtokoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showVorstandForm, setShowVorstandForm] = useState(false);
  const [showProtokollForm, setShowProtokollForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [vorstandName, setVorstandName] = useState('');
  const [vorstandEmail, setVorstandEmail] = useState('');
  const [vorstandRolle, setVorstandRolle] = useState('Kreisvorsitzender');
  const [protokollTitel, setProtokollTitel] = useState('');
  const [protokollDatum, setProtokollDatum] = useState('');
  const [protokollTyp, setProtokollTyp] = useState('Kreiskongress');
  const [protokollDatei, setProtokollDatei] = useState<File | null>(null);

  const canEditVorstand = hasMinRole('vorstand');
  const canDeleteVorstand = isAdmin;
  const canAddProtokoll = hasMinRole('mitarbeiter');
  const canDeleteProtokoll = isAdmin;

  useEffect(() => {
    if (!hasMinRole('mitarbeiter') || !id) return;
    Promise.all([
      getKreisverbandById(id),
      getVorstand(id),
      getProtokolle(id),
    ])
      .then(([kvData, vorstandData, protokollData]) => {
        setKv(kvData);
        setVorstand(vorstandData);
        setProtokolle(protokollData);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [id, hasMinRole]);

  const refreshVorstand = () => getVorstand(id).then(setVorstand);
  const refreshProtokolle = () => getProtokolle(id).then(setProtokolle);

  const handleAddVorstand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vorstandName.trim()) return;
    setSubmitting(true);
    try {
      await createVorstandsmitglied(id, {
        name: vorstandName.trim(),
        email: vorstandEmail.trim() || undefined,
        rolle: vorstandRolle,
        ist_aktiv: true,
      });
      setVorstandName('');
      setVorstandEmail('');
      setShowVorstandForm(false);
      refreshVorstand();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSubmitting(false);
    }
  };

  const [confirmVorstand, setConfirmVorstand] = useState<number | null>(null);
  const handleDeleteVorstand = (mitgliedId: number) => setConfirmVorstand(mitgliedId);
  const handleConfirmDeleteVorstand = async () => {
    if (confirmVorstand == null) return;
    try {
      await deleteVorstandsmitglied(confirmVorstand);
      setConfirmVorstand(null);
      refreshVorstand();
    } catch {
      setError('Fehler beim Löschen');
    }
  };

  const handleUploadProtokoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protokollTitel.trim() || !protokollDatum) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('titel', protokollTitel.trim());
      formData.append('datum', protokollDatum);
      formData.append('typ', protokollTyp);
      if (protokollDatei) formData.append('datei', protokollDatei);
      await uploadProtokoll(id, formData);
      setProtokollTitel('');
      setProtokollDatum('');
      setProtokollDatei(null);
      setShowProtokollForm(false);
      refreshProtokolle();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Hochladen'));
    } finally {
      setSubmitting(false);
    }
  };

  const [confirmProtokoll, setConfirmProtokoll] = useState<number | null>(null);
  const handleDeleteProtokoll = (protokollId: number) => setConfirmProtokoll(protokollId);
  const handleConfirmDeleteProtokoll = async () => {
    if (confirmProtokoll == null) return;
    try {
      await deleteProtokoll(confirmProtokoll);
      setConfirmProtokoll(null);
      refreshProtokolle();
    } catch {
      setError('Fehler beim Löschen');
    }
  };

  const downloadUrl = (datei_pfad: string | null | undefined) => {
    if (!datei_pfad) return null;
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') || 'http://localhost:8000';
    const relative = datei_pfad.replace(/^.*?[/\\]uploads[/\\]?/i, '');
    return relative ? `${base}/uploads/${relative}` : null;
  };

  if (!hasMinRole('mitarbeiter')) return null;

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-muted-foreground">Lade …</p>
      </div>
    );
  }

  if (error && !kv) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/kreisverband">Zurück zur Übersicht</Link>
        </Button>
      </div>
    );
  }

  if (!kv) return null;

  return (
    <div className="p-4 sm:p-6">
      <ConfirmDialog
        open={confirmVorstand !== null}
        onOpenChange={(open) => !open && setConfirmVorstand(null)}
        title="Vorstandsmitglied entfernen?"
        description="Vorstandsmitglied wirklich entfernen?"
        confirmLabel="Entfernen"
        variant="destructive"
        onConfirm={handleConfirmDeleteVorstand}
      />
      <ConfirmDialog
        open={confirmProtokoll !== null}
        onOpenChange={(open) => !open && setConfirmProtokoll(null)}
        title="Protokoll löschen?"
        description="Protokoll wirklich löschen?"
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleConfirmDeleteProtokoll}
      />
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/kreisverband" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Übersicht
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">{kv.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {kv.kuerzel && <Badge variant="secondary">{kv.kuerzel}</Badge>}
              {!kv.ist_aktiv && <Badge variant="outline">inaktiv</Badge>}
            </div>
            {kv.email && (
              <p className="mt-1 text-sm text-muted-foreground">{kv.email}</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      {/* Vorstand */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Vorstand</CardTitle>
          {canEditVorstand && (
            <Button
              size="sm"
              variant={showVorstandForm ? 'outline' : 'default'}
              onClick={() => setShowVorstandForm((v) => !v)}
            >
              <UserPlus className="mr-1 h-4 w-4" />
              {showVorstandForm ? 'Abbrechen' : 'Hinzufügen'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showVorstandForm && canEditVorstand && (
            <form onSubmit={handleAddVorstand} className="mb-4 rounded-md border border-border bg-muted/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <Input
                    value={vorstandName}
                    onChange={(e) => setVorstandName(e.target.value)}
                    placeholder="Name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">E-Mail</label>
                  <Input
                    type="email"
                    value={vorstandEmail}
                    onChange={(e) => setVorstandEmail(e.target.value)}
                    placeholder="email@example.de"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Rolle</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vorstandRolle}
                    onChange={(e) => setVorstandRolle(e.target.value)}
                  >
                    {ROLEN.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" className="mt-3" disabled={submitting}>
                Speichern
              </Button>
            </form>
          )}
          {vorstand.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Vorstandsmitglieder erfasst.</p>
          ) : (
            <ul className="space-y-2">
              {vorstand.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.email && (
                      <span className="ml-2 text-sm text-muted-foreground">{m.email}</span>
                    )}
                    <Badge variant="outline" className="ml-2 text-xs">{m.rolle}</Badge>
                  </div>
                  {canDeleteVorstand && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteVorstand(m.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Protokolle */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Protokolle</CardTitle>
          {canAddProtokoll && (
            <Button
              size="sm"
              variant={showProtokollForm ? 'outline' : 'default'}
              onClick={() => setShowProtokollForm((v) => !v)}
            >
              <FileUp className="mr-1 h-4 w-4" />
              {showProtokollForm ? 'Abbrechen' : 'Hochladen'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showProtokollForm && canAddProtokoll && (
            <form onSubmit={handleUploadProtokoll} className="mb-4 rounded-md border border-border bg-muted/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Titel</label>
                  <Input
                    value={protokollTitel}
                    onChange={(e) => setProtokollTitel(e.target.value)}
                    placeholder="z. B. MV 01/2025"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Datum</label>
                  <Input
                    type="date"
                    value={protokollDatum}
                    onChange={(e) => setProtokollDatum(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Typ</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={protokollTyp}
                    onChange={(e) => setProtokollTyp(e.target.value)}
                  >
                    {PROTYPEN.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">PDF-Datei (optional)</label>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setProtokollDatei(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <Button type="submit" className="mt-3" disabled={submitting}>
                Hochladen
              </Button>
            </form>
          )}
          {protokolle.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Protokolle vorhanden.</p>
          ) : (
            <ul className="space-y-2">
              {protokolle.map((p) => {
                const url = downloadUrl(p.datei_pfad);
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{p.titel}</span>
                      <Badge variant="outline" className="text-xs">{p.typ}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(p.datum), 'd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          PDF
                        </a>
                      )}
                      {canDeleteProtokoll && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteProtokoll(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
