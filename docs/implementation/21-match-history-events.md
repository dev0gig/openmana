# 21 — Spielverlauf aus Forge

Stand: 07.10.2026. Zentraler Auftrag: `dev0gig/dropzone/workflow/tasks/completed/openmana-21-match-history-events.md`. Vollständig implementiert, selbst geprüft und verifiziert; nur lokal committet.

## Ergebnis und Datenfluss

„Spielverlauf ansehen“ im Tischkopf öffnet Forges Spielprotokoll. Alle MEDIUM-GameLog-Einträge bleiben in ihrer Empfangsreihenfolge erhalten, einschließlich gleicher Texte, leerem/null Text, Ereignistyp, Akteur und Quellkarten-ID. Die Bridge sendet `events` weiterhin vor dem erklärten vollständigen `state`; `EngineSession` übernimmt das Ereignis zuerst und erst danach den Zustand. Es gibt keine Erzählung aus UI-Eingaben oder Zustandsdifferenzen, keine Regelinterpretation und keine Begrenzung auf die 20 Hinweise des Menüs.

Die Bridge konnte zuvor aus dem lokalisierten Satzanfang einen Spielernamen ableiten. Dieser Fallback ist entfernt. Ein vorhandener Akteur kommt ausschließlich vom strukturierten Controller der Forge-Quellkarte zum Sendezeitpunkt. Das ist eine Quellenzuordnung, keine neue Bestimmung des tatsächlich aktivierenden Spielers für jeden Effekt. Logeinträge ohne Quellkarte/Controller — beispielsweise viele Zug-, Kampf- oder Lebenspunktmeldungen — bleiben „Nicht zugeordnet“. Die Originaltexte bleiben unverändert. Für Ereignisse, deren handelnder Spieler vom Quellcontroller abweicht oder dessen Controller zwischen Ereignis und Versand wechselt, liefert der bisherige Vertrag keine separate Ereigniszeit-Akteuridentität; die Bridge erfindet diese nicht.

## Ansicht und Karten

Hochkant steht eine kompakte Liste im unteren Sheet; quer kommt eine breitere Seitenansicht mit Ereignistyp und fortlaufender Eintragsnummer hinzu. Mehrzeilige Forge-Texte bleiben vollständig lesbar. Die Liste scrollt innerhalb des Fensters, während Titel und Schließen erreichbar bleiben. Neue Einträge versetzen die Leseposition nicht automatisch; „Neueste Einträge“ springt auf Wunsch ans Ende. Der neue Kopfknopf benötigt keine zusätzliche Tischhöhe.

Eine Quellkarten-ID wird gegen den aktuellen sichtbaren Zustand oder die aktuell offene Forge-Frage aufgelöst. Der Kartenknopf öffnet die vorhandene Kartenansicht ausschließlich zum Ansehen, selbst wenn Forge gerade eine Aktion für die Karte anbietet. Gehalten werden nur ID und gegebenenfalls exakte Fragen-ID; Bewegung, Verdeckung, Verschwinden und Rücknahme einer Frage werden nicht durch gespeicherte alte Karten verdeckt. Fehlende Quellen sagen „Quellkarte nicht mehr sichtbar“, ohne die Identität aus Forges Text zu erraten. Nach dem Schließen geht der Fokus zur Quelle im Verlauf und danach zum Kopfknopf zurück.

Die gerade beendete oder technisch abgebrochene Partie behält den empfangenen Verlauf bis zur nächsten Partie oder zum Neuladen. Die Ergebnis-/Abbruchseite kann ihn öffnen; Karten bleiben auch dort nur lesbar. Persistentes Speichern und Replay gehören zu Prompt 22, keine IndexedDB-Migration in 21.

## Umsetzung

- `src/engine/engine-session.ts`: vollständige Logeinträge während Spiel, Ende und Abbruch; neue Partie beginnt leer.
- `src/game/history-sheet.tsx`: Originaltexte, strukturierte Zuordnung, aktuelle Quellen, kompakte/richere Darstellung, manuelles Ans-Ende und Fokus.
- `src/game/game-table.tsx` / `game-page.tsx`: Kopfzugang und rein lesende aktuelle Kartenansicht, Zugriff nach Ende/Abbruch.
- `BridgeGuiGame.actor`: nur strukturierter Quellcontroller, keine Namens-/Prosaerkennung.
- `scripts/record-table-scenes.ts`: vorhandene reale Spielaufzeichnungen um ihre bis zum Szenenzeitpunkt gelieferten GameLog-Einträge ergänzen.
- `scripts/e2e/run.ts --history-only`: kleiner sequenzieller Chrome-Lauf; der volle App-Lauf prüft zusätzlich die Historie einer tatsächlich laufenden Forge-Partie.

