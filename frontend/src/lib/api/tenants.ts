import apiClient from './client';

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  level: string;
  parent_id: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TenantTree extends Tenant {
  children?: TenantTree[];
}

export async function getTenants(params?: { level?: string }): Promise<Tenant[]> {
  const response = await apiClient.get('/tenants/', { params });
  return response.data;
}

export async function getTenantTree(): Promise<TenantTree[]> {
  const response = await apiClient.get('/tenants/tree');
  return response.data;
}

export async function createTenant(data: {
  name: string;
  slug: string;
  level: string;
  parent_id?: number | null;
  description?: string | null;
  is_active?: boolean;
}): Promise<Tenant> {
  const response = await apiClient.post('/tenants/', data);
  return response.data;
}

export async function updateTenant(
  id: number,
  data: Partial<Pick<Tenant, 'name' | 'description' | 'level' | 'is_active'>>
): Promise<Tenant> {
  const response = await apiClient.put(`/tenants/${id}`, data);
  return response.data;
}

export async function deleteTenant(id: number): Promise<void> {
  await apiClient.delete(`/tenants/${id}`);
}
