# OpenMana – Status der Umsetzungs-Queue

> **Zentrale, agentenunabhängige Fortschrittsanzeige.** Wer an OpenMana
> weiterarbeitet (Claude, Codex, ChatGPT oder ein Mensch), liest zuerst diese
> Datei und aktualisiert sie am Ende jeder Runde. Die Aufträge selbst stehen in
> [`prompts/queue/`](queue/), Produkt und Architektur in
> [`docs/BIBLE.md`](../docs/BIBLE.md), die Research in
> [`docs/research/`](../docs/research/).

## Regeln

- **Status je Prompt:** `PENDING`, `IN_PROGRESS`, `COMPLETE` oder `BLOCKED`.
- **COMPLETE** gilt erst, wenn
  1. die Anforderungen des Prompts erfüllt sind,
  2. die verlangten Tests erfolgreich gelaufen sind,
  3. die betroffene Dokumentation aktualisiert ist,
  4. diese Datei aktualisiert ist,
  5. alles committed und nach `origin` (GitHub) gepusht ist.
- Prompts laufen **strikt nacheinander**, nie parallel. Ein Prompt beginnt erst,
  wenn sein Vorgänger COMPLETE ist.
- **BLOCKED** heißt: stoppen. Ursache, technische Evidenz und das, was zur
  Fortsetzung nötig ist, stehen dann unten beim Prompt. Kein späterer Prompt
  beginnt, und die Architektur wird nicht eigenmächtig umgangen.
- Forge ist die alleinige Autorität für Magic-Regeln (Bible §2). OpenMana
  implementiert keine Regeln selbst.

## Aktueller Stand

| | |
|---|---|
| Aktuell ausgeführt | **09 — Arena deck import** |
| Nächster Prompt | 10 — Deck library (erst nach 09 = COMPLETE) |
| Zuletzt abgeschlossen | 08 — Scryfall card data (`45f57d7`) |
| Ausführender Agent | Claude Code (Claude Opus 5.5), Sitzung vom 2026-09-25 (Lauf über `prompts/naechster-schritt.md`) |
| Letzte Aktualisierung | 2026-09-25 |

## Übersicht

| # | Prompt | Status | Commit |
|---|---|---|---|
| 00 | [Research: ManaBrew / Forge WebAssembly](queue/00-research-manabrew-forge-wasm.md) | COMPLETE | `681ce0a` |
| 01 | [Forge WASM engine spike](queue/01-engine-spike.md) | COMPLETE | `b64835a` |
| 02 | [Anvil bridge single-thread spike](queue/02-anvil-bridge-single-thread.md) | COMPLETE | `5a2ed62` |
| 03 | [Worker transport and protocol](queue/03-worker-transport-protocol.md) | COMPLETE | `1e8febf` |
| 04 | [Forge resources and card scripts](queue/04-forge-resources-card-scripts.md) | COMPLETE | `fbcba6e` |
| 05 | [JVM/WASM differential tests](queue/05-engine-differential-tests.md) | COMPLETE | `0ddfbc3` |
| 06 | [OpenMana web/PWA skeleton](queue/06-web-pwa-skeleton.md) | COMPLETE | `cfb2252` |
| 07 | [IndexedDB local data layer](queue/07-indexeddb-storage.md) | COMPLETE | `c9ee901` |
| 08 | [Scryfall card data](queue/08-scryfall-data.md) | COMPLETE | `45f57d7` |
| 09 | [Arena deck import](queue/09-arena-deck-import.md) | IN_PROGRESS | – |
| 10 | [Deck library](queue/10-deck-library.md) | PENDING | – |
| 11 | [Game session foundation](queue/11-game-session.md) | PENDING | – |
| 12 | [AI profiles and settings](queue/12-ai-profiles-settings.md) | PENDING | – |
| 13 | [Battlefield foundation](queue/13-battlefield-foundation.md) | PENDING | – |
| 14 | [Cards, hand and safe interaction](queue/14-card-hand-interactions.md) | PENDING | – |
| 15 | [Forge decision UI](queue/15-forge-decisions.md) | PENDING | – |
| 16 | [Priority, stack and phases](queue/16-priority-stack-phases.md) | PENDING | – |
| 17 | [Targeting and cost payment](queue/17-targeting-cost-payment.md) | PENDING | – |
| 18 | [Combat: attackers](queue/18-combat-attackers.md) | PENDING | – |
| 19 | [Combat: blockers](queue/19-combat-blockers.md) | PENDING | – |
| 20 | [Zones and full card viewer](queue/20-zones-card-viewer.md) | PENDING | – |
| 21 | [In-game history](queue/21-match-history-events.md) | PENDING | – |
| 22 | [Automatic match recording and replay](queue/22-match-recording-replay.md) | PENDING | – |
| 23 | [Beginner QoL](queue/23-beginner-qol.md) | PENDING | – |
| 24 | [Responsive phone/fold/tablet/desktop pass](queue/24-responsive-polish.md) | PENDING | – |
| 25 | [PWA, engine caching and lifecycle](queue/25-pwa-cache-offline.md) | PENDING | – |
| 26 | [Isolated Forge update pipeline](queue/26-forge-update-pipeline.md) | PENDING | – |
| 27 | [Credits, licenses and notices](queue/27-credits-licenses.md) | PENDING | – |
| 28 | [Android TWA / Warehouse packaging](queue/28-android-twa-warehouse.md) | PENDING | – |
| 29 | [Full regression and E2E suite](queue/29-regression-suite.md) | PENDING | – |
| 30 | [Anvil parity audit and remediation](queue/30-anvil-parity-audit.md) | PENDING | – |
| 31 | [Production/Vercel readiness](queue/31-production-vercel.md) | PENDING | – |
| 32 | [Final OpenMana readiness audit](queue/32-final-openmana-readiness.md) | PENDING | – |

## Details je Prompt

### 00 — Research: ManaBrew / Forge WebAssembly — COMPLETE

- **Commit:** `681ce0a` (2026-09-24)
- **Zusammenfassung:** Untersucht, wie Forge ohne Server im Browser laufen kann.
  Ergebnis **„Go mit Bedingungen“**: Forge per Oracle GraalVM Web Image als
  WebAssembly in einem Dedicated Worker, Forge upstream plus kleine
  GPL-Patch-Queue (Synchronmodus), Anvil-Weg über `PlayerControllerHuman` als
  erste Wahl. Erster Implementierungsschritt ist der Engine-Spike.
- **Erzeugte Komponenten:** `docs/research/MANABREW_WASM.md`,
  `docs/research/FORGE_BUILD.md`, `docs/research/LICENSES.md`,
  `docs/research/OPENMANA_ENGINE_PLAN.md`.
- **Tests:** keine Implementierung. Gemessen wurde ManaBrews produktives
  Wasm-Modul in Node 22 und Chrome 153 (Start ~3,9 s, Spitze 1,1–1,3 GB).
- **Erkenntnisse/Abweichungen:** acht offene Fragen
  (`OPENMANA_ENGINE_PLAN.md`, Tabelle am Ende); sechs bewusste Abweichungen
  von der Bible (ebd. §10), u. a. Patch-Queue statt reinem upstream-Pin und
  TWA/WebAPK statt Capacitor.

### 01 — Forge WASM engine spike — COMPLETE

- **Commit:** `b64835a` (2026-09-24), Agent: Claude Code (Claude Opus 5.5)
- **Zusammenfassung:** Forge upstream `Card-Forge/forge@ed0333f` (Submodule) plus
  drei GPL-Patches läuft als WebAssembly (Oracle GraalVM 25.4.4.1.1 Web Image) in
  einem **Dedicated Worker in Chrome 153** und spielt eine komplette Partie
  Forge-KI gegen Forge-KI. JVM, Node und Chrome erzeugen **dasselbe Forge-GameLog**
  (SHA-256, drei Szenarien). Ohne COOP/COEP erscheint nach ~70 ms eine klare
  Meldung statt eines Hängers. Keine Annahme der Research widerlegt, kein Blocker.
- **Wichtige Komponenten:**
  - `engine/forge` (Submodule, `shallow`), `engine/toolchain.lock.json`
    (GraalVM/Binaryen/Maven mit Prüfsummen), `engine/resources.json`
  - `engine/patches/0001–0003` (Synchronmodus `ThreadUtil`/KI, kooperative
    KI-Zeitgrenze, Angriffs-KI nacheinander) + `patches/README.md`
  - `engine/bridge` (Maven-Modul auf dem Forge-Parent): `HeadlessGuiBase`,
    `ForgeEngine`, `EngineBoot`, `ResourceBundleReader`, `AiSmokeMatch`,
    `SmokeDecks`, `JvmSmokeMain`, eigener Assembly-Deskriptor
  - `engine/wasm`: `WasmMain` (`@JS`), Worker-Host (Browser + Node),
    `feature-detect.js`, Diagnoseseite `spike/`, Tests `test/`
  - `engine/scripts`: `build.sh` (setup-toolchain → prepare-forge →
    pack-resources → build-jvm → build-wasm), `test-engine.sh`,
    `record-agent-config.sh` u. a.
  - Doku: `engine/README.md`, `docs/implementation/01-engine-spike.md`
