import apiClient from './client';

/** Rekursiv: Unterpunkte können selbst wieder Unterpunkte haben (weitere Ebene). */
export interface Tagesordnungspunkt {
  titel: string;
  unterpunkte?: Tagesordnungspunkt[];
}

/** Anzahl Blätter (Knoten ohne Kinder) – für Abwärtskompatibilität beim Laden. */
export function getLeafCount(node: Tagesordnungspunkt): number {
  const kids = node.unterpunkte ?? [];
  if (kids.length === 0) return 1;
  return kids.reduce((sum, k) => sum + getLeafCount(k), 0);
}

/** Anzahl aller Knoten (jeder TOP/Unterpunkt/Unter-Unterpunkt zählt). */
export function getNodeCount(node: Tagesordnungspunkt): number {
  const kids = node.unterpunkte ?? [];
  return 1 + kids.reduce((sum, k) => sum + getNodeCount(k), 0);
}

/** Alle Knoten in Tiefenreihenfolge (jeder Punkt + Unterpunkt + Unter-Unterpunkt). */
export function getNodesInOrder(
  node: Tagesordnungspunkt,
  pathPrefix: string
): { pathLabel: string; titel: string; isLeaf: boolean }[] {
  const kids = node.unterpunkte ?? [];
  const isLeaf = kids.length === 0;
  const out: { pathLabel: string; titel: string; isLeaf: boolean }[] = [
    { pathLabel: pathPrefix, titel: node.titel, isLeaf },
  ];
  kids.forEach((c, i) => {
    const subPrefix = pathPrefix ? `${pathPrefix}.${i + 1}` : String(i + 1);
    out.push(...getNodesInOrder(c, subPrefix));
  });
  return out;
}

export type TagesordnungInput = (string | Tagesordnungspunkt)[];

/** Einladungsvariante: vorgefertigte Empfängerliste oder Freitext */
export type EinladungVariante = 'landesvorstand' | 'erweiterter_landesvorstand' | 'freitext';

/** Vorgefertigte Empfängertexte (wie im Backend für Word-Vorlage) */
export const EINLADUNG_EMPFAENGER_LANDESVORSTAND = `Eingeladen sind:
- die Mitglieder des Landesvorstandes

nachrichtlich:
- die Landesgeschäftsstelle
- die Ombudsperson
- die Liberalen Schüler Schleswig-Holstein
- den Bundesvorsitzenden der Jungen Liberalen`;

export const EINLADUNG_EMPFAENGER_ERWEITERTER_LANDESVORSTAND = `Eingeladen sind:
- die Mitglieder des Landesvorstandes
- die Kreisvorsitzenden

nachrichtlich:
- die Landesgeschäftsstelle
- die Ombudsperson
- die Liberalen Schüler Schleswig-Holstein
- den Bundesvorsitzenden der Jungen Liberalen`;

export interface Meeting {
  id: number;
  titel: string;
  titel_kurz?: string | null;
  typ: string;
  datum: string;
  uhrzeit?: string | null;
  ort?: string | null;
  tagesordnung?: TagesordnungInput;
  /** Pro TOP: Liste von Strings (ein Text pro Knoten in Tiefenreihenfolge, siehe getNodeCount) */
  protokoll_top_texte?: (string | string[])[] | null;
  teilnehmer?: string | null;
  teilnehmer_sonstige?: string | null;
  sitzungsleitung?: string | null;
  protokollfuehrer?: string | null;
  beschluesse?: string | null;
  einladung_variante?: EinladungVariante | string | null;
  einladung_empfaenger_freitext?: string | null;
  /** Ausgewählte Optionen für „Teilnehmer der Eingeladenen“ (Protokoll) */
  teilnehmer_eingeladene_auswahl?: string[] | null;
  einladung_pfad?: string | null;
  protokoll_pfad?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMeetings(params?: { typ?: string }): Promise<Meeting[]> {
  const response = await apiClient.get<Meeting[]>('/meetings/', { params });
  return response.data;
}

/** Optionen für „Teilnehmer der Eingeladenen“ je nach Einladungsvariante (für Protokoll). */
export async function getTeilnehmerOptionen(variante: EinladungVariante): Promise<string[]> {
  if (variante === 'freitext') return [];
  const response = await apiClient.get<string[]>(`/meetings/teilnehmer-optionen/${variante}`);
  return response.data;
}

export async function getMeetingById(id: number): Promise<Meeting> {
  const response = await apiClient.get<Meeting>(`/meetings/${id}`);
  return response.data;
}

export async function createMeeting(data: Partial<Meeting>): Promise<Meeting> {
  const response = await apiClient.post<Meeting>('/meetings/', data);
  return response.data;
}

export async function updateMeeting(id: number, data: Partial<Meeting>): Promise<Meeting> {
  const response = await apiClient.put<Meeting>(`/meetings/${id}`, data);
  return response.data;
}

export async function deleteMeeting(id: number) {
  const response = await apiClient.delete(`/meetings/${id}`);
  return response.data;
}

export async function generateInvitation(id: number) {
  const response = await apiClient.post(`/meetings/${id}/generate-invitation`);
  return response.data;
}

export async function generateProtocol(id: number) {
  const response = await apiClient.post(`/meetings/${id}/generate-protocol`);
  return response.data;
}

/** Einladung als PDF herunterladen (konvertiert aus DOCX, erfordert Auth). */
export async function downloadInvitationPdf(meetingId: number): Promise<void> {
  const response = await apiClient.get(`/meetings/${meetingId}/einladung.pdf`, {
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const name =
    (response.headers['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1]) ||
    `einladung_${meetingId}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Protokoll als PDF herunterladen (konvertiert aus DOCX, erfordert Auth). */
export async function downloadProtocolPdf(meetingId: number): Promise<void> {
  const response = await apiClient.get(`/meetings/${meetingId}/protokoll.pdf`, {
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const name =
    (response.headers['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1]) ||
    `protokoll_${meetingId}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
