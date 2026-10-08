# Quelltext, Lizenzen und öffentliche Freigabe

OpenMana-Code, Protokoll, Bridge und eigene Forge-Patches werden unter
**GPL-3.0-or-later** bereitgestellt. Der vollständige GPLv3-Text liegt in
`LICENSE`. Copyright © 2026 dev0gig und die OpenMana-Mitwirkenden.
OpenMana wird ohne Gewährleistung bereitgestellt, soweit gesetzlich zulässig;
die Einzelheiten und Rechte zur Weitergabe und Änderung stehen in der Lizenz.
Fremde Software behält ihre eigenen Copyright-Hinweise und Lizenzbedingungen.
Die Lizenz erfasst keine fremden Kartenbilder oder Marken.

## Öffentlicher Quelltext

Der vollständige Quelltext liegt öffentlich unter
https://github.com/dev0gig/openmana. Jede öffentliche Version nennt ihren
genauen Commit (Credits-Seite, `/legal/THIRD-PARTY-NOTICES.txt`); dort ist der
Stand mit Lizenztexten, Hinweisen, Lockdateien und Bauanleitung abrufbar.

Das Engine-Modul (Forge als WebAssembly) und der Kartenkatalog stammen aus
einem GitHub-Release dieses Repositorys (`deploy/artifacts.json` nennt Tag,
Größen und SHA-256). Jedes Release enthält zusätzlich:

1. ein **vollständiges Quellarchiv** des getaggten Commits einschließlich des
   **Forge-Quellstands am gitlink** (`engine/forge`; `git archive` allein
   enthält den Submodule-Inhalt nicht), der unveränderten Patch-Queue
   (`engine/patches/`, Herkunft je Patch), Bridge, Protokoll, Ressourcenliste,
   Build-Skripten, Konfiguration und Lockdateien;
2. die **Quellen von JGraphT 1.5.2**, das unter der LGPL-2.1-or-later-Option
   verwendet wird (`jgrapht-core-1.5.2-sources.jar` von Maven Central);
3. `engine.lock.json`, das Engine-Manifest und die Ressourceninventur.

Die übrigen eingebauten Java-/JavaScript-Bibliotheken stehen unter
Apache-2.0/MIT/BSD-artigen Lizenzen; ihre Texte, Copyrights und NOTICE-Dateien
sind in `THIRD-PARTY-NOTICES.md` und `notices/licenses/` erhalten.

## Offene Rechtsfrage: Oracle GraalVM / GFTC

Die GraalVM-Web-Image-/GFTC-Frage ist **nicht juristisch geklärt**: Oracle-Anteile
im erzeugten Launcher/WASM stehen laut Oracles GraalVM Free Terms and
Conditions unter deren Bedingungen; ob das mit der GPL von Forge vereinbar ist
(„System Libraries“ des Compilers oder nicht), ist offen. Der Quelltext der
Web-Image-Laufzeit ist bei Oracle unter GPLv2 mit Classpath Exception
veröffentlicht (https://github.com/oracle/graal, Ordner `web-image`). Die
erhaltenen Oracle-Lizenztexte und der vollständige Distributionsanhang sind
Hinweise, keine rechtliche Freigabe. Herleitung mit Quellen:
`docs/research/LICENSES.md`.

Der Projektbesitzer hat am 2026-10-08 entschieden, OpenMana trotzdem offen und
mit diesem Hinweis zu veröffentlichen (`docs/PUBLICATION.md`). Ein
Produktionsbuild (`OPENMANA_PUBLIC_RELEASE=1`) prüft diese dokumentierte
Entscheidung, das Quellangebot hier und den genauen Commit; ein bloß
umgestellter Wahrheitswert reicht nicht.

Das App-Icon hat der Projektbesitzer selbst mit ChatGPT erzeugt und zur
Weitergabe mit OpenMana freigegeben (`assets/app-icon/PROVENANCE.md`). Wie
OpenMana mit generativer KI entstand: `TRANSPARENCY.md`.

## Lokaler Neubau und Herkunft

`engine/engine.lock.json` bindet den geprüften Forge-Pin, die neun Patches,
Toolchain, Protokoll und Artefakte. `engine/UPDATING.md` beschreibt den vollständigen
Neubau und JVM-/WASM-/Chrome-Vergleich. `cards/README.md` beschreibt die
Scryfall-Katalogerzeugung. Root-`package-lock.json` und `engine/package-lock.json`
pinnen die npm-Versionen. Originale Änderungen bleiben in `engine/patches/`;
0001–0003 stammen aus ManaBrews GPL-Forge-Fork, 0004–0009 aus OpenMana.

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
die Regeln. OpenMana wurde mit umfassender generativer KI (OpenAI
ChatGPT/Codex, Anthropic Claude) entwickelt, siehe `TRANSPARENCY.md`.
