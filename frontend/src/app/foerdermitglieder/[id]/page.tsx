'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getSupporterMemberById,
  updateSupporterMember,
  deleteSupporterMember,
  STUFEN,
  GESCHLECHTER,
  type SupporterMember,
  type SupporterMemberCreate,
} from '@/lib/api/supporter-members';
import { getKreisverbande as getKvList } from '@/lib/api/kreisverband';
import type { Kreisverband } from '@/lib/api/kreisverband';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Heart,
  Pencil,
  Trash2,
  User,
  CreditCard,
  MapPin,
  Building2,
} from 'lucide-react';

function berechneStufe(betrag: number): string {
  if (betrag >= 450) return 'Zukunftsgestalter';
  if (betrag >= 250) return 'Chancenmacher';
  if (betrag >= 120) return 'Freiheitsbringer';
  return 'Impulsgeber';
}

function stufeBadgeVariant(stufe: string): 'default' | 'secondary' | 'outline' {
  switch (stufe) {
    case 'Zukunftsgestalter': return 'default';
    case 'Chancenmacher': return 'default';
    case 'Freiheitsbringer': return 'secondary';
    default: return 'outline';
  }
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="text-sm">{value || '–'}</dd>
    </div>
  );
}

export default function FoerdermitgliedDetailPage() {
  const { hasMinRole } = useAuth();
  const params = useParams();
  const router = useRouter();
  const memberId = Number(params.id);

  const [member, setMember] = useState<SupporterMember | null>(null);
  const [kvList, setKvList] = useState<Kreisverband[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SupporterMemberCreate>({
    geschlecht: '', vorname: '', nachname: '', beitragshoehe: 25,
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!hasMinRole('leitung') || isNaN(memberId)) return;
    Promise.all([getSupporterMemberById(memberId), getKvList()])
      .then(([m, kv]) => {
        setMember(m);
        setKvList(kv);
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Fördermitglied nicht gefunden')))
      .finally(() => setLoading(false));
  }, [hasMinRole, memberId]);

  const openEdit = () => {
    if (!member) return;
    setForm({
      geschlecht: member.geschlecht,
      titel: member.titel ?? '',
      vorname: member.vorname,
      nachname: member.nachname,
      kreisverband_id: member.kreisverband_id ?? null,
      beitragshoehe: member.beitragshoehe,
      verwendungszweck: member.verwendungszweck ?? '',
      iban: member.iban ?? '',
      bankinstitut: member.bankinstitut ?? '',
      strasse_hausnummer: member.strasse_hausnummer ?? '',
      plz: member.plz ?? '',
      ort: member.ort ?? '',
      telefon: member.telefon ?? '',
      mobilnummer: member.mobilnummer ?? '',
      email: member.email ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        titel: form.titel || null,
        kreisverband_id: form.kreisverband_id || null,
        verwendungszweck: form.verwendungszweck || null,
        iban: form.iban || null,
        bankinstitut: form.bankinstitut || null,
        strasse_hausnummer: form.strasse_hausnummer || null,
        plz: form.plz || null,
        ort: form.ort || null,
        telefon: form.telefon || null,
        mobilnummer: form.mobilnummer || null,
        email: form.email || null,
      };
      const updated = await updateSupporterMember(memberId, payload);
      setMember(updated);
      setShowForm(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSupporterMember(memberId);
      router.push('/foerdermitglieder');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Löschen'));
      setDeleting(false);
    }
  };

  const updateField = <K extends keyof SupporterMemberCreate>(key: K, value: SupporterMemberCreate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (!hasMinRole('leitung')) return null;

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-muted-foreground">Lade …</p>
      </div>
    );
  }

  if (error && !member) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/foerdermitglieder">Zurück zur Übersicht</Link>
        </Button>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="p-4 sm:p-6">
      {/* Back */}
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/foerdermitglieder" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Übersicht
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">
              {member.titel ? `${member.titel} ` : ''}{member.vorname} {member.nachname}
            </h1>
            <p className="text-sm text-muted-foreground">Lfd. Nr. {member.id}</p>
          </div>
          <Badge variant={stufeBadgeVariant(member.stufe)}>{member.stufe}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="mr-1 h-4 w-4" /> Bearbeiten
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDelete(true)} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1 h-4 w-4" /> Löschen
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Persönliche Daten */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Persönliche Daten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <DetailRow label="Geschlecht" value={member.geschlecht} />
              <DetailRow label="Titel" value={member.titel} />
              <DetailRow label="Vorname" value={member.vorname} />
              <DetailRow label="Nachname" value={member.nachname} />
              <DetailRow
                label="E-Mail"
                value={member.email}
              />
              <DetailRow label="Telefon" value={member.telefon} />
              <DetailRow label="Mobilnummer" value={member.mobilnummer} />
            </dl>
          </CardContent>
        </Card>

        {/* Beitrag & Bankdaten */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Beitrag &amp; Bankdaten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <DetailRow
                label="Beitragshöhe"
                value={`${Number(member.beitragshoehe).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €/Jahr`}
              />
              <div className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="text-sm font-medium text-muted-foreground sm:w-44 sm:shrink-0">Stufe</dt>
                <dd><Badge variant={stufeBadgeVariant(member.stufe)}>{member.stufe}</Badge></dd>
              </div>
              <DetailRow label="Verwendungszweck" value={member.verwendungszweck} />
              <DetailRow label="IBAN" value={member.iban} />
              <DetailRow label="Bankinstitut" value={member.bankinstitut} />
            </dl>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Adresse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <DetailRow label="Straße + Hausnr." value={member.strasse_hausnummer} />
              <DetailRow label="PLZ" value={member.plz} />
              <DetailRow label="Ort" value={member.ort} />
            </dl>
          </CardContent>
        </Card>

        {/* Kreisverband */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Kreisverband
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <DetailRow label="Kreisverband" value={member.kreisverband_name} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fördermitglied bearbeiten</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Geschlecht *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.geschlecht}
                  onChange={(e) => updateField('geschlecht', e.target.value)}
                  required
                >
                  {GESCHLECHTER.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Titel</label>
                <Input value={form.titel ?? ''} onChange={(e) => updateField('titel', e.target.value)} placeholder="z.B. Dr." />
              </div>
              <div className="sm:col-span-1" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Vorname *</label>
                <Input value={form.vorname} onChange={(e) => updateField('vorname', e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Nachname *</label>
                <Input value={form.nachname} onChange={(e) => updateField('nachname', e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Kreisverband</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.kreisverband_id ?? ''}
                onChange={(e) => updateField('kreisverband_id', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">– Keiner –</option>
                {kvList.map((kv) => (
                  <option key={kv.id} value={kv.id}>{kv.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Beitragshöhe (€/Jahr) *</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.beitragshoehe}
                  onChange={(e) => updateField('beitragshoehe', Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Stufe (automatisch)</label>
                <div className="flex h-10 items-center">
                  <Badge variant={stufeBadgeVariant(berechneStufe(form.beitragshoehe))}>
                    {berechneStufe(form.beitragshoehe)}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Verwendungszweck</label>
              <Input value={form.verwendungszweck ?? ''} onChange={(e) => updateField('verwendungszweck', e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">IBAN</label>
                <Input value={form.iban ?? ''} onChange={(e) => updateField('iban', e.target.value)} placeholder="DE..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bankinstitut</label>
                <Input value={form.bankinstitut ?? ''} onChange={(e) => updateField('bankinstitut', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Straße + Hausnummer</label>
              <Input value={form.strasse_hausnummer ?? ''} onChange={(e) => updateField('strasse_hausnummer', e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">PLZ</label>
                <Input value={form.plz ?? ''} onChange={(e) => updateField('plz', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ort</label>
                <Input value={form.ort ?? ''} onChange={(e) => updateField('ort', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Telefon</label>
                <Input value={form.telefon ?? ''} onChange={(e) => updateField('telefon', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Mobilnummer</label>
                <Input value={form.mobilnummer ?? ''} onChange={(e) => updateField('mobilnummer', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-Mail</label>
                <Input type="email" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Speichere …' : 'Speichern'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Fördermitglied löschen"
        description={`Soll „${member.vorname} ${member.nachname}" wirklich gelöscht werden?`}
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