- **Tests (alle bestanden):**
  - 5 JVM-Tests (TestNG, im Maven-Build): Boot/Pin/Synchronmodus, KI-Partie
    endet und ist per Seed wiederholbar, anderer Seed = andere Partie,
    Ressourcen-Bundle weist kaputte/gefährliche Pfade ab.
  - `test-engine.sh`: Seed 42 lazy, Seed 42 eager, Seed 7 lazy jeweils auf JVM,
    Wasm/Node 22 und Wasm/Chrome 153 → Hashes `d7611b0e…` bzw. `0d52aafc…`
    überall gleich, keine Forge- oder tinylog-Fehler; Negativtest ohne COOP/COEP.
  - Laut-scheitern-Prüfungen: falsches Archiv (Größe/SHA-256), fehlende
    Toolchain, unbekanntes Launcher-Layout, Launcher ohne Host-Konfiguration,
    `-H:+FatalUnsupportedNodes` ohne Befund.
- **Messwerte (odin, i7-8700T):** sauberer Build 301 s, davon `native-image`
  1:45 min bei 5,2–5,9 GiB Spitze; mit 2 CPUs/8 GB ohne Swap simuliert 3:18 min
  bei 5,07 GiB (→ Research-Frage 4: privater Runner reicht). Modul 68,7 MiB roh,
  19,4 MiB gzip, 13,1 MiB Brotli. Chrome: spielbereit nach ~3,4–3,5 s (lazy) bzw.
  4,9 s (eager), Engine ≈ +0,93 GiB RSS, 502 MiB Wasm-/JS-Heap im Worker.
  Partie im Wasm 1,5–2× so lang wie auf der JVM.
- **Erkenntnisse/Abweichungen:**
  - Patches laufen auf einer frischen Kopie des Pins (`engine/build/work`),
    nicht im Submodule; der Maven-Reactor wird dort erzeugt.
  - Web Image: `os.name="Browser"`, kein `user.home`, fehlende Dateien werfen
    `NoSuchFileException` statt `FileNotFoundException` → Forges drei
    UI-Präferenzdateien werden leer angelegt (beide Laufzeiten).
  - Netty erzwingt per eigener Konfiguration Build-Zeit-Init → Logging/Netty
    auf Laufzeit-Init gesetzt (wie ManaBrew).
  - **Behoben:** Forges tinylog-Ausgaben gingen im Fat-JAR verloren
    (Service-Dateien überschrieben) → Deskriptor führt sie zusammen, Test wacht.
  - Spike-Transport nur `postMessage`; SharedArrayBuffer-Warteschlange kommt
    mit Prompt 03. Netty/jupnp liegen noch auf dem Klassenpfad (Prompt 04).
  - Offen für spätere Prompts: Lazy-Loading-Korrektheit für namentlich erzeugte
    Karten (04), vollständiger Differenztest (05), Fold7-Messung, Vercel, TWA,
    `LICENSE`-Datei vor öffentlicher Auslieferung (27).

### 02 — Anvil bridge single-thread spike — COMPLETE

- **Commits:** `5a2ed62` Implementierung (alle Nachweise liefen auf diesem
  Stand, `openmana.engineSourcesModified=false`), `4f6084e` Doku (2026-09-24),
  Agent: Claude Code (Claude Opus 5.5)
- **Zusammenfassung:** Forges eigener Mensch-Pfad (`PlayerControllerHuman` +
  Inputs) läuft über eine Bridge nach Anvils Vorbild auf **einem** Thread: auf
  der JVM, als Wasm in Node 22 und im Dedicated Worker in Chrome 153. Im
  Browser wartet der Worker mit `Atomics.wait` mitten in Forges Java-Stack auf
  die nächste Eingabe aus einem SharedArrayBuffer. Vier Testpartien gegen
  Forges KI (Mulligan, Karten per Antippen außerhalb einer Frage, Kosten
  automatisch und von Hand, Ziele auf Karten und Spieler, Angriff, Block,
  blockierende Fragen, Rücknahmen, absichtlich falsche Eingaben, Aufgeben)
  enden in Node und Chrome **exakt** wie auf der JVM. Option A (Anvil-Weg)
  bestätigt; keine Research-Annahme widerlegt, kein Blocker. Forge bleibt
  alleinige Regelautorität, die Bridge rechnet nichts selbst aus.
- **Wichtige Komponenten:**
  - `engine/bridge/…/bridge/`: `BridgeGuiGame` (Forges GUI für den Menschen,
    Input-Pumpe), `StateBuilder`, `Answers`, `Protocol` (`0.2-spike`),
    `HumanMatch` (Start aus JSON-Decks, Bericht bei unbekannten Karten),
    `ProtocolTrace`, `EngineHost`
  - `engine/patches/0004–0006`: Input-Pumpe, keine Komfort-Timer im
    Synchronmodus, kein Netzwerk-Manager (Netty) in lokalen Partien
  - `engine/wasm`: `WasmEngineHost` + Befehl `human-match`,
    `host/input-channel.js` (SharedArrayBuffer, `input.wait`),
    `spike/replay-driver.js`, `test/node-replay.mjs`,
    `browser-smoke.mjs --transcript`
  - Testwerkzeug: `smoke/ScriptedHuman` (regelfrei; Varianten verteidigend
    und aufgebend), `smoke/ReplayHost`, `jvm/JvmHumanMatchMain` (Aufzeichnung)
  - `ForgeEngine.LOGGING` (tinylog ohne Aufrufer-Abfrage),
    `engine/scripts/ListSubscribers.java` (alle EventBus-Abonnenten)
  - Doku: `docs/implementation/02-anvil-bridge.md` (Protokoll, Zuordnung zu
    Anvil, Abweichungen, Lücken), `engine/README.md`, `engine/patches/README.md`
- **Tests (alle bestanden):**
  - 30 JVM-Tests (TestNG im Maven-Build): `HumanMatchTest` 16 (drei volle
    Partien + Wiederholungen, u. a. ein Thread, Mulligan, Priorität, Kosten,
    Ziele, Angriff, Block, Fragearten, Rücknahme/Ablehnung, `state.request`,
    verborgene Karten ohne Id, Aufzeichnung reproduziert die Partie, Aufgeben,
    unbekannte Karten), `AnswersTest` 8, `ForgeLoggingTest` 1, aus 01: 5.
  - `test-engine.sh`: vier Mensch-Szenarien (Seed 3, Seed 11, Seed 5
    verteidigend, Seed 3 mit Aufgabe in Zug 4; zusammen 164 Eingaben) auf der
    JVM aufgezeichnet und in Node und Chrome nachgespielt → Forge-Protokoll,
    Fingerabdruck aller Entscheidungsnachrichten (Fragen samt Nummern,
    Rücknahmen, Ablehnungen), Forges GUI-Aufrufe, Eingaben, Züge und Ergebnis
    überall gleich. KI-Partien aus 01 unverändert (`d7611b0e…`, `0d52aafc…`),
    Negativtest ohne COOP/COEP (74 ms).
- **Messwerte (odin):** sauberer Build 310,5 s (Maven 50 s, `native-image`
  108 s bei 5,8 GiB). Modul 69,2 MiB roh / 13,2 MiB Brotli (Bridge ≈ +0,5 MiB).
  Antwort der Engine je Eingabe in Chrome im Median 4–11 ms, höchstens
  0,26 s mit KI-Zug. Mensch-Partie in Chrome 1,8–2,4 s (JVM 1,6–2,1 s). Worker
  502 MiB wie bei der KI-Partie, Engine ≈ +0,9 GiB RSS.
- **Erkenntnisse/Abweichungen:**
  - **Behoben, nur im Wasm aufgetreten:** (1) Forges tinylog-Einstellungen
    lassen tinylog bei jeder Logzeile die aufrufende Klasse suchen; Web Image
    hat keinen Java-Stack → `NullPointerException` mitten in Forge. Die Engine
    setzt jetzt auf beiden Laufzeiten eine eigene Konfiguration.
    (2) Forges Ereignis-Abonnenten (Guava EventBus) waren nur teilweise per
    Reflection registriert; jetzt alle, und der Test vergleicht Forges
    GUI-Aufrufe JVM gegen Wasm.
  - Abweichungen von Anvil (mit Grund in der Doku §6): falsche oder veraltete
    Eingaben werden laut abgelehnt (`input.rejected`) statt verworfen oder
    zurechtgebogen; kein Timeout; verborgene Karten ohne Id; neue Frageart
    `arrange` (Hellsicht ohne die ganze Bibliothek), `order` mit Forges
    Doppellisten-Grenzen, `player.tap`; Fragen gehören ihrem Input statt
    von einem Timer ersetzt zu werden.
  - Bekannte Lücken für spätere Prompts: Kampfschaden auf den Verteidiger
    beim Trampeln (18/19), „an beliebige Stelle“ beim Anordnen (15), verdeckte
    Karten des Gegners auf dem Feld (13/17), `player.tap` ohne Rückmeldung
    (17), Eingabekanal ohne Warteschlange/Versionsprüfung (03), Commander in
    einer Mensch-Partie ungetestet (05/11/12).
  - Vorfall während der Entwicklung: liegengebliebene JVM-Testläufe füllten
    die Inodes von `/tmp` (1 048 575 von 1 048 576), andere Programme auf odin
    konnten kurz keine Dateien in `/tmp` anlegen. Aufgeräumt; Läufe räumen
    jetzt selbst auf (`TempRoot`), Tests entpacken unter `target/`.
- **Weiter mit:** Prompt 03 (Worker-Transport und Protokoll). Nicht begonnen:
  Der Auftrag vom 2026-09-24 endete ausdrücklich nach 01 + 02.

### 03 — Worker transport and protocol — COMPLETE

- **Commits:** `1e8febf` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Build, `openmana.engineSourcesModified=false`), danach Doku und
  dieser Eintrag (2026-09-24). Agent: Claude Code (Claude Opus 5.5), Auftrag
  „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `8fc690d`.
