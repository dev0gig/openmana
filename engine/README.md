# OpenMana-Engine: Forge als WebAssembly

Hier entsteht die Engine, die Forge ohne Server im Browser laufen lässt. Forge
bleibt die einzige Autorität für Regeln, Kartenverhalten und KI (Bible §2); die
Engine packt es nur ein. Stand: **JVM/Wasm-Differenztests (Prompt 05)** —
Forge startet im Dedicated Worker, spielt KI gegen KI (Prompt 01) und Mensch
gegen KI über Forges eigenen Mensch-Pfad (`PlayerControllerHuman`, Prompt 02),
alles auf einem einzigen Thread. Die Oberfläche spricht mit der Engine
ausschließlich über das versionierte Protokoll [`protocol/`](protocol/README.md)
und den `EngineClient` ([`client/`](client/src/engine-client.ts)); die Eingaben
des Menschen laufen über eine SharedArrayBuffer-Warteschlange (Prompt 03). Die
eingebauten Forge-Daten sind bewusst gewählt und inventarisiert, jede Karte,
jedes Token und die neuesten Sets werden auf JVM und im Browser geprüft, und
Netzspiel-Code (Netty, jupnp, Jetty) kommt nachweislich nicht ins Modul
(Prompt 04). Dieselben Partien laufen auf der JVM und als WebAssembly und
werden über die **Engine-Spur** verglichen – strukturiert, sprachunabhängig,
Eintrag für Eintrag; jede Abweichung scheitert mit ihrer Stelle in der Partie
(Prompt 05, Testpartien in [`fixtures/`](fixtures/README.md)). Messwerte und Befunde:
[`01-engine-spike.md`](../docs/implementation/01-engine-spike.md),
[`02-anvil-bridge.md`](../docs/implementation/02-anvil-bridge.md),
[`03-worker-transport-protocol.md`](../docs/implementation/03-worker-transport-protocol.md),
[`04-forge-resources-card-scripts.md`](../docs/implementation/04-forge-resources-card-scripts.md),
[`05-engine-differential-tests.md`](../docs/implementation/05-engine-differential-tests.md).

## Aufbau

```
engine/
├── forge/                 Submodule: Card-Forge/forge upstream, voller SHA (der Pin ist der Gitlink)
├── patches/               nummerierte GPL-Patches für den Einzel-Thread-Betrieb (siehe patches/README.md)
├── bridge/                Maven-Modul (erbt vom Forge-Parent): headless IGuiBase, Forge-Start,
│                          Ressourcen-Bundle, KI-Rauchpartie; Paket bridge/ = Forges GUI für den
│                          Menschen (Fragen, Zustand, Ereignisse); trace/ = Engine-Spur der
│                          Differenztests; smoke/ = Testspieler und Kartenprüfung (CardProbe); JVM-Tests
├── fixtures/              Testpartien der Differenztests (JSON): Decks und je Partie Seed, Spieler,
│                          Engine-Einstellungen und was sie abdecken muss
├── protocol/              DER Vertrag UI <-> Engine: JSON-Schema, daraus erzeugte TS-Typen und
│                          Prüfer, Eingabewarteschlange (SharedArrayBuffer), Feature-Erkennung
├── client/                EngineClient für den Main Thread: startet den Worker, prüft jede
│                          Nachricht, führt Buch über Fragen, lehnt Unsinniges laut ab, Watchdog
├── wasm/
│   ├── java/              Wasm-Einstieg (WasmMain, @JS-Anbindung an den Worker)
│   ├── config/agent/      eingefrorene Reachability-Metadaten (Tracing-Agent, Nicht-Forge-Bibliotheken)
│   ├── host/              Worker-Host in TypeScript (Browser-Worker + Node-Worker-Thread)
│   ├── spike/             Diagnoseseite (keine Oberfläche), Wiederholer für Aufzeichnungen, Invarianten,
│   │                      Vergleich/Prüfsumme/Abdeckung der Engine-Spur (trace.ts)
│   └── test/              Node- und Chrome-Tests der echten Engine, Worker-Host-Unit-Tests, Server mit COOP/COEP
├── scripts/               reproduzierbarer Build und Tests
├── package.json           TypeScript-Werkzeuge (tsc, esbuild, Ajv, json-schema-to-typescript, playwright-core)
├── resources.json         welche Forge-Daten eingebettet werden: jeder Eintrag von forge-gui/res
│                          ist eingebunden oder mit Grund ausgelassen, dazu die Sprachen
└── toolchain.lock.json    gepinnte Toolchain (URL, Größe, Prüfsumme)
```

