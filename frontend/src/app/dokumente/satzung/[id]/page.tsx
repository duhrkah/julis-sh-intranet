'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getDocumentById,
  getAenderungsantraege,
  createAenderungsantrag,
  updateAenderungsantrag,
  deleteAenderungsantrag,
  createStelle,
  deleteStelle,
  sendAenderungsantragEmail,
  downloadAenderungsantragDocx,
  downloadAenderungsantragPdf,
  updateDocument,
  uploadDocumentFile,
  deleteDocument,
  type Document,
  type DocumentAenderungsantrag,
  type DocumentAenderung,
} from '@/lib/api/documents';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Plus, Trash2, Highlighter, Type, Save, Download, FileDown, Sparkles, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { diffToAenderungen, type ErkannteAenderung } from '@/lib/diffToAenderung';

const STATUS_LABEL: Record<string, string> = {
  eingereicht: 'Eingereicht',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
};

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { hasMinRole, isAdmin } = useAuth();
  const docTextRef = useRef<HTMLTextAreaElement>(null);

  const [doc, setDoc] = useState<Document | null>(null);
  const [docText, setDocText] = useState('');
  const [baselineDocText, setBaselineDocText] = useState('');
  const [docTextDirty, setDocTextDirty] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<ErkannteAenderung[] | null>(null);
  const [multiAntragsteller, setMultiAntragsteller] = useState('');
  const [multiTitel, setMultiTitel] = useState('');
  const [multiBegruendung, setMultiBegruendung] = useState('');
  const [multiSendEmails, setMultiSendEmails] = useState(false);
  const [submittingMulti, setSubmittingMulti] = useState(false);
  const [amendments, setAmendments] = useState<DocumentAenderungsantrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amendmentTitel, setAmendmentTitel] = useState('');
  const [antragsteller, setAntragsteller] = useState('');
  const [antragText, setAntragText] = useState('');
  const [alteFassung, setAlteFassung] = useState('');
  const [neueFassung, setNeueFassung] = useState('');
  const [begruendung, setBegruendung] = useState('');

  const [addStelleForId, setAddStelleForId] = useState<number | null>(null);
  const [newStelleBezug, setNewStelleBezug] = useState('');
  const [newStelleAlte, setNewStelleAlte] = useState('');
  const [newStelleNeue, setNewStelleNeue] = useState('');
  const [newStelleAenderungstext, setNewStelleAenderungstext] = useState('');
  const [exportLoading, setExportLoading] = useState<{ type: 'docx' | 'pdf'; antragId: number } | null>(null);
  const [emailSendingAntragId, setEmailSendingAntragId] = useState<number | null>(null);
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(false);
  const [confirmDeleteStelle, setConfirmDeleteStelle] = useState<{ antragId: number; stelleId: number } | null>(null);

  const canEdit = hasMinRole('leitung');

  useEffect(() => {
    if (!hasMinRole('vorstand') || !id) return;
    getDocumentById(id)
      .then((d) => {
        setDoc(d);
        const text = d.aktueller_text ?? '';
        setDocText(text);
        setBaselineDocText(text);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [id, hasMinRole]);

  useEffect(() => {
    if (!hasMinRole('vorstand') || !id) return;
    getAenderungsantraege(id)
      .then(setAmendments)
      .catch(() => setAmendments([]));
  }, [id, hasMinRole]);

  useEffect(() => {
    if (!detectedChanges?.length || detectedChanges.length <= 1) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetectedChanges(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detectedChanges]);

  const refreshAmendments = () => getAenderungsantraege(id).then(setAmendments);

  /** Antragstext aus Alte/Neue-Fassung ableiten, solange das Formular sichtbar ist (erkannter Typ). */
  useEffect(() => {
    if (!showForm) return;
    const v = antragstextAusStellen(alteFassung, neueFassung);
    if (v) setAntragText(v);
  }, [alteFassung, neueFassung, showForm]);

  /** Leitet aus alter/neuer Fassung die Änderungsart und einen Vorschlag für den Antragstext ab. */
  const antragstextAusStellen = (alte: string, neu: string): string => {
    const a = alte.trim();
    const n = neu.trim();
    const kurz = (s: string, max = 50) => (s.length <= max ? s : s.slice(0, max) + '…');
    if (a && !n) return `Streichung: ${kurz(a)}`;
    if (!a && n) return `Ergänzung: ${kurz(n)}`;
    if (a && n) return `Ersetzung: ${kurz(a)} → ${kurz(n)}`;
    return '';
  };

  const handleUseSelection = () => {
    const ta = docTextRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end).trim();
    if (selected) {
      setAlteFassung(selected);
      setNeueFassung('');
      setAntragText(antragstextAusStellen(selected, ''));
      setShowForm(true);
      setError(null);
    } else {
      setError('Bitte zuerst Text im Dokument auswählen.');
    }
  };

  const handleErgaenzen = () => {
    setAlteFassung('');
    setNeueFassung('');
    setAntragText('Ergänzung: ');
    setShowForm(true);
  };

  const handleSaveDocText = async () => {
    if (!doc || !canEdit) return;
    setSavingDoc(true);
    setError(null);
    try {
      const updated = await updateDocument(id, { aktueller_text: docText });
      setDoc(updated);
      const text = updated.aktueller_text ?? '';
      setDocText(text);
      setBaselineDocText(text);
      setDocTextDirty(false);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSavingDoc(false);
    }
  };

  const handleCreateAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!antragsteller.trim() || !antragText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createAenderungsantrag(id, {
        titel: amendmentTitel.trim() || undefined,
        antragsteller: antragsteller.trim(),
        antrag_text: antragText.trim(),
        alte_fassung: alteFassung.trim() || undefined,
        neue_fassung: neueFassung.trim() || undefined,
        begruendung: begruendung.trim() || undefined,
      }, { send_emails: sendEmailOnCreate });
      setAmendmentTitel('');
      setAntragsteller('');
      setAntragText('');
      setAlteFassung('');
      setNeueFassung('');
      setBegruendung('');
      setShowForm(false);
      refreshAmendments();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStelle = async (e: React.FormEvent, antragId: number) => {
    e.preventDefault();
    setError(null);
    try {
      await createStelle(antragId, {
        position: (amendments.find((a) => a.id === antragId)?.stellen?.length ?? 0),
        bezug: newStelleBezug.trim() || undefined,
        alte_fassung: newStelleAlte.trim() || undefined,
        neue_fassung: newStelleNeue.trim() || undefined,
        aenderungstext: newStelleAenderungstext.trim() || undefined,
      });
      setAddStelleForId(null);
      setNewStelleBezug('');
      setNewStelleAlte('');
      setNewStelleNeue('');
      setNewStelleAenderungstext('');
      refreshAmendments();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Stelle hinzufügen fehlgeschlagen'));
    }
  };

  const handleDeleteStelleConfirm = async () => {
    if (!confirmDeleteStelle) return;
    try {
      await deleteStelle(confirmDeleteStelle.antragId, confirmDeleteStelle.stelleId);
      setConfirmDeleteStelle(null);
      refreshAmendments();
    } catch {
      setError('Stelle konnte nicht gelöscht werden.');
    }
  };

  const handleExportDocx = async (antragId: number) => {
    setExportLoading({ type: 'docx', antragId });
    setError(null);
    try {
      await downloadAenderungsantragDocx(antragId);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'DOCX-Export fehlgeschlagen'));
    } finally {
      setExportLoading(null);
    }
  };

  const handleExportPdf = async (antragId: number) => {
    setExportLoading({ type: 'pdf', antragId });
    setError(null);
    try {
      await downloadAenderungsantragPdf(antragId);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'PDF-Export fehlgeschlagen'));
    } finally {
      setExportLoading(null);
    }
  };

  const handleSendAmendmentEmail = async (antragId: number) => {
    setEmailSendingAntragId(antragId);
    setError(null);
    try {
      await sendAenderungsantragEmail(antragId);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'E-Mail-Versand fehlgeschlagen'));
    } finally {
      setEmailSendingAntragId(null);
    }
  };

  const hasDocTextChanges = docText.trim() !== baselineDocText.trim();

  const handleUebernehmenAusBearbeitung = () => {
    const changes = diffToAenderungen(baselineDocText, docText);
    setError(null);
    if (changes.length === 0) {
      setError('Keine Änderungen zwischen gespeichertem und bearbeitetem Text erkannt.');
      return;
    }
    if (changes.length === 1) {
      const c = changes[0];
      setAntragText(c.antragstext);
      setAlteFassung(c.alte_fassung);
      setNeueFassung(c.neue_fassung);
      setAmendmentTitel('');
      setAntragsteller('');
      setBegruendung('');
      setShowForm(true);
      setDetectedChanges(null);
      return;
    }
    setDetectedChanges(changes);
    setMultiAntragsteller('');
    setMultiTitel('');
    setMultiBegruendung('');
    setMultiSendEmails(false);
  };

  const handleCreateMultiStellenAntrag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detectedChanges?.length || !multiAntragsteller.trim()) return;
    setSubmittingMulti(true);
    setError(null);
    try {
      const antragText =
        detectedChanges.length === 1
          ? detectedChanges[0].antragstext
          : `Mehrere Änderungen (${detectedChanges.length} Stellen, automatisch erkannt)`;
      const created = await createAenderungsantrag(id, {
        titel: multiTitel.trim() || undefined,
        antragsteller: multiAntragsteller.trim(),
        antrag_text: antragText,
        begruendung: multiBegruendung.trim() || undefined,
        alte_fassung: undefined,
        neue_fassung: undefined,
      }, { send_emails: multiSendEmails });
      for (let i = 0; i < detectedChanges.length; i++) {
        const c = detectedChanges[i];
        await createStelle(created.id, {
          position: i,
          bezug: undefined,
          alte_fassung: c.alte_fassung || undefined,
          neue_fassung: c.neue_fassung || undefined,
          aenderungstext: c.aenderungstext || undefined,
        });
      }
      setDetectedChanges(null);
      setBaselineDocText(docText);
      refreshAmendments();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Antrag anlegen fehlgeschlagen'));
    } finally {
      setSubmittingMulti(false);
    }
  };

  const handleStatusChange = async (amendmentId: number, status: string) => {
    try {
      await updateAenderungsantrag(amendmentId, { status });
      refreshAmendments();
    } catch {
      setError('Fehler beim Aktualisieren');
    }
  };

  const [deleting, setDeleting] = useState(false);
  const [confirmAmendment, setConfirmAmendment] = useState<{ open: boolean; amendmentId: number | null }>({ open: false, amendmentId: null });
  const [confirmDocument, setConfirmDocument] = useState(false);

  const handleDeleteAmendment = async (amendmentId: number) => {
    setConfirmAmendment({ open: true, amendmentId });
  };
  const handleConfirmDeleteAmendment = async () => {
    if (confirmAmendment.amendmentId == null) return;
    try {
      await deleteAenderungsantrag(confirmAmendment.amendmentId);
      refreshAmendments();
      setConfirmAmendment({ open: false, amendmentId: null });
    } catch {
      setError('Fehler beim Löschen');
    }
  };

  const handleDeleteDocument = async () => {
    setConfirmDocument(true);
  };
  const handleConfirmDeleteDocument = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(id);
      setConfirmDocument(false);
      router.push('/dokumente/satzung');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler beim Löschen'));
    } finally {
      setDeleting(false);
    }
  };

  if (!hasMinRole('vorstand')) return null;

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Lade …</p>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/dokumente/satzung">Zurück</Link>
        </Button>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="p-6">
      <ConfirmDialog
        open={confirmAmendment.open}
        onOpenChange={(open) => setConfirmAmendment((p) => ({ ...p, open, amendmentId: open ? p.amendmentId : null }))}
        title="Änderungsantrag löschen?"
        description="Dieser Änderungsantrag wird unwiderruflich gelöscht."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleConfirmDeleteAmendment}
      />
      <ConfirmDialog
        open={!!confirmDeleteStelle}
        onOpenChange={(open) => !open && setConfirmDeleteStelle(null)}
        title="Stelle löschen?"
        description="Diese Änderungsstelle wird entfernt."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDeleteStelleConfirm}
      />
      <ConfirmDialog
        open={confirmDocument}
        onOpenChange={setConfirmDocument}
        title="Dokument löschen?"
        description="Dokument unwiderruflich löschen? Alle zugehörigen Änderungsanträge werden mitgelöscht."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleConfirmDeleteDocument}
        loading={deleting}
      />
      {detectedChanges && detectedChanges.length > 1 && (
        <Card className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Antrag mit mehreren Stellen anlegen</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setDetectedChanges(null)}>×</Button>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Es wurden {detectedChanges.length} Änderungen erkannt (Streichung / Ergänzung / Ersetzung). Ein Antrag mit {detectedChanges.length} Stellen wird angelegt.
            </p>
            <form onSubmit={handleCreateMultiStellenAntrag} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Antragsteller *</label>
                <Input
                  value={multiAntragsteller}
                  onChange={(e) => setMultiAntragsteller(e.target.value)}
                  placeholder="Name"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Titel (optional)</label>
                <Input
                  value={multiTitel}
                  onChange={(e) => setMultiTitel(e.target.value)}
                  placeholder="z. B. 2. Änderung der Satzung"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Begründung (optional)</label>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={multiBegruendung}
                  onChange={(e) => setMultiBegruendung(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border bg-muted/30 p-2 text-xs">
                {detectedChanges.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <Badge variant="secondary" className="shrink-0 capitalize">{c.typ}</Badge>
                    <span className="truncate text-muted-foreground">{c.antragstext}</span>
                  </div>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={multiSendEmails}
                  onChange={(e) => setMultiSendEmails(e.target.checked)}
                  className="rounded border-input"
                />
                E-Mail an Benachrichtigungsempfänger senden
              </label>
              <div className="flex gap-2">
                <Button type="submit" disabled={submittingMulti}>
                  {submittingMulti ? 'Wird angelegt …' : `Antrag mit ${detectedChanges.length} Stellen anlegen`}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDetectedChanges(null)}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {detectedChanges && detectedChanges.length > 1 && (
        <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setDetectedChanges(null)} />
      )}
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/dokumente/satzung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">{doc.titel}</h1>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">{doc.typ === 'satzung' ? 'Satzung' : 'Geschäftsordnung'}</Badge>
              {doc.version && <span className="text-sm text-muted-foreground">Version: {doc.version}</span>}
              {doc.gueltig_ab && (
                <span className="text-sm text-muted-foreground">
                  gültig ab: {format(new Date(doc.gueltig_ab), 'd. MMM yyyy', { locale: de })}
                </span>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button variant="destructive" size="sm" onClick={handleDeleteDocument} disabled={deleting}>
            {deleting ? 'Löschen …' : 'Dokument löschen'}
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Dokumenttext</CardTitle>
          <CardDescription>
            Text direkt bearbeiten. Mit „Änderungen als Antrag übernehmen“ erkennt das System automatisch Streichungen, Ergänzungen und Ersetzungen und erzeugt den Antragstext. Alternativ: Text auswählen → Art wählen → „Auswahl für Antrag“.
          </CardDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canEdit && hasDocTextChanges && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={handleUebernehmenAusBearbeitung}
                className="bg-primary"
              >
                <Sparkles className="mr-1 h-4 w-4" />
                Änderungen als Antrag übernehmen
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={handleUseSelection} title="Markierten Text als alte Fassung übernehmen (Streichung oder Ersetzung)">
              <Highlighter className="mr-1 h-4 w-4" />
              Auswahl für Antrag
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleErgaenzen} title="Antrag nur mit neuer Fassung (Ergänzung)">
              <Type className="mr-1 h-4 w-4" />
              Nur Ergänzung
            </Button>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                variant={docTextDirty ? 'default' : 'outline'}
                onClick={handleSaveDocText}
                disabled={savingDoc || !docTextDirty}
              >
                <Save className="mr-1 h-4 w-4" />
                {savingDoc ? 'Speichern …' : 'Text speichern'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            ref={docTextRef}
            className="min-h-[280px] w-full resize-y rounded-md border border-input bg-muted/30 p-4 font-mono text-sm leading-relaxed focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={docText}
            onChange={(e) => {
              setDocText(e.target.value);
              setDocTextDirty(true);
            }}
            readOnly={!canEdit}
            placeholder={canEdit ? 'Dokumenttext hier eingeben oder bearbeiten …' : 'Kein Text vorhanden.'}
            spellCheck={true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">Änderungsanträge</CardTitle>
          <Button
            size="sm"
            variant={showForm ? 'outline' : 'default'}
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="mr-1 h-4 w-4" />
            {showForm ? 'Abbrechen' : 'Antrag hinzufügen'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleCreateAmendment} className="mb-6 space-y-4 rounded-md border border-border bg-muted/30 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Titel (optional)</label>
                <Input
                  value={amendmentTitel}
                  onChange={(e) => setAmendmentTitel(e.target.value)}
                  placeholder="z. B. 2. Änderung der Satzung"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Antragsteller *</label>
                <Input
                  value={antragsteller}
                  onChange={(e) => setAntragsteller(e.target.value)}
                  placeholder="Name"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Antrag (Kurzbeschreibung) *</label>
                <Input
                  value={antragText}
                  onChange={(e) => setAntragText(e.target.value)}
                  placeholder="z. B. Änderung § 3 Abs. 2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Alte Fassung (wird gestrichen oder ersetzt)</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={alteFassung}
                  onChange={(e) => setAlteFassung(e.target.value)}
                  placeholder="Auswahl aus dem Dokument oder manuell eingeben. Bei reiner Ergänzung leer lassen."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Neue Fassung (Ersatztext bzw. Ergänzung)</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={neueFassung}
                  onChange={(e) => setNeueFassung(e.target.value)}
                  placeholder="Bei Streichung leer lassen. Bei Ersetzen: neuer Text. Bei Ergänzung: einzufügender Text."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Begründung</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={begruendung}
                  onChange={(e) => setBegruendung(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendEmailOnCreate}
                  onChange={(e) => setSendEmailOnCreate(e.target.checked)}
                  className="rounded border-input"
                />
                E-Mail an Benachrichtigungsempfänger senden
              </label>
              <Button type="submit" disabled={submitting}>Speichern</Button>
            </form>
          )}

          {amendments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Änderungsanträge.</p>
          ) : (
            <ul className="space-y-3">
              {amendments.map((a) => {
                const stellen = (a.stellen ?? []).slice().sort((x, y) => x.position - y.position || x.id - y.id);
                const hasLegacy = !stellen.length && (a.alte_fassung || a.neue_fassung);
                return (
                  <li key={a.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        {a.titel && <p className="font-medium text-foreground">{a.titel}</p>}
                        <p className="font-medium">{a.antragsteller}</p>
                        <p className="text-sm text-muted-foreground">{a.antrag_text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(a.created_at), 'd. MMM yyyy', { locale: de })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportDocx(a.id)}
                          disabled={exportLoading !== null}
                        >
                          <FileDown className="mr-1 h-4 w-4" />
                          {exportLoading?.type === 'docx' && exportLoading?.antragId === a.id ? '…' : 'DOCX'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportPdf(a.id)}
                          disabled={exportLoading !== null}
                        >
                          <Download className="mr-1 h-4 w-4" />
                          {exportLoading?.type === 'pdf' && exportLoading?.antragId === a.id ? '…' : 'PDF'}
                        </Button>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendAmendmentEmail(a.id)}
                            disabled={emailSendingAntragId !== null}
                            title="E-Mail-Benachrichtigung an konfigurierte Empfänger senden"
                          >
                            <Mail className="mr-1 h-4 w-4" />
                            {emailSendingAntragId === a.id ? '…' : 'E-Mail'}
                          </Button>
                        )}
                        <Badge variant={a.status === 'angenommen' ? 'default' : a.status === 'abgelehnt' ? 'destructive' : 'secondary'}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                        {canEdit && (
                          <>
                            <select
                              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={a.status}
                              onChange={(e) => handleStatusChange(a.id, e.target.value)}
                            >
                              <option value="eingereicht">Eingereicht</option>
                              <option value="angenommen">Angenommen</option>
                              <option value="abgelehnt">Abgelehnt</option>
                            </select>
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDeleteAmendment(a.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {/* Stellen (mehrere Änderungen) */}
                    {stellen.length > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Änderungsstellen</p>
                        <ul className="space-y-2">
                          {stellen.map((s) => (
                            <li key={s.id} className="rounded bg-muted/40 p-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                {s.bezug && <span className="font-medium">{s.bezug}</span>}
                                {isAdmin && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => setConfirmDeleteStelle({ antragId: a.id, stelleId: s.id })}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              {(s.alte_fassung || s.neue_fassung) && (
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {s.alte_fassung && (
                                    <div>
                                      <span className="text-muted-foreground">Alte Fassung: </span>
                                      <pre className="mt-0.5 whitespace-pre-wrap rounded bg-muted/50 p-1.5 text-xs">{s.alte_fassung}</pre>
                                    </div>
                                  )}
                                  {s.neue_fassung && (
                                    <div>
                                      <span className="text-muted-foreground">Neue Fassung: </span>
                                      <pre className="mt-0.5 whitespace-pre-wrap rounded bg-muted/50 p-1.5 text-xs">{s.neue_fassung}</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                              {s.aenderungstext && (
                                <p className="mt-1.5 text-xs text-muted-foreground">Änderungstext: {s.aenderungstext}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                        {canEdit && (
                          <>
                            {addStelleForId === a.id ? (
                              <form onSubmit={(e) => handleAddStelle(e, a.id)} className="mt-3 space-y-2 rounded border border-dashed border-border p-3">
                                <Input
                                  placeholder="Bezug (z. B. § 3 Abs. 2)"
                                  value={newStelleBezug}
                                  onChange={(e) => setNewStelleBezug(e.target.value)}
                                  className="text-sm"
                                />
                                <textarea
                                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="Alte Fassung"
                                  value={newStelleAlte}
                                  onChange={(e) => setNewStelleAlte(e.target.value)}
                                />
                                <textarea
                                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="Neue Fassung"
                                  value={newStelleNeue}
                                  onChange={(e) => setNewStelleNeue(e.target.value)}
                                />
                                <textarea
                                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="Änderungstext (gesetzesgleich, optional)"
                                  value={newStelleAenderungstext}
                                  onChange={(e) => setNewStelleAenderungstext(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm">Stelle speichern</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => setAddStelleForId(null)}>Abbrechen</Button>
                                </div>
                              </form>
                            ) : (
                              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setAddStelleForId(a.id)}>
                                <Plus className="mr-1 h-4 w-4" />
                                Stelle hinzufügen
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {/* Legacy: eine Stelle aus dem Antrag */}
                    {hasLegacy && (
                      <div className="mt-3 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
                        {a.alte_fassung && (
                          <div>
                            <p className="font-medium text-muted-foreground">Alte Fassung</p>
                            <pre className="whitespace-pre-wrap rounded bg-muted/50 p-2">{a.alte_fassung}</pre>
                          </div>
                        )}
                        {a.neue_fassung && (
                          <div>
                            <p className="font-medium text-muted-foreground">Neue Fassung</p>
                            <pre className="whitespace-pre-wrap rounded bg-muted/50 p-2">{a.neue_fassung}</pre>
                          </div>
                        )}
                        {canEdit && (
                          <div className="sm:col-span-2">
                            {addStelleForId === a.id ? (
                              <form onSubmit={(e) => handleAddStelle(e, a.id)} className="mt-3 space-y-2 rounded border border-dashed border-border p-3">
                                <Input
                                  placeholder="Bezug (z. B. § 3 Abs. 2)"
                                  value={newStelleBezug}
                                  onChange={(e) => setNewStelleBezug(e.target.value)}
                                  className="text-sm"
                                />
                                <textarea
                                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="Alte Fassung"
                                  value={newStelleAlte}
                                  onChange={(e) => setNewStelleAlte(e.target.value)}
                                />
                                <textarea
                                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="Neue Fassung"
                                  value={newStelleNeue}
                                  onChange={(e) => setNewStelleNeue(e.target.value)}
                                />
                                <textarea
                                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="Änderungstext (gesetzesgleich, z. B. Die Wörter „e. V.“ werden eingefügt.)"
                                  value={newStelleAenderungstext}
                                  onChange={(e) => setNewStelleAenderungstext(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm">Stelle speichern</Button>
                                  <Button type="button" size="sm" variant="outline" onClick={() => setAddStelleForId(null)}>Abbrechen</Button>
                                </div>
                              </form>
                            ) : (
                              <Button type="button" variant="outline" size="sm" onClick={() => setAddStelleForId(a.id)}>
                                <Plus className="mr-1 h-4 w-4" />
                                Weitere Stelle hinzufügen
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {stellen.length === 0 && !hasLegacy && canEdit && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => setAddStelleForId(a.id)}>
                          <Plus className="mr-1 h-4 w-4" />
                          Stelle hinzufügen
                        </Button>
                      </div>
                    )}
                    {a.begruendung && (
                      <p className="mt-2 text-sm text-muted-foreground">Begründung: {a.begruendung}</p>
                    )}
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
