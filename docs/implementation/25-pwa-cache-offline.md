# 25 — PWA, Enginecache und Lebenszyklus

Der Produktionsbuild erhält einen Service Worker; Vite-Entwicklung bleibt ohne
Offlinecache. Registriert wird nur in einem bereits isolierten Browser mit
Service-Worker-Unterstützung. Die bestehenden Featureprüfungen vor dem
Engine-Download und im Dedicated Worker bleiben unverändert verbindlich.

## Cache und Integrität

`vite/pwa.ts` erzeugt nach dem geprüften Engine-/Katalogcopy den stabilen
`/sw.js`. Seine eingebettete Konfiguration enthält Größe und SHA-256 jeder
Appdatei und jedes der vier ausgelieferten Engineartefakte, einschließlich
des originalen Engine-Manifests. Der Appcache ist nach Inhalt, Workerquellen
und Isolationheadern adressiert; der Enginecache unabhängig nach seinen
Artefakten. Ein Workerquellenwechsel erhält einen eigenen Stagingcache und
kann bei fehlgeschlagener Installation keinen aktiven Appcache entfernen.

Bei der Installation werden nur eigene Appdateien, sämtliche Lazy-Chunks,
Schriften, Manifest und Icons gespeichert. Engine und Rohkatalog werden nicht
ungefragt geladen. Der Katalog bleibt im bestehenden geprüften
IndexedDB-Installer; die gespeicherten Decks und Aufzeichnungen bleiben in
der unveränderten Datenbank. Fremde Bilder, Scryfall-API und Cloudantworten
werden vom Worker weder abgefangen noch gespeichert.

Forge wird ausdrücklich in Einstellungen geladen (rund 76 MiB entpackt,
genaue Größe aus dem Build). `pwa/cache-runtime.js` lädt nacheinander, lehnt
Redirects/opaque/HTTP-Fehler ab und prüft Länge und SHA-256 jeder empfangenen
Datei. Der vollständige Marker wird zuletzt gespeichert. Ein Fehler entfernt
nur den eigenen unvollständigen Cache; eine vorzeitig beendete Workerinstanz
hinterlässt keinen vollständigen Marker. Ein erneuter Versuch prüft sämtliche
Dateien neu. Gleichzeitige Anfragen an denselben Worker teilen einen Download.

Der Fetchhandler verwendet den Enginecache erst mit Marker und allen
Mitgliedern. Vorher laufen normale Online-Engineanfragen unverändert über das
Netz; es gibt keine Vermischung einer halben neuen Engine mit einer alten.
Statusprüfungen berücksichtigen die passende Manifest-URL der geöffneten App
und fehlende Cachemitglieder. Eine Speicherverwerfung wird beim Öffnen und
Zurückkehren sichtbar; ein bereits geladener Worker läuft dadurch weiter,
eine spätere offline gestartete Engine braucht wieder einen vollständigen
Cache.

Cacheantworten behalten MIME-Typ und COOP `same-origin`, COEP `require-corp`
und CORP `same-origin`. Decodierte Bodies erhalten keine fremden
`Content-Encoding`-/`Content-Length`-Transportangaben. Navigationen liefern
das eigene geprüfte `index.html`, damit Deep-Links und Lazy-Routen offline
dieselbe Appversion lesen. `/sw.js` wird stets am Cache vorbei geprüft;
Vercel erhält `no-cache` und keinen SPA-Rewrite für Worker/Manifest/Icons.

## Update und laufende Partie

Die neue App wird zunächst vollständig in einem eigenen Cache geprüft. Eine
fehlgeschlagene Installation lässt die vorherige Version erhalten und zeigt
einen Fehler. Eine misslungene Erstinstallation hat eine ausdrückliche
Wiederholungsaktion, ohne Reload oder Datenreset.

