# E-Mail-Templates für Empfänger (KV) – Kopiervorlagen

Diese Texte kannst du unter **Mitglieder → E-Mail-Templates** anlegen.  
Typ: **Empfänger (KV)**, Szenario jeweils wie angegeben. Platzhalter in geschweiften Klammern werden beim Versand ersetzt.

---

## 1. Eintritt

**Szenario:** eintritt

**Betreff:** Neues Mitglied im {kreis}: {vorname} {nachname}

**Inhalt:**
```
Hallo {vorsitzender} und {schatzmeister},

folgendes Mitglied ist im {kreis} neu eingetreten:

Name: {nachname}
Vorname: {vorname}
Straße: {strasse}
Hausnummer: {hausnummer}
Ort: {ort}
PLZ: {plz}
E-Mail: {email}
Mobil: {telefon}
Kreisverband: {kreis}
Eintrittsdatum: {eintrittsdatum}
Mitgliedsnummer: {mitgliedsnummer}

Solltest Du Fragen haben, melde dich gerne bei mir.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## 2. Austritt

**Szenario:** austritt

**Betreff:** Austritt aus dem {kreis}: {vorname} {nachname}

**Inhalt:**
```
Hallo {vorsitzender} und {schatzmeister},

folgendes Mitglied ist aus dem {kreis} ausgetreten:

Name: {nachname}
Vorname: {vorname}
Geburtsdatum: {geburtsdatum}
Mitgliedsnummer: {mitgliedsnummer}
Austrittsdatum: {austrittsdatum}
Kreisverband: {kreis}

Solltest Du Fragen haben, melde dich gerne bei mir.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## 3. Verbandswechsel (Eintritt)

**Szenario:** verbandswechsel_eintritt

**Betreff:** Verbandswechsel – Neues Mitglied im {kreis}: {vorname} {nachname}

**Inhalt:**
```
Hallo {vorsitzender} und {schatzmeister},

folgendes Mitglied ist in den {kreis} gewechselt:

Name: {nachname}
Vorname: {vorname}
Straße: {strasse}
Hausnummer: {hausnummer}
Ort: {ort}
PLZ: {plz}
E-Mail: {email}
Mobil: {telefon}
Neuer Kreisverband: {kreisverband_neu}
Mitgliedsnummer: {mitgliedsnummer}

Solltest Du Fragen haben, melde dich gerne bei mir.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## 4. Verbandswechsel (Austritt)

**Szenario:** verbandswechsel_austritt

**Betreff:** Verbandswechsel – Austritt aus dem {kreis}: {vorname} {nachname}

**Inhalt:**
```
Hallo {vorsitzender} und {schatzmeister},

folgendes Mitglied hat den {kreis} im Rahmen eines Verbandswechsels verlassen:

Name: {nachname}
Vorname: {vorname}
Geburtsdatum: {geburtsdatum}
Mitgliedsnummer: {mitgliedsnummer}
Austrittsdatum: {austrittsdatum}
Ehemaliger Kreisverband: {kreisverband_alt}

Solltest Du Fragen haben, melde dich gerne bei mir.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## 5. Verbandswechsel (intern)

**Szenario:** verbandswechsel_intern

**Hinweis:** Beim Verbandswechsel (intern) werden **beide** Kreisverbände angeschrieben – der abgebende KV ({kreisverband_alt}) und der aufnehmende KV ({kreisverband_neu}). Vorsitzender und Schatzmeister beider KVs erhalten jeweils eine E-Mail. Die Platzhalter {ihr_kreis} und {abgebend_oder_aufnehmend} passen sich automatisch an („abgebend“ bzw. „aufnehmend“ und der jeweilige KV-Name).

**Betreff:** Interner Verbandswechsel – {vorname} {nachname} (Information an {ihr_kreis})

**Inhalt:**
```
Hallo {vorsitzender} und {schatzmeister},

Sie erhalten diese E-Mail als {abgebend_oder_aufnehmend}er Kreisverband ({ihr_kreis}). Folgendes Mitglied hat intern von {kreisverband_alt} nach {kreisverband_neu} gewechselt:

Name: {nachname}
Vorname: {vorname}
Straße: {strasse}
Hausnummer: {hausnummer}
Ort: {ort}
PLZ: {plz}
E-Mail: {email}
Mobil: {telefon}
Wechseldatum: {wechseldatum}
Ehemaliger Kreisverband: {kreisverband_alt}
Neuer Kreisverband: {kreisverband_neu}
Mitgliedsnummer: {mitgliedsnummer}

Solltest Du Fragen haben, melde dich gerne bei mir.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## 6. Datenänderung

**Szenario:** veraenderung

**Betreff:** Datenänderung im {kreis}: {vorname} {nachname}

**Inhalt:**
```
Hallo {vorsitzender} und {schatzmeister},

bei folgendem Mitglied wurden Daten geändert (Kreisverband: {kreis}):

Name: {nachname}
Vorname: {vorname}
Straße: {strasse}
Hausnummer: {hausnummer}
Ort: {ort}
PLZ: {plz}
E-Mail: {email}
Mobil: {telefon}
Kreisverband: {kreis}
Mitgliedsnummer: {mitgliedsnummer}

Bemerkung: {bemerkung}

Solltest Du Fragen haben, melde dich gerne bei mir.

Mit freundlichen Grüßen
Deine Landesgeschäftsstelle
```

---

## Platzhalter-Übersicht

| Platzhalter | Bedeutung |
|-------------|-----------|
| {vorsitzender} | Name des Kreisvorsitzenden |
| {schatzmeister} | Name des Kreisschatzmeisters |
| {kreis} / {kreisverband} | Name des Kreisverbands |
| {kreisverband_alt} | Ehemaliger KV (bei Verbandswechsel) |
| {kreisverband_neu} | Neuer KV (bei Verbandswechsel) |
| {ihr_kreis} | Name des KV, an den diese E-Mail geht (bei Verbandswechsel: abgebender oder aufnehmender KV) |
| {abgebend_oder_aufnehmend} | Bei Verbandswechsel: „abgebend“ oder „aufnehmend“; sonst leer |
| {vorname}, {nachname} | Name des Mitglieds |
| {strasse}, {hausnummer}, {ort}, {plz} | Adresse |
| {email}, {telefon} | Kontakt |
| {eintrittsdatum} | Datum der Meldung (bei Eintritt) |
| {austrittsdatum} | Austrittsdatum (bei Austritt / Verbandswechsel Austritt) |
| {wechseldatum} | Wechseldatum (bei Verbandswechsel intern) |
| {bemerkung} | Optionale Bemerkung (z. B. bei Datenänderung) |
