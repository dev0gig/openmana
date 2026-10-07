# Forge gezielt aktualisieren

Die Pipeline aus Prompt 26 baut und prüft eine neue Engine mit unverändertem
App-Code. Forge bleibt upstream `Card-Forge/forge`; der vollständige Gitlink in
`engine/forge` ist der Pin, die nummerierten Dateien in `patches/` sind die
Patch-Queue. Es gibt keinen automatischen Sprung auf `master` oder „latest“.

## Vorbereitung und neuer Pin

Zuerst einen sauberen, aktuellen OpenMana-Branch für den Update-PR anlegen und
seinen Ausgangscommit festhalten. Lokale Arbeiten erhalten; bei paralleler
Arbeit einen eigenen Worktree verwenden. Node **22.22.3** mit npm **10.9.8**,
Linux x86_64 und Chrome for Testing aus dem Engine-npm-Lock werden benötigt.
`scripts/setup-toolchain.sh` kann die gepinnte Node-Distribution installieren;
dann deren `bin` in `PATH` aufnehmen. Keine Systeminstallation ersetzen.

```bash
git switch -c forge-update/<release>
git rev-parse HEAD                         # als REVIEW_BASE aufbewahren
git -C engine/forge fetch origin <tag-oder-voller-sha>
git -C engine/forge rev-parse 'FETCH_HEAD^{commit}'
git -C engine/forge switch --detach <gepruefter-voller-upstream-sha>
git add engine/forge                       # gebaut wird genau der gestagte Gitlink
node engine/scripts/validate-forge-update.mjs --base <REVIEW_BASE> --check-only
```

Das Release bzw. neue Set bewusst anhand der upstream-Änderungen wählen. Bei
Patchkonflikten in einem Wegwerfbaum arbeiten (siehe [patches/README.md](patches/README.md)),
Patches anpassen und ihre Gründe/Herkunft erhalten. Keine handveränderte
Submodule-Kopie bauen. Neue Ressourcen brauchen eine ausdrückliche Entscheidung
in `resources.json`. Geänderte Forge-APIs an der Bridge abfangen.

## Ein vollständiger Prüfauftrag

```bash
NODE_OPTIONS=--max-old-space-size=2048 \
JDK_JAVA_OPTIONS=-Xmx512m MAVEN_OPTS=-Xmx768m \
OPENMANA_NATIVE_IMAGE_XMX=6g OPENMANA_NATIVE_IMAGE_PARALLELISM=2 \
node engine/scripts/validate-forge-update.mjs --base <REVIEW_BASE>
```

Der Lauf braucht freien RAM/Swap und mehrere GB freien Plattenplatz. Auf einer
gemeinsam genutzten Maschine den verfügbaren Speicher vorher prüfen; keine
fremden Prozesse oder Swapdateien verändern. Die Angaben sind Ressourcenlimits,
kein Anspruch auf Funktion mit einer bestimmten kleinen Maschine.

Jeder Lauf legt `engine/build/update-…/` neu an (oder `--out` mit einem noch
nicht vorhandenen Unterverzeichnis von `engine/build`). Bestehende Builds und
Nachweise bleiben erhalten. Nur Download-Archive werden aus dem Toolchaincache
kopiert und erneut gehasht; die Werkzeuge werden frisch entpackt. `npm ci`
installiert beide gesperrten npm-Abhängigkeitsbäume. Maven darf seinen
Downloadcache nutzen, nie frühere Forge-/Bridge-Klassen oder WASM-Artefakte.

Die obligatorischen Schritte laufen nacheinander:

1. Pfadprüfung gegen den festgehaltenen Commit, einschließlich gestagter,
   ungestagter und ungetrackter Dateien und beider Seiten einer Umbenennung.
2. Frische Toolchain aus den Archivpins; Protokollgenerierung prüfen,
   Typecheck und Engine-Unit-Tests. Frischer Forge-Baum und alle Patches mit
   `git apply --check`; vollständiges Ressourcenpaket und Maven `clean package`
   einschließlich der echten JVM-Bridge-Tests.
3. Frischer Web-Image-Build mit Netzspiel-/Klassenprüfung, Manifest mit
   Quellfingerabdruck, Protokoll-/Toolchain-/npm-Lock-Prüfsummen und Artefakthashes.
4. Vollständige vorhandene Engine-Suite: JVM-Referenzen, identische Eingaben und
   Spuren in Node und Chrome, Mulligan/Priorität/Kosten/Ziele/Kampf/Commander,
   Kartenprüfungen und die negativen Protokoll-/Isolationsfälle. Browser-Skips
   sind für einen Update-Abschluss verboten.
