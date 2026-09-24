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
| Aktuell ausgeführt | **05 — JVM/WASM differential tests** |
| Nächster Prompt | 06 — OpenMana web/PWA skeleton (erst nach 05 = COMPLETE) |
| Zuletzt abgeschlossen | 04 — Forge resources and card scripts (`fbcba6e`) |
| Ausführender Agent | Claude Code (Claude Opus 5.5), Sitzung vom 2026-09-24 (Lauf über `prompts/naechster-schritt.md`) |
| Letzte Aktualisierung | 2026-09-24 |

## Übersicht

| # | Prompt | Status | Commit |
|---|---|---|---|
| 00 | [Research: ManaBrew / Forge WebAssembly](queue/00-research-manabrew-forge-wasm.md) | COMPLETE | `681ce0a` |
| 01 | [Forge WASM engine spike](queue/01-engine-spike.md) | COMPLETE | `b64835a` |
| 02 | [Anvil bridge single-thread spike](queue/02-anvil-bridge-single-thread.md) | COMPLETE | `5a2ed62` |
| 03 | [Worker transport and protocol](queue/03-worker-transport-protocol.md) | COMPLETE | `1e8febf` |
| 04 | [Forge resources and card scripts](queue/04-forge-resources-card-scripts.md) | COMPLETE | `fbcba6e` |
| 05 | [JVM/WASM differential tests](queue/05-engine-differential-tests.md) | IN_PROGRESS | – |
| 06 | [OpenMana web/PWA skeleton](queue/06-web-pwa-skeleton.md) | PENDING | – |
| 07 | [IndexedDB local data layer](queue/07-indexeddb-storage.md) | PENDING | – |
| 08 | [Scryfall card data](queue/08-scryfall-data.md) | PENDING | – |
| 09 | [Arena deck import](queue/09-arena-deck-import.md) | PENDING | – |
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

### 05 — JVM/WASM differential tests — IN_PROGRESS

- Begonnen am 2026-09-24 von Claude Code (Claude Opus 5.5), Auftrag
  „Führe prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
