'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { loginWithMicrosoft, getCurrentUser } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/apiError';

function MicrosoftCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';
    const msError = searchParams.get('error');
    const msErrorDesc = searchParams.get('error_description');

    if (msError) {
      const desc = msErrorDesc ? decodeURIComponent(msErrorDesc) : msError;
      setError(desc);
      return;
    }

    if (!code) {
      // Bereits angemeldet? Dann direkt zum Dashboard (z. B. bei Aufruf ohne Code oder nach Refresh)
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (token) {
        getCurrentUser()
          .then(() => {
            const next = state && state.startsWith('/') ? state : '/';
            router.replace(next);
          })
          .catch(() => {
            setError(
              'Es wurde kein Anmeldecode von Microsoft übermittelt. ' +
                'Haben Sie den Vorgang abgebrochen? Sonst prüfen Sie in der Azure-App-Registrierung, ' +
                'ob die Redirect-URI exakt lautet: ' +
                (typeof window !== 'undefined' ? window.location.origin + '/login/microsoft/callback' : '…')
            );
          });
        return;
      }
      setError(
        'Es wurde kein Anmeldecode von Microsoft übermittelt. ' +
          'Haben Sie den Vorgang abgebrochen? Sonst prüfen Sie in der Azure-App-Registrierung, ' +
          'ob die Redirect-URI exakt lautet: ' +
          (typeof window !== 'undefined' ? window.location.origin + '/login/microsoft/callback' : '…')
      );
      return;
    }

    const redirectUri =
      typeof window !== 'undefined'
        ? `${window.location.origin}/login/microsoft/callback`
        : '';

    loginWithMicrosoft(code, redirectUri, state)
      .then(async (response) => {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        await refreshUser();
        const next = state && state.startsWith('/') ? state : '/';
        router.replace(next);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Microsoft-Anmeldung fehlgeschlagen.'));
      });
  }, [searchParams, router, refreshUser]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
        <p className="mb-4 max-w-md text-center text-destructive" role="alert">
          {error}
        </p>
        <div className="flex flex-col items-center gap-2 text-sm">
          <a href="/login" className="text-primary hover:underline">
            Zurück zur Anmeldung
          </a>
          <a href="/login" className="text-muted-foreground hover:underline">
            Erneut mit Microsoft anmelden
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <p className="text-muted-foreground">Anmeldung wird abgeschlossen …</p>
    </div>
  );
}

export default function MicrosoftCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/30 text-muted-foreground">
          Lade …
        </div>
      }
    >
      <MicrosoftCallbackContent />
    </Suspense>
  );
}
