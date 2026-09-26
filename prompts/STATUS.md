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
  5. alles committed ist. **Nicht pushen** (dev0gig, 2026-09-25): Jeder Push auf
     `main` löst ein Vercel-Deployment aus und verbraucht sein Kontingent;
     gepusht wird nur auf seinen ausdrücklichen Wunsch.
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
| Aktuell ausgeführt | – (keiner; nach 16 wie vorgesehen gestoppt) |
| Nächster Prompt | **17 — Targeting and cost payment** (PENDING, nicht begonnen) |
| Zuletzt abgeschlossen | 16 — Priority, stack and phases (`492e07d`) |
| Ausführender Agent | Claude Code (Claude Opus 5.5), Sitzung vom 2026-09-26 (Dropzone-Standalone-Lauf, Regeln aus `prompts/naechster-schritt.md`) |
| Letzte Aktualisierung | 2026-09-26 |

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
| 09 | [Arena deck import](queue/09-arena-deck-import.md) | COMPLETE | `c7bb533` |
| 10 | [Deck library](queue/10-deck-library.md) | COMPLETE | `7aab76f` |
| 11 | [Game session foundation](queue/11-game-session.md) | COMPLETE | `679fbfb` |
| 12 | [AI profiles and settings](queue/12-ai-profiles-settings.md) | COMPLETE | `e618079` |
| 13 | [Battlefield foundation](queue/13-battlefield-foundation.md) | COMPLETE | `eb8e0ab` |
| 14 | [Cards, hand and safe interaction](queue/14-card-hand-interactions.md) | COMPLETE | `1b3e3b6` |
| 15 | [Forge decision UI](queue/15-forge-decisions.md) | COMPLETE | `cf4d2ad` |
| 16 | [Priority, stack and phases](queue/16-priority-stack-phases.md) | COMPLETE | `492e07d` |
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

### 09 — Arena deck import — COMPLETE

- **Commits:** `c7bb533` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Arbeitsbaum), danach Doku und dieser Eintrag (2026-09-25).
  Agent: Claude Code (Claude Opus 5.5), Auftrag „Führe
  prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `75e4f71`.
- **Zusammenfassung:** Decks → „Arena-Deck importieren“ (`/decks/import`,
  nachgeladen): Arena-Liste einfügen oder Textdatei öffnen, prüfen, offene
  Zeilen klären, Namen vergeben, speichern. Gelesen wird Arenas Format
  vollständig (Deck, Sideboard, Commander, Companion, About/Name, Anzahl, Set
  + Sammlernummer, Arenas Regel für Blöcke ohne Überschrift); jede andere
  Zeile ist ein Problem mit Zeilennummer. Jede Zeile wird über den
  Kartenkatalog auf dem Gerät der Karte zugeordnet, die Forge kennt (Rang:
  eigener/Forge-Name, Vorderseite, spätere Seite, Alias, deutscher Name;
  Forge-only-Karten wie Arenas „A-“-Karten; Arenas Setcodes → Scryfalls).
  Scryfalls API **nur** für Zeilen, die der Katalog nicht entscheidet und die
  einen Druck nennen (andere Sprachen, 32 Namen mehrerer spielbarer Karten,
  24 davon alte deutsche Doppelübersetzungen wie „Zwang“ = Duress/Coercion);
  sonst wählt der Spieler – nie geraten. Speichern erst, wenn jede Zeile
  geklärt ist (korrigiert, gewählt oder bewusst weggelassen) und das Deck
  einen Namen hat; die Liste bleibt unverändert beim Deck. Gefährte ins
  Sideboard (dort sucht Forge ihn), Kommandeur → `commander`. Keine
  Legalitätsprüfung (Forge entscheidet). Im E2E-Test startet die **echte
  Forge-Engine** mit jedem importierten Deck eine Partie. Kein Blocker.
- **Wichtige Komponenten:**
  - Import: `src/decks/arena-list.ts` (Parser, rein), `deck-resolve.ts`
    (Zuordnung, Bericht je Zeile, `decideName`), `deck-plan.ts` (was
    gespeichert wird, Sperren, `deckRecordFrom`), `deck-import-labels.ts`,
    `deck-import-page.tsx`, `import-report.tsx`, `card-choice-dialog.tsx`,
    `fixtures/` (Arena-Beispiellisten + README)
  - `src/cards/scryfall-access.ts` (der eine Scryfall-Client der App, erst bei
    der ersten Nachfrage geladen); `ScryfallClient` holt `fetch` jetzt je
    Anfrage
  - Oberfläche: Route `decks/import` mit `lazy` + `HydrateFallback`
    (`src/routes/page-loading.tsx`), Decks-Seite mit Import-Link, Startseite,
    Kartendaten-Einrichten auch auf der Import-Seite (`InstallButton`,
    `InstallProgressView` exportiert), shadcn `Textarea` (Registry)
  - Schema: Beschreibung von `DeckCard.set` (Scryfalls Setcode) – keine
    Formatänderung, Schema-Version bleibt 2
  - E2E: Abschnitt 8 „Deck import“ in `scripts/e2e/run.ts`,
    `scripts/e2e/engine-decks.ts` (Deck in der echten Engine anspielen)
  - Doku: `docs/implementation/09-arena-deck-import.md`, `AGENTS.md`
    (Regeln für den Deck-Import, ein Scryfall-Client), `docs/DESIGN_SYSTEM.md`
    (`Textarea`, `PageLoading`), Bible §5 (Verweis), `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `c7bb533`):**
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund.
  - **352 Vitest-Tests** (298 bestehende + 54 neue): Parser 16 (Arena-Exporte
    englisch/Gefährte/Brawl/deutsch mit BOM und CRLF, Arenas Regel ohne
    Überschrift, Deckseiten-Varianten, jede unlesbare Zeile mit Nummer),
    Zuordnung 18 (kleiner echter Katalog: englisch, deutsch, Rückseiten,
    Aliasse, Forge-Namen, nicht spielbar, Spielstein, unbekannt, „A-“,
    mehrdeutig + Wahl, Setcodes, Druck identifiziert/entscheidet/andere
    Karte/unbekannt/offline, keine unnötige Anfrage; die Regeln einzeln),
    Deck-Aufbau 11 (Addieren, Drucke, Scryfall-Id, Gefährte, Commander,
    Sperren, Weglassen, leeres Hauptdeck, gültiger `DeckRecord`), Oberfläche 9
    (Weg hinein, Kartendaten einrichten, Speichern bis in die Datenbank,
    wählen/weglassen/wieder aufnehmen, Commander, fremdsprachiger Name über
    Scryfall, Scryfall offline + erneut prüfen, Textdatei, Liste bearbeiten).
  - **End-to-End** (`npm run check` 188 s, Chrome 153, echte Engine
    `0c82db80023ac0cc`, echter Katalog `cacfe9aca953cd50`, 0 Fehler): alle
    bisherigen Prüfungen, die Import-Seite in drei Größen (axe 0, kein
    Überlauf), plus Abschnitt 8: Kartendaten auf der Import-Seite
    eingerichtet (4,8 s); englische Arena-Liste (21 Zeilen) in 0,12 s geklärt,
    ohne jede Scryfall-Anfrage (`DAR 254` → `dom 254`, Hansk → Forge „Daryl,
    Hunter of Walkers“, „A-Luminarch Aspirant“, Gefährte im Sideboard);
    deutsche Liste: „Zwang“ gewählt (Duress), „Wucherndes Wachstum (M10) 201“
    vom Druck entschieden, „Foudre (M11) 149“ über Scryfall erkannt und mit
    „Blitzschlag“ addiert, Alchemy-Karte weggelassen (1,3 s inkl. 1×
    `/cards/collection` + 2 deutsche Fassungen, alle 200); Commander-Liste
    als Datei; nach Neuladen alle Decks, IndexedDB-Datensätze wie erwartet;
    axe 0 (Bericht, offene Zeilen, Handy, Auswahldialog); **jedes Deck in der
    echten Forge-Engine** (Wasm in Node): kein „deck-rejected“, `game.started`
    mit genau den Karten des Decks, Aufgabe beendet die Partie.
  - Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, 80/80.
    Frischer Klon: `npm ci`, Build ohne Engine scheitert laut, mit `omit`
    baut er, 352 Tests grün.
- **Messwerte (odin, Lastmittel 5–9 durch andere Sitzungen):** Start-JavaScript
  206,7 → **207,7 KB gzip** (App-Code 107,4 → 108,4 KB); Import-Seite 13,2 KB
  gzip und Scryfall-Client 5,1 KB gzip nur bei Bedarf. Engine in Node bereit
  nach 9,6–12,0 s, Partie 70–152 ms danach gestartet.
- **Erkenntnisse/Abweichungen:**
  - **Deutsche Arena-Clients exportieren deutsche Namen**, Arena übersetzt
    einige Karten selbst; im Katalog tragen 32 Namen mehrere spielbare Karten
    → Druck oder Spieler entscheidet. Die neue „prepare“-Kartenart
    überschneidet sich mit bekannten Kartennamen (26 Fälle) → Rang „eigener
    Name vor Seitenname“.
  - **Forge nimmt die Katalog-Namen an** (Vorderseiten, Split „ // “,
    „A-“-Karten, Universes Beyond unter dem gedruckten Namen) – in der echten
    Engine belegt.
  - **Behoben:** `ScryfallClient` band `fetch` beim Anlegen (für einen
    app-weiten Client falsch); React Router warnte beim Direktaufruf der
    nachgeladenen Route ohne `HydrateFallback` (E2E fand es) → `PageLoading`.
  - **Bewusste Entscheidungen:** keine Legalitätsprüfung (Forge; Befund 05:
    Forge prüft beim Start nicht → Vorschlag für 11: Forges
    `DeckFormat.getDeckConformanceProblem` über die Engine abfragen); Gefährte
    ohne eigenes Feld (liegt im Sideboard, Liste bleibt beim Deck; Feld erst,
    wenn 10 es braucht); `DeckCard.set` = Scryfalls Setcode; „Weglassen“ ist
    eine sichtbare Entscheidung des Spielers; Scryfall nur für offene Zeilen
    mit Druck; „4x“ und die deutschen Abschnittsnamen „Kommandeur“/„Gefährte“
    toleriert (Letztere unbestätigt); eigene Seite statt Dialog, nachgeladen.
  - Offen mit Ziel: Deck ansehen/umbenennen/erneut importieren/exportieren,
    Bilder der genannten Drucke (10); Legalität vor Spielstart (11);
    deutsche Abschnittsnamen und „A-“-Karten in deutschen Exporten mit einem
    echten deutschen Export bestätigen (bei Gelegenheit); Manasymbole (14).
- **Weiter mit:** Prompt 10 (Deck library). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 10 — Deck library — COMPLETE

- **Commits:** `7aab76f` Implementierung, `c2f2084` (Texte des Imports wieder
  nur mit der Import-Seite geladen), `58aaa58` (zeitabhängiger Test aus 08
  behoben); alle Nachweise liefen auf `58aaa58` (sauberer Arbeitsbaum, die App
  meldet keine lokalen Änderungen), danach Doku und dieser Eintrag
  (2026-09-25). Agent: Claude Code (Claude Opus 5.5), Auftrag „Führe
  prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `9dfd76f`.
- **Zusammenfassung:** Die importierten Decks bilden eine **Bibliothek** auf
  dem Gerät. **Liste** (`/decks`): Titelkarte, Format, Kartenzahlen,
  Kommandeur, Gefährte, wie viele Karten nicht ganz deutsch sind; **Suche**
  nach Deckname oder irgendeinem Kartennamen darin (deutsch, englisch,
  Kartenseite, Forges Name), **Formatfilter**, **Sortierung** (Name, zuletzt
  geändert, zuletzt angelegt) – in der Adresse. **Details** (`/decks/:id`,
  nachgeladen): Kommandeur, Gefährte, Hauptdeck, Sideboard Karte für Karte,
  Überblick, **Kartensprache** (deutsch / teilweise englisch / englisch / nur
  Forge / ohne Kartendaten), volle Kartenansicht; die **genannten Drucke**, die
  der Katalog nicht hat, einmal bei Scryfall (deutsch, wo es sie deutsch gibt).
  **Aktionen:** spielen, umbenennen, duplizieren, **exportieren** (Arena-Liste
  mit Forges Namen – wieder importierbar ohne offene Zeile und ohne
  Scryfall-Anfrage – oder die importierte Liste unverändert; Zwischenablage
  oder Textdatei), **erneut importieren** (gespeicherte Liste und Name,
  frühere Wahl mehrdeutiger Namen bleibt, Ersetzen bestätigt, Id und Anlage
  bleiben), als Deck der KI wählen, **löschen** (bestätigt). Am Handy steht die
  Hauptaktion in einer festen Leiste über der Tab-Leiste. **Deckwahl**
  (`/play`): dein Deck und das Deck der KI – eines deiner Decks im gleichen
  Format oder **zufällig** (für jede Partie neu gezogen, nie dein eigenes);
  gespeichert; was nicht passt, wird gesagt, nie ersetzt. Die importierte Liste
  bleibt beim Deck. Neu gespeichert: der **Gefährte** (Schema-Version 3). Kein
  Blocker.
- **Wichtige Komponenten:**
  - Bibliothek: `src/decks/deck-view.ts` (Karte je Eintrag, Sprache,
    Titelkarte, `pictureOf`, `needsNamedPrint`, `readLibrary`), `library.ts`
    (Suche/Filter/Sortierung, Adresse), `library-labels.ts`,
    `arena-export.ts`, `named-prints.ts`, `catalog-hint.tsx`
  - Oberfläche: `src/routes/decks-page.tsx` (Liste), `deck-details-page.tsx`,
    `deck-actions.tsx`, `deck-dialogs.tsx` (Umbenennen, Löschen, Exportieren),
    `deck-update-page.tsx` (`/decks/:id/import`), Import-Seite mit Modus
    „Deck neu importieren“, `deck-picker-dialog.tsx`, `src/routes/play-page.tsx`
  - Deckwahl: `src/decks/deck-selection.ts` (Einstellungen `play.humanDeck`,
    `play.aiDeck`; `resolveSelection`, `randomPool`, `drawAiDeck`)
  - Speicher: `src/storage/decks.ts` (`getDeck`, `renameDeck`,
    `duplicateDeck`, `replaceDeck`, `deleteDeck` – je eine Transaktion),
    Fehlercode `not-found`; Schema-Version **3** (`DeckRecord.companion`,
    Migration 3 ohne Umbau), Resolver-Option `previous`
  - UI-Bausteine: shadcn `DropdownMenu`, `Select`, `ToggleGroup` (+ `Toggle`)
    aus der Registry (Touch-Größen), `ActionBar` (shadcn-Bauweise);
    `--destructive` L 0,71 → 0,74 (Kontrast der Bestätigungsknöpfe)
  - `src/cards/print-key.ts` (Scryfall-Code lädt wieder erst bei Bedarf),
    `src/test/deck-fixtures.ts`, E2E-Abschnitt 9 in `scripts/e2e/run.ts`
  - Doku: `docs/implementation/10-deck-library.md`, `AGENTS.md` (Regeln der
    Bibliothek), `docs/DESIGN_SYSTEM.md`, Bible §5, `cards/README.md`
    (Schema ↔ Katalog), `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `58aaa58`):**
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund.
  - **418 Vitest-Tests** (352 bestehende + 66 neue): Speicher 9, Ansicht 10,
    Bibliothek 7, Export 7 (inkl. Rundreise Export → Import), Deckwahl 9,
    Oberfläche 16, Resolver +3, Deck-Plan +1, Migration 2 → 3 +1,
    Design-Tokens +3.
  - **End-to-End** (`npm run check` 364 s, Chrome 153, echte Engine
    `0c82db80023ac0cc`, echter Katalog `4647d01ae90b1c6a`, 0 Fehler, axe ohne
    Befund): alle bisherigen Prüfungen plus Abschnitt 9 – Liste (Suche
    „Zwang“ findet das deutsche Deck, bleibt nach Neuladen, Format, Sortierung
    in der Adresse), Details (12 Kartenbilder geladen, 0 fehlerhaft;
    genannte Drucke: 1× `/cards/collection` + 4 deutsche Fassungen, 1× 404 =
    „gibt es nicht“), Kartenansicht, Umbenennen, Export (Zwischenablage,
    zwei echte Downloads, exportierte Liste erneut importiert = dasselbe Deck,
    0 Scryfall-Anfragen), Duplizieren, erneuter Import („Zwang“ wie bisher, eine
    Zeile weggelassen, Ersetzen bestätigt, gleiche Id/Anlage, 0
    Scryfall-Anfragen), Löschen, Deckwahl (Zufall aus 2 Decks, Commander
    gesperrt, Spiegelpartie, nach Neuladen gespeichert), Handy mit Touch
    (Aktionsleiste direkt über der Tab-Leiste, Knöpfe 48 px, Menüeinträge
    44 px, kein Überlauf); danach **alle vier Decks in der echten Engine**
    (auch das erneut importierte): kein „deck-rejected“, Partie mit genau den
    Karten, Aufgabe beendet sie.
  - Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, **80/80**.
    Frischer Klon von `58aaa58`: `npm ci`, Build ohne Engine scheitert laut,
    mit `OPENMANA_ENGINE=omit OPENMANA_CARDS=omit` baut er, 418 Tests grün.
