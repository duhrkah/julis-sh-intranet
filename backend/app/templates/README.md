# Word-Vorlagen (docxtpl)

Hier die DOCX-Vorlagen ablegen. Beim Erzeugen von Einladung/Protokoll werden **Jinja2-Platzhalter** durch die Sitzungsdaten ersetzt.

---

## Platzhalter in Word einbauen

1. **Vorlage in Word oder LibreOffice öffnen** (z. B. `einladung.docx`).
2. **Platzhalter schreiben** – genau so, mit **doppelten** geschweiften Klammern und Leerzeichen:
   - Richtig: `{{ titel }}`  `{{ datum }}`  `{{ ort }}`
   - Falsch: `{titel}` oder `{{titel}}` (ohne Leerzeichen funktioniert auch, aber `Variable` mit Leerzeichen ist üblich).
3. **Speichern** als `.docx` und die Datei in diesen Ordner legen.

Technisch nutzt das Backend **docxtpl** (Jinja2 in DOCX). Platzhalter: `{{ variable }}` bzw. für die Tagesordnung (mit Fettformatierung) **`{{r tagesordnung }}`** („r“ = RichText). Damit Schriftart und -größe aus der Vorlage erhalten bleiben, im Backend eine der Optionen setzen: Zeichenstil (DOCX_TAGESORDNUNG_STYLE) oder Schriftart/Größe (DOCX_TAGESORDNUNG_FONT, DOCX_TAGESORDNUNG_SIZE) – siehe `.env.example`.

---

## Verfügbare Vorlagen und Platzhalter

### einladung.docx (Einladung zur Sitzung)

| Platzhalter               | Beschreibung                    |
|---------------------------|---------------------------------|
| `{{ titel }}`             | Sitzungstitel (voll)            |
| `{{ titel_kurz }}`        | Kurzer Sitzungstitel (optional im Sitzungsformular hinterlegt, z. B. für Kopfzeilen) |
| `{{ typ }}`               | Art der Sitzung                 |
| `{{ datum }}`             | Datum (ISO, z. B. 2025-03-15)   |
| `{{ datum_dmy }}`         | Sitzungsdatum DD.MM.YYYY (z. B. 15.03.2025) |
| `{{ wochentag }}`         | Wochentag der Sitzung (z. B. Montag) |
| `{{ datum_erstellung }}`  | Datum der Dokumentenerstellung, DD.MM.YYYY (für Briefkopf) |
| `{{ uhrzeit }}`           | Uhrzeit (z. B. 19:00)           |
| `{{ ort }}`               | Ort der Sitzung                 |
| `{{r tagesordnung }}`     | Tagesordnung: Präfix „TOP“, 1. Ebene fett (RichText; Schrift über Config) |
| `{{ einladungsempfaenger }}` | Empfängerblock: je nach gewählter Einladungsvariante (Landesvorstand / Erweiterter Landesvorstand / Freitext) – vorgefertigter Text oder Nutzer-Freitext |

### protokoll.docx (Protokoll)

Alle Platzhalter von **einladung.docx** plus:

