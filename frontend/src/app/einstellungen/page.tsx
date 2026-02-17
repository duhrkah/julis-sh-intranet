'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { updateMyProfile, changePassword } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Lock } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  leitung: 'Leitung',
  vorstand: 'Vorstand',
  mitarbeiter: 'Mitarbeiter',
};

export default function EinstellungenPage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '');
      setEmail(user.email ?? '');
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError(null);
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      await updateMyProfile({
        full_name: fullName.trim() || undefined,
        email: email.trim() || undefined,
      });
      await refreshUser();
      setProfileSuccess(true);
    } catch (err: unknown) {
      setProfileError(getApiErrorMessage(err, 'Speichern fehlgeschlagen'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== newPasswordConfirm) {
      setPasswordError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Das neue Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, 'Passwort konnte nicht geändert werden'));
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Bitte melde dich an.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <p className="mt-1 text-muted-foreground">
        Persönliche Einstellungen für {user.full_name || user.username}.
      </p>

      <div className="mt-8 space-y-6">
        {/* Profil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Profil
            </CardTitle>
            <CardDescription>
              Anzeigename und E-Mail-Adresse. Der Benutzername kann nicht geändert werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="mb-1 block text-sm font-medium">Benutzername</label>
                <Input value={user.username} disabled className="bg-muted" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Rolle</label>
                <Input
                  value={user.display_role ?? ROLE_LABELS[user.role] ?? user.role}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Anzeigename</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="z. B. Max Mustermann"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@beispiel.de"
                  required
                />
              </div>
              {profileError && (
                <p className="text-sm text-destructive">{profileError}</p>
              )}
              {profileSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400">Profil gespeichert.</p>
              )}
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? 'Speichern …' : 'Profil speichern'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Passwort */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Passwort ändern
            </CardTitle>
            <CardDescription>
              Gib dein aktuelles Passwort und das neue Passwort ein.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="mb-1 block text-sm font-medium">Aktuelles Passwort</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Neues Passwort</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Neues Passwort bestätigen</label>
                <Input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400">Passwort wurde geändert.</p>
              )}
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Ändern …' : 'Passwort ändern'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
