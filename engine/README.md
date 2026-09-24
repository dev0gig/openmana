# OpenMana-Engine: Forge als WebAssembly

Hier entsteht die Engine, die Forge ohne Server im Browser laufen lässt. Forge
bleibt die einzige Autorität für Regeln, Kartenverhalten und KI (Bible §2); die
Engine packt es nur ein. Stand: **Engine-Spike (Prompt 01)** — Forge startet im
Dedicated Worker und spielt eine Partie KI gegen KI. Messwerte und Befunde:
[`docs/implementation/01-engine-spike.md`](../docs/implementation/01-engine-spike.md).

## Aufbau

```
engine/
├── forge/                 Submodule: Card-Forge/forge upstream, voller SHA (der Pin ist der Gitlink)
├── patches/               nummerierte GPL-Patches für den Einzel-Thread-Betrieb (siehe patches/README.md)
├── bridge/                Maven-Modul (erbt vom Forge-Parent): headless IGuiBase, Forge-Start,
│                          Ressourcen-Bundle, KI-Rauchpartie, JVM-Tests
├── wasm/
│   ├── java/              Wasm-Einstieg (WasmMain, @JS-Anbindung an den Worker)
│   ├── config/agent/      eingefrorene Reachability-Metadaten (Tracing-Agent, Nicht-Forge-Bibliotheken)
│   ├── host/              Worker-Host (Browser + Node) und Feature-Erkennung
│   ├── spike/             Diagnoseseite des Spikes (keine Oberfläche)
│   └── test/              Smoke-Tests in Node und Chrome, Server mit COOP/COEP
├── scripts/               reproduzierbarer Build und Tests
├── resources.json         welche Forge-Daten eingebettet werden
└── toolchain.lock.json    gepinnte Toolchain (URL, Größe, Prüfsumme)
```

`engine/build/` (nicht versioniert) ist der Wegwerf-Bauordner: `work/` (Forge-Kopie
mit Patches + Bridge + Maven-Reactor), `resources/`, `jvm/`, `dist/` (die
Browser-Artefakte) und `report/` (Zeiten, Speicher, Testergebnisse).

## Voraussetzungen

- Linux x86_64 (der Toolchain-Pin gilt nur dafür), `git`, `curl`, `tar`, Node ≥ 22.
- Rund 8 GB freier Speicher für `native-image` (gemessen: 5,2 GiB Spitze) und
  2 GB Plattenplatz im Bauordner.
- Für den Browser-Test: Chrome for Testing 153 (`npx playwright-core install chromium`
  in `engine/wasm`, oder `OPENMANA_CHROME=/pfad/zu/chrome`).
- Die Toolchain selbst (Oracle GraalVM 25.4.4.1.1 mit Web Image, Binaryen 123,
  Maven 3.9.16) lädt `scripts/setup-toolchain.sh` nach
  `~/.cache/openmana/toolchain` (änderbar mit `OPENMANA_TOOLCHAIN_DIR`) und prüft
  jede Datei per Prüfsumme.

## Bauen und testen

```bash
git submodule update --init --depth 1 engine/forge   # einmalig
(cd engine/wasm && npm ci)                            # einmalig, nur für die Tests
bash engine/scripts/build.sh                          # kompletter, sauberer Build (~5 min)
bash engine/scripts/test-engine.sh                    # JVM-Referenz, Wasm in Node und Chrome
```

`build.sh` führt nacheinander aus: `setup-toolchain.sh` → `prepare-forge.sh`
(Forge-Kopie + Patches) → `pack-resources.mjs` (Forge-Daten aus demselben Pin)
→ `build-jvm.sh` (Maven, dabei laufen die Bridge-Tests mit echten Forge-Partien)
→ `build-wasm.sh` (GraalVM Web Image, Launcher-Nacharbeit, Manifest).

Ergebnis in `engine/build/dist/`:

| Datei | Inhalt |
|---|---|
| `openmana-engine.js` | Launcher von Web Image, nachbearbeitet: Wasm-Adresse und Start-Argumente kommen vom Worker-Host |
| `openmana-engine.js.wasm` | das Modul, Forge-Daten eingebettet |
| `engine-manifest.json` | Forge-Commit, Patch-Hash, Ressourcen-Inventar, Toolchain, Größen und SHA-256 |

## Spike-Seite von Hand öffnen

```bash
node engine/wasm/test/serve.mjs            # http://127.0.0.1:8765/?seed=42&cardLoading=lazy
node engine/wasm/test/serve.mjs --no-isolation   # zeigt die Fehlermeldung ohne COOP/COEP
```

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
  Forge nie direkt.
