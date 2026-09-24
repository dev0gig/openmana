# 01 — Forge-WASM-Engine-Spike

> Umsetzung von [`prompts/queue/01-engine-spike.md`](../../prompts/queue/01-engine-spike.md),
> Stand **2026-09-24**, ausgeführt von Claude Code. Grundlage:
> [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md) (Bedingung 1).
> Code: [`engine/`](../../engine/README.md). Alle Zahlen sind eigene Messungen auf odin
> (Intel i7-8700T, 12 Threads, 15,5 GiB RAM, Debian 13).

## Ergebnis

**Der Spike ist gelungen.** Forge upstream (`Card-Forge/forge@ed0333f`) plus drei
kleine GPL-Patches läuft als WebAssembly (Oracle GraalVM 25.4.4.1.1 Web Image) in
einem **Dedicated Worker in Chrome 153** und spielt dort eine komplette Partie
Forge-KI gegen Forge-KI. Dieselbe Partie läuft auf der JVM und in Node;
**alle drei Laufzeiten erzeugen Zeichen für Zeichen dasselbe Forge-Spielprotokoll**
(SHA-256 über das GameLog, drei Szenarien). Ein Browser ohne Cross-Origin-Isolation
bekommt nach 67 ms eine klare Meldung statt eines stillen Hängers.

Kein Befund widerlegt eine Annahme der Research. Neu gefunden und behoben wurden
zwei Stolpersteine, die ohne Test unbemerkt geblieben wären (§6: tinylog-Ausgaben
gingen verloren; fehlende Dateien werfen im Wasm eine andere Ausnahme).

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Forge-Pin | `engine/forge` (Submodule, `shallow = true`) | `Card-Forge/forge@ed0333fecb1fea0671b3e50cadc1da4f71db5798` (master vom 2026-09-24, derselbe Stand wie in der Research). Der Pin ist der Gitlink |
| Toolchain-Pin | `engine/toolchain.lock.json` | Oracle GraalVM 25.4.4.1.1 (SHA-256, beim ersten Download ermittelt: Oracle veröffentlicht keine Prüfsumme), Binaryen 123, Maven 3.9.16 (je mit veröffentlichter Prüfsumme) |
| Patch-Queue | `engine/patches/` | 0001 Synchronmodus (`ThreadUtil`, KI-Bewertung), 0002 kooperative KI-Zeitgrenze, 0003 Angriffs-KI nacheinander. Aus ManaBrews Forge-Fork (GPL), angepasst, mit Datum und Herkunft |
| Bridge (JVM + Wasm) | `engine/bridge/` | `HeadlessGuiBase` (IGuiBase ohne Threads, nach Anvils `AnvilGuiBase`), `ForgeEngine` (Synchronmodus, `FModel.initialize` mit Einstellungen im `adjustPrefs`-Rückruf), `ResourceBundleReader`, `EngineBoot`, `AiSmokeMatch` + `SmokeDecks`, `JvmSmokeMain`, TestNG-Tests |
| Wasm-Einstieg | `engine/wasm/java/…/WasmMain.java` | entpackt die eingebetteten Forge-Daten ins In-Memory-Dateisystem, startet Forge, meldet `boot`/`ready`/`fatal` per `@JS` an den Worker und nimmt Anfragen entgegen |
| Worker-Host | `engine/wasm/host/` | `feature-detect.js` (Wasm GC, exnref, typisierte Funktionsreferenzen, COOP/COEP, SharedArrayBuffer), `worker-core.js` (gemeinsam), `engine-worker.js` (Browser), `node-engine-worker.cjs` (Node) |
| Diagnoseseite | `engine/wasm/spike/` | lädt die Engine, spielt eine Partie, zeigt das Protokoll. **Keine Oberfläche**, nur Nachweis |
| Skripte | `engine/scripts/` | `setup-toolchain.sh`, `prepare-forge.sh`, `pack-resources.mjs`, `build-jvm.sh`, `gen-reflection-config.mjs`, `build-wasm.sh`, `postprocess-launcher.mjs`, `write-manifest.mjs`, `build.sh`, `test-engine.sh`, `record-agent-config.sh`, `measure.mjs` |
| Tests | `engine/bridge/src/test`, `engine/wasm/test` | JVM-Unit-Tests (Maven), Node-Smoke, Chrome-Smoke (playwright-core 1.63.0), Negativtest ohne COOP/COEP |

