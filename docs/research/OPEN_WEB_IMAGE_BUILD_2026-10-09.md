# OpenMana-Engine nur aus offenen Quellen bauen (Machbarkeitsversuch)

> Prompt 34 (Dropzone `openmana-34-open-source-web-image-build`), durchgeführt
> am **2026-10-09/10** auf odin (i7-8700T, 12 Threads, 15,5 GiB RAM, mit
> parallel laufenden anderen Sitzungen). **Keine Rechtsberatung und keine
> Freigabe.** Der Bericht belegt Lizenzen technisch (Dateien, Header, Hashes).
> Produktion, Standard-Build, Engine-Lock, Lizenzhinweise, Release und Vercel
> sind unverändert; nichts wurde gepusht oder veröffentlicht.
>
> **Nachtrag Prompt 35 (2026-10-10):** Der Projektbesitzer hat die offene
> Toolchain übernommen und den JVMCI-Rest akzeptiert (`docs/PUBLICATION.md`).
> Sie ist jetzt der reguläre Weg: Pin in `engine/toolchain.lock.json`, Aufbau in
> `engine/scripts/setup-toolchain.sh`, Ersatz-SBOM in `engine/scripts/sbom/`
> (`ReachableTypesFeature.java`, `inventory.py`), Vergleich
> `engine/scripts/compare-engine-results.mjs`, Zeiten
> `scripts/readiness/engine-times.mjs`. Die hier genannten Versuchsskripte unter
> `scripts/open-toolchain/` sind damit entfallen (Git-Historie).

## 1. Ergebnis

**TEILWEISE**

Die OpenMana-Engine lässt sich vollständig ohne Oracle-GraalVM-Paket, ohne GFTC/NFTC-Teile und ohne Enterprise-Code bauen (GraalVM CE aus `oracle/graal@95ce1499` auf labsjdk-ce). Sie besteht alle Prüfungen: 82/82 Engine-Ergebnisse identisch zum heutigen Lock-Build, App-/PWA-Suite grün, 7/7 Prüfpartien. Leistung und Größe liegen innerhalb der Grenzen. Verfehlt wird genau ein Punkt der Zielsetzung „sämtliche in den Output gelangenden Bestandteile unter GPLv2+CPE, UPL-1.0 oder Apache-2.0“: 13 JVMCI-Typen (11 Quelldateien `jdk.vm.ci.*`) stehen im OpenJDK unter **GPLv2 ohne Classpath Exception** (§5, §8 Nr. 1). Sie kommen über die Laufzeit von SubstrateVM/Web Image ins Modul, nicht über Forge oder OpenMana. Sie stecken genauso im heutigen Oracle-Modul, und kein Toolchain-Wechsel innerhalb von GraalVM entfernt sie.

| Prüfung | Grenze | Oracle-Build `publish-31b` | Offener Build `open-34-20261010d` | Erfüllt |
|---|---|---|---|---|
| Bau ohne Oracle-Paket/Enterprise | muss | – | gebaut, Builder „GraalVM CE 25.4.4.1.1“, kein Enterprise-JAR | ja |
| Modulgröße | ≤ +25 % | 79.010.169 Bytes (Brotli 13.065.749) | 79.028.362 Bytes (+0,02 %; Brotli 13.056.115, −0,07 %) | ja |
| Engine-Start im Browser (Start bis erste Frage, Median 7 Prüfpartien) | ≤ +25 % | 3.873 ms | 3.945 ms (+1,9 %) | ja |
| Median KI-Zugzeit (7 Prüfpartien) | ≤ +30 % | 174 ms (116 KI-Züge) | 192 ms (+10 %, 108 KI-Züge) | ja |
| Engine-Ergebnisse | identisch | 82/82 | 82/82 identisch: alle 818 Prüfsummen und alle Ergebnisfelder | ja |
| Browserläufe der Engine-Suite | alle | 23 bestanden | 23 bestanden, keiner übersprungen | ja |
| Engine-Unit-Tests / JVM-Tests | alle | 96 / 85 | 96 / 85 | ja |
| App-/PWA-Suite `npm run check` | grün | grün (957 Tests) | grün (957 Tests, E2E und PWA in Chrome mit der offenen Engine)¹ | ja¹ |
| Prüfspieler, echte Partien | grün | 6/7, Wiederholung 7/7² | 7/7 (+ Wiederholung rakdos) | ja |
| Alle Output-Bestandteile GPLv2+CPE / UPL / Apache | muss | – | 4.810 von 4.823 Toolchain-Typen; **13 JVMCI-Typen GPLv2 ohne CPE** | **nein** |

