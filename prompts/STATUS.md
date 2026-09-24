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
| Aktuell ausgeführt | **02 — Anvil bridge single-thread spike** |
| Nächster Prompt | 03 — Worker transport and protocol (erst nach 02 = COMPLETE) |
| Zuletzt abgeschlossen | 01 — Forge WASM engine spike (`b64835a`) |
| Ausführender Agent | Claude Code (Claude Opus 5.5), Sitzung vom 2026-09-24 |
| Letzte Aktualisierung | 2026-09-24 |

## Übersicht

| # | Prompt | Status | Commit |
|---|---|---|---|
| 00 | [Research: ManaBrew / Forge WebAssembly](queue/00-research-manabrew-forge-wasm.md) | COMPLETE | `681ce0a` |
| 01 | [Forge WASM engine spike](queue/01-engine-spike.md) | COMPLETE | `b64835a` |
| 02 | [Anvil bridge single-thread spike](queue/02-anvil-bridge-single-thread.md) | IN_PROGRESS | – |
| 03 | [Worker transport and protocol](queue/03-worker-transport-protocol.md) | PENDING | – |
| 04 | [Forge resources and card scripts](queue/04-forge-resources-card-scripts.md) | PENDING | – |
| 05 | [JVM/WASM differential tests](queue/05-engine-differential-tests.md) | PENDING | – |
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

### 02 — Anvil bridge single-thread spike — IN_PROGRESS

- Begonnen am 2026-09-24 von Claude Code (Claude Opus 5.5), direkt nach 01.