**Build-Weg** (`engine/scripts/build.sh`): Toolchain prüfen → Forge-Teilbaum per
`git archive` aus dem Pin in einen Wegwerf-Ordner (`engine/build/work`) → Patches
mit `git apply --check` + `git apply` → Forge-Daten aus demselben Pin bündeln →
Maven-Reactor (Forge-Module + Bridge, dabei laufen die Bridge-Tests mit echten
Partien) → Reflection-Metadaten für alle `forge.*`-Klassen generieren →
`native-image --tool:svm-wasm` → Launcher nachbearbeiten → Manifest mit Größen und
Hashes. Das Submodule wird nie verändert; jeder Build beginnt frisch.

**Start im Browser:** Seite prüft Features → `new Worker(engine-worker.js)` →
`importScripts(openmana-engine.js)` → Launcher holt, übersetzt und instanziiert das
Wasm → Java-`main` entpackt 36 922 Forge-Dateien ins In-Memory-Dateisystem →
`ForgeEngine.configureRuntime` + `FModel.initialize` → `ready` → Anfrage
`smoke-match` → Forge spielt synchron im Worker → Ergebnis per `postMessage`.

## 2. Nachweise

**Testmatrix** (`engine/scripts/test-engine.sh`, alle bestanden, 0 Fehler):

| Szenario | JVM | Wasm in Node 22.22.3 | Wasm in Chrome 153 (Worker) | Ergebnis |
|---|---|---|---|---|
| Seed 42, Karten lazy | `d7611b0e5348…` | identisch | identisch | 20 Züge, „Green AI“ gewinnt, 444 Log-Einträge |
| Seed 42, Karten eager | identisch | identisch | identisch | wie oben |
| Seed 7, Karten lazy | `0d52aafcaf5e…` | identisch | identisch | 24 Züge, „Green AI“ gewinnt |
| Chrome ohne COOP/COEP | – | – | Meldung nach 67 ms: „Es fehlt: Cross-Origin-Isolation (COOP/COEP-Header), SharedArrayBuffer.“ | bestanden |

- Jede Partie läuft in einem **frischen** Prozess bzw. Worker. Keine Laufzeit meldet
  Forge-Fehler (`BugReporter` wird mitgezählt), keine meldet tinylog-Fehler.
- **JVM-Unit-Tests** (5, in `build-jvm.sh`): Boot meldet Pin, Patch-Queue und
  Synchronmodus; Partie mit Seed 42 läuft zu Ende und ist im selben Prozess
  wiederholbar (gleicher Hash); Seed 7 ergibt eine andere Partie; das
  Ressourcen-Bundle weist kaputte oder gefährliche Pfade ab.
- **Laut scheitern, geprüft:** manipuliertes GraalVM-Archiv (falsche Größe bzw.
  falscher SHA-256) → Abbruch mit Meldung; fehlende Toolchain → Abbruch; Launcher
  mit unbekanntem Layout → Abbruch; Launcher ohne Host-Konfiguration → Ausnahme;
  Browser ohne Isolation → sichtbare Meldung; `native-image` mit
  `-H:+FatalUnsupportedNodes` → kein einziger nicht unterstützter Knoten im
  erreichbaren Code (sonst Abbruch statt stiller No-op).

## 3. Messwerte: Build

Sauberer Komplettbuild (`build.sh`), zweiter von zwei gleichen Läufen:

| Schritt | Dauer | Spitzen-RAM |
|---|---|---|
| Toolchain prüfen (bereits geladen) | 2,2 s | – |
| Forge-Arbeitsbaum + 3 Patches | 0,8 s | – |
| Forge-Daten bündeln | 1,8 s | – |
| Maven (4 Forge-Module + Bridge, inkl. 5 Tests mit echten Partien) | 45,9 s | 2,4 GiB (Prozessbaum) |
| Web Image gesamt | 250,3 s | – |
| davon `native-image` | **106,9 s** (1:45 min) | **5,2–5,9 GiB** (GraalVM-Angabe; 6,1 GiB Prozessbaum) |
| davon Größenmessung gzip -9 / Brotli 11 fürs Manifest | gut 2 min | – |
| **Gesamt** | **300,9 s** (≈ 5 min) | |

- `native-image`: Analyse 37,7 s, Kompilieren 11,3 s, Wasm erzeugen 38,2 s.
  11 428 Typen, 54 629 Methoden erreichbar; 2 319 Typen für Reflection registriert.