¹ Nur mit einem vorübergehenden, ungeprüften Lizenzeintrag für die neuen Toolchain-Komponenten (§6.4). Ohne ihn stoppt der App-Build am Lizenz-Gate, wie er soll.
² Ein Hänger des Prüfspielers in der Oracle-Partie „rakdos“ (Zielauswahl „Kolaghans Befehl“), in der Wiederholung bestanden; §8 Nr. 7.

## 2. Offene Toolchain (gepinnt)

Pins: `scripts/open-toolchain/toolchain.open.lock.json`. Aufbau:
`scripts/open-toolchain/setup.sh` (lädt und prüft, baut mit `mx`).

| Teil | Version / Stand | Herkunft | Prüfsumme | Lizenz | Primärbeleg |
|---|---|---|---|---|---|
| JDK (Builder **und** Klassenbibliothek im Modul) | labsjdk-ce `25.0.4.1.1+1-jvmci-25.4-b23` | `graalvm/labs-openjdk`, Release `jvmci-25.4-b23`; Quellstand `391a5a739cb60fcc35927c6afecf6d9ac00f391d` (`release`: `SOURCE`) | Archiv SHA-256 `871a0de0…41232f` (= GitHub-Digest), 266.161.674 Bytes | GPLv2 + Classpath Exception; JVMCI-Quellen GPLv2 **ohne** Ausnahme (§5, §8 Nr. 1) | `legal/*/LICENSE`: 69 identische Dateien, SHA-256 `4b9abebc…7726`, GPLv2-Text mit angehängter Classpath Exception; keine Datei nennt NFTC oder GFTC; `release`: `IMPLEMENTOR="GraalVM Community"` |
| GraalVM (SubstrateVM, Web Image, Compiler, SDK, Truffle-Teile) | Tag `vm-25.4.4.1.1` = Commit `95ce1499c8c96ab7d5a6697c5b4bf42160f3b68b` | `oracle/graal` | Git-Commit | GPLv2 + CPE (`substratevm`, `web-image`, `compiler`, `espresso-shared`), UPL-1.0 (`sdk`) | Header jeder Quelldatei (§5), `substratevm/LICENSE`, `sdk/LICENSE.md` |
| Build-Werkzeug `mx` | Tag `7.85.1` = `2675b13e58f97d6d37a4090cdcb5a52c280e1d8c` | `graalvm/mx` | Git-Commit | GPLv2 (nur Werkzeug, nichts davon im Modul) | `common.json` des graal-Tags: `"mx_version": "7.85.1"` |
| Binaryen `wasm-as` | 123 (wie Standard-Pin) | GitHub-Release | SHA-256 `e959f217…88fe` | Apache-2.0 | Standard-Pin |
| Maven, Node | 3.9.16, 22.22.3 (wie Standard-Pin) | wie Standard-Pin | wie Standard-Pin | Apache-2.0, MIT | Standard-Pin |

Begründungen:

- **JDK-Version:** `common.json` am graal-Tag nennt für `labsjdk-ce-latest`
  genau `ce-25.0.4.1.1+1-jvmci-25.4-b23`. Das ist derselbe JVMCI-Stand wie im
  Oracle-Build (`JAVA_RUNTIME_VERSION="25.0.4.1.1+1-LTS-jvmci-25.4-b23"`).
- **Binaryen 123 statt 119:** `web-image/README.md` verlangt `wasm-as` 119.
  123 bleibt, weil der Oracle-Build damit gebaut wurde; so unterscheiden sich
  alt und neu nur in GraalVM/JDK. Der offene Build lief damit fehlerfrei.
- **Kein Oracle-Paket, auch nicht zum Bootstrappen:** `mx` läuft auf dem
  labsjdk und kompiliert GraalVM selbst. Das Oracle-Archiv wird vom offenen Weg
  weder kopiert noch gelesen. Auch die Fat-JAR (Forge + Bridge) wird mit dem
  offenen JDK übersetzt (`build-jvm.sh` mit `JAVA_HOME` = offenes Home).

## 3. Bauweg und Flag-Anpassungen