- **Messwerte (odin):** Start-JavaScript 207,7 → **221,7 KB gzip** (App-Code
  108,4 → 122,4 KB: Liste mit Suche/Filter/Sortierung, Deckwahl; davon Radix
  `Select` ~5,9 KB); nachgeladen: Deck-Details 11,3 KB, „Deck neu
  importieren“ 1,0 KB, Import-Seite 11,2 KB gzip. Katalog nach dem
  Schemawechsel neu gebaut (64 s offline, gleiche Zahlen). Prüfen der
  exportierten Liste im E2E 74 ms, erneuter Import 88 ms; genannte Drucke des
  E2E-Decks: 6 von 11 trägt der Katalog, 1 ist nur bei Forge, 4 kosten 1
  Sammelanfrage + 4 deutsche Fassungen (einmal je 30 Tage).
- **Erkenntnisse/Abweichungen:**
  - **Behoben, vom E2E gefunden:** der rote Bestätigungsknopf erreichte im
    Dialog nur 4,43:1 (betraf auch „Lokale Daten zurücksetzen“ aus 07, dort nie
    per axe geprüft) → `--destructive` heller, neuer Token-Test; ein Dialog
    verlor beim Schließen seinen Titel (axe: Dialog ohne Namen) → Anzeige bleibt
    bis zum Ende der Animation; statische Importe von `prints.ts` (seit 09)
    verhinderten das Nachladen des Scryfall-Codes → `print-key.ts`.
  - **Schemawechsel = Katalog neu bauen:** Die Katalogzeilen tragen die
    Schema-Version (08); auch ein Wechsel nur an Decks verlangt
    `npm run cards:build -- --offline` (in `cards/README.md` festgehalten).
  - **Bewusste Entscheidungen:** Gefährte als optionales Feld (keine Umwandlung
    gespeicherter Decks); Zufall ohne eigenes Deck, gezogen beim Start jeder
    Partie (`drawAiDeck`, benutzt ab 11); Bild: genannter Druck deutsch, sonst
    deutsches Kartenbild vor englischem Druck (Bible §4); erneuter Import
    ersetzt die gespeicherte Liste (bestätigt), keine Listen-Historie; Menü
    nicht modal; Deckwahl als Einstellung; Startseite „Gegner wählen“ vorhanden
    (KI-Profil folgt mit 12).
  - Testumgebung: Wartezeit von Testing Library global 5 s (nachgeladene
    Seiten brauchten unter Last > 1 s); ein zeitabhängiger Test aus 08 wartet
    jetzt auf sein Abzeichen.
- **Weiter mit:** Prompt 11 (Game session foundation). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 11 — Game session foundation — COMPLETE

- **Commits:** `679fbfb` Implementierung (alle Nachweise liefen auf diesem
  Stand, sauberer Arbeitsbaum), danach Doku und dieser Eintrag (2026-09-25).
  Agent: Claude Code (Claude Opus 5.5), Auftrag „Führe
  prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `db6c6de`.
- **Zusammenfassung:** Die gespeicherten Decks spielen eine **echte Partie
  gegen die Forge-KI** im Browser. Öffnet der Spieler „Spielen“ und hat er
  Decks, **wärmt die Engine von selbst vor** (nur aus `idle`, nie ein stilles
  Wiederholen nach einem Fehler). „Partie starten“ zieht bei „zufällig“ das
  Deck der KI neu, übergibt beide Decks als **Daten** (Protokoll-`Deck` mit
  Forges Namen; keine Datei, kein Server), einen von der App gezogenen Seed
  (48 Bit) und Forges Standardprofil, und führt zur Seite **„Partie“**
  (`/play/game`, nachgeladen). Der Knopf geht bei jedem Engine-Zustand
  (wartet auf eine ladende, startet eine gescheiterte neu) und sagt, was als
  Nächstes passiert. **Ausdrückliche Zustände** mit je einem Weg weiter:
  wird vorbereitet (Startschritte), Forge baut auf, läuft (Forges Zug,
  Schritt, Lebenspunkte, Zonengrößen, die Entscheidung in Forges eigenen
  deutschen Worten, Meldungen), Ergebnis („Gewonnen“/„Verloren“/
  „Unentschieden“ groß, aus Forges `result`), abgelehnt (`engine.error` mit
  Forges Bericht; derselbe Worker nimmt die nächste Partie), abgebrochen bzw.
  konnte nicht starten (`engine.abort`), Engine stumm (Wächter, „Partie
  beenden“). **Eine Engine je Partie**, nie zwei zugleich; die nächste wird
  nach dem Ergebnis vorgewärmt. Aufgeben und Beenden bestätigt; Neuladen
  fragt vorher und beendet die Partie (so gesagt). Einzige Eingabe ist das
  Aufgeben – Spieltisch und Entscheidungen folgen ab 13. Keine
  Attrappen. Engine unverändert (`--card-loading=eager --language=de-DE`
  jetzt ausdrücklich). Kein Blocker.
