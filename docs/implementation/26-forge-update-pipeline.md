# 26 — Isolierte Forge-Update-Pipeline

Stand: 07.10.2026. Zentraler Auftrag: Dropzone `openmana-26-forge-update-pipeline.md`. Umsetzung und Nachweise bleiben lokal.

## Umsetzung

Der Einstieg `engine/scripts/validate-forge-update.mjs --base <Review-Ausgangscommit>` führt die vorhandenen Engine- und App-Prüfungen verbindlich zusammen. Er arbeitet immer in einem neuen Unterverzeichnis von `engine/build`, erhält bisherige Builds und kopiert nur Toolchain-Downloadarchive aus dem Cache. Alle Archive werden erneut gehasht und frisch entpackt; die bisher genutzte Node-Version 22.22.3/npm 10.9.8 ist nun ebenfalls per Version, Größe und offizieller Archivprüfsumme gesperrt. GraalVM, Binaryen und Maven behalten ihre bisherigen Pins. `npm ci` erneuert die Abhängigkeitsbäume; Forge, Bridge, Ressourcen und WASM entstehen frisch aus dem gestagten Gitlink und allen acht Patches.

Die Pfadprüfung erfasst Commits, Index, Arbeitsbaum und ungetrackte Dateien sowie beide Seiten einer Verschiebung. Ein Forge-Update bleibt in `engine/**`; Toolchain-Änderungen benötigen eine separate Pflegeänderung. Ein geändertes Protokoll braucht eine erhöhte Version und einen dokumentierten Grund. Ausdrücklich autorisierte Protokollanpassungen außerhalb der Engine sind nur als einzelne exakt genannte Pfade zulässig. Es gibt keine pauschale UI-Ausnahme.

`OPENMANA_ENGINE_BUILD_DIR` wird nun durch den Bundler, alle Node-Testeinstiege und den Browser-Testserver durchgereicht. Zuvor konnten diese Helfer trotz abweichendem Shell-Bauordner die Dateien aus dem Standardbuild verwenden. Eigene Grenztests prüfen die tatsächlich geladenen Kandidatdateien, einschließlich absichtlicher Launcherfehler. Die Produktoberfläche, Bridge, Forge-Patches und Protokollversion 7 werden in diesem Auftrag nicht geändert.

Das Manifest enthält einen Fingerabdruck aller funktionalen Engine-Quelldateien, den Forge-Pin und die Protokoll-/Toolchain-/npm-Lock-Prüfsummen. Der vollständige Engine-Testbericht bindet sich an den Manifesthash und vermerkt Browser-Skips. Der Update-Lauf lehnt Skips ab, baut den Kartenkatalog gegen denselben Pin und führt die vollständige bestehende App-Prüfung mit genau dem neuen Artefaktsatz aus. Erst danach ersetzt er `engine/engine.lock.json` atomar. Der Lock enthält Artefakt- und Nachweisprüfsummen; `engine-lock.mjs verify <dist>` erkennt geänderte Quellen, fremde Builds und selbst gleich lange beschädigte Dateien. Bei Fehlern bleiben der vorherige Lock und die Diagnoseberichte erhalten.

Die Wartungsanleitung steht in `engine/UPDATING.md`. Der neue GitHub-Workflow ruft denselben Einstieg auf, verwendet konkret gepinnte Actions und bietet PR-/manuelle Auslösung. Forge-Pinwechsel werden automatisch geprüft; ein Patch-/Bridge-Update ohne Pinwechsel wird mit dem Label `forge-update` ausgewählt. PRs werden gegen den gemeinsamen Ausgangscommit von Ziel und PR geprüft. Ein manueller Lauf kann die ausdrücklich erforderlichen Protokollausnahmen dokumentieren. Er veröffentlicht nichts.

## Self-Review und Grenzen

Im Review wurden falsch zusammengesetzte Node-Testpfade korrigiert und durch einen Test mit einem absichtlich fehlschlagenden Kandidatlauncher abgesichert. Die ersten zwei Fehler der neuen Tests betrafen deren unvollständiges Gitlink-Testfixture; die Tests verwenden jetzt ein echtes lokales Submodule-Fixture und prüfen auch abweichende Pins und ungetrackte Forge-Dateien. Kein Produkttest wurde abgeschwächt.

