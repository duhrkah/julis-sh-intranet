'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { getMicrosoftAuthorizeUrl, getMicrosoftLoginEnabled } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function getNextRedirect(searchParams: ReturnType<typeof useSearchParams>): string {
  const next = searchParams.get('next');
  if (!next || !next.startsWith('/')) return '/';
  return next;
}

const LOGO_CLICKS_TO_SHOW_PASSWORD_LOGIN = 5;

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [microsoftError, setMicrosoftError] = useState<string | null>(null);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const { login, error, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getNextRedirect(searchParams);

  useEffect(() => {
    getMicrosoftLoginEnabled().then(setMicrosoftEnabled);
  }, []);

  const handleLogoClick = () => {
    const next = logoClickCount + 1;
    setLogoClickCount(next);
    if (next >= LOGO_CLICKS_TO_SHOW_PASSWORD_LOGIN) {
      setShowPasswordLogin(true);
      setLogoClickCount(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      router.replace(redirectTo);
    } catch {
      // Error is set in context
    }
  };

  const handleMicrosoftLogin = async () => {
    setMicrosoftError(null);
    setMicrosoftLoading(true);
    try {
      const url = await getMicrosoftAuthorizeUrl(redirectTo);
      window.location.href = url;
    } catch (err) {
      setMicrosoftError(getApiErrorMessage(err, 'Microsoft-Anmeldung nicht verfügbar.'));
    } finally {
      setMicrosoftLoading(false);
    }
  };

  if (isAuthenticated) {
    router.replace(redirectTo);
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <button
        type="button"
        onClick={handleLogoClick}
        className="mb-8 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
        aria-label="JuLis SH Logo"
      >
        <Image src="/Logo-Junge-Liberale.svg" alt="JuLis SH" width={280} height={80} className="h-20 w-auto sm:h-24 sm:w-auto" priority />
      </button>
      <Card className="w-full max-w-md border-sidebar-border">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-semibold">Intranet</CardTitle>
          <CardDescription>
            {showPasswordLogin ? 'Melde dich mit deinen Zugangsdaten an.' : 'Melde dich mit Microsoft 365 an.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {showPasswordLogin && (
              <>
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium">
                    Benutzername
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Benutzername"
                    required
                    autoComplete="username"
                    className="border-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Passwort
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Passwort"
                    required
                    autoComplete="current-password"
                    className="border-input"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Anmeldung …' : 'Anmelden'}
                </Button>
                {microsoftEnabled && (
                  <div className="relative my-4">
                    <span className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </span>
                    <span className="relative flex justify-center text-xs uppercase text-muted-foreground">
                      oder
                    </span>
                  </div>
                )}
              </>
            )}
            {microsoftEnabled && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={microsoftLoading}
                  onClick={handleMicrosoftLogin}
                >
                  {microsoftLoading ? 'Weiterleitung …' : 'Mit Microsoft 365 anmelden'}
                </Button>
                {microsoftError && (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {microsoftError}
                  </p>
                )}
              </>
            )}
            {!microsoftEnabled && !showPasswordLogin && (
              <p className="text-sm text-muted-foreground text-center">
                Microsoft-Anmeldung wird geladen …
              </p>
            )}
            {!microsoftEnabled && showPasswordLogin && (
              <p className="text-sm text-muted-foreground text-center">
                Microsoft-Login ist nicht konfiguriert. Nutze Benutzername und Passwort.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-muted/30 text-muted-foreground">Lade …</div>}>
      <LoginForm />
    </Suspense>
  );
}
