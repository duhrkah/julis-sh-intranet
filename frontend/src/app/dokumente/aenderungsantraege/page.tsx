'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDocuments } from '@/lib/api/documents';
import { getAenderungsantraege } from '@/lib/api/documents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText } from 'lucide-react';
import type { Document } from '@/lib/api/documents';
import type { DocumentAenderungsantrag } from '@/lib/api/documents';

export default function AenderungsantraegePage() {
  const { hasMinRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [amendmentsByDoc, setAmendmentsByDoc] = useState<Record<number, DocumentAenderungsantrag[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasMinRole('vorstand')) return;
    getDocuments()
      .then(async (docs) => {
        setDocuments(docs);
        const byDoc: Record<number, DocumentAenderungsantrag[]> = {};
        await Promise.all(
          docs.map(async (d) => {
            try {
              const list = await getAenderungsantraege(d.id);
              byDoc[d.id] = list;
            } catch {
              byDoc[d.id] = [];
            }
          })
        );
        setAmendmentsByDoc(byDoc);
      })
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  if (!hasMinRole('vorstand')) return null;

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/dokumente/satzung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Satzung & GO
        </Link>
      </Button>

      <h1 className="mb-2 text-2xl font-semibold">Änderungsanträge</h1>
      <p className="mb-6 text-muted-foreground">
        Änderungsanträge zu Satzung und GO – pro Dokument verwalten und Synopse (alte / neue Fassung) erfassen.
      </p>

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground">Keine Dokumente vorhanden. Zuerst unter Satzung & GO ein Dokument anlegen.</p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const amendments = amendmentsByDoc[doc.id] ?? [];
            return (
              <Card key={doc.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    {doc.titel}
                  </CardTitle>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dokumente/satzung/${doc.id}`}>
                      {amendments.length} Anträge – öffnen
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {doc.typ === 'satzung' ? 'Satzung' : 'Geschäftsordnung'}
                    {doc.version && ` · Version ${doc.version}`}
                  </p>
                  {amendments.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm">
                      {amendments.slice(0, 3).map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/dokumente/satzung/${doc.id}`}
                            className="text-primary hover:underline"
                          >
                            {a.antragsteller}: {a.antrag_text}
                          </Link>
                          <span className="ml-2 text-muted-foreground">({a.status})</span>
                        </li>
                      ))}
                      {amendments.length > 3 && (
                        <li className="text-muted-foreground">
                          … und {amendments.length - 3} weitere
                        </li>
                      )}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
