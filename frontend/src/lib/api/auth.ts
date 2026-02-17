import apiClient from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: any;
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const formData = new URLSearchParams();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await apiClient.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
}

/** Microsoft 365 Login: Prüfen, ob konfiguriert (Button nur anzeigen wenn true). */
export async function getMicrosoftLoginEnabled(): Promise<boolean> {
  try {
    const response = await apiClient.get<{ microsoft_login_enabled: boolean }>('/auth/microsoft/status');
    return response.data.microsoft_login_enabled === true;
  } catch {
    return false;
  }
}

/** Microsoft 365 Login: Authorize-URL vom Backend holen (dann Browser dorthin weiterleiten). */
export async function getMicrosoftAuthorizeUrl(nextPath?: string): Promise<string> {
  const params = new URLSearchParams();
  if (nextPath && nextPath.startsWith('/')) params.set('next', nextPath);
  const response = await apiClient.get<{ authorize_url: string }>(
    `/auth/microsoft/authorize?${params.toString()}`
  );
  return response.data.authorize_url;
}

/** Microsoft 365 Login: Code nach Anmeldung gegen unser JWT tauschen. */
export async function loginWithMicrosoft(
  code: string,
  redirectUri: string,
  state?: string
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/microsoft/callback', {
    code,
    redirect_uri: redirectUri,
    state: state || undefined,
  });
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  tenant_id: number | null;
  display_role?: string;
  accessible_tenant_ids?: number[];
}

export async function getCurrentUser(): Promise<UserProfile> {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

export async function refreshToken(): Promise<string> {
  const response = await apiClient.post('/auth/refresh');
  return response.data.access_token;
}

export interface ProfileUpdate {
  full_name?: string;
  email?: string;
}

export async function updateMyProfile(data: ProfileUpdate): Promise<UserProfile> {
  const response = await apiClient.patch('/auth/me', data);
  return response.data;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  await apiClient.post('/auth/change-password', data);
}
