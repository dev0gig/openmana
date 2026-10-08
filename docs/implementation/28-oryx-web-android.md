# 28 — ORYX-Webintegration und zurückgestellte Android-Abnahme

Stand: 07.10.2026. Ein Webprojekt für Browser/PWA und die bestehende gemeinsame
ORYX-TWA. Keine eigene Android-Oberfläche, Paket-ID, Signierung, APK-Pipeline
oder Warehouse-Veröffentlichung.

## Webintegration

`public/.well-known/assetlinks.json` erklärt ausschließlich
`delegate_permission/common.handle_all_urls` für `net.tsnet.oryx` mit
SHA-256 `EB:25:B0:E8:DD:00:04:BD:6A:BB:7F:C0:FF:52:DF:FE:B2:B4:8D:76:D2:27:F2:5F:D8:16:C1:94:91:46:3F:AA`.

Quelle: bestehende ORYX-Verknüpfungsdatei und TWA-Vertrauensliste im
ORYX-Commit `ab3b8c70df7d85688e1b0d94f76dd3329b15ccd8`. Das vorhandene signierte
ORYX-0.2.4-APK wurde mit `apksigner verify --print-certs` unabhängig geprüft;
sein Signierzertifikat stimmt überein. OpenMana steht bereits als
`https://openmana.vercel.app` in dessen zusätzlichen vertrauenswürdigen
Ursprüngen. Es wurde kein Android-Projekt geändert oder APK gebaut.

Vite kopiert die Datei unverändert in `dist/.well-known/assetlinks.json`.
Vercels SPA-Fallback nimmt das gesamte `/.well-known/` aus; für diese Datei
sind JSON-MIME und `no-cache` konfiguriert. Alle vorhandenen COOP/COEP/CORP-
Header bleiben erhalten. Vertrauensmetadaten werden weder im PWA-Shellcache
gehalten noch durch dessen Fetch-/Navigationsfallback ersetzt. Die Prüfung
von Android geschieht am tatsächlich erreichbaren Server, unabhängig vom
Service Worker; ein Offline-Appcache ist kein Vertrauensnachweis.