- Die Zwischendatei `openmana-engine.js.wat` ist **707 MiB** groß und wird nach
  dem Build gelöscht. Der Bauordner braucht rund 2 GB Platz.
- Erster Download der Toolchain: GraalVM 385 MB, Binaryen 100 MB, Maven 9 MB.
- Einmalig beobachtet: beim allerersten Maven-Lauf ein javac-Fehler „cannot access
  forge.gamemodes.net.client — invalid header field (line 1)“. In vier weiteren
  sauberen Builds nicht wieder aufgetreten; alle JARs und Manifeste im Klassenpfad
  sind unversehrt geprüft. Vermutlich ein gleichzeitig beschriebenes JAR im lokalen
  Maven-Repository. Tritt es wieder auf: Build wiederholen und melden.

**CI-Tauglichkeit (Research-Frage 4):** siehe §7.

## 4. Messwerte: Artefakte

| Datei | roh | gzip -9 | Brotli 11 |
|---|---|---|---|
| `openmana-engine.js.wasm` | 72 037 838 B (**68,7 MiB**) | 19,4 MiB | **13,1 MiB** |
| `openmana-engine.js` (Launcher) | 109,9 KiB | 22,5 KiB | 18,2 KiB |

- Vom Modul sind **55,6 MiB Image-Heap**, darin das eingebettete Forge-Datenbündel
  (39,4 MB: 36 922 Dateien, 36,0 MiB Text: ganzes `cardsfolder`, Token, Editionen,
  Blöcke, Listen, Formate, Vorgaben, Effekte, KI-Profile, `en-US.properties`).
- Zum Vergleich ManaBrews produktives Modul (Research): 69,0 MiB roh, 18,1 MiB gzip,
  11,4 MiB Brotli.
- Die Ausgabe ist nicht byte-reproduzierbar (drei Builds: 71,88–72,04 MB). Das
  Manifest hält deshalb pro Build Größe und SHA-256 fest.

## 5. Messwerte: Start, Partie, Speicher

Zeiten in ms ab Worker-Start. „main“ = Java-`main` erreicht (Wasm geladen,
übersetzt, instanziiert). „bereit“ = Forge initialisiert. Werte aus einem Lauf der
Testmatrix; ein zweiter Lauf wich um wenige Prozent ab (Chrome lazy bereit nach
3 342 statt 3 472 ms).

| Laufzeit | Karten | main | Entpacken | `FModel.initialize` | **bereit** | Partie Seed 42 (Forge-intern) |
|---|---|---|---|---|---|---|
| JVM 25 (Referenz) | lazy | – | 459 | 1 915 | (Prozess 4,9 s) | 2 014 |
| JVM 25 | eager | – | 449 | 2 571 | (Prozess 5,3 s) | 2 002 |
| Node 22 Worker | lazy | 717 | 867 | 2 467 | **4 139** | 3 709 |
| Node 22 Worker | eager | 712 | 889 | 4 524 | 6 215 | 3 653 |
| Chrome 153 Worker | lazy | 728 | 762 | 1 892 | **3 472** | 2 978 |
| Chrome 153 Worker | eager | 712 | 695 | 3 405 | 4 894 | 3 057 |

Seed 7 (24 Züge): JVM 2 484 ms, Node 4 929 ms, Chrome 3 959 ms.

**Speicher:**

| Laufzeit | lazy | eager | Messart |
|---|---|---|---|
| JVM | 479 MiB | 831 MiB | Spitzen-RSS des Java-Prozesses |
| Node (Worker im selben Prozess) | 1 086 MiB | 1 287 MiB | VmHWM des Node-Prozesses (Grundlast 45 MiB) |
| Chrome, alle Prozesse | 1 802 MiB | 1 894 MiB | Summe RSS aller Prozesse dieser Browser-Instanz; vor dem Laden der Seite schon 872–885 MiB → **Engine ≈ +0,93 bzw. +1,0 GiB** |
| Chrome, `measureUserAgentSpecificMemory` | 502 MiB | 593 MiB | JS-/Wasm-Heap des Workers nach der Partie |

**Einordnung:**
- Start im Browser gut 3,5 s bis „bereit“, davon 0,7 s Laden/Übersetzen und
  0,76 s Entpacken. Eine Partie rechnet im Wasm **1,5- bis 1,6-mal (Chrome) bzw.
  1,8- bis 2-mal (Node) so lange** wie auf der JVM (Seeds 42 und 7).