Es gibt **kein `skipWaiting`, keinen erzwungenen Reload und keine automatische
Tabnavigation**. Die native Waiting-Phase bleibt bestehen, bis sämtliche
Clients der vorherigen Version geschlossen wurden. Einstellungen zeigen:
Partien beenden, alle OpenMana-Tabs und App-Fenster schließen, dann erneut
öffnen. Ein Reload eines einzelnen Tabs garantiert keine neue Version, wenn
ein anderer Tab offen bleibt. Erst bei Aktivierung werden alte eigene App-
und andere Enginecacheversionen entfernt; Datenbank und fremde Caches bleiben.
Eine unveränderte geprüfte Engine wird über einen Appwechsel hinweg behalten;
eine andere Engineversion erfordert einen neuen ausdrücklichen Download.

Die Lebenszyklusoberfläche sendet keine Forge-Eingaben. Große zusätzliche
Downloads sind während einer queued/starting/playing-Partie gesperrt. Eine
Updateprüfung darf auch dann stattfinden; sie aktiviert nichts vorzeitig.

Eine laufende Partie lebt weiterhin im Tab: Reload, Schließen und
Hintergrundverwerfung können sie beenden. Die vorhandene beforeunload-Warnung
bleibt, aber Browser müssen sie bei Hintergrundverwerfung nicht zeigen.
Aufzeichnung/Wiedergabe ist keine Fortsetzung. Es wird keine Recovery behauptet.

## Installation, Speicher und Offlinegrenzen

Das vorhandene Manifest und die Icons bleiben erhalten. Ein tatsächliches
`beforeinstallprompt` wird für den optionalen Installationsbutton aufbewahrt;
der native Installationsdialog öffnet erst auf Klick. Andernfalls erklärt die
App das Browsermenü und iOS „Zum Home-Bildschirm“. Installation allein sagt
nichts über die geprüften Wasm-Fähigkeiten aus.

`navigator.storage.persist()` wird nur nach der ausdrücklichen Aktion
„Dauerhaften Speicher anfragen“ aufgerufen. Zusage, Ablehnung und fehlende API
bleiben unterscheidbar; Sicherungen bleiben empfohlen. Keine persistierte
Präferenz, neue DB-Version oder Cloudsetting wurde eingeführt.

Offline spielen ist mit gespeicherten Decks, komplett geprüftem App-/Enginecache
und unterstütztem Browser möglich. Für Suche/Import ohne Netz muss zusätzlich
der Katalog zuvor installiert sein. Bilder und optionale ORYX-Cloud benötigen
Netz; der vorhandene Kartentextfallback bleibt. Ein Browser darf Websitecache
und Daten trotz Installation löschen. Die Cacheprüfung ist eine aktuelle
Zustandsaussage, keine Garantie gegen spätere Verwerfung.

## Verifikation

Fokussierte Tests prüfen Markerreihenfolge, vollständige Bytes/Isolation/MIME,
SHA-/Längen-/HTTP-/Netz-/Quota-Rollback, Wiederholung nach Abbruch, fehlende
Dateien, Decoderheader und die unveränderte offene Forge-Frage. Komponenten
prüfen den Downloadschutz, ausdrückliche Speicheranfrage samt Ablehnung und
die Erklärung einer wartenden Version. Bestehende Deploymentchecks bleiben
erhalten und prüfen zusätzlich den Worker und die statischen Rewritegrenzen.

`npm run test:pwa` baut und führt die reale Suite in einem temporären
Chromeprofil aus; `--no-build` verwendet den vorhandenen Produktionsbuild.
Sie ist zusätzlich Bestandteil von `npm run check`, hinter der unveränderten
bisherigen vollständigen App-/Forge-/Tischsuite.

Die gezielte Chromesuite verwendet echte CacheStorage, IndexedDB und die
unveränderte Forge-WASM-Engine. Nur ausdrücklich bezeichnete Fehlerphasen
verändern Testserverbytes. Bei verfälschter App/Engine bleibt die Bytelänge
gleich: die Ablehnung muss deshalb den SHA-256 prüfen. Ein explizites 60-Karten-Testdeck mit echten
Forge-Namen wird als geprüfte Backupfixture geladen; die eigentliche Partie
startet in Forge, stellt einen vollständigen originalen State und eine offene
Frage bereit und endet durch die bestätigte Aufgeben-Aktion.

