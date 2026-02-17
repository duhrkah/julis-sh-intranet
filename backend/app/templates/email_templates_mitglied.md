# E-Mail-Templates für Mitglieder – Kopiervorlagen

Diese Texte kannst du unter **Mitglieder → E-Mail-Templates** anlegen.  
Typ: **Mitglied**, Szenario jeweils wie angegeben. Die E-Mail geht an die im Formular hinterlegte E-Mail-Adresse des Mitglieds. Platzhalter in geschweiften Klammern werden beim Versand ersetzt.

---

## Verbandswechsel (intern)

**Szenario:** verbandswechsel_intern  
**Typ:** Mitglied

**Betreff:** Bestätigung: Interner Verbandswechsel – {kreisverband_alt} → {kreisverband_neu}

**Inhalt:**
```
Hallo {vorname},

wir bestätigen dir deinen internen Verbandswechsel innerhalb von JuLis Schleswig-Holstein:

  • Ehemaliger Kreisverband: {kreisverband_alt}
  • Neuer Kreisverband: {kreisverband_neu}
  • Wechseldatum: {wechseldatum}

Deine Mitgliedsnummer lautet weiterhin: {mitgliedsnummer}.

Die Kreisverbände {kreisverband_alt} und {kreisverband_neu} wurden über den Wechsel informiert.

Bei Fragen melde dich gerne bei deinem neuen Kreisverband oder bei der Landesgeschäftsstelle.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## Platzhalter (Mitglieder-Templates)

| Platzhalter | Bedeutung |
|-------------|-----------|
| {vorname}, {nachname} | Name des Mitglieds |
| {email} | E-Mail des Mitglieds |
| {mitgliedsnummer} | Mitgliedsnummer |
| {kreisverband_alt} | Ehemaliger KV (bei Verbandswechsel) |
| {kreisverband_neu} | Neuer KV (bei Verbandswechsel) |
| {wechseldatum} | Wechseldatum (bei Verbandswechsel intern) |
| {austrittsdatum} | Austrittsdatum (bei Austritt / Verbandswechsel Austritt) |
| {eintrittsdatum} | Datum der Meldung (bei Eintritt) |
| {kreis} / {kreisverband} | Name des Kreisverbands (bei Eintritt/Austritt/Datenänderung) |
| {strasse}, {hausnummer}, {plz}, {ort} | Adresse |
| {telefon}, {geburtsdatum} | Weitere Stammdaten |
| {bemerkung} | Optionale Bemerkung |
| {scenario} | Szenario (z. B. verbandswechsel_intern) |
