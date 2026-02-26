'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, MapPin, ExternalLink, Paperclip, User } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { CalendarEventInput } from './FullCalendarWrapper';

interface EventDetailDialogProps {
  event: CalendarEventInput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachmentUrl?: (eventId: number, attachmentId: number) => string;
}

function formatDateRange(event: CalendarEventInput): string {
  const startFormatted = format(new Date(event.start_date), 'EEEE, d. MMMM yyyy', { locale: de });
  const startTime = event.start_time ? String(event.start_time).slice(0, 5) : null;

  const hasEnd = event.end_date && event.end_date !== event.start_date;
  const endTime = event.end_time ? String(event.end_time).slice(0, 5) : null;

  if (hasEnd) {
    const endFormatted = format(new Date(event.end_date!), 'EEEE, d. MMMM yyyy', { locale: de });
    const startStr = startTime ? `${startFormatted}, ${startTime} Uhr` : startFormatted;
    const endStr = endTime ? `${endFormatted}, ${endTime} Uhr` : endFormatted;
    return `${startStr} – ${endStr}`;
  }

  if (startTime && endTime) {
    return `${startFormatted}, ${startTime} – ${endTime} Uhr`;
  }
  if (startTime) {
    return `${startFormatted}, ${startTime} Uhr`;
  }
  return startFormatted;
}

const CALENDAR_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  landesverband: {
    label: 'Landesverband',
    className: 'bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary',
  },
  kreisverband: {
    label: 'Kreisverbände',
    className: 'bg-muted/70 text-muted-foreground dark:bg-muted/50 dark:text-muted-foreground',
  },
};

export default function EventDetailDialog({
  event,
  open,
  onOpenChange,
  attachmentUrl,
}: EventDetailDialogProps) {
  if (!event) return null;

  const calType = event.calendarType ? CALENDAR_TYPE_LABELS[event.calendarType] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg">{event.title}</DialogTitle>
            {calType && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${calType.className}`}>
                {calType.label}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{formatDateRange(event)}</span>
          </div>

          {event.location && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {event.location_url ? (
                <a
                  href={event.location_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {event.location}
                  <ExternalLink className="ml-1 inline h-3 w-3" />
                </a>
              ) : (
                <span>{event.location}</span>
              )}
            </div>
          )}

          {event.organizer && (
            <div className="flex items-start gap-2 text-sm">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Veranstalter: {event.organizer}</span>
            </div>
          )}

          {event.description && (
            <div className="border-t pt-3">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {event.description}
              </p>
            </div>
          )}

          {event.attachments && event.attachments.length > 0 && (
            <div className="border-t pt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <Paperclip className="h-4 w-4 shrink-0" />
                Anhänge ({event.attachments.length})
              </p>
              <ul className="ml-5 space-y-1">
                {event.attachments.map((att) => (
                  <li key={att.id} className="text-sm">
                    {attachmentUrl ? (
                      <a
                        href={attachmentUrl(event.id, att.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {att.original_name}
                      </a>
                    ) : (
                      <span>{att.original_name}</span>
                    )}
                    <span className="ml-1 text-muted-foreground">
                      ({(att.file_size / 1024).toFixed(0)} KB)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
