# 27 — Credits, Lizenzen und Hinweise

## Umsetzung

Credits enthält einen sichtbaren Open-Source-Bereich mit Copyright,
Gewährleistungsausschluss, GPL-3.0-or-later und drei lokalen Dokumentlinks:
vollständiger GPL-Text, alle Drittanbieterhinweise sowie Quelltext und
Veröffentlichungsstand. Forge/Card-Forge, ManaBrew, Scryfall, OpenAI ChatGPT
und Anthropic Claude bleiben nach ihrem tatsächlichen Beitrag beschrieben.
ManaBrew ist Referenz und Quelle dreier GPL-Forge-Patches, kein übernommener
AGPL-Anwendungscode. Der ORYX-SDK-Header und die Anvil-Icon-Herkunft sind erhalten.

`LICENSE` und `SOURCE.md` legen die Repository-Lizenz und die noch offenen
öffentlichen Quellpflichten offen. Ein privater GitHub-Link ist ausdrücklich
kein öffentliches Quellangebot. Oracle-/GFTC-Outputbedingungen bleiben
ungeklärt; `OPENMANA_PUBLIC_RELEASE=1` stoppt den Build, auch wenn das unbewiesene
Boolean in der Policy verändert würde. Ohne explizite Publikationsanweisung
bleiben außerdem die bestehenden Push-/Deployment-Regeln verbindlich.

## Inventur und Erzeugung

`scripts/notices/engine-inventory.py` liest die Klassen-SBOM des tatsächlich
ausgewählten Prompt-26-Artefakts. Erfasst werden Klassen, Interfaces und
Annotationen: **7.818 Typen in 26 Komponenten**, vollständig zugeordnet.
Compilerzuordnungen bleiben erhalten; unzugeordnete Bibliothekstypen werden
anhand der Original-JAR-Klassen und bytegleicher Einträge im gebauten Fat-JAR
zugeordnet. Die beiden Guava-Versionen (Forge und Oracle-Runtime) bleiben
getrennt. Unbekannte und mehrdeutige Typen werden nicht weggelassen.

Keine jupnp-, Netty-, Jetty- oder Servlet-Typen sind enthalten; keine der
zugeordneten Java-Abhängigkeiten wird über eine CDDL-Lizenzoption verwendet.
Die offene Zuordnung von Oracle-/GFTC-Laufzeitteilen wird damit nicht entschieden.

`vite/notices.ts` ermittelt tatsächlich gerenderte App-Bundle-Module und ergänzt
die realen CSS-/Font-Imports, shadcn-Quellen und Ajv-Standalone-Generatorcode.
Installierte Versionen müssen zum npm-Lock passen. Komplette LICENSE-Texte,
Copyrights, Apache-NOTICE-Dateien und Oracle-Launcher-Header bleiben erhalten;
ein NOTICE allein reicht nicht als Lizenztext. Der vollständige Oracle-
Distributionsanhang liegt vorsorglich bei und wird ausdrücklich nicht als
Liste eingebauter Komponenten bezeichnet. Einige JDK-Originaltexte sind
texttreu von ISO-8859-1 nach UTF-8 transkodiert; ursprüngliche Bytehashes und
Zeichensätze stehen pro Datei im Anhang.

Der Build erzeugt **95 Komponenten** und **98 Text-/Herkunftseinträge** unter
`dist/legal/`, etwa 1,98 MB vollständige Hinweise. Vier rechtliche Dateien
(inklusive Maschineninventur) werden vor der PWA-Hashbildung erzeugt und
werden Teil des geprüften Offline-Shells. Fehlende/geänderte Texte, nicht
geprüfte Lizenzarten, ein falscher Engine-Manifesthash, neue unbekannte
Komponenten oder verbotene Netzwerktypen stoppen den Build.

Die geprüfte Root-Fassung `THIRD-PARTY-NOTICES.md` ist ein ausdrücklich
übernommener Snapshot des fertigen Builds. Ein Build verändert keine
Repository-Quelldateien. Für neue Forge-Kandidaten entsteht die Inventur unter
deren `report/`; geprüfte neue Lizenzzuordnungen/Texte können gemäß
`engine/NOTICES.md` ausschließlich unter `engine/**` ergänzt werden.
Die vorhandene Engine-only-Pfadprüfung bleibt erhalten.

## Self-Review und Korrekturen

- Die vollständige SBOM-Classpath-Liste enthält auch nicht ausgelieferte
  Netzwerkbibliotheken. Sie wird nicht als Auslieferungsinventur übernommen.
- Die alte Klassenstatistik hätte Interfaces/Annotationen verfehlt. Die
  neue Inventur erfasst sie ebenfalls und prüft auch dort jupnp/CDDL.
- JDK-Rechtstexte sind teilweise ISO-8859-1: Originalhash/Charset dokumentiert,
  ohne Textverlust nach UTF-8 übertragen.
- Automatisches Überschreiben des Root-Snapshots hätte Forge-Update-Scopes
  beschädigt. Hinweise werden nur in den Build geschrieben; neue Kandidaten
  und Ergänzungen bleiben ohne App-Quelländerung ausführbar.
- Der Service Worker hatte auch bekannte Dokumentnavigationen durch die
  App-Startseite ersetzt. Bekannte Shell-Dateien haben jetzt Vorrang; der
  Offline-Test öffnet alle drei Links und prüft deren kompletten DOM-Text.
