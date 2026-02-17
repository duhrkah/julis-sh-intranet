'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getMemberChanges, sendMemberChangeEmails, resendMemberChangeEmails, SZENARIEN, type MemberChange } from '@/lib/api/members';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function VerlaufPage() {
  const { hasMinRole } = useAuth();
  const [list, setList] = useState<MemberChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendDialog, setResendDialog] = useState<MemberChange | null>(null);
  const [resendToMember, setResendToMember] = useState(true);
  const [resendToKv, setResendToKv] = useState(true);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!hasMinRole('mitarbeiter')) return;
    getMemberChanges({ limit: 100 })
      .then(setList)
      .finally(() => setLoading(false));
  }, [hasMinRole]);

  const handleSend = async (id: number) => {
    setSendingId(id);
    setError(null);
    try {
      await sendMemberChangeEmails(id);
      setList((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'versendet' } : c)));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Versand fehlgeschlagen'));
    } finally {
      setSendingId(null);
    }
  };

  const handleResendSubmit = async () => {
    if (!resendDialog || (!resendToMember && !resendToKv)) return;
    setResendLoading(true);
    setError(null);
    try {
      await resendMemberChangeEmails(resendDialog.id, { send_to_member: resendToMember, send_to_kv: resendToKv });
      setResendDialog(null);
      setResendToMember(true);
      setResendToKv(true);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erneuter Versand fehlgeschlagen'));
    } finally {
      setResendLoading(false);
    }
  };

  if (!hasMinRole('mitarbeiter')) return null;

  return (
    <div className="p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/mitglieder" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-6 text-2xl font-semibold">Verlauf Mitgliederänderungen</h1>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">Noch keine Änderungen erfasst.</p>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  {c.vorname} {c.nachname}
                  {c.mitgliedsnummer && <span className="ml-2 font-normal text-muted-foreground">(Nr. {c.mitgliedsnummer})</span>}
                  {' – '}
                  {SZENARIEN.find((s) => s.value === c.scenario)?.label ?? c.scenario}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={c.status === 'versendet' ? 'default' : 'secondary'}>
                    {c.status === 'versendet' ? 'Versendet' : 'Entwurf'}
                  </Badge>
                  {c.status === 'entwurf' && hasMinRole('leitung') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSend(c.id)}
                      disabled={sendingId === c.id}
                    >
                      <Send className="mr-1 h-4 w-4" />
                      {sendingId === c.id ? 'Sende …' : 'Versenden'}
                    </Button>
                  )}
                  {c.status === 'versendet' && hasMinRole('leitung') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setResendDialog(c); setResendToMember(true); setResendToKv(true); setError(null); }}
                    >
                      <Mail className="mr-1 h-4 w-4" />
                      E-Mails erneut senden
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {c.email && <span>{c.email}</span>}
                <span className="ml-2">
                  Erfasst am {format(new Date(c.created_at), 'd. MMM yyyy, HH:mm', { locale: de })}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {resendDialog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setResendDialog(null)} />
          <Card className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">E-Mails erneut senden</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setResendDialog(null)}>×</Button>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                {resendDialog.vorname} {resendDialog.nachname} – {SZENARIEN.find((s) => s.value === resendDialog.scenario)?.label ?? resendDialog.scenario}
              </p>
              <p className="mb-3 text-sm font-medium">Welche E-Mails sollen erneut gesendet werden?</p>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={resendToMember}
                    onChange={(e) => setResendToMember(e.target.checked)}
                    className="rounded border-input"
                  />
                  An Mitglied ({resendDialog.email || 'keine E-Mail hinterlegt'})
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={resendToKv}
                    onChange={(e) => setResendToKv(e.target.checked)}
                    className="rounded border-input"
                  />
                  An KV (Vorsitzender & Schatzmeister der betroffenen Kreisverbände)
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleResendSubmit} disabled={resendLoading || (!resendToMember && !resendToKv)}>
                  {resendLoading ? 'Wird gesendet …' : 'Senden'}
                </Button>
                <Button variant="outline" onClick={() => setResendDialog(null)}>Abbrechen</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
