# ORYX-Cloud – Decks über Geräte hinweg (außerhalb der Queue)

> Direkter Auftrag von dev0gig vom **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5) –
> **kein Prompt der nummerierten Queue** (`prompts/STATUS.md` bleibt unverändert). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §5, §15, die Datenschicht aus
> [07](07-indexeddb-storage.md) und die ORYX-Planung
> (`oryx-games/ORYX-SUPABASE-ARCHITEKTUR.md` §0b, §6, §7, §11; SDK
> `oryx-games/shared/oryx-sdk.js` 1.1.0). Code: `src/cloud/` (Anbindung, Karte),
> `src/storage/collection.ts` (das Dokument und die Zusammenführung),
> Löschmarken in `src/storage/decks.ts`, `backup.ts`, `migrations.ts`.

## Ergebnis

OpenMana kann die **Sammlung des Spielers** – Decks, Löschmarken gelöschter
Decks und die geräteübergreifenden Einstellungen – in der **ORYX-Cloud**
(Supabase, das Konto des Spielers bei ORYX) sichern und zwischen seinen Geräten
abgleichen. Die lokale Datenbank bleibt die Grundlage; die Cloud ist ein
Zusatz, den der Spieler ausdrücklich verbindet (Bible §15). Kein Fehler der
Cloud (offline, nicht verbunden, ORYX pausiert) ändert etwas an den lokalen
Daten.

- **Ein Cloud-Platz** `collection` mit **einem JSON-Dokument**; Schema-Version =
  `SCHEMA_VERSION` der Datenbank (jetzt **4**).
- **Zusammenführen statt Nachfragen:** je Deck gewinnt die neuere Änderung
  (`updatedAt`), eine Löschmarke löscht ein Deck, das vor dem Löschen zuletzt
  geändert wurde; nichts verschwindet ohne Löschmarke. Kein Dialog des SDK
  (`ui: false`: OpenMana zeigt nur shadcn-Oberflächen), keiner nötig.
- **Löschmarken:** `deleteDeck` löscht nicht mehr spurlos, sondern hinterlässt
  in derselben Transaktion eine Marke (Deck-Id, Zeitpunkt), 90 Tage lang.
- **Nur auf der echten Adresse** `https://openmana.vercel.app/` aktiv. Lokal,
  in Tests, Vorschauen und im End-to-End-Test bleibt das SDK `inactive`: keine
  Anfrage, nichts gespeichert, keine Karte in den Einstellungen.
- **Einstellungen → „ORYX-Cloud“**: Statuszeile des SDK, „Mit ORYX verbinden“
  bzw. „Verbindung auf diesem Gerät trennen“, was abgeglichen wird und was
  hierbleibt, Probleme an Ort und Stelle; nach der Rückkehr von ORYX' Zustimmungsseite
  einmal ein Toast (verbunden, abgelehnt, gescheitert).

OpenMana ist noch nicht veröffentlicht; die Anbindung ist fertig und wird mit
dem ersten Deployment auf `openmana.vercel.app` wirksam (siehe §11).

## 1. Was gebaut wurde

```
src/cloud/
├── oryx-sdk.js, oryx-sdk.d.ts   ORYX-SDK 1.1.0, unveränderte Kopie aus oryx-games/shared (Prüfsummen-Test)
├── cloud-sync.ts                CloudSync: Start, Abgleich beim Start, Hochladen nach Änderungen, Verbinden/Trennen
├── cloud-context.tsx            CloudProvider (main.tsx), CloudStorageLink und CloudReturnNotice (App-Rahmen), useCloudSync
├── oryx-cloud-card.tsx          Karte „ORYX-Cloud“ (Einstellungen)
└── *.test.ts(x)                 SDK-Prüfsumme, Abgleich mit dem echten SDK, Karte
src/storage/collection.ts        das Dokument: lesen, prüfen, zusammenführen, anwenden
src/test/oryx-fixtures.ts        nachgebaute ORYX-Cloud (Supabase-Endpunkte des SDK) für die Tests
```

Geändert: Schema (`DeckTombstoneRecord`, `CollectionDocument`, Version 4),
Migration 4, `deleteDeck` (Löschmarke), Sicherungsimport (zurückgeholte Decks),
`StorageSession.subscribeChanges` (sagt, ob die Änderung aus diesem Tab
stammt), `main.tsx`, App-Rahmen, Einstellungsseite, Lint-Ausnahme für die
SDK-Kopie, `src/app/local-first.test.ts`.

