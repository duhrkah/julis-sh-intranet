import apiClient from './client';

export interface AuditLogEntry {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export async function getAuditLogs(params?: {
  entity_type?: string;
  user_id?: number;
  action?: string;
  skip?: number;
  limit?: number;
}) {
  const response = await apiClient.get<AuditLogEntry[]>('/audit/', { params });
  return response.data;
}
