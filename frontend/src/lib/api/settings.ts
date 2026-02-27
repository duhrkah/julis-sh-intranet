import apiClient from './client';

/** SMTP-Konfiguration testen: Test-E-Mail an die angegebene Adresse senden. Nur Admin. */
export async function testSmtp(to: string): Promise<{ detail: string }> {
  const response = await apiClient.post<{ detail: string }>('/settings/smtp-test', { to });
  return response.data;
}

/** App-Version abrufen. */
export async function getAppVersion(): Promise<string> {
  const response = await apiClient.get<{ version: string }>('/settings/version');
  return response.data.version;
}

/** App-Version setzen (Admin only). */
export async function updateAppVersion(version: string): Promise<string> {
  const response = await apiClient.put<{ version: string }>('/settings/version', { version });
  return response.data.version;
}