- **Wichtige Komponenten:**
  - Sitzung: `src/engine/engine-session.ts` (Engine **und** Partie in einem
    Zustand: `idle/booting/ready/busy/aborted` + `queued/starting/refused/
    playing/over/aborted`; `prewarm`, `startMatch`, `cancelMatch`, `concede`,
    `abortMatch`, `ENGINE_ARGS`), `engine-session-context.tsx` (stabile
    Aktionen, Warnung vor dem Verlassen, ein Abbruch-Toast ersetzt den
    vorigen), `engine-panel.tsx` („Spielt“, Sprache von Forge, geteilte
    `BootSteps`)
  - Partie: `src/game/engine-deck.ts` (DeckRecord → Protokoll-Deck, auch vom
    E2E in Node benutzt), `match-setup.ts` (Zufallsdeck je Partie, Seed,
    Namen „Spieler“/„Forge-KI“, Profil `Default`), `game-start.ts`
    (Start-Knopf), `game-labels.ts`, `game-page.tsx`
  - `src/routes/play-page.tsx` (vorwärmen, echter Start, „Zur laufenden
    Partie“), Route `play/game`; Layout: `Page` füllt die Höhe,
    `ActionBar` sitzt auch auf kurzen Seiten über der Tab-Leiste
  - Tests: `src/test/game-fixtures.ts` (echter `EngineClient` über einem
    geskripteten Worker), E2E-Abschnitt 10 in `scripts/e2e/run.ts`,
    `/play/game` in den Oberflächen
  - Doku: `docs/implementation/11-game-session.md`, `AGENTS.md`
    (Regeln der Spielsitzung), `docs/DESIGN_SYSTEM.md`, Bible §6 (Verweis),
    `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `679fbfb`):**
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund.
  - **468 Vitest-Tests** (418 bestehende + 50 neue): Sitzung 26 (8 → 26: jetzt
    über den **echten** `EngineClient` mit geskriptetem Worker – Vorwärmen,
    Start auf bereiter/bootender/keiner Engine, genaue Anfrage, Zustand,
    Fragen, Anweisung, Warten, Aufgeben genau einmal, Ergebnis, Worker
    freigegeben, Ablehnung + derselbe Worker, ungültige Anfrage, keine zweite
    Partie, Abbruch mit letztem Stand, Protokollverstoß, Bereit-Zeitlimit,
    Wächter + „Partie beenden“, Beenden, Abbrechen, Meldungen), Seiten 13
    (vorwärmen und starten mit genauer `match.start`-Anfrage, Gründe am
    Start-Knopf, ohne Partie, laufende Partie mit Aufgeben-Bestätigung und
    Ergebnis, Ablehnung mit Deck-Link, Abbrüche mit Toast, stumme Engine,
    Handy), Partie-Plan 9, Start-Knopf 4, Texte 6; angepasst: Engine-Kasten 3,
    Deckwahl 3.
  - **End-to-End** (`npm run check` 365 s, Chrome 153, echte Engine
    `0c82db80023ac0cc`, echter Katalog, echte Scryfall-API, **0 Fehler**, axe
    ohne Befund): alle bisherigen Prüfungen plus `/play/game` in drei Größen
    und Abschnitt 10 – Vorwärmen ohne Klick („Bereit“ nach 5,4 s),
    Commander-Spiegelpartie (Münzwurf: „Spielen“/„Ziehen“, 40 Leben, Hand 0,
    Bibliothek 59, Kommandozone 1) und Constructed gegen ein zufällig
    gezogenes Deck (Mulligan, 20 Leben, Hand 7, Bibliothek 53), je 0,85 s vom
    Klick bis zur ersten Entscheidung; durch die App und zurück zur selben
    Partie; Aufgeben mit Bestätigung → „Verloren“; nächste Engine vorgewärmt;
    Neuladen fragt (`beforeunload`) und beendet die Partie; nie mehr als ein
    Worker. Frisches Profil: Wasm-Download scheitert (HTTP 500) → Abbruch im
    Engine-Kasten, „Die Partie konnte nicht starten“ mit Grund, danach „Neue
    Partie“ in 5,8 s; Deck mit unbekannter Karte → Forges Bericht, nächste
    Partie auf demselben Worker. Handy: kein Überlauf, 48-px-Knöpfe, „Neue
    Partie“ direkt über der Tab-Leiste. Abschnitt 8 spielt alle 4 Decks in der
    Engine (Node) jetzt mit der Deck-Übergabe der App, 0 Befunde.
  - Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, **80/80**.
    Frischer Klon von `679fbfb`: `npm ci`, Build ohne Engine scheitert laut,
    mit `OPENMANA_ENGINE=omit OPENMANA_CARDS=omit` baut er, 468 Tests grün.
- **Messwerte (odin):** Vorwärmen bis „Bereit“ 5,4 s (Desktop, Lastmittel
  1,3–1,9); Start mit vorgewärmter Engine bis zur ersten Entscheidung
  0,84–0,87 s (Desktop, Handy); kalter Start samt Engine 5,8 s; in Node Engine
  bereit nach 6,8–6,9 s, Partie danach in 61–79 ms. Start-JavaScript (Vite,
  gzip, beide Stände gleich gebaut) 222,1 → **229,1 KB** (+7,0 KB);
  Partie-Seite 4,7 KB gzip nachgeladen. Nie mehr als eine Engine (~1 GB).
- **Erkenntnisse/Abweichungen:**
  - **Münzwurf vor dem Mulligan:** Gewinnt der Spieler den Münzwurf, fragt
    Forge zuerst „Spielen oder Ziehen?“ (Knöpfe ohne `purpose`, vor den
    Starthänden: Hand 0); sonst kommt der Mulligan. Die Anweisungszeile kommt
    als eigene `prompt`-Nachricht nach der Frage (Frage-Text leer) → die
    Sitzung hält sie. Für 15/16: die Münzwurf-Frage hat keinen eigenen Zweck.
  - **Keine Legalitätsprüfung vor dem Start** (von 09/10 für 11
    vorgeschlagen): Forges `getDeckConformanceProblem` liefert nur englische
    Satzbruchstücke (upstream: „Needs localization“) – deutsch zeigen hieße
    Prosa parsen, englisch bräche die Sprachregel. Forge spielt jedes Deck, das
    es bauen kann; Arenas Brawl-Decks spielt es als Commander (40 Leben), das
    Protokoll kennt kein Brawl. Offen, Kandidat für 23 bzw. upstream.
  - **Seed von der App** statt `null`: Forge nimmt dann `java.util.Random`
    statt `SecureRandom`; dafür ist er für die Aufzeichnung (22) bekannt.
  - **Forges Sprache Deutsch** ab jetzt (Spieler liest Forges Sätze; 04/05:
    ändert nur Wörter). Eine Einstellung wäre Sache von 12.
  - Behoben/gefunden: Wartezustand nach dem Aufgeben (Sitzungstest),
    Lade-Kreisel im Knopfnamen (Seitentest), gestapelte gleiche Fehler-Toasts
    (axe-Kontrast), Aktionsleiste schwebte auf kurzen Seiten, zeitabhängiger
    axe-Schritt aus 10 (Menü blendet aus). Testfalle: Playwrights
    Ganzseiten-Screenshot setzt die Touch-Emulation zurück (`pointer: coarse`
    danach falsch) → Maße vor Ganzseiten-Screenshots.
  - Bewusst: Anvils „Aufgeben und neue Partie“ nicht übernommen (30);
    keine Aufzeichnung (22); Hinweise am Start-Knopf in
    Einrichtungsreihenfolge (erst Decks, dann Engine).
- **Weiter mit:** Prompt 12 (AI profiles and settings). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 12 — AI profiles and settings — COMPLETE

- **Commits:** `e618079` Implementierung (Engine aus diesem Commit gebaut,
  `engineSourcesModified=false`; alle Nachweise liefen auf diesem Stand,
  sauberer Arbeitsbaum), danach Doku und dieser Eintrag (2026-09-25).
  Agent: Claude Code (Claude Opus 5.5), Auftrag „Führe
  prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `bc44993`.
- **Zusammenfassung:** Die **KI-Profile** der gepinnten Engine sind geprüft
  und wählbar: „Standard“ (Default, Vorgabe), „Vorsichtig“ (Cautious),
  „Waghalsig“ (Reckless), „Experimentell“ (Experimental) und „Zufällig“ (die
  App zieht je Partie eines). **Geprüft** auf zwei Wegen
  (`docs/research/AI_PROFILES.md`): die 80 von 121 Werten, die sich
  unterscheiden, samt der Forge-Stellen, die sie lesen (welche in OpenMana
  wirken, welche nie), und **2 400 Partien Forge-KI gegen Forge-KI**
  (Spiegelpartien mit drei Decks, beide Sitzreihenfolgen je Seed, Default
  gegen Default als Kontrolle): **kein Profil messbar stärker oder
  schwächer** (Siegquote gegen Default 47,5 / 48,2 / 52,5 %, jedes
  95-%-Intervall enthält 50 %, gepaarter Vorzeichentest p = 0,067 / 0,161 /
  0,082), aber deutliche **Stilunterschiede** (Waghalsig bis +26 %
  angreifende Kreaturen je Zug, weniger Blocks, +12 % Konter; Vorsichtig
  seltener Konter). Deshalb **keine Schwierigkeitsstufen**: deutsche Namen
  übersetzen Forges, Beschreibungen nennen nur belegte Unterschiede, jede
  Profilwahl sagt „Forge kennt keine Schwierigkeitsstufen …“. Die Wahl ist
  eine **Einstellung** (Einstellungen → Gegner; Dialog „Ändern“ auf der
  Spielen-Seite), nie ein Schritt vor dem Start; die laufende Partie zeigt
  das Profil, das Forge bestätigt. **Kartensprache** „Deutsch“ (Vorgabe,
  englisch wo es nichts Deutsches gibt) oder „Englisch“ – für jede
  Kartenanzeige der App **und** die Karten in Forges Texten (neues
  Start-Argument `--card-language`; Forges Sätze bleiben deutsch); eine
  vorgewärmte Engine der alten Sprache wird ersetzt. **Weniger Bewegung**:
  alle Animationen stoppen, wenn Gerät oder Spieler es wünschen.
  **Versions-Diagnose**: Forge-Version (2.0.15) in „Über OpenMana“,
  Diagnosebericht aller Versionen zum Kopieren (nichts wird gesendet). Engine:
  **Protokoll 4** (`BootReport.cardLanguage`, `.aiProfiles`), ein
  unbekanntes Profil wird abgelehnt statt still mit Forges Vorgabewerten
  gespielt; der Build bricht ab, wenn die Profildateien der Engine nicht die
  geprüften sind. Kein Blocker.
- **Wichtige Komponenten:**
  - Engine: `ForgeEngine` (`--card-language`: Kartenübersetzung nach
    `FModel.initialize` nachgeladen; `aiProfiles()` sortiert), `EngineBoot`
    (Boot-Bericht), `HumanMatch` (unbekanntes Profil → `InvalidRequest` vor
    jeder Nachricht), `WasmMain` (Argument, alle Boot-Felder in
    `engine.ready`), Schema Version 4, `jvm/AiProfileStudy` +
    `JvmAiProfileStudyMain` + `scripts/ai-profile-study.sh` +
    `ai-profile-summary.mjs` (Studie, nur JVM), `prepare-forge.sh`/
    `write-manifest.mjs` (`forge.versionCode`), `test-engine.sh` (Varianten
    Deutsch mit englischen Karten), Fixtures `human-3-de-cards-en`,
    `ai-profile-study.json`, `decks/study-*.json`
  - App: `src/game/ai-profile-table.ts` (geprüfte Profile mit SHA-256),
    `ai-profiles.ts` (Einstellung, Auflösung, Zufall),
    `ai-profile-options.tsx` (Auswahl, Dialog), `match-setup.ts`/
    `game-start.ts` (Profil an Forge, Startsperre bei fehlendem Profil);
    `src/app/preferences.tsx` (liest und wendet an), `motion.ts`,
    `motion-options.tsx`, `diagnostics.ts`, `diagnostics-dialog.tsx`;
    `src/cards/card-language.ts`, `card-language-options.tsx`,
    `card-display.ts` (`language`), `src/decks/deck-view.ts`;
    `src/engine/engine-session.ts` (`EngineBootOptions`, `setBootOptions`,
    `engineArgs`); `src/routes/settings-page.tsx`; `src/index.css`
    (`@custom-variant motion-reduce`), `motion-reduce:` in 16
    shadcn-Bausteinen, `Switch` neu; `vite/engine-assets.ts`
    (Profilprüfung, `forgeVersionCode`)
  - Doku: `docs/research/AI_PROFILES.md`,
    `docs/implementation/12-ai-profiles-settings.md`, `AGENTS.md`
    (Preferences Rules), `docs/DESIGN_SYSTEM.md` (Regeln 3, 8, Inventar),
    Bible §7, `engine/README.md`, `engine/protocol/README.md`,
    `engine/fixtures/README.md`, `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `e618079`):**
  - Erzeugte Dateien = Schemas (App und Protokoll), `tsc -b`, `oxlint` ohne
    Befund.
  - **510 Vitest-Tests** (468 bestehende + 42 neue): Profile 5, Bewegung 3,
    Diagnose 4, Einstellungs-Provider 4, Einstellungsseite 7, Sitzung +4
    (Kartensprache: Boot, warme Engine ersetzt, Partie behält ihre, ruhende
    startet nicht), Spielen-Seite +4 (Profil gezeigt und an Forge, Dialog,
    Zufall, fehlendes Profil sperrt), Partie-Plan +2, Start-Knopf +1,
    Kartenanzeige +3 (Englisch), Deckbibliothek +1 (Englisch), Engine-Assets
    +4 (Profilprüfung im Build); angepasst: Texte, Engine-Kasten.
  - **Engine:** `build.sh` aus `e618079` (368 s, `engineSourcesModified=false`):
    **56 JVM-Tests** (51 + 5 `AiProfilesTest`: Profile gemeldet, Bericht =
    Schema, eigene Werte je Profil, unbekanntes abgelehnt bevor etwas
    gesendet ist, kein Schummeln), 80 TypeScript-Tests.
    `test-engine.sh` (17,4 min): **69 Läufe, 0 Fehler** – neu die
    Kartenprüfung „Deutsch mit englischen Karten“ auf JVM, Node und Chrome
    (gleicher Fingerabdruck; Meldungen deutsch, Kartennamen englisch) und die
    Testpartie `human-3-de-cards-en` (dieselbe Engine-Spur wie `human-3`).
  - **End-to-End** (`npm run check` 405 s, Chrome 153, echte Engine
    `42f3bf1c7706cec5`, echter Katalog, echte Scryfall-API, **0 Fehler**, axe
    ohne Befund): alle bisherigen Abschnitte plus Abschnitt 11: Profil und
    Englisch sofort gespeichert; Deckliste englisch („Valki, God of Lies“);
    Engine bootet mit „Karten in Forges Texten: Englisch“ und meldet die vier
    Profile; Partie zeigt „Waghalsig“ als Forges Bestätigung; zurück auf
    Deutsch ersetzt die vorgewärmte Engine; „Zufällig“ zog „Experimentell“;
    nie zwei Engines zugleich; Dialog-Animation `enter` → mit Schalter `none`,
    ebenso auf einem Gerät mit `prefers-reduced-motion`; Diagnose vollständig
    und kopiert; Handy: alle Auswahlzeilen ≥ 44 px, kein Überlauf.
  - **KI-Profil-Studie** (`engine/scripts/ai-profile-study.sh`, JVM-Build vor
    dem Commit: derselbe Forge-Stand, dieselben Patches und Profildateien; die
    Bridge-Änderungen danach berühren KI-gegen-KI-Partien nicht): 2 400
    Partien, 0 gescheitert, 0 Forge-Fehler, keine abgelaufene Zeitgrenze;
    Ergebnisse in `docs/research/AI_PROFILES.md`.
- **Messwerte (odin):** Engine-Build 368 s; Wasm-Modul 79,1 MB (+112 KB),
  Brotli 12,5 MB (+44 KB). Start-JavaScript (Skripte und Modulvorladungen der
  `index.html`, gzip, beide Stände gleich gebaut) 221,4 → **228,9 KB**
  (+7,5 KB). Vorwärmen 5,9 s, Start nach dem Vorwärmen 0,82–0,86 s,
  Engine-Start mit englischen Karten 5,7 s (gleich). Studie: im Mittel 2,2 s
  je Partie, 88 CPU-Minuten auf 4 JVMs (~26 min neben anderen Sitzungen).
