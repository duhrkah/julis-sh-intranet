/**
 * Erkennt aus Diff (alt vs. neu) Streichungen, Ergänzungen und Ersetzungen
 * und erzeugt daraus Antragstext / Änderungstext pro Stelle.
 */
import { diffLines } from 'diff';

export type AenderungTyp = 'streichung' | 'ergaenzung' | 'ersetzung';

export interface ErkannteAenderung {
  typ: AenderungTyp;
  alte_fassung: string;
  neue_fassung: string;
  /** Vorschlag für Antragstext (Kurzbeschreibung) */
  antragstext: string;
  /** Vorschlag für formulierten Änderungstext (gesetzesgleich) */
  aenderungstext: string;
}

function trimBlock(s: string): string {
  return s.replace(/\n+$/, '').replace(/^\n+/, '');
}

function excerpt(s: string, maxLen: number = 60): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.length <= maxLen ? t : t.slice(0, maxLen) + '…';
}

/** Formatiert Änderungstext im Stil eines Gesetzentwurfs (gesetzesgleich), immer in Langform mit vollem Wortlaut. */
function formuliereAenderungstext(typ: AenderungTyp, alteFassung: string, neueFassung: string): string {
  const alt = trimBlock(alteFassung);
  const neu = trimBlock(neueFassung);
  if (typ === 'streichung' && alt) {
    return `Folgender Wortlaut wird gestrichen:\n${alt}`;
  }
  if (typ === 'ergaenzung' && neu) {
    return `Es wird folgender Wortlaut eingefügt:\n${neu}`;
  }
  if (typ === 'ersetzung' && alt && neu) {
    return `Der bisherige Wortlaut wird wie folgt geändert:\nBisheriger Wortlaut:\n${alt}\n\nNeuer Wortlaut:\n${neu}`;
  }
  return '';
}

/**
 * Vergleicht alten und neuen Dokumenttext (zeilenbasiert) und liefert
 * eine Liste von Änderungen mit automatisch erkanntem Typ und generiertem Text.
 */
export function diffToAenderungen(alterText: string, neuerText: string): ErkannteAenderung[] {
  const changes = diffLines(alterText || '', neuerText || '');
  const result: ErkannteAenderung[] = [];
  let pendingRemoved = '';
  let pendingAdded = '';

  function flush() {
    const r = trimBlock(pendingRemoved);
    const a = trimBlock(pendingAdded);
    if (r && !a) {
      result.push({
        typ: 'streichung',
        alte_fassung: r,
        neue_fassung: '',
        antragstext: `Streichung: ${excerpt(r)}`,
        aenderungstext: formuliereAenderungstext('streichung', r, ''),
      });
    } else if (!r && a) {
      result.push({
        typ: 'ergaenzung',
        alte_fassung: '',
        neue_fassung: a,
        antragstext: `Ergänzung: ${excerpt(a)}`,
        aenderungstext: formuliereAenderungstext('ergaenzung', '', a),
      });
    } else if (r && a) {
      result.push({
        typ: 'ersetzung',
        alte_fassung: r,
        neue_fassung: a,
        antragstext: `Ersetzung: ${excerpt(r)} → ${excerpt(a)}`,
        aenderungstext: formuliereAenderungstext('ersetzung', r, a),
      });
    }
    pendingRemoved = '';
    pendingAdded = '';
  }

  for (const part of changes) {
    if (part.added) {
      pendingAdded += part.value;
    } else if (part.removed) {
      pendingRemoved += part.value;
    } else {
      flush();
    }
  }
  flush();

  return result;
}
