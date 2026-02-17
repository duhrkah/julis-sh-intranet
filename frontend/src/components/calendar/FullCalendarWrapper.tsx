'use client';

import { useEffect, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export interface CalendarEventInput {
  id: number;
  title: string;
  start_date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_url?: string | null;
  description?: string | null;
  organizer?: string | null;
  calendarType?: 'landesverband' | 'kreisverband';
}

/**
 * Event colors using CSS custom properties (defined in globals.css).
 * Fallback hex values for SSR / FullCalendar which needs concrete colors.
 */
function getCSSColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return hsl ? `hsl(${hsl})` : fallback;
}

const EVENT_COLORS = {
  get landesverband() { return getCSSColor('--julis-magenta', '#E6007E'); },
  get kreisverband() { return getCSSColor('--julis-soft-magenta', '#f5b5d2'); },
  get default() { return getCSSColor('--julis-magenta', '#E6007E'); },
};

export interface FullCalendarWrapperProps {
  events: CalendarEventInput[];
  onEventClick?: (event: CalendarEventInput) => void;
  eventUrl?: (event: CalendarEventInput) => string;
  initialView?: 'dayGridMonth' | 'listMonth';
  initialDate?: string;
  height?: string | number;
  hideToolbar?: boolean;
  showViewSwitcher?: boolean;
}

export default function FullCalendarWrapper({
  events,
  onEventClick,
  eventUrl,
  initialView = 'dayGridMonth',
  initialDate,
  height = 600,
  hideToolbar = false,
  showViewSwitcher = true,
}: FullCalendarWrapperProps) {
  const [calendarEvents, setCalendarEvents] = useState<Record<string, unknown>[]>([]);
  const [hoveredEvent, setHoveredEvent] = useState<CalendarEventInput | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const transformed = events.map((event) => {
      const startDateTime = event.start_time
        ? `${event.start_date}T${event.start_time}`
        : event.start_date;
      const endDateTime = event.end_date
        ? event.end_time
          ? `${event.end_date}T${event.end_time}`
          : event.end_date
        : event.start_time
          ? `${event.start_date}T${event.start_time}`
          : event.start_date;
      const color =
        event.calendarType ? EVENT_COLORS[event.calendarType] : EVENT_COLORS.default;
      return {
        id: event.id.toString(),
        title: event.title,
        start: startDateTime,
        end: endDateTime,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { originalEvent: event },
      };
    });
    setCalendarEvents(transformed);
  }, [events]);

  const handleEventClick = useCallback(
    (info: { event: { extendedProps: Record<string, unknown> } }) => {
      const ev = info.event.extendedProps.originalEvent as CalendarEventInput | undefined;
      if (!ev) return;
      if (onEventClick) onEventClick(ev);
      else if (eventUrl && typeof window !== 'undefined') {
        window.location.href = eventUrl(ev);
      }
    },
    [onEventClick, eventUrl]
  );

  const handleEventMouseEnter = useCallback(
    (info: { event: { extendedProps: Record<string, unknown> }; jsEvent: MouseEvent }) => {
      const ev = info.event.extendedProps.originalEvent as CalendarEventInput | undefined;
      if (ev) setHoveredEvent(ev);
      setTooltipPos({ x: info.jsEvent.clientX, y: info.jsEvent.clientY });
    },
    []
  );

  const handleEventMouseLeave = useCallback(() => {
    setHoveredEvent(null);
  }, []);

  const headerToolbar =
    hideToolbar || !showViewSwitcher
      ? false
      : {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,listMonth',
        };

  return (
    <div className="fullcalendar-wrapper relative">
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView={initialView}
        initialDate={initialDate}
        headerToolbar={headerToolbar}
        buttonText={{
          today: 'Heute',
          month: 'Monat',
          list: 'Liste',
        }}
        locale={deLocale}
        events={calendarEvents}
        eventClick={handleEventClick}
        eventMouseEnter={handleEventMouseEnter}
        eventMouseLeave={handleEventMouseLeave}
        height={height}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        displayEventTime
        eventDisplay="block"
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} weitere`}
        titleFormat={{ month: 'long', year: 'numeric' }}
      />

      {/* Hover-Tooltip mit Termin-Details */}
      {hoveredEvent && (
        <div
          className="pointer-events-none fixed z-[100] max-w-sm rounded-lg border border-border bg-card p-3 text-sm shadow-lg"
          style={{
            left: Math.min(tooltipPos.x + 12, typeof window !== 'undefined' ? window.innerWidth - 320 : tooltipPos.x + 12),
            top: Math.min(tooltipPos.y + 8, typeof window !== 'undefined' ? window.innerHeight - 280 : tooltipPos.y + 8),
          }}
        >
          <div className="font-semibold text-foreground">{hoveredEvent.title}</div>
          <div className="mt-1 text-muted-foreground">
            {format(new Date(hoveredEvent.start_date), 'EEEE, d. MMMM yyyy', { locale: de })}
            {hoveredEvent.start_time && (
              <span> · {String(hoveredEvent.start_time).slice(0, 5)} Uhr</span>
            )}
          </div>
          {hoveredEvent.location && (
            <div className="mt-1 text-muted-foreground">{hoveredEvent.location}</div>
          )}
          {hoveredEvent.organizer && (
            <div className="mt-1 text-muted-foreground">Veranstalter: {hoveredEvent.organizer}</div>
          )}
          {hoveredEvent.description && (
            <p className="mt-2 line-clamp-3 text-muted-foreground">{hoveredEvent.description}</p>
          )}
        </div>
      )}
    </div>
  );
}
