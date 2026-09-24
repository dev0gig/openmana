# Forge für OpenMana: Komponenten, Ressourcen, Build und Updates

> Research zu Prompt 00, Stand **2026-09-24**. Befunde mit Quellenangabe sind
> geprüft. Build- und Update-Abläufe (§4–§6) sind **Empfehlungen**, abgeleitet aus
> ManaBrews laufender Kette ([MANABREW_WASM.md](MANABREW_WASM.md)) und Forges
> Quelltext. Einen eigenen OpenMana-Build gibt es noch nicht.

## 0. Versionen

| | Stand |
|---|---|
| Forge upstream | [`Card-Forge/forge@ed0333f`](https://github.com/Card-Forge/forge/tree/ed0333fecb1fea0671b3e50cadc1da4f71db5798) (`master`, 2026-09-24), Version `2.0.15-SNAPSHOT`, Bytecode `release 17`, Maven ≥ 3.8.1 (Enforcer im Root-`pom.xml`). Lizenz GPL-3.0-or-later |
| Letztes Forge-Release | `forge-2.0.14` (2026-08-08, „The Hobbit Release“). Releases erscheinen alle 1–2 Monate, meist zu neuen Editionen |
| Änderungstempo upstream | 339 Commits in 30 Tagen, davon 252 direkt auf `master` (first-parent). In 90 Tagen geändert: `AiController` 16×, `PlayerControllerHuman` 15×, `AiAttackController` 13×, `AbstractGuiGame` 8×, `PlayerController` 2×, `ThreadUtil` 1×, `IGuiGame` und `InputSyncronizedBase` 0× |
| ManaBrews Fork | `witchesofthehill/forge@e7d2b93` (38 eigene Commits ohne Merges). Getestet hat ManaBrew **diesen Fork**, nicht upstream |
| Anvil-Fork (Referenz) | `dev0gig/forge@745f26d` (2026-09-04), 30 Commits über upstream, darunter das Modul `forge-anvil`. Das Repo liegt **nur in Gitea auf odin** und darf laut Repo-Regel des Projekts nicht nach GitHub. Als Baustein für OpenMana (GitHub + Vercel) scheidet es deshalb aus; es dient nur als Vorlage |

## 1. Benötigte Forge-Module

**Nötig:** `forge-core`, `forge-game`, `forge-ai` und `forge-gui`. Dazu kommt ein eigenes Bridge-Modul, das **außerhalb** des Forge-Baums liegt. `forge-gui` ist keine Oberfläche, sondern enthält die Laufzeit, die OpenMana braucht:
- `FModel`, die Initialisierung mit Kartendatenbank, Einstellungen und Sprache,
- `IGuiBase`/`GuiBase` und `IGuiGame`/`AbstractGuiGame`,
- `HostedMatch`,
- `PlayerControllerHuman` samt Forges Input-Klassen (`InputPassPriority`, `InputAttack`, `InputBlock`, `InputPayMana`, `InputSelect…`, Mulligan),
- `YieldController` (APINA).

`AvailableActions` und `AiProfileUtil` liegen in `forge-ai`, `GameLogFormatter` in `forge-game`, `ThreadUtil` und `CardStorageReader` in `forge-core`. Dieselben vier Module nutzen ManaBrews `forge-harness` ([`pom.xml`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/pom.xml)) und `forge-anvil`.

**Nicht nötig:** `forge-gui-desktop` (Swing), `forge-gui-mobile(-dev)`, `forge-gui-android`, `forge-gui-ios`, `forge-installer`, `forge-lda`, `adventure-editor`.

**Direkte Laufzeit-Abhängigkeiten** laut den POMs in `ed0333f`:

| Modul | Abhängigkeiten |
|---|---|
| `forge-core` | guava 33.3.1-android, commons-lang3 3.18.0, commons-text 1.12.0, rssreader 3.8.2, tinylog 2.7.0 (`tinylog-impl`, `slf4j-tinylog`) |
| `forge-game` | sentry 8.21.1, jgrapht-core 1.5.2 |
| `forge-ai` | commons-math3 3.6.1 |
| `forge-gui` | xmlpull 1.1.3.4a, xstream 1.4.21, netty-all 4.1.115.Final, jupnp 3.0.5, lz4-java 1.10.2, jetty 9.4.57, gson 2.13.2 |

Netty, Jetty und jupnp gehören zu Forges Netzspiel und sind im Browser nutzlos. Sie gelangen trotzdem teilweise ins Modul: Im produktiven ManaBrew-Modul fanden sich Klassennamen aus `io.netty` (73), `io.sentry` (29), `org.jupnp` (4) und `org.eclipse.jetty` (1). Für die Lizenzen ist das relevant ([LICENSES.md](LICENSES.md) §2). Hinzu kommen die Teile der Web-Image-Runtime (Jimfs, Guava).

## 2. Ressourcen für ein vollständiges Spiel

Größen und Dateizahlen stammen aus dem lokalen Forge-Checkout (`du --apparent-size`); ManaBrews Boot-Log bestätigt die Summe: „streamed 36903 files, 34786 KiB into the VFS“.

| `forge-gui/res/…` | Umfang | Wozu | Pflicht |
|---|---|---|---|
| `cardsfolder/` | 24 MB, 33 669 Dateien | alle Kartenskripte | **ja, vollständig** (siehe unten) |
| `tokenscripts/` | 144 KB, 839 | Token | ja |
| `editions/` | 3,9 MB, 679 | Editionen, Drucke, Token-Zuordnung | ja |
| `blockdata/` | 251 KB, 6 | Blöcke | ja |
| `lists/` | 4,2 MB, 35 | u. a. `TypeLists.txt` | **ja**: laut ManaBrew-Blog ändert sich ohne `res/lists` die Legalität |
| `formats/` | 1,8 MB, 1 328 | Formate | ja: „FModel.initialize reads all of them and throws without them“ ([`forge_assets.rs`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/manabrew-rs/crates/forge-cardset-archive/src/forge_assets.rs)) |
| `defaults/`, `effects/` | 252 KB (17 Dateien), 1,6 MB (2) | Vorgaben | ja |
| `ai/` | 80 KB, 4 | KI-Profile `Cautious`, `Default`, `Experimental`, `Reckless` | ja (Bible §7) |
| `languages/en-US.properties` | 177 KB | Forges Meldungstexte | ja |
| `languages/de-DE.properties`, `cardnames-de-DE.txt` | 192 KB, 8,3 MB | deutsche Forge-Meldungen und Kartentexte | optional (siehe unten) |
| `deckgendecks/` | 11 MB | kartenbasierter Deckgenerator | nein, wenn die Bridge `DECKGEN_CARDBASED=false` setzt |
| `adventure/`, `quest/`, `puzzle/`, `conquest/`, `skins/`, `sound/`, `music/`, `fonts/`, `draft/`, `cube/`, `sealed/` | zusammen rund 185 MB | andere Spielmodi, Oberfläche | nein. Limited braucht später `draft/`, `cube/`, `sealed/` |

Zusammen sind das rund **36,5 MB Text**. Mit Brotli schrumpfen sie auf etwa 3 MB (ManaBrews Kartenarchiv 0.2.0: 34,7 MB → 3,1 MiB).

- **Das ganze `cardsfolder` ist Pflicht, kein Deckfilter.** Effekte wie `MakeCardEffect`, `ChooseCardNameEffect`, `CopyPermanentEffect` und `PlayEffect` bringen Karten ins Spiel, die in keinem Deck stehen. ManaBrew hat den zwischenzeitlich deckgefilterten Ansatz (Blog: „43 scripts instead of 33,645“) mit PR #910 wieder durch den vollständigen Satz ersetzt.
- **Lazy Loading:** Mit `LOAD_CARD_SCRIPTS_LAZILY` indiziert Forge nur Namen und liest Skripte erst bei Bedarf (0,9 s im Browser, [MANABREW_WASM.md](MANABREW_WASM.md) §6). ManaBrew brauchte dafür im Fork Korrekturen (`1b515ac`, `5169c6f`, zusammen rund 500 Zeilen in `CardStorageReader`, `StaticData`, `CardDb` und den obigen Effekten). Ob upstream ohne sie korrekt ist oder ob Eager-Loading im Wasm tragbar wäre, ist **offen** (Plan, Frage 2).
- **Laufzeitdateien:** Forge will ein `user.home` mit `card.preferences`, `deck.preferences` und `item_view.preferences` (jeweils `<preferences/>`) sowie einer leeren `forge.preferences` ([`WasmMain.prepareHome`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/native/wasm-src/forge/harness/wasm/WasmMain.java#L164-L172)). Dauerhafte Einstellungen gibt es im Browser nicht. Die Bridge setzt deshalb alles programmatisch über den `adjustPrefs`-Callback von `FModel.initialize`. Die Anvil-Lehre dazu: Sprache und APINA gehören in diesen Callback, nicht danach.
- **Deutsch:** Kartennamen und Bilder kommen laut Bible §4 aus Scryfall. Sollen Forges Fragen und das Spielprotokoll deutsch sein (Anvil tat das), braucht die Engine `de-DE.properties` und gegebenenfalls `cardnames-de-DE.txt`. Das ist klein (Text, gut komprimierbar), aber upstream hat Lücken: Anvil hat im Fork 5 Kartennamen-Zeilen (die Grundländer) und einen Meldungsschlüssel korrigiert. Diese Korrekturen sollten upstream eingereicht oder als Patch mitgeführt werden.

## 3. Toolchain (empfohlene Pins)

| Werkzeug | Empfehlung | Beleg |
|---|---|---|
| GraalVM mit Web Image | **Oracle GraalVM 25.4.4.1.1** (Innovation Release, 2026-09-22) statt eines Early-Access-Builds, per SHA-256 gepinnt | Enthält `lib/svm/tools/svm-wasm` (Dateiliste des Tarballs geprüft), Download ohne Login über `gds.oracle.com/download/graal/25i4/…`, Lizenz GFTC. ManaBrew nutzt EA `jdk-25i3-25.0.4.1-ea.03`; zu EA-Builds schreibt Oracle „does not recommend bundling this build with your products“. **Achtung:** Seit 25.1 erscheint jeden Monat ein neues Release, das das vorige ablöst ([Release Calendar](https://www.graalvm.org/release-calendar/)). Das Tarball muss deshalb gecacht und archiviert werden. Die GraalVM CE enthält kein Web Image |
| JDK für Maven | dieselbe GraalVM (JDK 25) | ManaBrew baut genauso; Forge übersetzt mit `release 17`. JDK 26 scheitert laut ManaBrew-README |
| Binaryen (`wasm-as`) | `version_123` | Oracle verlangt ≥ 119 ([`get-started.md`](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/docs/get-started.md)); Apache-2.0, reines Build-Werkzeug |
| Maven | fest gepinnt (≥ 3.8.1); Forge liefert keinen `mvnw` | Forge-`pom.xml` |
| Node | ≥ 22 für Wasm-Smoke-Tests | Web Image braucht exnref; Node 22.22.3 hat es standardmäßig an (`node --v8-options`) |
| Asset-Packer | kleines eigenes Skript (Node oder Python) statt ManaBrews Rust/rkyv | Es rahmt den upstream-Baum mit Originalpfaden (`pfad\0inhalt\0…`). ManaBrews Namensnachbildung entfällt, weil nichts umbenannt wird |

## 4. Nötige Patches auf Forge upstream

**Minimum für Web Image** (GPL-Code aus ManaBrews Fork, als einzelne Hunks auf den upstream-Pin übertragen):
1. `51b7d50`: Synchronmodus in `ThreadUtil` und direkte KI-Bewertung in `AiController`, **ohne** den zurückgenommenen LDA-Guard.
2. `026be2f`: kooperative KI-Deadline in `AiController`. Ohne sie gibt es im Wasm keine Zeitgrenze für KI-Entscheidungen.
3. `43847a6`: `AiAttackController` arbeitet im Synchronmodus nacheinander.

**Zusätzlich für den Anvil-Weg** (Plan §3, Option A), neu zu schreiben:
4. `InputSyncronizedBase.awaitLatchRelease()` wartet heute mit `cdlDone.await()` darauf, dass ein **anderer** Thread den Latch löst. Im Synchronmodus muss hier stattdessen die Bridge laufen: Eingabe blockierend lesen und auf demselben Thread an Forge geben (`selectCard`, `selectButtonOk` …), bis `stop()` den Latch löst. Geschätzt sind das 20–40 Zeilen samt Hook.
5. Stellen, die im Match einen Thread starten, laufen im Synchronmodus direkt, zum Beispiel `FThreads.invokeInBackgroundThread`. Welche davon im Human-gegen-KI-Pfad tatsächlich erreicht werden, zeigt erst der Spike. Timer (`java.util.Timer` in `AbstractGuiGame`, `ThreadUtil.delay`) laufen im Wasm nie los. Das trifft nur Komfortanzeigen („warte auf …“) und die 3-s-Pause in `HostedMatch`, die ohnehin nur bei KI-gegen-KI greift.

**Nur nach Prüfung:** die Lazy-Loading-Korrekturen `1b515ac`/`5169c6f` (§2). **Nicht übernehmen:** ManaBrews Obergrenzen, die in einem Unentschieden enden, `renderAbilityText`, Performance-Caches, Determinismus-Hooks und die Serverparallelität. Braucht OpenMana eine Obergrenze gegen Endlosschleifen, endet sie als sichtbarer **technischer Abbruch**, nicht als Spielergebnis.

**Pflege:** Die KI-Stellen ändern sich upstream etwa wöchentlich (§0). Die Patch-Queue wird deshalb bei jedem Forge-Update neu angewendet und bricht laut ab (`git apply --check`). Auf Dauer sollte ein Synchronmodus **upstream** bei Card-Forge eingereicht werden. Eine PR-Suche am 2026-09-24 („synchronous“, „wasm“, „single-threaded“) fand keinen solchen PR. Card-Forge nimmt aber Beiträge aus diesem Umfeld an: Der ManaBrew-Maintainer hat Performance-Fixes aus seinen Wasm-Lasttests upstream gebracht ([#11916](https://github.com/Card-Forge/forge/pull/11916), gemergt). Außerdem ist „Enforce single-thread engine access“ ([#11718](https://github.com/Card-Forge/forge/pull/11718)) offen.

## 5. Build-Ablauf (Empfehlung)

1. `engine/forge` als Submodule auf einen **vollen upstream-SHA** auschecken (flach, `shallow = true` wie bei ManaBrew; ganzes Repo 1,07 GB). Danach die Patch-Queue `engine/patches/*.patch` anwenden; jeder Konflikt bricht ab.
2. **Frischer** Maven-Build über einen Reactor-Aggregator, der `engine/forge` und `engine/bridge` enthält (Muster: [ManaBrews Root-`pom.xml`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/pom.xml)): `mvn -pl bridge -am clean package`. Die Bridge-Tests laufen dabei mit; Forges eigene Tests werden gezielt übersprungen, nicht pauschal per `-DskipTests`.
3. Aus dem Fat-JAR die Reflection-Config generativ erzeugen (alle `forge.*`-Klassen). Die Config für Fremdbibliotheken einmalig per Tracing-Agent erzeugen, einfrieren und nach Abhängigkeits-Updates erneuern.
4. Das Asset-Bundle aus §2 packen und Dateizahl, Gesamtgröße und SHA-256 festhalten.
5. Die `@JS`-Bootstrap-Klassen mit `javac -parameters` übersetzen.
6. `native-image --tool:svm-wasm …`, Flags wie ManaBrew, zusätzlich:
   - `-H:+FatalUnsupportedNodes`: nicht unterstützte Knoten brechen laut ab statt still ([MANABREW_WASM.md](MANABREW_WASM.md) §5);
   - Netzspiel-Klassen (`forge.gamemodes.net`, jupnp, Jetty) aus dem erreichbaren Code heraushalten, Nachweis per Build-Report;
   - `-H:+LegacyExceptions` nur, wenn ältere Browser nötig werden ([Plan](OPENMANA_ENGINE_PLAN.md) §8).
7. Den Launcher nachbearbeiten: `wasm_path` pinnen. Optional auf `instantiateStreaming` umstellen; der Nutzen ist laut Messung klein.
8. **Tests:**
   - Bridge-Tests auf der JVM (schnell).
   - **JVM-gegen-Wasm-Differenztest:** gleiche Decks, gleicher Seed, skriptierte Antworten, identische Ereignisspur. ManaBrew fand für die Seeds 7, 42 und 99 byte-identische Spuren (Blog).
   - Wasm-Smoke in Node sowie in Chrome per Playwright mit COOP/COEP (Verfahren: [MANABREW_WASM.md](MANABREW_WASM.md) §6).
9. Ergebnis ist ein Artefakt-Satz `engine.js`, `engine.js.wasm` und `engine-manifest.json` mit:
   - Forge-SHA, Hash der Patch-Queue, Bridge-Commit und Protokoll-Version,
   - GraalVM-, Binaryen- und Maven-Version samt Tarball-Hashes,
   - Asset-Inventar, Größen und SHA-256 aller Dateien,
   - Lizenzinventar der tatsächlich enthaltenen Komponenten.

   Veröffentlicht wird der Satz als Release-Asset.

**Wo bauen:** in GitHub Actions oder lokal, **nicht** auf Vercel (Build-Grenze 45 min, dazu ein 380-MB-Toolchain-Download pro Build).
- ManaBrew braucht auf einem Runner eines öffentlichen Repos (4 vCPU, 16 GB) 6:44 min.
- `dev0gig/openmana` ist **privat**; dessen Standard-Runner hat nur 2 vCPU und 8 GB ([GitHub-Doku](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). Ob `native-image` damit auskommt, ist offen (Plan, Frage 4).
- Ausweichmöglichkeiten: odin als Build-Rechner (bleibt nur Build-, keine Laufzeitabhängigkeit), ein größerer Runner oder ein öffentliches Engine-Repo.

## 6. Isolierter Update-Pfad

Das konkretisiert Bible §3, Schritte 1–8.

1. **Eigener PR „Forge-Update“**, der nur `engine/**` ändert: neuer Submodule-SHA, bei Bedarf angepasste Patches. Wenn Tests es erzwingen, auch `engine/bridge` samt Configs.
2. CI baut **von Grund auf neu**: kein Cache für Klassen, Configs oder Assets aus dem alten Stand. ManaBrews README warnt ausdrücklich vor „stale .class files“.
3. Bridge-Tests auf der JVM, Differenztest JVM gegen Wasm, Smoke-Partien im Wasm. Pflichtfälle nach Bible §16: Mulligan, Priorität, Kosten, Ziele, Kampf, Commander.
4. **Vertragsprüfung:** Das Protokoll-Schema (`engine/protocol`) ist unverändert oder bewusst versioniert. Ein Git-Pfad-Check stellt sicher, dass `src/` (UI) im PR unberührt bleibt.
5. OpenMana wird mit **unverändertem UI-Code** gegen das neue Engine-Artefakt gebaut und typgeprüft.
6. Review als eigener PR, Deploy nur mit grünen Tests. GraalVM- und Binaryen-Updates laufen als **eigene** PR-Art.

**Takt:** Forge wird bewusst hochgezogen, etwa zu neuen Editionen, und nicht automatisch. Bricht die Forge-API, wird nur `engine/bridge` angepasst; die UI sieht ausschließlich das Protokoll.
