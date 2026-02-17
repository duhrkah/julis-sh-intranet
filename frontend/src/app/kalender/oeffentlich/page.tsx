'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  getPublicCalendars,
  getPublicEvents,
  getPublicCategories,
  type PublicEvent,
  type PublicCategory,
  type CalendarType,
} from '@/lib/api/publicCalendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FullCalendarWrapper from '@/components/calendar/FullCalendarWrapper';
import { Calendar, MapPin, ExternalLink, CalendarDays, List } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export type EventWithCalendar = PublicEvent & { calendarType: CalendarType };

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

const CALENDAR_FILTER_OPTIONS: { value: 'all' | CalendarType; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'landesverband', label: 'Landesverband' },
  { value: 'kreisverband', label: 'Kreisverbände' },
];

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

export default function KalenderOeffentlichPage() {
  const [calendars, setCalendars] = useState<{
    landesverband: { id: number; name: string; slug: string } | null;
    kreisverband: { id: number; name: string; slug: string }[];
  } | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<'all' | CalendarType>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [allEvents, setAllEvents] = useState<EventWithCalendar[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  useEffect(() => {
    getPublicCalendars()
      .then(setCalendars)
      .catch(() => setCalendars(null));
  }, []);

  useEffect(() => {
    const hasAny =
      calendars?.landesverband || (calendars?.kreisverband && calendars.kreisverband.length > 0);
    if (!hasAny) {
      setAllEvents([]);
      setCategories([]);
      setLoading(false);
      return;
    }
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

    const lvPromise = calendars.landesverband
      ? getPublicEvents({ ...range, category_id: categoryId, calendar: 'landesverband', limit: 200 })
      : Promise.resolve([] as PublicEvent[]);
    const kvPromise = calendars.kreisverband?.length
      ? getPublicEvents({ ...range, category_id: categoryId, calendar: 'kreisverband', limit: 200 })
      : Promise.resolve([] as PublicEvent[]);

    Promise.all([
      Promise.all([lvPromise, kvPromise]),
      getPublicCategories({}),
    ])
      .then(([[lvEvents, kvEvents], categoriesData]) => {
        const merged: EventWithCalendar[] = [
          ...lvEvents.map((e) => ({ ...e, calendarType: 'landesverband' as CalendarType })),
          ...kvEvents.map((e) => ({ ...e, calendarType: 'kreisverband' as CalendarType })),
        ];
        merged.sort(
          (a, b) =>
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime() ||
            String(a.start_time || '').localeCompare(String(b.start_time || ''))
        );
        setAllEvents(merged);
        setCategories(categoriesData);
      })
      .catch(() => {
        setError('Termine konnten nicht geladen werden.');
        setAllEvents([]);
      })
      .finally(() => setLoading(false));
  }, [calendars, filterMonth, categoryId, viewMode]);

  const filteredEvents = useMemo(() => {
    if (calendarFilter === 'all') return allEvents;
    return allEvents.filter((e) => e.calendarType === calendarFilter);
  }, [allEvents, calendarFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold sm:text-2xl">JuLis SH – Öffentlicher Kalender</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Landesverband und Kreisverbände – genehmigte Termine
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/kalender/einreichen">
                  <ExternalLink className="mr-1.5 h-4 w-4" />
                  Termin einreichen (Kreisverband)
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login (Intranet)</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Filter: Alle | Landesverband | Kreisverbände */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
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
              <span className="inline-block h-2 w-2 rounded-full bg-primary align-middle" />{' '}
              Landesverband{' '}
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-muted align-middle" />{' '}
              Kreisverbände
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
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Kategorie:</span>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Alle</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!calendars?.landesverband && (!calendars?.kreisverband || calendars.kreisverband.length === 0) && (
          <p className="text-muted-foreground">Keine Kalender konfiguriert.</p>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Lade Termine …</p>
        ) : filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-2 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Keine Termine in diesem Zeitraum.</p>
              <Button variant="outline" asChild className="mt-4">
                <Link href="/kalender/einreichen">Termin einreichen</Link>
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
          />
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => {
              const style = CALENDAR_STYLES[event.calendarType];
              return (
                <Card
                  key={event.id}
                  className={`transition-colors hover:border-primary/30 ${style.border}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{event.title}</CardTitle>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      {format(new Date(event.start_date), 'EEEE, d. MMMM yyyy', { locale: de })}
                      {event.start_time && (
                        <span> · {String(event.start_time).slice(0, 5)} Uhr</span>
                      )}
                    </p>
                    {event.location && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        {event.location}
                      </p>
                    )}
                    {event.organizer && (
                      <p className="text-sm text-muted-foreground">
                        Veranstalter: {event.organizer}
                      </p>
                    )}
                    {event.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
