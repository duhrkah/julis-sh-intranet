'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getEventById,
  updateEvent,
  deleteEvent,
  approveEvent,
  rejectEvent,
  type Event,
  type EventUpdateInput,
} from '@/lib/api/events';
import { getApiErrorMessage } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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

export default function KalenderEventPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { hasMinRole, user, isAdmin } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLocationUrl, setEditLocationUrl] = useState('');
  const [editOrganizer, setEditOrganizer] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);

  useEffect(() => {
    if (!hasMinRole('mitarbeiter') || !id) return;
    getEventById(id)
      .then((e) => {
        setEvent(e);
        setEditTitle(e.title);
        setEditDescription(e.description ?? '');
        setEditStartDate(e.start_date.slice(0, 10));
        setEditStartTime(e.start_time ? String(e.start_time).slice(0, 5) : '');
        setEditEndDate(e.end_date ? e.end_date.slice(0, 10) : '');
        setEditEndTime(e.end_time ? String(e.end_time).slice(0, 5) : '');
        setEditLocation(e.location ?? '');
        setEditLocationUrl(e.location_url ?? '');
        setEditOrganizer(e.organizer ?? '');
        setEditIsPublic(e.is_public);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Fehler beim Laden')))
      .finally(() => setLoading(false));
  }, [id, hasMinRole]);

  const canEdit = event && (event.submitter_id === user?.id || hasMinRole('vorstand'));
  const canDelete = event && (event.submitter_id === user?.id || isAdmin);
  const canApproveReject = event && event.status === 'pending' && hasMinRole('vorstand');

  const handleSave = async () => {
    if (!event) return;
    setSaving(true);
    setError(null);
    const data: EventUpdateInput = {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      start_date: editStartDate,
      start_time: editStartTime || undefined,
      end_date: editEndDate || undefined,
      end_time: editEndTime || undefined,
      location: editLocation.trim() || undefined,
      location_url: editLocationUrl.trim() || undefined,
      organizer: editOrganizer.trim() || undefined,
      is_public: editIsPublic,
    };
    try {
      const updated = await updateEvent(event.id, data);
      setEvent(updated);
      setEditing(false);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler beim Speichern'));
    } finally {
      setSaving(false);
    }
  };

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const handleDelete = () => setConfirmDeleteEvent(true);
  const handleConfirmDelete = async () => {
    if (!event) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEvent(event.id);
      setConfirmDeleteEvent(false);
      router.push('/kalender');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler beim Löschen'));
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async () => {
    if (!event) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await approveEvent(event.id);
      setEvent(updated);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler'));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!event || !rejectReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await rejectEvent(event.id, rejectReason.trim());
      setEvent(updated);
      setShowReject(false);
      setRejectReason('');
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Fehler'));
    } finally {
      setSaving(false);
    }
  };

  if (!hasMinRole('mitarbeiter')) return null;
  if (loading) return <div className="p-6"><p className="text-muted-foreground">Lade …</p></div>;
  if (error && !event) {
    return (
      <div className="p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" className="mt-4" asChild><Link href="/kalender">Zurück</Link></Button>
      </div>
    );
  }
  if (!event) return null;

  return (
    <div className="p-6">
      <ConfirmDialog
        open={confirmDeleteEvent}
        onOpenChange={setConfirmDeleteEvent}
        title="Event löschen?"
        description="Event wirklich löschen?"
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href="/kalender" className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[event.status] ?? 'secondary'}>
              {STATUS_LABEL[event.status] ?? event.status}
            </Badge>
            {event.submitter_name && (
              <span className="text-sm text-muted-foreground">
                eingereicht von {event.submitter_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canApproveReject && (
            <>
              <Button size="sm" onClick={handleApprove} disabled={saving}>
                Genehmigen
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setShowReject(true)} disabled={saving}>
                Ablehnen
              </Button>
            </>
          )}
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Bearbeiten
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Löschen …' : 'Löschen'}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {showReject && (
        <Card className="mb-6 border-destructive/50">
          <CardHeader>
            <CardTitle>Event ablehnen</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="mb-3 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Grund der Ablehnung (wird dem Einreicher angezeigt) …"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={saving || !rejectReason.trim()}>
                Ablehnung speichern
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowReject(false); setRejectReason(''); }}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editing ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Event bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Titel *</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Beschreibung</label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Startdatum *</label>
                <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Startzeit</label>
                <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Enddatum</label>
                <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Endzeit</label>
                <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ort</label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Link</label>
              <Input type="url" value={editLocationUrl} onChange={(e) => setEditLocationUrl(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Veranstalter *</label>
              <Input value={editOrganizer} onChange={(e) => setEditOrganizer(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_is_public"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="edit_is_public" className="text-sm">Öffentlich</label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Speichern …' : 'Speichern'}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-6">
            {event.description && (
              <p className="mb-4 whitespace-pre-wrap text-sm">{event.description}</p>
            )}
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              {format(new Date(event.start_date), 'EEEE, d. MMMM yyyy', { locale: de })}
              {event.start_time && ` · ${String(event.start_time).slice(0, 5)} Uhr`}
              {event.end_date && event.end_date !== event.start_date && (
                ` – ${format(new Date(event.end_date), 'd. MMM yyyy', { locale: de })}`
              )}
              {event.end_time && ` · ${String(event.end_time).slice(0, 5)} Uhr`}
            </p>
            {event.location && (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0" />
                {event.location_url ? (
                  <a href={event.location_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {event.location}
                  </a>
                ) : (
                  event.location
                )}
              </p>
            )}
            {event.organizer && (
              <p className="mt-2 text-sm text-muted-foreground">Veranstalter: {event.organizer}</p>
            )}
            {event.status === 'rejected' && event.rejection_reason && (
              <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                Ablehnungsgrund: {event.rejection_reason}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
