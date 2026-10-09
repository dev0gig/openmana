# Oracle GraalVM und GPL: Lizenzklärung des Engine-Artefakts

> Prompt 33 (Dropzone `openmana-33-graalvm-license-resolution`), untersucht am
> **2026-10-09**. Der Dateiname folgt dem Auftrag (Stand der Pause vom 2026-10-08).
> **Keine Rechtsberatung und keine Freigabe.** Der Bericht trennt technisch
> Nachgewiesenes von juristischer Auslegung. Nichts wurde gebaut, deployt,
> veröffentlicht oder an Vercel, DNS, ORYX oder GitHub-Releases geändert.

## 1. Kurzfassung

Ampel: **NACHGEWIESEN** heißt technisch belegt (Pfad, Hash, Originaltext).
**OFFEN** heißt mit den verfügbaren Mitteln nicht entscheidbar, entweder
technisch (UNGEKLÄRT) oder nur juristisch. **WIDERLEGT** heißt, eine bisherige
Annahme trifft nachweislich nicht zu.

| # | Aussage | Ampel |
|---|---|---|
| A1 | Das ausgelieferte Modul ist genau `openmana-engine.js.wasm` SHA-256 `0b7687f8…1e31876` aus dem Build `engine/build/publish-31b` (Engine-Lock, `deploy/artifacts.json`, Release `engine-p8-2b0da7a21935`, Inventur stimmen bytegleich überein). | NACHGEWIESEN |
| A2 | 4.672 von 7.821 Typen im Modul (59,7 %) stammen laut der SBOM des Oracle-Werkzeugs aus Oracles GraalVM-Distribution, nicht aus Forge oder OpenMana. | NACHGEWIESEN |
| A3 | Der größte Oracle-Anteil ist nicht die Web-Image-Laufzeit, sondern die **Java-Klassenbibliothek** (3.865 Typen aus `java.base`, `java.xml` usw.). Diese Module tragen in der verwendeten Distribution die **Oracle No-Fee Terms and Conditions (NFTC)**, nicht GPLv2 mit Classpath Exception. | NACHGEWIESEN |
| A4 | Für alle 425 GraalVM-eigenen Top-Level-Laufzeittypen (SubstrateVM, Web Image, Compiler-Teile, SDK) liegt der Quelltext öffentlich in `oracle/graal` am exakten Build-Commit `95ce1499`: 386 Dateien GPLv2 + Classpath Exception, 39 Dateien UPL-1.0. Weitere 9 JVMCI-Typen stammen aus dem JDK (NFTC). | NACHGEWIESEN |
| A5 | Der Launcher `openmana-engine.js` besteht aus Oracles offenen JS-Laufzeitdateien (alle 34 bytegleich mit `oracle/graal@95ce1499`), generiertem Bindecode und OpenManas Startzeilen. Er trägt 13 Oracle-Header „GPLv2 only + Classpath Exception“. Der geschlossene Enterprise-JS-Baustein (`binary-load.js`, Header „ORACLE PROPRIETARY/CONFIDENTIAL“) ist **nicht** enthalten. | NACHGEWIESEN |
| A6 | Beim Bauen waren geschlossene Enterprise-Teile aktiv: `svm-wasm-enterprise.jar` steht fest im Modulpfad des Wasm-Builders und meldet sich automatisch mit Features an (u. a. `EnterpriseWebImageWasmGCFeature`). Der Compiler ist der von Oracle GraalVM (Modul `com.oracle.graal.graal_enterprise`). | NACHGEWIESEN |
| A7 | Ob Enterprise-Code (Builder-Features, Compiler-Optimierungen, Snippets) **Code in das Modul** eingebracht hat. Die SBOM nennt keinen Enterprise-Typ; über erzeugten Maschinencode sagt sie nichts. Beweisbar wäre das nur durch Disassemblieren (von der GFTC verboten) oder einen Build mit veränderter Toolchain (vom Auftrag und der GFTC ausgeschlossen). | OFFEN (UNGEKLÄRT) |
| A8 | Oracles Lizenzhandbuch (LIUM) zu GraalVM 25.4.4.1.1 weist für Native Image nur **Fremdkomponenten** als separat lizenziert aus (LLVM, simdjson, onnxruntime, capnproto-java, packageurl-java, Guava, Jimfs). Oracles eigene GraalVM- und JDK-Bestandteile werden dort nicht als GPL-lizenziert ausgewiesen; das Wort „Classpath“ kommt im LIUM nicht vor. | NACHGEWIESEN |
| A9 | Ob die GPLv2+CPE-Dateiheader im Output und der offene Quelltext ausreichen, damit diese Teile als „Separately Licensed Technology“ unter Separate Terms gelten und nicht unter GFTC/NFTC. | OFFEN (juristisch) |
| A10 | Ob die Oracle-Teile als „System Libraries“ (GPLv3 §1) gelten und eine Weitergabe zusammen mit Forge trotz §10 („no further restrictions“) erlauben. | OFFEN (juristisch) |
| A11 | Annahme „die Vercel-Pause nimmt die Engine aus der Öffentlichkeit“. Das GitHub-Release-Asset `openmana-engine.js.wasm` ist weiterhin anonym abrufbar (HTTP 200, 79.010.169 Bytes, Prüfsumme passt). | WIDERLEGT |
| A12 | Annahme „Oracle-Anteile im Output = Web-Image-Laufzeit, deren Quelle GPLv2+CPE ist“ (so verkürzt in `docs/PUBLICATION.md`). Die Mehrheit der Oracle-Typen ist die JDK-Bibliothek unter NFTC (A3). | WIDERLEGT als vollständige Beschreibung |
| A13 | Es gibt einen dokumentierten Weg, Web Image allein aus offenen Quellen zu bauen (`oracle/graal/web-image`, `mx build`). Die fertige GraalVM Community Edition 25.4.4.1.1 enthält Web Image **nicht**. Ob OpenMana mit einem Selbstbau funktioniert und gleich schnell bleibt, ist **ungeprüft**. | OFFEN (technisch prüfbar) |
| A14 | Laufzeitbibliotheken, die mit dem Programm selbst verteilt werden, gelten nach FSF-Auslegung nicht als System Libraries (GPL-FAQ `#WindowsRuntimeAndGPL`). Die Oracle-Teile werden im Wasm-Modul mitgeliefert. | NACHGEWIESEN (Wortlaut); Anwendung OFFEN (juristisch) |

**Empfehlung in einem Satz:** Die Pause beibehalten, das noch öffentliche
GitHub-Release-Asset vom Projektbesitzer bewusst entscheiden lassen, und
als einzigen technisch tragfähigen Weg zu einer belastbaren Wiederfreigabe
einen Build ausschließlich aus offenen Quellen (offenes Web Image auf einem
OpenJDK-basierten, GPLv2+CPE-lizenzierten JDK) in einem eigenen Task erproben
(Abschnitt 7 und 9).