## 2. Was abgeglichen wird – und was nicht

| Daten | ORYX-Cloud | Warum |
|---|---|---|
| Decks (vollständig: Karten, Drucke, Commander, Begleiter, importierte Liste unverändert, Zeiten) | ja | Nutzerdaten, auf jedem Gerät gebraucht |
| Löschmarken (`deckTombstones`, 90 Tage) | ja | sonst holt die Zusammenführung gelöschte Decks zurück |
| Einstellungen außer `display.*`: KI-Profil (`ai.profile`), Deckwahl (`play.humanDeck`, `play.aiDeck`), Schlüssel neuerer Versionen | ja | Vorlieben des Spielers, gerätunabhängig |
| `display.*`: Kartensprache, „Bewegungen reduzieren“ | **nein** | gehören zum Gerät (Architektur §11) |
| Partien und Partieverläufe (`matches`, `matchLog`) | **nein** | Verlauf dieses Geräts; mit Prompt 22 potenziell groß (jede Protokollnachricht) und für die 1-MB-Grenze ungeeignet; die Bible nennt sie nicht als zu synchronisierende Daten. Sie bleiben in der Sicherungsdatei |
| Kartendaten, Drucke, Sets, Zwischenspeicher-Index, Engine | **nein** | Zwischenspeicher, werden neu geladen |
| `meta` (Datenbank-Verlauf, letzte Sicherung) | **nein** | gehört zu diesem Browser |
| beschädigte Einträge | **nein** | bleiben hier, wie sie sind (angezeigt, nie still verworfen) |

Was das SDK außerdem sendet: eine Kurzinfo `{ "Decks": n }`, eine zufällige
Installations-Id, ein Geräte-Label („Android · Browser“), die
Vordergrund-Spielzeit (ORYX zeigt sie an) – erst, wenn der Spieler verbunden
ist.

## 3. Das Dokument

`src/storage/collection.ts`, Schema `CollectionDocument`
(`src/storage/schema/local-data.schema.json`):

```json
{
  "schemaVersion": 4,
  "decks": [ { "id": "…", "name": "…", "format": "constructed", "main": […], "sideboard": […], "commander": [], "source": {…}, "createdAt": "…", "updatedAt": "…" } ],
  "deckTombstones": [ { "id": "…", "deletedAt": "2026-09-25T10:00:00.000Z" } ],
  "settings": [ { "key": "ai.profile", "value": { "kind": "random" }, "updatedAt": "…" } ]
}
```

- Die Einträge sind genau die Einträge der Datenbank (gleiche Prüfer).
- Sortiert nach Id bzw. Schlüssel; dieselben Daten ergeben dasselbe JSON (die
  Cloud vergleicht Prüfsummen). `readCollection` hängt nicht von der Uhr ab.
- Ohne Deck, Löschmarke und geteilte Einstellung liefert es `null` („nichts zu
  sichern“): ein neues Gerät lädt dann einfach den Cloud-Stand.
- **Ankommende Dokumente werden geprüft wie Sicherungen** (`checkCollection`):
  Behälter, Version (neuer → abgelehnt), jeder Eintrag nach dem Anheben mit den
  Migrationen der Datenbank gegen sein Schema. Ein Dokument mit einem einzigen
  ungültigen Eintrag wird **gar nicht** übernommen (nichts geändert, die Karte
  sagt es). Einstellungen `display.*` in einem Dokument werden übergangen.
- Das Dokument trägt seine eigene `schemaVersion` (wie der Kopf einer
  Sicherung), damit auch der Zusammenführungsweg des SDK – der `migrate` nicht
  aufruft – ältere Dokumente richtig anhebt.

## 4. Zusammenführen und Löschmarken

`mergeCollections(a, b, now)` – rein, auf jedem Gerät und in beide Richtungen
gleich (getestet: vertauschte Seiten, erneutes Zusammenführen ändert nichts):

1. **Löschmarken:** je Deck zählt die spätere.
2. **Decks:** je Id gewinnt die Kopie mit dem neueren `updatedAt`; bei gleicher
   Zeit die mit dem größeren kanonischen JSON (eine feste Wahl, damit beide
   Geräte dieselbe treffen).