Dies ist die Einrichtung der Pipeline, keine beauftragte neue Forge-Version. Der vollständige lokale Probelauf nutzt den bestehenden upstream-Pin `ed0333fecb1fea0671b3e50cadc1da4f71db5798`, Protokoll 7 und den bereits verfügbaren Scryfall-Bulkstand vom 24.09.2026. Als Review-Basis des finalen Laufs dient der lokale Infrastrukturcommit `2d97a02`, weil seine erstmalige Toolchain-/CI-/Dokueinrichtung selbst keine gewöhnliche Forge-Update-PR ist. Neue Forge-Releases können bewusst an Patch-, Ressourcen-, Kartenkatalog- oder KI-Profilprüfungen scheitern und müssen dann gepflegt werden.

Reproduzierbar sind die gesperrten Eingaben und der saubere Prüfablauf; eine bitidentische Wiederholung der Web-Image-Compilerbytes ist nicht behauptet. Der Lock pinnt den tatsächlich geprüften Satz. Der GitHub-Workflow ist lokal vorbereitet und reviewed; ein Hosted-Runner-Lauf, Branch-Protection-Konfiguration, Veröffentlichung und physische Geräteprüfung wurden nicht ausgeführt.

## Historischer Fehlversuch und Korrektur

Der erste vollständige Versuch unter `engine/build/update-26-20261007/` bestand den frischen Build, 93 Engine-Unit-Tests, 76 JVM-Tests und alle 25 JVM-/31 Node-Ergebnisse. Chrome scheiterte vor dem Engine-Start an seiner Unix-Socketpfadgrenze: Das zunächst innerhalb des tiefen Bauordners angelegte `TMPDIR` war zu lang. Die Pipeline brach korrekt ab und erzeugte keinen Lock. Dieser fehlgeschlagene Bericht bleibt erhalten.

Die Korrektur `2d97a02` verwendet ein kurzes eigenes `/var/tmp/om-…` und startet Chrome bereits vor dem teuren Neubau. Zusätzliche Prüfungen binden die originalen, tatsächlich ausgeführten JVM-Tests an den Bericht und erkennen auch neue App-Dateien während eines Laufs. Der echte Chrome-Vorabstart und der unveränderte negative Isolationsfall bestanden. Danach wurde die gesamte Pipeline von vorn in einem neuen Verzeichnis ausgeführt; keine alten Testberichte wurden übernommen.

## Verifikation

Der finale Lauf liegt unter `~/repos/openmana/engine/build/update-26-20261007-final/`, mit frisch entpackten Werkzeugen und dem unveränderten Code aus `2d97a02`. **Gesamter Lauf: Exit 0.** Alle sieben Pipeline-Schritte sind erfolgreich:

| Prüfung | Ergebnis |
| --- | --- |
| Engine-Protokollgenerierung und TypeScript | bestanden |
| Engine-Unit-Tests | 95/95, darunter zwölf neue Pipeline-/Grenztests |
| Maven `clean package` mit JVM-Bridge-Tests | 76, keine Fehler oder Skips; originale Surefire-XMLs archiviert |
| Frischer WASM-Build | vollständiger Engine-Build 438,8 s; Web-Image-Compiler 154,3 s, Peak 4288,6 MiB |
| Klassen-/Netzspielprüfung | 6898 Modulklassen; keine ausgeschlossenen Netty-/jupnp-/Jetty-/Servletklassen |
| Engine-Differenzsuite | 78/78 Ergebnisse: 25 JVM, 31 Node, 22 Chrome; kein Browser-Skip; reguläre JVM-/WASM-Spuren identisch und negative Vergleichstests erfolgreich |
| Neuer Kartenkatalog | 36.156 Karten, 1052 Sets; 33.740 von 33.978 Forge-Skripten zugeordnet, 238 dokumentierte Forge-only-Einträge; Katalog `0c2afda8fc8bd1fd` |
| App-Schema, TypeScript und Lint | bestanden |
| App-Unit-Tests | 881/881 in 72 Dateien |
| Vollständige Chrome-App-Abnahme | 96 Routen, 152 gefüllte Zustände, 288 Tischszenen, 24 Viewer- und 16 echte Forge-Größenwechsel; 658 Barrierefreiheitsmessungen ohne Verstöße; vollständige Workertraces jeweils maximal ein Worker |
| Reale PWA-Abnahme | Offline-Spiel nach geleertem HTTP-Cache und tatsächlich gestopptem Server, ein Worker und null Serverrequests; korrupter/unterbrochener Download, fehlgeschlagenes/wartendes Update, Recording-Erhalt, Eviction und Installationsretry erfolgreich |
| Lock und Nachweise unabhängig geprüft | `verify`, `validateEvidence` und Pfadprüfung erfolgreich; alter Standardbuild wird vom neuen Lock abgelehnt; `OPENMANA_SKIP_BROWSER=1` verhindert bereits den Start |
| GitHub-Workflow statisch | Actionlint 1.7.12 erfolgreich; Releasearchiv gegen offizielle Prüfsumme geprüft |