- **Erkenntnisse/Abweichungen:**
  - **Forge spielt einen unbekannten Profilnamen still** mit den eingebauten
    `AiProps`-Werten (keinem Profil gleich) – daher die Ablehnung in der
    Bridge und `boot.aiProfiles`.
  - **Einige Profilwerte wirken in OpenMana nie** (Sideboarding bei einem
    Spiel je Match, Varianten, Werte hinter Schaltern, die in allen Profilen
    gleich stehen); „Vorsichtig“ lässt sogar eine Angriffs-Zusatzprüfung weg –
    die App behauptet nur, was wirkt.
  - **Kartensprache getrennt von Forges Sprache:** Forge kennt nur
    `UI_LANGUAGE` für beides; die Engine lädt die zweite Kartenübersetzung
    nach dem Start nach. Beleg, dass nur Wörter sich ändern: gleiche
    Engine-Spur und gleicher Kartenprüf-Fingerabdruck.
  - **Der Engine-Build löscht `engine/build/report`** – die Studie vor
    einem Build sichern (ist hier passiert, rechtzeitig gesichert).
  - Bewusst: keine Schwierigkeitswörter; „Zufällig“ zieht die App; Lade-
    Kreisel drehen auch bei weniger Bewegung; die Studie gehört nicht zu
    `test-engine.sh` (25 min), wird aber bei geänderten Profildateien vom
    Build erzwungen.
- **Weiter mit:** Prompt 13 (Battlefield foundation). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 13 — Battlefield foundation — COMPLETE

- **Commits:** `eb8e0ab` Implementierung (Engine unverändert; alle Nachweise
  liefen auf diesem Stand, sauberer Arbeitsbaum), danach Doku und dieser
  Eintrag (2026-09-25). Agent: Claude Code (Claude Opus 5.5), Auftrag „Führe
  prompts/naechster-schritt.md aus“ (genau ein Prompt, danach Stopp).
  Status-Commit zu Beginn: `e5edb83`.
- **Zusammenfassung:** Eine laufende Partie ist jetzt der **Spieltisch**,
  gebaut aus Forges vollständigem Zustand (`GameState`, offene Fragen,
  Anweisungszeile). **Feste Bereiche:** Kopf (Zug, Schritt, wer am Zug ist,
  „Du bist dran“/„Forge rechnet“, Menü), Forge-KI (Profil, Leben, Zonen,
  Mana, Marken, Kommandeursteuer und -schaden, Hand als Rückseiten), ihr
  Spielfeld, Stapel und Kampf, dein Spielfeld, du, Forges Entscheidung,
  deine Hand. **Hochformat** untereinander, **Querformat** mit Seitenspalte
  (KI neben dem Kopf, du neben der Hand, beide Spielfelder exakt gleich
  hoch); die Seite rollt nie, Kartenreihen rollen seitwärts, Texte in ihrem
  Bereich; Regionhöhen richten sich nach der Bildschirmhöhe. **Vollbild:**
  Seitenleiste, Kopf- und Tab-Leiste treten während der Partie zurück; das
  **Menü** des Tischs führt zu jeder Seite (die Partie läuft weiter), zeigt
  Paarung und Forges Meldungen und hat „Aufgeben“ (bestätigt). **Karten**
  von der Reihenhöhe bemessen, Bilder aus dem Katalog in der Kartensprache
  (Forges Schlüssel einmal je Schlüssel aufgelöst; nicht eindeutig →
  Forges Worte statt eines geratenen Bildes), getappt = Vierteldrehung,
  Fakten (Stapelgröße, Angriff, Block, Stärke/Widerstandskraft, Loyalität,
  Schaden, Marken deutsch, verdeckt, ausgephast) **unter** dem Bild,
  gleiche Karten als Stapel („9×“; nie Karten, die Forge in Fragen, auf dem
  Stapel, im Kampf oder als Anhängsel nennt), Auren/Ausrüstung beim Träger
  (auch über die Seiten). **Verborgenes** bleibt Rückseite und Zahl.
  **Stapel** (oben zuerst) und **Kampf** in Forges Worten; **Entscheidung**
  mit Forges Anweisung, Frageart und angebotenen Antworten, ehrlich „noch
  nicht beantwortbar“ (Prompt 15/16). Keine Regel im Client. Kein Blocker.
- **Wichtige Komponenten:**
  - Tisch: `src/game/game-table.tsx` (reine Ansicht eines Zustands; Menü und
    Warnungen kommen von außen – auch für die Wiedergabe in 22),
    `table-model.ts` (Sitzplätze, Reihen, Stapel, Anhängsel, Stapel/Kampf;
    rein), `table-cards.ts` (Bilder: `useTableCards`, `pictureKey`,
    `resolvePictures`), `table-labels.ts` (Marken, Fakten, Stapel-/
    Kampfzeilen)
  - Bausteine (shadcn-Weise): `src/components/ui/game-board.tsx`
    (`GameBoard`, `GameBoardArea`: acht Bereiche, Hoch/Quer),
    `game-card.tsx` (`GameCard`, `GameCardCaption`, `GameCardBack`,
    `GameCardGroup`); `card-picture.tsx` + `compact`
  - App: `src/app/immersive.tsx` (`useImmersive`), `app-shell.tsx` (Rahmen
    tritt zurück); `src/game/game-page.tsx` (Tisch im Vollbild,
    `TableMenu`, Meldungs-Hinweise); `src/engine/engine-session.ts`
    (`noticeCount`); `src/hooks/use-element-height.ts`
  - Echte Szenen: `scripts/record-table-scenes.ts` →
    `src/test/fixtures/table-scenes.json` (sieben Momente aus den
    Mitschnitten der Differenztests, Engine von `e618079`),
    `src/test/table-scenes.ts`; Prüfstand `src/test/table-harness.tsx` +
    `scripts/e2e/table-harness.html`
  - Doku: `docs/implementation/13-battlefield-foundation.md`, `AGENTS.md`
    (Game Table Rules), `docs/DESIGN_SYSTEM.md` (§3 Regel 3/8, §4 Tisch,
    §5 Inventar, §6 nichts über Kartenbilder), Bible §6 (Verweis),
    `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `eb8e0ab`):**
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund.
  - **559 Vitest-Tests** (510 bestehende + 49 neue): Tischmodell 15 (auf
    sieben echten Szenen: Protokollprüfung, Sitzplätze, Stapel gleicher
    Karten, Reihen, Stapel, Kampf, Commander, Effektkarten; gebaut: Aura des
    Gegners auf eigener Kreatur, verdeckte Karten, genannte Karten), Bilder 6
    (echter Mini-Katalog), Tisch 18, Wörter 6, Vollbild 3, Partie-Seite +1
    (Meldungen; 4 angepasst: Tisch statt Zusammenfassung, Aufgeben aus dem
    Menü), Sitzung (1 erweitert: `noticeCount`).
  - **End-to-End** (`npm run check` 8 min 2 s, Chrome 153, echte Engine
    `42f3bf1c7706cec5`, echter Katalog, echte Scryfall-API, **0 Befunde**):
    alle bisherigen Abschnitte, 10 und 11 jetzt am Tisch – Commander-
    Spiegelpartie am Desktop (kein App-Rahmen, nichts rollt, alle Bereiche im
    Fenster, Hand 7 offen mit echten Bildern, KI-Hand 7 Rückseiten ohne Bild,
    Kommandeur mit Bild in der Kommandozone, axe 0), Fenster hochkant/quer/
    zurück ohne Wirkung auf die Partie, Menü in die App und zurück, Aufgeben
    aus dem Menü, Constructed gegen „zufällig“, Fehlerwege, Handy hochkant
    und gedreht (48-px-Menü, echte Bilder), Profil vom Tisch gelesen. **Neu
    Abschnitt 12:** sieben echte Szenen im echten Tischcode in sechs Größen
    (Handy, Handy quer, kleines Handy, Foldable, Tablet quer, Desktop) = 42
    Kombinationen: nichts rollt, jeder Bereich im Fenster, Spielfelder gleich
    hoch, kleinstes 112 px, jede Karte in ihrer Reihe, 127 Bilder geladen,
    0 gescheitert, **axe 0 Befunde**.
  - Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, **80/80**.
    Frischer Klon von `eb8e0ab`: `npm ci` 4,6 s, Build ohne Engine scheitert
    laut, mit `OPENMANA_ENGINE=omit OPENMANA_CARDS=omit` baut er, 559 Tests
    grün.
- **Messwerte (odin):** Vorwärmen bis „Bereit“ 6,4 s; Start bis zur ersten
  Entscheidung 0,84–0,90 s (Desktop, Handy); Kartendaten am Handy in 4,1 s
  eingerichtet. Start-JavaScript (Skripte und Modulvorladungen der
  `index.html`, gzip -9, beide Stände gleich gebaut) 228,5 → **229,7 KB**
  (+1,2 KB); Partie-Seite (nachgeladen) 4,6 → **12,1 KB** gzip. Nie mehr als
  eine Engine.
- **Erkenntnisse/Abweichungen:**
  - **Unsichtbare Texte ließen die Seite rollen:** `sr-only`-Texte in
    seitwärts rollenden Reihen hatten keinen positionierten Vorfahren und
    streckten die Seite auf 1540 × 3421 px; Reihen, Bereiche und Raster sind
    jetzt `relative`, der E2E prüft je Größe und Szene, dass nichts rollt.
  - **Kleines Handy (360×740):** der erste Lauf fand 68 px je Spielfeld in der
    späten Commander-Szene → Rückseiten-Reihe der KI nur bei breiter Leiste
    (aufgedeckte Karten immer), Kommandeur-Angaben als kurze Stücke,
    Entscheidung/Stapel/Hand nach Bildschirmhöhe (`clamp(…dvh…)`) → 112 px.
  - **Abgebrochene Bildanfragen** im Handy-Querformat: Das Feld maß seine
    Höhe erst nach dem ersten Zeichnen und stellte von zwei auf eine Reihe
    um; der Browser verwarf die schon begonnenen kleinen Bilder. Jetzt vor
    dem ersten Zeichnen gemessen.
  - **axe im einblendenden Menü:** Kontrast wurde mitten in der
    Einblend-Animation gemessen; der Test wartet jetzt das Animationsende ab
    (`animationsDone`).
  - **Forges Texte teils englisch** (Stapelbeschreibungen aus den
    Kartenskripten, „Select creatures to attack …“, Knöpfe „Call Back“,
    „Auto“, „Cancel“) – gezeigt wie gesendet; für 15/16: Knöpfe nach
    `purpose` deutsch beschriften.
  - **Zauber auf dem Stapel ohne Karte im Protokoll** (`StackItem.source`
    zeigt in Forges Stapelzone) → Vorschlag `StackItem.card`, Protokoll 5
    (16).
  - **Spielsteine eines Namens** (Goblin 1/1 rot: drei Scryfall-Designs) →
    kein Bild, Forges Worte (Kandidat 14/20).
  - Ein unveränderter Test aus Prompt 12 (`preferences.test.tsx`) schlug in
    einem von sechs vollen Vitest-Läufen unter Last fehl, sonst grün;
    beobachtet, nicht verändert.
  - Bewusst: Vollbild mit eigenem Menü; Antworten sichtbar, nicht bedienbar;
    Einsatzbereitschaft, spielbare Karten, Hervorhebungen noch nicht gezeigt
    (14/17/18/23); Zonen durchblättern und große Kartenansicht (20); volles
    Spielfeld im E2E mit echten, aufgezeichneten Zuständen im echten Tisch
    geprüft, weil die Live-Partie bis 15/16 nur Forges erste Entscheidung
    erreicht.
- **Weiter mit:** Prompt 14 (Cards, hand and safe interaction). Nicht
  begonnen: `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 14 — Cards, hand and safe interaction — COMPLETE

- **Commits:** `1b3e3b6` Implementierung (Engine unverändert; alle Nachweise
  liefen auf diesem Stand, sauberer Arbeitsbaum), danach Doku und dieser
  Eintrag (2026-09-26). Agent: Claude Code (Claude Opus 5.5), Auftrag „Mach den
  Standalone Prompt in Dropzone für Open Mana“ (Dropzone
  `fixed/standalone.md` mit den Regeln aus `naechster-schritt.md`: genau ein
  Prompt, danach Stopp). Status-Commit zu Beginn: `40bfd03`.