## 2. Methode und Grenzen

- **Nur lesend.** Keine Änderung an Forge, Engine, WASM, Compiler,
  Abhängigkeiten, UI, Produktivkonfiguration, Lizenztexten, Vercel, DNS, ORYX
  oder GitHub. Kein Build.
- **Kein Disassemblieren.** Die GFTC verbietet „reverse engineering,
  disassembly or decompilation of the Programs“, und ihre Output-Klausel
  erklärt Oracle-Anteile im Output selbst zum „unmodified Program“. Deshalb
  wurden weder das Wasm-Modul noch Oracles Builder-JARs disassembliert oder
  dekompiliert. Verwendet wurden nur:
  - die vom Oracle-Werkzeug selbst erzeugte SBOM (`--enable-sbom=export,class-level`),
  - das Build-Protokoll,
  - der als Klartext ausgelieferte Launcher,
  - Dateilisten (`unzip -l`) und als Klartext mitgelieferte Ressourcen der JARs,
  - Lizenz- und Notice-Dateien der Distribution,
  - der öffentliche Quellbaum `oracle/graal` am Build-Commit.
- Diese Grenze ist selbst ein Befund: Die GFTC-Bedingungen verhindern, dass ein
  Empfänger das Modul vollständig auf Lizenzbestandteile untersuchen kann
  (Abschnitt 5.4).
- **Klassennamen allein beweisen keine Lizenz.** Zugeordnet wurde über die
  SBOM-Komponenten des Werkzeugs und über das tatsächliche Vorhandensein einer
  Quelldatei mit Lizenzheader am exakten Commit. Was so nicht belegbar ist,
  steht als UNGEKLÄRT da.

## 3. Ausgeliefertes Artefakt und Build-Herkunft

### 3.1 Identität (NACHGEWIESEN)

| Datei | Bytes | SHA-256 |
|---|---|---|
| `openmana-engine.js.wasm` | 79.010.169 | `0b7687f8f2cfc6e9a8738b08e29220f240bdb7dfd2b762e2a44ba00040e31876` |
| `openmana-engine.js` (Launcher) | 112.916 | `edf456327b91601ab3ded0f35c6b1429adca8141a9fdd7d67849065185d72b42` |
| `engine-worker.js` | 431.692 | `35d655bc2a8c6b65c92a24f958bdeddb1968d4e15d6ef2a3f41c1510a0f9c5e1` |
| `engine-manifest.json` | 5.802 | `2b0da7a21935a6eaf23eb93715a0e68b94d2d0b19e413c02330eebaa7c8d67fa` |
| `forge-res.inventory.json` | 4.278.015 | `94b447cec329319b12be9c17e1838da1bdfd681fa45bb871b2d7dafb0ea1afa1` |

- Gleich in `engine/engine.lock.json`, `deploy/artifacts.json`, im lokalen
  Build `engine/build/publish-31b/dist/` und im Release-Ordner
  `engine/build/release-31b/`. Die GitHub-API meldet für das Release-Asset
  denselben Digest.
- SBOM des Builds: `publish-31b/report/engine-sbom.class-level.json`
  SHA-256 `1b899b78…8b0d1b70`; Fat-JAR `13051f50…7cde386`. Beide Werte stehen
  so in `notices/engine-inventory.json` (7.821 Typen).

### 3.2 Toolchain (NACHGEWIESEN)

- Archiv `graalvm-jdk-25i4-25.0.4.1.1_linux-x64_bin.tar.gz`, SHA-256
  `4fcc632c…a33e28e`, lokal neu berechnet und gleich mit
  `engine/toolchain.lock.json`.
- `release`-Datei der Distribution: `GRAALVM_VERSION="25.4.4.1.1"`,
  `JAVA_RUNTIME_VERSION="25.0.4.1.1+1-LTS-jvmci-25.4-b23"`.
- `SOURCE`/`COMMIT_INFO`:
  - offene Teile (u. a. `web-image`, `substratevm`, `compiler`, `sdk`) am Commit
    `95ce1499c8c96ab7d5a6697c5b4bf42160f3b68b`; dieser Commit ist öffentlich in
    `oracle/graal` (2026-09-17, „Adapt graal-publish-javadoc for the GraalVM
    25.4.4.1.1 release“);
  - geschlossene Teile (`web-image-enterprise`, `substratevm-enterprise`,
    `graal-enterprise`, `vm-enterprise` …) am internen Commit `86367e35…`;
  - `MODULES` enthält `com.oracle.graal.graal_enterprise`.
- Build-Protokoll `publish-31b/report/native-image.log`:
  „vendor version: Oracle GraalVM 25.4.4.1.1+1.1“, „Graal compiler:
  optimization level: 2“, „Garbage collector: JS-runtime-provided GC“.
- Aufruf in `engine/scripts/build-wasm.sh`: `native-image --tool:svm-wasm …
  --enable-sbom=export,class-level`.

### 3.3 Was beim Bauen geladen wird (NACHGEWIESEN)

`lib/svm/tools/svm-wasm/native-image.properties` der Distribution:

```
ImageBuilderModulePath = ${.}/builder/svm-wasm-enterprise.jar\:${.}/builder/svm-wasm-guava.jar\:${.}/builder/svm-wasm-jimfs.jar\:${.}/builder/svm-wasm.jar
```

| JAR (`lib/svm/…`) | SHA-256 (Anfang) | Herkunft laut Dateiliste/Quellbaum |
|---|---|---|
| `tools/svm-wasm/builder/svm-wasm.jar` | `fb1687ef235c537c` | offener `web-image`-Builder; alle 34 enthaltenen JS-Laufzeitdateien sind bytegleich mit `oracle/graal@95ce1499` |
| `tools/svm-wasm/builder/svm-wasm-enterprise.jar` | `a6a43a3b2c7e14cd` | **geschlossen**; Paket `com.oracle.svm.enterprise.hosted.webimage`, Modul `com.oracle.svm.extraimage_enterprise`; meldet per `META-INF/services` automatisch Features an (`EnterpriseWebImageFeature`, `EnterpriseWebImageJSFeature`, `EnterpriseWebImageWasmLMFeature`, `EnterpriseWebImageWasmGCFeature`); einzige JS-Ressource `binary-load.js` mit Header „ORACLE PROPRIETARY/CONFIDENTIAL. Use is subject to license terms.“ |
| `tools/svm-wasm/builder/svm-wasm-guava.jar` | `217f5d535a2c4cea` | Guava 33.4.8-jre, umbenannt nach `org.graalvm.shadowed…`; LIUM: Apache-2.0 |
| `tools/svm-wasm/builder/svm-wasm-jimfs.jar` | `ac259825b7ed5312` | Jimfs 1.3.0-c7a51a6e, umbenannt; LIUM: Apache-2.0 |
| `builder/svm.jar` | `ca4e8a54516728c6` | SubstrateVM (Quelle offen in `substratevm/`) |
| `builder/svm-enterprise.jar` | `2862a00802ea327c` | **geschlossen** (`com.oracle.svm.enterprise…`); ob es beim Wasm-Build geladen wird, ist aus den Protokollen nicht ersichtlich |

