'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createMeeting, generateInvitation, type Tagesordnungspunkt } from '@/lib/api/meetings';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

const TYPEN = ['Vorstandssitzung', 'Mitgliederversammlung', 'Sonstige'];

const defaultNode = (): Tagesordnungspunkt => ({ titel: '', unterpunkte: [] });

function setTitelAtPath(tops: Tagesordnungspunkt[], path: number[], value: string): Tagesordnungspunkt[] {
  if (path.length === 0) return tops;
  const [i, ...rest] = path;
  if (rest.length === 0) {
    return tops.map((t, idx) => (idx === i ? { ...t, titel: value } : t));
  }
  return tops.map((t, idx) =>
    idx === i ? { ...t, unterpunkte: setTitelAtPath(t.unterpunkte ?? [], rest, value) } : t
  );
}

function addChildAtPath(tops: Tagesordnungspunkt[], path: number[]): Tagesordnungspunkt[] {
  if (path.length === 0) return [...tops, defaultNode()];
  const [i, ...rest] = path;
  if (rest.length === 0) {
    return tops.map((t, idx) =>
      idx === i ? { ...t, unterpunkte: [...(t.unterpunkte ?? []), defaultNode()] } : t
    );
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
  const marginLeft = depth * 20;
  return (
    <div className="mb-2" style={{ marginLeft }}>
      <div className="flex gap-2">
        <span className="w-10 shrink-0 pt-2 text-xs text-muted-foreground">{pathLabel}</span>
        <Input
          value={node.titel}
          onChange={(e) => onTitelChange(path, e.target.value)}
          placeholder={depth === 0 ? 'Titel Tagesordnungspunkt' : 'Unterpunkt'}
          className="flex-1 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(path)}
          disabled={!canRemove}
          className="shrink-0 text-destructive"
        >
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
            canRemove={true}
            depth={depth + 1}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 text-muted-foreground"
          onClick={() => onAddChild(path)}
        >
          <Plus className="mr-1 h-3 w-3" /> Unterpunkt
        </Button>
      </div>
    </div>
  );
}

export default function NeueSitzungPage() {
  const router = useRouter();
  const { hasMinRole } = useAuth();
  const [titel, setTitel] = useState('');
  const [titelKurz, setTitelKurz] = useState('');
  const [typ, setTyp] = useState('Mitgliederversammlung');
  const [datum, setDatum] = useState('');
  const [uhrzeit, setUhrzeit] = useState('');
  const [ort, setOrt] = useState('');
  const [tagesordnung, setTagesordnung] = useState<Tagesordnungspunkt[]>([defaultNode()]);
  const [loading, setLoading] = useState(false);
  const [loadingWithInvite, setLoadingWithInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasMinRole('vorstand')) {
    router.replace('/dokumente/sitzungen');
    return null;
  }

  const handleTitelChange = (path: number[], value: string) => {
    setTagesordnung((prev) => setTitelAtPath(prev, path, value));
  };
  const handleAddChild = (path: number[]) => {
    setTagesordnung((prev) => addChildAtPath(prev, path));
  };
  const handleRemove = (path: number[]) => {
    setTagesordnung((prev) => removeAtPath(prev, path));
  };

  const doCreate = async () => {
    const tops = tagesordnung.map(normalizeForApi).filter((t) => t.titel);
    return createMeeting({
      titel: titel.trim(),
      titel_kurz: titelKurz.trim() || undefined,
      typ: typ === 'Mitgliederversammlung' ? 'mitgliederversammlung' : typ === 'Vorstandssitzung' ? 'vorstandssitzung' : 'sonstige',
      datum,
      uhrzeit: uhrzeit || undefined,
      ort: ort.trim() || undefined,
      tagesordnung: tops.length ? tops : undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titel.trim() || !datum) return;
    setError(null);
    setLoading(true);
    try {
      const meeting = await doCreate();
      router.push(`/dokumente/sitzungen/${meeting.id}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitWithInvitation = async () => {
    if (!titel.trim() || !datum) return;
    setError(null);
    setLoadingWithInvite(true);
    try {
      const meeting = await doCreate();
      await generateInvitation(meeting.id);
      router.push(`/dokumente/sitzungen/${meeting.id}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern / Einladung generieren'));
    } finally {
      setLoadingWithInvite(false);
    }
  };

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/dokumente/sitzungen" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-6 text-2xl font-semibold">Neue Sitzung</h1>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Rahmendaten für Einladung & Protokoll</CardTitle>
          <CardDescription>
            TOP mit optionalen Unterpunkten (und weiteren Ebenen). Werden in Einladung und Protokoll übernommen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titel *</label>
              <Input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="z. B. MV 1/2025"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Kurzer Titel (optional)</label>
              <Input
                value={titelKurz}
                onChange={(e) => setTitelKurz(e.target.value)}
                placeholder="z. B. für Kopfzeilen in Word-Vorlagen"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Typ</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={typ}
                onChange={(e) => setTyp(e.target.value)}
              >
                {TYPEN.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Datum *</label>
                <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Uhrzeit</label>
                <Input type="time" value={uhrzeit} onChange={(e) => setUhrzeit(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ort</label>
              <Input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Ort der Sitzung" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tagesordnungspunkte</label>
              <p className="mb-2 text-xs text-muted-foreground">
                TOP mit Unterpunkten – pro Ebene „Unterpunkt“ hinzufügen.
              </p>
              {tagesordnung.map((top, index) => (
                <div key={index} className="mb-4 rounded-lg border border-border p-3">
                  <TagesordnungNode
                    node={top}
                    path={[index]}
                    pathLabel={String(index + 1)}
                    onTitelChange={handleTitelChange}
                    onAddChild={handleAddChild}
                    onRemove={handleRemove}
                    canRemove={tagesordnung.length > 1}
                    depth={0}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddChild([])}>
                <Plus className="mr-1 h-4 w-4" /> TOP hinzufügen
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading || loadingWithInvite}>
                {loading ? 'Speichern …' : 'Speichern'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || loadingWithInvite}
                onClick={handleSubmitWithInvitation}
              >
                {loadingWithInvite ? 'Speichern & Generiere …' : 'Speichern & Einladung generieren'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