- **Zusammenfassung:** `engine/protocol` ist der einzige Vertrag zwischen UI und
  Engine: JSON-Schema (Protokollversion **1**), daraus erzeugte TypeScript-Typen,
  Konstanten und vorkompilierte Prüfer (Ajv standalone); der Build bricht ab,
  wenn die erzeugten Dateien nicht zum Schema passen. Engine → UI per
  `postMessage`, UI → Engine über einen SharedArrayBuffer-Ringpuffer
  (Längenpräfix, Umbruch am Ende, laut bei Überlauf, Magic/Layout-Prüfung).
  Neuer `EngineClient` (Main Thread): Feature-Erkennung vor jedem Download,
  Versionsprüfung, Schema- und Reihenfolgeprüfung jeder Engine-Nachricht
  (Verstoß = technischer Abbruch), Buchführung über Fragen (veraltete und
  unbekannte Antworten werden gar nicht erst gesendet), nummerierte Eingaben,
  Ready-Timeout und Stall-Watchdog, `engine.ready`/`engine.error`/`engine.abort`.
  Worker-Host in TypeScript (Browser-Bundle `engine-worker.js`, Node führt
  dieselben Quellen aus). Forges Spiel ist unberührt: die vier Testpartien aus 02
  ergeben auf der JVM bitgleich dasselbe Forge-Protokoll. Kein Blocker.
- **Wichtige Komponenten:**
  - `engine/protocol/`: `schema/protocol.schema.json`, `scripts/generate.mjs`
    (`--check`), `src/generated/*`, `src/validate.ts`, `src/input-queue.ts`,
    `src/features.ts`, `README.md` (der Vertrag in Worten)
  - `engine/client/src/`: `EngineClient`, Fehlerklassen, Browser- und Node-Port
  - `engine/wasm/host/`: `worker-host.ts`, `engine-worker.ts`, `node-engine-worker.ts`
    (ersetzt `worker-core.js`, `input-channel.js`, `feature-detect.js` u. a.)
  - Bridge (Protokoll 1): `seq` an jeder Eingabe (Lücke = Abbruch), `kind` in
    Antworten, `question.answered` (jede Frage genau einmal geschlossen),
    `blocking` an jeder Frage, `message.kind`, Karten-Ids nur bei `mayView`,
    `engine.ready` mit Protokoll-/Forge-/Build-Version, Fehlercodes in `WasmMain`
  - Tests/Werkzeug: `ProtocolContractTest` (Java ↔ Schema, jede Forge-Phase),
    `ScriptedHuman` mit Lebenszyklus-Prüfung, `JvmHumanMatchMain --messages`,
    `wasm/spike/replay.ts` (lazy/eager über den Client), `invariants.ts`,
    `wasm/test/{node-replay,node-ai,node-protocol,validate-messages}.ts`,
    `worker-host.test.ts`; Diagnoseseite `spike/page.ts`
  - Build: `engine/scripts/build-host.sh` (neu, erster Schritt von `build.sh`),
    `bundle-host.mjs`, `test-engine.sh`, `write-manifest.mjs` (Worker +
    Protokollversion); npm-Paket jetzt `engine/package.json` (TypeScript 7.0.2,
    esbuild, Ajv, json-schema-to-typescript, fest gepinnt)
  - Doku: `docs/implementation/03-worker-transport-protocol.md`,
    `engine/protocol/README.md`, `engine/README.md`
- **Tests (alle bestanden):**
  - 61 Unit-Tests (`node:test`, in jedem Build): Schema 13 (inkl. echter
    Zustände, vollständige Schnappschüsse, Version Schema = TS = Java, Frische der
    erzeugten Dateien), Warteschlange 10 + 1 mit zwei echten Threads (5 000
    Eingaben), Features 5, Client 18 (u. a. **veraltete Antworten**,
    **zurückgezogene/beantwortete Fragen**, blockierende Frage, Antippen gegen den
    letzten **vollständigen Zustand**, `queue-full`, Watchdog), Regelwächter 1,
    Worker-Host 13 (alle Fehlerpfade mit simulierter Java-Seite).
  - 38 JVM-Tests (Maven): neu `ProtocolContractTest` 5, `HumanMatchTest` 19
    (+3: Lebenszyklus, kaputte `seq` bricht laut ab, falsche Antwortart ist
    `invalid` und ändert Forges Spiel nicht).
  - `test-engine.sh` (31 Läufe, 0 Fehler): die vier Mensch-Partien auf der JVM
    mit bitgleichem Forge-Protokoll wie in 02 (`c1e990c6…`, `7c3f673f…`,
    `e8213ffe…`, `6737df12…`), ihre 986 Nachrichten schemakonform und in sich
    vollständig; in Node und Chrome über Client + Warteschlange nachgespielt,
    lazy (Client und Engine urteilen bei allen 164 Eingaben gleich) und eager mit
    256-Byte-Warteschlange (3–11 Umbrüche, 2–11× voll) → jedes Mal exakt wie die
    JVM; KI-Partien aus 01 unverändert (`d7611b0e…`, `0d52aafc…`); Fehlerpfade
    gegen die echte Engine: Versionskonflikt (65 ms, vor dem Laden), abgelehntes
    Deck → derselbe Worker spielt danach, Abbruch mitten in der Partie, kaputte
    Nummerierung → Abbruch mit Grund; Chrome: Versionskonflikt 100 ms,
    ohne COOP/COEP klare Meldung nach 86 ms.
- **Messwerte (odin):** sauberer Build 386,2 s (`build-host` 3,8 s, Maven 77,5 s,
  `native-image` 144,5 s bei 5,9 GiB). Modul unverändert 69,2 MiB / 13,2 MiB
  Brotli; Worker-Bundle 290 KiB minifiziert / 28 KiB gzip. Schema-Prüfung im
  Client im Mittel 0,05–0,13 ms je Nachricht (Chrome), 12–21 ms je ganze Partie.
  Engine-Antwort je Eingabe in Chrome im Median 7–13 ms, höchstens 268 ms.
  Start und Speicher wie in 02.
- **Erkenntnisse/Abweichungen:**
  - Versionsregel: genaue Gleichheit (UI und Engine kommen in einem Release);
    geprüft an drei Stellen, zuerst im Worker **vor** dem Engine-Download.
  - Der Client prüft formale Protokollfakten (Ids, Art, blockierend, sichtbare
    Karten), **nicht** den Inhalt von Antworten (Anzahl/Summe/aktiver Knopf) — das
    bleibt bei der Bridge (keine doppelte Logik); Entscheidung für Prompt 15 offen.
  - Research-Plan „UI importiert Protokoll und Worker-Host“: die UI importiert
    `engine/protocol` und `engine/client`; den Worker lädt sie nur als Datei.
  - **Falle:** Mit `engine/package.json` (`"type": "module"`) würde Node den
    GraalVM-Launcher als ES-Modul laden; der Node-Worker lädt ihn jetzt wie
    `importScripts` (`vm.runInThisContext` + globales `require`).
  - Ajv-Standalone (JSON Schema 2020-12) lässt sich nicht tree-shaken; das
    Worker-Bundle trägt alle Prüfer (28 KiB gzip) — bewusst so gelassen.
  - Befund für die in der Bible neu geplante Wiederaufnahme laufender Partien
    (`1223201`): Seed + nummerierte Eingaben reproduzieren jede Testpartie
    bitgenau — Kandidat für eine vollständige Wiederherstellung, nicht umgesetzt.
  - Bekannte Lücken mit Ziel-Prompt in der Doku §9 (u. a. Stapelkarten ohne
    Ansicht → 16, leere `distribute`-Liste → 18/19).
- **Weiter mit:** Prompt 04 (Forge resources and card scripts). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 04 — Forge resources and card scripts — COMPLETE

- **Commits:** `fbcba6e` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Build, `openmana.engineSourcesModified=false`), danach Doku
  und dieser Eintrag (2026-09-24). Agent: Claude Code (Claude Opus 5.5), Auftrag
  „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `9999fdf`.
- **Zusammenfassung:** Die Engine bettet einen bewusst gewählten, vollständig
  inventarisierten Satz Forge-Daten aus demselben Pin ein, mit Originalpfaden
  (`res/…`): `engine/resources.json` entscheidet über **jeden** Eintrag von
  `forge-gui/res` (eingebunden oder mit Grund ausgelassen; ein neuer Eintrag in
  einem Forge-Update stoppt den Build). Engine-Manifest Format 2 mit Forge-SHA,
  Patch-Hash, Toolchain (mit Prüfsummen), Ressourcen-Inventar (jede Datei mit
  Größe und SHA-256), Inhalt des Moduls, Größen und SHA-256 aller Artefakte.
  Eine Kartenprüfung in der Engine (`CardProbe`) macht aus jeder Karte (33 505),
  jeder Variante (473) und jedem Token (854) eine Spielkarte, prüft jede
  Kartenart, jede Karte der drei neuesten Sets und fünf Effekte, die Karten per
  Namen bzw. zufällig aus allen Karten erzeugen: auf JVM, Node und Chrome
  derselbe Fingerabdruck, faul und vollständig geladen, englisch und deutsch.
  Netzspiel (Netty, jupnp, Jetty, Servlet) ist aus dem Modul und bleibt draußen
  (Build-Sperre + Klassenprüfung). Forges Texte gibt es auch auf Deutsch
  (`--language=de-DE`); Karten lädt die Engine standardmäßig vollständig. Kein
  Blocker.