Die Builder-Klassen im Enterprise-JAR liegen alle im Paket `…hosted…`, laufen
also beim Bauen. Ein Builder-Feature kann trotzdem den erzeugten Code
beeinflussen (Compiler-Phasen, Ersetzungen, Lowering). Das Gegenteil ist ohne
Disassemblieren nicht beweisbar (A7).

## 4. Matrix der Oracle-Bestandteile im Artefakt

Typzahlen aus `notices/engine-inventory.json` (aus der SBOM dieses Builds).
Lizenz der **Quelle** und Lizenz der **gelieferten Binärdatei** sind getrennt
aufgeführt, weil genau darin die Frage liegt.

| Bestandteil | Typen | Artefaktbezug | Lizenz der offenen Quelle | Lizenz der Oracle-Binärdatei, aus der kompiliert wurde | Primärbeleg | Unsicherheit |
|---|---|---|---|---|---|---|
| JDK-Klassenbibliothek (`java.*`, `javax.*`, `jdk.*`, `sun.*`, `com.sun.*`, `org.w3c`/`org.xml`) | 3.865 | als Wasm-Code und Image-Heap-Objekte im Modul | OpenJDK: GPLv2 + CPE (nicht am exakten labsjdk-Stand geprüft) | **NFTC** (`legal/java.base/LICENSE` u. a., SHA-256 `4d156eec…`, identisch in allen 69 Modulordnern unter `legal/`); `legal/java.base/COPYRIGHT`: „Reverse engineering, disassembly, or decompilation of this software … is prohibited“ | SBOM-Komponente „Oracle:com.oracle:Oracle GraalVM“ mit JDK-Modulen; `legal/<modul>/LICENSE` | Welche Lizenz bei Konflikt GFTC (Gesamtpaket) vs. NFTC (Modulordner) gilt, ist juristisch |
| JVMCI (`jdk.vm.ci.*`) | 9 | im Modul | OpenJDK/labsjdk (nicht in `oracle/graal`) | NFTC (`legal/jdk.internal.vm.ci/LICENSE`) | SBOM, Quellbaumabgleich (nicht gefunden) | Quelle am exakten Stand nicht nachgewiesen |
| Graal-Compiler-Teile (`jdk.graal.compiler*`) | 81 | im Modul (Laufzeithilfen, Optionen) | GPLv2 + CPE (65 Dateien am Commit gefunden) | NFTC (`legal/jdk.graal.compiler/LICENSE`) und GFTC | SBOM, `compiler/src/…` | Zuordnung einzelner innerer Typen über Deklarationen in Nachbardateien |
| SubstrateVM-Laufzeit (`com.oracle.svm.core`, `…configure`, `…shared`, `…guest.staging`, Espresso-Classfile geshadet) | 402 (SBOM „svm“) | im Modul | GPLv2 + CPE (substratevm, espresso-shared) | GFTC | SBOM-Komponente „svm“; Quellabgleich: alle Top-Level-Typen am Commit gefunden | keine bei der Quelle; Binärlizenz juristisch |
| Web-Image-Laufzeit (`com.oracle.svm.webimage.*`, `com.oracle.svm.hosted.webimage.*`) | in den 402 enthalten (51 Quelldateien) | im Modul | GPLv2 + CPE (`web-image/`) | GFTC | wie oben | wie oben |
| GraalVM SDK und Web-Image-API (`org.graalvm.collections`, `.nativeimage`, `.word`, `.webimage.api`) | 45 | im Modul | **UPL-1.0** (39 Dateien) | GFTC | `sdk/LICENSE.md`, Header | UPL ist GPL-verträglich; Binärlizenz juristisch |
| Guava 33.4.8-jre (geshadet) | 192 | im Modul | Apache-2.0 | im LIUM ausdrücklich als Drittkomponente mit Apache-2.0 genannt | LIUM, SBOM | gering: als Separately Licensed Technology ausgewiesen |
| Jimfs 1.3.0-c7a51a6e (geshadet) | 78 | im Modul | Apache-2.0 | im LIUM mit Apache-2.0 genannt | LIUM, SBOM | gering |
| Launcher-Laufzeit (JS) | 34 Dateien, 13 Header | `openmana-engine.js` | GPLv2 + CPE, bytegleich mit `oracle/graal@95ce1499` | GFTC (Output-Klausel) | Byte-Vergleich, Header im Launcher | gering technisch; Binärlizenz juristisch |
| Generierter Code (Bindetabellen, Image-Heap, Wasm-Code aus Compiler-Lowering) | n/a | Modul und 179 Zeilen im Launcher | entsteht aus Builder-Code (offen **und** geschlossen) und den kompilierten Klassen | GFTC (Output-Klausel) | Build-Protokoll: 75,46 MiB Image, davon 62,10 MiB Image-Heap (44,60 MiB eingebettete Forge-Ressourcen) | **UNGEKLÄRT**, welcher Builder-Code welche Bytes erzeugt hat |
| Enterprise-Builder (`svm-wasm-enterprise.jar`, Enterprise-Compiler) | 0 Typen laut SBOM | Einfluss auf erzeugten Code möglich | **geschlossen** | GFTC | `native-image.properties`, Dateiliste, `release` | **UNGEKLÄRT** (A7) |

Summe Oracle-Distribution: 3.955 („Oracle GraalVM“) + 402 (svm) + 45 (SDK/API)
+ 192 (Guava) + 78 (Jimfs) = **4.672 von 7.821 Typen**. Forge, OpenMana und
Forges Bibliotheken stellen die übrigen 3.149.

## 5. Konfliktanalyse GFTC/NFTC gegen GPLv3

Wortlaute aus den Dateien der verwendeten Distribution (`LICENSE.txt`
SHA-256 `c6f98968…989b81`; `legal/java.base/LICENSE` SHA-256 `4d156eec…29a5`)
und aus der GPLv3 (gnu.org, abgerufen 2026-10-09, SHA-256 `3972dc97…986`;
`LICENSE` im Repo ist derselbe Text ohne abschließenden Zeilenumbruch).

### 5.1 Was Oracle gewährt und verlangt