| Platzhalter                 | Beschreibung                                      |
|-----------------------------|----------------------------------------------------|
| `{{ teilnehmer }}`         | Teilnehmer (allgemein)                            |
| `{{ teilnehmer_eingeladene }}` | Teilnehmer der Eingeladenen, **hintereinander** (kommasepariert, eine Zeile) |
| `{{ teilnehmer_zeile }}`   | **Alle** Teilnehmer in einer Zeile: Eingeladene + sonstige, kommasepariert |
| `{{ teilnehmer_sonstige }}` | Sonstige Teilnehmer (Freitext)                    |
| `{{ sitzungsleitung }}`     | Sitzungsleitung (Name)                            |
| `{{ protokollfuehrer }}`    | Protokollführer (Name)                            |
| `{{ beschluesse }}`         | Beschlüsse (Freitext)                             |
| `{{ tagesordnung_liste }}`  | Rohdaten Tagesordnung (für Schleifen, fortgeschritten) |
| `{{ top_mit_protokoll }}`   | Liste aller TOPs inkl. Protokolltext (für fortgeschrittene Nutzung) |
| `{{r top_mit_protokoll_text }}` | **Empfohlen:** Alle TOPs inkl. Unterpunkte (TOP 1, TOP 1.1, …). **Titel fett, Protokolltext normal und eingerückt.** Nutzt dieselbe Schrift wie die Tagesordnung (DOCX_TAGESORDNUNG_*), damit die Vorlagen-Formatierung erhalten bleibt. |
| `{{r anwesende_protokoll }}` | **Empfohlen für Anwesende:** Kategorien **Landesvorstand**, **Sonstige Anwesende**, ggf. **Kreisverbände** als **fette Überschrift** mit Absatz, darunter die Namen (normal). Nur nicht-leere Kategorien. In der Vorlage **`{{r anwesende_protokoll }}`** („r“ = RichText) verwenden. |
| `{{ teilnehmer_landesvorstand }}` | Nur die als Landesvorstand kategorisierten Anwesenden (kommasepariert). Leer, wenn keine. |
| `{{ teilnehmer_sonstige_anwesende }}` | Sonstige Anwesende (Ombudsperson, LGS, LSSH, Bundesvorsitz etc.), kommasepariert. Leer, wenn keine. |
| `{{ teilnehmer_kreisverbaende }}` | Nur bei erweitertem Landesvorstand: Kreisverbände (kommasepariert). Leer, wenn keine. |

**TOPs mit Protokoll im Protokoll-Dokument abbilden**

docxtpl unterstützt **kein** `{% p for %}` („Paragraph-Loop“). Stattdessen stellt das Backend den Platzhalter **`{{ top_mit_protokoll_text }}`** bereit: einen bereits formatierten Text mit allen TOP-Überschriften und Protokolltexten (inkl. Unterpunkte), getrennt durch Absätze.

**Falls in protokoll.docx bisher `{% p for top in top_mit_protokoll %}` verwendet wurde:** Diese Syntax wird von docxtpl nicht unterstützt (Fehler „unknown tag 'p'“). Den gesamten Schleifen-Absatz durch **einen** Absatz ersetzen, der nur `{{r top_mit_protokoll_text }}` enthält.

**In der Word-Vorlage protokoll.docx:** An der Stelle, an der die TOPs mit Protokoll erscheinen sollen, genau einen Absatz einfügen mit:

```
{{r top_mit_protokoll_text }}
```

(Das „r“ sorgt für RichText – TOP-Titel werden fett, der Protokolltext normal und eingerückt. Schriftart/-größe kommen aus DOCX_TAGESORDNUNG_* wie bei der Tagesordnung.)

Damit erscheinen nacheinander „TOP 1: …“, darunter der eingerückte Protokolltext, dann Unterpunkte „TOP 1.1: …“, „TOP 1.2: …“, danach „TOP 2: …“, usw. Jeder Block ist ein eigener Absatz.

Die Liste **`top_mit_protokoll`** (mit `titel`, `protokoll`, `unterpunkte_mit_protokoll`) bleibt für spätere Erweiterungen verfügbar; für die Standard-Protokollvorlage reicht **`{{ top_mit_protokoll_text }}`**.

**Anwesende (Protokoll):** Bei Sitzungen des Landesvorstandes bzw. erweiterten Landesvorstandes werden die ausgewählten Teilnehmer in Kategorien aufgeteilt. Jede Kategorie erscheint als **fette Überschrift** in einem eigenen Absatz, die Namen folgen im nächsten Absatz (normal). Leere Kategorien entfallen. Platzhalter: **`{{r anwesende_protokoll }}`**. Alternativ die drei Platzhalter `{{ teilnehmer_landesvorstand }}`, `{{ teilnehmer_sonstige_anwesende }}`, `{{ teilnehmer_kreisverbaende }}` (reiner Text).

Für einfache Vorlagen: `{{ titel }}`, `{{ titel_kurz }}`, `{{ datum }}`, **`{{r tagesordnung }}`**, **`{{r top_mit_protokoll_text }}`**, **`{{r anwesende_protokoll }}`**, `{{ sitzungsleitung }}`, `{{ protokollfuehrer }}`, `{{ beschluesse }}`.

### aenderungsantrag.docx

Für Änderungsanträge zu Satzung/GO (Synopse). Platzhalter je nach Implementierung – bei Bedarf in der API/Doku ergänzen.
