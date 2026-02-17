'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  testEmailTemplate,
  uploadTemplateAttachment,
  deleteTemplateAttachment,
  type EmailTemplate,
} from '@/lib/api/members';
import { getKreisverbande as getKvList } from '@/lib/api/kreisverband';
import type { Kreisverband } from '@/lib/api/kreisverband';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Plus, Pencil, Trash2, Send, Paperclip, X } from 'lucide-react';
import { SZENARIEN } from '@/lib/api/members';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const TYP_OPTIONS = [
  { value: 'mitglied', label: 'Mitglied' },
  { value: 'empfaenger', label: 'Empfänger (KV)' },
] as const;

export default function TemplatesPage() {
  const { hasMinRole } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [kvList, setKvList] = useState<Kreisverband[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<EmailTemplate | null>(null);
  const [testDialog, setTestDialog] = useState<EmailTemplate | null>(null);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentRemove, setAttachmentRemove] = useState(false);

  const [formName, setFormName] = useState('');
  const [formTyp, setFormTyp] = useState<'mitglied' | 'empfaenger'>('mitglied');
  const [formScenario, setFormScenario] = useState<string>(SZENARIEN[0].value);
  const [formKvId, setFormKvId] = useState<number | ''>('');
  const [formBetreff, setFormBetreff] = useState('');
  const [formInhalt, setFormInhalt] = useState('');

  useEffect(() => {
    if (!hasMinRole('leitung')) return;
    Promise.all([getEmailTemplates(), getKvList({ ist_aktiv: true })])
      .then(([t, kv]) => {
        setTemplates(t);
        setKvList(kv);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  const resetForm = () => {
    setFormName('');
    setFormTyp('mitglied');
    setFormScenario(SZENARIEN[0].value);
    setFormKvId('');
    setFormBetreff('');
    setFormInhalt('');
    setAttachmentFile(null);
    setAttachmentRemove(false);
    setEditingId(null);
    setShowForm(false);
  };

  const loadIntoForm = (t: EmailTemplate) => {
    setFormName(t.name);
    setFormTyp(t.typ as 'mitglied' | 'empfaenger');
    setFormScenario(t.scenario);
    setFormKvId(t.kreisverband_id ?? '');
    setFormBetreff(t.betreff);
    setFormInhalt(t.inhalt);
    setAttachmentFile(null);
    setAttachmentRemove(false);
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBetreff.trim() || !formInhalt.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      let templateId: number;
      if (editingId != null) {
        await updateEmailTemplate(editingId, {
          name: formName.trim(),
          typ: formTyp,
          scenario: formScenario,
          kreisverband_id: formKvId === '' ? null : Number(formKvId),
          betreff: formBetreff.trim(),
          inhalt: formInhalt.trim(),
        });
        templateId = editingId;
      } else {
        const created = await createEmailTemplate({
          name: formName.trim(),
          typ: formTyp,
          scenario: formScenario,
          kreisverband_id: formKvId === '' ? null : Number(formKvId),
          betreff: formBetreff.trim(),
          inhalt: formInhalt.trim(),
        });
        templateId = created.id;
      }
      if (attachmentRemove) {
        await deleteTemplateAttachment(templateId);
      }
      if (attachmentFile) {
        await uploadTemplateAttachment(templateId, attachmentFile);
      }
      resetForm();
      getEmailTemplates().then(setTemplates);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDialog || !testEmailTo.trim()) return;
    setError(null);
    setTestLoading(true);
    try {
      await testEmailTemplate(testDialog.id, testEmailTo.trim());
      setTestDialog(null);
      setTestEmailTo('');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Test-E-Mail fehlgeschlagen'));
    } finally {
      setTestLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setError(null);
    try {
      await deleteEmailTemplate(confirmDelete.id);
      setConfirmDelete(null);
      getEmailTemplates().then(setTemplates);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Löschen'));
    }
  };

  const kvName = (id: number | null | undefined) => {
    if (id == null) return 'Allgemein';
    return kvList.find((k) => k.id === id)?.name ?? `KV #${id}`;
  };

  if (!hasMinRole('leitung')) return null;

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/mitglieder" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-2 text-2xl font-semibold">E-Mail-Templates</h1>
      <p className="mb-4 text-muted-foreground">
        Vorlagen für E-Mails an Mitglieder und an Empfänger (Kreisvorstand). Platzhalter in geschweiften Klammern, z. B. {'{vorname}'}, {'{nachname}'}, {'{kreisverband}'}.
      </p>

      <Card className="mb-6 border-dashed bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Beispiel: So kann ein Template aussehen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Verfügbare Platzhalter: {'{vorname}'}, {'{nachname}'}, {'{email}'}, {'{mitgliedsnummer}'}, {'{kreisverband}'}, {'{kreis}'}, {'{kreisverband_alt}'}, {'{kreisverband_neu}'}, {'{telefon}'}, {'{strasse}'}, {'{hausnummer}'}, {'{plz}'}, {'{ort}'}, {'{geburtsdatum}'}, {'{bemerkung}'}, {'{scenario}'}, {'{eintrittsdatum}'}. Bei Empfänger-Templates zusätzlich: {'{empfaenger_name}'}, {'{vorsitzender}'}, {'{schatzmeister}'}. Für Änderungsanträge (Szenario „aenderungsantrag“, Typ „benachrichtigung“): {'{dokument_titel}'}, {'{antragsteller}'}, {'{antrag_text}'}, {'{begruendung}'}, {'{link}'}, {'{stellen_uebersicht}'}.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div>
            <p className="mb-1 font-medium">Typ: Mitglied · Szenario: Eintritt</p>
            <p className="mb-1 text-muted-foreground">Betreff:</p>
            <code className="block rounded bg-muted px-2 py-1">Willkommen bei den JuLis SH, {'{vorname}'}!</code>
            <p className="mt-2 text-muted-foreground">Inhalt (Auszug):</p>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-3 font-sans text-xs">
{`Hallo {vorname} {nachname},

willkommen im Kreisverband {kreisverband}! Dein Eintritt ist bei uns eingegangen.

Bei Fragen melde dich gern bei deinem Kreisvorstand.

JuLis Schleswig-Holstein`}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-medium">Typ: Empfänger (KV) · Szenario: Eintritt</p>
            <p className="mb-1 text-muted-foreground">Betreff:</p>
            <code className="block rounded bg-muted px-2 py-1">Mitgliederänderung: Neuer Eintritt in {'{kreisverband}'}</code>
            <p className="mt-2 text-muted-foreground">Inhalt (Auszug):</p>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-3 font-sans text-xs">
{`Hallo {empfaenger_name},

es gibt eine neue Mitgliederänderung (Eintritt):

Mitglied: {vorname} {nachname}
E-Mail: {email}
Kreisverband: {kreisverband}
Bemerkung: {bemerkung}

JuLis SH Intranet`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-6">
        <Button onClick={() => { resetForm(); setShowForm(true); }} variant={showForm ? 'outline' : 'default'}>
          <Plus className="mr-1 h-4 w-4" />
          {showForm ? 'Abbrechen' : 'Template anlegen'}
        </Button>

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-4 max-w-2xl space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="z. B. Eintritt – Mitglied"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Typ *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formTyp}
                  onChange={(e) => setFormTyp(e.target.value as 'mitglied' | 'empfaenger')}
                >
                  {TYP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Szenario *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formScenario}
                  onChange={(e) => setFormScenario(e.target.value)}
                >
                  {SZENARIEN.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Kreisverband</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formKvId}
                  onChange={(e) => setFormKvId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Allgemein (alle KVs)</option>
                  {kvList.map((kv) => (
                    <option key={kv.id} value={kv.id}>{kv.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Betreff *</label>
              <Input
                value={formBetreff}
                onChange={(e) => setFormBetreff(e.target.value)}
                placeholder="Betreffzeile, Platzhalter z. B. {{vorname}}"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Inhalt *</label>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formInhalt}
                onChange={(e) => setFormInhalt(e.target.value)}
                placeholder="E-Mail-Text mit Platzhaltern..."
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Anhang (optional)</label>
              {editingId != null && templates.find((x) => x.id === editingId)?.attachment_original_filename && !attachmentRemove && (
                <div className="mb-2 flex items-center gap-2 rounded border border-border bg-muted/30 px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span>{templates.find((x) => x.id === editingId)?.attachment_original_filename}</span>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setAttachmentRemove(true)}>
                    <X className="h-4 w-4" /> Entfernen
                  </Button>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.odt,.txt,.png,.jpg,.jpeg"
                className="w-full text-sm"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted-foreground">PDF, Word, Text, Bilder (max. 10 MB)</p>
            </div>
            <Button type="submit" disabled={submitting}>
              {editingId != null ? 'Speichern' : 'Anlegen'}
            </Button>
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Templates. Leitung kann welche anlegen.</p>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" />
                  {t.name}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t.typ === 'mitglied' ? 'Mitglied' : 'Empfänger'}</Badge>
                  <Badge variant="secondary">{SZENARIEN.find((s) => s.value === t.scenario)?.label ?? t.scenario}</Badge>
                  <Badge variant="secondary">{kvName(t.kreisverband_id)}</Badge>
                  {t.attachment_original_filename && (
                    <Badge variant="outline" className="gap-1">
                      <Paperclip className="h-3 w-3" /> {t.attachment_original_filename}
                    </Badge>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { setTestDialog(t); setTestEmailTo(''); setError(null); }} title="Test-E-Mail senden">
                    <Send className="mr-1 h-4 w-4" /> Test
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => loadIntoForm(t)} title="Bearbeiten">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(t)} title="Löschen" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-foreground">Betreff: {t.betreff}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.inhalt}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Template löschen?"
        description={confirmDelete ? `„${confirmDelete.name}" unwiderruflich löschen?` : ''}
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {testDialog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setTestDialog(null)} />
          <Card className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Test-E-Mail senden</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setTestDialog(null)}>×</Button>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Template „{testDialog.name}“ mit Beispieldaten (Platzhalter) an eine E-Mail-Adresse senden.
              </p>
              <form onSubmit={handleTestSend} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">E-Mail-Adresse *</label>
                  <Input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="empfaenger@beispiel.de"
                    required
                    disabled={testLoading}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={testLoading || !testEmailTo.trim()}>
                    {testLoading ? 'Wird gesendet …' : 'Test-E-Mail senden'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setTestDialog(null)}>Abbrechen</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
