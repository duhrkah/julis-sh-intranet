'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, LayoutDashboard } from 'lucide-react';

export default function KalenderAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hasMinRole, loading } = useAuth();

  if (!loading && !hasMinRole('vorstand')) {
    router.replace('/kalender');
    return null;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/kalender"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kalender
        </Link>
        <nav className="flex gap-2">
          <Link
            href="/kalender/admin"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <LayoutDashboard className="mr-1.5 inline h-4 w-4" />
            Übersicht
          </Link>
          <Link
            href="/kalender/admin/freigabe"
            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ClipboardCheck className="mr-1.5 inline h-4 w-4" />
            Terminfreigabe
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
