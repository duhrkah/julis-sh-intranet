'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getPublicCalendars,
  getPublicEvents,
  type PublicEvent,
  type CalendarType,
} from '@/lib/api/publicCalendar';
import FullCalendarWrapper from '@/components/calendar/FullCalendarWrapper';

type CalendarFilter = 'all' | CalendarType;

const CALENDAR_FILTER_OPTIONS: { value: CalendarFilter; label: string }[] = [
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

export type EventWithCalendar = PublicEvent & { calendarType: CalendarType };

export default function KalenderEmbedPage() {
  const searchParams = useSearchParams();
  const [calendars, setCalendars] = useState<{
    landesverband: { id: number; name: string; slug: string } | null;
    kreisverband: { id: number; name: string; slug: string }[];
  } | null>(null);
  const [allEvents, setAllEvents] = useState<EventWithCalendar[]>([]);
  const [loading, setLoading] = useState(true);

  const { start_date, end_date, initialDate, initialFilter } = useMemo(() => {
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const cal = searchParams.get('calendar');
    const calendarTyped: CalendarFilter =
      cal === 'landesverband' || cal === 'kreisverband' ? cal : 'all';
    let start_date: string;
    let end_date: string;
    let initialDate: string;
    if (month && year) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        const range = getMonthRange(y, m);
        start_date = range.start_date;
        end_date = range.end_date;
        initialDate = `${y}-${String(m).padStart(2, '0')}-01`;
      } else {
        const n = new Date();
        const def = getMonthRange(n.getFullYear(), n.getMonth() + 1);
        start_date = def.start_date;
        end_date = def.end_date;
        initialDate = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
      }
    } else {
      const n = new Date();
      const def = getMonthRange(n.getFullYear(), n.getMonth() + 1);
      start_date = def.start_date;
      end_date = def.end_date;
      initialDate = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
    }
    return { start_date, end_date, initialDate, initialFilter: calendarTyped };
  }, [searchParams]);

  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>(initialFilter);

  useEffect(() => {
    setCalendarFilter(initialFilter);
  }, [initialFilter]);

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
      setLoading(false);
      return;
    }
    const from = new Date(start_date);
    const to = new Date(end_date);
    const fromExtended = new Date(from.getFullYear(), from.getMonth() - 2, 1);
    const toExtended = new Date(to.getFullYear(), to.getMonth() + 3, 0);
    const range = {
      start_date: fromExtended.toISOString().slice(0, 10),
      end_date: toExtended.toISOString().slice(0, 10),
    };
    const lvPromise = calendars.landesverband
      ? getPublicEvents({ ...range, calendar: 'landesverband', limit: 200 })
      : Promise.resolve([] as PublicEvent[]);
    const kvPromise = calendars.kreisverband?.length
      ? getPublicEvents({ ...range, calendar: 'kreisverband', limit: 200 })
      : Promise.resolve([] as PublicEvent[]);
    Promise.all([lvPromise, kvPromise])
      .then(([lvEvents, kvEvents]) => {
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
      })
      .catch(() => setAllEvents([]))
      .finally(() => setLoading(false));
  }, [calendars, start_date, end_date]);

  const filteredEvents = useMemo(() => {
    if (calendarFilter === 'all') return allEvents;
    return allEvents.filter((e) => e.calendarType === calendarFilter);
  }, [allEvents, calendarFilter]);

  return (
    <div className="min-h-full min-w-0 bg-background p-2 sm:p-3">
      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Lade …</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium text-muted-foreground">Kalender:</span>
            <div className="flex flex-wrap rounded-md border border-input bg-muted/30 p-0.5">
              {CALENDAR_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCalendarFilter(opt.value)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
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
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" /> LV
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-muted align-middle" /> KV
            </span>
          </div>
          <FullCalendarWrapper
            key={`${initialDate}-${calendarFilter}`}
            initialView="dayGridMonth"
            initialDate={initialDate}
            height={400}
            hideToolbar={false}
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
        </>
      )}
    </div>
  );
}