- **Weitergabe:** GFTC und NFTC erlauben (b) „redistribute the unmodified
  Program … provided that You do not charge Your licensees any fees“.
- **Output-Klausel, nur GFTC:** „those portions of a Program included in
  otherwise unmodified software that is produced as output resulting from
  running the unmodified Program (such as may be produced by use of GraalVM
  Native Image) shall be deemed to be an unmodified Program for the purposes
  of this license.“ Die NFTC hat **keine** solche Klausel.
- **Bedingungen** (beide): Hinweise nicht entfernen, Exportkontrolle, und
  „You do not cause or permit reverse engineering, disassembly or
  decompilation of the Programs (except as allowed by law) by You nor allow
  an associated party to do so.“
- **Quelltext:** „any source code that may be included in the distribution
  with the Programs is provided solely for reference purposes and may not be
  modified, unless such source code is under Separate Terms permitting
  modification.“
- **Ausnahme:** „Separately Licensed Technology“ – Oracle- oder
  Drittechnik, für die Programmdokumentation, Readmes oder Notice-Dateien
  „Separate Terms“ angeben; diese Rechte werden von GFTC/NFTC „not restricted
  in any way“.

### 5.2 Was die GPLv3 für Forge verlangt

- §10: „You may not impose any further restrictions on the exercise of the
  rights granted or affirmed under this License.“
- §7: „All other non-permissive additional terms are considered "further
  restrictions" within the meaning of section 10.“
- §1 System Libraries: „anything, other than the work as a whole, that (a) is
  included in the normal form of packaging a Major Component, but which is not
  part of that Major Component, and (b) serves only to enable use of the work
  with that Major Component, or to implement a Standard Interface for which an
  implementation is available to the public in source code form. A "Major
  Component" … means … a compiler used to produce the work, or an object code
  interpreter used to run it.“
- §1 Corresponding Source: schließt „the work's System Libraries“ aus.
- §6: „A separable portion of the object code, whose source code is excluded
  from the Corresponding Source as a System Library, need not be included in
  conveying the object code work.“
- §12: „If you cannot convey a covered work so as to satisfy simultaneously
  your obligations under this License and any other pertinent obligations,
  then as a consequence you may not convey it at all.“
- GPL-FAQ `#WindowsRuntimeAndGPL` (Laufzeitbibliothek eines proprietären
  Compilers): „the GPL says that libraries can only qualify as System
  Libraries as long as they're not distributed with the program itself. If
  you distribute the DLLs with the program, they won't be eligible for this
  exception anymore; then the only way to comply with the GPL would be to
  provide their source code“.
- GPL-FAQ `#CanIUseGPLToolsForNF`: „Some programs copy parts of themselves
  into the output for technical reasons … In such cases, the copied text in
  the output is covered by the same license that covers it in the source
  code.“ (Gilt nach FSF-Auffassung für die Lizenz des Werkzeugs; hier ist
  gerade strittig, welche Lizenz die Oracle-Anteile „in the source code“
  bzw. in der Binärdatei haben.)

### 5.1a Weitere Oracle-Aussagen

- LIUM 25.4.4.1.1 (mitgeliefert, „Last updated: September 2026“): „The Oracle
  GraalVM 25.4.4.1.1 product includes access to the Native Image technology,
  which is considered an Early Adopter technology“. Die „License for Early
  Adopter Versions“ erfasst ausdrücklich „output created by the Early Adopter
  Versions, subject to all license terms, conditions, and restrictions that
  apply to the Program“. Ob Web Image darunter fällt, sagt Oracle nicht
  ausdrücklich.
- graalvm.org/faq: „The GFTC is intended to permit use of the Program,
  including runtime image output produced by the jlink tool or GraalVM Native
  Image feature, by any user, including in commercial and production use. …
  Redistribution is permitted as long as it is not for a fee.“ Dort steht auch:
  „GraalVM Community Edition is distributed under version 2 of the GNU
  General Public License with the "Classpath" Exception.“ Eine Aussage zum
  Zusammenspiel mit Copyleft-Lizenzen gibt es nicht.
- graalvm.org Web-Image-Doku: „Web Image in GraalVM is early and
  experimental. It is available in Oracle GraalVM 25.1 or later.“ Keine
  Lizenzaussage.
- `oracle/graal` README am Tag `vm-25.4.4.1.1` (identisch mit Commit
  `95ce1499`) nennt für Web Image „GPL 2“ ohne Classpath Exception. Die
  Dateien selbst tragen durchgehend „GPLv2 only + Classpath Exception“, und
  `web-image/LICENSE` ist bytegleich mit `substratevm/LICENSE`. Oracle hat
  diesen Widerspruch nicht aufgelöst.
- Wichtig für jeden Weg über Oracles offene Quellen: Die Dateien stehen unter
  **GPLv2 only**. GPLv2 allein ist laut FSF-Lizenzliste nicht mit GPLv3
  verträglich. Die Verbindung mit Forge (GPLv3) trägt nur über die Classpath
  Exception („permission to link this library with independent modules to
  produce an executable, regardless of the license terms of these independent
  modules“). Sie gilt nur für Dateien, deren Header sie ausdrücklich nennen.
  Für alle 386 GPL-Dateien der Laufzeittypen in diesem Modul ist das der Fall;
  die übrigen 39 stehen unter UPL-1.0.

### 5.3 Wo der Konflikt liegt (Auslegung, keine Feststellung)

1. **Wenn** die Oracle-Anteile im Modul unter GFTC bzw. NFTC stehen (A8 spricht
   dafür, A9 dagegen), stehen im selben ausgelieferten Objekt Forge-Code unter
   GPLv3 und Oracle-Code mit Zusatzbedingungen:
   - Weitergabe nur unverändert und gebührenfrei,
   - Verbot des Reverse Engineering,
   - Quelltext nur zur Ansicht.

   Für die GPL-Teile darf ein Weitergebender keine solchen Einschränkungen
   auferlegen (§10). Ob eine Einschränkung, die nur die Oracle-Teile betrifft,
   eine „further restriction“ auf das **Gesamtwerk** ist, ist die
   Kernfrage.
