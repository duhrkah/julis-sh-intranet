import apiClient from './client';

export const STUFEN = [
  { value: 'Impulsgeber', label: 'Impulsgeber', min: 25 },
  { value: 'Freiheitsbringer', label: 'Freiheitsbringer', min: 120 },
  { value: 'Chancenmacher', label: 'Chancenmacher', min: 250 },
  { value: 'Zukunftsgestalter', label: 'Zukunftsgestalter', min: 450 },
] as const;

export const GESCHLECHTER = [
  { value: 'männlich', label: 'Männlich' },
  { value: 'weiblich', label: 'Weiblich' },
  { value: 'divers', label: 'Divers' },
] as const;

export interface SupporterMember {
  id: number;
  geschlecht: string;
  titel?: string | null;
  vorname: string;
  nachname: string;
  kreisverband_id?: number | null;
  kreisverband_name?: string | null;
  beitragshoehe: number;
  stufe: string;
  verwendungszweck?: string | null;
  iban?: string | null;
  bankinstitut?: string | null;
  strasse_hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  telefon?: string | null;
  mobilnummer?: string | null;
  email?: string | null;
  ist_aktiv: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupporterMemberCreate {
  geschlecht: string;
  titel?: string | null;
  vorname: string;
  nachname: string;
  kreisverband_id?: number | null;
  beitragshoehe: number;
  verwendungszweck?: string | null;
  iban?: string | null;
  bankinstitut?: string | null;
  strasse_hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  telefon?: string | null;
  mobilnummer?: string | null;
  email?: string | null;
}

export type SupporterMemberUpdate = Partial<SupporterMemberCreate>;

export async function getSupporterMembers(params?: {
  kreisverband_id?: number;
  stufe?: string;
  search?: string;
  include_inactive?: boolean;
  skip?: number;
  limit?: number;
}): Promise<SupporterMember[]> {
  const response = await apiClient.get<SupporterMember[]>('/supporter-members/', { params });
  return response.data;
}

export async function getSupporterMemberById(id: number): Promise<SupporterMember> {
  const response = await apiClient.get<SupporterMember>(`/supporter-members/${id}`);
  return response.data;
}

export async function createSupporterMember(data: SupporterMemberCreate): Promise<SupporterMember> {
  const response = await apiClient.post<SupporterMember>('/supporter-members/', data);
  return response.data;
}

export async function updateSupporterMember(id: number, data: SupporterMemberUpdate): Promise<SupporterMember> {
  const response = await apiClient.put<SupporterMember>(`/supporter-members/${id}`, data);
  return response.data;
}

export async function deleteSupporterMember(id: number): Promise<void> {
  await apiClient.delete(`/supporter-members/${id}`);
}
