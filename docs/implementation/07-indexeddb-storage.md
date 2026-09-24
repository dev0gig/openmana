# 07 — Lokale Datenschicht (IndexedDB)

> Umsetzung von [`prompts/queue/07-indexeddb-storage.md`](../../prompts/queue/07-indexeddb-storage.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `c9ee901` (sauberer Arbeitsbaum; die App meldet keine lokalen Änderungen). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §5, §15, §16, §17, [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md),
> die Web-App aus Prompt 06 und ihr Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
> Code: `src/storage/` (Datenschicht und ihre Oberfläche), `scripts/generate-storage.ts`
> (Typen und Prüfer aus dem Schema), `scripts/e2e/run.ts` (End-to-End-Test). Messungen auf odin
> (Intel i7-8700T, 12 Threads, Debian 13), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 07 ist umgesetzt.** OpenMana hat eine versionierte lokale Datenbank
im Browser (IndexedDB, Name `openmana`, Schema-Version 1) mit eigenen
Speicherbereichen für **Decks, Einstellungen, aufgezeichnete Partien samt
Verlauf, Scryfall-Kartendaten, einen Zwischenspeicher-Index und die eigenen
Metadaten** der Datenbank. Kein Konto, keine Cloud, nie `localStorage`.

- **Explizites Schema:** Jeder Eintrag und jede Zeile der Sicherungsdatei ist
  in einem JSON Schema beschrieben; TypeScript-Typen und vorkompilierte Prüfer
  werden daraus erzeugt – genau wie beim Engine-Protokoll. Jeder Eintrag wird
  **vor** dem Schreiben geprüft; ein beschädigter gespeicherter Eintrag wird
  angezeigt, nie still verworfen.
- **Migrationen:** der Reihe nach, in einer einzigen Transaktion; scheitert
  eine, bleibt die Datenbank unverändert auf ihrer alten Version. Dieselben
  reinen Funktionen bringen auch **Sicherungen älterer Versionen** auf den
  aktuellen Stand.
- **Robuste Transaktionen:** jeder Schreibvorgang ist „alles oder nichts“
  und gilt erst als erledigt, wenn der Browser ihn festgeschrieben hat
  (`durability: "strict"`); erst dann erfahren Ansichten und andere Tabs
  davon.
- **Fehler sichtbar:** kein IndexedDB, neuere Datenbank-Version, beschädigter
  Aufbau, gescheiterte Migration, voller Speicher, anderer Tab aktualisiert oder
  setzt zurück, Browser schließt die Verbindung – jeweils eine eigene,
  deutsche Meldung mit technischem Detail und dem, was man tun kann.
- **Speicherplatz:** belegt/frei laut Browser, „dauerhaft gespeichert“ ja/nein,
  Warnung bei wenig Platz, Vorab-Prüfung vor großen Importen.
- **Sicherung:** „Sicherung speichern“ lädt eine gzip-komprimierte
  JSON-Lines-Datei mit Kopf- und Endzeile herunter; „Sicherung laden“ prüft
  die ganze Datei, zeigt, was sich ändert, und importiert nach Wahl
  „Zusammenführen“ oder „Ersetzen“ in **einer** Transaktion.
- **Prüfung:** „Daten prüfen“ kontrolliert jeden Eintrag, findet verwaiste
  Partieverläufe und fehlende Metadaten; beschädigte Einträge lassen sich nach
  Bestätigung entfernen.

**Nachweise:** Typecheck, oxlint, Frische der erzeugten Dateien, **179
Vitest-Tests** (82 bestehende + 97 neue, die Datenschicht mit
`fake-indexeddb`) und ein erweiterter End-to-End-Test im **echten Chrome mit
echter IndexedDB**: Import, Neuladen, Download einer echten Sicherung, deren
Import in ein zweites, leeres Browserprofil (Eintrag für Eintrag gleich),
abgelehnte Dateien, beschädigte Einträge, Speichergrenze, ein anderer Tab mit
neuerer Version, gelöschte Websitedaten. Engine-Unit-Tests 80/80 unverändert,
frischer Klon grün. Kein Blocker.

## 1. Was gebaut wurde

```
src/storage/
├── schema/local-data.schema.json   die einzige Quelle aller Eintrags- und Sicherungsformate
├── generated/                      records.ts, constants.ts, validators.js/.d.ts (erzeugt, eingecheckt)
├── schema.ts                       Datenbankname, Stores (Aufbau, Rolle), Prüfung je Store
├── migrations.ts                   Migrationen (Version 1), Ablauf, Verlauf in meta/database, upgradeRecord
├── open.ts                         Öffnen: Upgrade, blockiert, neuere Version, Aufbau-Vergleich
├── database.ts                     LocalDatabase: read/write in je einer Transaktion, PendingRequests, sortOut/assertRecord
├── errors.ts                       StorageError und die Übersetzung der Browserfehler
├── quota.ts                        Speicherplatz (StorageManager), Warnschwelle, ensureSpace
├── backup.ts                       Sicherung schreiben, lesen/prüfen, planen, importieren
├── integrity.ts                    Prüfung aller Einträge, Entfernen beschädigter
├── decks.ts, matches.ts, settings.ts, overview.ts   Zugriffe der Oberfläche
├── storage-session.ts              StorageSession: Zustand, Wiederholen, Zurücksetzen, Änderungen (auch zwischen Tabs)
├── storage-context.tsx             StorageProvider, useStorage, useStorageQuery
├── storage-labels.ts               deutsche Texte, Byte-/Datumsformat
├── local-data-card.tsx             Karte „Daten auf diesem Gerät“ (Einstellungen)
├── backup-import-dialog.tsx        Dialog „Sicherung laden“
├── storage-alert.tsx, download.ts
└── *.test.ts(x)                    97 Tests (mit src/app/local-first.test.ts)
scripts/generate-storage.ts         npm run generate / --check
src/test/storage-fixtures.ts        Musterdaten und Helfer der Tests
```

Seiten: **Decks**, **Partien** und **Spielen** lesen jetzt die Datenbank und
zeigen, was wirklich gespeichert ist (leer, Liste, beschädigte Einträge oder
den Fehler) – bisher waren sie fest „leer“. Die **Einstellungen** haben die
neue Karte „Daten auf diesem Gerät“. Neue shadcn-Bausteine: `Dialog`,
`AlertDialog`, `RadioGroup`, `Field` (+ `Label`).

## 2. Stack und Branchenstandard

| Baustein | Wahl | Einordnung |
|---|---|---|
| Speicher | **IndexedDB** | der einzige Browserspeicher für strukturierte, große, transaktionale Daten; `localStorage` ist synchron, klein (≈ 5 MB) und nur Text (Bible §5) |
| Zugriff | **`idb` 8.0.3** (Jake Archibald, ISC, ~1,3 KB gzip) | der verbreitete, dünne Promise-Wrapper nah an der Spezifikation (u. a. von Workbox genutzt). **Dexie** wäre die Alternative mit eigener Versionierung und Live-Abfragen, bringt aber eine eigene Transaktions-„Zone“ und ~25 KB mit; hier sollten Migrationen reine, auch für Sicherungen nutzbare Funktionen sein, und dafür reicht `idb` |
| Schema | **JSON Schema 2020-12 + Ajv standalone** (erzeugt, eingecheckt) | derselbe Weg wie beim Engine-Protokoll (Bible §17: explizite Schemas an Speicher-Grenzen); das Sicherungsformat ist damit sprachneutral beschrieben |
| Tests | **fake-indexeddb 6.2.5** in Vitest; End-to-End im echten Chrome | fake-indexeddb ist die übliche vollständige IndexedDB-Implementierung für Node (besteht die Web-Platform-Tests weitgehend); das Verhalten des echten Browsers prüft der E2E-Test |
| Sicherungsformat | **JSON Lines, gzip** (`CompressionStream`) | JSON Lines ist das übliche streamfähige Exportformat; Datensätze werden Zeile für Zeile geschrieben und gelesen, nie als ein riesiger Text; gzip ist in jedem Browser eingebaut |
| Mehrere Tabs | `versionchange`/`blocked`/`close` + **BroadcastChannel** | der Standardweg: eine Verbindung gibt bei `versionchange` sofort frei, Änderungen werden anderen Tabs gemeldet |

`ajv` und `json-schema-to-typescript` sind nur Entwicklungswerkzeuge (dieselben
Versionen wie in `engine/`); in die App gelangt nur der erzeugte Prüfcode ohne
Ajv-Laufzeit (der Generator bricht ab, falls sich das ändert).

## 3. Die Datenbank

Eine Datenbank je Herkunft (`openmana`), **Schema-Version 1**
(`$defs.SchemaVersion` = IndexedDB-Version).

| Store | Schlüssel | Indizes | Rolle | Inhalt | in Sicherungen |
|---|---|---|---|---|---|
| `decks` | `id` | – | Nutzerdaten | Deck: id, Name, Format (`constructed`/`commander`), Main/Sideboard/Commander (normalisierte Einträge), Originaltext des Imports, angelegt/geändert | ja |
| `settings` | `key` | – | Nutzerdaten | eine Einstellung: Schlüssel, JSON-Wert, geändert | ja |
| `matches` | `id` | `startedAt` | Nutzerdaten | Kopf einer aufgezeichneten Partie: Status, Format, Zeiten, Seed, App-/Engine-Stand, beide Decks wie an Forge übergeben, Ende | ja |
| `matchLog` | `[matchId, seq]` | – | Nutzerdaten | jede Protokollnachricht der Partie in Reihenfolge (Engine und Spieler) | ja |
| `scryfallCards` | `id` | `oracleId`, `nameKeys` (mehrfach), `print` `[set, collectorNumber]` | Zwischenspeicher | Kartendaten von Scryfall (nur Anzeige und Suche; Inhalt legt Prompt 08 fest) | nein |
| `cacheIndex` | `key` | `kind`, `lastUsedAt` | Zwischenspeicher | Buchführung zwischengespeicherter Ressourcen: Quelle, Version, vollständig/teilweise, Größe, letzte Nutzung | nein |
| `meta` | `key` | – | intern | `database`: angelegt wann/von welcher App-Version, jede Migration; `backup`: letzte Sicherung erstellt/geladen | nein |

- **Einträge sind reines JSON** (Text, Zahl, Wahrheitswert, null, Listen,
  Objekte) – so überstehen sie eine Sicherung unverändert.
- **Zeitstempel** als ISO-Text in UTC (`Date.toISOString()`), sortiert
  richtig als Text und ist in der Sicherung lesbar; **Ids** sind UUIDs.
- Die **Deck-Felder** folgen Bible §5 (Id, Name, Originaltext des Imports,
  normalisierte Einträge, Sideboard, Format, Commander, Zeitstempel,
  Schema-Version – Letztere steht für alle Einträge an der Datenbank und im
  Kopf jeder Sicherung). Der Name eines Eintrags ist der englische Name, den
  Forge kennt; Set/Sammlernummer und Scryfall-Identitäten sind optional und
  nur Anzeige (Prompt 08/09 füllen sie).
- **Partien** und **Kartendaten** werden erst mit Prompt 22 bzw. 08 wirklich
  befüllt; ihr Aufbau ist jetzt festgelegt, damit Sicherung, Prüfung und
  Tests sie schon abdecken. Braucht 08 oder 22 etwas anderes, ist das eine
  Migration (Version 2).
- **Einstellungen:** Jede Einstellung wird im Code einmal definiert
  (Schlüssel, Rückfallwert, Prüfung). Ein gespeicherter Wert, der die Prüfung
  nicht besteht, fällt sichtbar auf den Rückfallwert zurück; Schlüssel, die
  diese App-Version nicht kennt, bleiben unangetastet und reisen in
  Sicherungen mit. Konkrete Einstellungen (KI-Profil, Kartensprache,
  Bewegung) bringt Prompt 12.

Jede geöffnete Datenbank wird mit dem erwarteten Aufbau verglichen (Stores,
Schlüsselpfade, Indizes). Weicht er ab, öffnet die App sie nicht
(„beschädigt“), statt mit halben Stores zu arbeiten.

## 4. Migrationen

`src/storage/migrations.ts`, je Schema-Version eine Migration, streng 1, 2,
3 … Eine Migration kann

- den **Aufbau** ändern (Stores, Indizes) – synchron in der
  Versionswechsel-Transaktion,
- **Einträge umbauen** – mit einer reinen Funktion je Store von der
  vorigen Form in ihre; dieselbe Funktion wandelt auch Einträge älterer
  Sicherungen (`upgradeRecord`), eine Sicherung braucht also nie ihre alte
  App-Version,
- **Zwischenspeicher leeren** – die Daten werden neu geladen.

Jede Migration läuft vollständig, bevor die nächste beginnt (eine spätere
darf sich auf die Einträge der früheren verlassen). Alles geschieht in der
einen Transaktion, die IndexedDB für ein Upgrade gibt: **scheitert ein
Schritt, verwirft der Browser das ganze Upgrade**, die Datenbank bleibt auf
ihrer alten Version, und die App meldet „ließen sich nicht auf diese Version
bringen“ samt Version und Store. `meta/database` hält fest, welche Migration
wann mit welcher App-Version lief.

Regeln (auch in `AGENTS.md`): eine veröffentlichte Migration nie ändern; den
Aufbau einer Migration in einer eigenen Konstante beschreiben (die aktuelle
Beschreibung `STORE_LAYOUT` zieht weiter); `SchemaVersion` im Schema
gemeinsam anheben; Nutzerdaten werden migriert, Zwischenspeicher dürfen
geleert werden.

Version 1 legt die Stores aus §3 an. Geprüft ist der Mechanismus mit drei
ausgedachten Versionen (neuer Index, Einträge nacheinander umgebaut, Cache
geleert, nur die fehlenden Schritte, gescheiterte Migration ohne jede
Änderung, fehlender Verlauf) und mit der echten Version 1 (ergibt genau den
erwarteten Aufbau).

## 5. Transaktionen und Fehler

`LocalDatabase` (`src/storage/database.ts`):

- **`write(stores, work)`** – eine `readwrite`-Transaktion, standardmäßig
  `durability: "strict"` (erledigt heißt: auf dem Datenträger). Wirft `work`
  oder scheitert eine Anfrage, wird die Transaktion zurückgerollt; ein Fehler,
  den der Browser erst beim Festschreiben meldet (Speicher voll), wird
  ebenso gefangen. Erst **nach** dem Festschreiben werden die geänderten Stores
  gemeldet (Ansichten lesen neu, andere Tabs per BroadcastChannel).
- **`read(stores, work)`** – ein konsistenter Blick über mehrere Stores.
- In `work` wird nur auf Anfragen derselben Transaktion gewartet (sonst
  schließt der Browser die Transaktion vorzeitig – die IndexedDB-Regel);
  geprüft und vorbereitet wird davor. Viele Anfragen auf einmal sammelt
  `PendingRequests`, damit nach einem Fehler keine unbehandelte Ablehnung
  übrig bleibt.
- Der Fehler, mit dem der Browser eine Transaktion abbricht
  (`QuotaExceededError`, `ConstraintError` …), hat Vorrang vor dem
  nichtssagenden `AbortError` der übrigen Anfragen.

| Code | Ursache | die App sagt / bietet |
|---|---|---|
| `unsupported` | kein IndexedDB, Websitedaten blockiert (`SecurityError`) | „erlaubt keinen lokalen Speicher“ – Speichern erlauben, kein privates Fenster |
| `version-too-new` | `VersionError`: eine neuere OpenMana-Version hat die Datenbank angehoben | „stammen von einer neueren Version“ – **Neu laden**, kein Zurücksetzen |
| `schema-mismatch` | richtige Version, falscher Aufbau | „beschädigt“ – Erneut versuchen, **Zurücksetzen** (mit Bestätigung) |
| `upgrade-failed` | eine Migration scheiterte, Daten unverändert | Neu laden/melden, Zurücksetzen als letzter Ausweg |
| `open-failed` | sonstiger Fehler beim Öffnen (beschädigte Browserdaten) | Erneut versuchen, Zurücksetzen |
| `closed` | anderer Tab aktualisiert (`upgraded`) oder setzt zurück (`deleted`), Browser schließt (`terminated`, z. B. Websitedaten gelöscht) | eigene Überschrift je Grund, **Neu laden**, zusätzlich ein Toast auf jeder Seite |
| `quota-exceeded` | `QuotaExceededError` | „Speicher … ist voll“ – nichts davon gespeichert |
| `insufficient-space` | Vorab-Prüfung: passt laut Browser nicht | „nicht genug Speicher frei“ – nichts geschrieben |
| `invalid-record` | Eintrag passt nicht zum Schema (`DataCloneError`/`DataError` ebenso) | nichts gespeichert, Problemstellen im Detail |
| `transaction-failed` | jeder andere Lese-/Schreibfehler | nichts gespeichert |
| `backup-invalid` | keine/unvollständige/beschädigte Sicherung | nichts geändert, Zeile und Grund im Detail |
| `backup-unsupported` | Sicherung einer neueren Version | nichts geändert – App neu laden |

„Zurücksetzen“ gibt es nur in den Fehlerzuständen, in denen es hilft, und
nur nach einem Bestätigungsdialog; es löscht die Datenbank und legt sie leer
neu an (andere Tabs erfahren es).

## 6. Sicherung

Format **`openmana-backup`, Formatversion 1** (`BACKUP_FORMAT_VERSION`,
unabhängig von der Schema-Version der Einträge): UTF-8, JSON Lines,
gzip-komprimiert; Dateiname `openmana-sicherung-JJJJ-MM-TT-HHMM.jsonl.gz`
(Ortszeit, der Name ist für den Spieler).

```
{"type":"header","format":"openmana-backup","formatVersion":1,"schemaVersion":1,"createdAt":"…","app":{"version":"0.1.0","commit":"…"},"stores":["decks","settings","matches","matchLog"]}
{"type":"record","store":"decks","record":{…}}
…
{"type":"end","counts":{"decks":2,"settings":1,"matches":1,"matchLog":2},"records":6}
```

- **Inhalt:** alle Nutzerdaten (Decks, Einstellungen, Partien, Verläufe),
  gelesen in **einer** Transaktion (ein konsistenter Stand). Nicht dabei:
  Zwischenspeicher (werden neu geladen) und `meta` (gehört zu diesem Browser).
  Ein beschädigter Eintrag wird unverändert mitgesichert – die Sicherung
  verliert nichts, das Laden meldet ihn.
- **Lesen prüft alles, bevor etwas geschrieben wird:** gzip oder unkomprimiert,
  strikt UTF-8, Kopfzeile (Format, Version), jede Zeile, Store laut Kopf,
  Endzeile mit denselben Zahlen (fehlt sie oder stimmen die Zahlen nicht, ist
  die Datei unvollständig), jeder Eintrag gegen sein Schema – nach dem Upgrade
  älterer Einträge mit den Migrationen der Datenbank. Eine Datei einer neueren
  Formatversion oder Schema-Version wird abgelehnt. Beschädigte, doppelte und
  verwaiste Einträge werden mit Zeile und Grund aufgelistet und nicht
  übernommen – das sieht man, **bevor** man bestätigt.
- **Zusammenführen** (empfohlen): Neues kommt dazu; bei Decks und
  Einstellungen gewinnt die neuere Fassung (`updatedAt`); eine aufgezeichnete
  Partie wird nie überschrieben (eine hier beschädigte wird samt Verlauf
  ersetzt); nichts wird gelöscht.
- **Ersetzen:** die Stores der Sicherung werden geleert und mit ihr gefüllt;
  der Knopf heißt „Lokale Daten ersetzen“, der Dialog sagt vorher, wie viele
  Einträge dabei verschwinden.
- **Ein Import ist eine Transaktion:** alles oder nichts. Entschieden wird
  innerhalb der schreibenden Transaktion (eine Änderung in einem anderen Tab
  kann nicht dazwischenrutschen); der Dialog zeigt dieselbe Rechnung vorab.
- „Letzte Sicherung“ wird in `meta/backup` vermerkt. Scheitert nur dieser
  Vermerk (etwa bei vollem Speicher), ist die Datei trotzdem heruntergeladen,
  und die App sagt genau das.

**Größe:** Die Beispielsicherung des E2E-Tests (2 Decks, 1 Einstellung,
1 Partie mit 2 Verlaufszeilen) hat 882 Bytes. Solange es keine Aufzeichnungen
gibt, bleiben Sicherungen klein. Mit Prompt 22 können Verläufe groß werden:
Das Format ist dafür streamfähig; Export (ein Lesevorgang) und Import (eine
Transaktion) halten die Daten derzeit aber noch vollständig im Speicher –
das prüft Prompt 22 mit echten Aufzeichnungen.

## 7. Speicherplatz

- Anzeige aus `navigator.storage.estimate()` und `persisted()`: belegt, frei
  (Quota − Nutzung), dauerhaft gespeichert ja/nein; unbekannt bleibt
  unbekannt. Unter **256 MiB** frei erscheint „Wenig Speicher frei“ (ein
  Engine-Update und die Kartendaten brauchen Platz).
- **Vorab-Prüfung** (`ensureSpace`) vor großen Schreibvorgängen: Ein Import
  braucht laut Plan das Doppelte der Datensätze (Indizes, Verwaltung des
  Browsers); reicht der gemeldete freie Platz nicht, sagt der Dialog es und
  startet gar nicht erst. Unbekannte Werte blockieren nicht – der Schreibvorgang
  selbst meldet dann `quota-exceeded`, ohne etwas zu schreiben.
- **Dauerhaften Speicher anfordern** (`navigator.storage.persist()`) ist
  Aufgabe von Prompt 25; hier wird der Zustand nur angezeigt, zusammen mit
  dem Rat zur Sicherung.
- **Chrome meldet eine pauschale Quota** (siehe §11.2): Die Angaben sind
  Schätzungen des Browsers, und die Karte sagt das.

## 8. Prüfung

`checkIntegrity` liest alle Stores in einer Transaktion: jeden Eintrag gegen
sein Schema, jeden Verlaufseintrag gegen seine Partie, `meta/database`
(vorhanden, richtige Version). Ergebnis: geprüfte Anzahl und Probleme mit
Store, Schlüssel und Stelle. `removeDamaged` löscht nach Bestätigung nur
Einträge, die **beim Löschen noch** beschädigt sind (ein inzwischen, etwa durch
eine geladene Sicherung, reparierter bleibt). Fehlende Metadaten sind kein
Löschfall.

Auch ohne Prüfung zeigt jede Liste beschädigte Einträge als „beschädigt“
(Decks, Partien), statt sie wegzulassen.

## 9. Oberfläche

- **Einstellungen → „Daten auf diesem Gerät“:** Zustand (Öffnet, Wartet,
  Bereit, Fehler, Getrennt), Zahlen je Bereich, Speicherplatz, „dauerhaft
  gespeichert“, letzte Sicherung, Datenbank-Version und -Alter; „Sicherung
  speichern“, „Sicherung laden“, „Daten prüfen“; in Fehlerzuständen
  „Erneut versuchen“, „Neu laden“ bzw. „Lokale Daten zurücksetzen“.
- **Dialog „Sicherung laden“:** „In der Sicherung“ (Zahlen, Herkunft,
  beschädigte Einträge), Wahl Zusammenführen/Ersetzen als Auswahlkarten,
  „Das ändert sich auf diesem Gerät“ je Bereich, Platzprüfung, Fehler an Ort
  und Stelle. Lange Dialoge scrollen innerhalb des Bildschirms (auch am Handy).
- **Decks / Partien / Spielen** zeigen den echten Stand: Skelett beim Laden,
  „leer“ nur wenn die Datenbank leer ist, sonst eine schlichte Liste (Details,
  Bearbeiten, Löschen folgen mit Prompt 10 bzw. 22), und bei einem Fehler die
  Meldung statt einer leeren Liste. „Partie starten“ bleibt gesperrt und sagt
  warum.
- Alles für den Spieler auf Deutsch; Codes, Stores und technische Details
  englisch. Nur shadcn-Bausteine und Tokens; Bestätigungsdialoge für alles
  Unumkehrbare (`docs/DESIGN_SYSTEM.md`, Regel 4).

## 10. Nachweise

Alle auf `c9ee901` (sauberer Arbeitsbaum). `npm run check` 75,5 s.

### 10.1 Erzeugte Dateien, Typecheck, Lint

`node scripts/generate-storage.ts --check` (auch am Anfang von `npm run check`
und `npm run build`): erzeugte Dateien = Schema. `tsc -b` (App, Tests,
Werkzeuge) ohne Fehler, `oxlint` ohne Befund.

### 10.2 Unit- und Komponententests (179, davon 97 neu)

| Datei | Tests | Was |
|---|---:|---|
| `src/storage/schema.test.ts` | 12 | erzeugte Dateien frisch; Prüfer nehmen gültige Einträge jedes Stores an, nennen Pfad und Problem bei ungültigen (Ids, Zeitstempel, Anzahlen, Schlüssel, Meta-Unterscheidung); Sicherungszeilen; Stores = Aufbau = Rollen = Prüfer; Sicherungen = Nutzer-Stores; Deckformat und Spielergebnis = Engine-Protokoll |
| `src/storage/migrations.test.ts` | 9 | neue Datenbank durchläuft alle Migrationen mit Verlauf; alte Datenbank wird Schritt für Schritt umgebaut, Cache geleert; nur fehlende Schritte; **gescheiterte Migration lässt alles unverändert**; fehlender Verlauf wird neu geschrieben; Einträge alter Sicherungen; Migrationsliste lückenlos = Schema-Version; Version 1 = erwarteter Aufbau |
| `src/storage/open.test.ts` | 9 | kein IndexedDB; neuere Version; falscher Aufbau (Verbindung wird geschlossen); Store-/Index-Vergleich; **blockiert** durch alten Tab, danach weiter; anderer Tab aktualisiert/löscht → sofort freigegeben und gemeldet; Browser schließt die Verbindung |
| `src/storage/database.test.ts` | 13 | Änderungen erst nach dem Festschreiben gemeldet; **alles oder nichts** bei Fehler in der Arbeit, bei gescheiterter Anfrage (Grund bleibt erhalten) und bei **vollem Speicher** (eingespeister `QuotaExceededError`); geschlossene Verbindung; Deck wird vor dem Schreiben geprüft; beschädigte Einträge neben gültigen gemeldet; Einstellungen (Rückfall, ungültig, nur JSON, fremde Schlüssel bleiben); Zuordnung der Browserfehler |
| `src/storage/backup.test.ts` | 21 | Format (gzip, Kopf, jede Zeile, Ende, ohne Caches/Meta); beschädigte Einträge und BigInt lassen den Export nicht scheitern; Vermerk der Sicherung; Rundreise; unkomprimiert, CRLF, BOM; kein UTF-8; keine Sicherung, unvollständig, abgeschnittenes gzip, kaputte Zeile mit Nummer, fremder Store, neuere Versionen; beschädigte/doppelte/verwaiste Einträge mit Zeile; ältere Schema-Version wird umgebaut; Zusammenführen (neuer gewinnt, Partien bleiben, beschädigte werden ersetzt); Ersetzen (nur die Stores der Sicherung, Caches bleiben); **Import alles oder nichts** bei Fehler mitten im Schreiben; Platzprüfung; Export → leere Datenbank = dieselben Daten |
| `src/storage/integrity.test.ts` | 3 | gesund = keine Probleme; beschädigt, verwaist, fehlende Metadaten; entfernt nur, was noch beschädigt ist |
| `src/storage/quota.test.ts` | 5 | Werte, nie negativ, Unbekanntes bleibt unbekannt, Vorab-Prüfung, Warnschwelle |
| `src/storage/storage-session.test.ts` | 10 | öffnen/schließen/wieder öffnen (React Strict Mode); Fehler mit Grund und Wiederholen; Zurücksetzen; blockiert; Verbindung verloren (aktualisiert, zurückgesetzt, vom Browser geschlossen); Änderungsmeldungen nur für betroffene Stores, nach dem Festschreiben, **zwischen Tabs**, nicht bei Fehlern |
| `src/storage/local-data.test.tsx` | 13 | Karte: Zahlen und Speicher; Sicherung speichern (Download, Vermerk); Datei wird trotz gescheitertem Vermerk ausgegeben; Sicherung laden → Dialog → Zusammenführen → Deckliste; Ersetzen sagt, was verschwindet; keine Sicherung abgelehnt; Prüfen und Entfernen mit Bestätigung; neuere Version: Neu laden, Seiten nicht „leer“; beschädigter Aufbau: Zurücksetzen; anderer Tab: Meldung und Toast; Decks-, Partien-, Spielen-Seite mit Daten |
| `src/app/local-first.test.ts` | 2 | kein `localStorage`/`sessionStorage` im App-Code; die Datenschicht sendet nichts (kein `fetch`, XHR, Beacon, WebSocket) |
| bestehend | 82 | unverändert grün (ein Test wartet jetzt auf die Deckzahl, die asynchron aus der Datenbank kommt) |

### 10.3 End-to-End-Test (`scripts/e2e/run.ts`, Chrome 153, echte Engine `0c82db80023ac0cc`)

Alle bisherigen Prüfungen (Header, alle Oberflächen in drei Größen mit axe –
18 Läufe, 0 Befunde –, Engine-Start über Vorschau, Handy und Dev-Server, PWA,
ohne Isolation) plus neu, mit **echter IndexedDB**:

1. Neues Profil: Datenbank `openmana` Version 1, alles 0, Speicherangaben
   vorhanden, `localStorage` leer.
2. Eine Sicherung im dokumentierten Format laden (gzip): Dialog zeigt „2 neu“
   (axe: 0 Befunde), Zusammenführen → Zahlen stimmen.
3. **Neu laden:** Decks-Seite listet beide Decks, Partien-Seite die Partie,
   Spielen zählt 2 Decks.
4. **Sicherung speichern:** echter Download
   `openmana-sicherung-…jsonl.gz`, entpackt: Kopf Schema 1, Endzeile mit
   2/1/1/2 Einträgen; „Letzte Sicherung“ vermerkt.
5. **Zweites, leeres Profil (Handy-Größe):** diese Datei laden → alle
   Nutzer-Stores **Eintrag für Eintrag gleich**; Dialog am Handy ohne
   Überlauf, axe 0 Befunde.
6. Eine Textdatei und eine **abgeschnittene** Sicherung werden abgelehnt,
   kein Dialog, keine Änderung.
7. Ein von außen beschädigter Eintrag erscheint auf der Decks-Seite als
   „beschädigt“, „Daten prüfen“ findet ihn (axe 0), Entfernen mit Bestätigung
   löscht genau ihn.
8. **Anderer Tab öffnet Version 2:** die App gibt frei und meldet es (Karte und
   Toast); nach „Neu laden“ lehnt sie die neuere Datenbank ab, die Decks-Seite
   zeigt den Fehler statt „leer“.
9. **Websitedaten gelöscht** (DevTools `Storage.clearDataForOrigin`) während
   die App offen ist: „Der Browser hat die lokale Datenbank geschlossen“,
   nach Neu laden eine leere, funktionierende Datenbank.
10. **Speichergrenze** (eigener Chrome, DevTools `Storage.overrideQuotaForOrigin`
    auf Nutzung + 32 KB, siehe §11.2): „Wenig Speicher frei“, „Noch frei
    32,0 KB“; eine Sicherung mit 400 Decks → „nicht genug Speicher frei“,
    Zusammenführen gesperrt, nichts geschrieben.
11. Keine Konsolen- oder Seitenfehler in allen Schritten.

### 10.4 Bestehendes und frischer Klon

- Engine (unverändert): erzeugte Protokolldateien = Schema, `tsc`,
  **80/80 Unit-Tests**.
- Frischer Klon von `c9ee901`: `npm ci` grün; `npm run build` ohne Engine
  scheitert wie vorgesehen laut mit dem Hinweis auf `engine/scripts/build.sh`;
  `OPENMANA_ENGINE=omit npm run build` baut; die 179 Tests dreimal
  hintereinander grün.

## 11. Befunde

### 11.1 Ein Test war zeitabhängig (behoben)

Im frischen Klon scheiterte „Ersetzen …“ einmal: Die Toast-Bibliothek sonner
merkt sich aktive Toasts modulweit und **spielt sie jedem neu eingehängten
Toaster erneut vor** – der „Sicherung geladen“-Toast des vorigen Tests war
sofort sichtbar, der Test las die Datenbank vor dem Import. Jetzt räumt das
Test-Setup nach jedem Test alle Toasts ab, und der Test wartet auf das
Schließen des Dialogs (erst nach dem Festschreiben). Danach 5 + 3 Läufe grün.

### 11.2 Chrome meldet eine pauschale Quota; DevTools' Quota-Grenze greift bei IndexedDB nicht

- `navigator.storage.estimate()` liefert in Chrome 153 **nicht** die echte
  Quota, sondern einen pauschalen Wert (Funktion `StaticStorageQuota`, gegen
  Fingerprinting): im Test-Kontext (inkognito) 3 GiB, im festen Profil
  „Nutzung + 8 GiB“. DevTools' `Storage.overrideQuotaForOrigin` ändert die
  Quota intern (`Storage.getUsageAndQuota`), aber nicht diese Angabe – außer
  Chrome läuft mit `--disable-features=StaticStorageQuota,IncognitoStaticStorageQuota`.
  So prüft der E2E-Test die Anzeige und die Vorab-Prüfung.
- Selbst dann **schreibt IndexedDB über die überschriebene Quota hinaus**
  (5 MB bei 12,9 KB Quota festgeschrieben; der E2E-Test hält es als
  `probeWriteBeyondQuota: committed` im Bericht fest). Den echten
  `QuotaExceededError` des Browsers kann der Test so nicht auslösen; die
  Unit-Tests speisen ihn beim Schreiben ein (Rückrollen, Meldung, Datei trotz
  gescheitertem Vermerk).
- Folge für die App: Die freie Angabe ist eine Schätzung (die Karte sagt es),
  die Vorab-Prüfung blockiert nur, was laut Browser eindeutig nicht passt, und
  der Schreibvorgang selbst bleibt die letzte, sichere Instanz.

### 11.3 Weiteres

- **axe `button-name`:** Radix-Radioknöpfe (Buttons) in einem `<label>`
  gelten für axe als unbenannt; sie tragen jetzt `aria-labelledby` und
  `aria-describedby`.
- **Unbehandelte Ablehnungen:** `idb` legt für die Upgrade-Transaktion ein
  `done`-Versprechen an, das bei einer gescheiterten Migration abgelehnt wird;
  und viele gestartete Anfragen lehnen nach einem synchronen Fehler ab. Beides
  wird jetzt aufgefangen (sonst „Uncaught (in promise)“ in der Konsole).
- **jsdom** hat kein `Blob.stream()`; der Sicherungsleser liest dann die
  Datei als Ganzes (gilt auch für alte Safaris). Der Leser bricht bei einer
  abgelehnten Zeile den Rest der Datei ab (`cancel`).
- **Bundle:** Die Datenschicht liegt im Start-Bundle, weil der App-Rahmen die
  Datenbank beim Start öffnet und die Seiten ihre Daten sofort lesen: App-Code
  199 → 365 KB roh, **63 → 94 KB gzip**; Start-JavaScript **161 → 192 KB
  gzip**. Größter Posten sind die erzeugten Prüfer (87 KB minifiziert,
  8,7 KB gzip; `allErrors` aus oder ohne Meldungstexte spart kaum), dann die
  Speichermodule und Dialoge (~11 KB gzip) und `idb` (1,3 KB). Aufteilen nach
  Seiten (React Router `lazy`) ist möglich, sobald die Startzeit auf dem Handy
  gemessen ist (Prompt 24/25).

## 12. Entscheidungen und Abweichungen

- **`idb` statt Dexie** (§2).
- **Eine Schema-Version für alle Einträge** (= Datenbankversion), in
  `meta/database` und im Kopf jeder Sicherung – nicht als Feld in jedem
  Eintrag. Die Bible nennt „schema version“ unter den zu speichernden Angaben
  eines Decks; so ist sie für jedes Deck eindeutig bestimmt, ohne dass
  Migrationen ein Feld in jedem Eintrag pflegen müssen.
- **JSON Lines mit gzip** statt einer einzelnen JSON-Datei (§6), damit das
  Format auch große Aufzeichnungen trägt; der Leser nimmt auch unkomprimierte
  Dateien.
- **Zwischenspeicher und Metadaten gehören nicht in die Sicherung**;
  „Ersetzen“ leert nur die Stores, die die Sicherung enthält.
- **Aufbau von Partien und Kartendaten jetzt, Inhalt später:** 22 und 08
  können ihn per Migration anpassen; bis dahin kommen solche Einträge nur über
  eine Sicherung.
- **Noch keine Produkt-Einstellungen** (Prompt 12); der Mechanismus ist
  getestet.
- **Kein `persist()`-Aufruf** vor Prompt 25; nur Anzeige.
- **Schlichte Listen für Decks und Partien:** Eine geladene Sicherung darf
  nicht als „leer“ erscheinen (Bible §16, AGENTS: keine erfundenen Zustände);
  die eigentliche Bibliothek bleibt Prompt 10 bzw. 22.
- **Zurücksetzen nur in Fehlerzuständen**, immer mit Bestätigung; ein
  allgemeines „Alle Daten löschen“ ist nicht verlangt.
- **Empfehlung für später:** Bevor die erste Migration von **Nutzerdaten**
  ausgeliefert wird (voraussichtlich 09/10 oder 22), sollte der Fehlerzustand
  „ließen sich nicht auf diese Version bringen“ eine **Rettungssicherung**
  anbieten (die Stores roh lesen und als Datei ausgeben), damit niemand
  zurücksetzen muss, ohne seine Daten mitzunehmen.

## 13. Bekannte Lücken (mit Ziel-Prompt)

- Kartendaten und Bildcache wirklich befüllen, Aktualisierung → 08.
- Decks importieren, bearbeiten, löschen, einzeln exportieren → 09/10.
- Einstellungen (KI-Profil, Kartensprache, Bewegung) → 12.
- Partien aufzeichnen, Aufbewahrung (Standard: letzte 100), Nachspielen,
  Einzel-Export → 22; dabei Größe und Speicherbedarf großer Verläufe prüfen.
- Dauerhaften Speicher anfordern, Offline, Engine-Cache → 25.
- Aufteilen des Start-Bundles nach Seiten → 24/25 (nach Messung am Handy).

## 14. Reproduzieren

```bash
npm ci
npm run generate                 # nach einer Schema-Änderung: Typen und Prüfer neu erzeugen (einchecken!)
npm run check                    # Frische der erzeugten Dateien, tsc, oxlint, Vitest, End-to-End-Test
npx vitest run src/storage       # nur die Datenschicht
```

In der App: Einstellungen → „Daten auf diesem Gerät“. Im Browser lässt sich
die Datenbank in den DevTools unter *Application → IndexedDB → openmana*
ansehen.

## 15. Was als Nächstes kommt

Prompt **08 — Scryfall card data** (PENDING, nicht begonnen:
`naechster-schritt.md` führt genau einen Prompt je Lauf aus).
