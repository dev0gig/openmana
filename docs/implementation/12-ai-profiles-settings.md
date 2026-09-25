# 12 — KI-Profile und Einstellungen

> Umsetzung von [`prompts/queue/12-ai-profiles-settings.md`](../../prompts/queue/12-ai-profiles-settings.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Implementierung
> `e618079`; alle Nachweise liefen auf diesem Stand (sauberer Arbeitsbaum, Engine aus diesem
> Commit gebaut, `engineSourcesModified=false`). Grundlage: [`docs/BIBLE.md`](../BIBLE.md) §4, §7,
> §15, §16, §17, [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md) („Preferences“), die Spielsitzung
> (Prompt 11), das Protokoll ([`engine/protocol/README.md`](../../engine/protocol/README.md)) und das
> Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Die Prüfung der KI-Profile:
> [`docs/research/AI_PROFILES.md`](../research/AI_PROFILES.md). Messungen auf odin (Intel i7-8700T,
> 12 Threads, Debian 13), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 12 ist umgesetzt.** Der Spieler wählt einmal – in den Einstellungen,
das KI-Profil auch auf der Spielen-Seite –, und jede Partie danach folgt dem,
ohne zu fragen:

- **KI-Profil:** Forges vier Profile der gepinnten Engine – „Standard“
  (Default, Vorgabe), „Vorsichtig“ (Cautious), „Waghalsig“ (Reckless),
  „Experimentell“ (Experimental) – und „Zufällig“ (je Partie eines davon).
  Beschrieben wird jedes durch **belegte** Unterschiede im Spiel, nie durch
  „leicht“ oder „schwer“: Die Prüfung (Profilwerte samt Forge-Code und
  **2 400 Partien KI gegen KI**) fand keine Schwierigkeitsstufen und keinen
  messbaren Stärkeunterschied, wohl aber Stilunterschiede (Waghalsig greift
  bis zu 26 % öfter an, blockt seltener, kontert mehr). Das Profil geht mit
  `match.start` an Forge; die laufende Partie zeigt das Profil, das Forge
  bestätigt (`game.started.aiProfile`).
- **Engine:** meldet ihre geladenen Profile (`boot.aiProfiles`, Protokoll 4)
  und lehnt ein anderes ab (`engine.error invalid-request`) – Forge spielte
  einen unbekannten Namen sonst still mit seinen eingebauten Vorgabewerten.
  Der Build bricht ab, wenn die Profildateien der Engine nicht die geprüften
  sind.
- **Kartensprache:** „Deutsch“ (Vorgabe: deutsch, wo Scryfall es hat, sonst
  englisch und markiert) oder „Englisch“. Sie gilt für jede Kartenanzeige der
  App (Listen, Details, Nachschlagen, Import, Auswahl) **und** für die Karten
  in Forges Texten: neues Start-Argument `--card-language` – Forge spricht
  weiter deutsch, nennt die Karten aber englisch. Eine vorgewärmte Engine mit
  der alten Sprache wird ersetzt; eine laufende Partie behält ihre.
- **Weniger Bewegung:** Alle Animationen und Übergänge stoppen, wenn das
  Gerät es wünscht (`prefers-reduced-motion`) oder der Spieler es einschaltet
  („Bewegungen reduzieren“); Ladeanzeigen drehen sich weiter.
- **Versions-Diagnose:** Einstellungen → „Über OpenMana“ nennt Forges Version
  (2.0.15) neben Stand, Patches, Protokoll, GraalVM; „Diagnose anzeigen“
  zeigt einen Textbericht mit allen Versionen und Zuständen (App, Engine im
  Build und laufend, Kartendaten, Datenbank, Einstellungen, Browser) zum
  Kopieren – gesendet wird nichts.
- **Kein Mehraufwand beim Start:** Die Spielen-Seite zeigt das Profil mit
  „Ändern“; „Partie starten“ fragt nichts. Nur ein gespeichertes Profil, das
  es nicht mehr gibt, hält den Start auf – mit Grund.

**Nachweise:** siehe §9 – Typecheck, oxlint, Frische der erzeugten Dateien, **510 Vitest-Tests**
(42 neu), **56 JVM-Tests** (5 neu), 80 TypeScript-Tests der Engine,
`test-engine.sh` mit **69 Läufen** (5 neu: Deutsch mit englischen Karten auf
JVM, Node und Chrome) und `npm run check` mit dem End-to-End-Test im echten
Chrome und der echten Engine (Abschnitt 11 neu), alle grün. Die Profil-Studie:
2 400 Partien. Kein Blocker.

## 1. Was gebaut wurde

```
engine/
├── bridge/…/ForgeEngine.java           --card-language (CardTranslation nach FModel), aiProfiles() sortiert
├── bridge/…/EngineBoot.java            BootReport: cardLanguage, aiProfiles
├── bridge/…/bridge/HumanMatch.java     unbekanntes KI-Profil → InvalidRequest (vor jeder Nachricht)
├── bridge/…/jvm/AiProfileStudy.java    Studie: KI gegen KI, Zählung aus Forges Ereignissen (nur JVM)
├── bridge/…/jvm/JvmAiProfileStudyMain  Plan/Shards, eine JSON-Zeile je Partie
├── bridge/src/test/…/AiProfilesTest    Profile gemeldet, eigene Werte, unbekanntes abgelehnt, kein Schummeln, BootReport = Schema
├── wasm/java/…/WasmMain.java           --card-language, engine.ready mit allen Boot-Feldern
├── protocol/schema                     Version 4: BootReport.cardLanguage, .aiProfiles
├── scripts/ai-profile-study.sh         Studie parallel, ai-profile-summary.mjs wertet aus
├── scripts/prepare-forge.sh, write-manifest.mjs   Manifest: forge.versionCode
├── scripts/test-engine.sh              Varianten „Deutsch mit englischen Karten“ (Partie + Kartenprüfung)
└── fixtures/                           human-3-de-cards-en, ai-profile-study.json, decks/study-*.json
src/
├── app/preferences.tsx                 liest KI-Profil, Kartensprache, Bewegung; wendet sie an (html-Attribut, Boot-Optionen)
├── app/motion.ts, motion-options.tsx   „Bewegungen reduzieren“, useDeviceReducedMotion
├── app/diagnostics.ts, diagnostics-dialog.tsx   Versionsbericht, Dialog mit Kopieren
├── cards/card-language.ts, card-language-options.tsx   Kartensprache (Einstellung, Engine-Sprache)
├── cards/card-display.ts               DisplayRequest.language (Englisch: Oracle-Text, englisches Bild)
├── decks/deck-view.ts                  viewDeck/entryView/pictureOf mit Sprache
├── engine/engine-session.ts            EngineBootOptions, setBootOptions, engineArgs()
├── game/ai-profile-table.ts            die geprüften Profile (Name, SHA-256, deutsch, Beschreibung)
├── game/ai-profiles.ts                 Einstellung ai.profile, resolveAiProfile, drawAiProfile
├── game/ai-profile-options.tsx         Auswahl (RadioGroup) und Dialog der Spielen-Seite
├── game/match-setup.ts, game-start.ts  Profil (gezogen) an Forge; Startsperre bei fehlendem Profil
├── routes/settings-page.tsx            Gegner, Kartensprache, Barrierefreiheit, Über OpenMana, Gerät, Daten
├── components/ui/*                     motion-reduce: an jeder Animation (16 Bausteine), Switch neu
└── index.css                           @custom-variant motion-reduce (Gerät oder data-reduced-motion)
vite/engine-assets.ts                   KI-Profile aus dem Engine-Inventar = geprüfte Tabelle, sonst Abbruch; forgeVersionCode
```

## 2. KI-Profile

**Was sie sind und was sie ändern** steht mit Belegen in
[`docs/research/AI_PROFILES.md`](../research/AI_PROFILES.md). Kurz: 121
Stellschrauben je Profil, 80 unterscheiden sich, davon wirken in OpenMana vor
allem Angriff/Abtausch, Blocken, Gefahrenschwelle, Kontern, Kampftricks,
Mulligan-Schwelle. 2 400 Spiegelpartien gegen „Default“: Siegquoten 47,5 %
(Vorsichtig), 48,2 % (Experimentell), 52,5 % (Waghalsig), alle Intervalle
schließen 50 % ein.

**In der App** (`src/game/`):

- `ai-profile-table.ts` – je Profil Forges Name, der SHA-256 der geprüften
  Datei, deutscher Name (Übersetzung von Forges Namen), ein Satz und drei bis
  vier Unterschiede, die in OpenMana wirken. Reihenfolge: Standard, die zwei
  Gegensätze, Experimentell. Kein Schwierigkeitswort (Test sucht danach).
- `ai-profiles.ts` – Einstellung `ai.profile`
  (`{kind:"profile", name}` oder `{kind:"random"}`, Vorgabe Default),
  `resolveAiProfile` (ok / random / missing), `drawAiProfile`.
- Jede Profilwahl trägt den Hinweis: „Forge kennt keine
  Schwierigkeitsstufen: Die Profile ändern, wie die KI spielt – nicht, was sie
  weiß oder darf. In 2 400 Testpartien KI gegen KI gewann keines messbar öfter
  oder seltener als ‚Standard‘.“
- **Zufällig** zieht die App je Partie (wie Forges „Random (Every Game)“;
  Forges eigene Zufallsnamen versteht `createAiPlayer` mit festem Profil
  nicht). Die Partie sagt „… (zufällig)“; `MatchSetup.ai.profileDrawn` hält es
  für die Aufzeichnung (Prompt 22).
- **Build-Prüfung:** `vite/engine-assets.ts` liest `res/ai/*.ai` aus dem
  Inventar der Engine (`forge-res.inventory.json`, erst gegen das Manifest
  geprüft) und verlangt genau die Tabelle, Datei für Datei (SHA-256); sonst
  bricht der Build ab („Reckless changed … verify … update
  src/game/ai-profile-table.ts“), und der Dev-Server bietet diese Engine nicht
  an.
- **Engine:** `boot.aiProfiles` (sortiert), unbekanntes Profil →
  `engine.error invalid-request` mit der Liste; der Worker bleibt bereit.
  Die laufende Partie zeigt Forges Bestätigung `game.started.aiProfile`.

## 3. Kartensprache

- Einstellung `display.cardLanguage` (`de` Vorgabe, `en`).
- **In der App:** `cardDisplay(card, { language })`: bei `en` Name, Typzeile
  und Regeltext aus dem Oracle-Text, Bild englisch (ein ausdrücklich
  genannter Druck gewinnt weiter), nichts als „nicht deutsch“ markiert; nur
  ein Bild in dritter Sprache hat einen Hinweis. Die Sprachübersicht der
  Decks (wie deutsch ein Deck sein kann) ist eine Tatsache und bleibt
  berechnet; mit Englisch zeigt die App sie nicht (Deckliste, Deckseite).
  Karten, die Scryfall gar nicht kennt, bleiben markiert („nur Forge“, „ohne
  Kartendaten“).
- **In Forge:** `--card-language=en-US|de-DE` (Standard: die `--language`).
  `ForgeEngine` lädt nach `FModel.initialize` (das die Kartenübersetzung der
  Oberflächensprache lädt) die Kartenübersetzung der Kartensprache
  (`CardTranslation.preloadTranslation`); Forge liest sie bei jeder
  Kartenanzeige neu (Kartenansicht, Spielprotokoll, Anweisungen), `PaperCard`
  berechnet seinen Sortiernamen beim Sprachwechsel neu. Die App startet Forge
  immer mit `--language=de-DE` und `--card-language` aus der Einstellung.
- **Beweis, dass es nur Wörter ändert:** die Testpartie `human-3-de-cards-en`
  (dieselbe Engine-Spur wie `human-3`, JVM und Node) und die Kartenprüfung
  „Deutsch mit englischen Karten“ (gleicher Fingerabdruck, Meldungen deutsch,
  Kartennamen englisch; JVM, Node, Chrome).
- **Vorgewärmte Engine:** `EngineSession.setBootOptions` (aus den
  Einstellungen): eine Engine, die bootet oder bereit ist und keine Partie
  hat, wird durch eine mit den neuen Optionen ersetzt; eine Partie auf dem
  Weg oder am Laufen behält ihre. Nie zwei Engines zugleich.

## 4. Weniger Bewegung

- `@custom-variant motion-reduce` in `src/index.css`: das Gerät wünscht es
  (`prefers-reduced-motion: reduce`) **oder** `<html data-reduced-motion>`
  (die Einstellung, gesetzt von `PreferencesProvider`).
- Jede Animation und jeder Übergang in `src/components/ui` trägt
  `motion-reduce:animate-none!` bzw. `motion-reduce:transition-none!`
  (16 Bausteine und der neue `Switch`; mit `!`, damit es die
  `data-open:`-Animationen schlägt). `src/app/motion.test.ts` prüft jede
  Datei. Ausnahme mit Absicht: Lade-Kreisel drehen weiter (ein stehender
  Kreisel sieht wie eine eingefrorene Seite aus); sonners Toasts folgen dem
  Gerät selbst.
- Einstellung `display.motion` (`system` Vorgabe, `reduce`): ein Schalter in
  „Barrierefreiheit“. Er kann nur reduzieren; wünscht das Gerät schon weniger
  Bewegung, sagt die Seite das.
- Für später (Spieltisch ab 13): Code, der selbst bewegt, fragt
  `useDeviceReducedMotion()` und `reducedMotion()` (`src/app/motion.ts`).

## 5. Versions-Diagnose

- „Über OpenMana“: App-Version, Stand, Datum; **Forge-Version** (neu, aus dem
  Manifest: `forge.versionCode`), Forge-Stand, Patches, Protokoll, GraalVM,
  Bauzeit, Größe. Der Engine-Kasten der Spielen-Seite nennt zusätzlich die
  Kartensprache in Forges Texten und die geladenen KI-Profile.
- „Diagnose anzeigen“ (`diagnostics.ts`, rein): Textbericht mit App, Engine
  dieser Version (Kennung, Forge-Version und -Commit, Patches, Protokoll,
  GraalVM, Bauzeit, Download), Engine jetzt (Zustand, Abbruchgrund, Forge,
  Engine-Stand, Sprachen, Kartenladen, KI-Profile, Startzeit), Kartendaten
  (Katalog, Scryfall-Stand, Schema, Stand auf dem Gerät), Datenbank-Schema,
  Einstellungen, Browser (User-Agent, isoliert, Kerne, Speicher). „Kopieren“
  über die Zwischenablage; wo der Browser das nicht erlaubt, sagt ein Toast,
  dass man den Text selbst markieren kann. Nichts wird gesendet (Bible §15).

## 6. Einstellungen im Aufbau der App

- `PreferencesProvider` (im App-Rahmen) liest die drei Einstellungen aus
  IndexedDB (`useStorageQuery` auf `settings`: auch Änderungen aus einem
  anderen Tab), bis dahin gelten die Vorgaben. Ungültige gespeicherte Werte
  werden in den Einstellungen genannt, die Vorgabe gilt.
- `useSaveSetting`: schreibt sofort (kein Speichern-Knopf); scheitert es,
  sagt ein Toast warum.
- Außerhalb des Providers (Komponententests) sind die Vorgaben die
  Einstellungen.

## 7. Engine und Protokoll 4

| Änderung | Warum |
|---|---|
| `--card-language`, `BootReport.cardLanguage` | Karten in Forges Texten wie in der App (§3) |
| `BootReport.aiProfiles` | die Profile, die Forge wirklich geladen hat |
| unbekanntes Profil → `invalid-request` | Forge nähme es still mit Vorgabewerten |
| `engine.ready` übernimmt alle Boot-Felder | kein zweites Verzeichnis, das veralten kann (`AiProfilesTest` hält den Bericht am Schema) |
| Manifest `forge.versionCode` | Forges Versionsnummer ohne laufende Engine |
| JVM-Studie (`AiProfileStudy`) | nicht im Wasm-Modul (nicht erreichbar) |

Gebaut aus `e618079` (`openmana.commit`, `engineSourcesModified=false`)
in 368 s; das Wasm-Modul wuchs um 112 KB auf 79,1 MB (Brotli +44 KB auf
12,5 MB), Engine-Kennung `42f3bf1c7706cec5`. Das Modul enthält die
Studienklassen nicht (nicht erreichbar).

## 8. Tests

| Datei | Tests | Was |
|---|---:|---|
| `src/game/ai-profiles.test.ts` | 5 (neu) | die vier geprüften Profile (Reihenfolge, SHA-256, deutsche Namen, Beschreibungen), kein Schwierigkeitswort; Einstellung (Vorgabe, gültige und ungültige Werte, Forges Zufallsnamen abgelehnt); Auflösung ok/random/missing; Zufall gleich verteilt |
| `src/app/motion.test.ts` | 3 (neu) | jede Animation und jeder Übergang in `src/components/ui` trägt `motion-reduce:…!` (Kreisel ausgenommen); die Variante in `index.css`; die Einstellung kann nur reduzieren |
| `src/app/diagnostics.test.ts` | 4 (neu) | Bericht mit App, Engine im Build, Kartendaten, Datenbank, Einstellungen, Browser; laufende Engine mit Sprachen, Profilen, Startzeit; Abbruch, fehlende Engine/Kartendaten, unbekannte Browserwerte und ein Profil, das es nicht gibt |
| `src/app/preferences.test.tsx` | 4 (neu) | liest und wendet an (html-Attribut, Boot-Optionen), Änderung sofort wirksam; vor dem Lesen vorgewärmte Engine wird bei anderer Kartensprache ersetzt; ungültige Werte benannt, Vorgabe gilt; außerhalb des Providers die Vorgaben |
| `src/routes/settings-page.test.tsx` | 7 (neu) | Profile samt Hinweis „keine Schwierigkeitsstufen“, Wahl sofort gespeichert (auch „Zufällig“), fehlendes Profil benannt; Kartensprache; Bewegung (Schalter, Attribut, gespeichert, zurück); ungültige Einstellung benannt; Forge-Version und Diagnose mit Kopieren |
| `src/engine/engine-session.test.ts` | 30 (+4) | Boot mit Kartensprache, Engine meldet sie; warme Engine (bootend oder bereit) wird ersetzt, gleiche Optionen ändern nichts; Engine einer Partie bleibt, die nächste bootet neu; ruhende oder abgebrochene Engine startet nicht von selbst |
| `src/game/game-page.test.tsx` | 17 (+4) | Spielen-Seite: gespeichertes Profil gezeigt und an Forge, Partie nennt es; Ändern im Dialog; Zufall gezogen und als gezogen gezeigt; fehlendes Profil sperrt den Start mit Grund (jetzt mit `PreferencesProvider` wie in der App) |
| `src/game/match-setup.test.ts` | 11 (+2) | gewähltes Profil in der Anfrage, Zufall aus allen vier je Partie, kein Spiel mit fehlendem Profil |
| `src/game/game-start.test.ts` | 5 (+1) | Reihenfolge der Gründe: Decks, Einstellungen lesen, fehlendes Profil, Engine |
| `src/cards/card-display.test.ts` | 14 (+3) | Englisch: Name, Texte und Bild englisch trotz deutscher Fassung, ein genannter Druck gewinnt, Bild in dritter Sprache bleibt |
| `src/decks/deck-library.test.tsx` | 17 (+1) | Deckseite und -liste mit englischen Karten: englische Namen, keine „nicht deutsch“-Hinweise, keine Sprachübersicht, „nur Forge“ bleibt |
| `vite/engine-assets.test.ts` | 17 (+4) | Profile aus dem Inventar (gegen das Manifest geprüft), neue/geänderte/fehlende Profile benannt, Build bricht ab und der Dev-Server bietet die Engine nicht an |
| `src/game/game-labels.test.ts`, `src/app/app.test.tsx` | (geändert) | deutsche Profilnamen; Engine-Kasten mit Kartensprache und Profilen |
| `engine/bridge/…/AiProfilesTest.java` | 5 (neu, JVM) | Boot-Bericht nennt die vier Profile und die Kartensprache; Bericht = Schema `BootReport`; jedes Profil trägt eigene Werte; unbekanntes Profil fiele auf `AiProps`-Vorgaben zurück und wird abgelehnt, bevor irgendetwas gesendet ist; kein Profil kann schummeln |
| `engine/wasm/test/trace.test.ts` | (geändert) | es gibt eine Variante mit anderer Kartensprache als Forges Sprache |

## 9. Nachweise

Alle auf `e618079`, sauberer Arbeitsbaum.

### 9.1 Engine (`build.sh`, `test-engine.sh`)

- `build.sh` 368 s (Maven 76 s, Wasm 284 s): **56 JVM-Tests** grün (51 + 5
  `AiProfilesTest`), 80 TypeScript-Tests (Protokoll, Client, Worker-Host,
  Fixtures), erzeugte Protokolldateien = Schema.
- `test-engine.sh` (17,4 min, 19 JVM-Prozesse): **69 Läufe, 0 Fehler**. Neu:
  - Kartenprüfung „Deutsch mit englischen Karten“ auf JVM, Node und Chrome:
    gleicher Fingerabdruck wie Englisch und Deutsch; Forges Meldungen
    deutsch („Ja“, „Nein“, „Zug beenden“, „Behalten“), Kartennamen englisch
    („Lightning Bolt“, „Grizzly Bears“, „Counterspell“ – deutsch wären es
    „Blitzschlag“, „Grizzlybären“, „Gegenzauber“); Node und Chrome gleich der
    JVM.
  - Testpartie `human-3-de-cards-en`: dieselbe Engine-Spur wie `human-3`
    (JVM, Wiederholung in Node), Spielprotokoll anders als rein deutsch –
    dieselbe Partie, andere Wörter.
  - Alles Bisherige unverändert grün (KI-Partien, alle Fixtures in Node und
    Chrome, Protokoll-Fehlerpfade, Negativtest, ohne COOP/COEP).

### 9.2 `npm run check` (405 s)

Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund, **510 Vitest-Tests**
(468 + 42), dann der End-to-End-Test: **„E2E OK“, 0 Fehler**, Chrome 153,
echte Engine `42f3bf1c7706cec5` (aus `e618079`), echter Katalog, echte
Scryfall-API. Alle bisherigen Abschnitte grün (der Engine-Kasten zeigt jetzt
„Protokoll: Version 4“, „Karten in Forges Texten“, „KI-Profile“).

### 9.3 End-to-End, Abschnitt 11 „Preferences“

Frisches Profil (Desktop), die Decks aus Abschnitt 9, Kartendaten
eingerichtet:

| Schritt | Ergebnis |
|---|---|
| Einstellungen | Profile „Standard (Vorgabe)“, „Vorsichtig“, „Waghalsig“, „Experimentell“, „Zufällig“, Hinweis „keine Schwierigkeitsstufen“; „Waghalsig“ und „Englisch“ gewählt → sofort gespeichert (`ai.profile`, `display.cardLanguage`); axe 0 |
| Deckliste mit englischen Karten | „Kommandeur: Valki, God of Lies“, kein „nicht ganz deutsch“ |
| Spielen | „Profil Waghalsig – Spielt auf Angriff …“ beim Gegner; Engine bereit nach 5,7 s: „Sprache von Forge: Deutsch“, **„Karten in Forges Texten: Englisch“**, „KI-Profile: Vorsichtig, Standard, Experimentell, Waghalsig“ (aus der echten Wasm-Engine) |
| Partie | 0,86 s bis zur ersten Entscheidung; beim Gegner „Forge-KI · **Waghalsig**“ (Forges Bestätigung `game.started.aiProfile`); axe 0 |
| Zurück auf Deutsch | die schon vorgewärmte englische Engine wird ersetzt: „Karten in Forges Texten: Deutsch“ |
| Zufällig (Dialog der Spielen-Seite, axe 0) | Partie mit „Forge-KI · Experimentell (zufällig)“; insgesamt 4 Engines erzeugt, **nie mehr als eine zugleich** |
| Weniger Bewegung | Dialog-Animation ohne Einstellung `enter`, mit Schalter `none` (`<html data-reduced-motion>`); ein Profil mit `prefers-reduced-motion: reduce` (ohne Schalter): „Dein Gerät wünscht weniger Bewegung …“, Animation `none` |
| Diagnose | Bericht mit „Kennung: 42f3bf1c7706cec5“, „Forge: 2.0.15, Stand ed0333fecb…“, „Protokoll: Version 4“, Einstellungen, „Isoliert (COOP/COEP): ja“; „Kopieren“ → Zwischenablage gleich dem gezeigten Text, Toast „Diagnose kopiert“; axe 0 |
| Handy (412 × 915, Touch) | alle 8 Auswahlzeilen hoch genug (100–313 px Layout-Höhe), kein Überlauf, axe 0 |

### 9.4 Kosten

- **Start-JavaScript** (Skripte und Modulvorladungen der `index.html`, gzip,
  beide Stände gleich gebaut ohne Engine und Katalog): 221,4 → **228,9 KB**
  (+7,5 KB: Einstellungen, Profiltabelle, Diagnose, Switch).
- **Engine:** +112 KB Wasm (Brotli +44 KB).
- **Laufzeit:** unverändert (Vorwärmen 5,9 s, Start 0,82–0,86 s nach dem
  Vorwärmen); eine Änderung der Kartensprache kostet einen Engine-Start, wenn
  gerade eine vorgewärmt ist.

## 10. Befunde

- **Forge spielt einen unbekannten Profilnamen still:** `getAIProp` fällt auf
  die eingebauten Werte von `AiProps` zurück – die keinem Profil entsprechen
  (Konter-Chance bei Manawert 1: 50 % statt 30 % bei Default). Daher die
  Ablehnung in der Bridge.
- **„Vorsichtig“ prüft Angriffe teils weniger:** `TRY_TO_AVOID_ATTACKING_INTO_CERTAIN_BLOCK`
  ist bei Cautious aus. In den Messungen greift es trotzdem etwas seltener an;
  die App behauptet dazu nichts.
- **Einige Profilwerte wirken nie** (§2 des Research-Dokuments): Werte hinter
  einem Schalter, der in allen Profilen gleich steht, Sideboarding bei einem
  Spiel je Match, Varianten, die OpenMana nicht spielt.
- **Kartenübersetzung getrennt von Forges Sprache:** Forge kennt nur eine
  Einstellung (`UI_LANGUAGE`) für beides; die Engine lädt die zweite
  Kartenübersetzung nach dem Start nach. Forges `Lang` (Grammatik) bleibt
  deutsch – englische Kartennamen in deutschen Sätzen, ohne Beugung.
- **Forge-Version im Manifest:** `forgeVersion` ist „GIT“; die Nummer
  (`pom.xml` `versionCode`) schreibt jetzt `prepare-forge.sh` in
  `forge-source.json` und `write-manifest.mjs` ins Manifest.
- In der Studie schrieb Forge ~3 400-mal „Did not have activator set in
  SpellAbilityRestriction.canPlay()“ (nur rote Karten, alle Profile gleich) –
  Forges eigene Warnung, kein Fehler.

- **Der Engine-Build löscht `engine/build/report`** (samt Studienergebnissen)
  – vor einem Build sichern; hier rechtzeitig geschehen.
- Der End-to-End-Test erwartete im Engine-Kasten fest „Version 3“; er nimmt
  die Version jetzt aus den Protokollkonstanten.

## 11. Entscheidungen und Abweichungen

- **Keine Schwierigkeitsstufen**, weil keine gemessen wurden (Bible §7). Die
  Namen übersetzen Forges; „Experimentell“ heißt Forges Versuchsprofil so.
- **„Zufällig“ zieht die App**, nicht Forge (Forges Zufallsnamen gelten nur
  in seiner Oberfläche); je Partie, weil ein Match hier ein Spiel ist.
- **Kartensprache auch für Forge**: Die Sprache der Karten und die von Forges
  Sätzen sind getrennt – ein Spieler, der Karten englisch kennt, liest
  „Wähle ein Ziel für Lightning Bolt“, nicht englische Sätze in einer
  deutschen App (Grundsatz „für den Spieler deutsch“), und nicht deutsche
  Kartennamen neben englischen Karten.
- **Die Sprachübersicht der Decks bleibt berechnet**, wird mit englischen
  Karten aber nicht gezeigt (keine Nachricht für diesen Spieler).
- **Bewegung nur zusätzlich reduzieren**: Die Einstellung überstimmt das
  Gerät nie in Richtung mehr Bewegung.
- **Lade-Kreisel drehen weiter** (Absicht, siehe §4).
- **Die Studie läuft auf der JVM** (die Wasm-Engine spielt dieselben
  Partien, Prompt 05) und gehört nicht zu `test-engine.sh` (25 min); sie ist
  nötig, wenn ein Forge-Update die Profile ändert – dann stoppt der Build.
- **Diagnose als Text statt Datei**: kopierbar in jede Nachricht; eine Datei
  käme mit Prompt 29/31, falls nötig.

## 12. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Spieltisch mit Karten (dort gilt die Kartensprache für jede Karte) | 13, 14, 20 |
| Eigene Animationen des Spieltischs müssen `src/app/motion.ts` fragen | 13 ff. |
| Profil in der Aufzeichnung speichern (`MatchSetup` hält es schon) | 22 |
| Wie sich die Profile für Menschen anfühlen (KI gegen KI misst das nicht) | offen, Rückmeldung aus dem Spiel |
| Kommandeur-Partien in der Studie (nur Constructed gemessen) | offen |
| Weitere Barrierefreiheit (Tastatur im Spieltisch, Screenreader-Ansagen der Partie) | 13–24, 29 |

## 13. Reproduzieren

```bash
npm ci
bash engine/scripts/build.sh              # Engine (~7,5 min)
bash engine/scripts/test-engine.sh        # Differenztests inkl. Kartensprach-Varianten (~15 min)
bash engine/scripts/ai-profile-study.sh   # KI-Profil-Studie (~25 min, optional)
npm run cards:build                       # Katalog (~45 s), falls nicht vorhanden
npm run check                             # Schemas, tsc, oxlint, Vitest, E2E (braucht Internet)
```

In der App: Einstellungen → Gegner „Waghalsig“, Kartensprache „Englisch“ →
Spielen (das Profil steht beim Gegner, der Engine-Kasten nennt englische
Karten) → „Partie starten“ (die Partie zeigt „Waghalsig“ beim Gegner).

## 14. Was als Nächstes kommt

Prompt **13 — Battlefield foundation** (PENDING, nicht begonnen: je Lauf genau
ein Prompt).
