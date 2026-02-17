import apiClient from './client';

/** SMTP-Konfiguration testen: Test-E-Mail an die angegebene Adresse senden. Nur Admin. */
export async function testSmtp(to: string): Promise<{ detail: string }> {
  const response = await apiClient.post<{ detail: string }>('/settings/smtp-test', { to });
  return response.data;
}