- **Wichtige Komponenten:**
  - Daten: `engine/resources.json` (include/leftOut mit Gründen, Sprachen),
    `scripts/pack-resources.mjs` (prüft gegen den Pin, Inventar,
    Ressourcen-Manifest je Ordner), `scripts/write-manifest.mjs` (Format 2),
    `build-jvm.sh` → `openmana/engine-resources.properties` (SHA, Dateizahl,
    Sprachen; die Engine meldet `resourcesSha256` und prüft die Dateizahl)
  - Netzspiel: `scripts/build-wasm.sh` (Nettys eigene native-image-Konfiguration
    ausgeschlossen, `-H:AbortOnTypeReachable` für `io.netty.*`, `org.jupnp.*`,
    `org.eclipse.jetty.*`, `javax.servlet.*`, SBOM mit Klassen),
    `scripts/image-classes.mjs` (Klassen im fertigen Modul),
    `gen-reflection-config.mjs` + `ListSubscribers.java --interfaces`
    (Schnittstellen nicht mehr registriert), `record-agent-config.sh` (neu
    aufgenommen; nur Fremdbibliotheken, laut bei ungedeckten Forge-Zugriffen)
  - Kartenprüfung: `bridge/…/smoke/CardProbe.java`, `jvm/JvmCardProbeMain.java`,
    Engine-Befehl `card-probe`, `wasm/test/node-cards.ts`,
    `check-card-probes.ts`, `card-probe-check.ts`, `browser-smoke.mjs --cards`,
    Diagnoseseite `?cards=1`
  - Sprache/Kartenladen: `ForgeEngine.Language` (`en-US`, `de-DE`; Start bricht
    ab, wenn Forge still auf Englisch zurückfiele), `ForgeEngine.CardLoading.DEFAULT
    = EAGER`, Start-Argumente `--language`, `--card-loading`
  - Protokoll **2**: `BootReport.language`, `EngineBuild.resourcesSha256`,
    `CardLoading`, `EngineLanguage`, `diagnostics.card-probe` → `diagnostics.cards`
  - Doku: `docs/implementation/04-forge-resources-card-scripts.md`,
    `engine/README.md`, `engine/protocol/README.md`
- **Tests (alle bestanden):**
  - 65 Unit-Tests (+4: Kartenprüfung im Worker-Host und im Client, Fehlerpfad,
    Lebenszyklus; Tests nutzen `PROTOCOL_VERSION` statt fester Zahl).
  - 45 JVM-Tests (+7): `CardProbeTest` 6 (keine Befunde, fünf Effekte mit den
    erwarteten Karten, jede Kartenart mit Gesichtern, jedes Token, neueste Sets,
    ganze Datenbank), `ProtocolContractTest` +1 (Sprachen = Schema = Bündel,
    Lade-Modi, `EngineBuild`-Felder).
  - `test-engine.sh` (45 Läufe, 0 Fehler, 13,6 min): KI-Partien Seed 42/7
    unverändert seit Prompt 01 (`d7611b0e…`, `0d52aafc…`) auf JVM, Node,
    Chrome; KI-Partie Seed 42 **deutsch** (`5fc5fd3c…`) = dieselbe Partie wie
    englisch, auf allen drei Laufzeiten bitgleich; Mensch-Partien 3/11/5-defend/
    3-concede mit bitgleichem Forge-Protokoll wie seit Prompt 02, alle 1 320
    Nachrichten schemakonform, Wiederholungen in Node (faul + 256-Byte-
    Warteschlange) und Chrome = JVM; Mensch-Partie 3 **deutsch** = dieselbe
    Partie wie englisch, in Node gleich; Kartenprüfung faul (`1e7a32d0…`),
    vollständig (`bb7d62a0…`) und deutsch (= englisch) in Node und Chrome = JVM;
    Fehlerpfade des Protokolls, Versionskonflikt (Chrome 102 ms), ohne COOP/COEP
    klare Meldung nach 86 ms.
- **Messwerte (odin):** sauberer Build 392,9 s (Maven mit 45 Tests 66,7 s,
  `native-image` 140,9 s bei 5,4 GiB). Forge-Daten 36 905 Dateien, 42,3 MiB,
  Brotli 4,69 MB (vorher 5,45 MB). Modul 75,4 MiB roh, **12,45 MiB Brotli**
  (vorher 13,2 MiB). Chrome bereit (Median): faul 3,46 s (wie Prompt 03),
  vollständig 5,06 s; Worker 521 / 612 MiB. Nachladen aller Karten im faulen
  Modus: Chrome 17,3 s, Node 23–42 s, JVM 6,7–15,8 s. Im Modul 6 888 Klassen,
  0 aus Netzwerk-Bibliotheken; erreichbare Typen 11 105 (vorher 11 520).
- **Erkenntnisse/Abweichungen:**
  - **Bewusste Abweichung vom Prompt:** `effects/` und `defaults/` sind **nicht**
    eingebettet. Die Research hatte sie als Vorgaben eingeordnet; es sind
    Animationen und Layouts von Forges eigenen Oberflächen, die die Engine nie
    liest (JFR-Messung, Quelltextsuche); `effects/` allein waren ~12 % des
    Downloads. Außerdem ausgelassen (mit Grund in `resources.json`): andere
    Sprachen, Bildersuche, Deckgenerator, andere Spielmodi, Limited-Daten,
    Oberflächen-Dateien, Lizenztexte (→ Prompt 27).
  - **Research-Frage 2 beantwortet:** Forge upstream lädt Karten im faulen Modus
    korrekt nach (`ensureAllCardsLoaded` in den betroffenen Effekten und in
    `PlayerControllerHuman.chooseSingleCardFace`), ManaBrews Korrekturen sind
    unnötig. Aber faul spart kaum Startzeit (Forge parst trotzdem jedes Skript)
    und friert beim ersten Bedarf aller Karten (zufällige Karte, Spieler benennt
    eine Karte) die Partie für 17–42 s ein → **Standard jetzt `eager`**.
  - **Deutsch als reine Anzeigeschicht:** Die Sprache ändert nachweislich nur
    Forges Wörter, nie die Partie. Vorgabe des Projektbesitzers (2026-09-24): für
    das System alles englisch, für den Nutzer alles deutsch; Kartenbilder und
    -texte kommen von Scryfall (08). Ob die App Forges deutsche Sätze anzeigt,
    entscheidet Prompt 12 (Empfehlung: ja, als Anzeigeschicht). Upstream-Lücke:
    Forest heißt in Forges deutscher Kartendatei „Forest“.
  - **Netzspiel:** Netty kam nur über Nettys eigene GraalVM-Konfiguration ins
    Modul (187 Klassen); jupnp wurde über registrierte Forge-Schnittstellen
    (`IGuiBase.getUpnpPlatformService`) als Typ erreichbar — die neue Sperre fand
    es. Aus Forges Netzspiel-Paket bleiben 5 Klassen ohne Netzwerkcode
    (Hosting-Prüfung aus Patch 0006, Signatur-Typen). Sentry (Forges
    Absturzmelder) bleibt, ist aber nie eingeschaltet.
  - **SBOM:** GraalVMs SBOM listet den ganzen Klassenpfad (auch jupnp) und kann
    im Fat-JAR kaum zuordnen; als Lizenzinventar erst mit Prompt 27 (einzelne
    JARs oder eigene Zuordnung).
  - Protokoll 2 (Vertragsänderung), Tests versionsneutral.
  - Befunde für später: zwei kaputte upstream-Kartenskripte (Desert Were-Worm,
    Nascent Metamorph); Forge ordnet Vorschaukarten nach Datum zu
    (Zeitabhängigkeit, wichtig für Prompt 22).
  - Während des Laufs: Ein Fehlalarm „deutsche Partie anders als englisch“ kam
    aus einem Fehler im Vergleichsskript (behoben); die Partien sind gleich.
- **Weiter mit:** Prompt 05 (JVM/WASM differential tests). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 05 — JVM/WASM differential tests — COMPLETE

- **Commits:** `0ddfbc3` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Build, `openmana.engineSourcesModified=false`), danach Doku
  und dieser Eintrag (2026-09-24). Agent: Claude Code (Claude Opus 5.5), Auftrag
  „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `7264f1a`.
- **Zusammenfassung:** Ein Regressionsgerüst spielt dieselben skriptgesteuerten
  Partien mit festen Seeds auf der JVM-Bridge und der Wasm-Bridge (Node,
  Chrome) und vergleicht sie über eine **strukturierte, sprachunabhängige
  Engine-Spur** statt über Forges Texte: vor jeder Eingabe, zu jedem
  Schrittbeginn und am Spielende ein vollständiger Schnappschuss aus Forges
  Modell, dazwischen jedes Forge-Ereignis und jede Entscheidung der Bridge – nur
  Ids, englische Kartenschlüssel, Aufzählungen und Zahlen, keine Uhr. **Jede
  Abweichung scheitert** und nennt Eintrag, Zug, Schritt, gelesene Eingaben und
  Feld; ein Negativtest mit verfälschten Spuren beweist es. Zehn kleine
  Testpartien als Daten decken zusammen ab, was der Prompt verlangt, inklusive
  Blocker-Zuordnung und einer regelkonformen **Commander**-Partie (dafür einen
  Bridge-Fehler behoben). Alle Partien sind auf JVM, Node und Chrome
  spurgleich; Deutsch = Englisch, faul = vollständig. Research-Frage 3
  (verhaltensgleiche Übersetzung) damit für die getesteten Pfade beantwortet.
  Kein Blocker.
