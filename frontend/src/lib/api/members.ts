import apiClient from './client';

export const SZENARIEN = [
  { value: 'eintritt', label: 'Eintritt' },
  { value: 'austritt', label: 'Austritt' },
  { value: 'verbandswechsel_eintritt', label: 'Verbandswechsel (Eintritt)' },
  { value: 'verbandswechsel_austritt', label: 'Verbandswechsel (Austritt)' },
  { value: 'verbandswechsel_intern', label: 'Verbandswechsel (intern)' },
  { value: 'veraenderung', label: 'Datenänderung' },
] as const;

export type MemberChangeScenario = (typeof SZENARIEN)[number]['value'];

export interface MemberChange {
  id: number;
  scenario: string;
  mitgliedsnummer?: string | null;
  vorname: string;
  nachname: string;
  email?: string | null;
  telefon?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  geburtsdatum?: string | null;
  kreisverband_id?: number | null;
  kreisverband_alt_id?: number | null;
  kreisverband_neu_id?: number | null;
  bemerkung?: string | null;
  status: string;
  erstellt_von_id?: number | null;
  created_at: string;
}

export interface MemberChangeCreate {
  scenario: string;
  mitgliedsnummer?: string | null;
  vorname: string;
  nachname: string;
  email?: string | null;
  telefon?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  geburtsdatum?: string | null;
  kreisverband_id?: number | null;
  kreisverband_alt_id?: number | null;
  kreisverband_neu_id?: number | null;
  bemerkung?: string | null;
}

export async function getMemberChanges(params?: {
  scenario?: string;
  kreisverband_id?: number;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<MemberChange[]> {
  const response = await apiClient.get<MemberChange[]>('/member-changes/', { params });
  return response.data;
}

export async function createMemberChange(
  data: MemberChangeCreate,
  sendEmails: boolean = true
): Promise<MemberChange> {
  const response = await apiClient.post<MemberChange>('/member-changes/', data, {
    params: { send_emails: sendEmails },
  });
  return response.data;
}

export async function getMemberChangeById(id: number): Promise<MemberChange> {
  const response = await apiClient.get<MemberChange>(`/member-changes/${id}`);
  return response.data;
}

export async function sendMemberChangeEmails(id: number): Promise<MemberChange> {
  const response = await apiClient.post<MemberChange>(`/member-changes/${id}/send`);
  return response.data;
}

/** E-Mails für eine Mitgliederänderung erneut senden (mit Auswahl: an Mitglied und/oder an KV). */
export async function resendMemberChangeEmails(
  id: number,
  options: { send_to_member: boolean; send_to_kv: boolean }
): Promise<MemberChange> {
  const response = await apiClient.post<MemberChange>(`/member-changes/${id}/resend`, options);
  return response.data;
}

// --- Email Templates (Leitung+) ---

export interface EmailTemplate {
  id: number;
  name: string;
  typ: string;
  scenario: string;
  kreisverband_id?: number | null;
  betreff: string;
  inhalt: string;
  attachment_original_filename?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getEmailTemplates(params?: {
  scenario?: string;
  typ?: string;
  kreisverband_id?: number;
}): Promise<EmailTemplate[]> {
  const response = await apiClient.get<EmailTemplate[]>('/email-templates/', { params });
  return response.data;
}

export async function getEmailTemplateById(id: number): Promise<EmailTemplate> {
  const response = await apiClient.get<EmailTemplate>(`/email-templates/${id}`);
  return response.data;
}

export async function createEmailTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await apiClient.post<EmailTemplate>('/email-templates/', data);
  return response.data;
}

export async function updateEmailTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const response = await apiClient.put<EmailTemplate>(`/email-templates/${id}`, data);
  return response.data;
}

export async function deleteEmailTemplate(id: number): Promise<void> {
  await apiClient.delete(`/email-templates/${id}`);
}

/** Test-E-Mail mit diesem Template an die angegebene Adresse senden (Beispieldaten). */
export async function testEmailTemplate(templateId: number, to: string): Promise<{ detail: string }> {
  const response = await apiClient.post<{ detail: string }>(`/email-templates/${templateId}/test`, { to });
  return response.data;
}

/** Anhang für dieses Template hochladen. */
export async function uploadTemplateAttachment(templateId: number, file: File): Promise<EmailTemplate> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.put<EmailTemplate>(`/email-templates/${templateId}/attachment`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** Anhang dieses Templates entfernen. */
export async function deleteTemplateAttachment(templateId: number): Promise<EmailTemplate> {
  const response = await apiClient.delete<EmailTemplate>(`/email-templates/${templateId}/attachment`);
  return response.data;
}

// --- Email Recipients (Leitung+) ---

export interface EmailRecipient {
  id: number;
  kreisverband_id: number;
  name: string;
  email: string;
  rolle: string;
  created_at: string;
}

export async function getEmailRecipients(params?: { kreisverband_id?: number }): Promise<EmailRecipient[]> {
  const response = await apiClient.get<EmailRecipient[]>('/email-recipients/', { params });
  return response.data;
}

export async function createEmailRecipient(data: Omit<EmailRecipient, 'id' | 'created_at'>): Promise<EmailRecipient> {
  const response = await apiClient.post<EmailRecipient>('/email-recipients/', data);
  return response.data;
}

export async function updateEmailRecipient(id: number, data: Partial<EmailRecipient>): Promise<EmailRecipient> {
  const response = await apiClient.put<EmailRecipient>(`/email-recipients/${id}`, data);
  return response.data;
}

export async function deleteEmailRecipient(id: number): Promise<void> {
  await apiClient.delete(`/email-recipients/${id}`);
}