- **Eager Loading** kostet im Browser +1,4 s bis „bereit“ und rund +90 MiB Heap;
  die Partie selbst ist gleich schnell und gleich (identischer Hash).
- Gemessen auf Desktop-x86, headless, lokal ausgeliefert (kein Netz, kein
  HTTP-Cache: `Cache-Control: no-store`). Android fehlt (Research-Frage 5).

## 6. Befunde und Abweichungen

**Befunde über Web Image (neu, jetzt dokumentiert):**
1. Web Image meldet `os.name = "Browser"`, `user.home = "No user home"`,
   1 Prozessor und 4 GiB `maxMemory`. Die Bridge setzt `user.home` selbst; Forge
   leitet daraus sein Profilverzeichnis ab (Desktop-Semantik wie Anvil).
2. **Fehlende Datei:** Die JVM wirft `FileNotFoundException`, Web Images
   Dateisystem `NoSuchFileException`. Forge fängt an einigen Stellen nur die erste
   ab und druckt sonst einen Stacktrace — gleiches Ergebnis, aber Lärm. Die Bridge
   legt Forges drei UI-Präferenzdateien deshalb leer an, auf **beiden**
   Laufzeiten (wie ManaBrew). Bei künftigen Forge-Pfaden, die auf
   `FileNotFoundException` prüfen, an diesen Unterschied denken.
3. Netty bringt eigene `native-image.properties` mit, die `io.netty` zur Build-Zeit
   initialisieren und dabei einen Logger ins Image ziehen. Wie bei ManaBrew werden
   Logging und Netty auf Laufzeit-Initialisierung gezwungen; Guavas Futures bleiben
   zur Build-Zeit initialisiert.
4. `-H:+FatalUnsupportedNodes` ist experimentell und braucht
   `-H:+UnlockExperimentalVMOptions`; `--no-fallback` ist wirkungslos und entfällt.

**Befunde über Forge/Build:**
5. **tinylog-Ausgaben gingen verloren** (JVM und Wasm): Beim Zusammenbau des
   Fat-JARs ersetzte Forges `META-INF/services/org.tinylog.writers.Writer` die Datei
   von tinylog; tinylog fand keinen Konsolen-Writer („LOGGER ERROR: Service
   implementation 'console' not found“) und schluckte jede Forge-Logzeile, Fehler
   eingeschlossen. Behoben mit einem Assembly-Deskriptor, der Service-Dateien
   zusammenführt; `test-engine.sh` schlägt fehl, sobald tinylog wieder Fehler meldet.
6. Für den KI-gegen-KI-Pfad reichen die drei Patches: kein weiterer Thread-Start,
   kein „Cannot block in a single-threaded environment“, kein Hänger. Ob der
   menschliche Pfad weitere Stellen trifft, klärt Prompt 02.
7. **Determinismus:** `MyRandom.setRandom(new Random(seed))` (upstream vorhanden)
   genügt, sofern die JVM ebenfalls im Synchronmodus läuft: Upstreams parallele
   Angriffsprüfung wäre sonst eine Quelle für abweichende Reihenfolgen. Die
   kooperative KI-Zeitgrenze (Patch 0002) ist eine mögliche Abweichungsquelle,
   wenn eine Entscheidung auf einer Laufzeit das Zeitlimit (5 s) reißt; in den
   Testpartien geschah das nicht.

**Abweichungen vom Plan (bewusst):**
- Patches werden **nicht im Submodule**, sondern auf einer frischen Kopie des Pins
  angewendet (`engine/build/work`). Das verhindert veraltete Klassen und hält das
  Submodule sauber. Einen fest eingecheckten Reactor `engine/pom.xml` gibt es
  deshalb nicht; `prepare-forge.sh` erzeugt ihn im Arbeitsbaum.
- Ressourcen-Bundle als eigenes Binärformat `OMRB0001` (Längen statt
  `pfad\0inhalt\0`): binärsicher, ohne Trennzeichen-Mehrdeutigkeit.
- Artefaktnamen `openmana-engine.js`/`.js.wasm` statt `engine.js`; ein
  `engine.lock.json` (welche Engine die App ausliefert) entsteht erst, wenn die App
  die Engine einbindet (Prompt 25/26). Bis dahin beschreibt `engine-manifest.json`
  jeden Build.