- **Zusammenfassung:** Jede Karte, die der Spieler sehen darf, ist ein
  **Bedienelement** (Hand, beide Spielfelder mit Stapeln und Anhängseln,
  Kommandozone, aufgedeckte Karten der KI-Hand) – für Maus, Tastatur und
  Touch. **Ansehen ist gefahrlos:** die **Kartenansicht** (Sheet; Hochformat
  von unten, Querformat von rechts) zeigt die Karte groß (Katalogbild in der
  Kartensprache, ohne Bild Forges Worte), Forges Namen, Typ, Kosten,
  Regeltext, Zustand, Stapel, Anhängsel, Besitz und **was Forge anbietet**
  (samt `ways`) – sie sendet nichts, hält nur die Id und liest jeden neuen
  Zustand („Karte nicht mehr zu sehen“). **Antippen** ist Forges `card.tap`,
  nur wo Forge einen Tipp anbietet (`src/game/card-use.ts`: Auswahl,
  `action`, London-Mulligan, `playable`): bei der Priorität und überall sonst
  über den **Hauptknopf der Ansicht** mit Forges Worten („Spiele ein Land“);
  **sofort** in den Schritten, die Forge zurücknehmen lässt (Auswahl,
  Bezahlen, Angreifen, Blocken, London-Mulligan – Anvils Lehren), dort zeigt
  **langes Drücken / Rechtsklick / Kontextmenü-Taste** die Karte. **Schutz
  gegen Fehltipps:** Ansicht fokussiert sich selbst (nie den Knopf), Knopf
  500 ms nach Erscheinen/Bedeutungswechsel scharf (wie Chromiums
  Rückfragen), Druck daneben schließt so früh nicht, gehaltene Taste
  wiederholt nichts, Doppeltipp auf Sofort-Karte zählt einmal, nichts tippt
  während Forge rechnet / eine blockierende Frage wartet / die Aufgabe
  unterwegs ist (Grund steht da). **Forges Zustand als Rahmen um das Bild**:
  gestrichelt gold = nutzbar („spielbar“, „kann angreifen“, „kann blocken“,
  „kann bezahlen“, „wählbar“), durchgezogen hell = „ausgewählt“; getappt
  bleibt die Vierteldrehung. **Kartenreihen** sind Werkzeugleisten (ein
  Tab-Halt, Pfeile, Pos1, Ende). Die Sitzung hat `tapCard` (nur solange Forge
  wartet); ohne Kartendaten erklärt das Tischmenü, warum Karten als Text
  erscheinen, und richtet sie ein. Keine Regel im Client, Engine unverändert.
  Kein Blocker.
