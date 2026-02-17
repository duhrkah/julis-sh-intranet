'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogOut, Menu, Settings } from 'lucide-react';
import Link from 'next/link';

type HeaderProps = { onMenuClick?: () => void };

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout, displayRole } = useAuth();

  const initials = user
    ? user.full_name
      ? user.full_name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase() || user.username[0]
      : user.username.slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-4">
      <div className="flex flex-1 items-center gap-2">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label="Menü öffnen">
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
              <p className="text-xs text-muted-foreground">{displayRole}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/einstellungen" className="flex cursor-pointer items-center gap-2">
              <Settings className="h-4 w-4" />
              Einstellungen
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