2. **Die System-Library-Ausnahme** befreit nur von der Pflicht, den Quelltext
   dieser Teile mitzuliefern (Corresponding Source). Sie ist kein
   ausdrückliches Recht, Teile mit Zusatzbedingungen gemeinsam auszuliefern.
   Zudem ist offen, ob sie überhaupt greift:
   - (a) verlangt, dass der Teil „included in the normal form of packaging a
     Major Component“ ist, „but which is not part of that Major Component“. Die
     Web-Image-Laufzeit ist Teil des Compilers selbst (Native Image), nicht
     getrennt verpackt. Die JDK-Bibliothek liegt eher nahe an „object code
     interpreter“/Plattform.
   - (b) „to implement a Standard Interface for which an implementation is
     available to the public in source code form“: Für die Java-SE-API gibt es
     mit OpenJDK eine öffentliche Quellimplementierung. Für die
     SubstrateVM-/Web-Image-Laufzeit gibt es offenen Quelltext, aber es ist
     fraglich, ob sie eine „Standard Interface“ implementiert.

   Dazu kommt: Im Browser gibt es keine Oracle-Installation beim Empfänger.
   Die Teile werden nicht vom Betriebssystem oder Compiler des Empfängers
   gestellt, sondern im selben Modul mitgeliefert. Nach der FSF-Auslegung
   (FAQ `#WindowsRuntimeAndGPL`) verlieren Laufzeitbibliotheken, die mit dem
   Programm selbst verteilt werden, die System-Library-Eigenschaft. Das spricht
   **gegen** eine Berufung auf §1 für das ausgelieferte Wasm-Modul. Bleibt die
   FSF-Auslegung maßgeblich, müsste OpenMana für diese Teile Quelltext unter
   GPL-verträglichen Bedingungen bereitstellen können. Für den offenen Teil
   liegt Quelltext öffentlich vor (A4); ob er für die **gelieferten
   Binärteile** gilt, ist genau A9.
3. **Reverse-Engineering-Verbot gegen GPL-Freiheiten:** Die GPLv3 setzt
   voraus, dass Empfänger das Werk studieren und ändern dürfen. Die
   Output-Klausel macht Oracle-Anteile im Modul zum „unmodified Program“, für
   das Disassemblieren verboten ist. Ein Empfänger kann die Forge-Teile aus dem
   Quelltext neu bauen; das ausgelieferte Modul als Ganzes darf er nach GFTC
   aber nicht untersuchen. Ob das eine „further restriction“ ist, ist
   juristisch offen.
4. **Gegenargument (A9):**
   - Die Oracle-Laufzeitdateien im Output tragen selbst GPLv2+CPE-Header, und
     ihr Quelltext liegt bei Oracle offen.
   - Lassen sich diese Header als „notice files“ verstehen, die Separate Terms
     angeben, stünden die Teile unter GPLv2+CPE. Die Classpath Exception
     erlaubt dann ausdrücklich, sie mit unabhängigen Modulen beliebiger Lizenz
     zu verbinden, also auch mit GPLv3-Code.
   - Gegen diese Lesart spricht: Das LIUM, Oracles maßgebliche
     Lizenzdokumentation, führt diese Teile **nicht** als Separately Licensed
     Technology. Die GFTC nennt Header nur, wenn Dokumentation, Readmes oder
     Notice-Dateien die Separate Terms „specify“.
5. **Praxis ist kein Beleg:** ManaBrew liefert ein vergleichbares Artefakt
   öffentlich unter AGPL aus (`docs/research/LICENSES.md` §3.4). Das zeigt nur,
   dass andere so handeln.

### 5.4 Folge für Empfänger und OpenMana

- **Unbestritten technisch:** Ein Dritter kann die Engine aus den
  veröffentlichten Quellen nur mit Oracle GraalVM (GFTC) nachbauen.
  Das Quellarchiv im Release enthält Forge, Patches, Bridge und Skripte,
  nicht die Toolchain (`docs/PUBLICATION.md`).
- Ob die Toolchain zur „Corresponding Source“ gehört oder als
  „general-purpose tool … used unmodified“ ausgenommen ist, hängt wieder an der
  System-Library-/Werkzeug-Frage.

## 6. Lücken in Drittlizenzen und Hinweisen

Geprüft gegen `THIRD-PARTY-NOTICES.md`, `notices/`, `SOURCE.md`,
`docs/research/LICENSES.md`.

- **Lücke 1 (inhaltlich):**
  - Die NFTC steht vollständig im Oracle-Anhang von `THIRD-PARTY-NOTICES.md`.
  - Die Analyse in `docs/research/LICENSES.md` §3.4 und `docs/PUBLICATION.md`
    behandelt aber nur GFTC gegen GPLv2+CPE. Dass die JDK-Bibliothek (3.865
    Typen, größter Oracle-Block) in dieser Distribution unter NFTC steht, ist
    dort nicht ausgewertet.
  - Die Komponentenzeile „com.oracle:Oracle GraalVM … UNRESOLVED: GFTC /
    separate runtime terms“ bleibt sachlich richtig. Nicht geändert, da der
    Task keine Lizenztext-Änderung erlaubt.
- **Lücke 2:**
  - Der Enterprise-Anteil am Build (A6) ist in den bisherigen Dokumenten nur
    über die `release`-Datei erwähnt („`web-image-enterprise` (geschlossen)“).
  - Dass `svm-wasm-enterprise.jar` zwingend im Builder-Modulpfad steht, ist
    neu.
- **Lücke 3 (Formulierung):**
  - `docs/PUBLICATION.md`: „Teile der GraalVM-Laufzeit landen dabei im
    ausgelieferten Engine-Modul“ und „Der Quelltext der Web-Image-Laufzeit
    selbst ist bei Oracle unter GPLv2 mit Classpath Exception veröffentlicht“
    sind beide richtig.
  - Sie legen aber nahe, der Oracle-Anteil sei im Kern die Web-Image-Laufzeit
    (A12).
- **Ohne offensichtliche Lücke:**
  - Apache-NOTICE-Pflichten, JGraphT-LGPL-Quellen im Release, Ausschluss
    von jupnp/Netty/Jetty/Servlet (`image-classes.json`: keine Netzwerktypen);
  - die zwei dokumentierten Quellenlücken (`react-remove-scroll-bar`, JSR305);
  - die AGPL-Abgrenzung zu ManaBrew (kein übernommener ManaBrew-Code laut
    LICENSES.md §3.5; in diesem Audit nicht neu geprüft).
- **Nicht Bestandteil dieses Audits:** Scryfall-Nutzungs- und Bildbedingungen,
  Wizards of the Coast Fan Content Policy, Marken.

## 7. Alternative Buildwege

Bewertet, **nicht ausgeführt**. Grundwerte des heutigen Builds als Vergleich:

- Modul 79.010.169 Bytes; native-image 157 s bei 4,18 GiB Spitzen-RSS
  (i7-8700T, `--parallelism=2`, `-Xmx6g`);
- 82 Engine-Ergebnisse und 23 Browserläufe in `engine/engine.lock.json`;
- 75,46 MiB Image, davon 62,10 MiB Image-Heap.

