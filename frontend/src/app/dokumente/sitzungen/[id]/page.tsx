'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getMeetingById,
  generateInvitation,
  generateProtocol,
  updateMeeting,
  deleteMeeting,
  getLeafCount,
  getNodeCount,
  getNodesInOrder,
  getTeilnehmerOptionen,
  downloadInvitationPdf,
  downloadProtocolPdf,
  EINLADUNG_EMPFAENGER_LANDESVORSTAND,
  EINLADUNG_EMPFAENGER_ERWEITERTER_LANDESVORSTAND,
  type Meeting,
  type Tagesordnungspunkt,
  type EinladungVariante,
} from '@/lib/api/meetings';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Calendar, FileText, Mail, ClipboardList, Users, Plus, Trash2, Download, FilePlus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') || 'http://localhost:8000';

function normalizeTop(item: string | Tagesordnungspunkt): Tagesordnungspunkt {
  if (typeof item === 'string') return { titel: item, unterpunkte: [] };
  const kids = item?.unterpunkte;
  return {
    titel: item?.titel ?? '',
    unterpunkte: Array.isArray(kids)
      ? kids.map((u) => (typeof u === 'string' ? { titel: u, unterpunkte: [] } : normalizeTop(u)))
      : [],
  };
}

const defaultTop = (): Tagesordnungspunkt => ({ titel: '', unterpunkte: [] });

function setTitelAtPath(tops: Tagesordnungspunkt[], path: number[], value: string): Tagesordnungspunkt[] {
  if (path.length === 0) return tops;
  const [i, ...rest] = path;
  if (rest.length === 0) return tops.map((t, idx) => (idx === i ? { ...t, titel: value } : t));
  return tops.map((t, idx) =>
    idx === i ? { ...t, unterpunkte: setTitelAtPath(t.unterpunkte ?? [], rest, value) } : t
  );
}
function addChildAtPath(tops: Tagesordnungspunkt[], path: number[]): Tagesordnungspunkt[] {
  const empty: Tagesordnungspunkt = { titel: '', unterpunkte: [] };
  if (path.length === 0) return [...tops, empty];
  const [i, ...rest] = path;
  if (rest.length === 0) {
    return tops.map((t, idx) => (idx === i ? { ...t, unterpunkte: [...(t.unterpunkte ?? []), empty] } : t));
  }
  return tops.map((t, idx) =>
    idx === i ? { ...t, unterpunkte: addChildAtPath(t.unterpunkte ?? [], rest) } : t
  );
}
function removeAtPath(tops: Tagesordnungspunkt[], path: number[]): Tagesordnungspunkt[] {
  if (path.length === 0) return tops;
  const [i, ...rest] = path;
  if (rest.length === 0) return tops.filter((_, idx) => idx !== i);
  return tops.map((t, idx) =>
    idx === i ? { ...t, unterpunkte: removeAtPath(t.unterpunkte ?? [], rest) } : t
  );
}
function normalizeForApi(node: Tagesordnungspunkt): Tagesordnungspunkt {
  const kids = (node.unterpunkte ?? []).map(normalizeForApi).filter((n) => n.titel.trim());
  return { titel: node.titel.trim(), unterpunkte: kids.length ? kids : undefined };
}

function TagesordnungNode({
  node,
  path,
  pathLabel,
  onTitelChange,
  onAddChild,
  onRemove,
  canRemove,
  depth,
}: {
  node: Tagesordnungspunkt;
  path: number[];
  pathLabel: string;
  onTitelChange: (path: number[], value: string) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  canRemove: boolean;
  depth: number;
}) {
  const children = node.unterpunkte ?? [];
  return (
    <div className="mb-2" style={{ marginLeft: depth * 20 }}>
      <div className="flex gap-2">
        <span className="w-10 shrink-0 pt-2 text-xs text-muted-foreground">{pathLabel}</span>
        <Input
          value={node.titel}
          onChange={(e) => onTitelChange(path, e.target.value)}
          placeholder={depth === 0 ? 'Titel Tagesordnungspunkt' : 'Unterpunkt'}
          className="flex-1 text-sm"
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(path)} disabled={!canRemove} className="shrink-0 text-destructive">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="mt-1">
        {children.map((child, idx) => (
          <TagesordnungNode
            key={idx}
            node={child}
            path={[...path, idx]}
            pathLabel={`${pathLabel}.${idx + 1}`}
            onTitelChange={onTitelChange}
            onAddChild={onAddChild}
            onRemove={onRemove}
            canRemove
            depth={depth + 1}
          />
        ))}
        <Button type="button" variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => onAddChild(path)}>
          <Plus className="mr-1 h-3 w-3" /> Unterpunkt
        </Button>
      </div>
    </div>
  );
}

