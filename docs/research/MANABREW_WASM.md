# ManaBrew: Forge im Browser (WebAssembly)

> Research zu Prompt 00, Stand **2026-09-24**. Quellen sind gepinnte Commits und
> Primärdokumente. Eigene Messungen stehen in §6 und sind als solche gekennzeichnet.
> In OpenMana ist nichts implementiert.

## Quellenstand

| Quelle | Pin |
|---|---|
| ManaBrew | [`witchesofthehill/manabrew@eb70d0c`](https://github.com/witchesofthehill/manabrew/tree/eb70d0cdc48dd18267420ef0cb871264b242815b) (2026-09-23) |
| ManaBrews Forge-Fork | [`witchesofthehill/forge@e7d2b93`](https://github.com/witchesofthehill/forge/tree/e7d2b93ba9f800a1f5f3a5de91db1aad3ed46831), Branch `manabrew` (2026-09-21). Merge-Base mit upstream `4b69361` (2026-09-21). Der Fork ist 58 Commits voraus (38 ohne Merges) und 53 hinter upstream. Er ändert 50 Dateien (+1072/−143) |
| Forge upstream | [`Card-Forge/forge@ed0333f`](https://github.com/Card-Forge/forge/tree/ed0333fecb1fea0671b3e50cadc1da4f71db5798) (`master`, 2026-09-24 01:50 UTC) |
| GraalVM Web Image (Quelltext) | [`oracle/graal@9a8b548`](https://github.com/oracle/graal/tree/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image) (2026-09-23) |
| ManaBrew-Blog | „Forge now runs in the browser“ (2026-08-30), Quelle [`website/src-landing/content/blog/graalvm.md`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/website/src-landing/content/blog/graalvm.md) |
| npm | `@manabrew/forge-wasm@0.2.0` (2026-08-31). Das ist die neueste veröffentlichte Version; `0.3.0` steht nur im Repo |
| Produktives Modul | `https://play.manabrew.app/assets/forgeharness.js-BAVqSMBT.wasm`, geladen am 2026-09-24: 72 389 554 B, SHA-256 `90807c3185454dd5971d438ce03260ca3d85558d6fc09387be2af78dc366688b` |

## 1. Kurzfassung

- **ManaBrew hat zwei Browser-Engines.** Die eigene „Manabrew engine“ ist ein **Rust-Nachbau** von Forge (`manabrew-rs/crates/manabrew-engine`). Er liest zwar Forge-Kartenskripte, ist laut [README](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/README.md) aber „still catching up to Forge“. Für OpenMana scheidet er aus, weil laut Bible §2 nur Forge Regeln entscheidet. Relevant ist der zweite Weg: **echtes Java-Forge, per GraalVM Web Image zu WebAssembly kompiliert** (PR #759, 2026-08-29).
- **So nutzt ManaBrew das heute:** Im Web läuft „Play vs AI“ auf Forge-Wasm im Tab, sobald der Browser es kann. Dazu prüft ManaBrew Cross-Origin-Isolation, `SharedArrayBuffer`, schließt iOS aus und verlangt einen erfolgreichen Probelauf. Andernfalls fällt ManaBrew auf einen **gehosteten Forge-Server** zurück ([`useGameStore.ts` Z. 153](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/src/stores/useGameStore.ts#L153), [`forgeWasm.ts` Z. 55–66](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/src/lib/forgeWasm.ts#L55-L66)). Mehrspieler-Tische im Browser zu hosten ist hinter einem Flag versteckt (`forgeWasm: false` in [`featureFlags.ts`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/src/featureFlags.ts#L25); in Produktion per `config.js` freigeschaltet). Der Blog nennt alles „experimental“. **„Bewährt“ heißt also:** 1-gegen-KI läuft produktiv im Browser, aber mit Server als Rückfall. OpenMana hat keinen Server und damit keinen Rückfall.
- **Buildkette:** Maven-Fat-JAR aus `forge-core`, `forge-game`, `forge-ai` und `forge-gui`, dazu der eigene `forge-harness` und Gson. Daraus erzeugt `native-image --tool:svm-wasm` mit **Oracle GraalVM** (EA `jdk-25i3-25.0.4.1-ea.03`) und Binaryen 123 die Dateien `forgeharness.js` (Launcher) und `forgeharness.js.wasm`. Alle nötigen Forge-Textdaten stecken seit PR #910 (2026-09-12) im Modul.
- **Laufzeit:** Forge läuft **synchron in einem Dedicated Worker**. Muss ein Mensch entscheiden, schreibt Forge JSON in einen `SharedArrayBuffer` und blockiert mit `Atomics.wait`. Das setzt Cross-Origin-Isolation voraus (COOP/COEP).
- **Mit Forge upstream geht das nicht direkt.** Web Image kennt genau einen Java-Thread. ManaBrew patcht Forge deshalb im eigenen Fork: Der Schalter `-Dforge.synchronous=true` lässt alles im selben Thread laufen, und die KI bekommt eine Zeitgrenze, die ohne Threads auskommt (§4).
- **Der Adapter ist ein anderer als bei Anvil.** ManaBrew nutzt einen eigenen `PlayerController` (2 830 Zeilen) mit eigenem Kostenzahlen und eigenem Protokoll. Anvil setzt dagegen auf Forges `PlayerControllerHuman` und dessen Input-Klassen.
- **Eigene Messung** (§6, Desktop): Das produktive Modul startet in Chrome 153 in rund 3,9 s. Eine komplette KI-gegen-KI-Partie dauert im Standardformat 1,4–3,2 s (18–29 Züge), im Commander 9–12 s. Der Speicher erreicht in der Spitze 1,1–1,3 GB. Das Modul ist 69 MiB groß, mit Brotli 11,4 MiB.

## 2. Build-Pipeline Forge → Wasm

Ablauf nach [`scripts/build-forge-wasm.sh`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/scripts/build-forge-wasm.sh) und [`forge-harness/build-wasm.sh`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/build-wasm.sh). Die CI steht in [`publish-forge-wasm.yml`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/.github/workflows/publish-forge-wasm.yml), für Web-Deploys zusätzlich in `staging-deploy.yml` und `docker-images.yml`.

1. **Toolchain.** Oracle GraalVM EA `jdk-25i3-25.0.4.1-ea.03` kommt aus `graalvm/oracle-graalvm-ea-builds`, dazu Binaryen `version_123`. Beides ist gepinnt, liegt im CI-Cache und kostet 10 s Installation. Maven läuft mit **derselben** GraalVM (JDK 25.0.4.1). Forge wird dabei mit `release 17` übersetzt. Laut ManaBrew-README scheitern neuere JDKs wie 26 am Forge-Build.
2. **Fat-JAR.** Der Reactor-Aggregator [`pom.xml`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/pom.xml) enthält die Module `forge` (Submodule) und `forge-harness`. Gebaut wird mit `mvn -pl forge-harness -am package -DskipTests`. Das README verlangt nach jedem Forge-Wechsel einen **Clean-Build**, sonst landen veraltete Klassen im JAR.
3. **Asset-Bundle.** Rust-Helfer aus `forge-cardset-archive` packen `res/{cardsfolder,tokenscripts,editions,blockdata}`, `lists/TypeLists.txt` und `formats`, `lists`, `defaults`, `effects`, `ai` ([`lib.rs` `DEFAULT_EXTRA_DIRS`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/manabrew-rs/crates/forge-cardset-archive/src/lib.rs#L22)). Daraus entsteht eine Textdatei im Format `pfad\0inhalt\0…` ([`forge_assets.rs`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/manabrew-rs/crates/forge-cardset-archive/src/forge_assets.rs)). Dateinamen werden dabei nach Forges Regel (`CardStorageReader`) neu gebildet. Weicht ein Name ab, ist die Karte im Spiel „unsupported“.
4. **Web Image.**
   - Die `@JS`-Bootstrap-Klassen (`native/wasm-src`) werden mit `javac -parameters --add-modules org.graalvm.webimage.api` übersetzt; ohne `-parameters` bricht Web Image ab.
   - Die Reflection-Config entsteht **generativ**: jede `forge.*`-Klasse mit allen Konstruktoren, Protokoll- und Host-DTOs zusätzlich mit Feldern und Methoden. Dazu kommt eingefrorene Tracing-Agent-Config für die übrigen Bibliotheken ([`native/README.md`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/native/README.md)).
   - Aufruf ([Z. 69–85](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/build-wasm.sh#L69-L85)): `native-image --tool:svm-wasm -H:WasmComments=NONE -H:Name=forgeharness -H:IncludeResourceBundles=en-US -H:IncludeResources='assets-framed\.txt' --no-fallback --report-unsupported-elements-at-runtime --initialize-at-run-time=org.tinylog,org.slf4j,io.netty,forge,org.apache.commons.lang3 --initialize-at-build-time=com.google.common.util.concurrent -Djava.awt.headless=true`.
   - **Nacharbeit:** Ein Python-Schnipsel pinnt im generierten Launcher `config.wasm_path` (mit Override `globalThis.__forgeWasmUrl`). Sonst leitet der Launcher den Wasm-Pfad vom Dateinamen des Workers ab.
5. **Dauer:** Der CI-Schritt „Build npm package“ dauerte beim Release 0.2.0 **6 min 44 s**, der ganze Job 7 min 54 s ([Lauf 33427924785](https://github.com/witchesofthehill/manabrew/actions/runs/33427924785)). Gebaut wurde auf einem Standard-Runner eines **öffentlichen** Repos (4 vCPU, 16 GB).

## 3. Laufzeit im Browser

**Start** ([`WasmMain.java`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/native/wasm-src/forge/harness/wasm/WasmMain.java)):
1. `forge.synchronous=true` wird gesetzt, **bevor** irgendeine Forge-Klasse initialisiert ist (Z. 183). `user.home` zeigt auf `/forge-home`, dort liegen Preferences-Dateien bereit (XML-Dateien mit `<preferences/>`, leer wäre ein Parse-Fehler).
2. Das eingebettete Bundle wird ohne JS-Übergang ins In-Memory-Dateisystem (Jimfs aus der Web-Image-Runtime) unter `/forge-gui/` entpackt: **36 903 Dateien, 34 786 KiB** (eigene Messung). Nichts davon überlebt einen Reload.
3. `ManaBrewEngineAdapter.initialize()` ruft `FModel.initialize` mit `LOAD_CARD_SCRIPTS_LAZILY=true`, `DECKGEN_CARDBASED=false` und `PERFORMANCE_MODE=true` auf ([Z. 64–76](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/src/main/java/forge/harness/host/ManaBrewEngineAdapter.java#L64-L76)). Forge baut dabei einen Namensindex über alle 35 237 Karten; die Skripte selbst liest es erst bei Bedarf.
4. Java hinterlegt eine Startfunktion `globalThis.__forgeStartGame` und meldet `forge:ready`.

**Worker und Transport** ([`forge-engine.worker.js`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/packages/forge-wasm/forge-engine.worker.js), [`SabTransport.java`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/native/wasm-src/forge/harness/wasm/SabTransport.java), [`seat.js`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/packages/forge-wasm/seat.js)):
- Der Worker lädt den Launcher per `importScripts`. `__forgeStartGame(json)` **blockiert den Worker für die gesamte Partie** (Worker Z. 161).
- Jeder Sitz hat einen `SharedArrayBuffer` von **256 KiB**: Signalwort, Länge, dann UTF-8-JSON. Die Engine schreibt Zustand und Frage hinein und parkt mit `Atomics.wait` (Z. 60/77). Der Main Thread darf nicht blockieren und fragt den Puffer deshalb per `requestAnimationFrame` ab, antwortet und weckt die Engine mit `Atomics.notify`.
- **Ist eine Nachricht zu groß, wird sie verworfen**, nur ein `System.err`-Log bleibt (Z. 292–299). Die mitgeschickte `promptId` prüft `decodeMessage` nicht.
- Abbrechen geht nur mit `worker.terminate()`. Ein „concede“ wird gepuffert, bis die Engine wieder auf diesen Sitz wartet.
- Vor jeder Frage an einen Menschen geht ein vollständiger Spielzustand (`gameView`) raus. In unseren Messungen waren das 26–63 KB.
- Die Forge-KI als Gegner gibt es nur mit `forgeAi: true`. Standard ist „Manabot“ (Z. 111), ein KI-Profil wird nicht übergeben (`new LobbyPlayerAi(name, null)`).

**Absicherung im ManaBrew-Client:** `createForgeEngine()` bricht ab, wenn `crossOriginIsolated` falsch ist. Der Start hat einen Timeout von 3 min, und pro Engine-Build läuft einmal ein Probespiel ([`forgeWasmValidation.ts`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/src/game/forgeWasmValidation.ts)). Endet ein Probelauf nie („took the page with it“), bleibt Forge-Wasm auf diesem Gerät für diesen Engine-Build aus.

## 4. Forge-Änderungen im ManaBrew-Fork

**Für Wasm nötig** (alle nicht upstream; `ThreadUtil` in `ed0333f` kennt kein „synchronous“):

| Commit | Inhalt |
|---|---|
| [`51b7d50`](https://github.com/witchesofthehill/forge/commit/51b7d50bc87c62f2e935f17eac2b0d5b551bf549) | `ThreadUtil`: Mit `forge.synchronous` laufen `invokeInGameThread`, `limit` und `executeWithTimeout` direkt im aufrufenden Thread, `isGameThread()` gibt `true` zurück. Die KI-Bewertung in `AiController` läuft ebenfalls direkt. **Folge:** `limit()` und `executeWithTimeout()` haben **kein Zeitlimit** mehr. Der LDA-Null-Guard aus demselben Commit wurde mit `a4b37e8` zurückgenommen; stattdessen setzt der Adapter `DECKGEN_CARDBASED=false` |
| [`026be2f`](https://github.com/witchesofthehill/forge/commit/026be2f808cffa77a39e52fb60e90869396164ed) | Kooperative KI-Deadline in `AiController`: Nach jeder geprüften Fähigkeit wird die Uhr gelesen. Ohne das hat im Wasm laut Commit-Text „a game there has no ceiling on how long one decision may take“ |
| `43847a6` | `AiAttackController`: Im Synchronmodus werden die Angriffsaufgaben nacheinander statt im Thread-Pool abgearbeitet |
| `1b515ac`, `5169c6f` | Korrekturen am Lazy Loading (`CardStorageReader`, `StaticData`, `CardDb` sowie Effekte, die Karten per Namen erzeugen, u. a. `MakeCardEffect` und `ChooseCardNameEffect`). Ob upstream ohne diese Korrekturen im Lazy-Modus korrekt läuft, ist **ungeprüft** (siehe Plan, offene Frage 2) |

**Ändert Spielverhalten oder Ausgabe (nicht Teil eines Wasm-Minimums):**
- Obergrenzen gegen außer Kontrolle geratene Partien (Patch 24, `Game.java`): Wird eine Grenze überschritten, **endet die Partie als Unentschieden**. Der Adapter setzt die Grenzen auf 1 000 Karten bzw. 5 000 Trigger pro Zug. `7a5c826` wertet eine Token-Flut ebenfalls als Unentschieden.
- Der Adapter schaltet Forges upstream-Option `PERFORMANCE_MODE` ein. Laut Kommentar überspringt sie den Tap/Untap/Mana-Ersetzungs-Scan außerhalb von Spielfeld und Kommandozone (Card-Forge #11160); ob das in jedem Fall regelneutral ist, ist nicht belegt. `rules.setRenderAbilityText(false)` ist eigener Fork-Code.
- Dazu kommen:
  - Performance-Caches (u. a. `d7334e0`, `dead08d`, `b82be77`),
  - KI-Budgets (`eb1b6f3`, `a6d27b0`),
  - Determinismus-Hooks für den Parity-Harness (`d658cbc`),
  - die Patches 16–23 (vor allem Thread-Sicherheit für mehrere Partien pro Server-JVM, außerdem eine Grenze für Prioritätsschleifen).

## 5. Harte Grenzen von Web Image (Primärquelle `oracle/graal`)

- **Genau ein Java-Thread.** `doStartThread` liefert null ([`WebImageJSJavaThreads.java` Z. 53](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/src/com.oracle.svm.webimage/src/com/oracle/svm/webimage/threads/WebImageJSJavaThreads.java#L53)). `Thread.start0()` und `Thread.sleep()` sind leere Methoden. `Unsafe.park` führt zu `VMError.unimplemented` ([`WebImageJavaLangSubstitutions.java` Z. 184–250](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/src/com.oracle.svm.webimage/src/com/oracle/svm/webimage/substitute/system/WebImageJavaLangSubstitutions.java#L184-L250)). Blockierendes Warten endet in „Cannot block in a single-threaded environment“ ([`WebImageSingleThreadedLockingSupport.java`](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/src/com.oracle.svm.webimage/src/com/oracle/svm/webimage/threads/WebImageSingleThreadedLockingSupport.java)). **Folge:** Executor-Aufgaben laufen nie. `CountDownLatch.await()` und `BlockingQueue.take()` können nur zurückkehren, wenn gar nicht gewartet werden muss; sonst bricht die Engine ab.
- **Wasm-Features:** WasmGC, Exception Handling mit `try_table`/exnref und Typed Function References ([`web-image/README.md`](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/README.md)). Die Option `LegacyExceptions` schaltet auf das ältere `try/catch` um ([`WebImageWasmOptions.java` Z. 45–46](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/src/com.oracle.svm.hosted.webimage/src/com/oracle/svm/hosted/webimage/wasm/WebImageWasmOptions.java#L45-L46)).
- **Standardmäßig still statt laut:** `FatalUnsupportedNodes` steht auf `false`. Nicht unterstützte Compiler-Knoten werden dann zu No-ops mit Platzhalterwert (Z. 62–77). Für eine Regel-Engine ist das ein Korrektheitsrisiko. ManaBrew setzt die Option nicht.
- **JS-Anbindung:** `@JS`-Schnipsel funktionieren; `@JS.Import`/`@JS.Export` sind nicht implementiert ([`web-image-api.md`](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/docs/web-image-api.md)). Java-Funktionen werden deshalb per `globalThis`-Zuweisung exportiert.
- **Laden:** Der Launcher nutzt `WebAssembly.instantiate(ArrayBuffer)` und keine Streaming-API ([`wasm-bootstrap.js` Z. 60–63](https://github.com/oracle/graal/blob/9a8b5489c55f2391200ea328d347a01f4b12df1b/web-image/src/com.oracle.svm.hosted.webimage/src/com/oracle/svm/hosted/webimage/wasm/codegen/runtime/wasm-bootstrap.js#L60-L63)). Chrome legt übersetzten Wasm-Code laut [V8-Blog](https://v8.dev/blog/wasm-code-caching) (2019) aber nur bei `compileStreaming`/`instantiateStreaming` im Cache ab. Gemessen spielt das auf dem Desktop kaum eine Rolle (§6).
- **Nur in Oracle GraalVM enthalten.** Oracle EA `jdk-25i3-25.0.4.1-ea.03` und das GA-Innovation-Release **25.4.4.1.1** (2026-09-22) liefern `lib/svm/tools/svm-wasm/builder/{svm-wasm,svm-wasm-jimfs,svm-wasm-guava,svm-wasm-enterprise}.jar` mit. Die CE `graal-25.4.4.1.1` enthält nur `jmods/org.graalvm.webimage.api.jmod` (beides per Dateiliste der Tarballs geprüft). Laut `release`-Datei von 25.4.4.1.1 besteht Web Image aus `web-image` (offen, `oracle/graal`) und `web-image-enterprise` (geschlossen).
- **Laut ManaBrew-Blog** traten außerdem auf: `java.util.zip` war im benötigten Pfad nicht nutzbar, Java-Deserialisierung konnte die Runtime abstürzen lassen, und Guava wählte eine `Unsafe`-Implementierung (daher `--initialize-at-build-time=com.google.common.util.concurrent`).

## 6. Eigene Messungen (2026-09-24)

**Aufbau:** Gemessen wurde ManaBrews **produktives** Modul (siehe Quellenstand) mit ManaBrews Worker und Launcher (`eb70d0c`). Rechner war odin (Intel i7-8700T; Forge nutzt davon einen Kern). Laufzeitumgebungen:
- Node 22.22.3 (V8 12.4) über ManaBrews Node-Einstieg,
- Chrome for Testing 153 (headless) hinter einem lokalen Server mit COOP/COEP.

Beide Sitze spielte die Forge-KI (`forgeAiSeats: [0,1]`). Als Decks dienten ManaBrews Parity-Decks und die Anvil-Decks (`decks/*.dck`). Die Mess-Skripte liegen nicht im Repo.

| Szenario | Umgebung | bereit nach | Partie | Züge | Spitzen-RSS |
|---|---|---|---|---|---|
| red_burn vs. green_stompy, Seed 42 | Chrome 153 | 3,94 s | 1,39 s | 18 | 1 268 MiB (alle Chrome-Prozesse) |
| dasselbe | Node | 4,66 s | 1,53 s | 18 | 1 064 MiB |
| blue_control vs. black_control, Seed 7 | Node | 4,68 s | 1,97 s | 29 | 1 083 MiB |
| Anvil: Blue/Red- vs. Green/Black-Starterdeck (60/60) | Node | 4,65 s | 2,70 s | 20 | 1 148 MiB |
| Anvil: simic-tempo vs. dimir-ninja | Node | 4,65 s | 3,24 s | 20 | 1 160 MiB |
| Anvil: Commander Y'shtola (Spiegel, 100 Karten, 40 Leben) | Node | 4,64 s | 11,9 s | 23 | 1 318 MiB |
| dasselbe, Seed 42 | Chrome 153 | 3,86 s | 9,2 s | 20 | 1 320 MiB |

- **Start in Chrome aufgeschlüsselt:** `main()` beginnt nach 0,9 s (Laden, Übersetzen, Instanziieren). Das Dateisystem ist nach 2,1 s entpackt (1,2 s). Der Kartenindex ist nach 3,3 s fertig (0,9 s), Forge nach 3,9 s bereit. Ein **zweiter Start** im selben Profil mit HTTP-Cache war kaum schneller: `main()` nach 0,72 statt 0,83 s, bereit nach 3,84–3,88 statt 3,91 s. Die Kosten stecken im Java-Start, nicht im Laden.
- **Ohne COOP/COEP** ist `crossOriginIsolated` falsch. Die Engine bootet trotzdem, die Partie startet danach aber nie: Der Worker kann keinen `SharedArrayBuffer` anlegen. Es kam **keine** Fehlermeldung, erst nach 60 s griff unser Timeout.
- **Determinismus:** Gleicher Seed ergab in Node und Chrome dasselbe Ergebnis (Zug 18, Leben −13/8).
- **Größen des produktiven Moduls:** roh 72 389 554 B (69,0 MiB). Caddy liefert es gzip-komprimiert mit 20 096 911 B aus. `gzip -9` ergibt 18,1 MiB, Brotli (Stufe 11) 11,4 MiB. Zum Vergleich npm 0.2.0: 35,4 MB Code-Modul (8,4 MiB Brotli) plus 36,4 MB separates Kartenarchiv (3,1 MiB Brotli).
- **Grenzen der Messung:** Gemessen wurde auf einem Desktop-x86, headless, ohne Android. Es war ManaBrews Fork mit Performance-Patches und `PERFORMANCE_MODE`; ein Build auf Basis von Forge upstream kann langsamer sein. Es spielte nur KI gegen KI, ohne menschliche Eingaben. Der RSS enthält die Grundlast von Node bzw. Chrome (Node mit Worker: rund 225 MiB vor dem Forge-Start).
- **Fremdwerte zum Vergleich** (nicht nachgemessen, Geräte unbekannt): Laut Blog vergehen im Median 47 ms zwischen Antwort und nächster Frage, davon 16 ms Engine (7 Produktionspartien). Laut [`docs/OBSERVABILITY.md` Z. 131](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/docs/OBSERVABILITY.md#L131) liegt die Denkzeit der Engine bei zwei Sitzen im Median bei 77 ms.

## 7. Unterschiede zur Bible (die Bible bleibt unverändert)

| Thema | Bible | ManaBrew | Folge für OpenMana |
|---|---|---|---|
| Regel-Engine | nur Forge (§2) | Rust-Port als Hauptengine, Forge-Wasm daneben | nur den Forge-Wasm-Weg betrachten |
| Forge-Quelle | „pinned upstream Forge source/submodule“ (§3) | eigener Fork mit Patches, auch verhaltensändernden | upstream-Pin **plus** kleine Patch-Queue ([FORGE_BUILD.md](FORGE_BUILD.md)) |
| Engine-Anbindung | Anvil-Protokoll als Ausgangspunkt (§2, §9) | eigener `PlayerController`, eigenes Protokoll, weicht bewusst von `PlayerControllerHuman` ab (z. B. `chooseCardName`, siehe [`forge-harness/.../AGENTS.md`](https://github.com/witchesofthehill/manabrew/blob/eb70d0cdc48dd18267420ef0cb871264b242815b/forge-harness/src/main/java/forge/harness/AGENTS.md)) | zuerst den Anvil-Weg prüfen ([Plan](OPENMANA_ENGINE_PLAN.md) §3) |
| KI | Forge-KI, Profile wählbar (§7) | Standard „Manabot“, Forge-KI nur mit `forgeAi: true`, kein Profil | Forge-KI fest, Profil durch die Bridge |
| Ausfälle | niemals still (§16) | zu große Nachrichten werden still verworfen; ohne Isolation hängt der Worker | laute Fehler, Feature-Erkennung vor dem Start |
| Android-Verteilung | ORYX-TWA (§12; die damalige Capacitor-Präferenz ist seit 28.9.2026 ersetzt) | Die Tauri-Android-App bündelt weder Forge-Harness noch Forge-Räume (Kommentar in `publish.yml`: „Android hosts no Forge rooms and skips the GraalVM harness“) | siehe Plan §8: `SharedArrayBuffer` fehlt in der Android-WebView |
| Server | kein Odin, kein Server (§2) | Server-Fallback, wenn der Browser nicht reicht | nicht unterstützte Geräte brauchen eine klare Meldung statt eines Fallbacks |

## 8. Was OpenMana davon übernimmt

**Als Technik übernehmen, Code aber selbst schreiben** (ManaBrew-Code ist AGPL, siehe [LICENSES.md](LICENSES.md)):
- Worker plus `SharedArrayBuffer` plus `Atomics.wait` als Blockiermechanismus, COOP/COEP als Pflicht.
- Das Einbetten der Forge-Textdaten ins Modul und das Entpacken ins In-Memory-Dateisystem.
- Die generative Reflection-Config und das Nachpinnen des Wasm-Pfads im Launcher.
- Feature-Erkennung und ein Probelauf pro Engine-Build.

**Übernehmen als GPL-Patch** (aus dem Forge-Fork, GPL-3.0-or-later): die Synchron-Teile aus `51b7d50` (ohne LDA-Guard), außerdem `026be2f` und `43847a6`, jeweils auf den aktuellen upstream-Stand angepasst.

**Nicht übernehmen:**
- den Rust-Port,
- die verhaltensändernden Fork-Patches und Einstellungen (Obergrenzen, die als Unentschieden enden; `PERFORMANCE_MODE`; `renderAbilityText=false`) ohne eigene Prüfung,
- das stille Verwerfen zu großer Nachrichten,
- `@manabrew/forge-wasm` als Produktionsabhängigkeit. Gründe: AGPL, Version vor 1.0, fremder Forge-Pin mit Verhaltens-Patches, Manabot als Standard, und 0.2.0 ist architektonisch veraltet.

**Nur als Messwerkzeug:** Das produktive Modul eignet sich, um Android-Geräte schon zu messen, bevor ein eigener Build existiert. Das Verfahren steht in §6.