| Weg | Lizenz von Werkzeug und Output-Laufzeit | Machbarkeit | Aufwand | Risiko für Korrektheit, Leistung und 82 Differenzläufe | Testbare Kriterien |
|---|---|---|---|---|---|
| **A: Offenes Web Image selbst bauen** (`oracle/graal@vm-25.4.4.1.1`, `web-image` + `substratevm` + `compiler` mit `mx build`, auf einem OpenJDK-basierten labsjdk-CE/JVMCI-JDK unter GPLv2+CPE) | Werkzeug und Laufzeitquelle GPLv2+CPE bzw. UPL; JDK-Bibliothek aus OpenJDK (GPLv2+CPE). Keine GFTC/NFTC, sofern **kein** Oracle-Binärpaket beteiligt ist | Laut `web-image/README.md` vorgesehen („cd web-image / mx build“, `mx native-image --tool:svm-wasm`). Der Quellcode des WasmGC-Backends ist offen. Die Community-Distribution 25.4.4.1.1 enthält **kein** `svm-wasm` (Tarball-Liste, 736 Einträge); die CE-Konfiguration importiert `web-image` nicht. Ob der offene Build ohne `svm-wasm-enterprise.jar` die OpenMana-Engine korrekt erzeugt, ist **ungeprüft** | mittel bis hoch: mx/labsjdk-Toolchain pinnen und reproduzierbar machen (neue Einträge in `toolchain.lock.json`), Build-Skripte anpassen, voller Prüfdurchlauf. Separater Toolchain-Task nach `engine/UPDATING.md` | Unbekannt, welche Funktionen nur der Enterprise-Teil liefert. Paketnamen: Heap-Kodierung, Long64-Emulation (JS-Backend), WasmLM-/WasmGC-Features, Snippets, Enterprise-Compiler-Optimierungen. Möglich: größeres oder langsameres Modul, fehlende Optimierungen, im schlimmsten Fall Build-Abbruch bei `-H:+FatalUnsupportedNodes` | Build ohne Enterprise-JAR im Modulpfad (Nachweis per `native-image.properties` und Build-Log „vendor version“ ohne „Oracle GraalVM“); 82/82 Engine-Ergebnisse identisch; 23/23 Browserläufe; volle App-/PWA-Suite; Modulgröße, Startzeit und Zugzeit innerhalb vorab festgelegter Grenzen (z. B. ≤ +20 %); SBOM ohne Enterprise-Komponenten; jede Laufzeitdatei mit GPLv2+CPE- oder UPL-Header |
| **B: Oracle GraalVM behalten und schriftliche Klärung einholen** | unverändert GFTC/NFTC, plus Oracle-Aussage | technisch sofort | gering technisch, Dauer unbekannt | keins | schriftliche Antwort auf Fragen 1–5 in Abschnitt 9 |
| **C: TeaVM** (Apache-2.0) | Werkzeug und eigene Klassenbibliothek Apache-2.0 („TeaVM does not rely on OpenJDK or code or other (L)GPL code“) | WasmGC-Backend vorhanden, Coroutinen/Threads seit 0.13, Java 25 unterstützt; Reflection und Ressourcen eingeschränkt („TeaVM restricts usage of these APIs“) | **sehr hoch**: komplett neue Engine-Toolchain; Forge nutzt Reflection, XStream, Ressourcen, `java.util.concurrent` und viele JDK-APIs; TeaVMs Bibliothek deckt das nur teilweise ab | hoch: abweichendes Laufzeitverhalten der eigenen Klassenbibliothek, mögliche Unterschiede in Zufall, Sortierung, Strings und Hash-Reihenfolge, damit Differenzläufe gefährdet | Forge-Engine kompiliert ohne Stubs für Regel-Code; 82/82 Differenzläufe identisch; volle Suite; Größe/Leistung |
| **D: CheerpJ** | proprietär; Community-Lizenz: „Self-Hosting not allowed“, „OEM/Redistribution not allowed“; kommerziell kostenpflichtig | volle OpenJDK-JVM im Browser, aber Java 8/11/17 | hoch, dazu Abhängigkeit vom Anbieter | Leistung einer interpretierenden/JIT-JVM unklar | ungeeignet: verlagert die Lizenzfrage nur, statt sie zu lösen |
| **E: J2CL/J2Wasm** (Apache-2.0) | Apache-2.0 | „does not support any of `java.lang.reflect.*`“, kein `Enum.valueOf`, arbeitet auf Java-Quellen | sehr hoch, Forge müsste umgebaut werden | sehr hoch | praktisch ausgeschlossen |
| **F: Bytecoder** (Apache-2.0, OpenJDK-Klassenbibliothek) | Apache-2.0 bzw. GPLv2+CPE (OpenJDK 20) | Java bis 20, letztes Release 2024-05 | hoch | Projekt de facto inaktiv | ausgeschlossen |
| **G: Nicht öffentlich ausliefern** | keine Weitergabe, keine Pflichten | sofort | Entfernen bzw. Sperren der öffentlichen Flächen (Abschnitt 8) ist eine Besitzerentscheidung | keins | keine öffentliche Fläche liefert die Engine |

Einschätzung: Nur **Weg A** kann die Frage technisch beseitigen, ohne die
Engine neu zu erfinden. Er sollte als eigener Toolchain-Task mit einem
Abbruchkriterium geplant werden (z. B. „scheitert der offene Build an
fehlenden Enterprise-Funktionen, Weg B oder G“). Weg C wäre ein eigenes
Großprojekt.

## 8. Öffentliche Auslieferungsflächen (Stand 2026-10-09, 18:54–18:57 UTC)

Nur GET/HEAD und lesende Vercel-/GitHub-Abfragen; nichts verändert.

| Fläche | Ergebnis | Engine öffentlich? |
|---|---|---|
| https://openmana.oryx.quest/ samt `/engine/527bde2c7a3d14dc/*`, `/legal/…`, `/sw.js` | 503, `x-vercel-error: DEPLOYMENT_PAUSED` (auch Teilanfragen) | nein |
| https://openmana.vercel.app/ und Projekt-Aliase (`openmana-<team>.vercel.app`, `openmana-git-main-<team>.vercel.app`) | 503 `DEPLOYMENT_PAUSED` | nein |
| Ältere Vercel-Deployments: 9 insgesamt, alle Ziel „production“, keine Previews. Darunter 2 READY mit sicher enthaltener Engine (`e49741d`, `3e05dad`) und 3 READY vom 24.09. mit Engine unbekannt | 302 auf Vercel-Login (SSO-Schutz „all except custom domains“) | nicht anonym; für Team-Mitglieder bzw. bei Wegfall des Schutzes ja; ob die Pause sie erfasst, ist von außen nicht feststellbar |
| **GitHub-Release `engine-p8-2b0da7a21935`** (öffentlich, „Latest“) | `openmana-engine.js.wasm` anonym 200 nach Weiterleitung auf `release-assets.githubusercontent.com`, 79.010.169 Bytes, Digest passt; bisher 4 Downloads. Ebenso Launcher, Worker, Manifest, Katalog und Quellarchiv | **ja** |
| GitHub-Repository (öffentlich) | keine kompilierte Engine im Git (ganze Historie), Pages aus, keine Actions-Artefakte | nein |
| jsDelivr (`cdn.jsdelivr.net/gh/dev0gig/openmana@…`) | spiegelt Repo-Quellen (200), Release-Assets 404 | nein |
| npm | kein Paket (`private: true`) | nein |
| Wayback Machine | keine Treffer | nein |
| ORYX (`oryx.quest`, `games.js`, Android-TWA) | verlinkt nur auf `openmana.oryx.quest` (führt auf 503) | nein |
| Geräte von Nutzern | Service Worker hält eine ausdrücklich offline geladene Engine unbegrenzt (`openmana-engine-<version>`); HTTP-Cache bis 1 Jahr (`immutable`) | nicht steuerbar |

