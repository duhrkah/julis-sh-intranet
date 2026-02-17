'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getLandesverbandVorstandUebersicht,
  type VorstandUebersichtRolle,
  type VorstandUebersichtEintrag,
} from '@/lib/api/kreisverband';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Mail, Users } from 'lucide-react';

const ROLLEN_OPTIONS: { value: VorstandUebersichtRolle; label: string }[] = [
  { value: 'vorsitz', label: 'Vorsitz' },
  { value: 'schatzmeister', label: 'Schatzmeister' },
  { value: 'organisation', label: 'Organisation' },
  { value: 'programmatik', label: 'Programmatik' },
  { value: 'presse', label: 'Presse- und Öffentlichkeitsarbeit' },
];

const ROLLEN_MIT_BEISITZERN: VorstandUebersichtRolle[] = ['organisation', 'programmatik', 'presse'];

export default function KreisverbandUebersichtPage() {
  const { hasMinRole } = useAuth();
  const [rolle, setRolle] = useState<VorstandUebersichtRolle>('vorsitz');
  const [mitBeisitzern, setMitBeisitzern] = useState(true);
  const [data, setData] = useState<VorstandUebersichtEintrag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showBeisitzerToggle = ROLLEN_MIT_BEISITZERN.includes(rolle);

  useEffect(() => {
    if (!hasMinRole('vorstand')) return;
    setLoading(true);
    setError(null);
    getLandesverbandVorstandUebersicht({ rolle, mit_beisitzern: showBeisitzerToggle ? mitBeisitzern : true })
      .then(setData)
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [hasMinRole, rolle, mitBeisitzern, showBeisitzerToggle]);

  const bccEmails = Array.from(
    new Set(
      data.flatMap((e) => e.mitglieder.map((m) => m.email).filter((e): e is string => !!e?.trim()))
    )
  );
  const mailtoBcc = bccEmails.length > 0
    ? `mailto:info@julis-sh.de?bcc=${bccEmails.map((e) => encodeURIComponent(e)).join(',')}`
    : null;

  if (!hasMinRole('vorstand')) return null;

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/kreisverband" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Kreisverbänden
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Users className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-semibold">Vorstandsübersicht Landesverband</h1>
          <p className="text-muted-foreground">
            Alle Kreisverbände nach Rolle filtern – mit oder ohne Beisitzer.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter</CardTitle>
          <CardDescription>Rolle wählen und optional Beisitzer ein- oder ausblenden.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Rolle:</span>
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rolle}
              onChange={(e) => setRolle(e.target.value as VorstandUebersichtRolle)}
            >
              {ROLLEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {showBeisitzerToggle && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={mitBeisitzern}
                onChange={(e) => setMitBeisitzern(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Beisitzer anzeigen</span>
            </label>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {ROLLEN_OPTIONS.find((o) => o.value === rolle)?.label ?? rolle}
            </CardTitle>
            <CardDescription>
              {data.length} Kreisverbände
              {showBeisitzerToggle && (mitBeisitzern ? ' (mit Beisitzern)' : ' (ohne Beisitzer)')}
              {bccEmails.length > 0 && ` · ${bccEmails.length} E-Mail-Adresse(n) für Verteiler`}
            </CardDescription>
          </div>
          {mailtoBcc ? (
            <Button variant="outline" size="sm" asChild>
              <a href={mailtoBcc} className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Alle per E-Mail (BCC) anschreiben
              </a>
            </Button>
          ) : (
            !loading && (
              <Button variant="outline" size="sm" disabled title="Keine E-Mail-Adressen in der aktuellen Ansicht" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Alle per E-Mail (BCC)
              </Button>
            )
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Lade …</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Kreisverband</th>
                    <th className="pb-2 pr-4 font-medium">Kürzel</th>
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Rolle</th>
                    <th className="pb-2 pr-4 font-medium">E-Mail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.flatMap((eintrag) =>
                    eintrag.mitglieder.length === 0 ? (
                      <tr key={eintrag.kreisverband.id} className="border-b">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/kreisverband/${eintrag.kreisverband.id}`}
                            className="text-primary hover:underline"
                          >
                            {eintrag.kreisverband.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          {eintrag.kreisverband.kuerzel && (
                            <Badge variant="secondary">{eintrag.kreisverband.kuerzel}</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">—</td>
                        <td className="py-2 pr-4 text-muted-foreground">—</td>
                        <td className="py-2 pr-4 text-muted-foreground">—</td>
                      </tr>
                    ) : (
                      eintrag.mitglieder.map((m, idx) => (
                        <tr key={`${eintrag.kreisverband.id}-${m.id}`} className="border-b">
                          {idx === 0 ? (
                            <td
                              rowSpan={eintrag.mitglieder.length}
                              className="py-2 pr-4 align-top"
                            >
                              <Link
                                href={`/kreisverband/${eintrag.kreisverband.id}`}
                                className="text-primary hover:underline"
                              >
                                {eintrag.kreisverband.name}
                              </Link>
                            </td>
                          ) : null}
                          {idx === 0 ? (
                            <td
                              rowSpan={eintrag.mitglieder.length}
                              className="py-2 pr-4 align-top"
                            >
                              {eintrag.kreisverband.kuerzel && (
                                <Badge variant="secondary">{eintrag.kreisverband.kuerzel}</Badge>
                              )}
                            </td>
                          ) : null}
                          <td className="py-2 pr-4">{m.name}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline" className="text-xs font-normal">
                              {m.rolle}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            {m.email ? (
                              <a href={`mailto:${m.email}`} className="text-primary hover:underline">
                                {m.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