`scripts/open-toolchain/build-engine.sh` führt dieselben Schritte wie
`engine/scripts/build.sh` mit den **unveränderten** Engine-Skripten aus; nur
Schritt 1 ist `setup.sh` statt `setup-toolchain.sh`. `validate.mjs` fährt
danach dieselbe Prüfstraße wie die Forge-Update-Pipeline, schreibt aber nie
`engine/engine.lock.json`.

**Warum unter `scripts/open-toolchain/` statt `engine/`:** Jede
Nicht-Markdown-Datei unter `engine/` gehört zum Quell-Fingerabdruck
(`update-policy.mjs sourceIdentity`), der im Lock steht. Eine Pin- oder
Skriptdatei dort hätte `engine-lock.mjs verify engine/build/publish-31b/dist`
(vorher und nachher grün) und damit Regression und Deploy-Prüfung gebrochen.
Der Task nennt `engine/toolchain.open.lock.json` nur als Beispiel; die Pflicht
„Standardweg bytegleich unverändert, Locks unverändert“ hat Vorrang.
`engine/toolchain.lock.json`, `engine/engine.lock.json` und alle Dateien unter
`engine/` sind unverändert.

**Flag-Anpassungen (genau eine):**

| Flag | Änderung | Grund |
|---|---|---|
| `--enable-sbom=export,class-level` | im offenen Weg weggelassen (`native-image.sh`) | Die Klassen-SBOM gibt es nur in Oracle GraalVM. GraalVM CE hält die Option für den Namen der Hauptklasse und bricht nach 2 s ab (Lauf `open-34-20261009`, Log: „Error: '--enable-sbom=export,class-level' is not a valid mainclass“). Ersatz: das eigene Build-Feature `ReachableTypesFeature` schreibt nach der Analyse alle erreichbaren Typen; `inventory.py sbom` baut daraus eine SBOM im selben Format (Komponente → Modul → Typen). Das Feature läuft nur beim Bauen und ist nicht im Modul (0 Treffer in der Typenliste). |

Unverändert und aktiv: `-H:+FatalUnsupportedNodes`, alle vier
`-H:AbortOnTypeReachable`-Netzwerksperren, Ressourcen, Klasseninitialisierung,
Konfiguration, `-H:WasmComments=NONE`. Ergebnis der Netzwerkprüfung im neuen
Manifest: `networkClassesInModule: 0`.

Versteckte Lambda-Klassen (`Host$$Lambda/0x…`, 2.114 Stück) lässt die
Ersatz-SBOM wie Oracles SBOM weg (sie sind Code ihrer Host-Klasse, gezählt in
`metadata.hiddenTypes`). Lauf `open-34-20261009c` hatte sie noch enthalten und
scheiterte daran in der Lizenzinventur des App-Builds („Unattributed shipped
type: …$$Lambda/0x…“).

## 4. Nachweis „nur offen“

- **Builder:** Build-Log `open-34-20261010d/report/native-image.log`: „Java version: 25.0.4.1.1+1, vendor version: GraalVM CE 25.4.4.1.1None.1“ (Oracle-Build: „Oracle GraalVM 25.4.4.1.1+1.1“; zur Kennung „None“ §8).
- **`release` des GraalVM-Homes** (`report/open-toolchain.txt`):
  - `IMPLEMENTOR="GraalVM Community"`;
  - `SOURCE` nennt nur `labsjdk-builder`, labs-openjdk `391a5a739cb6` und die offenen Suites `compiler`, `espresso-shared`, `sdk`, `substratevm`, `truffle`, `web-image` am Commit `95ce1499…`;
  - kein `*-enterprise`-Stand.
