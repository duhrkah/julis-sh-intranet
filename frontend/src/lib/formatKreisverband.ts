/**
 * Zeigt Kreisverbands-Namen mit "Junge Liberale" statt "JuLis" an
 * (z. B. "JuLis Flensburg" → "Junge Liberale Flensburg").
 */
export function formatKreisverbandDisplayName(name: string): string {
  if (!name || typeof name !== 'string') return name;
  const trimmed = name.trim();
  if (/^JuLis\s+/i.test(trimmed)) {
    return 'Junge Liberale ' + trimmed.replace(/^JuLis\s+/i, '');
  }
  return name;
}