- Statisches `text/plain` ohne Charset ließ Chrome Umlaute falsch dekodieren.
  Preview und Vercel liefern die Dokumente ausdrücklich als UTF-8; `/legal/`
  ist von der Vercel-SPA-Umschreibung ausgenommen. HTTP- und echte Linktests
  prüfen MIME, Isolation, Bytes und Darstellung. Kein Deployment ausgelöst.
- Ein vorhandenes NOTICE kann eine fehlende vollständige Lizenz nicht ersetzen.
- Ein neuer Forge-Pin erhält seinen eigenen geprüften Copyright-Header und
  dessen Text-ID in der Komponenteninventur; ein Test prüft diese Zuordnung.
- Die fehlenden separaten Texte bei react-remove-scroll-bar und JSR305 sind
  transparent mit tatsächlichen Ersatzquellen dokumentiert. Kein Ersatztext
  wird als Originaldatei des betreffenden Pakets ausgegeben.

## Verifikation

Gezielte Prüfungen bestanden: Typprüfung, Lint, 36 Tests für Hinweise/PWA/
Deploymentkonfiguration (darunter elf Notice-Tests), vier
Python-Inventurtests (inklusive jupnp-Interface und unbekannter Bibliothek),
erneute bytegleiche Inventurerzeugung und unabhängige Engine-Lockprüfung.
Der isolierte Kandidatenpfad wurde mit einem ausdrücklich als Fixture
geänderten Manifestzeitpunkt und **identischen verifizierten Runtime-Bytes**
geprüft: 7.818 Typen, 95 Komponenten, App-Eingabefingerabdruck unverändert.
Das ist kein Nachweis eines neu gebauten Forge-Releases.

Der vollständige finale `npm run check` ist erfolgreich: **893 Tests in 73
Dateien**, Typprüfung, Lint, Build sowie Chrome 153 ohne E2E-Fehler. Alle
Oberflächen und der komplette Spieltisch wurden auf acht Bildschirmgrößen
geprüft, einschließlich echter Forge-Partien, Deck-/Daten-/Wiedergabeflüsse
und ORYX mit ausdrücklich separater Test-Cloud.

Die PWA-Prüfung bestand mit tatsächlich gestopptem HTTP-Server und deaktiviertem
Browsernetz: alle drei Dokumente hashgleich, MIME/UTF-8 erhalten, alle drei
Links öffnen ihren vollständigen Text; anschließend eine echte Forge-Partie.
Auch fehlerhafte/unterbrochene Downloads, Updates mit laufender Partie,
Cache-Verlust, gescheiterte Installation und erneuter Versuch bestanden.
Der zusätzliche Preview-Linktest öffnete alle Dokumente auf 360/1440 px,
verglich HTTP-Bytes und Browsertext und bestätigte vier hashgleiche
PWA-Legal-Einträge sowie den bytegleichen Repository-Snapshot.
Die aktuelle Inventur enthält 95 Komponenten/98 Texte; die Hinweise umfassen
1.986.303 Bytes. GitHub bestätigte die Repository-Sichtbarkeit als privat.
Der reale `OPENMANA_PUBLIC_RELEASE=1`-Negativtest wurde ebenfalls bestanden.

Nachweise: `reports/legal-27/full-check/`,
`reports/legal-27/final-legal-check.json`, `reports/e2e/report.json`,
`reports/pwa/report.json`; vollständiger Log
`/var/tmp/openmana-27-check-third.log`. Der Build hat keine Quelldokumente
verändert. Whitespace-Prüfung für Code/eigene Dokumentation bestanden;
Whitespace in hashgeprüften Original-Lizenztexten bewusst unverändert erhalten.

Zwei frühere Gesamtläufe brachen an unterschiedlichen vorhandenen
Spieltisch-Schritten ab (Screenshot bzw. `boundingBox`); sie zählen nicht als
erfolgreiche Gesamtprüfungen. Der unveränderte separate Zonentest bestand.
PWA-Versuche mit Profil im RAM-basierten `/tmp` scheiterten beim Cache-Schreiben
nach erfolgreicher Byteprüfung (`Cache.put()`-Netzwerkfehler). Mit
Festplatten-TMPDIR bestand sowohl die separate PWA als auch der vollständige
finale Lauf, bei unveränderten Limits/Assertions. Der Zusammenhang mit der
Profilablage ist belegt, die genaue Chromium-/Hostursache nicht abschließend
bestimmt. Fehlgeschlagene Nachweise bleiben unter `reports/legal-27/` erhalten.
Die eigene temporäre 4-GiB-Swapreserve wurde deaktiviert/entfernt; beide
ursprünglichen Swapdateien bleiben aktiv. Temporäre Browserprofile wurden
automatisch gelöscht.

## Verbleibende Veröffentlichungsgates

Fachkundige Oracle-/GFTC-/GPL-Klärung; öffentlich zugänglicher Corresponding
Source für die exakten Artefakte, einschließlich Forge-Submodule, Patches,
Bridge, Bauanleitung und erforderlicher Bibliotheks-/Runtimequellen; bei
JGraphT LGPL-Quellen und überprüfter Neubau mit geänderter Bibliothek.
Siehe `SOURCE.md` und `docs/research/LICENSES.md`. Keine öffentliche Freigabe
durch diesen Task, kein Push/Deployment, keine physische ORYX-Geräteprüfung.
Die Icon-Quelle dokumentiert den Upload und Anvil-Hash, jedoch keine separate
Bildlizenz/Originalurheberschaft. Es wird keine Lizenz erfunden; öffentliche
Bildweitergabe ist ebenfalls Teil der späteren Freigabe.