- **Wasm-Builder-Modulpfad** (`lib/svm/tools/svm-wasm/native-image.properties`): `svm-wasm-guava.jar`, `svm-wasm-jimfs.jar`, `svm-wasm.jar`, **ohne** `svm-wasm-enterprise.jar`. Oracle: zusätzlich `svm-wasm-enterprise.jar`.
- **Dateiliste:** Im ganzen GraalVM-Home gibt es keine Datei `*enterprise*` außer acht `jmods/*enterprise*.jmod`. Das sind **leere Platzhaltermodule** (je nur `module-info.class`/`.java`, 643–720 Bytes). `mx` erzeugt sie, weil offene Module ihre Pakete gezielt an diese Modulnamen exportieren (`mx_sdk_vm.py`: „Synthesize modules for targets of qualified exports that are not present“, Voreinstellung `--default-jlink-missing-export-action=create`). `setup.sh` prüft das bei jedem Lauf.
- **JDK:** `release` `IMPLEMENTOR="GraalVM Community"`; alle 69 `legal/*/LICENSE` = GPLv2 mit Classpath Exception (SHA-256 `4b9abebc…`); keine Datei nennt NFTC/GFTC. Die Java-Klassenbibliothek im Modul stammt aus diesem JDK (das GraalVM-Home ist per jlink daraus gebaut).
- **Launcher:** `openmana-engine.js` ist **bytegleich** mit dem Oracle-Build (SHA-256 `edf45632…72b42`): 13 Header „GPLv2 only + Classpath Exception“, 0 Zeilen „ORACLE PROPRIETARY“, kein `binary-load.js`. Damit gilt Bericht 33 A5 unverändert: alle 34 JS-Laufzeitdateien sind bytegleich mit `oracle/graal@95ce1499`.
- **SBOM-Ersatz:** 8.258 Typen. Sie stammen aus der Analyse des offenen Builders (ReachableTypesFeature) und sind über `scripts/notices/engine-inventory.py` vollständig Komponenten zugeordnet (24 Komponenten, keine Netzwerk-/CDDL-Typen). Dazu kommen 2.114 versteckte Lambda-Klassen, gezählt in `metadata.hiddenTypes`.
- **Kein Disassemblieren:** Untersucht wurden nur Quellen, Logs, Dateilisten, der Klartext-Launcher und das selbst gebaute Modul über die Ausgaben des eigenen Builders.

## 5. Lizenzmatrix des neuen Moduls

Erzeugt mit `scripts/open-toolchain/inventory.py evidence` (Rohdaten:
`reports/open-34/license-evidence-open-34d.json`, gitignoriert). Jeder Typ der
Toolchain ist über seine Quelldatei am gepinnten Stand belegt, nicht über
Paketnamen. Quellen: labsjdk-ce `lib/src.zip` bzw. `oracle/graal@95ce1499`.

| Komponente (Ersatz-SBOM) | Typen | Lizenz laut Quell-Header | Primärbeleg |
|---|---|---|---|
| labsjdk-ce (Java-Klassenbibliothek) | 3.980 | 3.290 GPLv2+CPE; 627 Apache-2.0 (u. a. Xerces/Xalan in `java.xml`); 1 UPL-1.0; 45 beim Bauen erzeugte Proxy-Klassen (Generator `java.lang.reflect.Proxy`, GPLv2+CPE); 5 erzeugte Ressourcenklassen ohne eigenen Header; **13 JVMCI GPLv2 ohne CPE** | `src.zip` je Datei; `.properties`-Vorlagen der 5 Ressourcenklassen am Stand `391a5a73` mit Classpath Exception (`logging.properties`, `logging_de.properties`, `CalendarData`, `CurrencyNames`, `LocaleNames`) |
| graalvm-ce-substratevm | 354 | GPLv2+CPE | `substratevm/src/…` |
| graalvm-ce-web-image | 63 | GPLv2+CPE | `web-image/src/…` |
| graalvm-ce-compiler | 89 | GPLv2+CPE | `compiler/src/…` |
| graalvm-ce-espresso-shared (Class-File-Parser, umbenannt nach `com.oracle.svm.espresso`) | 9 | GPLv2+CPE | `espresso-shared/src/…` |
| graalvm-ce-sdk (Collections, Native-Image-API, Word, Web-Image-API) | 46 | UPL-1.0 | `sdk/src/…`, `sdk/LICENSE.md` |
| geshadetes Guava/Jimfs (`org.graalvm.shadowed.com.google…`) | 281 | Apache-2.0 | von `mx` gepinnte Maven-Artefakte (wie Oracle: Guava 33.4.8-jre, Jimfs 1.3.0) |
| Forge, OpenMana, Maven-Bibliotheken | 3.435 | unverändert wie bisher (GPL-3.0, Apache-2.0, LGPL usw.) | Zuordnung über Fat-JAR und Original-JARs (`engine-inventory.py`) |

Summe Toolchain: 4.823 Typen. Davon sind 4.810 nachweislich GPLv2+CPE,
UPL-1.0, Apache-2.0 oder daraus erzeugt; 13 sind GPLv2 ohne CPE.

