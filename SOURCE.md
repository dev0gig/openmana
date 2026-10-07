# Quelltext, Lizenzen und öffentliche Freigabe

OpenMana-Code, Protokoll, Bridge und eigene Forge-Patches werden unter
**GPL-3.0-or-later** bereitgestellt. Der vollständige GPLv3-Text liegt in
`LICENSE`. Copyright © 2026 dev0gig und die OpenMana-Mitwirkenden.
OpenMana wird ohne Gewährleistung bereitgestellt, soweit gesetzlich zulässig;
die Einzelheiten und Rechte zur Weitergabe und Änderung stehen in der Lizenz.
Fremde Software behält ihre eigenen Copyright-Hinweise und Lizenzbedingungen.
Die Lizenz erfasst keine fremden Kartenbilder oder Marken.

Das Entwicklungsrepository ist https://github.com/dev0gig/openmana und derzeit
nicht öffentlich zugänglich. Dieser Link ist **kein öffentliches Quellangebot**.
Es gibt noch keine öffentliche OpenMana-Veröffentlichung und kein öffentliches
Quellarchiv für das geprüfte Engine-Artefakt.

## Vor jeder öffentlichen Auslieferung

Die GraalVM-Web-Image-/GFTC-Frage bleibt offen. Oracle-Anteile im erzeugten
Launcher/WASM und separat lizenzierte Laufzeitteile sind noch nicht abschließend
zugeordnet. Die erhaltenen Oracle-Lizenztexte und der vollständige
Distributionsanhang sind Hinweise, keine rechtliche Freigabe. Siehe
`docs/research/LICENSES.md` und die darin verlinkten Originalquellen.

Die Build-Option `OPENMANA_PUBLIC_RELEASE=1` bricht derzeit immer ab; eine bloße
Änderung des Policy-Flags hebt das Gate nicht auf. Dessen spätere Aufhebung
benötigt eine gesondert geprüfte Implementierung mit Nachweisen.
Ein normaler lokaler Build ist keine
Veröffentlichungsfreigabe. Die bestehenden Push-/Deployment-Regeln gelten weiter.

Vor einer Freigabe müssen für **genau dieselben ausgelieferten Bytes**:

1. Die Oracle-/GFTC-/GPL-Kompatibilität fachkundig geklärt und mit überprüfbaren
   Nachweisen dokumentiert werden; keine bloße Änderung eines Booleschen Werts.
2. Ein öffentlich erreichbarer Corresponding Source mit gleichwertigem Zugang
   bereitstehen: OpenMana-Quellen, **vollständiger Forge-Quellstand am gitlink**,
   unveränderte Patch-Queue mit Datums-/Herkunftshinweisen, Bridge/Protokoll,
   Ressourcen, Build-Skripte, Konfiguration, Lockdateien und Bauanleitung.
   `git archive` allein enthält den Forge-Submodule-Inhalt nicht.
3. Die Quellen der eingebauten Java-/JS-Bibliotheken und der genau verwendeten
   Oracle-Laufzeit verfügbar sein, soweit ihre Lizenz dies verlangt. Insbesondere
   JGraphT wird unter der **LGPL-2.1-or-later-Option** verwendet; die passende
   Bibliotheksquelle und ein überprüfter Weg zum Neubau mit geänderter Bibliothek
   gehören zur Abnahme. Der bisherige Engine-Build ist kein Relinking-Nachweis.
4. Lizenztexte, Copyrights, Apache-NOTICE-Dateien und die erzeugten
   `THIRD-PARTY-NOTICES` neben der App erhalten bleiben. Die UI muss direkt zum
   passenden öffentlichen Quellstand führen; Hinweise/Downloads müssen auch
   ohne Konto zugänglich sein. Aufbewahrung und Verfügbarkeit gemäß den Lizenzen.
5. App-/Engine-/Katalog-Hashes und der öffentlich angebotene Quellstand
   abgeglichen werden. Erst danach ist das Gate mit Nachweisen neu zu prüfen.

Die vorläufige Icon-Herkunft ist bis zu dev0gigs ursprünglichem Anvil-Upload
nachvollziehbar und bytegleich geprüft. Ein ursprünglicher Urheber bzw. eine
separate Bildlizenz ist in der Quelle nicht dokumentiert; die Software-GPL
entscheidet diese Bildrechte nicht. Die Berechtigung zur öffentlichen
Bildweitergabe gehört ebenfalls zur Freigabe (siehe
`assets/app-icon/PROVENANCE.md`).

## Lokaler Neubau und Herkunft

`engine/engine.lock.json` bindet den geprüften Forge-Pin, die acht Patches,
Toolchain, Protokoll und Artefakte. `engine/UPDATING.md` beschreibt den vollständigen
Neubau und JVM-/WASM-/Chrome-Vergleich. `cards/README.md` beschreibt die
Scryfall-Katalogerzeugung. Root-`package-lock.json` und `engine/package-lock.json`
pinnen die npm-Versionen. Originale Änderungen bleiben in `engine/patches/`;
0001–0003 stammen aus ManaBrews GPL-Forge-Fork, 0004–0008 aus OpenMana.

Die App generiert bei jedem Produktionsbuild ihre Hinweise aus den tatsächlich
enthaltenen Bundle-Modulen, den CSS-/Font- und Generatorquellen sowie der gegen
das ausgewählte Engine-Manifest geprüften Klasseninventur. Fehlt eine Zuordnung
oder ein Lizenztext, scheitert der Build. Die komplette Oracle-Distributionsdokumentation
ist ein vorsorglich erhaltener Anhang; sie behauptet nicht, dass sämtliche dort
genannten Bibliotheken in OpenMana stecken.

Für einen neuen Engine-Build zuerst dessen Lock verifizieren und die App mit
diesem Build und seinem Katalog bauen. Die neue Inventur wird unter
`<build-directory>/report/notices-inventory.json` erzeugt. Neue Versionen und
Originaltexte ausschließlich unter `engine/**` gemäß `engine/NOTICES.md`
prüfen und ergänzen; der bestehende Root-Snapshot bleibt unverändert.
Die Inventur
erfasst Klassen, Interfaces und Annotationen, ordnet unzugeordnete Typen anhand
der Original-JAR-Bytes zu und lehnt unbekannte sowie Netzwerk-/CDDL-Typen ab.

ManaBrews Hauptrepository ist technische Referenz, kein übernommener
AGPL-Anwendungscode. Scryfall liefert Kartendaten/-bilder; Forge entscheidet
die Regeln. OpenAI ChatGPT und Anthropic Claude unterstützten die Entwicklung.
