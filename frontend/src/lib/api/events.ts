import apiClient from './client';

export interface EventAttachment {
  id: number;
  event_id: number;
  original_name: string;
  file_size: number;
  content_type?: string | null;
  created_at: string;
}

export interface Event {
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
  status: string;
  rejection_reason?: string | null;
  submitter_id: number;
  submitter_name?: string | null;
  submitter_email?: string | null;
  approved_at?: string | null;
  approved_by?: number | null;
  tenant_id: number;
  source_tenant_id?: number | null;
  category_id?: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  attachments?: EventAttachment[];
}

export interface EventCreateInput {
  title: string;
  description?: string | null;
  start_date: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_url?: string | null;
  organizer: string;
  category_id?: number | null;
  is_public?: boolean;
  target_tenant_id?: number | null;
}

export interface EventUpdateInput {
  title?: string;
  description?: string | null;
  start_date?: string;
  start_time?: string | null;
  end_date?: string | null;
  end_time?: string | null;
  location?: string | null;
  location_url?: string | null;
  organizer?: string;
  category_id?: number | null;
  is_public?: boolean;
}

export interface ListEventsParams {
  start_date?: string;
  end_date?: string;
  status?: string;
  tenant_id?: number;
  skip?: number;
  limit?: number;
}

export async function getEvents(params?: ListEventsParams): Promise<Event[]> {
  const response = await apiClient.get<Event[]>('/events/', { params });
  return response.data;
}

export async function getEventById(id: number): Promise<Event> {
  const response = await apiClient.get<Event>(`/events/${id}`);
  return response.data;
}

export async function createEvent(data: EventCreateInput): Promise<Event> {
  const response = await apiClient.post<Event>('/events/', data);
  return response.data;
}

export async function updateEvent(id: number, data: EventUpdateInput): Promise<Event> {
  const response = await apiClient.put<Event>(`/events/${id}`, data);
  return response.data;
}

export async function deleteEvent(id: number): Promise<void> {
  await apiClient.delete(`/events/${id}`);
}

export async function approveEvent(id: number): Promise<Event> {
  const response = await apiClient.post<Event>(`/admin/events/${id}/approve`);
  return response.data;
}

export async function rejectEvent(id: number, reason: string): Promise<Event> {
  const response = await apiClient.post<Event>(`/admin/events/${id}/reject`, {
    rejection_reason: reason,
  });
  return response.data;
}

export async function getPendingEvents(): Promise<Event[]> {
  const response = await apiClient.get<Event[]>('/admin/events/pending');
  return response.data;
}

export async function uploadEventAttachment(eventId: number, file: File): Promise<EventAttachment> {
  const formData = new FormData();
  formData.append('datei', file);
  const response = await apiClient.post<EventAttachment>(`/events/${eventId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteEventAttachment(eventId: number, attachmentId: number): Promise<void> {
  await apiClient.delete(`/events/${eventId}/attachments/${attachmentId}`);
}

export function getEventAttachmentUrl(eventId: number, attachmentId: number): string {
  return `${apiClient.defaults.baseURL}/events/${eventId}/attachments/${attachmentId}`;
}
