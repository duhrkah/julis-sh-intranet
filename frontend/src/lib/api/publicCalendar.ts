/**
 * Öffentliche Kalender-API (nur genehmigte Events) – ohne Authentifizierung.
 * Für öffentliche Ansicht und Embed.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export type CalendarType = 'landesverband' | 'kreisverband';

export interface TenantPublicShort {
  id: number;
  name: string;
  slug: string;
}

export interface PublicCalendarsResponse {
  landesverband: TenantPublicShort | null;
  kreisverband: TenantPublicShort[];
}

export interface PublicEvent {
  id: number;
  title: string;
  description?: string | null;
  start_date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_url?: string | null;
  organizer?: string | null;
  category_id?: number | null;
  [key: string]: unknown;
}

export interface PublicCategory {
  id: number;
  name: string;
  color?: string | null;
  is_active: boolean;
}

export interface GetPublicEventsParams {
  start_date?: string;
  end_date?: string;
  category_id?: number;
  calendar?: CalendarType;
  skip?: number;
  limit?: number;
}

export async function getPublicEvents(
  params?: GetPublicEventsParams
): Promise<PublicEvent[]> {
  const search = new URLSearchParams();
  if (params?.start_date) search.set('start_date', params.start_date);
  if (params?.end_date) search.set('end_date', params.end_date);
  if (params?.category_id != null) search.set('category_id', String(params.category_id));
  if (params?.calendar) search.set('calendar', params.calendar);
  if (params?.skip != null) search.set('skip', String(params.skip));
  if (params?.limit != null) search.set('limit', String(params.limit));
  const qs = search.toString();
  const url = `${API_BASE}/public/events${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Termine konnten nicht geladen werden');
  return res.json();
}

export interface GetPublicCategoriesParams {
  calendar?: CalendarType;
}

export async function getPublicCategories(
  params?: GetPublicCategoriesParams
): Promise<PublicCategory[]> {
  const search = new URLSearchParams();
  if (params?.calendar) search.set('calendar', params.calendar);
  const qs = search.toString();
  const url = `${API_BASE}/public/categories${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Kategorien konnten nicht geladen werden');
  return res.json();
}

export async function getPublicCalendars(): Promise<PublicCalendarsResponse> {
  const res = await fetch(`${API_BASE}/public/calendars`);
  if (!res.ok) throw new Error('Kalender-Infos konnten nicht geladen werden');
  return res.json();
}
