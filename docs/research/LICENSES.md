# Lizenzen und Pflichten: Forge-Wasm-Stack für OpenMana

> Research zu Prompt 00, Stand **2026-09-24**. **Keine Rechtsberatung.**
> Festgehalten ist, was die geprüften Lizenzdateien, Header und Metadaten sagen.
> Wo aus dem Text keine eindeutige Folge ableitbar ist, steht das ausdrücklich da.

## Ergänzung: implementierter Stand vom 07.10.2026 (Prompt 27)

Die folgenden ursprünglichen Abschnitte dokumentieren den Recherchezeitpunkt.
Inzwischen enthält das Repository `LICENSE` (GPLv3-Text, Versionswahl
GPL-3.0-or-later in `SOURCE.md`/Paketmetadaten), eine sichtbare Open-Source-Seite
in Credits und aus dem Build erzeugte `THIRD-PARTY-NOTICES.md`.
Die Oracle-/GFTC-Frage ist **weiter juristisch offen**. Am 2026-10-08 hat der
Projektbesitzer entschieden, OpenMana trotzdem offen und mit diesem Hinweis zu
veröffentlichen, mit öffentlichem Repository und vollständigem Quellarchiv je
Engine-Release (`docs/PUBLICATION.md`, `SOURCE.md`). Diese Entscheidung ist
keine Klärung der Frage.

Die Engine-Inventur beruht ursprünglich auf dem Prompt-26-Artefakt; seit Prompt 31
gilt die Inventur des ausgelieferten Protokoll-8-Artefakts (`notices/engine-inventory.json`,
gleiche Komponenten, 7.821 statt 7.818 Typen). Sie erfasst Typen: Klassen, Interfaces und Annotationen. Die ältere
Buildstatistik mit 6.898 Klassen zählte nur die SBOM-Eigenschaft `class`.
Die SBOM-Liste aller Classpath-Bibliotheken ist keine Auslieferungsliste:
Typen mit Compiler-Zuordnung behalten diese; andere werden mit Original-JARs
und den bytegleichen Klassen im tatsächlich gebauten Fat-JAR abgeglichen.
Unbekannte, mehrdeutige oder Netzwerk-/jupnp-Typen werden abgelehnt.

26 Engine-Komponenten mit 7.818 Typen wurden zugeordnet, darunter beide
Guava-Versionen (Forge 33.3.1-android, Runtime 33.4.8-jre), Jimfs am Oracle-Pin,
Sentry, tinylog, XStream, Gson, Commons Lang/Math, JGraphT und Annotationen.
Keine jupnp-, Netty-, Jetty- oder Servlet-Typen sind enthalten; keine der
zugeordneten Java-Abhängigkeiten wird über die CDDL-Option verwendet.
Dies entscheidet **nicht** die offenen Oracle-Laufzeitbedingungen.
JGraphT wird über LGPL-2.1-or-later geführt; Quellen und Neubau mit geänderter
Bibliothek bleiben Teil der öffentlichen Release-Abnahme.

Die App-Inventur stammt aus tatsächlich gerenderten Bundle-Modulen, ergänzt
um die realen CSS-/Font-Imports, shadcn-Quellen und Ajv-Generatorcode.
Originaltexte, Apache-NOTICE-Dateien, Oracle-Launcher-Header und der komplette
Oracle-Distributionsanhang bleiben erhalten. Der Oracle-Anhang behauptet nicht,
dass jede dort genannte Bibliothek eingebaut ist. Einige JDK-Originaltexte
verwenden ISO-8859-1: ohne Textänderung nach UTF-8 transkodiert, mit ursprünglichem
Bytehash und Zeichensatz pro Datei.

Zwei Quellenlücken werden ausdrücklich dokumentiert: `react-remove-scroll-bar`
2.3.8 liefert keinen eigenen MIT-Text (Paketmetadaten nennen MIT und Anton
Korzunov; der gleiche Originaltext/Autor aus `react-remove-scroll` wird erhalten).
JSR305 liefert keinen separaten Text im JAR/Sources-JAR; sein veröffentlichtes
POM nennt Apache-2.0, dessen vollständiger Standardtext beiliegt. Diese Hinweise
geben sich nicht als Originaldateien der jeweiligen Pakete aus.