**Vergleich zum Oracle-Modul** (dieselbe Auswertung auf `publish-31b` mit
Oracles SBOM, `license-evidence-publish-31b.json`): 4.672 Oracle-Typen, davon
3.716 GPLv2+CPE, 896 Apache-2.0, 46 UPL, 5 erzeugte Ressourcenklassen und
**9 JVMCI-Typen GPLv2 ohne CPE**. Bericht 33 hatte JVMCI nur als
„NFTC, Quelle nicht in `oracle/graal`“ geführt. Die Quelle liegt im OpenJDK
(`jdk.internal.vm.ci`), mit dem gleichen Befund. Der Unterschied 9 zu 13 kommt
von der Typenauswahl (Oracles SBOM listet z. B. die JVMCI-Enums
`DeoptimizationAction`/`Reason` nicht, obwohl sie erreichbar sind), nicht vom
Modul: Beide Builder melden dieselben 11.136 erreichbaren Typen.

## 6. Gleichheit

### 6.1 Engine-Suite (82 Ergebnisse, 23 Browserläufe)

`engine/scripts/test-engine.sh` im offenen Lauf `open-34-20261010d`:
JVM-Referenzen (mit offenem JDK), Wasm in Node, Wasm in Chrome, Chrome ohne
COOP/COEP. 82/82 bestanden, `browserSkipped: false`.

Quervergleich mit dem Oracle-Build: `scripts/open-toolchain/compare-engine-results.mjs`
vergleicht jeden der 82 Läufe Feld für Feld (19.157 Felder). Ausgenommen sind
Uhrzeiten, Speicherwerte und Build-Kennungen.

- **Identisch:** alle 818 Prüfsummen (Spielprotokolle `logSha256`,
  Protokollnachrichten `protocolSha256`, Spuren), Sieger, Grund, Züge,
  Lebenspunkte, Eingaben, Spurlängen, Kartenprüfungen und negative Fälle.
- **Abweichend nur in „flüchtigen“ Feldern:** Wie viele Zwischenstände der
  Worker aussendet und die Queue zurückweist, Wasm-Funktionsnummern und Ports
  in Stacktraces, RSS. Dieselben Felder schwanken auch zwischen zwei
  Oracle-Builds desselben Stands (`publish-31` gegen `publish-31b`, gleiche
  Quellen und Toolchain). Ergebnis dort ebenfalls 82/82 identisch, aber
  dieselben Kategorien flüchtiger Unterschiede.

### 6.2 JVM- und Unit-Tests

Maven-Build der Bridge mit dem offenen JDK: 85/85 JVM-Tests (echte
Forge-Partien), 0 Fehler, 0 übersprungen. Engine-Unit-Tests (Protokoll,
Client, Worker-Host): 96/96.

### 6.3 Engine-Lock und Standardweg

`node engine/scripts/engine-lock.mjs verify engine/build/publish-31b/dist` ist
vor und nach dem Versuch grün. `engine/**`, `notices/**`,
`THIRD-PARTY-NOTICES.md`, `SOURCE.md`, `docs/PUBLICATION.md`, `deploy/` und
`vercel.json` sind unverändert (`git diff --stat` leer). Der offene Lauf hat
`engine/engine.lock.json` nicht geschrieben; `validate.mjs` prüft das am Ende.

### 6.4 App-/PWA-Suite und Lizenz-Gate

- **Schritt `notices-gate`:** Der unveränderte App-Build mit der offenen
  Engine bricht ab mit „Unreviewed shipped engine component:
  open:graalvm-ce-compiler:95ce1499…“. So ist es gewollt: Neue
  Engine-Komponenten brauchen einen geprüften Eintrag in
  `notices/policy.json`. Der gehört in den Umstellungs-Task.
- **Schritt `app-check`:** `npm run check` lief mit einem **vorübergehenden**
  Eintrag in `engine/NOTICES.md`. Er ist als „PROVISIONAL (Prompt 34
  functional test, not reviewed)“ markiert und hat Lizenztexte aus den offenen
  Quellen. Ergebnis: Schema, TypeScript, oxlint, 957/957 Vitest, E2E in Chrome
  mit der offenen Engine (echte Forge-Partien) und die PWA-Suite (Download mit
  SHA-Prüfung, Offline-Partie nach Cache-Leerung, Updates) bestanden.
  Eintrag und Lizenzdateien wurden danach entfernt; das prüft das Skript, und
  `git status` war sauber. Das ist ein Funktionstest, keine Lizenzprüfung.