`engine/build/` (nicht versioniert) ist der Wegwerf-Bauordner: `work/` (Forge-Kopie
mit Patches + Bridge + Maven-Reactor), `resources/`, `jvm/`, `dist/` (die
Browser-Artefakte) und `report/` (Zeiten, Speicher, Testergebnisse, Berichte von
`native-image`: SBOM mit Klassen, Liste aller Klassen im Modul).

## Voraussetzungen

- Linux x86_64 (der Toolchain-Pin gilt nur dafür), `git`, `curl`, `tar`, Node ≥ 22.18
  (führt die TypeScript-Dateien direkt aus).
- Rund 8 GB freier Speicher für `native-image` (gemessen: 5,2 GiB Spitze) und
  2 GB Plattenplatz im Bauordner.
- Für den Browser-Test: Chrome for Testing 153 (`npx playwright-core install chromium`
  in `engine/`, oder `OPENMANA_CHROME=/pfad/zu/chrome`).
- Die Toolchain selbst (Oracle GraalVM 25.4.4.1.1 mit Web Image, Binaryen 123,
  Maven 3.9.16) lädt `scripts/setup-toolchain.sh` nach
  `~/.cache/openmana/toolchain` (änderbar mit `OPENMANA_TOOLCHAIN_DIR`) und prüft
  jede Datei per Prüfsumme.

## Bauen und testen

```bash
git submodule update --init --depth 1 engine/forge   # einmalig
(cd engine && npm ci)                                 # einmalig (build-host.sh macht es sonst selbst)
bash engine/scripts/build.sh                          # kompletter, sauberer Build (~6 min)
bash engine/scripts/test-engine.sh                    # Differenztests: JVM-Referenz, Wasm in Node und Chrome (~20 min)
```

`build.sh` führt nacheinander aus: `setup-toolchain.sh` → `build-host.sh`
(Protokoll: erzeugte Dateien = Schema, `tsc` strict, Unit-Tests von Protokoll,
Client und Worker-Host, Bundles mit esbuild) → `prepare-forge.sh`
(Forge-Kopie + Patches) → `pack-resources.mjs` (Forge-Daten aus demselben Pin;
bricht ab, wenn `forge-gui/res` etwas enthält, das `resources.json` weder
einbindet noch mit Grund auslässt) → `build-jvm.sh` (Maven, dabei laufen die
Bridge-Tests mit echten Forge-Partien, die Kartenprüfung über alle Karten und
der Vertragstest Java ↔ Schema) → `build-wasm.sh` (GraalVM Web Image; bricht ab,
sobald ein Typ von Netty, jupnp, Jetty oder der Servlet-API erreichbar wird;
Launcher-Nacharbeit, Klassenprüfung, Manifest).

Ergebnis in `engine/build/dist/`:

| Datei | Inhalt |
|---|---|
| `engine-worker.js` | der Worker-Host als klassisches Worker-Skript (aus `wasm/host/`, gebündelt) |
| `openmana-engine.js` | Launcher von Web Image, nachbearbeitet: Wasm-Adresse und Start-Argumente kommen vom Worker-Host |
| `openmana-engine.js.wasm` | das Modul, Forge-Daten eingebettet |
| `forge-res.inventory.json` | jede eingebettete Forge-Datei mit Pfad, Größe und SHA-256 |
| `engine-manifest.json` | Forge-Commit, Patch-Hash, Ressourcen (Zahlen, Größen, SHA-256, je Ordner, Sprachen, Ausgelassenes, Inventar), Toolchain (mit Prüfsummen und npm-Werkzeugen), was im Modul steckt (erreichbare Typen, Klassen, Netzspiel-Sperre), Protokollversion, Größen und SHA-256 aller Artefakte |