Oracles weiterhin vorhandene Output-Klausel und die Regeln für separat
lizenzierte Technik wurden am 07.10. erneut mit dem
[Originaltext](https://www.oracle.com/downloads/licenses/graal-free-license.html)
abgeglichen. Eine Typinventur ersetzt keine rechtliche Freigabe.
`SOURCE.md` beschreibt die noch offenen Pflichten; `OPENMANA_PUBLIC_RELEASE=1`
scheitert ausdrücklich. Ablauf und technische Nachweise stehen in
[Implementierung 27](../implementation/27-credits-licenses.md).

## 1. Geprüfte Lizenzen

| Komponente | Lizenz | Geprüfte Quelle | Rolle in OpenMana |
|---|---|---|---|
| **Forge** (Code) | **GPL-3.0-or-later** | [`LICENSE`](https://github.com/Card-Forge/forge/blob/ed0333fecb1fea0671b3e50cadc1da4f71db5798/LICENSE) ist der GPLv3-Text. „either version 3 … or (at your option) any later version“ steht in den Datei-Headern, z. B. [`Game.java`](https://github.com/Card-Forge/forge/blob/ed0333fecb1fea0671b3e50cadc1da4f71db5798/forge-game/src/main/java/forge/game/Game.java), `CardDb.java` und `AiController.java` („Copyright (C) 2011 Forge Team“). Zusätzlich GPLv3 in `forge-gui/LICENSE.txt` | wird als Wasm **ausgeliefert** |
| Forge-Kartendaten (`res/cardsfolder`, `editions`, `tokenscripts` …) | GPL-3.0-or-later (keine eigene Lizenzdatei, es gilt die Repo-Lizenz) | Repo-Baum | im Wasm eingebettet |
| Forges Drittlizenz-Hinweise | `forge-gui/res/licenses/`: tinylog (Apache-2.0), xpp3 (Indiana University Extreme! Lab), xstream (BSD-Stil), multiline-label (MIT) | Dateiliste `ed0333f` | mitliefern, soweit enthalten |
| ManaBrews Forge-Fork | GPL-3.0-or-later (`LICENSE` identisch mit upstream) | `witchesofthehill/forge@e7d2b93` | Quelle der Sync-Patches (GPL) |
| **ManaBrew** (eigener Code) | **AGPL-3.0-or-later** | [`LICENSE.md`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/LICENSE.md), `LICENSE-AGPL-3.0-or-later` | nur Referenz |
| ⚠️ Widerspruch bei ManaBrew | [`THIRD-PARTY-NOTICES.md`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/THIRD-PARTY-NOTICES.md) nennt `forge-harness/` „itself GPL-3.0-or-later“, `LICENSE.md` stellt allen eigenen Code unter AGPL | beide Dateien | im Zweifel **AGPL** annehmen |
| ManaBrew-Protokollspezifikation | CC-BY-4.0 | `LICENSE.md` §Protocol | nur bei Übernahme von Spezifikationstext |
| `@manabrew/forge-wasm`, `@manabrew/protocol` (npm) | AGPL-3.0-or-later | npm-Metadaten (0.2.0 bzw. 5.11.2) | keine Abhängigkeit (siehe [MANABREW_WASM.md](MANABREW_WASM.md) §8) |
| **GraalVM Web Image**, Quelltext der Laufzeit | GPLv2 mit Classpath Exception (wo der Datei-Header sie vorsieht) | [`web-image/LICENSE`](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/LICENSE) | Laufzeitteile landen **im Artefakt**. Der erzeugte Launcher (ManaBrew-Produktion) trägt 13 Oracle-Header „GNU General Public License version 2 only … ‚Classpath‘ exception“ |
| **Oracle GraalVM** 25.4.4.1.1 (GA) und EA-Builds, als Build-Werkzeug | **GraalVM Free Terms and Conditions (GFTC)**, für EA zusätzlich „License for Early Adopter Versions“ | `LICENSE.txt` im Tarball 25.4.4.1.1 (gelesen), [Oracle-Text](https://www.oracle.com/downloads/licenses/graal-free-license.html) | Werkzeug. Die Output-Klausel betrifft das Artefakt (§3.4) |
| Jimfs (In-Memory-Dateisystem der Web-Image-Runtime) | Apache-2.0 | [`google/jimfs`](https://github.com/google/jimfs); `svm-wasm-jimfs.jar` im GraalVM-Tarball. Im Produktionsmodul finden sich 16 `com.google.common.jimfs`-Klassennamen | Hinweis mitliefern |
| Binaryen (`wasm-as`) | Apache-2.0 | GitHub-Lizenz | nur Build, wird nicht ausgeliefert |
| Anvil (`PROTOKOLL.md`, App) und `forge-anvil` | keine `LICENSE`-Datei im Repo `anvil`. `forge-anvil` liegt im GPL-Fork `dev0gig/forge` | Dateiliste | eigener Code des Projektbesitzers. Er darf ihn wiederverwenden; im Wasm wird er Teil des GPL-Gesamtwerks |

## 2. Java-Bibliotheken, die ins Wasm gelangen können

Das sind die direkten Abhängigkeiten von `forge-core`, `-game`, `-ai` und `-gui` (`ed0333f`) plus transitive aus dem Anvil-Fat-JAR. Die Lizenzen sind geprüft über POM-Metadaten bzw. die GitHub-Lizenzdatei. **Welche tatsächlich im Modul landen, zeigt erst der Build-Report.** Im produktiven ManaBrew-Modul stehen Klassennamen u. a. aus Netty, Sentry, tinylog, Guava, commons-lang3/math3, Gson, XStream, jgrapht, Jetty und jupnp.

| Bibliothek (Version) | Lizenz | Anmerkung |
|---|---|---|
| guava 33.3.1-android, failureaccess, commons-lang3 3.18.0, commons-text 1.12.0, commons-math3 3.6.1, gson 2.13.2, netty-all 4.1.115.Final, lz4-java 1.10.2, tinylog 2.7.0, jctools, jheaps | Apache-2.0 | Lizenztext **und NOTICE-Dateien** mitliefern (Apache-2.0 §4d), z. B. Netty und Apache Commons |
| sentry 8.21.1, slf4j-api 2.0.16, rssreader 3.8.2, apfloat 1.10.1, checker-qual (Annotationen) | MIT | |
| xstream 1.4.21 | BSD-3-Clause (BSD-Stil) | |
| mxparser 1.2.2 / xpp3 | Indiana University Extreme! Lab Software License | BSD-artig mit Nennungspflicht |
| xmlpull 1.1.3.4a | Public Domain | |
| jgrapht-core 1.5.2 | LGPL-2.1 **oder** EPL-2.0 | über die LGPL-2.1-Option GPL-verträglich |
| jetty 9.4.57 | Apache-2.0 **oder** EPL-1.0 | über die Apache-Option unkritisch; wird für Netzspiel gebraucht und ist im Browser unnötig |
| javax.servlet-api 3.1.0 (über Jetty) | CDDL **oder** GPLv2 mit Classpath Exception | über die GPL-Option unkritisch |
| ⚠️ **jupnp 3.0.5** (`org.jupnp`, `.support`) | **CDDL-1.0** ([`LICENSE.txt`](https://github.com/jupnp/jupnp/blob/main/LICENSE.txt)) | Die FSF stuft CDDL-1.0 als **nicht GPL-kompatibel** ein; ein GPL-Modul und ein CDDL-Modul dürfen nicht zusammengelinkt werden ([FSF-Lizenzliste](https://www.gnu.org/licenses/license-list.html)). Gebraucht wird es nur für UPnP im Netzspiel. **Muss aus dem Modul heraus**, Nachweis per Build-Report |

## 3. Pflichten bei Auslieferung

### 3.1 Wann die Pflichten greifen
Der Browser lädt das Wasm herunter und führt es lokal aus. Damit wird **eine Kopie übertragen**, und das ist nach GPLv3 „conveying“ von Object Code. Der Ausnahmesatz der GPLv3 („Mere interaction with a user through a computer network, with no transfer of a copy, is not conveying“) greift gerade nicht. Anders als bei Anvil auf odin entstehen die Pflichten also mit der ersten **öffentlich erreichbaren** Auslieferung. Solange nur der Projektbesitzer selbst Zugriff hat (geschützter Deploy), gibt OpenMana nichts an Dritte weiter. `dev0gig/openmana` ist derzeit **privat**.

### 3.2 GPLv3-Pflichten für das Engine-Artefakt (Forge + Patches + Bridge)
1. **Corresponding Source** zum exakt ausgelieferten Stand bereitstellen (§6 d): „from a designated place … equivalent access to the Corresponding Source“. Der Quelltext darf auf einem anderen Server liegen, wenn neben dem Artefakt klar darauf verwiesen wird und er so lange verfügbar bleibt wie nötig.
   - Dazu gehören Forge-Pin, Patch-Queue, Bridge, Build-Skripte und Configs: „including scripts to control those activities“ (§1).
   - Ausgenommen sind „System Libraries“ sowie allgemeine, unverändert genutzte Werkzeuge (§1).
   - Bei einem privaten Repo heißt das: pro Release ein öffentliches Quellarchiv oder ein öffentliches Repo.
2. Lizenztexte und Copyright-Hinweise erhalten (§4). Geänderte Dateien, also die Forge-Patches, tragen einen Vermerk mit Datum (§5 a).
3. Das Werk als Ganzes steht unter der GPL (§5 c). Das Wasm aus Forge und Bridge wird GPL-3.0-or-later.
4. **Appropriate Legal Notices** in der Oberfläche (§5 d): Copyright, Gewährleistungsausschluss, Lizenz und Weg zum Lizenztext. Das passt zur Credits-/Lizenzseite aus Bible §14.

### 3.3 Die OpenMana-Oberfläche
Die UI (TypeScript) spricht mit dem Worker ausschließlich über JSON-Nachrichten. Ob sie damit ein getrenntes Programm oder Teil eines Gesamtwerks ist, geben die Lizenztexte nicht eindeutig her. Die Nachrichten transportieren vollständige Spielzustände, sind also nicht nur lose gekoppelt. **Am einfachsten und sichersten:** OpenMana insgesamt unter **GPL-3.0-or-later** stellen. Das Repo hat heute noch keine `LICENSE`-Datei.

### 3.4 GFTC und GPL: das eine offene Rechtsthema
**Belegt** durch den GFTC-Text (Abschnitt „License Rights and Restrictions“):
- (b) erlaubt, unveränderte Programme weiterzugeben, wenn dafür keine Gebühren verlangt werden. OpenMana ist kostenlos und erfüllt das.
- „those portions of a Program included in otherwise unmodified software that is produced as output resulting from running the unmodified Program (such as may be produced by use of GraalVM Native Image) shall be deemed to be an unmodified Program“. Oracle-Anteile im Output stehen also unter GFTC.
- Die GFTC knüpft Bedingungen daran: keine Hinweise entfernen, Exportkontrolle, **kein Reverse Engineering** oder Dekompilieren.
- Für EA-Builds schreibt Oracle zusätzlich: „Oracle does not recommend bundling this build with your products or otherwise using for any production purpose.“ Deshalb empfehlen wir GA 25.4.4.1.1 ([FORGE_BUILD.md](FORGE_BUILD.md) §3).

**Nicht belegt:**
- Welche Teile des erzeugten Wasm unter welche Lizenz fallen. Die Oracle-Distribution besteht laut `release`-Datei aus `web-image` (offen, GPLv2 mit Classpath Exception) und `web-image-enterprise` (geschlossen). Welcher Anteil im **Output** landet, ist offen.
- Ob diese Laufzeitanteile als „System Libraries“ des Compilers gelten (GPLv3 §1: „a compiler used to produce the work“). Wenn nicht, stünde ein GPL-Werk neben GFTC-Anteilen mit Zusatzbedingungen (§10: „You may not impose any further restrictions“).

**Praxis:** ManaBrew liefert genau so ein Artefakt öffentlich unter AGPL aus (npm, Web). Das zeigt die Praxis, ist aber kein Rechtsnachweis.

**Wege:**
- (a) fachkundige Prüfung vor der ersten öffentlichen Auslieferung;
- (b) Web Image selbst aus `oracle/graal/web-image` bauen (GPLv2 mit Classpath Exception, ohne Enterprise-Teile); ob das funktioniert, ist **ungeprüft**;
- (c) nicht öffentlich ausliefern.

### 3.5 ManaBrew-Code
Wird Code aus ManaBrews Hauptrepo übernommen (`SabTransport`, `WasmMain`, `seat.js`, Worker, Build-Skripte), gilt **AGPL-3.0-or-later** für die Kombination (GPLv3 §13). Die zusätzliche Netzwerkpflicht (AGPL §13) greift nur, wenn Nutzer über ein Netz entfernt mit einer *veränderten* Version interagieren; eine lokal laufende Engine allein löst sie nicht aus.
**Empfehlung:** keinen ManaBrew-Code kopieren, sondern die dokumentierte Technik (Worker, `SharedArrayBuffer`, Einbetten) selbst umsetzen. Die Sync-Patches aus dem Forge-Fork sind GPL und davon nicht betroffen.

### 3.6 Credits (Bible §14), nach Art getrennt
- **Eingebaute Software:** Forge / Card-Forge-Community (GPL-3.0-or-later), Oracle GraalVM Web Image als Laufzeit im Artefakt, dazu die Bibliotheken aus §2.
- **Inspiration und technische Referenz:** ManaBrew. Werden Patches aus dem ManaBrew-Fork übernommen, ist ManaBrew zusätzlich Code-Quelle unter GPL.
- **Datenquelle:** Scryfall.
- **KI-Unterstützung:** OpenAI ChatGPT, Anthropic Claude.

## 4. Vor der ersten öffentlichen Auslieferung zu erledigen

- `LICENSE` (GPL-3.0-or-later) ins Repo; zu jedem Deploy einen öffentlichen Quellstand, verlinkt aus der App.
- `THIRD-PARTY-NOTICES` **aus dem Build erzeugen**: Komponentenliste, Lizenztexte und Apache-NOTICE-Dateien der Teile, die tatsächlich im Modul stecken, dazu Oracles Hinweise (Launcher-Header, `legal/` im GraalVM-Tarball).
- jupnp nachweislich aus dem Modul halten.
- GFTC-Frage nach §3.4 entscheiden.
- Credits- und Lizenzseite in der UI.

**Außerhalb dieser Prüfung:** Scryfall-Nutzungs- und Bildbedingungen sowie die Fan Content Policy von Wizards of the Coast. Forges GPL deckt Software und Kartenskripte ab, nicht Kartenillustrationen oder Marken. Das gehört ins Scryfall-Arbeitspaket (Bible §4).
