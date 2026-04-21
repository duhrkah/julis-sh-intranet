'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getSupporterMembers,
  createSupporterMember,
  updateSupporterMember,
  deleteSupporterMember,
  exportSupporterMembersCSV,
  EXPORT_COLUMNS,
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
import Link from 'next/link';
import { Heart, Plus, Pencil, Trash2, Search, X, Eye, Download } from 'lucide-react';

const EXPORT_COLUMNS_STORAGE_KEY = 'foerdermitglieder_export_columns';

function loadSavedExportColumns(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(EXPORT_COLUMNS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((k): k is string => typeof k === 'string' && EXPORT_COLUMNS.some((c) => c.key === k));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

function saveExportColumns(cols: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPORT_COLUMNS_STORAGE_KEY, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
}

const EMPTY_FORM: SupporterMemberCreate = {
  geschlecht: 'männlich',
  titel: '',
  vorname: '',
  nachname: '',
  kreisverband_id: null,
  beitragshoehe: 25,
  verwendungszweck: '',
  iban: '',
  bankinstitut: '',
  strasse_hausnummer: '',
  plz: '',
  ort: '',
  telefon: '',
  mobilnummer: '',
  email: '',
};

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

export default function FoerdermitgliederPage() {
  const { hasMinRole } = useAuth();
  const [members, setMembers] = useState<SupporterMember[]>([]);
  const [kvList, setKvList] = useState<Kreisverband[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKv, setFilterKv] = useState<number | ''>('');
  const [filterStufe, setFilterStufe] = useState('');

  // Form dialog
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupporterMemberCreate>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<SupporterMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Export dialog
  const [showExport, setShowExport] = useState(false);
  const [exportColumns, setExportColumns] = useState<Set<string>>(
    () => new Set(EXPORT_COLUMNS.map((c) => c.key))
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSupporterMembers({
        kreisverband_id: filterKv || undefined,
        stufe: filterStufe || undefined,
        search: searchTerm || undefined,
      });
      setMembers(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Laden der Fördermitglieder'));
    }
  }, [filterKv, filterStufe, searchTerm]);

  useEffect(() => {
    if (!hasMinRole('leitung')) return;
    Promise.all([
      getSupporterMembers(),
      getKvList(),
    ])
      .then(([m, kv]) => {
        setMembers(m);
        setKvList(kv);
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  useEffect(() => {
    if (!loading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKv, filterStufe, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (m: SupporterMember) => {
    setEditingId(m.id);
    setForm({
      geschlecht: m.geschlecht,
      titel: m.titel ?? '',
      vorname: m.vorname,
      nachname: m.nachname,
      kreisverband_id: m.kreisverband_id ?? null,
      beitragshoehe: m.beitragshoehe,
      verwendungszweck: m.verwendungszweck ?? '',
      iban: m.iban ?? '',
      bankinstitut: m.bankinstitut ?? '',
      strasse_hausnummer: m.strasse_hausnummer ?? '',
      plz: m.plz ?? '',
      ort: m.ort ?? '',
      telefon: m.telefon ?? '',
      mobilnummer: m.mobilnummer ?? '',
      email: m.email ?? '',
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
      if (editingId) {
        await updateSupporterMember(editingId, payload);
      } else {
        await createSupporterMember(payload);
      }
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSupporterMember(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Fehler beim Löschen'));
    } finally {
      setDeleting(false);
    }
  };

  const updateField = <K extends keyof SupporterMemberCreate>(key: K, value: SupporterMemberCreate[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openExport = () => {
    const saved = loadSavedExportColumns();
    setExportColumns(new Set(saved ?? EXPORT_COLUMNS.map((c) => c.key)));
    setExportError(null);
    setShowExport(true);
  };

  const toggleExportColumn = (key: string) => {
    setExportColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const setAllExportColumns = (all: boolean) => {
    setExportColumns(all ? new Set(EXPORT_COLUMNS.map((c) => c.key)) : new Set());
  };

  const handleExport = async () => {
    if (exportColumns.size === 0) {
      setExportError('Bitte mindestens eine Spalte auswählen.');
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const cols = EXPORT_COLUMNS.map((c) => c.key).filter((k) => exportColumns.has(k));
      await exportSupporterMembersCSV({
        kreisverband_id: filterKv || undefined,
        stufe: filterStufe || undefined,
        search: searchTerm || undefined,
        columns: cols,
      });
      saveExportColumns(cols);
      setShowExport(false);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Export fehlgeschlagen'));
    } finally {
      setExporting(false);
    }
  };

  if (!hasMinRole('leitung')) return null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Fördermitglieder</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openExport}>
            <Download className="mr-1 h-4 w-4" />
            CSV-Export
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Neues Fördermitglied
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name oder E-Mail suchen…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterKv}
          onChange={(e) => setFilterKv(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Alle Kreisverbände</option>
          {kvList.map((kv) => (
            <option key={kv.id} value={kv.id}>{kv.name}</option>
          ))}
        </select>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterStufe}
          onChange={(e) => setFilterStufe(e.target.value)}
        >
          <option value="">Alle Stufen</option>
          {STUFEN.map((s) => (
            <option key={s.value} value={s.value}>{s.label} (ab {s.min} €)</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Fördermitglieder gefunden.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nr.</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Kreisverband</th>
                <th className="px-3 py-2 text-left font-medium">Stufe</th>
                <th className="px-3 py-2 text-right font-medium">Beitrag</th>
                <th className="px-3 py-2 text-left font-medium">E-Mail</th>
                <th className="px-3 py-2 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{m.id}</td>
                  <td className="px-3 py-2">
                    <Link href={`/foerdermitglieder/${m.id}`} className="text-primary hover:underline">
                      {m.titel ? `${m.titel} ` : ''}{m.vorname} {m.nachname}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.kreisverband_name ?? '–'}</td>
                  <td className="px-3 py-2">
                    <Badge variant={stufeBadgeVariant(m.stufe)}>{m.stufe}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(m.beitragshoehe).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                  </td>
                  <td className="px-3 py-2">
                    {m.email ? (
                      <a href={`mailto:${m.email}`} className="text-primary hover:underline">{m.email}</a>
                    ) : '–'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild title="Details">
                        <Link href={`/foerdermitglieder/${m.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)} title="Bearbeiten">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(m)} title="Löschen" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {members.length} Fördermitglied{members.length !== 1 ? 'er' : ''} angezeigt
      </p>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Fördermitglied bearbeiten' : 'Neues Fördermitglied'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal */}
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

            {/* Beitrag */}
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

            {/* Bank */}
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

            {/* Address */}
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

            {/* Contact */}
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
                {submitting ? 'Speichere …' : editingId ? 'Speichern' : 'Anlegen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fördermitglieder als CSV exportieren</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Der Export berücksichtigt die aktuell aktiven Filter. Wähle die Spalten aus, die enthalten sein sollen.
          </p>
          <div className="flex items-center gap-2 py-2 text-sm">
            <button
              type="button"
              onClick={() => setAllExportColumns(true)}
              className="text-primary hover:underline"
            >
              Alle auswählen
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setAllExportColumns(false)}
              className="text-primary hover:underline"
            >
              Alle abwählen
            </button>
            <span className="ml-auto text-muted-foreground">
              {exportColumns.size} / {EXPORT_COLUMNS.length} ausgewählt
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={exportColumns.has(col.key)}
                  onChange={() => toggleExportColumn(col.key)}
                  className="h-4 w-4 rounded border-input"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
          {exportError && <p className="text-sm text-destructive">{exportError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowExport(false)}>
              Abbrechen
            </Button>
            <Button type="button" onClick={handleExport} disabled={exporting || exportColumns.size === 0}>
              <Download className="mr-1 h-4 w-4" />
              {exporting ? 'Exportiere …' : 'Exportieren'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Fördermitglied löschen"
        description={deleteTarget ? `Soll „${deleteTarget.vorname} ${deleteTarget.nachname}" wirklich gelöscht werden?` : ''}
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