3. **Deck gegen Marke:** `deletedAt ≥ updatedAt` → das Deck ist weg (im selben
   Augenblick gewinnt das Löschen); `updatedAt > deletedAt` → die spätere
   Änderung gewinnt, die Marke entfällt. Ein Dokument enthält nie Deck und Marke
   derselben Id.
4. **Marken älter als 90 Tage** entfallen – erst nachdem sie ihr Deck entfernt
   haben.
5. **Einstellungen:** je Schlüssel gewinnt das neuere `updatedAt` (wie beim
   Zusammenführen einer Sicherung und wie bei Decks); `display.*` nie.
6. Sonst wird **nichts** entfernt: ein Deck, das nur eine Seite hat, bleibt.

Warum Zeiten statt Revisionen? Ob überhaupt zusammengeführt werden muss,
entscheidet die Cloud über Revisionen (Architektur §7: nur wenn beide Seiten
seit dem letzten Abgleich geändert wurden). *Wie*, entscheidet diese Regel –
dieselbe wie beim Zusammenführen einer Sicherung (Prompt 07). Geräteuhren
können abweichen; betroffen ist nur der seltene Fall, dass dasselbe Deck auf
zwei Geräten fast gleichzeitig geändert wird.

**Löschmarken in der Datenbank** (Store `deckTombstones`, Schema-Version 4):

- `deleteDeck` löscht das Deck und schreibt die Marke in **einer**
  Transaktion; ein beschädigter Eintrag ohne Deck-Id bekommt keine. Dabei
  entfallen Marken älter als 90 Tage (beschädigte bleiben für die Prüfung
  stehen), ebenso beim Anwenden eines Cloud-Dokuments: Die Marken wachsen nie
  unbegrenzt.
- Rolle `internal` wie `meta`: **nie Teil einer Sicherung** (eine Sicherung
  soll beim Zusammenführen nichts löschen).
- **Sicherung laden:** Holt eine Sicherung ein Deck zurück, das inzwischen
  gelöscht wurde, gilt das als neue Änderung – die Marke entfällt, und eine
  Kopie, die nicht neuer ist als das Löschen, bekommt den Zeitpunkt des
  Imports als `updatedAt`. Sonst würde der nächste Abgleich das Deck wieder
  löschen. „Ersetzen“ schreibt keine Marken: Decks, die es hier entfernt,
  können aus der Cloud zurückkommen – in der Cloud gelöscht wird nur, was man
  einzeln löscht.

## 5. Ablauf

