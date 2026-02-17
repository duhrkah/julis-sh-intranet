import apiClient from './client';

export interface UserListItem {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  tenant_id: number | null;
  display_role?: string;
  created_at: string;
  updated_at: string;
}

export interface UserCreateInput {
  username: string;
  email: string;
  full_name?: string;
  /** Leer lassen = Anmeldung nur per Microsoft 365 */
  password?: string;
  role: string;
  tenant_id?: number | null;
}

export interface UserUpdateInput {
  username?: string;
  email?: string;
  full_name?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
  tenant_id?: number | null;
}

export async function getUsers(): Promise<UserListItem[]> {
  const response = await apiClient.get('/users/');
  return response.data;
}

export async function createUser(data: UserCreateInput): Promise<UserListItem> {
  const response = await apiClient.post('/users/', data);
  return response.data;
}

export async function updateUser(id: number, data: UserUpdateInput): Promise<UserListItem> {
  const response = await apiClient.put(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}
