'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Building2, FolderTree, Mail } from 'lucide-react';
import { testSmtp } from '@/lib/api/settings';
import { getApiErrorMessage } from '@/lib/apiError';

export default function StammdatenPage() {
  const { hasMinRole } = useAuth();
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSmtpTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = smtpTo.trim();
    if (!email) return;
    setSmtpLoading(true);
    setSmtpMessage(null);
    try {
      const res = await testSmtp(email);
      setSmtpMessage({ type: 'success', text: res.detail });
      setSmtpTo('');
    } catch (err: unknown) {
      setSmtpMessage({ type: 'error', text: getApiErrorMessage(err, 'SMTP-Test fehlgeschlagen') });
    } finally {
      setSmtpLoading(false);
    }
  };

  if (!hasMinRole('admin')) return null;

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/verwaltung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Verwaltung
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold">Stammdaten</h1>
      <p className="mt-1 text-muted-foreground">
        System-Stammdaten werden in den jeweiligen Bereichen gepflegt. Hier die Übersicht.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Kreisverbände & Tenants
            </CardTitle>
            <CardDescription>
              Organisationseinheiten (Landesverband, Kreisverbände), Vorstände und Protokolle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/kreisverband">Zu den Kreisverbänden</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderTree className="h-5 w-5" />
              Struktur
            </CardTitle>
            <CardDescription>
              Benutzer sind Tenants zugeordnet; Termine und Dokumente hängen an der Tenant-Struktur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Neue Tenants oder Kreisverbände legt ein Administrator an. Die Benutzerverwaltung findest du unter Verwaltung → Benutzer.
            </p>
          </CardContent>
        </Card>

        {hasMinRole('admin') && (
          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" />
                SMTP testen
              </CardTitle>
              <CardDescription>
                Test-E-Mail senden, um die SMTP-Konfiguration (E-Mail-Versand) zu prüfen. Nur sichtbar für Administratoren.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSmtpTest} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[200px] flex-1">
                  <label htmlFor="smtp-to" className="mb-1 block text-sm font-medium">
                    E-Mail-Adresse
                  </label>
                  <Input
                    id="smtp-to"
                    type="email"
                    value={smtpTo}
                    onChange={(e) => setSmtpTo(e.target.value)}
                    placeholder="empfaenger@beispiel.de"
                    disabled={smtpLoading}
                  />
                </div>
                <Button type="submit" disabled={smtpLoading || !smtpTo.trim()}>
                  {smtpLoading ? 'Wird gesendet …' : 'Test-E-Mail senden'}
                </Button>
              </form>
              {smtpMessage && (
                <p className={`mt-3 text-sm ${smtpMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                  {smtpMessage.text}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
