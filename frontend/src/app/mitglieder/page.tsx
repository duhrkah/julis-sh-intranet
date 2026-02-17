'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, UserPlus, History } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MitgliederPage() {
  const { canAccessMemberChanges, user } = useAuth();
  const router = useRouter();

  if (!canAccessMemberChanges()) return null;

  const canEdit = canAccessMemberChanges() && (user?.role === 'leitung' || user?.role === 'admin');

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-semibold">Mitgliederänderungen</h1>
      <p className="mb-6 text-muted-foreground">
        Neue Änderung erfassen (Eintritt, Austritt, Verbandswechsel, Datenänderung), E-Mail-Templates und Empfänger verwalten.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-sidebar-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" />
              Neue Änderung
            </CardTitle>
            <CardDescription>
              Wizard: Szenario wählen, Daten erfassen, sofort versenden oder als Entwurf speichern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/mitglieder/neu">Änderung erfassen</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-sidebar-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Verlauf
            </CardTitle>
            <CardDescription>
              Alle erfassten Mitgliederänderungen einsehen und bei Entwürfen nachträglich versenden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/mitglieder/verlauf">Zum Verlauf</Link>
            </Button>
          </CardContent>
        </Card>

        {canEdit && (
          <>
            <Card className="border-sidebar-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="h-5 w-5" />
                  E-Mail-Templates
                </CardTitle>
                <CardDescription>
                  Vorlagen für Mitglieder- und Empfänger-E-Mails mit Platzhaltern (z. B. {`{{vorname}}`}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/mitglieder/templates">Templates verwalten</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-sidebar-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Empfänger
                </CardTitle>
                <CardDescription>
                  Pro Kreisverband: Vorsitzender, Schatzmeister – erhalten Benachrichtigungen bei Änderungen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/mitglieder/empfaenger">Empfänger verwalten</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