Dazu `build/harness/spike.js`, das Skript der Diagnoseseite (nur Tests).

`test-engine.sh` ist der **Differenztest JVM gegen WebAssembly** (Prompt 05).
Verglichen wird die Engine-Spur (`diagnostics.trace`, Klasse
`trace/EngineTrace`): an jeder Stelle, an der Forge auf eine Eingabe wartet,
an jedem Schrittbeginn und am Spielende ein vollständiger Schnappschuss aus
Forges Modell (jede Zone jedes Spielers, Bibliothek in Reihenfolge, Stapel mit
Zielen, Kampf, Forges Markierungen und offene Fragen ohne Worte), dazwischen
jedes Forge-Ereignis und jede Entscheidung der Bridge – nur Ids, englische
Kartenschlüssel, Aufzählungsnamen und Zahlen. Keine Stelle hängt an einer Uhr,
deshalb muss dieselbe Partie überall dieselbe Spur ergeben; die erste
Abweichung bricht ab und nennt Zug, Schritt, gelesene Eingaben und das Feld.

- **KI gegen KI** (Seeds 42 und 7; 42 auch faul geladen und auf Deutsch – dieselbe
  Spur) auf der JVM, in Node und in Chrome: Spur und Forge-Spielprotokoll gleich.
- **Die Testpartien** aus [`fixtures/differential`](fixtures/README.md): Der
  Testspieler `ScriptedHuman` spielt jede auf der JVM; Eingaben und Spur werden
  aufgezeichnet (`build/report/transcripts/`), jede Nachricht gegen das Schema
  geprüft. `check-traces.ts` prüft, dass jede Partie zeigt, was sie abdecken
  soll, dass die Varianten (Deutsch, faules Laden) exakt dieselbe Partie sind
  und dass alle Partien zusammen abdecken, was Prompt 05 verlangt (Mulligan,
  Länder und Zauber, Priorität, Kosten, Ziele, Stapel, Kampf, Blocker-Zuordnung,
  Zonen, Spielende, Commander). Node und Chrome spielen die Aufzeichnungen über
  den `EngineClient` und die Warteschlange nach – eine Eingabe je Warten (Client
  und Engine müssen jede Eingabe gleich beurteilen) und/oder so viele wie in eine
  256-Byte-Warteschlange passen – und müssen dieselbe Spur erzeugen.
- Dazu die Kartenprüfung (`CardProbe`, faul, vollständig, deutsch: derselbe
  Fingerabdruck auf JVM, Node und Chrome), die Fehlerpfade des Protokolls gegen
  die echte Engine (`node-protocol.ts`), ein Versionskonflikt in Chrome und der
  Negativtest ohne COOP/COEP. Läuft Forges Zeitbudget für „hat der Spieler
  etwas zu tun“ ab, scheitert der Test (die Partie wäre zeitabhängig).

Einzelne Werkzeuge: `node wasm/test/compare-traces.ts <a> <b>` vergleicht zwei
Spuren (JSON-Zeilen oder Aufzeichnung), `node wasm/test/fixtures.ts list`
zeigt die Testpartien.

## Start-Argumente der Engine

`--card-loading=eager|lazy` (Standard `eager`: `lazy` lädt die ganze
Kartendatenbank mitten in der Partie nach, sobald ein Effekt oder der Spieler
alle Karten braucht, im Wasm gemessen 17 s in Chrome, bis 42 s in Node), `--language=en-US|de-DE`
(Standard `en-US`, Sprache von Forges Meldungen und Spielverlauf) und seit
Prompt 12 `--card-language=en-US|de-DE` (Standard: die `--language`; die
Sprache der Karten in Forges Texten und Kartenansichten – die App startet Forge
deutsch und die Karten in der Kartensprache des Spielers). Die
JVM-Werkzeuge (`JvmSmokeMain`, `JvmHumanMatchMain`, `JvmCardProbeMain`) nehmen
dieselben Werte als `--card-loading`/`--language`/`--card-language`; `JvmHumanMatchMain
--scenario` liest sie aus der Testpartie, `JvmSmokeMain --trace <datei>`
schreibt die Engine-Spur der KI-Partie.