- Transport im Spike **nur `postMessage`**: Eine KI-gegen-KI-Partie braucht keine
  blockierende Eingabe. Die SharedArrayBuffer-Eingabewarteschlange folgt mit dem
  Protokoll (Prompt 03). Die Seite verlangt Cross-Origin-Isolation trotzdem schon
  jetzt, weil die Architektur sie voraussetzt.
- Die JVM-Referenz läuft ebenfalls mit Patches und Synchronmodus (Plan §3.3:
  gleiche Bridge auf beiden Laufzeiten).

## 7. Offene Fragen der Research: Stand nach dem Spike

| # | Frage | Stand |
|---|---|---|
| 1 | Anvil-Weg (`PlayerControllerHuman` + Inputs) im Einzel-Thread | offen → Prompt 02 |
| 2 | Lazy Loading und namentlich erzeugte Karten | **Kosten gemessen** (§5): eager +1,5 s Start, +90 MiB. **Korrektheit** für `MakeCard`/`ChooseCardName` & Co. ungeprüft → Prompt 04 (Testkarten). Der Spike nutzt vorerst lazy wie ManaBrew |
| 3 | Verhaltensgleiche Übersetzung | **erste Belege:** drei Partien byte-gleich JVM/Node/Chrome, `FatalUnsupportedNodes` ohne Befund. Vollständiger Differenztest → Prompt 05 |
| 4 | Reicht ein Runner des privaten Repos (2 vCPU, 8 GB)? | **ja, simuliert** (siehe unten) |
| 5 | Fold7 (Start, Speicher, Tab-Verwerfen) | offen, braucht das Gerät. Die Spike-Seite ist dafür nutzbar (`engine/wasm/test/serve.mjs`) |
| 6 | Vercel-Auslieferung | offen → Prompt 31 |
| 7 | Web Image ohne Oracle-Enterprise-Teile | offen (nur bei Lizenz-Entscheid nötig) |
| 8 | TWA/WebAPK mit `SharedArrayBuffer` | offen → Prompt 28 |

**Simulation Frage 4:** `build-wasm.sh` in einer cgroup mit 200 % CPU-Kontingent,
`MemoryMax=8G`, **ohne Swap** und `--parallelism=2`
(`systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=8G -p MemorySwapMax=0`):
`native-image` erkennt die Grenze selbst („6.80GiB of memory … because in
container“, 2 Threads), braucht **3:18 min** statt 1:45 min und kommt mit
**5,07 GiB Spitze** aus. Das so gebaute Modul spielt dieselbe Partie (Hash
`d7611b0e…`). Maven braucht 2,4 GiB und liegt damit ebenfalls darunter. Einschränkung:
simuliert auf odins CPU, nicht auf einem echten GitHub-Runner; die Toolchain
(~500 MB) muss dort gecacht werden.

## 8. Reproduzieren

```bash
git submodule update --init --depth 1 engine/forge
(cd engine/wasm && npm ci)
bash engine/scripts/build.sh          # Build, Berichte in engine/build/report/
bash engine/scripts/test-engine.sh    # Testmatrix, Bericht engine/build/report/test-report.json
node engine/wasm/test/serve.mjs       # Spike-Seite: http://127.0.0.1:8765/?seed=42
```

## 9. Was als Nächstes kommt

- **Prompt 02:** menschlicher Sitz über `PlayerControllerHuman` und Forges Inputs im
  Einzel-Thread (Input-Pumpe, Patch 4 laut Research), Fragen mit IDs, Karte antippen
  außerhalb von Fragen, Mulligan, Kosten.
- **Prompt 03:** versioniertes Protokoll, SharedArrayBuffer-Eingabewarteschlange.
- **Prompt 04:** Ressourcen-Inventar prüfen, Netty/jupnp aus der Erreichbarkeit
  nehmen und per Build-Report belegen (heute sind sie auf dem Klassenpfad; Netz-
  spielklassen sind nur von der generierten Reflection-Liste ausgenommen),
  Lazy-Loading-Korrektheit.
- **Lizenz:** Das Repo enthält jetzt GPL-Code (Patches, Bridge gegen Forge). Die
  `LICENSE`-Datei und die Quelltext-Pflichten gehören laut Research vor die erste
  öffentliche Auslieferung (Prompt 27); das Repo ist privat.