## 7. Leistung (alt gegen neu, gleiche Bedingungen)

Beide Apps wurden aus demselben Commit mit demselben Kartenkatalog gebaut
(`reports/open-34/app-oracle` mit `publish-31b`, `reports/open-34/app-open`
mit `open-34-20261010d`). Jede der 7 Prüfpartien
(`scripts/readiness/matches.ts --games <partie>`) lief einzeln, abwechselnd
Oracle → offen, in derselben Nacht auf derselben Maschine. Auswertung:
`scripts/open-toolchain/engine-times.mjs` über die portablen Aufzeichnungen
(Zeitstempel des App-Recorders).

| Messwert | Oracle | offen | Abweichung |
|---|---|---|---|
| Start bis erste Frage Forges (Median der 7 Partien, inkl. Engine-Download und -Start) | 3.873 ms | 3.945 ms | +1,9 % |
| KI-Zugzeit: Eingabe bis nächste Frage, wenn Forge dazwischen die KI ziehen lässt (Median) | 174 ms (n = 116) | 192 ms (n = 108) | +10 % |
| Alle Engine-Antworten (Median) | 56 ms (n = 423) | 61 ms (n = 354) | +9 % |
| Engine-Suite: „Engine bereit“ in Chrome (Median 21 Läufe, verschiedene Zeitpunkte) | 5.440 ms | 5.077 ms | −7 % |
| Engine-Suite: KI gegen KI, bereit bis Ende (4 Partien) | 3.551 / 3.488 / 4.220 / 4.692 ms | 3.377 / 3.518 / 3.438 / 4.554 ms | gleichauf |
| Modul roh / gzip -9 / Brotli 11 | 79.010.169 / 20.489.057 / 13.065.749 | 79.028.362 / 20.511.171 / 13.056.115 | +0,02 % / +0,11 % / −0,07 % |
| Builder: Dauer / Spitzen-RSS (`-Xmx6g`, 2 Threads) | 2 min 35 s / 4,01 GiB | 2 min 47 s / 4,32 GiB | +8 % / +8 % |
| Builder-Schritt „Compiling methods“ | 18,9 s | 22,1 s (Lauf c: 42,3 s unter Last) | +17 % |

Grenzen: Die Partien verlaufen nicht bitgleich, weil Forges KI mit Zeitbudget
rechnet (Patch 0002). Die Mediane der KI-Zugzeit beruhen daher auf
verschiedenen Spielverläufen; je Partie schwanken sie in beide Richtungen
(z. B. control 212 → 143 ms, phone 52 → 155 ms). Die Bauzeit ist nicht unter
gleichen Bedingungen gemessen: der Oracle-Build lief am 08.10., der offene
neben anderen Sitzungen; derselbe Schritt schwankte zwischen den offenen
Läufen c und d um fast das Doppelte. Am erzeugten Modul ist kein Unterschied
messbar (37.844 Kompiliereinheiten in beiden, Größe +0,02 %).

## 8. Abweichungen und Nebenbefunde

1. **JVMCI unter GPLv2 ohne Classpath Exception (Hauptbefund).**
   - **Welche Typen:** `jdk.vm.ci.amd64.AMD64` (+`$1`), `AMD64Kind`,
     `code.Architecture`, `code.TargetDescription`, `code.ValueKindFactory`,
     `meta.DeoptimizationAction`, `meta.DeoptimizationReason`, `meta.JavaKind`
     (+`$FormatWithToString`), `meta.MetaUtil`, `meta.PlatformKind`,
     `meta.ValueKind`.
   - **Header:** „GNU General Public License version 2 only“ ohne
     Classpath-Satz, in labsjdk `src.zip`, labs-openjdk `391a5a73` und
     `openjdk/jdk25u` gleich.
   - **Herkunft im Modul:** Ein Diagnoselauf mit denselben Eingaben und
     `-H:AbortOnTypeReachable=jdk.vm.ci.*` zeigt den Weg
     (`reports/open-34/jvmci-reachability-trace.txt`): Deopt-Snippets der
     SubstrateVM (`DeoptimizationReason`), Klassenmetadaten
     (`DynamicHubCompanion` mit den Enum-Konstanten von `JavaKind`,
     `DeoptimizationAction`) und `ObjectLayout.getArrayIndexScale` mit
     `AMD64Kind`, aufgerufen aus der WasmGC-Unsafe-Unterstützung von Web Image.
     Forge- und OpenMana-Code ist nicht beteiligt.
   - **Folge:** Ohne Eingriff in GraalVM/JVMCI ist das nicht zu entfernen. Es
     betrifft den Oracle-Build genauso.
   - **Gewicht:** Ob diese kleinen Typdefinitionen (Enums, Konstanten,
     Architekturbeschreibung) eine Unverträglichkeit mit GPLv3 begründen, ist
     eine Rechtsfrage. Der Bericht entscheidet sie nicht.