Die drei im App-Build ausgelieferten Runtime-Dateien wurden zusätzlich direkt gegen den neuen Kandidaten gehasht: alle identisch, Engine-ID `6bade7ffb4a6940e`. Die sechs bisherigen Dateien unter `engine/build/dist/` sind unverändert. Der neue Lock referenziert Manifest-SHA-256 `dd33caca4339210f51f87d60a115a70e1b4a5e6934c08404cca5950896314d2c` und den Fingerabdruck von 164 Engine-Eingabedateien `7fd4ae7e681be1b79b6293fed3d32e9605ff5853aa1efec33012542ce0552e4f`.

Die App-Browserberichte samt Screenshots wurden nach dem erfolgreichen Lauf zusätzlich unter `engine/build/update-26-20261007-final/report/app/` gesichert. `report/completion-audit.json` hält die Zählungen, vollständigen Workertrace-Prüfungen, Berichtshashes und den Herkunftsabgleich fest. Es ergänzt die automatisch von der Pipeline erzeugten Berichte; die gesperrten Originalberichte wurden nicht nachbearbeitet.

Die eigene temporäre 4-GiB-Swapreserve wurde nach der Prüfung deaktiviert und gelöscht. Beide vorher vorhandenen Swapdateien bleiben aktiv; fremde Prozesse wurden nicht verändert. Das kurze Pipeline-TMPDIR wurde automatisch entfernt. Nachweise: `~/.local/state/dm/openmana-26-20261007/resource-cleanup.json`, `final-browser-audit.json`, `final-verification.json` und `app-engine-provenance.json`.

## Tatsächlicher Aufruf und weitere Verwendung

Der vollständige erfolgreiche Aufruf vom Repository-Root (die zuerst gebaute Toolchain dient hier nur als Archivcache):

```bash
export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH
NODE_OPTIONS=--max-old-space-size=2048 \
JDK_JAVA_OPTIONS=-Xmx512m MAVEN_OPTS=-Xmx768m \
OPENMANA_NATIVE_IMAGE_XMX=6g OPENMANA_NATIVE_IMAGE_PARALLELISM=2 \
OPENMANA_TOOLCHAIN_DIR=~/repos/openmana/engine/build/update-26-20261007/toolchain \
node engine/scripts/validate-forge-update.mjs \
  --base 2d97a021675b1cdc15bc350d1c24dedb13487f37 \
  --bulk ~/repos/openmana/cards/build/cache/all-cards-20260924211809.jsonl.gz \
  --out ~/repos/openmana/engine/build/update-26-20261007-final
```

Der App-Check dauerte 1751,8 Sekunden, die Engine-Differenzsuite 1182,0 Sekunden. Der abgeschlossene Bauordner wird bei einer Wiederholung nicht überschrieben; dafür einen neuen Namen wählen.

Diesen geprüften Satz für nachfolgende Arbeiten ausdrücklich auswählen:

```bash
node engine/scripts/engine-lock.mjs verify engine/build/update-26-20261007-final/dist
OPENMANA_ENGINE_DIR=~/repos/openmana/engine/build/update-26-20261007-final/dist \
OPENMANA_CARDS_DIR=~/repos/openmana/engine/build/update-26-20261007-final/catalog \
npm run check
```

Implementierung: lokale Commits `75c675d` und `2d97a02`. Der abschließende Commit enthält den geprüften Lock und diese Dokumentation; der zentrale Abschlussbericht nennt seinen Hash. Prompt 27 bleibt ungestartet.
