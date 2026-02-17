'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDocuments, type Document } from '@/lib/api/documents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYP_LABEL: Record<string, string> = {
  satzung: 'Satzung',
  geschaeftsordnung: 'Geschäftsordnung',
};

export default function SatzungPage() {
  const { hasMinRole } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasMinRole('vorstand')) return;
    getDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  if (!hasMinRole('vorstand')) return null;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 text-2xl font-semibold">Satzung & Geschäftsordnungen</h1>
      <p className="mb-6 text-muted-foreground">
        Dokumente verwalten, Versionen und Änderungsanträge einsehen.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dokumente/aenderungsantraege">Alle Änderungsanträge</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dokumente/sitzungen">Sitzungen</Link>
        </Button>
        {hasMinRole('leitung') && (
          <Button asChild size="sm">
            <Link href="/dokumente/satzung/neu">
              <Plus className="mr-1 h-4 w-4" /> Neues Dokument
            </Link>
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Dokumente angelegt.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc: Document) => (
            <Link key={doc.id} href={`/dokumente/satzung/${doc.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{doc.titel}</CardTitle>
                  </div>
                  <Badge variant="secondary">{TYP_LABEL[doc.typ] ?? doc.typ}</Badge>
                </CardHeader>
                <CardContent>
                  {doc.version && (
                    <p className="text-sm text-muted-foreground">Version: {doc.version}</p>
                  )}
                  {doc.gueltig_ab && (
                    <p className="text-sm text-muted-foreground">
                      gültig ab: {format(new Date(doc.gueltig_ab), 'd. MMM yyyy', { locale: de })}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
