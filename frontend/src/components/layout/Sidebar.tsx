'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  Calendar,
  Users,
  Building2,
  FileText,
  Settings,
  LayoutDashboard,
  Mail,
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

export function Sidebar() {
  const pathname = usePathname();
  const { hasMinRole, canAccessMemberChanges } = useAuth();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <Image src="/logo.svg" alt="JuLis SH" width={140} height={40} className="h-10 w-auto" priority />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const allowed = item.href === '/mitglieder' ? canAccessMemberChanges() : hasMinRole(item.minRole);
          if (!allowed) return null;
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
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
    </aside>
  );
}