Die Vercel-Pause macht also die App unerreichbar, nicht aber die Engine:
Solange das Release-Asset öffentlich ist, wird das Modul weiterhin verteilt.
Weitere Kopien bei Dritten (die 4 Downloads) lassen sich nicht erfassen.

## 9. Fragen nur für Oracle oder Rechtsberatung

An **Oracle** (schriftlich, mit Version 25.4.4.1.1 und Archiv-Hash):

1. Gelten die Teile von Oracle GraalVM, deren Quelltext Oracle in
   `oracle/graal` unter GPLv2 + Classpath Exception bzw. UPL veröffentlicht
   (SubstrateVM, Web Image, Compiler, SDK), in der Binärdistribution und im
   Native-Image-/Web-Image-Output als „Separately Licensed Technology“ unter
   diesen Lizenzen, oder unter der GFTC?
2. Unter welchen Bedingungen dürfen die in den Output kompilierten
   JDK-Klassenbibliotheksteile (Modulordner `legal/*/LICENSE`: NFTC)
   weitergegeben werden? Die NFTC hat keine Output-Klausel; gilt für sie die
   Output-Klausel der GFTC?
3. Erfasst das Reverse-Engineering-Verbot den Output (Wasm-Modul) als Ganzes,
   auch die vom Nutzer stammenden Forge-Teile?
4. Fügt `svm-wasm-enterprise.jar` bzw. der Enterprise-Compiler Code in das
   Wasm-Modul ein, und wenn ja, unter welcher Lizenz?
5. Darf ein so erzeugtes Modul unter GPLv3 zusammen mit Forge öffentlich
   ausgeliefert werden?

An **qualifizierte Open-Source-Rechtsberatung**:

6. Sind GFTC/NFTC-Bedingungen auf den Oracle-Anteilen „further restrictions“
   im Sinne von GPLv3 §10/§7 für das Gesamtwerk?
7. Greift die System-Library-Ausnahme (GPLv3 §1) für Laufzeitteile, die der
   Compiler fest in jedes Ausgabemodul einbettet und die beim Empfänger nicht
   anderweitig vorhanden sind?
8. Gehört die Toolchain bei einem Wasm-Artefakt zur Corresponding Source?
9. Welche Rolle spielen die GPLv2+CPE-Header im Output, wenn Oracles
   Lizenzdokumentation diese Teile nicht als separat lizenziert führt?
10. Haftungsfrage für bereits erfolgte Verteilungen (Vercel-Zeitraum,
    Release-Downloads) und ob eine Entfernung des Release-Assets nötig ist.

## 10. Empfehlung und Bedingungen für eine Wiederfreigabe

**Empfehlung**

1. Vercel-Pause beibehalten.
2. **Entscheidung des Projektbesitzers** zum GitHub-Release-Asset (A11).
   Solange es öffentlich ist, wird das Modul weiter verteilt. Dieser Task hat
   es bewusst nicht verändert. `AGENTS.md` verbietet, Release-Assets zu
   ersetzen oder zu löschen; ein Entfernen braucht daher eine ausdrückliche
   Ausnahme des Projektbesitzers. Zu klären ist auch, ob dann
   `deploy/artifacts.json` und Rollback-Wege (`docs/DEPLOYMENT.md`) anzupassen
   sind.
3. Keine Wiederfreigabe auf Grundlage des heutigen Oracle-GraalVM-Builds,
   solange A9/A10 nicht schriftlich geklärt sind. Die technischen Befunde
   (NFTC-Bibliothek, Enterprise-Builder, fehlende Ausweisung im LIUM) machen
   die Frage nicht kleiner, sondern konkreter.
4. Als Nächstes einen **eigenen, ausdrücklich freizugebenden Task**
   „offener Web-Image-Build“ (Abschnitt 7, Weg A): Machbarkeit, Gleichheit und
   Leistung messen, ohne Produktion zu ändern.
5. Parallel optional die Oracle-Anfrage (Abschnitt 9, Fragen 1–5) stellen.
   Eine schriftliche Antwort kann den Toolchain-Wechsel ersparen.

**Bedingungen für eine spätere Wiederfreigabe** (alle erfüllt, jeweils mit
Nachweis im Repo):

- **Entweder (Weg A):**
  - Engine aus einer Toolchain, deren sämtliche in den Output gelangenden
    Bestandteile nachweislich unter GPL-verträglichen Lizenzen stehen (z. B.
    offenes Web Image auf GPLv2+CPE-JDK).
  - Kein Enterprise-JAR im Builder-Modulpfad (Prüfung der
    `native-image.properties` im Build).
  - Die Lizenzdokumentation dieser Toolchain bestätigt die Lizenzen.
  - **Oder (Weg B):** schriftliche Bestätigung von Oracle zu den Fragen 1–5,
    die eine GPL-verträgliche Auslieferung erlaubt.
  - **Oder (Weg C):** schriftliche Einschätzung qualifizierter Rechtsberatung
    zu den Fragen 6–10, die der Projektbesitzer ausdrücklich als Grundlage
    annimmt.
- Neuer Build besteht die volle Prüfstraße (`engine/UPDATING.md`, 82
  Engine-Ergebnisse, Browserläufe, App/PWA), ohne Rückschritt bei Größe,
  Startzeit und Zuggeschwindigkeit über einer vorab festgelegten Grenze.
- `THIRD-PARTY-NOTICES.md`, `docs/PUBLICATION.md`, `SOURCE.md` und
  `notices/policy.json` beschreiben den dann gültigen Stand; NFTC-Befund und
  Enterprise-Befund sind eingearbeitet.
- Neue Freigabe des Projektbesitzers für Unpause, Release und Push.

## 11. Nachprüfung durch Dritte

Alle Befehle lesen nur. Pfade relativ zum Repo; Toolchain unter
`~/.cache/openmana/toolchain` (`engine/scripts/setup-toolchain.sh`).

