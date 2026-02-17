'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getKreisverbande, type Kreisverband } from '@/lib/api/kreisverband';
import {
  createMemberChange,
  SZENARIEN,
  REDUCED_FIELD_SCENARIOS,
  type MemberChangeCreate,
} from '@/lib/api/members';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

const STEPS = ['Szenario', 'Persönliche Daten', 'Kreisverband', 'Bemerkung', 'Absenden'];

export default function NeueMitgliederänderungPage() {
  const router = useRouter();
  const { canAccessMemberChanges } = useAuth();
  const [step, setStep] = useState(0);
  const [kvList, setKvList] = useState<Kreisverband[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<MemberChangeCreate & { austrittsdatum?: string; wechseldatum?: string }>({
    scenario: 'eintritt',
    mitgliedsnummer: '',
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    geburtsdatum: '',
    austrittsdatum: '',
    wechseldatum: '',
    kreisverband_id: undefined,
    kreisverband_alt_id: undefined,
    kreisverband_neu_id: undefined,
    bemerkung: '',
  });

  useEffect(() => {
    if (!canAccessMemberChanges()) return;
    getKreisverbande({ ist_aktiv: true })
      .then(setKvList)
      .catch(() => setKvList([]));
  }, [canAccessMemberChanges]);

  if (!canAccessMemberChanges()) {
    router.replace('/mitglieder');
    return null;
  }

  const needsKvAltNeu = form.scenario.startsWith('verbandswechsel');
  const reducedFields = REDUCED_FIELD_SCENARIOS.includes(form.scenario as (typeof REDUCED_FIELD_SCENARIOS)[number]);
  const needsAustrittsdatum = form.scenario === 'austritt' || form.scenario === 'verbandswechsel_austritt';
  const needsWechseldatum = form.scenario === 'verbandswechsel_intern';

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) {
      if (!form.vorname.trim() || !form.nachname.trim()) return false;
      if (needsAustrittsdatum && !(form.austrittsdatum ?? '').trim()) return false;
      if (needsWechseldatum && !(form.wechseldatum ?? '').trim()) return false;
      return true;
    }
    if (step === 2) {
      if (needsKvAltNeu) return form.kreisverband_alt_id != null && form.kreisverband_neu_id != null;
      return form.kreisverband_id != null;
    }
    if (step === 3) return true;
    return true;
  };

  const handleSubmit = async (sendEmails: boolean) => {
    setError(null);
    setLoading(true);
    try {
      const payload: MemberChangeCreate = {
        ...form,
        mitgliedsnummer: form.mitgliedsnummer?.trim() || undefined,
        email: form.email?.trim() || undefined,
        telefon: form.telefon?.trim() || undefined,
        strasse: form.strasse?.trim() || undefined,
        hausnummer: form.hausnummer?.trim() || undefined,
        plz: form.plz?.trim() || undefined,
        ort: form.ort?.trim() || undefined,
        geburtsdatum: form.geburtsdatum?.trim() || undefined,
        austrittsdatum: form.austrittsdatum?.trim() || undefined,
        wechseldatum: form.wechseldatum?.trim() || undefined,
        bemerkung: form.bemerkung?.trim() || undefined,
      };
      await createMemberChange(payload, sendEmails);
      router.push('/mitglieder/verlauf');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler beim Speichern'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/mitglieder" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <h1 className="mb-2 text-2xl font-semibold">Neue Mitgliederänderung</h1>
      <p className="mb-6 text-muted-foreground">Schritt {step + 1} von {STEPS.length}: {STEPS[step]}</p>

      {/* Step indicator */}
      <div className="mb-8 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && 'Art der Änderung auswählen.'}
            {step === 1 && reducedFields && 'Nur Name, Vorname, Geburtsdatum, Mitgliedsnummer und Austrittsdatum.'}
            {step === 1 && !reducedFields && 'Name, Mitgliedsnummer und Kontaktdaten der Person.'}
            {step === 2 && needsKvAltNeu && 'Beide Kreisverbände (von / nach) wählen – beide werden benachrichtigt.'}
            {step === 2 && !needsKvAltNeu && 'Kreisverband zur Benachrichtigung wählen (wird bei allen Szenarien benötigt).'}
            {step === 3 && 'Optionale Bemerkung.'}
            {step === 4 && 'Zusammenfassung. Sofort versenden oder als Entwurf speichern.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 0: Szenario */}
          {step === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SZENARIEN.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, scenario: value }))}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    form.scenario === value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Persönliche Daten */}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {reducedFields ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Vorname *</label>
                    <Input
                      value={form.vorname}
                      onChange={(e) => setForm((f) => ({ ...f, vorname: e.target.value }))}
                      placeholder="Vorname"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Nachname *</label>
                    <Input
                      value={form.nachname}
                      onChange={(e) => setForm((f) => ({ ...f, nachname: e.target.value }))}
                      placeholder="Nachname"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Geburtsdatum</label>
                    <Input
                      type="date"
                      value={form.geburtsdatum ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, geburtsdatum: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Mitgliedsnummer</label>
                    <Input
                      value={form.mitgliedsnummer ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, mitgliedsnummer: e.target.value }))}
                      placeholder="z. B. 12345"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Austrittsdatum *</label>
                    <Input
                      type="date"
                      value={form.austrittsdatum ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, austrittsdatum: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Mitgliedsnummer</label>
                    <Input
                      value={form.mitgliedsnummer ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, mitgliedsnummer: e.target.value }))}
                      placeholder="z. B. 12345"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Wird in E-Mails und Benachrichtigungen mit angegeben.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Vorname *</label>
                    <Input
                      value={form.vorname}
                      onChange={(e) => setForm((f) => ({ ...f, vorname: e.target.value }))}
                      placeholder="Vorname"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Nachname *</label>
                    <Input
                      value={form.nachname}
                      onChange={(e) => setForm((f) => ({ ...f, nachname: e.target.value }))}
                      placeholder="Nachname"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">E-Mail</label>
                    <Input
                      type="email"
                      value={form.email ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.de"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Telefon</label>
                    <Input
                      value={form.telefon ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
                      placeholder="Telefon"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Geburtsdatum</label>
                    <Input
                      type="date"
                      value={form.geburtsdatum ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, geburtsdatum: e.target.value }))}
                    />
                  </div>
                  {needsWechseldatum && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium">Wechseldatum *</label>
                      <Input
                        type="date"
                        value={form.wechseldatum ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, wechseldatum: e.target.value }))}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium">Straße</label>
                    <Input
                      value={form.strasse ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, strasse: e.target.value }))}
                      placeholder="Straße"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Hausnummer</label>
                    <Input
                      value={form.hausnummer ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, hausnummer: e.target.value }))}
                      placeholder="z. B. 1a"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">PLZ</label>
                    <Input
                      value={form.plz ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, plz: e.target.value }))}
                      placeholder="PLZ"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ort</label>
                    <Input
                      value={form.ort ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, ort: e.target.value }))}
                      placeholder="Ort"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Kreisverband (bei allen Szenarien zur Benachrichtigung) */}
          {step === 2 && (
            <div className="space-y-4">
              {!needsKvAltNeu && (
                <div>
                  <label className="mb-2 block text-sm font-medium">Kreisverband zur Benachrichtigung *</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.kreisverband_id ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, kreisverband_id: e.target.value ? Number(e.target.value) : undefined }))}
                  >
                    <option value="">Bitte wählen</option>
                    {kvList.map((kv) => (
                      <option key={kv.id} value={kv.id}>{kv.name}</option>
                    ))}
                  </select>
                  {form.scenario === 'austritt' && (
                    <p className="mt-1 text-xs text-muted-foreground">z. B. der Kreisverband, aus dem die Person austritt</p>
                  )}
                </div>
              )}
              {needsKvAltNeu && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Kreisverband (von) *</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.kreisverband_alt_id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, kreisverband_alt_id: e.target.value ? Number(e.target.value) : undefined }))}
                    >
                      <option value="">Bitte wählen</option>
                      {kvList.map((kv) => (
                        <option key={kv.id} value={kv.id}>{kv.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Kreisverband (nach) *</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.kreisverband_neu_id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, kreisverband_neu_id: e.target.value ? Number(e.target.value) : undefined }))}
                    >
                      <option value="">Bitte wählen</option>
                      {kvList.map((kv) => (
                        <option key={kv.id} value={kv.id}>{kv.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Bemerkung */}
          {step === 3 && (
            <div>
              <label className="mb-1 block text-sm font-medium">Bemerkung (optional)</label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.bemerkung ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, bemerkung: e.target.value }))}
                placeholder="Zusätzliche Hinweise"
              />
            </div>
          )}

          {/* Step 4: Zusammenfassung */}
          {step === 4 && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Szenario:</span> {SZENARIEN.find((s) => s.value === form.scenario)?.label ?? form.scenario}</p>
              <p><span className="font-medium">Name:</span> {form.vorname} {form.nachname}</p>
              {form.mitgliedsnummer && <p><span className="font-medium">Mitgliedsnummer:</span> {form.mitgliedsnummer}</p>}
              {form.austrittsdatum && <p><span className="font-medium">Austrittsdatum:</span> {form.austrittsdatum}</p>}
              {form.wechseldatum && <p><span className="font-medium">Wechseldatum:</span> {form.wechseldatum}</p>}
              {form.email && <p><span className="font-medium">E-Mail:</span> {form.email}</p>}
              {form.kreisverband_id != null && (
                <p><span className="font-medium">Kreisverband:</span> {kvList.find((k) => k.id === form.kreisverband_id)?.name ?? form.kreisverband_id}</p>
              )}
              {form.kreisverband_alt_id != null && (
                <p><span className="font-medium">Von KV:</span> {kvList.find((k) => k.id === form.kreisverband_alt_id)?.name}</p>
              )}
              {form.kreisverband_neu_id != null && (
                <p><span className="font-medium">Nach KV:</span> {kvList.find((k) => k.id === form.kreisverband_neu_id)?.name}</p>
              )}
              {form.bemerkung && <p><span className="font-medium">Bemerkung:</span> {form.bemerkung}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => handleSubmit(true)} disabled={loading}>
                  {loading ? 'Speichern …' : 'Speichern & E-Mails versenden'}
                </Button>
                <Button variant="outline" onClick={() => handleSubmit(false)} disabled={loading}>
                  Nur als Entwurf speichern
                </Button>
              </div>
            </div>
          )}

          {/* Navigation (except last step) */}
          {step < 4 && (
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
              </Button>
              <Button onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={!canProceed()}>
                Weiter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