- **Wichtige Komponenten:**
  - Spur: `engine/bridge/…/trace/` (`EngineTrace` – Checkpoints, Wrapper um den
    Host, EventBus-Abonnent; `TraceEvents` – eine Art je Forge-Ereignisklasse,
    implementiert Forges Visitor-Schnittstelle vollständig, ein neues
    Forge-Ereignis kompiliert nicht ohne Entscheidung; `TraceSnapshot` – aus
    Forges Modell inkl. verdeckter Information; `TraceRefs`)
  - Protokoll **3**: `diagnostics.trace` (genaues Schema für den Schnappschuss),
    `MatchRequest.trace`, `DiagnosticsAiMatchCommand.trace`,
    `MatchSummary.trace`/`AiMatchResult.trace`; Client nimmt die Spur nur an,
    wenn angefordert, lückenlos, mit passender Zählung
  - Testpartien: `engine/fixtures/` (6 Decks, 10 Partien, `README.md`);
    `ScriptedHuman` mit Richtlinien (Angriff `all/none/alternate`, Block
    `none/one/assign`, Aufgabe), Kommandant aus der Kommandozone;
    `JvmHumanMatchMain --scenario`, `JvmSmokeMain --trace`
  - Werkzeuge: `engine/wasm/spike/trace.ts` (Vergleich, Bericht, SHA-256,
    Abdeckung, `REQUIRED_COVERAGE`), `wasm/test/fixtures.ts`,
    `check-traces.ts`, `compare-traces.ts`, `node-divergence.ts`; Wiederholungen
    (`replay.ts`, `node-ai.ts`, `page.ts`, `browser-smoke.mjs`) vergleichen
    jeden Eintrag beim Eintreffen und brechen bei der ersten Abweichung ab
  - Build: `ListSubscribers.java` + `gen-reflection-config.mjs` registrieren
    OpenMana-EventBus-Abonnenten für das Wasm-Modul (ohne wäre die Spur dort
    still leer; der Build bricht ab, wenn der Spur-Abonnent fehlt)
  - Behoben: `HeadlessGuiBase.showImageDialog` verwirft Forges Erfolgs-Dialog
  - Doku: `docs/implementation/05-engine-differential-tests.md`,
    `engine/fixtures/README.md`, `engine/README.md`, `engine/protocol/README.md`
- **Tests (alle bestanden):**
  - 80 Unit-Tests (+15): `trace.test.ts` 12 (Vergleich, Berichte, Prüfsumme,
    Abdeckung, Testpartien gültig und zusammen vollständig), Client +3 (Spur nur
    auf Wunsch, Lücke, Zählung), Schema-Beispiele für Protokoll 3.
  - 51 JVM-Tests (+6): `EngineTraceTest` 5 (Spur ändert das Spiel nicht,
    dieselben Eingaben = dieselbe Spur, vollständig und ohne Textfelder,
    Blocker-Zuordnung auf zwei Angreifer, Commander-Partie endet regulär mit
    Steuer, Rückkehr und Kommandantenschaden), `ProtocolContractTest` +1.
  - `test-engine.sh`: siehe unten (**0 Fehler**): KI-Partien Seed 42
    faul/vollständig/deutsch dieselbe Spur `51689620…` (257 Einträge), Seed 7
    `9e087efc…`, je JVM = Node = Chrome; 10 Testpartien auf der JVM mit
    geprüfter Abdeckung, Varianten `human-3-de`/`human-3-lazy` = `human-3`
    (`fa95aed2…`); 8 Partien in Node faul und mit 256-Byte-Warteschlange und in
    Chrome faul (`human-3`, `human-11` auch eng) spurgleich; Negativtest: drei
    Verfälschungen scheitern an genau der verfälschten Stelle; Referenz-
    Protokolle seit Prompt 02 bitgleich (`c1e990c6…`, `7c3f673f…`,
    `e8213ffe…`, `6737df12…`); Kartenprüfung, Protokoll-Fehlerpfade,
    Versionskonflikt, ohne COOP/COEP wie in 04.
- **Messwerte (odin):** sauberer Build 377,9 s (Maven mit 51 Tests 77,7 s,
  `native-image` 122,2 s bei 5,97 GiB). Modul unverändert 75,3 MiB /
  12,47 MiB Brotli (+6 Klassen); Worker-Bundle 394 KiB / 27,6 KiB Brotli (vorher
  333 / 24 KiB: genaue Prüfer der Spur). `test-engine.sh` 14,9 min, 64 Läufe,
  0 Fehler. Spur je Partie 56–303 Einträge (~2 KB je Eintrag). Kosten der Spur
  (nur in Tests): Partie auf der JVM +4 %, im Wasm (Node) +12 %, Schemaprüfung
  im Client 46 statt 25 ms je Partie, Spitzenspeicher gleich.
- **Erkenntnisse/Abweichungen:**
  - **Behoben – Commander-Partien konnten nicht enden:** Forge zeigt am
    Spielende einen neu erreichten Erfolg per `showImageDialog`;
    `HeadlessGuiBase` warf dort, Guavas EventBus verschluckte die Ausnahme,
    `finishGame` kam nie (von der Bridge laut gemeldet).
  - **Behoben – die erste Spur veränderte das Spiel:** Forges
    `getActivateDescription` (Priorität) setzt über `getAllPossibleAbilities`/
    `canPlay` den aktivierenden Spieler – eine Nebenwirkung. Die Spur fragt es
    nicht mehr ab; `EngineTraceTest` sichert „mit Spur = ohne Spur“.
    **Offen (Prompt 14/16):** `StateBuilder` fragt `action` für jede sichtbare
    Karte ab, auch für Karten der KI; deterministisch und in allen Tests
    gleich, aber die Anzeigeschicht verändert so Forges Objekte. Vorschlag:
    während der Priorität nur für Karten, die Forge als spielbar markiert.
  - **Uhren in Forge:** APINA (`AvailableActions`) hat ein Zeitbudget von 50 ms
    je Karte; läuft es ab, bekommt der Spieler eine Priorität mehr. Nie
    abgelaufen; `test-engine.sh` scheitert, sobald Forge es meldet. Die
    KI-Zeitgrenze (Patch 0002, 5 s) meldet nichts; ein Treffer zeigte sich als
    Spur-Abweichung.
  - Deutsch und Englisch, faul und vollständig: dieselbe Spur (Menschen- und
    KI-Partie) – Forges Spiel hängt nicht an Sprache oder Kartenladen.
  - Stapeltiefe 2 kommt in den Testpartien von der KI (Antwort auf einen
    Zauber); der Testspieler bekommt nach eigenem Zauber wegen APINA meist keine
    Priorität mehr. Doppelblocks brauchen freie Kreaturen (15 Seeds, einer
    passte; mit „nie angreifen“ dauerten zwei von drei Partien 94 bzw. 102
    Züge) → `blocks-double` gibt in Zug 13 auf.
  - Forge fragt nicht, ob der gestorbene Kommandant in die Kommandozone soll;
    Forge prüft Commander-Decks beim Start nicht (nur in seiner Lobby) → für
    Prompt 09/11: die Engine nimmt jedes Deck an. Forge loggt in
    Commander-Partien `findByView … not found` (harmlos, überall gleich).
  - Bewusste Entscheidungen: Aufzeichnen/Nachspielen mit der JVM als Referenz;
    Spur mit verdeckter Information nur auf Wunsch (Protokoll 3, gestreamt, damit
    auch abbrechende Wasm-Partien ihre Spur bis zur Abweichung liefern);
    Testpartien mit `covers` statt eingecheckter Prüfsummen (ein Forge-Update
    ändert die KI und jede Prüfsumme, nicht aber, was eine Partie abdecken
    soll); die Text-Hashes von Prompt 02–04 bleiben als Zusatzprüfung.
- **Weiter mit:** Prompt 06 (OpenMana web/PWA skeleton). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 06 — OpenMana web/PWA skeleton — COMPLETE

- **Commits:** `cfb2252` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Arbeitsbaum, die App meldet `modified: false`), danach Doku
  und dieser Eintrag (2026-09-24). Agent: Claude Code (Claude Opus 5.5), Auftrag
  „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `053103e`.
- **Zusammenfassung:** Die produktive Web-App liegt im Wurzelverzeichnis:
  React 19, Vite 8, TypeScript 7 strict, Tailwind 4 mit shadcn/ui (Stil
  `radix-maia`), React Router 8 – für Vercel geeignet. Sechs Oberflächen
  (Start, Decks, Spielen, Partien, Einstellungen, Credits), deutsch
  beschriftet, Seitenleiste ab 768 px, Tab-Leiste am Handy. Ein eigenes
  OpenMana-Design-System (dunkles Nachtblau und Gold, Cinzel/Inter, Touch-Ziele
  ab 44 px, WCAG-AA-Kontraste, nur shadcn-Bausteine) ist in
  `docs/DESIGN_SYSTEM.md` festgelegt. „Spielen“ lädt auf Knopfdruck die echte
  Forge-Engine über den `EngineClient` und zeigt ihre Startschritte, „Bereit“
  mit den Angaben der Engine oder den Abbruchgrund; es gibt keine erfundenen
  Spieldaten. Der Build übernimmt die Engine nur geprüft (Größe + SHA-256 laut
  Manifest, Protokollversion) inhaltsadressiert unter `/engine/<id>/`.
  COOP/COEP/CORP auf jeder Antwort (Dev, Vorschau, `vercel.json`),
  installierbares Web-App-Manifest, vorläufiges App-Icon unverändert aus Anvil
  mit Herkunftsnachweis. Nichts deployt. Kein Blocker.
