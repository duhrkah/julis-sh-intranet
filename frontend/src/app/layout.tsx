import type { Metadata, Viewport } from 'next';
import { Anybody } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AppShell } from '@/components/layout/AppShell';

const anybody = Anybody({
  subsets: ['latin'],
  variable: '--font-anybody',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JuLis SH Intranet',
  description: 'Internes Verwaltungssystem der Jungen Liberalen Schleswig-Holstein',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

/** Setzt Dark/Light-Klasse vor dem ersten Paint (vermeidet Flackern). Embed-Kalender immer Light. */
function ThemeScript() {
  const script = `
    (function() {
      var path = window.location.pathname || '';
      var isEmbed = path === '/kalender/embed' || path.indexOf('/kalender/embed/') === 0;
      if (isEmbed) {
        document.documentElement.classList.add('light');
        return;
      }
      var key = 'julis-intranet-theme';
      var stored = localStorage.getItem(key);
      var dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.add(dark ? 'dark' : 'light');
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={anybody.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
