import apiClient from './client';

export interface Kreisverband {
  id: number;
  name: string;
  kuerzel?: string | null;
  email?: string | null;
  ist_aktiv: boolean;
  tenant_id?: number | null;
  created_at: string;
  updated_at?: string;
  vorstandsmitglieder?: Vorstandsmitglied[];
}

export interface Vorstandsmitglied {
  id: number;
  kreisverband_id: number;
  name: string;
  email?: string | null;
  rolle: string;
  amtszeit_start?: string | null;
  amtszeit_ende?: string | null;
  ist_aktiv: boolean;
  created_at: string;
}

export interface KVProtokoll {
  id: number;
  kreisverband_id: number;
  titel: string;
  datum: string;
  typ: string;
  beschreibung?: string | null;
  datei_pfad?: string | null;
  created_at: string;
}

/** Rolle für Landesverband-Vorstandsübersicht */
export type VorstandUebersichtRolle = 'vorsitz' | 'schatzmeister' | 'organisation' | 'programmatik' | 'presse';

export interface VorstandUebersichtMitglied {
  id: number;
  name: string;
  email?: string | null;
  rolle: string;
}

export interface VorstandUebersichtEintrag {
  kreisverband: Pick<Kreisverband, 'id' | 'name' | 'kuerzel'> & { created_at?: string };
  mitglieder: VorstandUebersichtMitglied[];
}

export async function getLandesverbandVorstandUebersicht(params: {
  rolle: VorstandUebersichtRolle;
  mit_beisitzern?: boolean;
}): Promise<VorstandUebersichtEintrag[]> {
  const response = await apiClient.get<VorstandUebersichtEintrag[]>('/kreisverband/landesverband/vorstand-uebersicht', {
    params: { rolle: params.rolle, mit_beisitzern: params.mit_beisitzern ?? true },
  });
  return response.data;
}

export async function getKreisverbande(params?: { ist_aktiv?: boolean }): Promise<Kreisverband[]> {
  const response = await apiClient.get<Kreisverband[]>('/kreisverband/', { params });
  return response.data;
}

export async function getKreisverbandById(id: number): Promise<Kreisverband> {
  const response = await apiClient.get<Kreisverband>(`/kreisverband/${id}`);
  return response.data;
}

export async function createKreisverband(data: Partial<Kreisverband>): Promise<Kreisverband> {
  const response = await apiClient.post<Kreisverband>('/kreisverband/', data);
  return response.data;
}

export async function updateKreisverband(id: number, data: Partial<Kreisverband>): Promise<Kreisverband> {
  const response = await apiClient.put<Kreisverband>(`/kreisverband/${id}`, data);
  return response.data;
}

export async function deleteKreisverband(id: number): Promise<void> {
  await apiClient.delete(`/kreisverband/${id}`);
}

export async function getVorstand(kvId: number): Promise<Vorstandsmitglied[]> {
  const response = await apiClient.get<Vorstandsmitglied[]>(`/kreisverband/${kvId}/vorstand`);
  return response.data;
}

export async function createVorstandsmitglied(kvId: number, data: Omit<Vorstandsmitglied, 'id' | 'kreisverband_id' | 'created_at'>): Promise<Vorstandsmitglied> {
  const response = await apiClient.post<Vorstandsmitglied>(`/kreisverband/${kvId}/vorstand`, {
    ...data,
    kreisverband_id: kvId,
  });
  return response.data;
}

export async function updateVorstandsmitglied(mitgliedId: number, data: Omit<Vorstandsmitglied, 'id' | 'kreisverband_id' | 'created_at'>): Promise<Vorstandsmitglied> {
  const response = await apiClient.put<Vorstandsmitglied>(`/kreisverband/vorstand/${mitgliedId}`, data);
  return response.data;
}

export async function deleteVorstandsmitglied(mitgliedId: number): Promise<void> {
  await apiClient.delete(`/kreisverband/vorstand/${mitgliedId}`);
}

export async function getProtokolle(kvId: number, params?: { typ?: string }): Promise<KVProtokoll[]> {
  const response = await apiClient.get<KVProtokoll[]>(`/kreisverband/${kvId}/protokolle`, { params });
  return response.data;
}

export async function uploadProtokoll(kvId: number, formData: FormData): Promise<KVProtokoll> {
  const response = await apiClient.post<KVProtokoll>(`/kreisverband/${kvId}/protokolle`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteProtokoll(protokollId: number): Promise<void> {
  await apiClient.delete(`/kreisverband/protokolle/${protokollId}`);
}
