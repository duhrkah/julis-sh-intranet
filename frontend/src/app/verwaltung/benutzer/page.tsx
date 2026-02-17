'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  type UserListItem,
  type UserCreateInput,
  type UserUpdateInput,
} from '@/lib/api/users';
import { getTenantTree } from '@/lib/api/tenants';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type TenantNode = { id: number; name: string; parent_id: number | null; children?: TenantNode[] };

function flattenTenants(nodes: TenantNode[]): { id: number; name: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name },
    ...flattenTenants(n.children ?? []),
  ]);
}

const ROLES = [
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'vorstand', label: 'Vorstand' },
  { value: 'leitung', label: 'Leitung' },
  { value: 'admin', label: 'Administrator' },
] as const;

export default function BenutzerPage() {
  const { hasMinRole, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [tenantTree, setTenantTree] = useState<TenantNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('mitarbeiter');
  const [tenantId, setTenantId] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  const tenantOptions = useMemo(() => flattenTenants(tenantTree), [tenantTree]);

  const load = () => {
    setLoading(true);
    Promise.all([getUsers(), getTenantTree()])
      .then(([userList, tree]) => {
        setUsers(userList);
        setTenantTree(tree as TenantNode[]);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Laden fehlgeschlagen')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!hasMinRole('admin')) return;
    load();
  }, [hasMinRole]);

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setUsername('');
    setEmail('');
    setFullName('');
    setPassword('');
    setRole('mitarbeiter');
    setTenantId('');
    setIsActive(true);
    setError(null);
  };

  const startEdit = (u: UserListItem) => {
    setEditingId(u.id);
    setShowForm(true);
    setUsername(u.username);
    setEmail(u.email);
    setFullName(u.full_name ?? '');
    setPassword('');
    setRole(u.role);
    setTenantId(u.tenant_id ?? '');
    setIsActive(u.is_active);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        const data: UserUpdateInput = {
          username: username.trim(),
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          role,
          is_active: isActive,
          tenant_id: tenantId === '' ? null : Number(tenantId),
        };
        if (password.trim()) data.password = password.trim();
        await updateUser(editingId, data);
      } else {
        await createUser({
          username: username.trim(),
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          ...(password.trim() ? { password: password.trim() } : {}),
          role,
          tenant_id: tenantId === '' ? undefined : Number(tenantId),
        });
      }
      resetForm();
      load();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Speichern fehlgeschlagen'));
    } finally {
      setSubmitting(false);
    }
  };

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserListItem | null>(null);
  const handleDelete = (u: UserListItem) => {
    if (u.id === currentUser?.id) {
      setError('Du kannst dich nicht selbst löschen.');
      return;
    }
    setConfirmDeleteUser(u);
  };
  const handleConfirmDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    try {
      await deleteUser(confirmDeleteUser.id);
      setConfirmDeleteUser(null);
      load();
      setError(null);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Löschen fehlgeschlagen'));
    }
  };

  if (!hasMinRole('admin')) return null;

  return (
    <div className="p-4 sm:p-6">
      <ConfirmDialog
        open={!!confirmDeleteUser}
        onOpenChange={(open) => !open && setConfirmDeleteUser(null)}
        title="Benutzer löschen?"
        description={
          confirmDeleteUser ? `Benutzer „${confirmDeleteUser.full_name || confirmDeleteUser.username}" wirklich löschen?` : ''
        }
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleConfirmDeleteUser}
      />
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/verwaltung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Verwaltung
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold">Benutzerverwaltung</h1>
      <p className="mt-1 text-muted-foreground">
        Benutzer anlegen, bearbeiten und Rollen zuweisen (nur Admin).
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {showForm && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}</CardTitle>
            <CardDescription>
              {editingId
                ? 'Passwort leer lassen, um es beizubehalten.'
                : 'E-Mail muss der Microsoft-365-Adresse entsprechen. Passwort leer = Anmeldung nur per Microsoft 365. Die Person erhält eine E-Mail mit Anmeldehinweisen.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Benutzername *</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={!!editingId}
                  className={editingId ? 'bg-muted' : ''}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-Mail *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
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
                <label className="mb-1 block text-sm font-medium">
                  Passwort {editingId ? '(leer = unverändert)' : '(optional)'}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={editingId ? undefined : 8}
                  placeholder={editingId ? '••••••••' : 'Leer = nur Microsoft-365-Login'}
                />
                {!editingId && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leer lassen: Person meldet sich nur mit Microsoft 365 an (E-Mail muss übereinstimmen).
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Rolle</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Tenant / Zuordnung</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Keiner —</option>
                  {tenantOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {editingId && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label htmlFor="is_active" className="text-sm">
                    Konto aktiv
                  </label>
                </div>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Speichern …' : editingId ? 'Speichern' : 'Anlegen'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <Button className="mt-6" onClick={() => setShowForm(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Benutzer anlegen
        </Button>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Alle Benutzer</CardTitle>
          <CardDescription>{users.length} Einträge</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Lade …</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground">Keine Benutzer vorhanden.</p>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Anzeigename</th>
                    <th className="pb-2 pr-4 font-medium">E-Mail</th>
                    <th className="pb-2 pr-4 font-medium">Rolle</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2 pr-4" title={u.username}>{u.full_name ?? u.username}</td>
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">{u.display_role ?? u.role}</td>
                      <td className="py-2 pr-4">
                        {u.is_active ? (
                          <Badge variant="default">Aktiv</Badge>
                        ) : (
                          <Badge variant="secondary">Inaktiv</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => startEdit(u)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(u)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? 'Eigenen Account nicht löschen' : 'Löschen'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