Nach HTTP-Cachelöschung werden sowohl Browsernetz als auch der tatsächliche
Serverlistener abgeschaltet. Die App lädt einen Deep-Link neu, erhält
Isolation/SAB, startet genau einen Forge-Worker und erreicht eine echte offene
Frage ohne Serveranfrage. Die ursprüngliche vollständige Aufzeichnung bleibt
bei fehlgeschlagenem und wartendem Update bytegleich. Das Schließen nur des
Settings-Tabs ersetzt den laufenden Worker nicht; erst nach allen Clients
wird die neue Version aktiviert. Decks, Einstellungen und die anschließend
beendete Aufzeichnung überleben den Wechsel und eine Enginecacheverwerfung.
Eine misslungene Erstinstallation veröffentlicht keinen Cache und kann ohne
Datenverlust wiederholt werden. Installierbarkeit, mobile Breite und axe werden
mit tatsächlichem Chrome geprüft.

Die bloße Page-Netzemulation erwies sich als ungenügend: Chromes interne
SW-Updateabfrage kann `/sw.js` trotzdem erreichen. Der zusätzliche tatsächliche
Serverstopp verschärft den Nachweis; kein Check wurde zum Erfolg gelockert.

Erster Vollcheck: 878/878 Tests bestanden, dann ein konkreter Devserver-MIME-Fehler. Vites vorheriger Build im selben Prozess ließ `NODE_ENV=production` zurück; `import.meta.env.PROD` allein registrierte daher fälschlich den Worker im späteren Serve-Auftrag. Der Lauf wurde mit unveränderten Quellen bewusst beendet. Registrierung und eine zusätzliche Regression richten sich jetzt ausdrücklich nach Vites `build`/`serve`-Auftrag; der gesamte Check wird wiederholt. Die [Vite-Env-Dokumentation](https://vite.dev/guide/env-and-mode) bestätigt die Unabhängigkeit von Mode und `NODE_ENV`.

Der zweite vollständige Lauf bestand 879 Tests und sämtliche übrigen App-/288-Tischchecks, endete aber mit Exit 1 am ursprünglichen strikten Worker-Guard. Der abschließende Trace zeigte beim automatischen Vorwärmen nach Aufgeben einen neuen Worker 200 ms vor Chromes Closemeldung des alten. Die Meldung wurde erst nach Reload geprüft; der Reload selbst schloss den Worker bereits vor Navigation. Es wird daraus keine bewiesene parallele Forge-Ausführung abgeleitet. Der Appadapter ruft weiter zuerst `dispose()`/`terminate()` auf und lässt danach vor einer neuen Browser-Engineallokation eine Sekunde Freigabezeit. Das gilt auch bei schneller erneuter Startaktion oder Änderung der Bootoptionen; abgebrochene Bootversuche bleiben durch den bestehenden Attempt-Guard abgebrochen. Engine-/Client-/Protokollpaket und Artefakte ändern sich nicht.

Die Browser-API bietet [keinen Abschluss-Promise für terminate()](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate); das Intervall ist ein konservativer Ressourcenübergang, kein behaupteter Beweis eines universellen Chrome-Abschlusszeitpunkts. Der unveränderte harte Browser-Guard und sein vollständiger Trace müssen im endgültigen gesamten Lauf weiterhin max1 bestehen. Eine neue Regression verwendet den realen Client/Browser-Port über einen gekennzeichneten Worker-Stand-in und prüft Freigabe vor Ersatz sowie Stop während der Wartephase.

Ein dritter Versuch wurde während Vitest ausdrücklich über die eigene PTY beendet, bevor ein Browser lief: der Self-Review ergänzte die fehlende Bedingung, dass gecachte Enginebytes bei aktuell fehlenden Wasm-Fähigkeiten keine Offline-Spielzusage erlauben. Die neue Komponentenregression prüft genau diesen Fall. Technische Offlinefehler erhalten deutsche Handlungsanweisungen; ohne erfolgreiche Statusantwort wird keine Cachebereitschaft behauptet. Die echten Browser-Fehlerfälle prüfen nun gleich lange korrupte Bytes und verlangen eine wirklich fertige Aufzeichnung samt originalem Forge-`game.end`. Kein ursprünglicher Guard wird geändert.

Ein weiterer vollständig eingefrorener Lauf bestand 881 Tests und sämtliche ursprünglichen Worker-Guards samt Traces mit max1, endete aber mit einer neuen Chrome-Warnung: ein Modul-Preload wurde nach Service-Worker-Übernahme wegen „cross-world service worker resource mismatch“ nicht benutzt. Der ursprüngliche Preferences-Guard lehnt Warnungen unverändert ab. Der Produktionsbuild deaktiviert jetzt spekulative JS-Modul-Preloads; normale Modulimporte und die notwendigen dynamischen CSS-Abhängigkeiten bleiben erhalten. Der vollständige geprüfte Shellcache enthält weiterhin jeden Lazy-Chunk. [Vite dokumentiert die modulePreload-Option](https://vite.dev/config/build-options.html); die installierte Vite-Implementierung filtert bei `false` nur auf nötige CSS-Abhängigkeiten. Gebaute HTML-Datei und neue echte PWA-Regression verlangen keine Modul-Preloadlinks und keine solche Cross-world-Warnung. Die gesamte ursprüngliche Suite wird erneut ausgeführt, ohne Warnungsausnahme.

Der endgültige vollständige Lauf ist Exit 0: Schemaabgleich, TypeScript, oxlint, **881/881 Tests in 72 Dateien**, Produktionsbuild, die vollständige unveränderte Chrome-App-/Forge-/Tischsuite und die integrierte PWA-Suite. Ein separater finaler 512-MiB-Build besteht ebenfalls mit Exit 0. Alle 334 Quellen sind vor/nach dem Lauf bytegleich; keine laufenden Änderungen oder Guardlockerungen.

Eigenständiges Reportaudit: 96 Routen, 152 gefüllte Zustände, 288 Szenen, 24 Viewerresizes, 16 frische Forge-Resizes; 659 ursprüngliche axe-Messungen sowie die zusätzliche PWA-Settingsprüfung ohne Verstöße. Jeder ursprüngliche protokollierte Worker-Lifecycle und sein kompletter Trace bleibt max1. Die zusätzliche PWA-Suite besteht gleichlange Hashkorruption, echten Serverstopp mit genau einem Worker/null Serverrequests, native wartende/fehlgeschlagene Updates, wirklich fertige Aufzeichnung samt originalem Forge-Ergebnis, Verwerfung und Erstinstallationsretry. InstallabilityErrors und PageErrors sind leer. Tatsächliche Persistenzanfrage wird von Chrome abgelehnt und ehrlich angezeigt.

Logs, eingefrorene Quellen, unabhängige Detailaudits, Screenshots und sämtliche Fehlversuche: `~/.local/state/dmm/openmana-21-25-20261007T042732Z/25/`. Zentraler Report: `workflow/reports/openmana-21-25-20261007T042732Z-25.md` im isolierten Dropzoneworktree. Quellen-/UI-/Lifecycle-Self-Review abgeschlossen; keine offene fachliche Blockade.
Der `engine/`-Quellbaum samt Bridge/Protokoll bleibt unverändert, die elf Engineartefakte
werden gegen den verifizierten Vorgänger SHA-identisch wiederverwendet.
Keine neue JVM-/WASM-Differenzsuite wird behauptet.

Die Nachweise betreffen Chrome153 auf Odin und CSS-/Touch-Emulation.
Keine physische Android-/ORYX-/iOS-Installation, Hardwareverwerfung oder
produktive Vercelbereitstellung wird behauptet. Die Veröffentlichung bleibt
angehalten; ausschließlich lokale Commits.

Die konservative Updateentscheidung folgt dem nativen
[Service-Worker-Lebenszyklus](https://www.w3.org/TR/service-workers/).
Die Speicherzusage folgt den tatsächlichen Ergebnissen der
[StorageManager.persist-API](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
