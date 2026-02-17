'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createDocument } from '@/lib/api/documents';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function NeuesDokumentPage() {
  const router = useRouter();
  const { hasMinRole } = useAuth();
  const [titel, setTitel] = useState('');
  const [typ, setTyp] = useState<'satzung' | 'geschaeftsordnung'>('satzung');
  const [version, setVersion] = useState('');
  const [gueltigAb, setGueltigAb] = useState('');
  const [aktuellerText, setAktuellerText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasMinRole('leitung')) {
    router.replace('/dokumente/satzung');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titel.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const doc = await createDocument({
        titel: titel.trim(),
        typ,
        version: version.trim() || undefined,
        gueltig_ab: gueltigAb || undefined,
        aktueller_text: aktuellerText.trim() || undefined,
      });
      router.push(`/dokumente/satzung/${doc.id}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Fehler beim Speichern'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/dokumente/satzung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-6 text-2xl font-semibold">Neues Dokument</h1>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Satzung oder Geschäftsordnung</CardTitle>
          <CardDescription>Titel, Typ und optional Version sowie gültig ab angeben.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titel *</label>
              <Input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="z. B. Satzung der JuLis SH"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Typ *</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={typ}
                onChange={(e) => setTyp(e.target.value as 'satzung' | 'geschaeftsordnung')}
              >
                <option value="satzung">Satzung</option>
                <option value="geschaeftsordnung">Geschäftsordnung</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Version</label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="z. B. 2024-01"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Gültig ab</label>
                <Input
                  type="date"
                  value={gueltigAb}
                  onChange={(e) => setGueltigAb(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Aktueller Text (optional)</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={aktuellerText}
                onChange={(e) => setAktuellerText(e.target.value)}
                placeholder="Markdown oder Fließtext"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Speichern …' : 'Dokument anlegen'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
