'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { getAppVersion, updateAppVersion } from '@/lib/api/settings';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Calendar,
  Users,
  Building2,
  FileText,
  Settings,
  LayoutDashboard,
  ClipboardList,
  ClipboardCheck,
} from 'lucide-react';

const navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; minRole: 'mitarbeiter' | 'vorstand' | 'leitung' | 'admin' }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, minRole: 'mitarbeiter' },
  { href: '/kalender', label: 'Kalender', icon: Calendar, minRole: 'mitarbeiter' },
  { href: '/kalender/admin/freigabe', label: 'Terminfreigabe', icon: ClipboardCheck, minRole: 'vorstand' },
  { href: '/mitglieder', label: 'Mitgliederänderungen', icon: Users, minRole: 'mitarbeiter' },
  { href: '/kreisverband', label: 'Kreisverbände', icon: Building2, minRole: 'mitarbeiter' },
  { href: '/dokumente/satzung', label: 'Dokumente', icon: FileText, minRole: 'vorstand' },
  { href: '/dokumente/sitzungen', label: 'Sitzungen', icon: ClipboardList, minRole: 'mitarbeiter' },
];

const adminItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; minRole: 'admin' }[] = [
  { href: '/verwaltung', label: 'Verwaltung', icon: Settings, minRole: 'admin' },
];

type SidebarProps = { mobileOpen?: boolean; onMobileClose?: () => void };

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { hasMinRole, canAccessMemberChanges } = useAuth();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [bumpType, setBumpType] = useState<'patch' | 'minor' | 'major'>('patch');
  const [customVersion, setCustomVersion] = useState('');
  const [versionSaving, setVersionSaving] = useState(false);

  useEffect(() => {
    getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  const bumpVersion = (current: string, type: 'patch' | 'minor' | 'major'): string => {
    const parts = current.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return current;
    if (type === 'major') return `${parts[0] + 1}.0.0`;
    if (type === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  };

  const handleVersionBump = async () => {
    if (!appVersion) return;
    setVersionSaving(true);
    const newVersion = customVersion.trim() || bumpVersion(appVersion, bumpType);
    try {
      const updated = await updateAppVersion(newVersion);
      setAppVersion(updated);
      setShowVersionDialog(false);
      setCustomVersion('');
    } catch {
      // Fehler still ignorieren
    } finally {
      setVersionSaving(false);
    }
  };

  const navContent = (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground" onClick={onMobileClose}>
          <Image src="/logo.svg" alt="JuLis SH" width={140} height={40} className="h-10 w-auto" priority />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const allowed = item.href === '/mitglieder' ? canAccessMemberChanges() : hasMinRole(item.minRole);
          if (!allowed) return null;
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/10'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        {hasMinRole('admin') &&
          adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/10'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
      </nav>
      {appVersion && (
        <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
          {hasMinRole('admin') ? (
            <button
              type="button"
              onClick={() => {
                setCustomVersion('');
                setBumpType('patch');
                setShowVersionDialog(true);
              }}
              className="text-xs text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
            >
              v{appVersion}
            </button>
          ) : (
            <span className="text-xs text-sidebar-foreground/50">v{appVersion}</span>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile: Backdrop + drawer */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menü schließen"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
          'w-56 shrink-0',
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out md:relative md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {navContent}
      </aside>

      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Version erhöhen</DialogTitle>
            <DialogDescription>
              Aktuelle Version: <strong>{appVersion}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['patch', 'minor', 'major'] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={bumpType === type && !customVersion ? 'default' : 'outline'}
                  onClick={() => { setBumpType(type); setCustomVersion(''); }}
                  className="flex-1"
                >
                  <span className="flex flex-col items-center">
                    <span className="text-xs capitalize">{type}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {appVersion ? bumpVersion(appVersion, type) : ''}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Oder manuell eingeben:</label>
              <Input
                value={customVersion}
                onChange={(e) => setCustomVersion(e.target.value)}
                placeholder="z.B. 2.0.0-beta"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowVersionDialog(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleVersionBump} disabled={versionSaving}>
                {versionSaving ? 'Speichern …' : `Auf ${customVersion.trim() || (appVersion ? bumpVersion(appVersion, bumpType) : '')} setzen`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
