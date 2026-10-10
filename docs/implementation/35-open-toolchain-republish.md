# Prompt 35 — Offene Engine-Toolchain übernommen und wieder veröffentlicht

> Direkt beauftragt vom Projektbesitzer am 2026-10-10 (Dropzone
> `openmana-35-open-toolchain-republish`). Entscheidung: `docs/PUBLICATION.md`.
> Vorarbeit und Messungen: `docs/research/OPEN_WEB_IMAGE_BUILD_2026-10-09.md`.

## Ergebnis

- Die Engine wird regulär mit **GraalVM Community Edition aus offenem
  Quelltext** gebaut. Pins: `engine/toolchain.lock.json`
  - labsjdk-ce `25.0.4.1.1+1-jvmci-25.4-b23` (Archiv mit SHA-256),
  - `oracle/graal` `vm-25.4.4.1.1` = `95ce1499`,
  - `mx` 7.85.1.
- **Aufbau:** `engine/scripts/setup-toolchain.sh` baut GraalVM CE einmal je Pin in
  `~/.cache/openmana/open-toolchain` und prüft es bei jedem Lauf (Commits,
  Community-Build, kein Enterprise-JAR, Platzhaltermodule leer).
- **Ersatz-SBOM:** `--enable-sbom` gibt es nur in Oracle GraalVM. `build-wasm.sh`
  schreibt die erreichbaren Typen über `engine/scripts/sbom/ReachableTypesFeature.java`
  (nur beim Bauen, nicht im Modul); `engine/scripts/sbom/inventory.py` ordnet sie
  über ihre Quelldateien am gepinnten Stand dem JDK bzw. der GraalVM-Suite zu
  (GraalVM-eigene Pakete zuerst im `oracle/graal`-Baum).
- **Lizenzhinweise:** `notices/policy.json` nennt die offenen Komponenten
  (`open:labsjdk-ce`, `open:graalvm-ce-{substratevm,web-image,compiler,espresso-shared,sdk,shaded-google}`).
  Texte:
  - `openjdk-runtime-modules` (die `legal/`-Dateien der enthaltenen
    JDK-Module, `scripts/notices/jdk-legal-notices.py`),
  - `graalvm-gpl2-cpe`, `graalvm-upl`,
  - Guava/Jimfs.

  Die Oracle-Texte (GFTC, Oracle-Handbuch, Oracle-JDK-Module) sind entfernt;
  `oracle-launcher` bleibt, weil der Launcher Oracles GPLv2+CPE-Köpfe trägt.
  `THIRD-PARTY-NOTICES.md`, `notices/engine-inventory.json`, `SOURCE.md`,
  Credits-Seite und Doku sind angepasst.
- **JVMCI-Rest:** 13 Typen `jdk.vm.ci.*` (GPLv2 ohne Classpath Exception) sind
  offen benannt und vom Projektbesitzer akzeptiert.

## Nachweise

- **Prüfläufe:**
  - `engine/build/publish-35d` (Forge-Update-Pipeline, Lock geschrieben):
    96 Engine-Unit-, 85 JVM-Tests, 82 Engine-Ergebnisse, 23 Browserläufe,
    Katalog, vollständige App- und PWA-Suite.
  - Frühere Läufe:
    - `publish-35`: zwei Tests erwarteten noch den alten Credits-Satz;
    - `publish-35b`: Aussetzer des Tisch-Prüfstands unter fremder Browserlast,
      unverändert wiederholt;
    - `publish-35c`: grün, aber die Komponenten-Zuordnung der GraalVM-Typen
      danach korrigiert.

    Alle bleiben als Nachweis erhalten.
- **Gleichheit:** `engine/scripts/compare-engine-results.mjs engine/build/publish-31b engine/build/publish-35d`
  ergibt 82/82 identisch (alle 818 Prüfsummen).
- **Modul:** 78.972.017 Bytes (Brotli 13.066.361), Netzwerkklassen 0.
  Lizenzbeleg (`inventory.py evidence`): 4.823 Toolchain-Typen, davon 13 JVMCI
  ohne CPE; Launcher ohne proprietäre Köpfe.
- **Release `engine-p8-a9b4c26b1244`:**
  - Tag auf `6cd6367`;
  - 13 Dateien, darunter das vollständige Quellarchiv
    `openmana-source-6cd6367…` (SHA-256 `0e941358…8087`) und die JGraphT-Quellen;
  - Modul anonym abrufbar, Prüfsumme passt.

  Das Oracle-gebaute `engine-p8-2b0da7a21935` bleibt Entwurf.
- **Probe wie Vercel:** frischer Klon ohne Forge und `.git`,
  `fetch-artifacts.ts --from`, öffentlicher Build mit Gate, Größenbudgets
  eingehalten.
- **Push:** `main` gepusht (`b52d658..6cd6367`).
- **Vercel:** Das Produktionsdeployment zum Push steht wegen der Projektpause
  auf `BLOCKED`. Die Pause konnte aus der Sitzung nicht aufgehoben werden: Die
  Vercel-Verbindung darf das Projekt nur lesen (403), die Vercel-CLI ist nicht
  installiert und ihr Token abgelaufen. Aufheben durch den Projektbesitzer im
  Dashboard; danach baut das blockierte Deployment.
