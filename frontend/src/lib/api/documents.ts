import apiClient from './client';

export interface Document {
  id: number;
  titel: string;
  typ: string;
  aktueller_text?: string | null;
  version?: string | null;
  gueltig_ab?: string | null;
  datei_pfad?: string | null;
  created_at: string;
  updated_at: string;
}

/** Eine konkrete Änderungsstelle innerhalb eines Änderungsantrags */
export interface DocumentAenderung {
  id: number;
  aenderungsantrag_id: number;
  position: number;
  bezug?: string | null;
  alte_fassung?: string | null;
  neue_fassung?: string | null;
  aenderungstext?: string | null;
}

export interface DocumentAenderungsantrag {
  id: number;
  document_id: number;
  titel?: string | null;
  antragsteller: string;
  antrag_text: string;
  alte_fassung?: string | null;
  neue_fassung?: string | null;
  begruendung?: string | null;
  status: string;
  created_at: string;
  stellen?: DocumentAenderung[];
}

export async function getDocuments(params?: { typ?: string }): Promise<Document[]> {
  const response = await apiClient.get<Document[]>('/documents/', { params });
  return response.data;
}

export async function getDocumentById(id: number): Promise<Document> {
  const response = await apiClient.get<Document>(`/documents/${id}`);
  return response.data;
}

export async function createDocument(data: Partial<Document>): Promise<Document> {
  const response = await apiClient.post<Document>('/documents/', data);
  return response.data;
}

export async function updateDocument(id: number, data: Partial<Document>): Promise<Document> {
  const response = await apiClient.put<Document>(`/documents/${id}`, data);
  return response.data;
}

export async function deleteDocument(id: number): Promise<void> {
  await apiClient.delete(`/documents/${id}`);
}

export async function uploadDocumentFile(documentId: number, file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('datei', file);
  const response = await apiClient.post<Document>(`/documents/${documentId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** Liste Änderungsanträge zu einem Dokument */
export async function getAenderungsantraege(documentId: number, params?: { status?: string }): Promise<DocumentAenderungsantrag[]> {
  const response = await apiClient.get<DocumentAenderungsantrag[]>(`/documents/${documentId}/aenderungsantraege`, { params });
  return response.data;
}

export async function createAenderungsantrag(
  documentId: number,
  data: Omit<DocumentAenderungsantrag, 'id' | 'document_id' | 'status' | 'created_at' | 'stellen'>,
  options?: { send_emails?: boolean }
): Promise<DocumentAenderungsantrag> {
  const response = await apiClient.post<DocumentAenderungsantrag>(
    `/documents/${documentId}/aenderungsantraege`,
    { ...data, document_id: documentId },
    { params: options?.send_emails ? { send_emails: true } : undefined }
  );
  return response.data;
}

/** E-Mail-Benachrichtigung für einen Änderungsantrag an konfigurierte Empfänger senden. */
export async function sendAenderungsantragEmail(aenderungsantragId: number): Promise<void> {
  await apiClient.post(`/documents/aenderungsantraege/${aenderungsantragId}/send-email`);
}

export async function updateAenderungsantrag(
  id: number,
  data: Partial<Pick<DocumentAenderungsantrag, 'status' | 'titel' | 'antrag_text' | 'alte_fassung' | 'neue_fassung' | 'begruendung'>>
): Promise<DocumentAenderungsantrag> {
  const response = await apiClient.put<DocumentAenderungsantrag>(`/documents/aenderungsantraege/${id}`, data);
  return response.data;
}

export async function deleteAenderungsantrag(id: number): Promise<void> {
  await apiClient.delete(`/documents/aenderungsantraege/${id}`);
}

/** Stellen (einzelne Änderungen) eines Änderungsantrags */
export async function getStellen(aenderungsantragId: number): Promise<DocumentAenderung[]> {
  const response = await apiClient.get<DocumentAenderung[]>(`/documents/aenderungsantraege/${aenderungsantragId}/stellen`);
  return response.data;
}

export async function createStelle(
  aenderungsantragId: number,
  data: Omit<DocumentAenderung, 'id' | 'aenderungsantrag_id'>
): Promise<DocumentAenderung> {
  const response = await apiClient.post<DocumentAenderung>(
    `/documents/aenderungsantraege/${aenderungsantragId}/stellen`,
    data
  );
  return response.data;
}

export async function updateStelle(
  aenderungsantragId: number,
  stelleId: number,
  data: Partial<Omit<DocumentAenderung, 'id' | 'aenderungsantrag_id'>>
): Promise<DocumentAenderung> {
  const response = await apiClient.put<DocumentAenderung>(
    `/documents/aenderungsantraege/${aenderungsantragId}/stellen/${stelleId}`,
    data
  );
  return response.data;
}

export async function deleteStelle(aenderungsantragId: number, stelleId: number): Promise<void> {
  await apiClient.delete(`/documents/aenderungsantraege/${aenderungsantragId}/stellen/${stelleId}`);
}

/** Änderungsantrag als DOCX herunterladen (Änderungstext + Synopse). */
export async function downloadAenderungsantragDocx(aenderungsantragId: number): Promise<void> {
  const response = await apiClient.get(`/documents/aenderungsantraege/${aenderungsantragId}/export.docx`, {
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const name = (response.headers['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1]) || `aenderungsantrag_${aenderungsantragId}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Änderungsantrag als PDF herunterladen. */
export async function downloadAenderungsantragPdf(aenderungsantragId: number): Promise<void> {
  const response = await apiClient.get(`/documents/aenderungsantraege/${aenderungsantragId}/export.pdf`, {
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  const name = (response.headers['content-disposition']?.match(/filename="?([^";]+)"?/)?.[1]) || `aenderungsantrag_${aenderungsantragId}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
