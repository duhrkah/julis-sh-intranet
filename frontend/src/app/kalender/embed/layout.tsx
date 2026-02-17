import { Suspense } from 'react';

/**
 * Embed-Layout: kein zusätzlicher Rahmen, minimal für iframe.
 * Kein AppShell (wird in AppShell ausgeschlossen).
 */
export default function KalenderEmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-3 text-sm text-muted-foreground">Lade …</div>}>
      {children}
    </Suspense>
  );
}