- **Wichtige Komponenten:**
  - App: `index.html`, `src/main.tsx`, `src/app/` (Router, `AppShell`,
    `navigation.ts`, Build-Info), `src/routes/` (sechs Oberflächen, 404,
    Fehlerseite), `src/components/` (`Brand`, `Page`, `FactList`, `TextLink`,
    `AppSidebar`), `src/components/ui/` (shadcn/ui + `bottom-nav.tsx` in
    shadcn-Bauweise), `src/index.css` (Tokens)
  - Engine in der App: `src/engine/engine-session.ts` (`EngineSession`, Client
    per dynamischem Import), `engine-session-context.tsx` (eine Sitzung für die
    App, Toast bei Abbruch), `engine-panel.tsx`, `device-support.tsx`,
    `engine-labels.ts` (deutsche Texte zu Boot-Phasen und Abbruchgründen)
  - Build: `vite.config.ts`, `vite/engine-assets.ts` (prüfen, ausliefern,
    `virtual:openmana-engine`; `OPENMANA_ENGINE=omit`, `OPENMANA_ENGINE_DIR`),
    `vite/build-info.ts`, `vite/isolation-headers.ts`, `vite/aliases.ts`
    (einzige Wege nach `engine/`), `vite/watch.ts`; `vercel.json`
  - PWA/Icon: `public/manifest.webmanifest`, `public/icons/`, `favicon.ico`,
    `apple-touch-icon.png`, `assets/app-icon/` (Original + `PROVENANCE.md`),
    `scripts/gen-app-icons.py`
  - Tests/Werkzeug: Vitest (`vitest.config.ts`, `src/**/*.test.*`,
    `vite/*.test.ts`), `.oxlintrc.json`, `scripts/e2e/run.ts`,
    `npm run check`
  - Doku: `docs/DESIGN_SYSTEM.md` (neu, kanonisch für die UI; Bible §13 verweist
    darauf), `docs/implementation/06-web-pwa-skeleton.md`, `README.md`,
    `STATUS.md`, `AGENTS.md` (UI-Regeln), `engine/README.md`
- **Tests (alle bestanden, auf `cfb2252`):**
  - `tsc -b` (App, Tests, Werkzeuge; die importierten Engine-Quellen mit den
    strengen App-Einstellungen), `oxlint` ohne Befund.
  - 82 Vitest-Tests: `EngineSession` 8 (alle Zustände, Abbrüche, späte
    Nachrichten, gescheitertes Nachladen; Testnachrichten gegen das echte
    Schema geprüft), Oberflächen und Engine-Anzeige 17, Design-Token-Kontraste
    20, PWA/Icon 7, Import-Grenze 4, Engine-Artefakte 13, Auslieferung/Header 13.
  - End-to-End (`scripts/e2e/run.ts`, Chrome 153, echte Engine
    `0c82db80023ac0cc`): Header auf jeder Antwort von Vorschau und Dev-Server;
    alle sechs Oberflächen bei 412 × 915 (Touch), 884 × 1104 (Touch),
    1440 × 900 ohne Konsolenfehler, ohne fehlgeschlagene Anfragen, ohne
    Überlauf, `crossOriginIsolated`, richtige Navigation je Größe, axe-core
    0 Befunde (18 Läufe); Engine-Start über Vorschau (Desktop, Handy) und
    Dev-Server bis „Bereit“ (Forge 2.0.15 `ed0333fecb`, Protokoll 3), vorher
    kein Engine-Byte geladen; Chrome ohne Installierbarkeitsfehler; ohne
    COOP/COEP klare Meldung und kein Download.
  - Bestehend: Engine-Protokoll/Client/Worker-Host 80/80 Unit-Tests, erzeugte
    Dateien = Schema, Engine-`tsc`. Frischer Klon ohne Engine: `npm ci` 4 s,
    Build scheitert laut, `OPENMANA_ENGINE=omit` baut, 82 Tests grün.
    `test-engine.sh` nicht erneut gelaufen: `engine/` ist bis auf die README
    unverändert, die ausgelieferten Artefakte sind die geprüften von `0ddfbc3`.
- **Messwerte (odin):** Start-JavaScript 161 KB gzip (App 63 KB, React +
  Router 98 KB, eigener Chunk), CSS 12 KB; Engine-Client samt Schemaprüfern
  39 KB gzip erst beim Engine-Start (vorher lagen die Prüfer im Start-Bundle:
  198 KB). Engine 75,8 MiB (Brotli 12,5 MiB). Engine bis „Bereit“ in der App
  5,0 s bei Lastmittel 5,9, 5,4–6,9 s beim Nachweis (Lastmittel 8–9);
  Engine-Diagnoseseite unter gleicher Last 8,7 s gegen App 9,1 s – die App
  kostet beim Start praktisch nichts. `vite build` 3–5 s, `npm run check` 59 s.
- **Erkenntnisse/Abweichungen:**
  - **Behoben, Dev-Server-Absturz:** Vite beobachtete auch Forges Quellen und
    den Engine-Bauordner und scheiterte mit `ENOSPC` (alle Datei-Beobachter
    des Systems belegt). Unter `engine/` werden jetzt nur `protocol/` und
    `client/` beobachtet.
  - Forges `forgeVersion` ist in diesem Build „GIT“; die App zeigt
    `forgeVersionCode` (2.0.15).
  - Forge schreibt beim vollständigen Kartenladen 21 bekannte Upstream-
    Datenhinweise als Fehler in die Worker-Konsole (Karten ohne Set,
    „Upcoming set Star Trek (TRK)“); der E2E-Test hält Worker-Ausgaben fest und
    wertet nur Fehler der Seite.
  - Die Ajv-Schemaprüfer (383 KB) landeten über den Protokoll-Index im
    Start-Bundle; jetzt importiert die erste Seite nur `features`/`constants`
    direkt, der Client kommt per dynamischem Import.
  - **Bewusste Entscheidungen:** shadcn/ui als Grundlage des Design-Systems
    (Vorgabe des Projektbesitzers für Web-Oberflächen), nur dunkles Theme,
    deutsche Oberfläche mit englischen Routen, Tab-Leiste mit vier Zielen
    (Einstellungen hinter dem Zahnrad), Engine nur auf Knopfdruck (Vorwärmen:
    11), **kein Service Worker vor Prompt 25** (er müsste COOP/COEP erhalten und
    die Engine sicher cachen; Chrome installiert auch ohne), Engine im Build
    aus dem lokalen `engine/build/dist` (Vercel-Artefakt: 31; auf Vercel
    scheitert der Build bis dahin bewusst laut), Credits ohne Scryfall bis 08
    und ohne vollständige Lizenztexte bis 27 (GraalVM-Frage als offen benannt),
    oxlint statt ESLint (typescript-eslint kann TypeScript 7 noch nicht),
    Schriften gebündelt statt CDN.
  - Offen für spätere Prompts: Offline/Engine-Cache/Updates (25),
    KI-Profil/Kartensprache/reduzierte Bewegung (12), echte Vercel-Auslieferung
    samt Engine und Dateivorrang der Rewrites (31), Fold7-Messung (Frage 5 –
    mit einer ausgelieferten Version reicht „Engine laden“ auf dem Gerät),
    Lizenzen und Icon-Prüfung (27), Android-Hülle (28).
- **Weiter mit:** Prompt 07 (IndexedDB local data layer). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 07 — IndexedDB local data layer — COMPLETE

- **Commits:** `c9ee901` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Arbeitsbaum, die App meldet keine lokalen Änderungen),
  danach Doku und dieser Eintrag (2026-09-25). Agent: Claude Code (Claude Opus
  5.5), Auftrag „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt,
  danach Stopp). Status-Commit zu Beginn: `1e7b3b2`.
- **Zusammenfassung:** Versionierte IndexedDB-Datenbank `openmana`
  (Schema-Version 1) mit Stores für Decks, Einstellungen, Partien + Verlauf,
  Scryfall-Kartendaten, Zwischenspeicher-Index und eigene Metadaten; nie
  `localStorage`, kein Konto, keine Cloud. Eintragsformate und
  Sicherungsformat stehen in **einem JSON Schema**, Typen und Prüfer werden
  erzeugt (wie beim Protokoll); jeder Eintrag wird vor dem Schreiben geprüft,
  beschädigte gespeicherte werden angezeigt. **Migrationen** laufen der Reihe
  nach in einer Transaktion (scheitert eine, bleibt alles unverändert) und
  bringen auch ältere Sicherungen auf Stand. Jeder Schreibvorgang ist **alles
  oder nichts** (`durability: "strict"`), Änderungen werden erst nach dem
  Festschreiben gemeldet, auch an andere Tabs. Fehler (kein IndexedDB, neuere
  Version, beschädigter Aufbau, gescheiterte Migration, voller Speicher,
  anderer Tab, gelöschte Websitedaten) erscheinen mit deutscher Meldung und
  passender Aktion. **Sicherung** als gzip-JSON-Lines (Kopf, Einträge,
  Endzeile mit Zahlen), Laden prüft alles vorab und importiert
  Zusammenführen/Ersetzen in einer Transaktion. **Speicherplatz** laut Browser
  mit Warnung und Vorab-Prüfung; **Prüfung** aller Einträge mit Entfernen nach
  Bestätigung. Kein Blocker.
