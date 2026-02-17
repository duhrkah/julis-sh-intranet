'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getKreisverbande,
  createKreisverband,
  updateKreisverband,
  deleteKreisverband,
  type Kreisverband,
} from '@/lib/api/kreisverband';
import {
  getTenantTree,
  createTenant,
  updateTenant,
  deleteTenant,
  type TenantTree as TenantTreeNode,
} from '@/lib/api/tenants';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

function flattenTenants(nodes: TenantTreeNode[]): { id: number; name: string; slug: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, slug: n.slug },
    ...flattenTenants(n.children ?? [])],
  );
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[ää]/g, 'ae')
    .replace(/[öö]/g, 'oe')
    .replace(/[üü]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9-]/g, '');
}

export default function VerwaltungKreisePage() {
  const { hasMinRole } = useAuth();
  const [list, setList] = useState<Kreisverband[]>([]);
  const [tenantTree, setTenantTree] = useState<TenantTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingKv, setEditingKv] = useState<Kreisverband | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [kuerzel, setKuerzel] = useState('');
  const [email, setEmail] = useState('');
  const [istAktiv, setIstAktiv] = useState(true);

  const lvId = useMemo(() => {
    const roots = tenantTree.filter((t) => !t.parent_id);
    return roots.length === 1 ? roots[0].id : null;
  }, [tenantTree]);

  const tenantById = useMemo(() => {
    const flat = flattenTenants(tenantTree);
    const map: Record<number, { name: string; slug: string }> = {};
    flat.forEach((t) => { map[t.id] = { name: t.name, slug: t.slug }; });
    return map;
  }, [tenantTree]);

  const load = () => {
    setLoading(true);
    Promise.all([getKreisverbande(), getTenantTree()])
      .then(([kvs, tree]) => {
        setList(kvs);
        setTenantTree(tree as TenantTreeNode[]);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Laden fehlgeschlagen')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!hasMinRole('admin')) return;
    load();
  }, [hasMinRole]);

  const resetForm = () => {
    setEditingKv(null);
    setShowForm(false);
    setName('');
    setSlug('');
    setKuerzel('');
    setEmail('');
    setIstAktiv(true);
    setError(null);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (kv: Kreisverband) => {
    setEditingKv(kv);
    setShowForm(true);
    setName(kv.name.replace(/^JuLis\s+/i, ''));
    setSlug(tenantById[kv.tenant_id!]?.slug?.replace(/^julis-/, '') ?? '');
    setKuerzel(kv.kuerzel ?? '');
    setEmail(kv.email ?? '');
    setIstAktiv(kv.ist_aktiv);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const slugVal = slug.trim() || slugFromName(name);
    const tenantSlug = slugVal.startsWith('julis-') ? slugVal : `julis-${slugVal}`;
    const tenantName = name.trim().startsWith('JuLis ') ? name.trim() : `JuLis ${name.trim()}`;

    try {
      if (editingKv) {
        await updateKreisverband(editingKv.id, {
          name: tenantName,
          kuerzel: kuerzel.trim() || undefined,
          email: email.trim() || undefined,
          ist_aktiv: istAktiv,
        });
        if (editingKv.tenant_id) {
          await updateTenant(editingKv.tenant_id, { name: tenantName, is_active: istAktiv });
        }
      } else {
        if (!lvId) {
          setError('Kein Landesverband gefunden. Bitte zuerst Stammdaten anlegen.');
          setSubmitting(false);
          return;
        }
        const tenant = await createTenant({
          name: tenantName,
          slug: tenantSlug,
          level: 'kreisverband',
          parent_id: lvId,
          is_active: true,
        });
        await createKreisverband({
          name: tenantName,
          kuerzel: kuerzel.trim() || undefined,
          email: email.trim() || undefined,
          tenant_id: tenant.id,
          ist_aktiv: true,
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

  const [confirmDeactivate, setConfirmDeactivate] = useState<Kreisverband | null>(null);
  const handleDelete = (kv: Kreisverband) => setConfirmDeactivate(kv);
  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivate) return;
    try {
      await updateKreisverband(confirmDeactivate.id, { ist_aktiv: false });
      if (confirmDeactivate.tenant_id) await deleteTenant(confirmDeactivate.tenant_id);
      setError(null);
      setConfirmDeactivate(null);
      load();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Löschen fehlgeschlagen'));
    }
  };

  if (!hasMinRole('admin')) return null;

  return (
    <div className="p-4 sm:p-6">
      <ConfirmDialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
        title="Kreis deaktivieren?"
        description={
          confirmDeactivate
            ? `Kreis „${confirmDeactivate.name}" wirklich deaktivieren? Er erscheint dann nicht mehr in Auswahlen.`
            : ''
        }
        confirmLabel="Deaktivieren"
        variant="destructive"
        onConfirm={handleConfirmDeactivate}
      />
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/verwaltung" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Verwaltung
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold">Kreise verwalten</h1>
      <p className="mt-1 text-muted-foreground">
        Neue Kreisverbände anlegen, bestehende bearbeiten oder deaktivieren. Deaktivierte Kreise erscheinen in Auswahlen nicht mehr (nur Administrator).
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {showForm && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{editingKv ? 'Kreis bearbeiten' : 'Neuer Kreis'}</CardTitle>
            <CardDescription>
              {editingKv
                ? 'Name, Kürzel und E-Mail. Der Tenant-Slug wird nicht geändert.'
                : 'Es wird ein Tenant (Organisationseinheit) und ein Kreisverband angelegt.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 max-w-lg">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingKv && !slug) setSlug(slugFromName(e.target.value));
                  }}
                  placeholder="z. B. Flensburg"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Slug (Tenant-URL)</label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="z. B. fl (wird zu julis-fl)"
                  disabled={!!editingKv}
                  className={editingKv ? 'bg-muted' : ''}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Kürzel</label>
                <Input
                  value={kuerzel}
                  onChange={(e) => setKuerzel(e.target.value)}
                  placeholder="z. B. FL"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kv@beispiel.de"
                />
              </div>
              {editingKv && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    id="ist_aktiv"
                    checked={istAktiv}
                    onChange={(e) => setIstAktiv(e.target.checked)}
                  />
                  <label htmlFor="ist_aktiv" className="text-sm">
                    Kreis aktiv (in Auswahlen sichtbar)
                  </label>
                </div>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Speichern …' : editingKv ? 'Speichern' : 'Anlegen'}
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
        <Button className="mt-6" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" /> Kreis anlegen
        </Button>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Alle Kreisverbände
          </CardTitle>
          <CardDescription>{list.length} Einträge</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Lade …</p>
          ) : list.length === 0 ? (
            <p className="text-muted-foreground">Keine Kreisverbände angelegt.</p>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Kürzel</th>
                    <th className="pb-2 pr-4 font-medium">Tenant-Slug</th>
                    <th className="pb-2 pr-4 font-medium">E-Mail</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((kv) => (
                    <tr key={kv.id} className="border-b">
                      <td className="py-2 pr-4">{kv.name}</td>
                      <td className="py-2 pr-4">{kv.kuerzel ?? '—'}</td>
                      <td className="py-2 pr-4">
                        {kv.tenant_id ? tenantById[kv.tenant_id]?.slug ?? `#${kv.tenant_id}` : '—'}
                      </td>
                      <td className="py-2 pr-4">{kv.email ?? '—'}</td>
                      <td className="py-2 pr-4">
                        {kv.ist_aktiv ? (
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
                          onClick={() => startEdit(kv)}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(kv)}
                          title="Deaktivieren"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/kreisverband/${kv.id}`}>Details</Link>
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