- **Wichtige Komponenten:**
  - `src/game/card-use.ts` (rein: Markierung, Tipp, Wirkung des Antippens,
    Sperrgrund), `card-sheet.tsx` (Kartenansicht, gesicherter Knopf),
    `game-table.tsx` (`TableCard`, Werkzeugleisten, `onTapCard`,
    Doppeltipp-Schutz, Hinweis im Entscheidungsbereich), `table-model.ts`
    (`locateCard`, `pileOf`), `table-labels.ts` (`cardButtonLabel`,
    `placeLabel`), `table-cards.ts` (großes Bild), `game-page.tsx`
    (`tapCard` an den Tisch, Menü-Hinweis Kartendaten)
  - `src/components/ui/game-card.tsx`: `GameCardButton`, `mark`,
    `GameCardRow`/`-RowItem`/`-RowButton` (Radix `Toolbar`);
    `game-board.tsx` (Innenabstand der Hand in die Reihe)
  - `src/hooks/use-card-press.ts` (Tipp vs. langer Druck/Rechtsklick,
    Wischen ist kein Tipp), `use-landscape.ts`
  - `src/engine/engine-session.ts` (`tapCard`, deutsche Ablehnungsgründe),
    `engine-session-context.tsx`
  - Prüfstand: `src/test/table-harness.tsx` zeichnet Tipps auf
    (`window.__openmanaTaps`); E2E `tableInteractions`, `cardTargets`,
    `lookInRealGame`
  - Doku: `docs/implementation/14-card-hand-interactions.md`, `AGENTS.md`
    (Card Interaction Rules), `docs/DESIGN_SYSTEM.md` (Regel 5, 8, §4, §5,
    §6), Bible §6 (Verweis), `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `1b3e3b6`):**
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund.
  - **669 Vitest-Tests** (622 bestehende + 47 neue): Kartennutzung 15
    (`card-use.test.ts`, echte Szenen: Priorität, Mulligan, Blocken,
    erklärter Angriff, Bezahlen; gebaut: Auswahl, London-Mulligan,
    blockierende Frage, rechnende Engine, Aufgabe unterwegs), Bedienung 19
    (`card-interaction.test.tsx`: Rahmen, Ansehen sendet nichts, Fokus in der
    Ansicht und zurück, Fakten, gegnerische Karte, Scharfschalten, Stapel,
    gesperrt mit Grund, gehaltene Taste, Live-Zustand, reine Ansicht,
    Sofort-Tipp und Doppelklick, Rechtsklick, langer Druck, Wischen,
    Tastatur, Kontextmenü-Taste, aufgedeckte KI-Hand), Sitzung 5
    (`tapCard`), Seite 1 (+1 erweitert: Kartendaten-Hinweis im Menü), Tisch
    1 (6 angepasst: Knöpfe und Werkzeugleisten statt Listen), Tokens 6
    (Rahmen 3:1); der Wackeltest aus 12 ist behoben.
  - **End-to-End** (`npm run check` 8 min 52 s, Chrome 153, echte Engine
    `42f3bf1c7706cec5`, echter Katalog, echte Scryfall-API, **0 Befunde**):
    alle bisherigen Abschnitte; neu in 10: **Ansehen in der echten Partie**
    (Desktop: Kommandeur „Valki, Gott der Lügen“; Handy: „Gebirge“ per
    Tipp) – Ansicht mit Bild, in der ersten Entscheidung bietet Forge nichts
    an (nur „Schließen“), Fokus in der Ansicht, axe 0, danach wartet Forge
    unverändert, kein Hinweis; neu in 12 (`tableInteractions`,
    `cardTargets`): in sechs Größen Markierungen wie erwartet, kleinste Karte
    41 × 79 px (Handy) bis 84 × 117 px (Desktop), Ansicht unten
    (hochkant)/rechts (quer), ihr Knopf 48 px (Touch), **Scharfschalten** (ein
    Druck einen Frame nach dem Öffnen tippt nicht, ein späterer genau
    einmal), Doppelklick auf eine Karte tippt nicht, Blocken tippt sofort und
    beim Doppelklick einmal, **langer Druck** (echter Chrome-Touch) und
    Rechtsklick sehen nur an, **Wischen** rollt die Reihe (0 → 189 px) ohne
    Tipp, **Tastatur** (→, Ende, Pos1, Enter, Escape, Tab), **axe 0 in allen
    42 Kombinationen und jeder offenen Ansicht**.
  - Engine unverändert (`engine/` nicht berührt).
- **Messwerte (odin):** Start-JavaScript (Skripte und Modulvorladungen der
  `index.html`, gzip -9, beide Stände gleich gebaut) 241,6 → **242,9 KB**
  (+1,3 KB); Partie-Seite (nachgeladen) 12,0 → **16,7 KB** gzip. Der erste
  Gesamtlauf fiel in die nächtliche Sicherung (siehe unten); der Nachweislauf
  danach: 8 min 52 s.
- **Erkenntnisse/Abweichungen:**
  - **Wackeltest aus Prompt 12 behoben:** `preferences.test.tsx` scheiterte
    unter Last 5 von 24 Mal (nachgestellt: 6 parallele Schleifen × 4) –
    er prüfte Ergebnisse von React-Effekten sofort nach dem Text. Jetzt
    `waitFor` auf dieselben Ergebnisse: 24 von 24 grün. Kein App-Fehler.
  - **Radix gibt den Fokus einen Takt später zurück** (nach dem Abbau eines
    Dialogs) und **bewegt ihn bei Pfeiltasten einen Takt später**: in Tests
    abwarten (`src/test/setup.ts` wartet nach dem Aufräumen einen Takt;
    E2E wartet auf den erwarteten Fokus).
  - **Querformat-Handy:** das große Bild schob den Knopf der Ansicht unter
    den Rand → Knopfleiste bleibt stehen, im Querformat nebeneinander.
  - **Forges Tipp-Worte teils englisch** („Remove card from combat“,
    „Declare blockers for card“; Auswahl hartcodiert „select card“) – gezeigt
    wie gesendet, bei der Auswahl spricht der Schritt („Auswählen“).
  - **`action` ist bei der Priorität mehr als `playable`** (Manafähigkeiten
    der Länder, von der Heuristik als unbezahlbar eingestufte Zauber): markiert
    wird nach `playable`, angeboten nach `action` – kein legaler Zug
    versteckt.
  - **Nebenwirkung von `getActivateDescription`** (seit 05 offen): bewusst
    nach 16 verschoben (baut die Engine ohnehin neu, `StackItem.card`);
    Vorschlag dort: `action` bei der Priorität nur für eigene und von Forge
    markierte Karten.
  - **E2E und die nächtliche Sicherung:** Der erste Gesamtlauf fiel in die
    Sicherung von odin (01:0x Uhr: `restic-backup-system.sh` stoppt
    Datenbank-Container) → Docker-Netze ändern sich, Chrome bricht laufende
    Bildanfragen mit `net::ERR_NETWORK_CHANGED` ab (16 Meldungen, 7 Bilder
    im Querformat-Handy). Kein App-Fehler; der Nachweislauf lief danach.
  - Bewusst: keine Hover-Vorschau (20/24), Karten auf kleinen Handys unter
    44 px (Mindestmaß 24 px gemessen, Fehltipp öffnet nur die Ansicht),
    keine neuen Farb-Tokens, `sick` erst mit 18, mehrdeutige Spielsteine
    weiter ohne geratenes Bild.
- **Weiter mit:** Prompt 15 (Forge decision UI). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 15 — Forge decision UI — COMPLETE

- **Commits:** `cf4d2ad` Implementierung, `322e027` README/Übersicht/Bible,
  `7af8623` Nachbesserungen (Mulligan-Zähler, Touch-Größe der Vorschläge,
  E2E-Diagnose), `6e5b34a` (Text-Wachstum 28 %, ORYX-Attrappe im E2E),
  `3a0d80e` (E2E wartet auf die Zahlen nach dem Löschen) – Engine unverändert;
  alle Nachweise liefen auf `3a0d80e` (sauberer Arbeitsbaum), danach Doku und
  dieser Eintrag (2026-09-26). Agent: Claude Code (Claude Opus 5.5), Auftrag
  „Bitte führe das Standalone in Drop Zone für Open Mana aus“ (Dropzone
  `fixed/standalone.md` mit den Regeln aus `naechster-schritt.md`: genau ein
  Prompt, danach Stopp). Status-Commit zu Beginn: `a874aa5`. Parallel hat eine
  ORYX-Sitzung im selben Arbeitsbaum committet (`4d92b2a`, `18ad0df`,
  `c32da8c`: Cloud-Datei 1.1.x) – getrennt gehalten.
- **Zusammenfassung:** Jede Frage, die Forge dem Spieler stellt, lässt sich im
  **Entscheidungsbereich über der Hand** beantworten (im Querformat neben der
  eigenen Tischhälfte) – alle neun Fragearten des Protokolls: Forges zwei
  Knöpfe (Forges Worte; abgeschaltete sichtbar mit Grund; beim
  London-Mulligan die Zahl der markierten Karten), Auswahl (Karten auf dem
  Tisch dort antippen, Karten außerhalb des Tisches als Reihe im Bereich; wie
  viele, wie viele gewählt), Wahl aus einer Liste (Kreis/Kästchen/Kartenreihe,
  Suche ab 12 Einträgen, höchstens 50 Treffer zugleich, Rest genannt),
  Ja/Nein, Möglichkeiten (auch gezeigte Listen mit einer Taste), Zahl/Text,
  Reihenfolge (Forges Doppelliste), Hellsicht (oben/unten, Reihenfolge je
  Seite, Rest als Zahl), Verteilen (±, verteilt/offen). **Nichts wird für den
  Spieler entschieden:** Forges Vorschlag ist nur der erste Entwurf; ein
  Entwurf, der nicht zu Forges Zahlen passt, wird nie gesendet (Knopf aus,
  Grund dabei); Absendeknöpfe 500 ms nach Erscheinen ihrer Frage scharf,
  gehaltene Tasten wiederholen nichts; nichts, während Forge rechnet oder die
  Aufgabe unterwegs ist. **Rücknahmen und Ablehnungen:** eine zurückgezogene
  Frage nimmt Bedienung und Entwurf mit; die Ablehnung des Clients erscheint
  als Hinweis („Die Antwort wurde nicht gesendet“), Forges `input.rejected`
  als seine Meldung, die Frage bleibt offen. **Platz:** der Bereich wächst
  nur so weit nötig (`GameBoard decision`: `tall` für Text bis 28 %,
  `expanded` für Listen/Formulare bis 36 % hochkant; ein quer gehaltenes
  Handy gibt einer großen Frage die ganze Seitenspalte), die Antwortknöpfe
  kleben unten. Die echte Partie im Browser läuft jetzt über die erste
  Entscheidung hinaus. Kein Blocker, keine Regel im Client.
- **Wichtige Komponenten:**
  - `src/game/decision-model.ts` (rein: welche Frage, Entwürfe, Prüfungen
    gegen die Zahlen der Frage, Antworten), `decision-panel.tsx` (Bedienung
    aller Arten, `SendButton`), `game-table.tsx` (`onAnswer`, gemessenes
    Wachsen, Kartenansicht für Karten aus Fragen), `card-sheet.tsx`
    (`snapshot`, Fokus zurück zum Auslöser), `table-picture.tsx`,
    `game-page.tsx` (Antworten, Bilder der Fragekarten)
  - `src/engine/engine-session.ts` (`answer`), `engine-session-context.tsx`
  - `src/components/ui/game-decision.tsx`, `game-board.tsx` (`decision`),
    `checkbox.tsx` (Registry, `motion-reduce`), `src/index.css` (`short:`)
  - Tests/Prüfstand: `src/test/built-questions.ts`, `table-harness.tsx`
    (`window.__openmanaAnswers`, `&built=`), neue Szenen in
    `scripts/record-table-scenes.ts`; E2E `playRealGame`, `decisionFits`,
    `decisionInteractions`, Diagnose bei fehlender Entscheidung
  - Doku: `docs/implementation/15-forge-decisions.md`, `AGENTS.md` (Decision
    Rules), `docs/DESIGN_SYSTEM.md` (§4, §5), Bible §9 (Verweis),
    `README.md`, `STATUS.md`
- **Tests (alle bestanden, auf `3a0d80e`):**
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund.
  - **729 Vitest-Tests in 60 Dateien** (669 nach Prompt 14; 59 neue aus diesem
    Prompt, einer der ORYX-Sitzung): Entscheidungsmodell 22 (echte Szenen:
    Modus, Hellsicht, Fähigkeit, Kampfschaden, Ziel, Ziel = Spieler, zwei
    abwerfen, Spielen/Ziehen, Ja/Nein; gebaut: Ja/Nein-Frage, Zahl,
    Reihenfolge, Mehrfachwahl, Karten außerhalb; jede Antwort gegen den
    Protokoll-Prüfer), Bedienung 29 (jede Art im echten Tischcode,
    Scharfschalten, Gründe, Rücknahme samt Entwurf, nichts ohne den Spieler,
    Ansage, London-Mulligan), Sitzung +6 (`answer`), Seite +2 (mit dem
    echten Client: behalten → Priorität → Land über die Kartenansicht → neue
    Priorität neu scharf → weitergeben → Forges Ablehnung sichtbar; eine
    blockierende Wahl bis zu Forges Bestätigung); angepasst: Tisch,
    Beschriftungen, Szenenliste.
  - **Neue echte Szenen** (9, aus den vorhandenen Aufzeichnungen der
    Testpartien; die 7 alten Byte für Byte gleich): `play-draw`, `target`,
    `target-player`, `yes-no`, `discard`, `choose-mode`, `scry`, `ability`,
    `damage`.
  - **End-to-End** (`node scripts/e2e/run.ts` 11 min 14 s, Chrome
    153.0.8010.12, echte Engine `42f3bf1c7706cec5`, echter Katalog, echte
    Scryfall-API, **0 Befunde**): alle bisherigen Abschnitte; neu in 10:
    **die echte Partie wird gespielt** – Desktop (Maus, Constructed) und
    Handy (Touch): „Spielen“ → „Behalten“ → Land „Gebirge“ über seine
    Kartenansicht → „OK“, bleibende Karten 0 → 1, je 3,2–3,3 s, keine
    Meldung, Forges Knöpfe 40 px (Maus)/48 px (Touch), axe 0; neu in 12:
    **16 echte + 6 gebaute Szenen in sechs Größen** (132 Kombinationen, axe 0
    überall, Antwortknöpfe im Fenster, Touch-Kontrollen ≥ 44 px, Spielfelder
    bei großen Fragen ≥ 74 px) und **jede Art beantwortet** in drei Größen
    (kleines Handy, Handy quer, Desktop), jede Antwort exakt die des
    Protokolls.
- **Messwerte (odin):** Start-JavaScript unverändert 246,1 KB gzip -9
  (`4d92b2a` → `cf4d2ad` gleich gebaut; +3,2 KB gegenüber Prompt 14 stammen von
  der ORYX-Cloud-Datei 1.1.x); Partie-Seite (nachgeladen) 16,7 → 25,7 KB
  (25,8 KB auf `3a0d80e`). Partiestart mit vorgewärmter Engine 0,86–0,88 s.
- **Erkenntnisse/Abweichungen:**
  - **Texte der laufenden Schritte sind oft die vorigen:** Forges Zielauswahl
    nennt ihre Karten im Konstruktor, vor ihrer Anweisung; die Mulligan-Frage
    trägt den Text der vorigen Frage → der Bereich zeigt Forges aktuelle
    Anweisungszeile, nie den Fragetext (Anvil-Lehre vom 28.8.2026).
  - **Forges Knöpfe bleiben unter einer blockierenden Frage offen** (Modus
    während der Priorität, Hellsicht beim Bezahlen, Kampfschaden beim
    Angriff), sind dann aber nicht beantwortbar → nur die blockierende Frage
    wird gezeigt.
  - **Forges deutsche Übersetzung hat Fehler:** `lblNCombatDamage` =
    „{0} Commander-Schaden“ (Kampfschaden), `lblArrangeCardsToBePutOnTopOf
    YourLibrary` sagt „unter“ statt „oben“, `lblPayFirst` englisch → upstream
    bzw. Prompt 26.
  - **`select.cards` nennt auch Ids verdeckter Karten** (die Einträge verbergen
    sie richtig; die App nutzt nur die Einträge) → mit dem Engine-Neubau in 16.
  - **Auswahl ohne Karte = Spieler als Ziel:** Forge prüft Spieler erst beim
    Tipp → der Bereich sagt ehrlich „noch nicht wählbar“, „Abbrechen“ führt
    weiter; Spieler als Ziele: 17.
  - **Abwerfen einer genauen Zahl kommt ohne Knöpfe** (Forge beendet selbst).
  - **`toAnywhere` beim Anordnen setzt der gepinnte Forge nie** (nur
    `arrangeForMove` ruft, mit `false`) – die Lücke aus 02 ist damit keine.
  - Bewusst: Wahl/Möglichkeiten/Reihenfolge/Hellsicht/Verteilen erst markieren,
    dann bestätigen (Anvil 28.8.); Forges „OK“/„Zug beenden“ unverändert (16);
    abgeschaltete Knöpfe sichtbar (19 prüft das Blocken); Verteilen beginnt bei
    Forges Minimum (tödlichen Schaden rechnet die App nicht aus).
  - **E2E und odin:** `earlyoom` beendete zwei Läufe (SIGTERM, Exit 143), als
    andere Sitzungen schwere node-Jobs fuhren und der Swap voll war; ein
    erster Lauf sah die Commander-Partie 180 s lang ohne Entscheidung (danach
    dreimal in 0,87 s, nachgestellt in 0,3 s) – der Test sagt bei so einem
    Hänger jetzt, was die Seite zeigt. Der Prüfstand bekommt je Szene eine
    frische Seite (ein Lauf mit allem in einer Seite erschöpfte Chrome). Die
    ORYX-Attrappe beantwortet die neue Spielzeit-Meldung der Cloud-Datei 1.1.x;
    eine Prüfung nach dem Löschen der Website-Daten wartet jetzt auf die
    Zahlen. Details: `docs/implementation/15-forge-decisions.md` §9.6, §10.
- **Weiter mit:** Prompt 16 (Priority, stack and phases). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

### 16 — Priority, stack and phases — COMPLETE

- **Commits:** `6eb3087` Engine (Protokoll 5, Testpartie `priority-respond`,
  JVM-Tests), `9f3ff08` JVM-Test („Zug beenden“ hält beim Zauberspruch und
  Angriff der KI an), `492e07d` Oberfläche, `519c745` E2E (Entwicklungsserver
  erst aufwärmen), `977b204` Test ohne implizites `any`, `eb4ff6c`
  Kartenbild-Nachschlag und E2E (Protokollversion, ausgeblendete Tippziele),
  `dca8e9f` Worte der Priorität in eigenem Modul, `e2892b4` E2E (axe nach
  Übergängen). Engine-Build und Differenztests auf `6eb3087`
  (`engineSourcesModified: false`, Engine-Quellen seitdem unverändert), die
  65 JVM-Tests auf `eb4ff6c`, der Gesamtlauf `npm run check` auf `e2892b4` –
  jeweils sauberer Arbeitsbaum; danach Doku und dieser Eintrag (2026-09-26).
  Agent: Claude Code (Claude Opus 5.5), Auftrag „Standalone von Dropzone für
  OpenMana, bitte.“ (Dropzone `fixed/standalone.md` mit den Regeln aus
  `naechster-schritt.md`: genau ein Prompt, danach Stopp). Status-Commit zu
  Beginn: `82a02c9`.
- **Zusammenfassung:** Zug, Phase, Priorität und Stapel sind ohne
  Forge-Wissen verständlich, ohne eine Regel im Client. **Kopfzeile:** Forges
  Schritt in Worten, eine **Phasenleiste** (13 Schritte in fünf Phasen, der
  laufende breit in Gold, die vergangenen gedämpft) und wer am Zug ist.
  **Priorität in Worten** statt Forges Lagebericht, nur aus Forges Zustand
  (wessen Zug, was oben auf dem Stapel liegt – dessen Karte daneben): „Du
  kannst jetzt eine Karte spielen – oder weitergeben.“, „Zug der Forge-KI: …“,
  „Die Forge-KI hat „X“ gewirkt. Du kannst darauf antworten – oder es
  verrechnen lassen.“ **Forges Knöpfe nach ihrer Bedeutung**
  (`Button.meaning`, von der Bridge an Forges Textschlüsseln erkannt): OK =
  „Weiter“ bzw. mit etwas auf dem Stapel „Verrechnen lassen“, darüber ein
  Satz, was das Abgeben bewirkt; „Zug beenden“ nur nach Rückfrage
  (`AlertDialog`: gibt den Rest des Zuges weg, auch einen eigenen Angriff;
  Forge hält beim Zauberspruch oder Angriff der KI an); „Rückgängig (n)“ mit
  Forges Worten, sofort. **Forges APINA bleibt Forges:** jede Priorität am
  Tisch ist eine, in der Forge etwas für den Spieler fand (in allen
  Testpartien belegt); die App gibt nie selbst weiter. **Stapel mit Karten:**
  jeder Eintrag mit seiner Karte (Zauberspruch: die eigene, Fähigkeit: die
  Quelle; verdeckt: Rückseite), Art, wessen, Zielen und Forges Text; das Bild
  öffnet die Kartenansicht (wo auf dem Stapel, wie viel darüber – ansehen, nie
  antippen). Karten spielt man durch Antippen (Prompt 14), nie über eine Liste
  der App. **Engine, Protokoll 5:** `StackItem.card`/`ability`,
  `Button.meaning`, `select.cards` nur sichtbare Ids, `action` bei Priorität
  und Bezahlen nur für eigene und von Forge markierte Karten (die Nebenwirkung
  aus Befund 05 §7.2 ist weg). Kein Blocker, keine Regel im Client.
- **Wichtige Komponenten:**
  - `src/game/turn-model.ts` (rein: Schritte in Phasen, Stapelart, Oberstes,
    wessen Zug, Priorität des Spielers), `priority-labels.ts` (Worte; nur die
    Partie-Seite lädt sie), `decision-panel.tsx` (`PriorityDecision`,
    `EndTurnButton`, `ForgeWorking`), `game-table.tsx` (`TurnTrack`,
    `StackEntry`), `card-sheet.tsx` (`StackFacts`), `table-model.ts`
    (Stapelkarten, `stackEntriesOf`), `card-use.ts` (Stapelkarte: nur ansehen),
    `table-labels.ts`, `src/components/ui/phase-track.tsx`,
    `src/cards/card-lookup.ts` (Name = Seite einer anderen Karte)
  - Engine: `StateBuilder` (Stapelkarten, `mayAskAction`), `BridgeGuiGame`
    (`meaningOf`, sichtbare Auswahl-Ids), `Protocol` (Version 5,
    `MEANING_*`), Schema/Typen/Beispiele, `ScriptedHuman` (`play: respond`),
    `engine/fixtures/differential/priority-respond.json`,
    `engine/wasm/spike/trace.ts` (`priority-response`,
    `priority-opponent-turn` Pflicht), `PriorityStackTest`
  - Tests/Prüfstand: drei neue Szenen in `scripts/record-table-scenes.ts`
    (`opponent-turn`, `respond`, `respond-own`); E2E: echte Partie mit
    „Weiter“ und Phasenleiste, Prioritätsantworten samt Rückfrage, Stapelkarte
    in der Kartenansicht, Aufwärmen des Entwicklungsservers, axe nach
    Übergängen, Protokollversion aus der Konstante
  - Doku: `docs/implementation/16-priority-stack-phases.md`, `AGENTS.md`
    („Priority, Stack and Turn Rules“), `docs/DESIGN_SYSTEM.md` (Priorität,
    Stapel, `PhaseTrack`, Regel 4), Bible §6 (Verweis), `README.md`,
    `STATUS.md`, `engine/protocol/README.md` (Version 5),
    `engine/fixtures/README.md`
- **Tests (alle bestanden):**
  - **Engine:** Build (349,5 s, `native-image` 108 s bei 6,0 GiB);
    Differenztests **72 Läufe, 0 Fehler** – `priority-respond` JVM = Node =
    Chrome (Forge-Protokoll `91697aa7…`, 443 Nachrichten `7a3447e3…`, Spur 319
    Einträge gleich), Referenzpartien wie seit 02 (`c1e990c6…`,
    `7c3f673f…`), Abdeckung vollständig; **65 JVM-Tests** (neu
    `PriorityStackTest` 9: APINA, Knopfbedeutungen, „Zug beenden“ im eigenen
    Zug ohne Angriff und im Zug der KI mit Halt bei Zauberspruch (Zug 4) und
    Angriff (Zug 8), „Rückgängig (1)“ nimmt ein Mana-Land zurück,
    Stapelkarten, Antwort über dem KI-Zauber, Ansehen ohne Nebenwirkung,
    sichtbare Auswahl-Ids; Vertrag Bedeutungen = Schema); **81
    Engine-Unit-Tests**.
  - **Prioritäten in allen zwölf Testpartien:** 241, **jede mit `canAct`**
    und einer von Forge markierten Karte; 53 im Zug der KI (52 in
    `priority-respond`), 8 mit etwas auf dem Stapel.
  - Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund; **759
    Vitest-Tests in 62 Dateien** (729 nach Prompt 15, 30 neue): Zugmodell 13,
    Priorität im echten Tischcode 13, Seite +2 (mit dem echten Client:
    Rückfrage vor „Zug beenden“, Kopfzeile), Tischmodell +1, Karten-Nachschlag
    +1; angepasst: Entscheidungsbereich, Tisch, Beschriftungen.
  - **End-to-End** (`npm run check` 11 min 51 s, Chrome 153.0.8010.12, echte
    Engine `79b08e1a19afa7ae`, **0 Befunde**): echte Partie Desktop/Handy
    „Spielen“ → „Behalten“ → Land über die Kartenansicht → **„Weiter“**,
    Phasenleiste = Forges Schritt (`MAIN1`), Knöpfe 40/48 px, 3,2/3,3 s;
    **19 echte + 6 gebaute Szenen in sechs Größen** (150 Kombinationen, axe
    0, kleinstes Tippziel 29 × 40 px = Stapelkarte); in drei Größen
    „Weiter“, „Verrechnen lassen“ und „Zug beenden …“ → Rückfrage →
    „Weiterspielen“ (nichts gesendet) → „Zug beenden“ (Knopf 2); in allen
    sechs die Kartenansicht einer Stapelkarte.
- **Messwerte (odin):** Start-JavaScript unverändert 251,4 → 251,5 KB gzip -9
  (`a651b2a` → `dca8e9f`, nur Oberfläche gebaut); Partie-Seite
  (nachgeladen) 26,4 → 28,9 KB. Engine-Modul 78,95 MB / 13,09 MB Brotli.
  Entscheidungsbereich bei der Priorität: Tabelle in der Doku §10.3.
- **Erkenntnisse/Abweichungen:**
  - **APINA ist lückenlos** – die App braucht (und hat) kein eigenes
    Weitergeben; wo Forge fragt, gibt es etwas zu entscheiden.
  - **Die Nebenwirkung des Ansehens gab es auch beim Bezahlen**
    (`InputPayMana.getActivateAction` → `getAllManaAbilities`); beide
    beschränkt, Partien unverändert.
  - **Forges Stapeltexte sind für Zaubersprüche englisch**, auch in de-DE
    („Schock (29) deals 2 damage to …“) → gezeigt wie gesendet, Name, Art,
    Besitzer und Ziele deutsch aus den Feldern; upstream bzw. 26.
  - **„Zug beenden“ lässt den eigenen Angriff aus** (Forge,
    `declareAttackers`) – daher die Rückfrage; Forges Unterbrechungen bei
    Zauberspruch/Angriff der KI wirken auch ohne Forges Oberfläche (geprüft).
  - **Kartenbild:** „Rampant Growth“ ist auch die zweite Seite von „Studious
    First-Year“ → `resolveEngineKey` entscheidet jetzt nach Forges eigenem
    Namen (`forgeNames`); vorher ohne Bild.
  - **E2E:** Vite bündelt nach einem Engine-Neubau neu und lädt die Seite
    einmal neu → Aufwärmen; axe maß mitten im Überblenden (`transition-all`)
    → wartet Übergänge ab; die Protokollversion stand fest im Test (wie in
    12) → aus der Konstante. Start-JavaScript: neue Worte in
    `game-labels.ts` zogen 2,3 KB in den Start → eigenes Modul.
  - **odin:** `/tmp` war zu 90 % voll (Arbeitsordner anderer Sitzungen) →
    Engine-Build, Differenz- und Gesamttest mit Arbeitsordnern unter
    `engine/build/tmp`; ohne Einfluss auf die Ergebnisse.
  - Bewusst: kein eigener Auto-Pass, kein Zeitlimit; Forges Stapeltext
    bleibt (zweite Zeile); die Leiste zeigt Balken statt Namen (360 px);
    Details `docs/implementation/16-priority-stack-phases.md` §11, §12.
- **Weiter mit:** Prompt 17 (Targeting and cost payment). Nicht begonnen:
  `naechster-schritt.md` führt genau einen Prompt je Lauf aus.

## Hinweise für spätere Prompts

### Spielsitzung (Stand 2026-09-25, für 12 ff.)

Seit Prompt 11 läuft eine Partie über die eine `EngineSession`
(`src/engine/engine-session.ts`, Doku `docs/implementation/11-game-session.md`):

- **12:** Das KI-Profil steht in `src/game/match-setup.ts`
  (`DEFAULT_AI_PROFILE = "Default"`, `matchSetup(…, { profile })`); die
  Start-Argumente der Engine in `ENGINE_ARGS` (`--card-loading=eager
  --language=de-DE`). Die Spielen-Seite zeigt „Profil Standard (Forges
  Vorgabe)“ – die Wahl gehört dorthin bzw. in die Einstellungen.
- **13–16:** Der Partie-Zustand (`MatchSnapshot` `playing`) hat schon den
  letzten vollständigen `state`, die offenen `questions`, Forges
  Anweisungszeile `prompt`, `waiting` und Forges Meldungen (`notices`). Die
  Sitzung sendet bisher nur `concede`; Antworten und Antippen
  (`EngineClient.answer`, `tapCard`, `tapPlayer`) brauchen neue
  Sitzungsmethoden. Die Partie-Seite `/play/game` (nachgeladen) ist der Ort des
  Spieltischs. **Achtung:** Gewinnt der Spieler den Münzwurf, ist die erste
  Frage „Spielen oder Ziehen?“ (Knöpfe **ohne** `purpose`, vor den Starthänden),
  sonst der Mulligan; Forges Anweisung kommt als eigene `prompt`-Nachricht
  **nach** der Frage (deren Text ist leer).
- **21:** `events` (Forges Spielprotokoll, deutsch, mit `actor`) kommen an, die
  Sitzung verwirft sie noch.
- **22:** `MatchSetup` hält alles für die Aufzeichnung: die genaue
  `match.start`-Anfrage (Kopie beider Decks), den **von der App gezogenen Seed**
  (48 Bit), Profil, Deck-Ids und ob das KI-Deck gezogen wurde.
- **Offen:** Forge prüft Decks beim Start nicht, und
  `DeckFormat.getDeckConformanceProblem` liefert nur englische
  Satzbruchstücke – eine Legalitätsanzeige braucht strukturierte oder
  übersetzte Befunde (upstream). Arenas Brawl-Decks spielt Forge als Commander
  (das Protokoll kennt kein Brawl).

### Einstellungen, KI-Profile, Kartensprache, Bewegung (Stand 2026-09-25, für 13 ff.)

Seit Prompt 12 (`docs/implementation/12-ai-profiles-settings.md`):

- **13–20 (Spieltisch):** Jede Karte des Spieltischs zeigt der Katalog in der
  Kartensprache des Spielers: `cardDisplay(card, { language:
  usePreferences().cardLanguage })`, nie eine eigene Sprachlogik. Forges
  eigene Kartentexte (`VisibleCard.name/typeLine/text`) kommen schon in der
  Kartensprache (`--card-language`), Forges Sätze deutsch.
- **Bewegung:** Eigene Animationen des Spieltischs (Karten ziehen, Angriff,
  Stapel) fragen `useDeviceReducedMotion()`/`reducedMotion()` mit
  `usePreferences().motion` (`src/app/motion.ts`); CSS-Animationen nur über
  shadcn-Bausteine mit `motion-reduce:…!` (ein Test prüft
  `src/components/ui`). Ein neuer shadcn-Baustein braucht die Klassen samt
  Kommentar.
- **KI-Profil:** `game.started.aiProfile` ist Forges Bestätigung (die
  Partie zeigt sie beim Gegner); `MatchSetup.ai.profileDrawn` sagt, ob
  gezogen – beides für die Aufzeichnung (22). Ein Forge-Update, das eine
  Profildatei ändert, stoppt den Build (`vite/engine-assets.ts`): Studie
  `engine/scripts/ai-profile-study.sh` neu laufen lassen (~25 min),
  `src/game/ai-profile-table.ts` und `docs/research/AI_PROFILES.md`
  nachziehen (26).
- **Diagnose:** `src/app/diagnostics.ts` ist der Ort für weitere
  Versionsangaben (Service Worker/Cache ab 25, Auslieferung ab 31).
- ⚠️ `engine/scripts/build.sh` löscht `engine/build/report` – Ergebnisse der
  Studie vorher sichern.

### Spieltisch (Stand 2026-09-25, für 14 ff.)

Seit Prompt 13 ist die laufende Partie der Spieltisch
(`src/game/game-table.tsx`, Doku `docs/implementation/13-battlefield-foundation.md`):

- **14 (Karten, Hand) – erledigt, siehe „Karten und Bedienung“ unten.** Karten sind `GameCard`s (`src/components/ui/game-card.tsx`)
  in `CardRow`s; `FieldCard`, `Entry`, `Hand` in `game-table.tsx` rendern sie,
  jede trägt `data-card` = Forges Id. Forges Markierungen (`playable`,
  `action`, `ways`, `highlighted`) liegen im Zustand, sind aber noch nicht
  gezeigt; ein Zustand braucht ein Token-Paar (Design-System §6) und darf
  **nie auf das Bild** (Rahmen um die Karte oder Leiste darunter). Ein Stapel
  (`BoardEntry.ids`) ist eine Karte mit Anzahl – wer eine davon bedient,
  muss eine Id wählen (Anvil: die erste); von Fragen genannte Karten liegen
  schon einzeln (`namedCardIds`). Reihen haben `tabIndex=0` (Tastatur
  rollt sie), bis ihre Karten selbst fokussierbar sind – dann die Reihe
  weiter per Tastatur rollbar halten. Mehrdeutige Spielsteine zeigen Forges
  Worte (Befund 11.5): Kandidat für ein eindeutiges Bild.
- **15 (Entscheidungen) – erledigt, siehe „Entscheidungen“ unten.** Der Bereich `decision` (`Decision` in
  `game-table.tsx`) zeigt Anweisung, Frageart und Forges Antworten als
  Marken mit dem Satz „Hier kannst du noch nicht antworten …“ – den ersetzen
  die Bedienelemente; die Sitzung braucht `answer`. Forges Knöpfe sind teils
  englisch („Call Back“, „Auto“, „Cancel“) → nach `purpose` deutsch
  beschriften. `GameTable` bekommt heute `menu` und `alerts` von außen; die
  Bedienung kommt am besten ebenso von der Seite (der Tisch bleibt Ansicht,
  auch für 22).
- **16 (Priorität, Stapel):** Stapel im Bereich `center`, oben zuerst
  (`StackEntryView`); für Zauber gibt es nur Forges Text, weil ihre Karte in
  Forges Stapelzone liegt → Vorschlag `StackItem.card` (VisibleCard) mit
  Protokoll 5. Die Phasenleiste gehört in den Kopf (`header`, heute „Zug 3 ·
  Erste Hauptphase“).
- **17 (Ziele, Kosten):** Ziele der Stapeleinträge sind aufgelöst
  (`CardRef`/`PlayerRef`); Hervorhebung über `data-card` am `GameCard`.
- **18/19 (Kampf):** Kampfzeilen im `center` (gleiche ungeblockte Angreifer
  gebündelt); Angreifer/Blocker tragen Schwert/Schild in der Leiste;
  Kampfkarten liegen nie im Stapel. `sick` ist noch nicht gezeigt.
- **20 (Zonen):** Friedhof und Exil sind Zahlen in den Spielerleisten
  (`Count`), die Kommandozone Karten vorne in der äußeren Reihe.
- **21 (Verlauf):** Im Tisch ist kein Bereich dafür reserviert (Vorschlag:
  Menü oder eigenes Sheet); die Sitzung verwirft `events` noch.
- **22 (Wiedergabe):** `GameTable` ist eine reine Ansicht (state, questions,
  prompt, waiting, aiProfile, pictures, menu, alerts); wie man sie mit
  aufgezeichneten Zuständen und dem Katalog füttert, zeigt
  `src/test/table-harness.tsx`.
- **24 (Größen):** E2E-Abschnitt 12 prüft sechs Größen mit echten Szenen;
  eng bleibt das Handy quer (Spielfelder ~120 px, eine Reihe). Neue echte
  Szenen: `engine/scripts/test-engine.sh`, dann
  `node scripts/record-table-scenes.ts`.
- ⚠️ `sr-only`-Texte in rollenden Bereichen brauchen einen positionierten
  Vorfahren, sonst rollt die ganze Seite (Befund 11.1).
- ⚠️ Kartenbilder im Tisch haben `srcset` + `sizes="auto"`: eine Umordnung
  nach dem ersten Zeichnen lässt den Browser begonnene Bilder verwerfen
  (E2E: `requestfailed`) – Maße vor dem ersten Zeichnen nehmen
  (`useElementHeight`).

### Karten und Bedienung (Stand 2026-09-26, für 15 ff.)

Seit Prompt 14 ist jede sichtbare Karte bedienbar
(`src/game/card-use.ts`, `card-sheet.tsx`, Doku
`docs/implementation/14-card-hand-interactions.md`, Regeln in `AGENTS.md`
„Card Interaction Rules“):

- **15 (Entscheidungen) – erledigt, siehe „Entscheidungen“ unten.** Die Sitzung hat `tapCard` (nur solange Forge
  wartet, deutsche Gründe, `InputResult`); `answer` gehört genauso daneben
  (`EngineSession`, `useEngineSession`, an den Tisch wie `onTapCard`). Was 14
  schon abdeckt und 15 nur ergänzen muss:
  - **London-Mulligan** (`purpose` `mulliganBottom`): Tipps auf eigene
    Handkarten wirken sofort („Unter die Bibliothek legen“/„Doch behalten“,
    Forges `highlighted` = gewählt); 15 braucht Anzahl und Forges OK-Knopf.
  - **Auswahl** (`select`): genannte Karten wählen sofort (`card.tap` – die
    Bridge macht daraus dasselbe `selectCard` wie `answer select`); 15 braucht
    die Liste für Einträge ohne Tischkarte (Spieler, verdeckte, Karten aus
    Zonen) und `min`/`max`.
  - **Mehrere Wege** (`ways` ≥ 2): die Ansicht nennt sie; nach dem Tipp fragt
    Forge mit einer `options`-Frage (blockierend) – die beantwortet 15.
  - Der Hinweis im Entscheidungsbereich („Auf Forges Fragen kannst du hier
    noch nicht antworten …“, in Sofort-Schritten „Karten antippen wirkt hier
    sofort …“) wird durch die Bedienelemente ersetzt bzw. angepasst.
  - Die Live-Partie erreicht erst mit 15 die Priorität: dann im E2E die
    Kartenbedienung im echten Spiel prüfen (Land spielen über die Ansicht).
- **16 (Priorität, Stapel):** Engine-Neubau (`StackItem.card`, Protokoll 5)
  mit der **`action`-Nebenwirkung** (Befund 05 §7.2, 14 §11.6): `action`
  bei der Priorität nur für eigene und von Forge als spielbar markierte
  Karten. Danach `test-engine.sh` und `record-table-scenes.ts` neu; E2E
  `SCENE_MARKS` und `card-use.test.ts` prüfen, ob sich Markierungen ändern.
- **17 (Ziele, Kosten):** Spieler als Ziel antippen (`player.tap`); Forges
  Hervorhebung für Spieler (`setHighlighted(PlayerView)`) fehlt noch im
  Protokoll (heute nur Karten). Bezahlen tippt schon sofort; Quelle und
  nötige Anzahl zeigen.
- **18/19 (Kampf):** Angreifen/Blocken tippt schon sofort („kann
  angreifen“/„kann blocken“ = Forges `playable`, `highlighted` = aktueller
  Angreifer/Verteidiger); Forges englische Wörter („Remove card from
  combat“, „Declare blockers for card“) nach Schritt und Markern deutsch
  fassen; `sick` zeigen; Angreifer, die man beim Blocken wählen kann, haben
  heute keinen Rahmen (nur `action`).
- **20 (Zonen, Kartenansicht):** `card-sheet.tsx` ist die Grundlage der
  großen Kartenansicht; `locateCard`/`placeLabel` kennen Friedhof und Exil
  schon. Fehlt: Zonen blättern, Stapel gleicher Karten durchblättern,
  doppelseitige Karten drehen, Hover-Vorschau am Desktop, Bild eindeutiger
  Spielsteine über Forges `set`.
- **22 (Wiedergabe):** `GameTable` ohne `onTapCard` = nur ansehen (die
  Ansicht sagt „Forge bot an: …“).
- **24 (Größen):** Karten auf kleinen Handys unter 44 px (gemessen ≥ 24 px,
  E2E `cardTargets`); die Ansicht und ihre Knöpfe haben volle Touch-Größe.
- ⚠️ **Tests:** Radix bewegt den Fokus bei Pfeiltasten und gibt ihn nach
  einem Dialog **einen Takt später** → `waitFor`/`waitForFunction`;
  `src/test/setup.ts` wartet nach dem Aufräumen einen Takt. Der
  Scharfschalt-Schutz liest `performance.now()` → in Tests
  `vi.spyOn(performance, "now")`.
- ⚠️ **E2E nachts:** Um ca. 01:00 stoppt `restic-backup-system.sh`
  Datenbank-Container; Chrome meldet dann `net::ERR_NETWORK_CHANGED` für
  laufende Scryfall-Bilder → Lauf wiederholen, kein App-Fehler.

### Entscheidungen (Stand 2026-09-26, für 16 ff.)

Seit Prompt 15 beantwortet der Spieler jede Frage Forges im
Entscheidungsbereich (`src/game/decision-panel.tsx`, Regeln in
`decision-model.ts`, Doku `docs/implementation/15-forge-decisions.md`, Regeln in
`AGENTS.md` „Decision Rules“):

- **16 (Priorität, Stapel):** Forges Knöpfe stehen wie gesendet („OK“ =
  Priorität abgeben, „Zug beenden“); die Anweisungszeile der Priorität ist
  Forges Lagebericht („Priorität: Player Zug: 8 (Player) Phase: … Stapel:
  Leer“) – Anvil ersetzte ihn durch eine Phasenleiste. Ort: `StepDecision`/
  `ForgeButtons` (Kopfzeile = `questionLabel`). Mit dem Engine-Neubau
  (Protokoll 5): `select.cards` nur mit Ids sichtbarer Karten senden (Befund
  15 §10.4). Unter einer blockierenden Frage bleiben die Knöpfe des Schritts
  offen (§10.2) – `currentDecision` zeigt nur die blockierende.
- **17 (Ziele, Kosten):** Eine Auswahl ohne Karte heißt „Spieler als Ziel“;
  der Bereich sagt heute ehrlich, dass Spieler noch nicht wählbar sind
  (`SelectPart`). Forge prüft Spieler erst beim Tipp
  (`InputSelectTargets.onPlayerSelected`; bei `InputSelectEntitiesFromList`
  stehen sie in `getValidChoices`) → gültige Spieler ins Protokoll, dann
  `player.tap` an der Spielerleiste. Die fragende Karte steht schon im Kopf
  des Bereichs (beim Bezahlen der Zauber).
- **18/19 (Kampf):** Kampfschaden verteilen (`distribute`) ohne den
  verteidigenden Spieler (Trampelschaden, Lücke seit 02); die Knöpfe des
  erklärten Angriffs bleiben unter der Verteilfrage offen. Forges „OK“ beim
  Angreifen/Blocken heißt je nach Lage „kein Angriff“/„so angreifen“ (Anvil).
- **20 (Zonen):** Karten aus Friedhof/Exil einer Auswahl stehen heute als
  Reihe im Entscheidungsbereich; die Kartenansicht zeigt Karten aus Fragen
  (`CardLook.snapshot`).
- **22 (Wiedergabe):** `GameTable` ohne `onAnswer` zeigt Fragen, Knöpfe aus
  („Nur ansehen“); `data-question` am Bereich nennt die Frage.
- **24 (Größen):** kleinstes Handy mit großer Frage und Stapel: Spielfelder
  ≥ 74 px (E2E-Grenze bei `expanded` 64 px); Querformat-Handy: der Stapel
  weicht einer großen Frage.
- **26 (Forge-Update):** Forges deutsche Übersetzungsfehler
  (`lblNCombatDamage` = „Commander-Schaden“, `lblArrangeCardsToBePutOnTopOf
  YourLibrary` = „unter“, `lblPayFirst` englisch); `toAnywhere` beim Anordnen
  wird im gepinnten Forge nie gesetzt.
- ⚠️ **Tests:** Absendeknöpfe sind erst `ARMING_MS` nach ihrer Frage scharf –
  in Vitest `performance.now` mocken und vorrücken, im E2E `ARMED_AFTER_MS`
  warten. Die Szenen sind echte Momente der Testpartien; Fragearten, die sie
  nicht erreichen, baut `src/test/built-questions.ts` (als gebaut markiert).
- ⚠️ **E2E-Prüfstand:** je Szene eine frische Seite (sonst erschöpfte Chrome
  auf dem vollen odin die Ressourcen); keine Protokoll-Prüfer im Prüfstand.

### Priorität, Stapel und Phasen (Stand 2026-09-26, für 17 ff.)

Seit Prompt 16 spricht die Priorität in Worten, der Stapel zeigt Karten und
die Kopfzeile den Zug (`src/game/turn-model.ts`, `priority-labels.ts`,
`PriorityDecision` in `decision-panel.tsx`, Doku
`docs/implementation/16-priority-stack-phases.md`, Regeln in `AGENTS.md`
„Priority, Stack and Turn Rules“):

- **17 (Ziele, Kosten):** Spieler als Ziel fehlen weiter (`player.tap`,
  Forges gültige Spieler ins Protokoll). `action` wird bei Priorität und
  Bezahlen nur noch für eigene und von Forge markierte Karten gefragt
  (`StateBuilder.mayAskAction`, wegen Forges Nebenwirkung) – braucht 17 dort
  eine Karte der KI, zuerst prüfen, ob Forge sie markiert. Stapeleinträge
  tragen `targets` und die Karte (Zauberspruch bzw. Quelle); die Auswahl eines
  Ziels ist weiter Prompt 15s `select`, nicht `PriorityDecision` (die nur ohne
  offene Auswahl gilt).
- **18/19 (Kampf):** `Button.meaning` gibt es nur bei der Priorität
  (`BridgeGuiGame.meaningOf`); Forges OK beim Angreifen/Blocken braucht eigene
  Bedeutungen auf demselben Weg (Forges Textschlüssel, nie die Beschriftung).
  Nach „Zug beenden“ fragt Forge im eigenen Zug nicht mehr nach Angreifern
  (so gewollt, die Rückfrage sagt es). Die Phasenleiste überspringt
  ausgelassene Kampfschritte von selbst.
- **21 (Verlauf):** Was die KI tat, während Forge rechnete, zeigt der Tisch
  noch nicht (`ForgeWorking` sagt nur, wer dran ist). Forges Stapeltexte für
  Zaubersprüche sind englisch.
- **22 (Wiedergabe):** `PriorityDecision` und `EndTurnButton` hängen am selben
  `blocked` wie alle Knöpfe – ohne `onAnswer` „Nur ansehen“, alles aus.
- **24 (Größen):** Handy quer und kleines Handy mit Stapel: der Inhalt der
  Priorität ist höher als der Bereich (129/199 bzw. 207/215 px) und rollt, die
  Knöpfe kleben unten; kleinstes Tippziel die Stapelkarte 29 × 40 px.
- **26 (Forge-Update):** `meaningOf` liest `lblOK`/`lblEndTurn`/`lblUndo`,
  `ScriptedHuman` erkennt Länder an `lblPlayLand` – ändert Forge diese
  Schlüssel, schlagen `PriorityStackTest`/Differenztests an. Englische
  Stapeltexte in de-DE (`getStackDescription`) upstream melden. Kartennamen,
  die zugleich Seite einer anderen Karte sind, entscheidet der Katalog nach
  `forgeNames`.
- ⚠️ **Tests:** Nach einem Engine-Neubau lädt der erste Entwicklungsserver die
  Seite einmal neu (Vite bündelt neu) – der E2E wärmt ihn auf. axe erst nach
  Übergängen messen (Knöpfe, Marken haben `transition-all`). Nie eine
  Protokollversion fest in einen Test schreiben (`PROTOCOL_VERSION`). Die
  Szenen wählt `record-table-scenes.ts` nach Regeln, nicht nach Nummern (die
  verschieben sich mit jeder Engine-Änderung).
- ⚠️ **odin:** Ist `/tmp` voll, Engine-Build und Tests mit Arbeitsordnern auf
  der Platte fahren (`TMPDIR`, `JDK_JAVA_OPTIONS=-Djava.io.tmpdir=…`,
  `NATIVE_IMAGE_OPTIONS=-J-Djava.io.tmpdir=…` unter `engine/build/tmp`); die
  Ordner anderer Sitzungen nicht löschen.

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
- ⚠️ **Überholt am 2026-09-25 (dev0gig): keine eigene APK und kein
  Warehouse-Eintrag.** OpenMana läuft auf Android nur in der globalen ORYX-App
  (TWA `net.tsnet.oryx`, OpenMana steht dort schon in der Vertrauensliste).
  Prompt 28 vor Beginn mit dev0gig neu fassen; übrig bleiben voraussichtlich
  `/.well-known/assetlinks.json` für ORYX und der Nachweis, dass die Engine in
  ORYX läuft. Die beiden folgenden Punkte sind damit Geschichte.
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