- **Wichtige Komponenten:**
  - Schema und Erzeugung: `src/storage/schema/local-data.schema.json`,
    `scripts/generate-storage.ts` (`npm run generate`, `--check` in `check`
    und `build`), `src/storage/generated/*`
  - Datenschicht: `schema.ts` (Stores, Aufbau, Rollen, Prüfung),
    `migrations.ts`, `open.ts`, `database.ts` (`LocalDatabase`,
    `PendingRequests`), `errors.ts` (`StorageError`), `quota.ts`,
    `backup.ts`, `integrity.ts`, `decks.ts`, `matches.ts`, `settings.ts`,
    `overview.ts`, `storage-session.ts` (Zustand, Tabs, Zurücksetzen),
    `storage-context.tsx` (`StorageProvider`, `useStorageQuery`)
  - Oberfläche: `local-data-card.tsx` (Einstellungen), `backup-import-dialog.tsx`,
    `storage-alert.tsx`, `storage-labels.ts`; Decks-, Partien- und
    Spielen-Seite lesen die Datenbank; shadcn `Dialog`, `AlertDialog`,
    `RadioGroup`, `Field`, `Label` (Dialog scrollt im Bildschirm)
  - Abhängigkeiten: `idb` 8.0.3 (Laufzeit), `fake-indexeddb` 6.2.5, `ajv`
    8.20.0, `json-schema-to-typescript` 16.0.0 (Entwicklung)
  - Tests/Werkzeug: `src/storage/*.test.ts(x)`, `src/app/local-first.test.ts`,
    `src/test/storage-fixtures.ts`, Test-Setup mit frischer IndexedDB je Test;
    E2E-Abschnitte „Local data“ und „storage quota“ in `scripts/e2e/run.ts`
  - Doku: `docs/implementation/07-indexeddb-storage.md` (Format, Regeln,
    Nachweise), `AGENTS.md` (Regeln für lokale Daten), `docs/DESIGN_SYSTEM.md`,
    `README.md`, `STATUS.md`, Bible §5 (Verweis)
- **Tests (alle bestanden, auf `c9ee901`):**
  - Erzeugte Dateien = Schema, `tsc -b`, `oxlint` ohne Befund.
  - **179 Vitest-Tests** (82 bestehende + 97 neue): Schema 12, Migrationen 9
    (ausgedachte Versionen 1 → 2 → 3, gescheiterte Migration ändert nichts),
    Öffnen 9 (neuere Version, falscher Aufbau, blockiert, anderer Tab
    aktualisiert/löscht, Browser schließt), Transaktionen 13 (alles oder
    nichts, eingespeister `QuotaExceededError`), Sicherung 21 (Format,
    Rundreise, jede Ablehnung, ältere Schema-Version, Zusammenführen/Ersetzen,
    Import alles oder nichts, Platzprüfung), Prüfung 3, Speicherplatz 5,
    Sitzung 10 (inkl. Änderungen zwischen Tabs), Oberfläche 13, local-first 2.
  - **End-to-End** (Chrome 153, echte Engine `0c82db80023ac0cc`, echte
    IndexedDB, 0 Fehler, `npm run check` 75,5 s): alle bisherigen Prüfungen
    (18 axe-Läufe ohne Befund, Engine-Start Vorschau/Handy/Dev-Server, PWA,
    ohne Isolation) plus: neue Datenbank Version 1, Sicherung laden
    (Zusammenführen), Daten nach Neuladen auf Decks/Partien/Spielen, echter
    Download (Kopf Schema 1, Endzeile 2/1/1/2), Import dieser Datei in ein
    zweites leeres Profil = dieselben Einträge, Textdatei und abgeschnittene
    Sicherung abgelehnt ohne Änderung, beschädigter Eintrag angezeigt, gefunden
    und nach Bestätigung entfernt, anderer Tab öffnet Version 2 (Meldung, dann
    Ablehnung statt „leer“), Websitedaten gelöscht während offen (Meldung,
    danach leere Datenbank), Speichergrenze per DevTools (Warnung, 400-Deck-
    Import gesperrt, nichts geschrieben); axe für Dialog (Desktop, Handy) und
    Prüfbericht ohne Befund.
  - Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, 80/80
    Unit-Tests. Frischer Klon: `npm ci`, Build ohne Engine scheitert laut,
    `OPENMANA_ENGINE=omit` baut, 179 Tests dreimal grün.
- **Messwerte (odin, Lastmittel 8–17 durch andere Sitzungen):** Start-JavaScript
  161 → **192 KB gzip** (App-Code 63 → 94 KB; davon erzeugte Prüfer 8,7 KB,
  Speichermodule und Dialoge ~11 KB, `idb` 1,3 KB); Beispielsicherung
  (2 Decks, 1 Einstellung, 1 Partie, 2 Verlaufszeilen) 882 Bytes.
- **Erkenntnisse/Abweichungen:**
  - **Chrome 153 meldet eine pauschale Quota** (`StaticStorageQuota`:
    inkognito 3 GiB, festes Profil Nutzung + 8 GiB), DevTools'
    Quota-Überschreibung wirkt nur mit abgeschalteter Funktion auf
    `estimate()` – und **IndexedDB schreibt trotzdem über sie hinaus**. Den
    echten `QuotaExceededError` decken deshalb Unit-Tests (eingespeist) ab;
    die App nennt die Angaben „Schätzungen des Browsers“.
  - **Zeitabhängiger Test behoben:** sonner spielt aktive Toasts jedem neuen
    Toaster erneut vor; das Test-Setup räumt Toasts jetzt nach jedem Test ab.
  - axe `button-name` für Radix-Radioknöpfe in Labels → `aria-labelledby`;
    unbehandelte Ablehnungen (Upgrade-`done`, viele Anfragen nach einem
    Fehler) werden aufgefangen.
  - **Bewusste Entscheidungen:** `idb` statt Dexie; eine Schema-Version für
    alle Einträge (an der Datenbank und im Sicherungskopf statt je Eintrag);
    JSON Lines + gzip statt einer JSON-Datei; Zwischenspeicher und Metadaten
    nicht in Sicherungen; Aufbau von Partien (22) und Kartendaten (08) jetzt
    festgelegt, Anpassung per Migration; noch keine Produkt-Einstellungen
    (12); kein `persist()` vor 25; schlichte Listen auf Decks/Partien, weil
    eine geladene Sicherung nicht als „leer“ erscheinen darf; Zurücksetzen nur
    in Fehlerzuständen mit Bestätigung; Datenschicht im Start-Bundle (+31 KB
    gzip), Aufteilen nach Messung am Handy (24/25).
  - **Empfehlung:** Vor der ersten Migration von Nutzerdaten eine
    Rettungssicherung im Fehlerzustand „ließen sich nicht auf diese Version
    bringen“ anbieten (Doku §12).
- **Weiter mit:** Prompt 08 (Scryfall card data). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 08 — Scryfall card data — COMPLETE

- **Commits:** `45f57d7` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Arbeitsbaum, die App meldet keine lokalen Änderungen),
  danach Doku und dieser Eintrag (2026-09-25). Agent: Claude Code (Claude Opus
  5.5), Auftrag „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt,
  danach Stopp). Status-Commit zu Beginn: `544f840`.
- **Zusammenfassung:** Ein **Kartenkatalog** aus Scryfalls Massendaten
  (`all_cards`, jeder Druck in jeder Sprache) und Forges Kartendatenbank,
  zur Bauzeit erzeugt (`npm run cards:build`, `cards/`), wie die Engine
  geprüft ausgeliefert (`/cards/<id>/`, Größe + SHA-256 + gleicher
  Forge-Commit wie die Engine) und im Browser **einmal je Version** in
  IndexedDB eingerichtet. Je Karte (Oracle-Identität): englische Seiten,
  gedruckter deutscher Text (nur wirklich übersetzte Felder), Standarddrucke
  (deutsches Bild, wo Scryfall ein echtes hat, sonst englisch), Aliasse,
  Namensschlüssel und die **Forge-Namen** – 33 740 von 33 978 Forge-Skripten
  zugeordnet, 238 ohne Scryfall-Daten begründet (230 „A-…“, 8 gelistet), eine
  neue unerklärte Lücke stoppt den Bau. Danach: Namenssuche deutsch/englisch,
  Engine-Schlüssel (Seiten, Spielsteine), Anzeige deutsch mit
  gekennzeichnetem englischem Rückfall, doppelseitige Karten, bestimmte Drucke
  per API (Scryfalls Ratenlimits, 30 Tage gemerkt) – nie eine API-Anfrage je
  angezeigter Karte. Bilder direkt von Scryfall im **CORS-Modus** (wegen COEP,
  im E2E belegt), nie beschnitten. Einstellungen „Kartendaten“, „Karte
  nachschlagen“, Credits. Datenbank Schema-Version 2. Kein Blocker.
