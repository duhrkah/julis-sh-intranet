'use client';

import { useTheme } from './ThemeProvider';
import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();

  const toggle = () => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={toggle}
      title={resolved === 'dark' ? 'Hell modus' : 'Dark modus'}
      aria-label={resolved === 'dark' ? 'Zu Hellmodus wechseln' : 'Zu Darkmodus wechseln'}
    >
      {resolved === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