2. **Klassen-SBOM nur in Oracle GraalVM.** Ersatz durch eigenes Build-Feature
   (§3). Der Ersatz ist eigener Code und keine Herstellerangabe; seine
   Typenmenge ist die des Analyse-Universums. Lauf `open-34-20261009`
   (Abbruch nach 2 s) belegt das Fehlen.
3. **`-H:+PrintUniverse` taugt nicht als Ersatz:** Mit Web Image bricht der
   Build danach ab („InvalidMethodPointerHandler.invalidCodeAddressHandler():
   has no code address offset set“, Hello-World-Versuch).
4. **Herstellerkennung „GraalVM CE 25.4.4.1.1None.1“** statt „…+1.1“. Der erste
   `mx`-Zusammenbau ergab „+1.1“, der zweite (aus `setup.sh`) „None.1“. Die
   Kennung stammt aus `mx_sdk_vm_impl.graalvm_vendor_version()` und landet als
   `java.vendor.version` im Modul. Kosmetisch, ohne Einfluss auf Prüfungen;
   für eine Umstellung sauber pinnen.
5. **Erster `mx build` aller Projekte** brach am Speicherdruck ab (javac-Daemon
   bei einem Truffle-**Test**projekt). Gebaut wird seither nur die nötige
   Distribution `GRAALVM_E71CB7D492_JAVA25`.
6. **Läufe:**
   - `open-34-20261009`: fehlgeschlagen, SBOM-Option;
   - `open-34-20261009b`: von mir abgebrochen, Skriptkorrektur;
   - `open-34-20261009c`: Build und 82/82 bestanden, App-Build an der
     Lizenzinventur gescheitert (Lambda-Klassen in der Ersatz-SBOM);
   - `open-34-20261010d`: vollständig bestanden.

   Alle Ordner bleiben als Nachweis erhalten.
7. **Prüfspieler-Hänger** in der Oracle-Partie „rakdos“ (sechs wirkungslose
   Aktionen bei einer Zielauswahl). Das ist kein Engine-Fehler; in der
   Wiederholung haben beide Builds bestanden.
8. **Abweichung vom Task-Beispielpfad:** Pins und Skripte liegen unter
   `scripts/open-toolchain/` statt `engine/` (Begründung §3).
9. **Bitgleichheit:** Zwei offene Builds desselben Stands (c, d) ergaben
   unterschiedliche Modul-Bytes. Das ist wie beim Oracle-Weg; `UPDATING.md`
   behauptet ausdrücklich keine Bitgleichheit.

## 9. Reproduktion