```bash
# Artefakt-Identität
sha256sum engine/build/publish-31b/dist/* engine/build/release-31b/openmana-engine.js.wasm
gh api repos/dev0gig/openmana/releases/tags/engine-p8-2b0da7a21935 --jq '.assets[]|[.name,.size,.digest]|@tsv'

# Toolchain und Distribution
G=~/.cache/openmana/toolchain/graalvm-25.4.4.1.1+1.1
sha256sum ~/.cache/openmana/toolchain/downloads/graalvm-jdk-25i4-25.0.4.1.1_linux-x64_bin.tar.gz
cat $G/release
grep ImageBuilderModulePath $G/lib/svm/tools/svm-wasm/native-image.properties
unzip -l $G/lib/svm/tools/svm-wasm/builder/svm-wasm-enterprise.jar
head -5 $G/legal/java.base/LICENSE; sha256sum $G/legal/*/LICENSE | awk '{print $1}' | sort | uniq -c
sed -n 1,120p $G/LICENSE.txt

# LIUM: Native-Image-Drittkomponenten, kein "Classpath"
unzip -p $G/license-information-user-manual.zip | grep -c -i classpath   # erwartet 0

# SBOM-Zuordnung
head -12 engine/build/publish-31b/report/native-image.log
node -e 'const s=require("./notices/engine-inventory.json").components;for(const[k,v]of Object.entries(s))console.log(v.length,k)'

# Launcher: Oracle-Header und offene JS-Ressourcen
grep -c '"Classpath" exception' engine/build/publish-31b/dist/openmana-engine.js   # 13
# alle 34 JS-Ressourcen aus svm-wasm.jar gegen oracle/graal@95ce1499 vergleichen:
C=95ce1499c8c96ab7d5a6697c5b4bf42160f3b68b
unzip -o -q -d /tmp/sw $G/lib/svm/tools/svm-wasm/builder/svm-wasm.jar '*.js'
gh api "repos/oracle/graal/git/trees/$C?recursive=1" --jq '.tree[].path' | grep '^web-image/.*\.js$'
# je Datei: curl https://raw.githubusercontent.com/oracle/graal/$C/<pfad> | cmp - /tmp/sw/<datei>

# Quellen der GraalVM-Laufzeittypen: sparse checkout von oracle/graal@95ce1499
# (substratevm/src, web-image/src, espresso-shared/src, compiler/src, sdk/src),
# dann je Top-Level-Typ aus notices/engine-inventory.json "package"-Zeile und
# Typdeklaration suchen und den Lizenzheader (Classpath/UPL) zählen.

# Auslieferungsflächen (nur HEAD)
curl -sI https://openmana.oryx.quest/ | grep -i -E '^HTTP|x-vercel-error'
curl -sIL https://github.com/dev0gig/openmana/releases/download/engine-p8-2b0da7a21935/openmana-engine.js.wasm | grep -i -E '^HTTP|content-length'
```

Ergebnisse dieses Laufs: 386 GPLv2+CPE- und 39 UPL-Dateien für 425
Top-Level-Laufzeittypen; 9 JVMCI-Typen (8 Top-Level) ohne Quelle in `oracle/graal`; 34/34
JS-Ressourcen bytegleich; 0 Zeilen aus `binary-load.js` im Launcher;
179 Launcher-Codezeilen ohne Gegenstück in einer Ressource (generierte
Bindetabellen und OpenManas Start).

## 12. Quellen

Alle abgerufen am 2026-10-09.

**Lokal in der verwendeten Distribution** (Archiv-SHA-256 `4fcc632c…a33e28e`):
- `LICENSE.txt` (GFTC inkl. Early-Adopter-Lizenz), SHA-256 `c6f98968…989b81`.
  Wortgleich mit https://www.oracle.com/downloads/licenses/graal-free-license.html
  („Last updated: 12 June 2023“).
- `legal/*/LICENSE` (NFTC), SHA-256 `4d156eec…29a5`; `legal/java.base/COPYRIGHT`.
- `license-information-user-manual.zip` (LIUM 25.4.4.1.1, „Last updated:
  September 2026“), SHA-256 `d9e97773…5249`.
  Online: https://docs.oracle.com/en/graalvm/jdk/25/docs/licensing-information/
- `release`, `lib/svm/tools/svm-wasm/native-image.properties`, Dateilisten
  der JARs in `lib/svm/…`.

**Oracle / GraalVM online:**
- https://www.graalvm.org/downloads/ („Oracle GraalVM 25.0 and 25.4 continue to
  be available under the GraalVM Free Terms and Conditions license“)
- https://www.graalvm.org/faq/
- https://www.graalvm.org/latest/reference-manual/web-image/
- https://www.graalvm.org/release-notes/25.1/ (Web Image eingeführt, „available
  with Oracle GraalVM 25.1 or later“), /25.4/
- https://github.com/oracle/graal/tree/vm-25.4.4.1.1 (= `95ce1499`):
  `web-image/LICENSE`, `web-image/README.md`, `substratevm/LICENSE`,
  `sdk/LICENSE.md`, `README.md`, Quelldateien mit Headern
- https://github.com/graalvm/graalvm-ce-builds/releases/tag/graal-25.4.4.1.1
  (Tarball-Liste ohne `svm-wasm`)

**GNU/FSF:**
- https://www.gnu.org/licenses/gpl-3.0.txt (SHA-256 `3972dc97…986`)
- https://www.gnu.org/licenses/gpl-faq.html (`#SystemLibraryException`,
  `#WindowsRuntimeAndGPL`, `#CanIUseGPLToolsForNF`, `#NonFreeTools`)
- https://www.gnu.org/licenses/license-list.html#GPLv2
- https://www.gnu.org/software/classpath/license.html

**Alternativen:** https://github.com/konsoletyper/teavm,
https://teavm.org/docs/intro/overview.html, https://cheerpj.com/licensing/,
https://github.com/google/j2cl (`docs/limitations.md`),
https://github.com/mirkosertic/Bytecoder.

**Sekundär (kein Beleg):** https://github.com/oracle/graal/issues/3391
(Nutzerkommentar „It's in the Oracle release and not in the community
edition.“).

**Projekt:** `engine/engine.lock.json`, `engine/toolchain.lock.json`,
`deploy/artifacts.json`, `notices/engine-inventory.json`,
`notices/policy.json`, `THIRD-PARTY-NOTICES.md`, `SOURCE.md`,
`docs/PUBLICATION.md`, `docs/research/LICENSES.md`,
`engine/scripts/build-wasm.sh`, `engine/scripts/postprocess-launcher.mjs`,
`engine/build/publish-31b/report/*` (lokal, nicht im Git).