## KI-Profile (Prompt 12)

Forges vier Profile (`res/ai/*.ai`: Cautious, Default, Experimental, Reckless)
meldet die Engine beim Start (`boot.aiProfiles`); ein anderes Profil lehnt sie
ab. Was die Profile ändern, ist in
[`docs/research/AI_PROFILES.md`](../docs/research/AI_PROFILES.md) belegt – aus
den Profilwerten und aus 2 400 Partien KI gegen KI, gespielt mit

```bash
bash engine/scripts/ai-profile-study.sh   # ~25 min, 4 JVMs; Ergebnis engine/build/report/ai-profiles/summary.md
```

(nur JVM, nicht Teil von `build.sh`/`test-engine.sh`; Plan
`engine/fixtures/ai-profile-study.json`, Decks `engine/fixtures/decks/study-*.json`).
Die App beschreibt genau die geprüften Profildateien; ändert ein Forge-Update
eines, bricht ihr Build ab (`vite/engine-assets.ts`), bis es neu geprüft ist.

## Diagnoseseite von Hand öffnen

```bash
node engine/wasm/test/serve.mjs            # http://127.0.0.1:8765/?seed=42&cardLoading=lazy
node engine/wasm/test/serve.mjs --no-isolation   # zeigt die Fehlermeldung ohne COOP/COEP
```

Weitere Parameter: `&language=de-DE`, `&cardLanguage=en-US`, `?cards=1` (Kartenprüfung),
`?announceProtocol=999` (Versionskonflikt). Eine
aufgezeichnete Mensch-gegen-KI-Partie lässt sich im Browser nachspielen, z. B.
über den Test: `node engine/wasm/test/browser-smoke.mjs --transcript
engine/build/report/transcripts/human-3.json --feeding eager`. In Node:
`node engine/wasm/test/node-replay.ts --transcript … --feeding lazy`.

## Grundsätze

- **Laut scheitern:** Jede fehlende Voraussetzung (Toolchain, Prüfsumme,
  veränderter Forge-Checkout, nicht passender Patch, unbekanntes Launcher-Layout,
  Browser ohne Cross-Origin-Isolation oder ohne Wasm GC/exnref) bricht mit einer
  Meldung ab. Watchdogs verhindern, dass Seite oder Test still hängen.
- **Gleicher Code auf JVM und im Browser:** Die Bridge startet Forge auf beiden
  Laufzeiten identisch (Synchronmodus, gleiches Ressourcen-Bundle). Deshalb lassen
  sich Partien per Seed vergleichen.
- **Forge-Updates bleiben in `engine/`:** neuer Submodule-SHA, Patches prüfen,
  `build.sh` + `test-engine.sh`. Die Oberfläche (seit Prompt 06 in `src/`) sieht
  Forge nie direkt, nur `engine/protocol` und `engine/client`. Die Web-App
  übernimmt die Artefakte aus `build/dist` beim Bauen nur, wenn Größe und
  SHA-256 zum `engine-manifest.json` passen (`vite/engine-assets.ts`); nach
  einem neuen Engine-Build den Dev-Server der App neu starten. Neue Einträge in
  `forge-gui/res` verlangen eine Entscheidung in `resources.json`; die
  Kartenprüfung zeigt, ob jede Karte der neuen Forge-Version im Browser lädt.
- **Kein Netzspiel im Modul:** Netty, jupnp (CDDL) und Jetty bleiben draußen.
  `build-wasm.sh` erzwingt das zweimal (Erreichbarkeit während der Analyse,
  Klassennamen im fertigen Modul).
- **Ein Vertrag:** Was zwischen UI und Engine fließt, steht im Schema
  (`protocol/schema/protocol.schema.json`); Typen und Prüfer werden daraus
  erzeugt, jede Nachricht wird zur Laufzeit geprüft, ein Verstoß ist ein
  lauter technischer Abbruch.