```bash
# Node 22.22.3 / npm 10.9.8 aus dem Standard-Pin; Standard-Archive (Binaryen, Maven, Node)
# liegen nach engine/scripts/setup-toolchain.sh in ~/.cache/openmana/toolchain/downloads
export PATH=~/.cache/openmana/toolchain/node-v22.22.3-linux-x64/bin:$PATH

# 1. Offene Toolchain: labsjdk-ce laden/prüfen, oracle/graal + mx klonen, GraalVM CE + Web Image bauen
bash scripts/open-toolchain/setup.sh            # letzte Zeile: GraalVM-Home

# 2. Bau + volle Prüfstraße ohne Lock-Änderung (neues Verzeichnis unter engine/build)
NODE_OPTIONS=--max-old-space-size=2048 JDK_JAVA_OPTIONS=-Xmx512m MAVEN_OPTS=-Xmx768m \
OPENMANA_NATIVE_IMAGE_XMX=6g OPENMANA_NATIVE_IMAGE_PARALLELISM=2 \
node scripts/open-toolchain/validate.mjs --out engine/build/open-<lauf> \
  --bulk cards/build/cache/all-cards-20260924211809.jsonl.gz --provisional-notices

# 3. Gleichheit gegen den Lock-Build
node scripts/open-toolchain/compare-engine-results.mjs engine/build/publish-31b engine/build/open-<lauf>

# 4. Lizenzmatrix
OT=~/.cache/openmana/open-toolchain
python3 -I scripts/open-toolchain/inventory.py evidence engine/build/open-<lauf> $OT/graal $OT/labsjdk-ce-25.0.4.1.1-jvmci-25.4-b23

# 5. Prüfpartien: App mit Oracle-Engine bauen; die App mit offener Engine legt Schritt 2 in dist/ ab
OPENMANA_ENGINE_DIR=$PWD/engine/build/publish-31b/dist OPENMANA_CARDS_DIR=$PWD/engine/build/publish-31b/catalog \
  npx vite build --outDir reports/open-34/app-oracle
cp -a dist reports/open-34/app-open
for g in rakdos control commander phone walkers grixis fold; do for side in oracle open; do
  E=$([ $side = oracle ] && echo engine/build/publish-31b || echo engine/build/open-<lauf>)
  OPENMANA_ENGINE_DIR=$PWD/$E/dist OPENMANA_CARDS_DIR=$PWD/$E/catalog \
    node scripts/readiness/matches.ts --serve reports/open-34/app-$side --out reports/open-34/matches/$side-$g --games $g
done; done
node scripts/open-toolchain/engine-times.mjs reports/open-34/matches/open-*   # bzw. oracle-*
```

Diagnose JVMCI: denselben `native-image`-Aufruf wie `engine/scripts/build-wasm.sh`
mit dem offenen Home und den Eingaben aus `engine/build/open-<lauf>/wasm-work`
ausführen, ohne `--enable-sbom`, zusätzlich `-H:AbortOnTypeReachable='jdk.vm.ci.*'`.
Der Trace steht danach unter `reports/trace_types_*.txt`.

## 10. Empfehlung für den Projektbesitzer

**Projekt pausiert lassen und vor einer Umstellung genau eine Frage klären:
JVMCI.** Danach ist die Umstellung auf die offene Toolchain in einem eigenen,
ausdrücklich freizugebenden Task technisch tragfähig.

Begründung:

- Der offene Weg beseitigt alle Punkte aus Bericht 33, die an Oracle hängen:
  - keine GFTC/NFTC-Teile;
  - kein Enterprise-Builder (A6/A7 entfallen);
  - der Toolchain-Quelltext ist vollständig offen, Dritte können die Engine
    ohne Oracle-Paket nachbauen.

  Funktion, Ergebnisse und Leistung sind gleichwertig.
- Was bleibt, ist kein Oracle-Problem, sondern betrifft jeden Native-Image-Build:
  13 kleine JVMCI-Typen aus dem OpenJDK unter „GPLv2 only“ ohne Classpath
  Exception.
- Wege dafür, in dieser Reihenfolge:
  - **(a) Rechtliche Einschätzung**, ob diese Typen der Weitergabe mit Forge
    (GPLv3) entgegenstehen (Frage 6/7 aus Bericht 33, jetzt viel enger:
    13 Typen statt 4.672).
  - **(b) Anfrage beim OpenJDK-/GraalVM-Projekt**, ob `jdk.internal.vm.ci`
    die Classpath Exception tragen kann, wie fast alle übrigen JDK-Module.
  - **(c) Ein GraalVM-Patch**, der diese Typen aus dem Laufzeitcode hält.
    Das wäre ein eigenes, größeres Toolchain-Projekt.
- **Aufgeben ist nicht nötig:** Die technische Seite ist gelöst. Offen ist nur
  noch eine eng umrissene Rechtsfrage.

Für einen späteren Umstellungs-Task gehören dazu:

- ein eigener Pin-Schritt im regulären Weg;
- geprüfte Lizenzeinträge für die `open:`-Komponenten in `notices/policy.json`
  und `THIRD-PARTY-NOTICES.md` (die Oracle-Texte entfallen);
- `SOURCE.md`/`PUBLICATION.md` anpassen;
- eine saubere Herstellerkennung;
- die Entscheidung, ob die Ersatz-SBOM (`ReachableTypesFeature`) dauerhaftes
  Werkzeug wird;
- ein neues Release und neue Freigaben.
