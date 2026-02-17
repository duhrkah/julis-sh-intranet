/**
 * Öffentliche API für Termin-Einreichung ohne Authentifizierung.
 * Verwendet fetch ohne Token, damit die Seite ohne Login nutzbar ist.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface PublicEventSubmitInput {
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
  submitter_name: string;
  submitter_email: string;
  tenant_id?: number | null;
}

export interface PublicEventResponse {
  id: number;
  title: string;
  status: string;
  [key: string]: unknown;
}

export async function submitPublicEvent(
  data: PublicEventSubmitInput
): Promise<PublicEventResponse> {
  const res = await fetch(`${API_BASE}/public/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === 'string' ? err.detail : 'Einreichung fehlgeschlagen';
    throw new Error(msg);
  }
  return res.json();
}