- **Wichtige Komponenten:**
  - Katalog-Bau: `cards/scripts/build-catalog.ts` (Eingaben holen und
    zwischenspeichern, prüfen, schreiben), `catalog.ts` (`CatalogBuilder`:
    Druckwahl, deutscher Text, Aliasse, Namensschlüssel, Forge-Abgleich über
    Name/Seite/Alias/Set-Datei), `forge-cards.ts` (Forge-Skripte inkl.
    `CopyFaceFrom`, Set-Dateien), `scryfall-bulk.ts`,
    `cards/forge-unmatched.json`, `cards/README.md`, `cards/fixtures/`
  - Scryfall-Grenze: `src/cards/scryfall/scryfall.schema.json` (→ erzeugte
    Prüfer), `scryfall-print.ts`, `images.ts` (URL-Regel), `names.ts`
    (Namensschlüssel) – von Bau und App gemeinsam genutzt
  - App: `catalog-install.ts` (erst beim Einrichten geladen), `catalog-state.ts`,
    `card-lookup.ts`, `card-display.ts`, `scryfall-client.ts`, `prints.ts`,
    `card-catalog-context.tsx`, `card-data-card.tsx`, `card-lookup-dialog.tsx`,
    `card-details.tsx`, `errors.ts`, `card-labels.ts`
  - UI-Bausteine: `CardPicture` (shadcn-Bauweise), `AspectRatio`, `Progress`
    (Registry); Credits-Karte „Kartendaten und Kartenbilder“
  - Build: `vite/card-assets.ts` (`virtual:openmana-cards`,
    `OPENMANA_CARDS=omit`, `OPENMANA_CARDS_DIR`), `vercel.json` (`/cards/`
    immutable, kein SPA-Rückfall), `vite/watch.ts`
  - Datenbank: Migration 2 (`scryfallCards` nach Oracle-Id, neu
    `scryfallPrints`, `scryfallSets`, `forgeOnlyCards`, `cacheIndex` geleert),
    Katalog-Dateiformat im Schema; `scripts/generate-schemas.ts` (vorher
    `generate-storage.ts`, jetzt drei Ziele)
  - Doku: `docs/implementation/08-scryfall-data.md`, `cards/README.md`,
    `AGENTS.md` (Regeln für Kartendaten), `docs/DESIGN_SYSTEM.md`, Bible §4,
    `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `45f57d7`):**
  - Erzeugte Dateien = Schemas (lokale Daten, Katalogzeilen, Scryfall),
    `tsc -b`, `oxlint` ohne Befund.
  - **298 Vitest-Tests** (179 bestehende + 119 neue) auf einem kleinen
    **echten** Katalog (46 Scryfall-Kartenobjekte, echte Forge-Skripte):
    Katalog-Bau 19, Forge-Leser 6, Namen 16, Bild-URLs 3, Einrichten 17,
    Nachschlagen 12, Anzeige 11, API-Client 6, Drucke 6, Oberfläche 10,
    Vite-Plugin 11, Migration 1 → 2 +1, Deployment +1.
  - **End-to-End** (`npm run check` 1:48 min, Chrome 153, echte Engine
    `0c82db80023ac0cc`, echter Katalog `cacfe9aca953cd50`, 0 Fehler): alle
    bisherigen Prüfungen plus Kartendaten – nichts ungefragt geladen;
    Einrichten in echte IndexedDB 4,8 s (Vorschau, vom Browser entpackt) bzw.
    4,9 s inkl. Abbruch (wie Vercel, `application/gzip`), 36 156 Karten,
    66 MB; beschädigter Download abgelehnt; echte Scryfall-Bilder unter COEP
    (deutsch, Rückseite, nur englisch), Forge-only, unbekannt, Handy, Bilder
    offline mit Textersatz, **COEP-Nachweis** (ohne CORS-Modus blockiert),
    „Daten prüfen“ mit Katalog 1,8 s, axe 0 Befunde.
  - Katalog-Bau auf dem Commit 41,5 s; bytegleich auch unter anderer Sprache.
    Engine unverändert: Protokoll-Dateien = Schema, `tsc`, 80/80. Frischer
    Klon: `npm ci`, Build ohne Engine/Katalog scheitert laut, `omit` baut,
    298 Tests grün.
- **Messwerte (odin):** Katalog 10 948 463 Bytes gzip (45,6 MB entpackt,
  37 448 Zeilen): 36 156 Karten, 30 849 mit deutschem Text, 24 929 mit
  deutschem Bild, 1 052 Sets; Bau ~42 s (einmalig ~390 MB Download).
  Start-JavaScript 192 → 206,7 KB gzip (+14,7 KB), Einrichten-Code samt
  Katalog-Prüfern 8,2 KB gzip nachgeladen.
- **Erkenntnisse/Abweichungen:**
  - **Architektur:** Katalog zur Bauzeit statt Laufzeit-Download – deutsche
    Texte gibt es nur in `all_cards` (393 MB gzip), im Browser nicht machbar;
    die API je Anzeige verbietet Scryfall. Der Katalog liegt nicht im Git und
    ist kein veröffentlichter Datensatz.
  - **Scryfall-Daten:** Bulk-Dateien jetzt `jsonl.gz`; 19 % der deutschen
    Drucke haben nur Platzhalterbilder (zählen nie als deutsch); manche
    deutschen Drucke tragen englische „gedruckte“ Texte (zählt nur, was sich
    unterscheidet); Scryfall führt die Arena-„A-“-Karten nicht mehr;
    Universes-Beyond-Namen sind `printed_name` (Aliasse).
  - **Ratenlimits 2026:** Search/Named/Random/Collection nur 2 je Sekunde,
    `/cards/manifest` 10 je Minute; 429 sperrt 30 s – im Client erzwungen und
    getestet.
  - **Vites Vorschau** liefert `.gz` mit `Content-Encoding: gzip` (Browser
    entpackt); die App prüft beide Formen. Vercel: `application/gzip`.
  - **Katalog an Forges Stand gebunden** (gleicher Commit wie die Engine,
    Build prüft) → Forge-Update = Katalog neu bauen (26).
  - Ajv-Prüfer nicht tree-shakebar → Katalogzeilen-Prüfer als eigenes Modul,
    erst beim Einrichten geladen.
  - Offen mit Ziel: Import (09), automatisches Einrichten beim Import/Spiel
    (09/11), Spielkarten anzeigen (13/14/20), Manasymbole (14), Sprache als
    Einstellung (12), Offline/Update (25), Vercel-Lieferung des Katalogs (31).
- **Weiter mit:** Prompt 09 (Arena deck import). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 09 — Arena deck import — IN_PROGRESS

- Begonnen am 2026-09-25 von Claude Code (Claude Opus 5.5), Auftrag
  „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).

## Hinweise für spätere Prompts

### Vercel und Android (Stand 2026-09-25, für 28 und 31)

Der Projektbesitzer hat Vercel-Deploy und Android-App am 2026-09-25 bewusst
zurückgestellt, bis die Queue dort ankommt („geradeaus weiter“). Damit
nichts neu recherchiert werden muss:

- **Vercel-Projekt `openmana`** existiert, verbunden mit GitHub `main` →
  Production. Jeder Push baut; seit Prompt 06 scheitert der Build absichtlich
  (keine Engine auf Vercel). So lassen, bis 31 die Engine liefert.
- **Zugang:** Die automatisch erzeugten Vercel-Adressen verlangen den
  Vercel-Login (Einstellung „all except custom domains“, wie bei den anderen
  Projekten des Besitzers); öffentlich ist nur die kurze Adresse. Gewollt ist
  **`openmana.vercel.app`, öffentlich und ohne jedes Login** – jeder öffnet die
  Seite und spielt mit eigenen, lokal gespeicherten Decks. Am 2026-09-25 stand
  sie noch nicht in der Domainliste des Projekts (Aufruf: 404 NOT_FOUND) → in
  31 prüfen und zuweisen. Öffentlich erst nach Prompt 27 (GPL-Quelltext,
  GraalVM-Bedingungen); bis dahin genügt eine geschützte Prüfung (so auch 31).
- **Kartenkatalog auf Vercel (31, seit Prompt 08):** Der Build braucht neben
  der Engine auch den Kartenkatalog (`cards/build/dist`, ~10,4 MB,
  `npm run cards:build`); ohne scheitert er ebenso laut. Der Katalog hängt am
  Forge-Commit der Engine (der Build prüft das) und lässt sich deshalb mit
  derselben Engine-Lieferung als GitHub-Release-Asset ablegen; alternativ im
  Vercel-Build selbst erzeugen (lädt ~390 MB von Scryfalls Datenserver, ohne
  Ratenlimit, ~45 s, braucht aber Forges Kartenliste aus `engine/forge`).
- **Engine auf Vercel (31), vom Besitzer so gewünscht:** Die Oberfläche baut
  Vercel selbst; die Engine nicht (GraalVM, ~6 GB RAM, ~6 min, ändert sich nur
  mit Forge). Die fertige Engine wird je Engine-Stand als **GitHub-Release-Asset**
  abgelegt; der Vercel-Build lädt die gepinnte Version, prüft SHA-256 und legt
  sie nach `engine/build/dist`. Das private Repo braucht dafür einen eng
  begrenzten GitHub-Lesetoken (nur dieses Repo, Inhalte lesen) als
  Vercel-Umgebungsvariable. Vercels eigener Dateispeicher (Blob) ginge auch,
  kostet aber je Build ~80 MB Kontingent.
- **Android (28): nicht per Capacitor/WebView** (kein `SharedArrayBuffer`, die
  Engine startet dort nicht; Research `OPENMANA_ENGINE_PLAN.md` §8), sondern
  **TWA** (Trusted Web Activity): eine kleine APK, die `openmana.vercel.app` in
  Chrome öffnet; Vollbild nur mit `/.well-known/assetlinks.json` (SHA-256 des
  Signaturzertifikats) auf der öffentlichen Seite. Die TWA braucht die Seite im
  Netz → **28 muss die Engine-Lieferung aus 31 vorziehen** oder nach 31 laufen.
- **Weg in Warehouse** wie bei den anderen Apps des Besitzers; Vorlage ist
  `scripts/android-apk.sh` im THRENFALL-Repo (Release-Signatur mit eigenem
  Schlüssel, APK und Katalogeintrag für Warehouse, Index neu erzeugen). Dazu
  im Warehouse-Repo der App-Eintrag, das Paket in den Manifest-`queries`, das
  Icon und ein neuer Warehouse-Build, und im Toride-Compose der Ordner-Mount
  samt Neustart in derselben Runde (sonst liefert der Download 404).

