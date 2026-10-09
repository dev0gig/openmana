# OpenMana-Engine nur aus offenen Quellen bauen (Machbarkeitsversuch)

> Prompt 34 (Dropzone `openmana-34-open-source-web-image-build`), durchgeführt
> am **2026-10-09/10** auf odin (i7-8700T, 12 Threads, 15,5 GiB RAM, mit
> parallel laufenden anderen Sitzungen). **Keine Rechtsberatung und keine
> Freigabe.** Der Bericht belegt Lizenzen technisch (Dateien, Header, Hashes).
> Produktion, Standard-Build, Engine-Lock, Lizenzhinweise, Release und Vercel
> sind unverändert; nichts wurde gepusht oder veröffentlicht.

## 1. Ergebnis

**{{ERGEBNIS}}**

{{ERGEBNIS_SATZ}}

| Prüfung | Grenze | Oracle-Build `publish-31b` | Offener Build `open-34-20261010d` | Erfüllt |
|---|---|---|---|---|
{{TABELLE}}

## 2. Offene Toolchain (gepinnt)

Pins: `scripts/open-toolchain/toolchain.open.lock.json`. Aufbau:
`scripts/open-toolchain/setup.sh` (lädt und prüft, baut mit `mx`).

| Teil | Version / Stand | Herkunft | Prüfsumme | Lizenz | Primärbeleg |
|---|---|---|---|---|---|
| JDK (Builder **und** Klassenbibliothek im Modul) | labsjdk-ce `25.0.4.1.1+1-jvmci-25.4-b23` | `graalvm/labs-openjdk`, Release `jvmci-25.4-b23`; Quellstand `391a5a739cb60fcc35927c6afecf6d9ac00f391d` (`release`: `SOURCE`) | Archiv SHA-256 `871a0de0…41232f` (= GitHub-Digest), 266.161.674 Bytes | GPLv2 + Classpath Exception; JVMCI-Quellen GPLv2 **ohne** Ausnahme (§5.3) | `legal/*/LICENSE`: 69 identische Dateien, SHA-256 `4b9abebc…7726`, GPLv2-Text mit angehängter Classpath Exception; keine Datei nennt NFTC oder GFTC; `release`: `IMPLEMENTOR="GraalVM Community"` |
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

{{NACHWEIS}}

## 5. Lizenzmatrix des neuen Moduls

{{MATRIX}}

## 6. Gleichheit

{{GLEICHHEIT}}

## 7. Leistung (alt gegen neu, gleiche Bedingungen)

{{LEISTUNG}}

## 8. Abweichungen und Nebenbefunde

{{ABWEICHUNGEN}}

## 9. Reproduktion

{{REPRO}}

## 10. Empfehlung für den Projektbesitzer

{{EMPFEHLUNG}}