5. Kartenkatalog gegen den neuen Forge-Pin bauen und die unveränderte App mit
   diesen neuen Artefakten durch `npm run check` prüfen: Schema, TypeScript,
   Lint, Unit-Tests, echte App-/Forge-Browserflüsse und PWA-Offline-/Updatefälle.
6. Erneut Quellen und Artefakte prüfen. Erst dann `engine/engine.lock.json`
   atomar ersetzen. Der Kandidat erhält außerdem seine eigene Lockkopie.

Standardmäßig werden aktuelle Scryfall-Bulkdaten genutzt. Für eine wiederholbare
Prüfung derselben Kartendaten `--bulk <cards/build/cache/all-cards-…jsonl.gz>`
mit dessen vorhandener `.entry.json` und Setliste angeben. Neue oder inzwischen
zuordenbare Forge-Ausnahmen lassen den Katalog laut scheitern. Wenn dafür
`cards/forge-unmatched.json` oder die Zuordnung geändert werden muss, ist das
eine separate Kartenpflegeänderung vor dem isolierten Forge-Update; die
Pfadprüfung bekommt keine allgemeine Ausnahme. Geänderte KI-Profile werden
weiterhin vom App-Build abgewiesen, bis deren Verhalten gesondert geprüft und
die Darstellung in einer ausdrücklich beauftragten Änderung angepasst wurde.

## Vertrag und Umfang

Ein Forge-Update verändert standardmäßig ausschließlich `engine/**`.
Toolchain-Pins werden in einem eigenen Wartungs-PR verändert. Die einmalige
Einrichtung dieser Pipeline umfasst auch den CI-Workflow und Projektdokumentation;
diese sind keine erlaubten zusätzlichen Pfade eines späteren Forge-Updates.

Eine tatsächlich notwendige Protokolländerung braucht eine erhöhte
`ProtocolVersion` und `--protocol-reason '<konkreter Grund>'`. Müssen dabei
Clientdateien außerhalb von `engine/` angepasst werden, zusätzlich jede einzelne
Datei mit `--adaptation-path src/<exakte-datei>` nennen. Keine Globs,
Verzeichnisse oder pauschale UI-Freigabe; diese Argumente dokumentieren die
vorher ausdrücklich autorisierte Protokollanpassung im Bericht. Auch Schemaänderungen innerhalb von `engine/` durchlaufen dieses Gate;
reine JSON-Formatierung ohne geänderten Inhalt bleibt möglich.

## Nachweise, Wiederverwendung und Freigabe

`pipeline.json`, `logs/`, `report/` und `catalog/` enthalten die tatsächlichen
Schritte, Rückgabecodes, Engine-Spuren, Browsernachweise, Quellinputs und
Prüfsummen. Ein Fehler stoppt die Pipeline und lässt den bisherigen Lock stehen;
der fehlgeschlagene Bauordner bleibt zur Diagnose. Nach einer Korrektur einen
neuen vollständigen Lauf starten. Keine alten Reports in einen neuen Lauf kopieren.

```bash
node engine/scripts/engine-lock.mjs verify engine/build/update-<lauf>/dist
```

Diese Prüfung bindet Lock, Manifest, jede Artefaktdatei, aktuellen Forge-Pin und
aktuelle Engine-Quellen zusammen. Die App wird mit
`OPENMANA_ENGINE_DIR=<lauf>/dist OPENMANA_CARDS_DIR=<lauf>/catalog` gebaut;
ein anderer Bauordner wird niemals still als Ersatz verwendet. Ein Neuaufbau
kann wegen Zeitstempeln und Web-Image-Ausgabe andere Bytes haben. Die Pipeline
belegt reproduzierbare Eingaben, einen sauberen Aufbau und Verhaltensgleichheit
zwischen JVM/WASM; eine bitidentische Wiederholbarkeit des Compilers ist nicht
behauptet. Die Hashes pinnen genau den tatsächlich geprüften Artefaktsatz.

Die GitHub-Actions-Datei `forge-update.yml` prüft PRs mit geändertem Forge-Pin
automatisch; für einen Patch-/Bridge-Update ohne Pinwechsel das Label
`forge-update` setzen. Ein manueller Lauf erlaubt explizite Protokollausnahmen.
Der Workflow nutzt denselben lokalen Einstieg und archiviert Nachweise/Artefakte,
erteilt aber keine Veröffentlichungsfreigabe. Einrichtung von Branch Protection
und ein tatsächlicher Hosted-Runner-Lauf sind separate Betreiberaktionen.

Nach grüner Prüfung Diff einschließlich Lock und Berichten reviewen und lokal
committen. Push, Release-Upload oder Deployment nur nach dev0gigs ausdrücklicher
Freigabe für den jeweiligen Auftrag. Prompt 31 behandelt die Veröffentlichung;
dieser Ablauf baut und validiert ausschließlich.