Forge-Pin, acht Forge-Patches, Protokollformen und Datenbankschema bleiben unverändert. Wegen der Bridge-Korrektur ist ein neuer JVM-/WASM-Build erforderlich. Alte WASM-Artefakte zählen nicht als Nachweis der korrigierten Bridge.

## Verifikation und Grenzen

Die Prüfungen laufen sequenziell. Vitest nutzt einen Worker; fokussierte Frontendtests und der Produktionsbuild bestehen mit 512 MiB Node-Heap. Für die echte Node-WASM-Engine und den vollständigen App-E2E-Steuerprozess sind 2 GiB notwendig: Beide brechen bei 512 MiB am Heap-Limit ab. Ein Worker bleibt auch im vollständigen Check erhalten (`VITEST_MAX_WORKERS=1`); kein Test wird ausgelassen oder abgeschwächt.

| Nachweis | Ergebnis |
| --- | --- |
| Sauberer Engine-Build: Host/Protokoll/Client/Worker/Trace | 83 Tests bestanden. |
| Maven/JVM-Bridge einschließlich `HistoryTest` | 76 Tests, keine Fehler, keine übersprungenen Tests; BUILD SUCCESS. |
| Neuer WASM-Build aus diesem JVM-JAR | Exit 0, 147,84 s native-image, Peak RSS 4535,1 MiB; Modul 75,4 MiB. |
| Vollständige Engine-Suite mit Chrome | Exit 0, 78 Ergebnisse: 25 JVM, 31 Node, 22 Chrome; 0 Fehler, Browser nicht übersprungen. |
| Echte Nachrichtenauditierung | 14 Fixtures, 399 Ereignisbatches / 1382 MEDIUM-Einträge unmittelbar vor ihrem `state`; 0 Reihenfolgefehler. Ereignistyp, Quelle und Akteur der englischen/deutschen Vergleichspartie stimmen exakt überein. |
| Neu aufgezeichnete Tischszenen | 29 Szenen; bestehende Spielinhalte und Reihenfolge unverändert. Nur flüchtige Sequenznummern/Nachrichtenpositionen unterscheiden sich. Die Hauptphasenszene enthält 96 reale Logeinträge. |
| Fokussierte Sitzung/Historie/Seite/Tischmodell | 94/94 Tests bestanden. |
| Fokussierter Chrome-Historienlauf | 12 Szenen-/Viewportprüfungen und Quellen-/Fokus-/Scrollprüfungen in drei Größen; Originaltexte vollständig identisch, keine gesendeten Eingaben, 0 axe-Verstöße. Screenshots selbst geprüft; danach Metadatenabstand verbessert. |
| Abschließender Build + fokussiertes Chrome-History | Beide Exit 0 nach finaler Flex-Korrektur; 12 Szenen-/Viewportprüfungen + Quellen-/Fokus-/Scrollprüfungen in drei Größen, 0 axe-Verstöße. Die vollständige App-Prüfung war bereits gestartet, als die letzte reine Flex-Darstellung korrigiert wurde; die betroffene Darstellung wurde danach mit diesem Build und dem fokussierten Browserlauf erneut geprüft. |
| Vollständiges `npm run check` | Exit 0: 839/839 Tests in 66 Dateien, Schema/Typecheck/Lint/Build und vollständige Chrome-Regressionssuite bestanden. 216 Szenen-/Viewportprüfungen (29 echte Aufzeichnungen + 7 explizit gebaute Grenzfälle, je 6 Größen), 0 axe-Verstöße. Historie: 96 Originaleinträge und Quellen-/Fokus-/Scrollprüfungen in jeder Größe, 0 Eingaben; echte Partie 9 Einträge Desktop / 7 Handy, nach Ende 6 Einträge, jeweils 0 axe-Verstöße. |

Der erste saubere Engine-Build erreichte den WASM-Compiler, wurde dort bei 2 GiB Heap / zwei Threads von `earlyoom` mit SIGTERM (Exit 143) beendet. Ein Versuch mit 1536 MiB endete mit Java-Heap-OOM. Eigene Versuche mit 1792 MiB bzw. 3 GiB wurden nach anhaltend voller Old Generation und vielen Full-GCs kontrolliert beendet. Der erfolgreiche Compilerlauf nutzt 6 GiB Heap / zwei Threads. Mit ausdrücklicher Dispatcher-Freigabe wurden zwei eigene temporäre Swapdateien zu je 4 GiB angelegt, ohne Boot-/Hostkonfiguration zu ändern oder fremde Prozesse zu beenden. Zustand vor Aktivierung, Abbrüche und erfolgreiche Wiederholung sind persistent gesichert. Nach der letzten Prüfung wurden beide eigenen Swapdateien mit ausreichender RAM-Reserve einzeln deaktiviert und anschließend entfernt. Nur die ursprüngliche `/swapfile` bleibt aktiv; keine eigene temporäre Swapdatei bleibt zurück. Nachweis: `swap-cleanup.json` im Rohnachweisverzeichnis.