| Wann | Was |
|---|---|
| Seitenstart (`main.tsx`) | `await cloud.start()` = `oryx.ready()` **vor dem ersten Rendern**: schließt ein Verbinden ab (Rückkehr von ORYX' Zustimmungsseite, `?code=…`: die Adresse ist bereinigt, bevor der Router sie liest) oder beginnt es (`?oryx_sync=1` aus ORYX). `"redirecting"` → die Seite geht, nichts wird gerendert. Inaktiv antwortet es sofort. Scheitert schon das Erzeugen oder Starten der Cloud, startet OpenMana ohne sie (lokal zuerst) |
| Rückkehr von ORYX' Zustimmungsseite | ORYX schickt den Spieler an OpenManas registrierte Adresse, die **Startseite** (das SDK stellt einen Rückweg nur auf derselben Seite wieder her). `CloudSync` liest ORYX' Antwort aus der Adresse, bevor das SDK sie bereinigt, und der App-Rahmen sagt einmal per Toast, wie es ausging: „Mit ORYX verbunden“, „Nicht mit ORYX verbunden“ (abgelehnt) oder „Verbinden mit ORYX hat nicht geklappt“ – nie ein stilles Ergebnis. Seit SDK 1.1.0 ebenso jede Sicherung, die nicht klappt (abgelehnt, zu groß, Cloud nicht erreichbar, offline mit wartenden Änderungen) und ihr Ende („wieder gesichert“): `CloudSync.onNotice` → ein Toast mit der Kennung `oryx-sync` (`cloud-context.tsx`); die Karte zeigt dieselbe Zeile über `describe()` |
| Datenbank offen (`CloudStorageLink` im App-Rahmen) | **ein** `pull()` je Seitenaufruf: nichts / hochladen / herunterladen / zusammenführen. Die Seiten warten nicht darauf: lokale Daten erscheinen sofort, und was der Abgleich schreibt, lesen sie über die Änderungsmeldungen der Datenbank neu |
| Herunterladen (`write`) | `applyCollection`: in **einer** Transaktion das Zusammenführen des lokalen Stands mit dem Cloud-Dokument, nie ein Ersetzen – eine Änderung von eben (anderer Tab, der Spieler) geht nicht verloren. Behält das Gerät dabei etwas, das der Cloud fehlt (`keptLocal`), wird es danach hochgeladen |
| Änderung in diesem Tab (Decks, Marken, Einstellungen) | `markChanged()` – aber nur, wenn sich das Dokument wirklich änderte (Prüfsumme wie im SDK gegen die zuletzt abgeglichene): `display.*` oder dieselben Werte laden nichts hoch. Das SDK sammelt (15–60 s) und lädt beim Verbergen der Seite sofort hoch |
| Anwenden eines Cloud-Dokuments | meldet **nie** eine Änderung (sonst liefen Geräte endlos im Kreis: jedes lädt das Dokument des anderen erneut hoch) – doppelt gesichert durch `applying` im SDK und in `CloudSync` |
| Änderung eines anderen Tabs | lädt jener Tab hoch, nicht dieser (die Datenbank meldet `other-tab`) |
| „Verbindung trennen“ | erst hochladen, was wartet, dann die Verbindung auf diesem Gerät vergessen; die Daten bleiben hier, die Cloud behält den letzten Stand |

**Sonderfälle beim Start:**

- Cloud-Stand einer **neueren OpenMana-Version**: weder übernommen noch
  überschrieben (SDK), die Karte bittet um Neuladen.
- Cloud-Stand **als gelöscht markiert**: OpenMana löscht seine Sammlung in der
  Cloud nie (es ruft `slot.remove()` nicht auf). Ist sie dennoch markiert (von
  Hand), bleibt hier alles und wird wieder gesichert (`onConflict` → `keep`).
  Ein Löschen dort wird nie still übernommen (Architektur §7).
- **Zu groß** (`too_large`): alles bleibt hier, die Karte sagt es.
- Cloud-Dokument **ungültig**: nichts übernommen, die Karte nennt die Stelle.

## 6. Datenbank: Schema-Version 4

- Neuer Store `deckTombstones` (Schlüssel `id`, keine Indizes), Migration 4
  legt ihn an; kein gespeicherter Eintrag und kein Eintrag einer älteren
  Sicherung ändert sich. Getestet: 3 → 4 (alle Einträge bleiben, die
  Kartendaten bleiben installiert), 2 → 4, 1 → 4.
- Der **Kartenkatalog** trägt die Schema-Version in seinem Kopf und wurde neu
  gebaut (`npm run cards:build -- --offline`, 56 s, Scryfall-Stand
  2026-09-24): Inhalt unverändert, nur die Version im Kopf; neue Id
  `059d16eea3753a24` (vorher `4647d01ae90b1c6a`). Ein Browser mit dem alten
  Katalog nutzt ihn weiter, bis er ihn aktualisiert (wie bei Version 3).

## 7. Oberfläche

Einstellungen → Karte **„ORYX-Cloud“** unter „Daten auf diesem Gerät“, nur wenn
die Cloud aktiv ist:

- Abzeichen (Nicht verbunden · Verbunden · Offline · Ausgeschaltet · Nicht
  erreichbar) und die **Statuszeile des SDK** (`describe()`, etwa „ORYX-Cloud:
  verbunden · gesichert vor 2 Min.“; alle 30 s aufgefrischt), während des
  Abgleichs „Gleiche mit der ORYX-Cloud ab …“.
- Was abgeglichen wird, was nur auf diesem Gerät bleibt und die Regel („gilt
  die neuere Änderung“) in einem Satz.
- **„Mit ORYX verbinden“** (Gast) → Weiterleitung zu ORYX' Zustimmungsseite;
  **„Verbindung auf diesem Gerät trennen“** (verbunden) → Toast. Beide
  `Button size="lg"` (48 px auf Touch-Bildschirmen).
- Probleme als `Alert` an Ort und Stelle: Verbinden nicht möglich, Stand aus der
  Cloud ungültig (mit Stelle), Fehler beim Übernehmen (`StorageErrorAlert`),
  zu groß, neuere Version (mit „Neu laden“).
- „Daten auf diesem Gerät“ sagt nicht mehr „ohne Cloud“, sondern „– ohne
  Konto“ (stimmt in beiden Fällen).
- Die Karte sagt auch, dass ORYX verbunden die **Spielzeit** erfährt (das SDK
  meldet die Vordergrundzeit; ORYX zeigt sie an).
- Nach der Rückkehr von ORYX' Zustimmungsseite: ein Toast auf der Startseite
  (siehe §5).

Nur shadcn-Bausteine und Tokens; kein Dialog des SDK (dessen eigenes DOM-Overlay
bleibt mit `ui: false` aus).

## 8. Das SDK

- `src/cloud/oryx-sdk.js` und `.d.ts` sind **bytegleiche Kopien** des Masters
  (`oryx-games/shared`, v1.1.0; SHA-256 `7d93919e…6986195` bzw.
  `ed722d60…9ac7781`, geprüft von `src/cloud/oryx-sdk.test.ts`). Verteilt
  wird mit `node scripts/sdk-verteilen.mjs` im ORYX-Repo. Nie hier
  ändern: Master ändern, Version erhöhen, neu kopieren, Prüfsummen nachziehen.
- oxlint übergeht genau diese eine Datei (`.oxlintrc.json`); für alles andere
  gelten die Regeln unverändert.
- **Web Storage:** Das SDK hält seine Verbindung in `localStorage`/`sessionStorage`
  (OAuth-Tokens, Abgleichstand des Platzes, Installations-Id, vor einem
  Herunterladen eine Kopie des lokalen Dokuments). Die Daten des Spielers
  bleiben in IndexedDB; OpenManas eigener Code nutzt Web Storage nie.
  `src/app/local-first.test.ts` prüft jetzt auch `.js`-Dateien und lässt
  genau diese eine Ausnahme zu; außerdem, dass `src/cloud` selbst nichts sendet
  (nur über das SDK).
- **COOP/COEP:** Anfragen an Supabase sind CORS-Anfragen (mit COEP
  `require-corp` erlaubt); Verbinden ist eine Weiterleitung der ganzen Seite
  (`location.replace`), kein Popup – COOP `same-origin` stört nicht.
- Der öffentliche Supabase-Schlüssel (`sb_publishable_…`) ist öffentlich
  gedacht, kein Geheimnis. Die OAuth-Client-Id steht nicht im Code: Das SDK
  liest sie aus ORYX' Tabelle `games`.

## 9. Nachweise

Alle auf dem Arbeitsstand vor dem Commit (odin, Chrome for Testing 153, echte
Engine, echter Kartenkatalog).

- `node scripts/generate-schemas.ts --check`, `tsc -b`, `oxlint`: ohne Befund.
- **Vitest: 622 Tests in 56 Dateien, alle grün** (vorher 559 in 52; 63 neu):
  - `src/storage/collection.test.ts` (22): Zusammenführen (leere Seiten, je Deck
    die neuere Änderung, gleiche Zeit → gleiche Wahl in beide Richtungen,
    gelöscht vs. vorher/nachher geändert, gleicher Augenblick, zwei Marken,
    90-Tage-Grenze, Einstellungen ohne `display.*`, Symmetrie und
    Idempotenz), Prüfen (gültig, kein Dokument, neuere Version, ungültige
    Einträge mit Pfad), lesen/anwenden mit fake-indexeddb (leer = null, nur
    gültige Einträge, uhrunabhängig, Anwenden mit Löschen und Einstellungen,
    nie löschen ohne Marke + `keptLocal`, beschädigtes Deck ersetzt bzw.
    behalten, Marken-Aufräumen, Rundreise auf ein leeres Gerät, alles oder
    nichts, eine Meldung).
  - `src/cloud/cloud-sync.test.ts` (20): **das echte SDK** gegen die
    nachgebaute Cloud auf der echten `StorageSession`: inaktiv (keine Anfrage,
    nichts gespeichert), Gast (nichts gesendet; Verbinden führt zur
    Zustimmungsseite mit PKCE; ORYX kennt OpenMana nicht → gesagt), die
    Rückkehr von der Zustimmungsseite (verbunden, abgelehnt, fremder `state`,
    ungültiger Code, keine Antwort), neues Gerät (Cloud-Stand übernommen,
    Ansichten benachrichtigt, **kein Zurück-Hochladen**), leere Cloud →
    hochgeladen, beide Seiten geändert → zusammengeführt und hochgeladen,
    Herunterladen behält Eigenes und lädt es hoch, ungültiger/neuerer/
    gelöschter Cloud-Stand, zu groß, Änderungen hochgeladen (nur wenn das
    Dokument sich ändert; Löschen als Marke), Änderungen anderer Tabs nicht,
    Trennen (wartendes hochgeladen, dann nichts mehr), und mit einem
    geskripteten SDK: Anwenden fragt **nie** nach einem Hochladen.
  - `src/cloud/oryx-cloud-card.test.tsx` (10): nicht da ohne/inaktive Cloud,
    Gast, Verbinden scheitert, verbunden + Trennen, neuere Version, ungültiger
    Stand, und im echten App-Rahmen: der Abgleich läuft über den Rahmen, die
    Decks erscheinen ohne Neuladen; der Toast nach der Rückkehr (verbunden,
    abgelehnt, gescheitert), genau einmal.
  - `src/cloud/oryx-sdk.test.ts` (1): Prüfsummen und Version.
  - Erweitert: `decks.test.ts` (+3, Löschmarken), `backup.test.ts` (+2,
    zurückgeholte Decks beim Zusammenführen und Ersetzen), `migrations.test.ts`
    (+1, 3 → 4), `schema.test.ts` (+3), `local-first.test.ts` (+1, `src/cloud`
    sendet nur über das SDK), `storage-session.test.ts` (Herkunft der Änderung).
  - Gegenprobe: Ohne den Schutz beim Anwenden, ohne den Prüfsummenvergleich,
    ohne das Nachladen nach `keptLocal` oder ohne den Filter „nur dieser Tab“
    scheitert jeweils ein Test.
  - Unter starker Last anderer Arbeiten auf odin (Load 13–17 bei 12 Kernen)
    scheiterten in einzelnen Läufen zeitabhängige Tests, die diese Arbeit
    nicht berührt (`preferences.test.tsx`: ein Effekt nach `findByText`;
    `deck-import.test.tsx`/`deck-library.test.tsx`: 5-s-Grenze beim ersten
    Laden einer Seite; `card-data.test.tsx` schon vor jeder Änderung); einzeln
    und in wiederholten Gesamtläufen grün.
- **End-to-End (`npm run check`, Chrome, echte Engine):** alle bisherigen
  Abschnitte grün, dazu
  - Abschnitt 6: abseits der echten Adresse keine Karte, Web Storage leer;
  - Abschnitt 9: nach dem bestätigten Löschen steht die Löschmarke in IndexedDB;
  - **Abschnitt 13 (neu): die ORYX-Cloud auf OpenManas echter Adresse** –
    Playwright liefert den Build als `https://openmana.vercel.app` aus (mit
    COOP/COEP), die ORYX-Cloud ist ein Stand-in mit Supabases CORS-Antworten:
    Gast (Karte, keine einzige Anfrage, axe 0 Befunde, 48-px-Knopf); Verbinden
    führt zur Zustimmungsseite (PKCE S256, richtige Weiterleitung); die
    Rückkehr tauscht den Code (der Stand-in prüft den Verifier gegen die
    Challenge – der `sessionStorage` des SDK übersteht also den
    Browsing-Context-Wechsel durch COOP), landet auf der Startseite mit
    bereinigter Adresse und dem Toast, führt die Decks dieses Geräts mit denen
    der Cloud zusammen und lädt das Ergebnis hoch (ohne Partien, ohne
    `display.*`); ein geändertes KI-Profil geht hoch, „Bewegungen reduzieren“
    nie; Trennen behält die Daten und vergisst die Tokens; keine Konsolen- oder
    Netzfehler. Bei 360 px Breite läuft die Karte nicht über (Gast und
    verbunden), Knöpfe 48 px.
- Start-JavaScript (UI-Build ohne Engine/Katalog verglichen): 68,7 → 79,3 KB
  gzip (+10,6 KB: SDK, Abgleich, Karte).

## 10. Entscheidungen

- **Die Seiten warten nicht auf den Abgleich.** `ready()` läuft vor dem ersten
  Rendern (Pflicht für Rückkehr und Weiterleitung), der `pull()` sobald die
  Datenbank offen ist. Die Ansichten zeigen sofort die lokalen Daten und lesen
  neu, was der Abgleich schreibt – ein langsames Netz hält nie lokale Daten
  zurück (Bible: local-first). Ein Spielstart während des ersten Abgleichs
  nutzt den lokalen Stand; die Zusammenführung behält jede Änderung.
- **Herunterladen führt zusammen, statt zu ersetzen** (`applyCollection`),
  weil ein Ersetzen eine Änderung zwischen Lesen und Schreiben verlieren und
  ein Deck ohne Marke löschen könnte.
- **Einstellungen: die neuere Änderung gewinnt** je Schlüssel (nicht „lokal
  gewinnt“): So folgt eine auf dem Handy geänderte Deckwahl auf den PC, und
  die Regel ist dieselbe wie bei Decks und Sicherungen.
- **Partien werden nicht abgeglichen** (§2).
- **Gelöscht in der Cloud → behalten und wieder sichern** (§5).
- **Löschmarken nicht in Sicherungen**; zurückgeholte Decks gewinnen (§4).
- **Nach dem Verbinden die Startseite, dazu ein Toast:** ORYX' Weiterleitung
  ist die registrierte Wurzeladresse, und das SDK stellt einen Rückweg nur auf
  derselben Seite wieder her. OpenMana liest den Speicher des SDK nicht, um
  zurück in die Einstellungen zu springen (Web Storage bleibt dessen Sache);
  der Toast sagt, wie es ausging.
- **Die Cloud hält den Start nie auf:** Scheitert schon ihr Start, läuft
  OpenMana ohne sie weiter (`main.tsx`).

## 11. Grenzen und offene Punkte

- **Größe:** ORYX nimmt je Platz höchstens `games.max_save_bytes` an
  (Vorgabe 1 MB). Ein vollständig aufgelöstes Constructed-Deck hat ~7 KB, ein
  Commander-Deck ~22 KB (gemessen an synthetischen Decks mit Druck-Angaben und
  importierter Liste) – es passen also grob **146 Constructed- oder 48
  Commander-Decks**. Darüber meldet die Karte „Zu groß“, und nichts wird
  hochgeladen. Abhilfe bei Bedarf: `max_save_bytes` für `openmana` in ORYX
  anheben (Supabase-Migration in `oryx-games`). Wird die Sammlung erst
  während einer Sitzung zu groß, sagt es die Karte beim nächsten Start: Das
  SDK meldet gescheiterte Uploads im Hintergrund nicht.
- **Voraussetzungen in ORYX:** Für `openmana` muss ein OAuth-Client mit der
  Weiterleitung `https://openmana.vercel.app/` registriert und in `games`
  eingetragen sein; bis dahin bleibt der Spieler Gast und „Mit ORYX verbinden“
  meldet, dass es nicht geht.
- **Erst mit dem Deployment wirksam** (nicht pushen ohne dev0gigs Wunsch; im
  ORYX-TWA zusätzlich `/.well-known/assetlinks.json`, Prompt 28).
- Ein Gerät, das länger als **90 Tage** nicht abgeglichen hat, kann ein
  inzwischen gelöschtes Deck zurückbringen (die Marke ist dann verfallen).
- **Uhren:** Weicht die Uhr eines Geräts stark ab, kann beim gleichzeitigen
  Ändern desselben Decks auf zwei Geräten die falsche Änderung gewinnen.
- **SDK-Zeitfenster:** Ändert der Spieler genau zwischen dem Übernehmen eines
  Cloud-Stands und dem Vermerk des SDK (Millisekunden beim Start) etwas, wird
  diese Änderung erst mit der nächsten Änderung hochgeladen. Nichts geht
  verloren.
- **Schmale Handys:** Unter etwa 385 px Breite reicht der Knopf „Verbindung auf
  diesem Gerät trennen“ (der Standardtext aller ORYX-Spiele) in den
  Innenabstand der Karte – die Seite läuft nicht über, der Knopf bleibt in der
  Karte und 48 px hoch (End-to-End-Test bei 360 px). shadcn-Knöpfe brechen
  nicht um; ob sie es dürfen, ist eine Frage an das ganze Design-System
  (Prompt 24), nicht an diese Karte.
- Das SDK liest `sessionStorage['oryx:launcher']` für das Geräte-Label „ORYX-App“;
  das setzt ORYX' `oryx-back.js`, das OpenMana (noch) nicht einbindet – das
  Label lautet dann „· Browser“.

## 12. Reproduzieren

```bash
npm run generate                        # nach einer Schema-Änderung
npm run cards:build -- --offline        # Katalog nach einer Schema-Änderung neu bauen
npx vitest run src/storage/collection.test.ts src/cloud
npm run check
```
