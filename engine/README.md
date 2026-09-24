# OpenMana-Engine: Forge als WebAssembly

Hier entsteht die Engine, die Forge ohne Server im Browser laufen lässt. Forge
bleibt die einzige Autorität für Regeln, Kartenverhalten und KI (Bible §2); die
Engine packt es nur ein. Stand: **Forge-Daten und Kartenskripte (Prompt 04)** —
Forge startet im Dedicated Worker, spielt KI gegen KI (Prompt 01) und Mensch
gegen KI über Forges eigenen Mensch-Pfad (`PlayerControllerHuman`, Prompt 02),
alles auf einem einzigen Thread. Die Oberfläche spricht mit der Engine
ausschließlich über das versionierte Protokoll [`protocol/`](protocol/README.md)
und den `EngineClient` ([`client/`](client/src/engine-client.ts)); die Eingaben
des Menschen laufen über eine SharedArrayBuffer-Warteschlange (Prompt 03). Die
eingebauten Forge-Daten sind bewusst gewählt und inventarisiert, jede Karte,
jedes Token und die neuesten Sets werden auf JVM und im Browser geprüft, und
Netzspiel-Code (Netty, jupnp, Jetty) kommt nachweislich nicht ins Modul
(Prompt 04). Messwerte und Befunde:
[`01-engine-spike.md`](../docs/implementation/01-engine-spike.md),
[`02-anvil-bridge.md`](../docs/implementation/02-anvil-bridge.md),
[`03-worker-transport-protocol.md`](../docs/implementation/03-worker-transport-protocol.md),
[`04-forge-resources-card-scripts.md`](../docs/implementation/04-forge-resources-card-scripts.md).

## Aufbau

```
engine/
├── forge/                 Submodule: Card-Forge/forge upstream, voller SHA (der Pin ist der Gitlink)
├── patches/               nummerierte GPL-Patches für den Einzel-Thread-Betrieb (siehe patches/README.md)
├── bridge/                Maven-Modul (erbt vom Forge-Parent): headless IGuiBase, Forge-Start,
│                          Ressourcen-Bundle, KI-Rauchpartie; Paket bridge/ = Forges GUI für den
│                          Menschen (Fragen, Zustand, Ereignisse); smoke/ = Testspieler und
│                          Kartenprüfung (CardProbe); JVM-Tests
├── protocol/              DER Vertrag UI <-> Engine: JSON-Schema, daraus erzeugte TS-Typen und
│                          Prüfer, Eingabewarteschlange (SharedArrayBuffer), Feature-Erkennung
├── client/                EngineClient für den Main Thread: startet den Worker, prüft jede
│                          Nachricht, führt Buch über Fragen, lehnt Unsinniges laut ab, Watchdog
├── wasm/
│   ├── java/              Wasm-Einstieg (WasmMain, @JS-Anbindung an den Worker)
│   ├── config/agent/      eingefrorene Reachability-Metadaten (Tracing-Agent, Nicht-Forge-Bibliotheken)
│   ├── host/              Worker-Host in TypeScript (Browser-Worker + Node-Worker-Thread)
│   ├── spike/             Diagnoseseite (keine Oberfläche), Wiederholer für Aufzeichnungen, Invarianten
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
bash engine/scripts/test-engine.sh                    # JVM-Referenz, Wasm in Node und Chrome (~10 min)
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

`test-engine.sh` spielt: KI gegen KI (Seeds 42 und 7, Seed 42 auch auf Deutsch)
auf der JVM, in Node und in Chrome, das Forge-Spielprotokoll muss überall gleich
sein; fünf Mensch-gegen-KI-Partien auf der JVM mit dem Testspieler
`ScriptedHuman` (eine davon auf Deutsch: dieselbe Partie wie auf Englisch),
dessen Nachrichten gegen das Schema geprüft und dessen Eingaben aufgezeichnet
werden (`build/report/transcripts/`). Die Kartenprüfung (`CardProbe`: Effekte,
die Karten per Namen erzeugen, jede Kartenart, jedes Token, die neuesten Sets
und jede Karte der Datenbank als Spielkarte) läuft auf der JVM faul, vollständig
und auf Deutsch und muss in Node und Chrome denselben Fingerabdruck ergeben. Die Aufzeichnungen gehen in Node und Chrome über
den `EngineClient` und die Warteschlange erneut in die Wasm-Engine, einmal
eine Eingabe je Warten (Client und Engine müssen jede Eingabe gleich beurteilen)
und einmal so viele wie hineinpassen in eine 256-Byte-Warteschlange; die Partie
muss genau gleich enden. Dazu die Fehlerpfade des Protokolls gegen die echte
Engine (`node-protocol.ts`), ein Versionskonflikt in Chrome und der Negativtest
ohne COOP/COEP.

## Start-Argumente der Engine

`--card-loading=eager|lazy` (Standard `eager`: `lazy` lädt die ganze
Kartendatenbank mitten in der Partie nach, sobald ein Effekt oder der Spieler
alle Karten braucht, im Wasm gemessen 17 s in Chrome, bis 42 s in Node) und `--language=en-US|de-DE`
(Standard `en-US`, Sprache von Forges Meldungen und Spielverlauf). Die
JVM-Werkzeuge (`JvmSmokeMain`, `JvmHumanMatchMain`, `JvmCardProbeMain`) nehmen
dieselben Werte als `--card-loading`/`--language`.

## Diagnoseseite von Hand öffnen

```bash
node engine/wasm/test/serve.mjs            # http://127.0.0.1:8765/?seed=42&cardLoading=lazy
node engine/wasm/test/serve.mjs --no-isolation   # zeigt die Fehlermeldung ohne COOP/COEP
```

Weitere Parameter: `&language=de-DE`, `?cards=1` (Kartenprüfung),
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
  `build.sh` + `test-engine.sh`. Die Oberfläche (ab Prompt 06 in `src/`) sieht
  Forge nie direkt, nur `engine/protocol` und `engine/client`. Neue Einträge in
  `forge-gui/res` verlangen eine Entscheidung in `resources.json`; die
  Kartenprüfung zeigt, ob jede Karte der neuen Forge-Version im Browser lädt.
- **Kein Netzspiel im Modul:** Netty, jupnp (CDDL) und Jetty bleiben draußen.
  `build-wasm.sh` erzwingt das zweimal (Erreichbarkeit während der Analyse,
  Klassennamen im fertigen Modul).
- **Ein Vertrag:** Was zwischen UI und Engine fließt, steht im Schema
  (`protocol/schema/protocol.schema.json`); Typen und Prüfer werden daraus
  erzeugt, jede Nachricht wird zur Laufzeit geprüft, ein Verstoß ist ein
  lauter technischer Abbruch.