Die erste vollständige App-Prüfung mit 512 MiB Node-Heap bestand Schema/Typecheck/Lint und 839 Unit-Tests, scheiterte aber beim E2E-Steuerprozess am Heap-Limit. Ein weiterer Lauf mit 2 GiB deckte eine veraltete Kartenviewer-Assertion auf: Seit Prompt 20 dürfen DFCs neben „Schließen“ die bekannten „Kartenseiten“-Inspektionsknöpfe haben. Die korrigierte Assertion erlaubt nur diese exakt benannte Gruppe und den ausschließlich „Schließen“ enthaltenden Footer; Forge-Aktionen bleiben verboten. Ein zunächst undiagnostizierter 300-Sekunden-Szenen-Timeout wiederholte sich; die ergänzte Diagnose zeigte `ERR_INSUFFICIENT_RESOURCES` bei Modulabrufen, bevor die Seite überhaupt gerendert war. Entscheidungsszenen verwenden deshalb wie die schon bestehende Layoutprüfung eine neue Seite je Szene. Browserprofil/Katalog bleiben erhalten, alle Szenen, Eingaben, Assertions und Browserfehlerprüfungen bleiben bestehen; keine Wiederholung fehlgeschlagener Assertions oder versteckte Skips. Die konkrete intern erschöpfte Chrome-Ressource ist nicht bewiesen. [Chromiums URLLoader](https://chromium.googlesource.com/chromium/src/+/main/services/network/url_loader.cc) kann diesen Fehler beispielsweise beim Anlegen der Response-Datenpipe melden; daraus folgt keine Diagnose eines bestimmten Hostlimits.

Für Folgeworker: Die erfolgreich gebauten Artefakte bleiben unter `engine/build/{dist,jvm,resources,harness}`; eine zusätzliche persistente Kopie mit SHA-256-Inventar liegt unter `~/.local/state/dmm/openmana-21-25-20261007T042732Z/21/engine-artifacts/`. Die Kopie zählt nur bei unveränderten Forge-/Bridge-/Protokollquellen als passender Build. Bei Änderungen: `OPENMANA_NATIVE_IMAGE_XMX=6g OPENMANA_NATIVE_IMAGE_PARALLELISM=2 NODE_OPTIONS=--max-old-space-size=512 bash engine/scripts/build-wasm.sh` nach Prüfung des verfügbaren RAM/Swap; Engine-Suite: `NODE_OPTIONS=--max-old-space-size=2048 JDK_JAVA_OPTIONS=-Xmx512m bash engine/scripts/test-engine.sh`; App-Suite: `VITEST_MAX_WORKERS=1 NODE_OPTIONS=--max-old-space-size=2048 npm run check`.

Persistente Rohnachweise: `~/.local/state/dmm/openmana-21-25-20261007T042732Z/21/`, insbesondere `engine-build.log`, `jvm-test-reports/`, `engine-wasm-6g.log`, `engine-manifest.json`, `engine-tests-final/`, `real-event-order.json`, `recorded-scene-comparison.json`, `focused-unit-final.log`, `history-browser-final/`, `app-browser-final/`, `app-browser-final-summary.json`, `app-build-final.log`, `history-browser-final.log` und `app-check-final.log`. Der zentrale Abschlussreport verlinkt diese Nachweise und die endgültigen Screenshots.

Keine physische Geräteprüfung, kein Push, kein Deployment. JVM-/WASM-/Chrome-Spielnachweise stammen von echter Forge; gezielt gebaute UI-Grenzfälle in Unit-Tests sind keine zusätzlichen Engine-Partien. Quellcontrollerzuordnung ersetzt keine fehlende Ereigniszeit-Akteuridentität. Historie bleibt bis zur nächsten Partie oder zum Neuladen im Sitzungsspeicher.

Der endgültige Chrome-Lauf passiert nach der Seitenisolation sämtliche Entscheidungsszenen; `app-check-final.log` endet mit „E2E OK“. Der normalisierte Entscheidungsszenen-/Assertionkörper ist gegenüber dem Vorgänger unverändert (`decision-assertions-preserved.json`). Der tatsächliche Node-Pfad in dieser Umgebung ist `~/.nvm/versions/node/v22.22.3/bin` (Node 22.22.3).
