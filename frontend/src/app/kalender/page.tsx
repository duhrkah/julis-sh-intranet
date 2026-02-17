'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getEvents } from '@/lib/api/events';
import { getTenantTree } from '@/lib/api/tenants';
import { getApiErrorMessage } from '@/lib/apiError';
import type { Event } from '@/lib/api/events';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FullCalendarWrapper from '@/components/calendar/FullCalendarWrapper';
import { Calendar, Plus, MapPin, CalendarDays, List } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

type CalendarType = 'landesverband' | 'kreisverband';

const CALENDAR_STYLES: Record<CalendarType, { border: string; badge: string; label: string }> = {
  landesverband: {
    border: 'border-l-4 border-l-primary',
    badge: 'bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary',
    label: 'Landesverband',
  },
  kreisverband: {
    border: 'border-l-4 border-l-muted',
    badge: 'bg-muted/70 text-muted-foreground dark:bg-muted/50 dark:text-muted-foreground',
    label: 'Kreisverbände',
  },
};

const CALENDAR_FILTER_OPTIONS: { value: 'all' | CalendarType; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'landesverband', label: 'Landesverband' },
  { value: 'kreisverband', label: 'Kreisverbände' },
];

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

/** Tenant tree: roots = Landesverband. Return Set of their ids. */
function getLandesverbandTenantIds(tree: { id: number; parent_id: number | null }[]): Set<number> {
  return new Set(tree.filter((n) => n.parent_id === null).map((n) => n.id));
}

export type EventWithCalendar = Event & { calendarType: CalendarType };

export default function KalenderPage() {
  const { hasMinRole } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [landesverbandIds, setLandesverbandIds] = useState<Set<number>>(new Set());
  const [calendarFilter, setCalendarFilter] = useState<'all' | CalendarType>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!hasMinRole('mitarbeiter')) return;
    getTenantTree()
      .then((tree) => setLandesverbandIds(getLandesverbandTenantIds(tree)))
      .catch(() => setLandesverbandIds(new Set()));
  }, [hasMinRole]);

  useEffect(() => {
    if (!hasMinRole('mitarbeiter')) return;
    const [y, m] = filterMonth.split('-').map(Number);
    const { start_date, end_date } = getMonthRange(y, m);
    const range =
      viewMode === 'calendar'
        ? (() => {
            const from = new Date(y, m - 1 - 2, 1);
            const to = new Date(y, m + 2, 0);
            return {
              start_date: from.toISOString().slice(0, 10),
              end_date: to.toISOString().slice(0, 10),
            };
          })()
        : { start_date, end_date };
    setLoading(true);
    setError(null);
    getEvents({ ...range, limit: 200 })
      .then(setEvents)
      .catch((e) => {
        setError(getApiErrorMessage(e, 'Fehler beim Laden'));
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [hasMinRole, filterMonth, viewMode]);

  const eventsWithCalendar: EventWithCalendar[] = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        calendarType: (landesverbandIds.has(e.tenant_id) ? 'landesverband' : 'kreisverband') as CalendarType,
      })),
    [events, landesverbandIds]
  );

  const filteredEvents = useMemo(() => {
    if (calendarFilter === 'all') return eventsWithCalendar;
    return eventsWithCalendar.filter((e) => e.calendarType === calendarFilter);
  }, [eventsWithCalendar, calendarFilter]);

  if (!hasMinRole('mitarbeiter')) return null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kalender</h1>
          <p className="mt-1 text-muted-foreground">
            Veranstaltungen und Termine – Landesverband und Kreisverbände.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/kalender/neu">
              <Plus className="mr-2 h-4 w-4" /> Event anlegen
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/kalender/oeffentlich" target="_blank" rel="noopener noreferrer">
              Öffentlicher Kalender
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/kalender/einreichen" target="_blank" rel="noopener noreferrer">
              Termin einreichen
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Kalender:</span>
          <div className="flex rounded-lg border border-input bg-muted/30 p-1">
            {CALENDAR_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCalendarFilter(opt.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  calendarFilter === opt.value
                    ? 'bg-background text-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-primary align-middle" /> LV{' '}
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-muted align-middle" /> KV
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Ansicht:</span>
          <div className="flex rounded-lg border border-input bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Kalender
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" /> Liste
            </button>
          </div>
        </div>
        {viewMode === 'list' && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Monat:</label>
            <input
              type="month"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">Lade …</p>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Keine Events in diesem Zeitraum.</p>
            <Button asChild className="mt-4">
              <Link href="/kalender/neu">Event anlegen</Link>
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'calendar' ? (
        <FullCalendarWrapper
          key={filterMonth}
          initialView="dayGridMonth"
          initialDate={`${filterMonth}-01`}
          height={600}
          showViewSwitcher
          events={filteredEvents.map((e) => ({
            id: e.id,
            title: e.title,
            start_date: e.start_date,
            start_time: e.start_time,
            end_date: e.end_date,
            end_time: e.end_time,
            location: e.location,
            location_url: e.location_url,
            description: e.description,
            organizer: e.organizer,
            calendarType: e.calendarType,
          }))}
          eventUrl={(ev) => `/kalender/${ev.id}`}
        />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event: EventWithCalendar) => {
            const style = CALENDAR_STYLES[event.calendarType];
            return (
              <Link key={event.id} href={`/kalender/${event.id}`}>
                <Card
                  className={`transition-colors hover:border-primary/50 hover:bg-muted/30 ${style.border}`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{event.title}</CardTitle>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                        {style.label}
                      </span>
                      <Badge variant={STATUS_VARIANT[event.status] ?? 'secondary'}>
                        {STATUS_LABEL[event.status] ?? event.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      {format(new Date(event.start_date), 'EEEE, d. MMMM yyyy', { locale: de })}
                      {event.start_time && (
                        <span> · {String(event.start_time).slice(0, 5)} Uhr</span>
                      )}
                    </p>
                    {event.location && (
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {event.location}
                      </p>
                    )}
                    {event.organizer && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Veranstalter: {event.organizer}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