export default function SitzungDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { hasMinRole } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'einladung' | 'protokoll' | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState<'einladung' | 'protokoll' | null>(null);
  const [savingRahmen, setSavingRahmen] = useState(false);
  const [savingEinladung, setSavingEinladung] = useState(false);
  const [savingTeilnehmer, setSavingTeilnehmer] = useState(false);
  const [savingProtokoll, setSavingProtokoll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteMeeting, setConfirmDeleteMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editDatum, setEditDatum] = useState('');
  const [editUhrzeit, setEditUhrzeit] = useState('');
  const [editOrt, setEditOrt] = useState('');
  const [editTitelKurz, setEditTitelKurz] = useState('');
  const [editTeilnehmer, setEditTeilnehmer] = useState('');
  const [editTeilnehmerSonstige, setEditTeilnehmerSonstige] = useState('');
  const [editSitzungsleitung, setEditSitzungsleitung] = useState('');
  const [editProtokollfuehrer, setEditProtokollfuehrer] = useState('');
  const [editEinladungVariante, setEditEinladungVariante] = useState<EinladungVariante>('freitext');
  const [editEinladungEmpfaengerFreitext, setEditEinladungEmpfaengerFreitext] = useState('');
  const [teilnehmerOptionen, setTeilnehmerOptionen] = useState<string[]>([]);
  const [editTeilnehmerEingeladeneAuswahl, setEditTeilnehmerEingeladeneAuswahl] = useState<string[]>([]);
  const [editTagesordnung, setEditTagesordnung] = useState<Tagesordnungspunkt[]>([]);
  /** Pro TOP ein Array: ein Eintrag pro Knoten (TOP + jeder Unterpunkt) in Tiefenreihenfolge */
  const [protokollTexte, setProtokollTexte] = useState<string[][]>([]);

  const normalizedTagesordnung = useMemo(() => {
    const raw = meeting?.tagesordnung;
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeTop);
  }, [meeting?.tagesordnung]);

  useEffect(() => {
    if (!hasMinRole('mitarbeiter') || !id) return;
    getMeetingById(id)
      .then(setMeeting)
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [id, hasMinRole]);

  useEffect(() => {
    if (!meeting) return;
    setEditDatum(meeting.datum ? meeting.datum.slice(0, 10) : '');
    setEditUhrzeit(meeting.uhrzeit ? String(meeting.uhrzeit).slice(0, 5) : '');
    setEditOrt(meeting.ort ?? '');
    setEditTitelKurz(meeting.titel_kurz ?? '');
    setEditTeilnehmer(meeting.teilnehmer ?? '');
    setEditTeilnehmerSonstige(meeting.teilnehmer_sonstige ?? '');
    setEditSitzungsleitung(meeting.sitzungsleitung ?? '');
    setEditProtokollfuehrer(meeting.protokollfuehrer ?? '');
    const variante = meeting.einladung_variante as EinladungVariante | undefined;
    setEditEinladungVariante(variante === 'landesvorstand' || variante === 'erweiterter_landesvorstand' ? variante : 'freitext');
    setEditEinladungEmpfaengerFreitext(meeting.einladung_empfaenger_freitext ?? '');
    setEditTeilnehmerEingeladeneAuswahl(Array.isArray(meeting.teilnehmer_eingeladene_auswahl) ? meeting.teilnehmer_eingeladene_auswahl : []);
    const tos = normalizedTagesordnung.length ? normalizedTagesordnung : [defaultTop()];
    setEditTagesordnung(tos);
    const pt = meeting.protokoll_top_texte;
    if (!Array.isArray(pt)) {
      setProtokollTexte(tos.map((top) => Array(getNodeCount(top)).fill('')));
      return;
    }
    const next: string[][] = tos.map((top, i) => {
      const raw = pt[i];
      const arr = Array.isArray(raw) ? raw : [raw ?? ''];
      const nodeCount = getNodeCount(top);
      const leafCount = getLeafCount(top);
      if (arr.length >= nodeCount) return arr.slice(0, nodeCount).map((s) => String(s ?? ''));
      if (arr.length === leafCount) {
        const nodes = getNodesInOrder(top, String(i + 1));
        let leafIdx = 0;
        return nodes.map((node) => (node.isLeaf ? (arr[leafIdx++] ?? '') : ''));
      }
      return Array.from({ length: nodeCount }, (_, j) => arr[j] ?? '');
    });
    setProtokollTexte(next.length ? next : [['']]);
  }, [meeting?.id, meeting?.datum, meeting?.uhrzeit, meeting?.ort, meeting?.titel_kurz, meeting?.tagesordnung, meeting?.protokoll_top_texte, meeting?.einladung_variante, meeting?.einladung_empfaenger_freitext, meeting?.teilnehmer_eingeladene_auswahl, meeting?.teilnehmer_sonstige, meeting?.sitzungsleitung, meeting?.protokollfuehrer, normalizedTagesordnung]);

  useEffect(() => {
    if (editEinladungVariante === 'freitext') {
      setTeilnehmerOptionen([]);
      return;
    }
    getTeilnehmerOptionen(editEinladungVariante)
      .then((opts) => {
        setTeilnehmerOptionen(opts);
        setEditTeilnehmerEingeladeneAuswahl((prev) => prev.filter((v) => opts.includes(v)));
      })
      .catch(() => setTeilnehmerOptionen([]));
  }, [editEinladungVariante]);

  const syncProtokollToNodes = (tops: Tagesordnungspunkt[], prev: string[][]) => {
    return tops.map((top, i) => {
      const n = getNodeCount(top);
      const arr = prev[i] ?? [];
      if (arr.length === n) return arr;
      return Array.from({ length: n }, (_, j) => arr[j] ?? '');
    });
  };

  const addEditTop = () => {
    setEditTagesordnung((prev) => [...prev, defaultTop()]);
    setProtokollTexte((prev) => [...prev, ['']]);
  };
  const handleTitelChange = (path: number[], value: string) => {
    setEditTagesordnung((prev) => setTitelAtPath(prev, path, value));
  };
  const handleAddChild = (path: number[]) => {
    setEditTagesordnung((prev) => {
      const next = addChildAtPath(prev, path);
      setProtokollTexte((p) => syncProtokollToNodes(next, p));
      return next;
    });
  };
  const handleRemove = (path: number[]) => {
    setEditTagesordnung((prev) => {
      const next = removeAtPath(prev, path);
      setProtokollTexte((p) => syncProtokollToNodes(next, p));
      return next;
    });
  };

  const setProtokollText = (topIndex: number, nodeIndex: number, value: string) =>
    setProtokollTexte((prev) => {
      const next = prev.map((arr) => [...arr]);
      while (next.length <= topIndex) next.push([]);
      const arr = [...(next[topIndex] ?? [])];
      while (arr.length <= nodeIndex) arr.push('');
      arr[nodeIndex] = value;
      next[topIndex] = arr;
      return next;
    });

  const handleSaveRahmendaten = async () => {
    if (!meeting) return;
    setSavingRahmen(true);
    setError(null);
    try {
      const updated = await updateMeeting(meeting.id, {
        datum: editDatum || undefined,
        uhrzeit: editUhrzeit || undefined,
        ort: editOrt.trim() || undefined,
        titel_kurz: editTitelKurz.trim() || undefined,
      });
      setMeeting(updated);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Speichern fehlgeschlagen'));
    } finally {
      setSavingRahmen(false);
    }
  };

  const handleSaveEinladung = async () => {
    if (!meeting) return;
    setSavingEinladung(true);
    setError(null);
    const tops = editTagesordnung.map(normalizeForApi).filter((t) => t.titel);
    try {
      const updated = await updateMeeting(meeting.id, {
        tagesordnung: tops.length ? tops : undefined,
        einladung_variante: editEinladungVariante,
        einladung_empfaenger_freitext: editEinladungVariante === 'freitext' ? (editEinladungEmpfaengerFreitext.trim() || undefined) : undefined,
      });
      setMeeting(updated);
      const nextTops = tops.length ? tops : [defaultTop()];
      setEditTagesordnung(nextTops);
      setProtokollTexte((prev) => syncProtokollToNodes(nextTops, prev));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Speichern fehlgeschlagen'));
    } finally {
      setSavingEinladung(false);
    }
  };

  const handleSaveTeilnehmer = async () => {
    if (!meeting) return;
    setSavingTeilnehmer(true);
    setError(null);
    try {
      const updated = await updateMeeting(meeting.id, {
        teilnehmer: editTeilnehmer.trim() || undefined,
        teilnehmer_sonstige: editTeilnehmerSonstige.trim() || undefined,
        sitzungsleitung: editSitzungsleitung.trim() || undefined,
        protokollfuehrer: editProtokollfuehrer.trim() || undefined,
        teilnehmer_eingeladene_auswahl:
          editTeilnehmerEingeladeneAuswahl.length > 0 ? editTeilnehmerEingeladeneAuswahl : undefined,
      });
      setMeeting(updated);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Speichern fehlgeschlagen'));
    } finally {
      setSavingTeilnehmer(false);
    }
  };

  const handleSaveProtokoll = async () => {
    if (!meeting) return;
    setSavingProtokoll(true);
    setError(null);
    const payload: string[][] = editTagesordnung.map((top, i) => protokollTexte[i] ?? ['']);
    try {
      const updated = await updateMeeting(meeting.id, { protokoll_top_texte: payload });
      setMeeting(updated);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Speichern fehlgeschlagen'));
    } finally {
      setSavingProtokoll(false);
    }
  };

  const handleGenerateInvitation = async () => {
    setGenerating('einladung');
    setError(null);
    try {
      const result = await generateInvitation(id);
      setMeeting((m) => (m ? { ...m, einladung_pfad: result.path } : null));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Generierung fehlgeschlagen'));
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateProtocol = async () => {
    setGenerating('protokoll');
    setError(null);
    try {
      const result = await generateProtocol(id);
      setMeeting((m) => (m ? { ...m, protokoll_pfad: result.path } : null));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Generierung fehlgeschlagen'));
    } finally {
      setGenerating(null);
    }
  };

  const downloadUrl = (path: string | null | undefined) => {
    if (!path) return null;
    const relative = path.replace(/^.*?[/\\]uploads[/\\]?/i, '');
    return relative ? `${API_BASE}/uploads/${relative}` : null;
  };

  const handleDownloadEinladungPdf = async () => {
    setPdfDownloading('einladung');
    setError(null);
    try {
      await downloadInvitationPdf(id);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'PDF-Download fehlgeschlagen'));
    } finally {
      setPdfDownloading(null);
    }
  };
  const handleDownloadProtokollPdf = async () => {
    setPdfDownloading('protokoll');
    setError(null);
    try {
      await downloadProtocolPdf(id);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'PDF-Download fehlgeschlagen'));
    } finally {
      setPdfDownloading(null);
    }
  };

  const handleDeleteMeeting = () => setConfirmDeleteMeeting(true);
  const handleConfirmDeleteMeeting = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMeeting(id);
      setConfirmDeleteMeeting(false);
      router.push('/dokumente/sitzungen');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler beim Löschen'));
    } finally {
      setDeleting(false);
    }
  };

  if (!hasMinRole('mitarbeiter')) return null;

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Lade …</p>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/dokumente/sitzungen">Zurück</Link>
        </Button>
      </div>
    );
  }

  if (!meeting) return null;

  const einladungUrl = downloadUrl(meeting.einladung_pfad);
  const protokollUrl = downloadUrl(meeting.protokoll_pfad);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href="/dokumente/sitzungen" aria-label="Zurück">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{meeting.titel}</h1>
              <p className="text-sm text-muted-foreground">
                {format(new Date(meeting.datum), 'EEEE, d. MMMM yyyy', { locale: de })}
                {meeting.uhrzeit && ` · ${String(meeting.uhrzeit).slice(0, 5)}`}
                {meeting.ort && ` · ${meeting.ort}`}
              </p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDeleteMeeting} disabled={deleting}>
            {deleting ? 'Löschen …' : 'Sitzung löschen'}
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="rahmen" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 sm:max-w-2xl h-11 rounded-xl border border-border bg-background p-1">
            <TabsTrigger value="rahmen" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Calendar className="h-4 w-4 shrink-0" />
              Rahmendaten
            </TabsTrigger>
            <TabsTrigger value="einladung" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-xs sm:text-sm">
              <Mail className="h-4 w-4 shrink-0" />
              Einladung
            </TabsTrigger>
            <TabsTrigger value="protokoll" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-xs sm:text-sm">
              <ClipboardList className="h-4 w-4 shrink-0" />
              Protokoll
            </TabsTrigger>
            <TabsTrigger value="dokumente" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-xs sm:text-sm">
              <FileText className="h-4 w-4 shrink-0" />
              Dokumente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rahmen" className="space-y-6">
            <Card className="border-border/80 shadow-sm max-w-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Termin & Ort
                </CardTitle>
                <CardDescription className="text-muted-foreground">Datum, Uhrzeit, Ort und optional kurzer Titel für die Vorlagen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Datum</label>
                    <Input type="date" value={editDatum} onChange={(e) => setEditDatum(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Uhrzeit</label>
                    <Input type="time" value={editUhrzeit} onChange={(e) => setEditUhrzeit(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ort</label>
                  <Input value={editOrt} onChange={(e) => setEditOrt(e.target.value)} placeholder="Ort" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Kurzer Titel (optional)</label>
                  <Input
                    value={editTitelKurz}
                    onChange={(e) => setEditTitelKurz(e.target.value)}
                    placeholder="z. B. für Kopfzeilen in Word"
                  />
                </div>
                <Button onClick={handleSaveRahmendaten} disabled={savingRahmen}>
                  {savingRahmen ? 'Speichern …' : 'Speichern'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="einladung" className="space-y-6">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Einladungsempfänger
                </CardTitle>
                <CardDescription className="text-muted-foreground">Variante und Empfänger für die Word-Einladung</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Einladungsvariante</label>
                  <select
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={editEinladungVariante}
                    onChange={(e) => setEditEinladungVariante(e.target.value as EinladungVariante)}
                  >
                    <option value="landesvorstand">Landesvorstand</option>
                    <option value="erweiterter_landesvorstand">Erweiterter Landesvorstand</option>
                    <option value="freitext">Freitext</option>
                  </select>
                </div>
                {editEinladungVariante === 'landesvorstand' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Vorgefertigte Empfänger (nur zur Info)</label>
                    <div className="max-h-36 overflow-auto rounded-lg border border-border/80 bg-muted/5 px-3 py-2">
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                        {EINLADUNG_EMPFAENGER_LANDESVORSTAND}
                      </p>
                    </div>
                  </div>
                )}
                {editEinladungVariante === 'erweiterter_landesvorstand' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Vorgefertigte Empfänger (nur zur Info)</label>
                    <div className="max-h-36 overflow-auto rounded-lg border border-border/80 bg-muted/5 px-3 py-2">
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                        {EINLADUNG_EMPFAENGER_ERWEITERTER_LANDESVORSTAND}
                      </p>
                    </div>
                  </div>
                )}
                {editEinladungVariante === 'freitext' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Einladungsempfänger (Freitext)</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={editEinladungEmpfaengerFreitext}
                      onChange={(e) => setEditEinladungEmpfaengerFreitext(e.target.value)}
                      placeholder="z. B. Eingeladen: … / nachrichtlich: …"
                    />
                  </div>
                )}
                <Button onClick={handleSaveEinladung} disabled={savingEinladung}>
                  {savingEinladung ? 'Speichern …' : 'Speichern'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Tagesordnungspunkte</CardTitle>
                <CardDescription className="text-muted-foreground">TOPs mit optionalen Unterpunkten – für Einladung und Protokoll</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {editTagesordnung.map((top, index) => (
                  <div key={index} className="rounded-lg border border-border/80 p-3">
                    <TagesordnungNode
                      node={top}
                      path={[index]}
                      pathLabel={String(index + 1)}
                      onTitelChange={handleTitelChange}
                      onAddChild={handleAddChild}
                      onRemove={handleRemove}
                      canRemove={editTagesordnung.length > 1}
                      depth={0}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addEditTop}>
                  <Plus className="mr-1.5 h-4 w-4" /> TOP hinzufügen
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="protokoll" className="space-y-6">
            <Card className="border-border/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Teilnehmer & Protokoll-Metadaten
                </CardTitle>
                <CardDescription className="text-muted-foreground">Anwesende, Sitzungsleitung und Protokollführer für das Protokoll-Dokument</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Teilnehmer (allgemein)</label>
                  <textarea
                    className="min-h-[50px] w-full rounded-lg border border-input px-3 py-2 text-sm"
                    value={editTeilnehmer}
                    onChange={(e) => setEditTeilnehmer(e.target.value)}
                    placeholder='z. B. "siehe Einladung"'
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Teilnehmer der Eingeladenen (Protokoll)</label>
                  {editEinladungVariante === 'landesvorstand' || editEinladungVariante === 'erweiterter_landesvorstand' ? (
                    <div className="max-h-48 space-y-1.5 overflow-auto rounded-lg border border-border/80 p-3">
                      {teilnehmerOptionen.map((option) => (
                        <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editTeilnehmerEingeladeneAuswahl.includes(option)}
                            onChange={() =>
                              setEditTeilnehmerEingeladeneAuswahl((prev) =>
                                prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option]
                              )
                            }
                            className="h-4 w-4 rounded border-input"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-border/80 px-3 py-2 text-sm text-muted-foreground">
                      Bei Freitext: Einladungsempfänger im Tab „Einladung“ eintragen.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Sonstige Teilnehmer</label>
                  <textarea
                    className="min-h-[50px] w-full rounded-lg border border-input px-3 py-2 text-sm"
                    value={editTeilnehmerSonstige}
                    onChange={(e) => setEditTeilnehmerSonstige(e.target.value)}
                    placeholder="Weitere anwesende Personen"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Sitzungsleitung</label>
                    <Input className="rounded-lg" value={editSitzungsleitung} onChange={(e) => setEditSitzungsleitung(e.target.value)} placeholder="Name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Protokollführer</label>
                    <Input className="rounded-lg" value={editProtokollfuehrer} onChange={(e) => setEditProtokollfuehrer(e.target.value)} placeholder="Name" />
                  </div>
                </div>
                <Button onClick={handleSaveTeilnehmer} disabled={savingTeilnehmer}>
                  {savingTeilnehmer ? 'Speichern …' : 'Teilnehmer & Metadaten speichern'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  Protokolldaten
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Pro TOP und Unterpunkt Protokolltext eintragen, dann unter „Dokumente“ das DOCX erzeugen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(editTagesordnung.length ? editTagesordnung : [defaultTop()]).map((top, topIndex) => {
                  const nodes = getNodesInOrder(top, String(topIndex + 1));
                  const n = nodes.length;
                  const texte = (protokollTexte[topIndex] ?? []).length >= n
                    ? (protokollTexte[topIndex] ?? [])
                    : Array.from({ length: n }, (_, j) => (protokollTexte[topIndex]?.[j] ?? ''));
                  return (
                    <div key={topIndex} className="space-y-3 rounded-lg border border-border/80 p-4">
                      <div className="text-sm font-medium text-muted-foreground">
                        TOP {topIndex + 1}: {top.titel || '(ohne Titel)'}
                      </div>
                      {nodes.map((node, nodeIndex) => (
                        <div key={nodeIndex} className="space-y-1">
                          <label className="text-xs font-medium">
                            {node.pathLabel} {node.titel || '(ohne Titel)'}
                          </label>
                          <textarea
                            className="min-h-[70px] w-full rounded-lg border border-input px-3 py-2 text-sm"
                            value={texte[nodeIndex] ?? ''}
                            onChange={(e) => setProtokollText(topIndex, nodeIndex, e.target.value)}
                            placeholder={`Protokoll zu ${node.pathLabel} …`}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
                <Button onClick={handleSaveProtokoll} disabled={savingProtokoll}>
                  {savingProtokoll ? 'Speichern …' : 'Protokolldaten speichern'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dokumente" className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Einladung und Protokoll als Word-Dateien aus den Vorlagen erzeugen. Zuerst Rahmendaten bzw. Protokolldaten speichern.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <Card className="border-border/80 shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Einladung
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {meeting.einladung_pfad ? 'Bereit zum Download' : 'Noch nicht erstellt'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {meeting.einladung_pfad ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="default" size="sm">
                          <a
                            href={einladungUrl ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            DOCX
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadEinladungPdf}
                          disabled={pdfDownloading === 'einladung'}
                        >
                          <Download className="h-4 w-4" />
                          {pdfDownloading === 'einladung' ? 'PDF wird erzeugt …' : 'PDF'}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateInvitation}
                        disabled={generating === 'einladung'}
                        className="text-muted-foreground"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {generating === 'einladung' ? 'Wird erzeugt …' : 'Einladung neu generieren'}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Erzeugt die Datei aus den Rahmendaten und der Vorlage <code className="rounded bg-muted px-1 text-xs">einladung.docx</code>.
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleGenerateInvitation}
                        disabled={generating === 'einladung'}
                        className="w-full sm:w-auto"
                      >
                        {generating === 'einladung' ? (
                          'Wird erzeugt …'
                        ) : (
                          <>
                            <FilePlus className="mr-2 h-4 w-4" />
                            Einladung erzeugen
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/80 shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Protokoll
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {meeting.protokoll_pfad ? 'Bereit zum Download' : 'Noch nicht erstellt'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {meeting.protokoll_pfad ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="default" size="sm">
                          <a
                            href={protokollUrl ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            DOCX
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadProtokollPdf}
                          disabled={pdfDownloading === 'protokoll'}
                        >
                          <Download className="h-4 w-4" />
                          {pdfDownloading === 'protokoll' ? 'PDF wird erzeugt …' : 'PDF'}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateProtocol}
                        disabled={generating === 'protokoll'}
                        className="text-muted-foreground"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {generating === 'protokoll' ? 'Wird erzeugt …' : 'Protokoll neu generieren'}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Erzeugt die Datei aus den Protokolldaten (Tab „Protokoll“) und der Vorlage <code className="rounded bg-muted px-1 text-xs">protokoll.docx</code>.
                      </p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleGenerateProtocol}
                        disabled={generating === 'protokoll'}
                        className="w-full sm:w-auto"
                      >
                        {generating === 'protokoll' ? (
                          'Wird erzeugt …'
                        ) : (
                          <>
                            <FilePlus className="mr-2 h-4 w-4" />
                            Protokoll erzeugen
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmDeleteMeeting}
        onOpenChange={setConfirmDeleteMeeting}
        title="Sitzung löschen?"
        description="Sitzung unwiderruflich löschen?"
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleConfirmDeleteMeeting}
        loading={deleting}
      />
    </div>
  );
}