Dateipfad und Zertifikatsbindung folgen der offiziellen
[Digital-Asset-Links-Anleitung](https://developers.google.com/digital-asset-links/v1/getting-started)
und [Statement-Syntax](https://developers.google.com/digital-asset-links/v1/statements).
Die öffentliche HTTPS-Auslieferung wird erst nach ausdrücklicher Freigabe geprüft.

„Zurück zu ORYX“ auf Start folgt der aktuellen kanonischen Launcheradresse
`https://oryx.quest/` aus ORYX `games.json`, auch nach direktem Browserstart.
Die Navigation bleibt ausdrücklich im selben Tab über `location.assign`.
Der providerweite Schutz für laufende/startende Partien und normales
Browser-/System-Back bleiben bestehen. OpenMana behält seinen Ursprung
`openmana.vercel.app`; SDK-/Cloudursprünge werden nicht geändert. Lokale
IndexedDB-Daten werden durch diese Navigation weder migriert noch entfernt.

Manifest, Web-/PWA-Icons, deutsche Touch-/Tastatureingaben, Direktstart,
Forge-/Bridge-/Protokoll-/Storagequellen und deren Versionen bleiben erhalten.
Der durch Prompt 26 verifizierte Artefaktsatz wird nach erfolgreichem
`engine-lock.mjs verify` wiederverwendet:
`engine/build/update-26-20261007-final/dist`, zugehöriger Katalog `catalog/`.
Manifest-SHA-256: `dd33caca4339210f51f87d60a115a70e1b4a5e6934c08404cca5950896314d2c`.

## Automatisierte Nachweise und ihre Grenzen

Die neuen Tests prüfen die gegen das signierte APK belegte ORYX-Identität,
Vercel-Header/Rewritegrenzen und den Ausschluss von Vertrauensdaten aus
PWA-Cache/Fallback. Die vollständige Chrome-Appsuite prüft zusätzlich die
exakten DAL-HTTP-Bytes ohne Redirect in Vite-Entwicklung und Preview.

`npm run test:oryx -- --no-build` führt die gezielte Webabnahme aus; sie ist
auch in der vollständigen `npm run check`-Suite enthalten. Reales Chrome
mit eigener IndexedDB lädt über die normale Sicherungs-/Replayoberfläche
lokale Decks, Einstellungen, einen Beispielspielstand und echte aufgezeichnete
Forge-JVM-Nachrichten in einer ausdrücklich konstruierten Replayhülle.
Direktstart, internes Browser-Back, Rückkehr nach ORYX im selben Tab, erneutes
Öffnen und Betrachtung des gespeicherten Forge-Verlaufs müssen alle ursprünglichen
Datensätze unverändert erhalten. Die Launcher-Landingpage ist ein ausgewiesener
Test-Stand-in. DAL-Requests kommen auch in einer kontrollierten PWA vom Netz.
Diese Prüfung erzeugt keine Forge-Engine nur zum Browsen gespeicherter Daten.

Die vollständige bestehende Suite prüft außerdem frische echte Forge-WASM-
Partien gegen KI, aktuelle Isolation/SAB/Wasm-Fähigkeiten, echte Enginefragen/
Antworten und Ergebnisse, Abbruch der ORYX-Navigation während einer laufenden
Partie, originale Aufzeichnungen, Installierbarkeit, sämtliche acht CSS-/Touch-
Viewportgrößen und strikte originale Worker-Traces mit maximal einer Engine.
Die zusätzliche PWA-Suite startet Forge mit tatsächlich gestopptem Server und
prüft Downloads, wartende/fehlgeschlagene Updates sowie unveränderte Originaldaten.

Abgeschlossene Prüfung am 07.10.2026 mit Node 22.22.3 und Chrome
153.0.8010.12:

- `npm run typecheck`, Lint und 56/56 fokussierte Tests in vier Dateien bestanden.
- Separater Produktionsbuild mit `NODE_OPTIONS=--max-old-space-size=512`
  bestanden; `npm run test:oryx -- --no-build` bestanden.
- Vollständiges `npm run check`: Schemafrische, Typecheck, Lint, 898/898 Tests
  in 73 Dateien, Produktionsbuild, gesamte originale Chrome-/Forge-Suite und
  vollständige PWA-Suite bestanden (Exit 0).
- 96 Routen-, 152 befüllte Zustands- und 288 Szenen-/Viewportprüfungen;
  661 axe-Messungen ohne Verstöße. Alle elf Worker-Grenzen und die originalen
  Lifecycle-Traces halten maximal eine aktive Engine ein.
- 483 vor dem vollständigen Lauf eingefrorene Quellen unverändert.
  Offline-Forge mit wirklich gestopptem HTTP-Server, deaktiviertem Netz und
  geleertem HTTP-Cache: ein Worker, null Serverrequests. Wartende und
  fehlgeschlagene Updates bewahren originale Aufzeichnungen und Ergebnisse;
  Installierbarkeit ohne Fehler, keine Page-Errors.
- DAL in Entwicklung und Preview: HTTP 200, JSON, kein Redirect, exakt
  306 Bytes, SHA-256
  `828450822fb9e00a2141017de958f46eaceea432a4460a72a7cea03ec0227fdc`.

Dauerhaft taskbezogen gesicherte lokale Evidenz (Git-ignoriert):
`reports/oryx-28/full-check.log`, `full-check/e2e/report.json`,
`full-check/pwa/report.json`, `audit.json`, `checked-source-hashes.json`,
`focused-web.log`, `focused-web/report.json`, `build.log`, `engine-lock.txt`,
`oryx-apk-certificate.txt`, `adb-devices.txt` und `runtime.json`.
Screenshots liegen bei den jeweiligen Reports. Vorherige Reports sind unter
`predecessor-e2e/` und `predecessor-pwa/` bewahrt. Drei erste fokussierte
Testanläufe scheiterten an neuem Testaufbau (Dateifeldlabel, mehrdeutigem
Decks-Link, fehlendem UTF-8-MIME der Launcher-Testseite); die Testselektoren
und Testseite wurden korrigiert, vorhandene Assertions nicht gelockert.
Fehllogs bleiben erhalten. Der temporäre eigene Swap-Reservefile wurde nach
dem vollständigen Lauf deaktiviert und entfernt, das eigene Browser-TMP
entfernt; ursprünglicher Swap und fremde Prozesse blieben bestehen.
Kein neuer Enginebuild/JVM-Differentiallauf wird für diesen Webtask behauptet.
Alle Browsernachweise gelten für Desktop-Chrome auf Odin samt CSS-/Touch-
Emulation. Sie belegen weder eine TWA-Vertrauensentscheidung noch Android-
Speicherlimits, physische Geräteperformance oder tatsächliche Hintergrundverwerfung.
Die Aufzeichnungen sind keine wiederherstellbaren laufenden Spielstände.

## Nachtrag Prompt 31 (2026-10-08): Geräteabnahme teilweise, Rest erlassen

Nach der Veröffentlichung auf `https://openmana.oryx.quest/` startete der
Projektbesitzer OpenMana auf seinem Fold7 aus der regulär installierten
ORYX-App 0.2.5: Diagnose „Isoliert (COOP/COEP): ja“, Engine spielt, Forge
2.0.15/Protokoll 8, Kartendaten eingerichtet; Googles Digital-Asset-Links-
Prüfung `linked: true` für beide Adressen. Die echte Partie am Gerät,
Drehen/Klappen, Hintergrund, „Zurück zu ORYX“ mit Rückfrage, Rückkehr,
gespeicherte Partie und Android-Zurück hat der Projektbesitzer am 2026-10-08
ausdrücklich erlassen – **nicht geprüft, nicht bestanden**. Einzelheiten:
`31-production-vercel.md`. Der ursprüngliche Vermerk folgt unverändert.

## Verbindlich offen: physische ORYX-/Android-Abnahme

**Nicht durchgeführt und nicht bestanden.** ADB ist vorhanden, aber
`~/sdk/Android/Sdk/platform-tools/adb devices -l` zeigte am 07.10.2026
kein physisches Gerät (beim späteren Check lediglich einen fremden Emulator).
Keine Veröffentlichung wurde ausgelöst.

Der Projektbesitzer hat am 07.10.2026 ausdrücklich entschieden, diese Abnahme bis zur
freigegebenen Veröffentlichung zurückzustellen, und verlangt, sie festzuhalten.
Prompt 28 darf nach vollständiger lokaler Web-/Browserprüfung completed werden;
physische ORYX-Abnahme bleibt Voraussetzung des Veröffentlichungsabschlusses
in zentralem Prompt 31 und des finalen Android-/ORYX-Readinessnachweises in 32.
Die Veröffentlichungssperre durch Prompt 31 und aktuelle ausdrückliche
Push-/Deploymentfreigabe gelten weiter.

Verbindliche spätere Prüfschritte:

1. Nach freigegebener Bereitstellung auf `https://openmana.vercel.app/` die
   öffentliche `/.well-known/assetlinks.json` auf HTTP 200, JSON und fehlende
   Redirects prüfen. Paket und SHA-256 des **tatsächlich installierten**
   signierten ORYX-APKs abgleichen; OpenMana muss dessen vertrauenswürdiger
   Ursprung sein. Keine Validierungs-Bypässe als Erfolg ausgeben.
2. Physisches Android-Gerät mit regulär installiertem ORYX verwenden.
   Gerätemodell, Android-, ORYX- und tatsächliche Browserprovider-/Chrome-
   Version, geprüften App-/Engine-Commit und Manifesthash protokollieren.
   OpenMana über den Launcher ohne Custom-Tab-Adressleiste starten und den
   direkten normalen Browserstart separat prüfen.
3. COOP/COEP/CORP, `crossOriginIsolated`, SharedArrayBuffer, WasmGC, exnref und
   typed references im tatsächlichen ORYX-Kontext prüfen. Eine echte Forge-
   WASM-Partie gegen KI spielen: Mulligan, Land/Zauber, Priorität, Ziele/Kosten,
   Angreifer/Blocker, Ergebnis und originale gespeicherte Aufzeichnung.
   Worker-Start/Stop/Ersatz nachvollziehen, maximal eine aktive Engine.
4. Bereits vorhandene lokale Decks, Einstellungen und gespeicherte Partien
   vor/nach Start und Hin-/Rücknavigation vergleichen. Aus laufender Partie
   intern nach Start, ORYX-Rückweg abbrechen und unveränderte Partie fortführen;
   nach Partieende zurück zu `oryx.quest`, OpenMana erneut öffnen und den
   gespeicherten Forge-Verlauf betrachten. System-/Browser-Back testen.
5. Touch, Hoch-/Querformat, Hintergrund/Rückkehr und Speicher-/Offlinegrenzen
   physisch prüfen. Reload/Android-Verwerfung darf die laufende Partie beenden;
   keine Recovery behaupten. Keine bestehenden Gerätedaten löschen, vorher
   Sicherung anfertigen. Logs/Screenshots, Einschränkungen und Ergebnis hier
   und im zentralen Bericht nachtragen; Gate in 31/32 erst dann erledigen.
