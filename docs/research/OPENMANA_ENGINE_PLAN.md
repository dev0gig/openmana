# OpenMana-Engine: Architekturentscheid

> Research zu Prompt 00, Stand **2026-09-24**. Grundlagen und Quellen:
> [MANABREW_WASM.md](MANABREW_WASM.md), [FORGE_BUILD.md](FORGE_BUILD.md),
> [LICENSES.md](LICENSES.md). Die Bible bleibt unverändert; wo die Ergebnisse von
> ihr abweichen, steht das in §10.

**Ergebnis vorab: Go mit Bedingungen.** Begründung und Bedingungen stehen am Schluss.

## 1. Buildchain

Forge upstream (fester SHA) plus Patch-Queue, dann Maven-Build (Forge-Module + `engine/bridge`), Asset-Bundle, **Oracle GraalVM 25.4.4.1.1 Web Image** mit Binaryen 123, Nacharbeit am Launcher, Tests und schließlich ein Artefakt mit Manifest als Release-Asset. Details in [FORGE_BUILD.md](FORGE_BUILD.md) §3–§5. Kernpunkte:

- **Toolchain:** Oracle GraalVM als GA-Innovation-Release statt EA, Version und Tarball-Hash gepinnt, Tarball archiviert. Die Community Edition hat kein Web Image. Ein Selbstbau aus `oracle/graal` ist ungeprüft (Frage 7).
- **Build-Flags:** wie ManaBrew, zusätzlich `-H:+FatalUnsupportedNodes`. Netzspiel-Klassen bleiben aus dem erreichbaren Code heraus, damit auch jupnp (CDDL) wegfällt.
- **Build-Ort:** GitHub Actions oder odin als Build-Rechner, **nicht** Vercel. Ob ein Runner des privaten Repos (2 vCPU, 8 GB) reicht, ist offen (Frage 4).

## 2. Repo- und Submodule-Struktur

Vorschlag. Er deckt sich mit Bible §3 und ergänzt `patches/`, `protocol/` und eine Lock-Datei.

```
openmana/
├── src/                       # UI. Ein Forge-Update ändert hier nie etwas
├── engine/
│   ├── forge/                 # Submodule → github.com/Card-Forge/forge, voller SHA, shallow
│   ├── patches/               # nummerierte GPL-Patches: Sync-Modus, KI, Input-Pumpe (FORGE_BUILD §4)
│   ├── bridge/                # Maven-Modul (erbt vom Forge-Parent): IGuiBase/IGuiGame, Snapshot,
│   │                          # Fragen, Wasm-Einstieg (@JS), JVM-Tests
│   ├── protocol/              # JSON-Schema: der einzige Vertrag zur UI; TS-Typen werden daraus erzeugt
│   ├── wasm/                  # Asset-Packer, Reflection-Generator, native-image-Aufruf,
│   │                          # Launcher-Nacharbeit, Worker-Host (TS), Smoke-Tests
│   ├── pom.xml                # reiner Reactor-Aggregator: forge + bridge (Muster ManaBrew)
│   └── engine.lock.json       # welche Engine-Version die App ausliefert (Version, SHA-256)
├── cards/
└── docs/
```

- Das Submodule zeigt auf **Card-Forge upstream**. `dev0gig/forge` scheidet aus: Es bleibt nach der Repo-Regel des Projekts Gitea-only und ist von GitHub/Vercel aus nicht erreichbar. ManaBrews Fork scheidet ebenfalls aus, weil er fremden Takt und Verhaltens-Patches mitbrächte.
- Die UI importiert ausschließlich `engine/protocol` (Typen) und den Worker-Host. Sie sieht **keine** Forge-Klassen und keine Forge-Namen.

## 3. Bridge Forge ↔ TypeScript

### 3.1 Schichten

```
UI (Main Thread)
   │  typisierte Nachrichten (aus engine/protocol)
EngineClient (TS, Main Thread): Validierung, Frage-IDs, Watchdog
   │  postMessage ⇄  /  SharedArrayBuffer + Atomics (nur Richtung UI → Engine)
Worker-Host (TS, Dedicated Worker): lädt engine.js, reicht durch
   │  @JS-Aufrufe
Bridge (Java, im Wasm): IGuiBase/IGuiGame → Fragen/Snapshots/Ereignisse
   │
Forge (Java, im Wasm): PlayerControllerHuman + Inputs, Forge-KI, Regeln
```

### 3.2 Protokoll: Anvil v1 als Vertrag, ohne WebSocket

Die Semantik von [`PROTOKOLL.md`](https://github.com/dev0gig/anvil/blob/7c97fbb0161ad26ddfbb31bf4e723925fc917d24/PROTOKOLL.md) trägt weiter. Die exakten Feldnamen legt das Schema im ersten Bridge-Schritt fest.

- **Bleibt:**
  - vollständige Snapshots statt Deltas (26–63 KB je Stand gemessen, per `postMessage` unkritisch);
  - nummerierte Fragen mit acht Arten (tippen, Karten, Knöpfe mit `anlass`, Ja/Nein, Optionen, Zahl, Ordnen, Verteilen) und `frage.weg`;
  - „Karte antippen“ **außerhalb** einer Frage, denn so wird bei Priorität gespielt;
  - `spielbar`, `aktion` und `hervorgehoben` aus Forge;
  - APINA (`YIELD_AUTO_PASS_NO_ACTIONS`), `kannHandeln`;
  - Ereignisse aus Forges `GameLog` (Stufe MEDIUM, mit `wer`) **vor** dem Snapshot, der sie erklärt;
  - Sichtbarkeit über Forges `mayView()`;
  - Spielende aus Sicht des Spielers.
- **Entfällt:** `hallo`/`willkommen`-Reconnect, `abgeloest`, Serverdateien (`decks`, `logs`, `log.holen`), `forge.pruefen`/`forge.aktualisieren` (Updates kommen als App-Release) und `voll: true`.
- **Neu:**
  - `ready` mit Protokoll-, Forge- und Engine-Build-Version; eine inkompatible Version wird **laut** abgelehnt;
  - Deckübergabe aus IndexedDB beim Partiestart (Main, Sideboard, Commander; englische Namen, bei doppelseitigen Karten die Vorderseite, Set/Nummer optional) samt **Importbericht** für nicht auflösbare Karten;
  - ein ausdrücklicher **technischer Abbruch**, getrennt vom Spielergebnis.

### 3.3 Java-Seite: Anvil-Weg (Option A) vor eigenem Controller (Option B)

**Empfehlung: A**, abgesichert durch den Spike aus Frage 1.
- **Für A spricht:** Forges eigener Mensch-Pfad (`PlayerControllerHuman` samt Inputs für Mulligan, Priorität, Kosten, Ziele, Angriff und Block) bleibt Regelautorität. Genau diesen Pfad fährt Anvil headless schon produktiv; EDT-Aufrufe laufen dort direkt im aufrufenden Thread, und `isGuiThread()` ist `false`.
- **Gegen B:** Option B hieße ManaBrews Muster: ein eigener `PlayerController` mit eigener Kostenzahlung. Bei ManaBrew sind das rund 8 000 Zeilen (Controller 2 830, Session 3 024, AutoPay 645, Kosten- und Spiel-Plumbing 1 453), die an einigen Stellen bewusst von Forge abweichen. Das widerspricht Bible §2 und bleibt deshalb nur der Rückfall.

Was sich an `forge-anvil` (`dev0gig/forge@745f26d`) für den Einzel-Thread ändern muss:

| heute (JVM-Dienst) | im Wasm |
|---|---|
| `AnvilServer` (Netty-WebSocket), `AnvilSitzung` (Executor, `ProcessBuilder`, Dateien) | entfällt; Einstieg ist eine `@JS`-exportierte Startfunktion im Worker. Decks kommen als JSON |
| `fragenUndWarten()` mit `ArrayBlockingQueue.take()` | `host.awaitInput()`: blockiert per `Atomics.wait`, bis die Antwort mit **dieser** Frage-ID kommt; andere Eingaben (Antippen, Snapshot-Wunsch) werden unterwegs abgearbeitet |
| Knopf- und Auswahlfragen, die ein **anderer** Thread per `selectButtonOk`/`selectCard` beantwortet | **Input-Pumpe** in `InputSyncronizedBase.awaitLatchRelease()` (Patch 4): Eingaben lesen und auf demselben Thread an Forge geben, bis `stop()` den Latch löst. Verschachtelte Inputs (Ziele und Kosten während eines Zaubers) laufen rekursiv auf demselben Stack |
| `antwortDienst`, Zustands-Takt 120 ms (`ScheduledExecutorService`) | entfallen. Der Snapshot geht vor jedem Blockieren raus, dazu während KI-Zügen gedrosselt aus Forges `update*`-Rückrufen, mit Zeitvergleich statt Timer |
| `AnvilGuiBase.runBackgroundTask` → neuer Thread | direkt ausführen (ein neuer Thread liefe im Wasm nie) |
| `AnvilZustand` (Snapshot), Frage-Umformung, `anlass`-Erkennung, `wer` | **weiterverwendbar**: reine Datenumformung ohne Threads |
| `AnvilLog` (Dateien) | entfällt; der Verlauf läuft über das Protokoll, eine Mitschrift kann die UI in IndexedDB schreiben |

Die Bridge läuft **identisch auf der JVM**, im Synchronmodus mit einem Test-Host statt `Atomics`. So sind Protokolltests schnell und ohne Wasm-Build möglich, und derselbe Code wird im Differenztest JVM gegen Wasm geprüft.

### 3.4 Transport und Fehlerverhalten

- **Engine → UI per `postMessage`** aus einem `@JS`-Schnipsel. Das blockiert nicht und braucht kein Polling. Auch aus einem rechnenden Worker kommen die Nachrichten sofort beim Main Thread an; das haben wir mit ManaBrews Log-Nachrichten gemessen. So gibt es keine feste 256-KiB-Grenze wie bei ManaBrews Puffer, und nichts wird still verworfen.
- **UI → Engine** über einen kleinen `SharedArrayBuffer` als Eingabewarteschlange (Länge + UTF-8 je Nachricht, Lese- und Schreibzeiger, `Atomics.notify`). Die Engine liest nur dann, wenn sie wartet. Ist die Warteschlange voll, schlägt das in der UI **laut** fehl.
- **Frage-IDs prüft die Bridge.** Eine Antwort auf eine inzwischen zurückgezogene Frage wird nicht ausgeführt; das kommt im Alltag vor, weil Forge Fragen zurückzieht. Die UI erfährt davon, damit nichts still verschwindet (Bible §16). Eine formal ungültige Antwort wird laut gemeldet (Bible §9.5). ManaBrew prüft die `promptId` nicht.
- **Kein Timeout** für den Menschen und **keine automatische Antwort** auf echte Entscheidungen. Stattdessen ein Watchdog in der UI: Meldet sich die Engine zu lange nicht, erscheint „Engine reagiert nicht“ mit dem Angebot eines Neustarts.
- **Aufgeben** wird bei der nächsten Eingabewartung ausgeführt. **Abbrechen** heißt `worker.terminate()` und erscheint als technischer Abbruch. Die KI hat nur eine kooperative Zeitgrenze (Patch 2); eine einzelne sehr lange Bewertung kann sie überschreiten.

## 4. Worker oder Main Thread

**Forge läuft immer in einem Dedicated Worker.**
- Im Main Thread verbietet der Browser `Atomics.wait` ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait): TypeError „because it's the main thread“).
- Eine Partie läuft synchron am Stück in einer Funktion, und KI-Züge rechnen Sekunden. Im Main Thread wäre die Oberfläche so lange eingefroren.

Der Main Thread hält UI, IndexedDB und Scryfall-Zugriffe und blockiert nie. Es läuft **ein** Worker mit rund 1 GB Speicher; zwei gleichzeitig sind auf Handys zu teuer.
- Der Start kostet rund 4 s (Desktop). Er beginnt deshalb vorgewärmt, sobald die Deckauswahl offen ist.
- **Vorerst ein frischer Worker pro Partie:** sauberer statischer Forge-Zustand, dafür erneut rund 4 s. Ein Wiederverwenden mit Reset (wie ManaBrews `ForgeEngineReset`) kommt erst nach eigenem Test infrage.

## 5. Ressourcen und Kartenskripte

- **Ins Modul eingebettet** wird die Textauswahl aus [FORGE_BUILD.md](FORGE_BUILD.md) §2: das ganze `cardsfolder`, dazu `tokenscripts`, `editions`, `blockdata`, `lists`, `formats`, `defaults`, `effects`, `ai` und die Sprachdateien. Kein Deckfilter, Originalpfade. Engine und Daten entstehen aus demselben Forge-Pin und bleiben ein Artefakt (roh ~69 MiB, Brotli ~11,4 MiB, gemessen am ManaBrew-Modul).
- **Einstellungen** setzt die Bridge im `adjustPrefs`-Callback von `FModel.initialize`: APINA, `UI_SHOW_ACTIONABLE_HIGHLIGHTS`, `DECKGEN_CARDBASED=false`, Sprache. `LOAD_CARD_SCRIPTS_LAZILY` hängt an Frage 2.
- **Sprache:** Schlüssel bleiben immer englisch (`oracleName` für die Scryfall-Zuordnung, Anvil-Lehre). Deutsche Forge-Texte für Fragen und Verlauf sind billig (`de-DE.properties`, `cardnames-de-DE.txt`), brauchen aber Anvils Lückenkorrekturen als Patch oder upstream. Die Anzeige von Karten (Name, Bild) kommt aus Scryfall.
- **KI-Profile** kommen aus `res/ai/*.ai`. Die Bridge setzt den Gegner fest auf Forge-KI und übergibt das Profil über `GamePlayerUtil.createAiPlayer(name, avatar, profile)`, wie Anvil.

## 6. Updatepfad

Wie in [FORGE_BUILD.md](FORGE_BUILD.md) §6:
1. Ein eigener PR ändert nur `engine/**`.
2. CI baut von Grund auf neu.
3. JVM-Bridge-Tests, Differenztest JVM gegen Wasm, Smoke-Partien in Node und Chrome.
4. Schema-Diff und Pfadprüfung: `src/` bleibt unberührt.
5. App-Build mit unverändertem UI-Code.
6. Neues `engine.lock.json` erst nach grünen Tests.

Die App zeigt Engine- und Forge-Version an (Bible Phase 5). GraalVM-Updates laufen als eigene PR-Art.

## 7. Vercel/PWA-Auslieferung

- **Weg ins Deployment:** CI legt das Engine-Artefakt als Release-Asset ab. Der Vercel-Build lädt die in `engine.lock.json` gepinnte Version (bei privatem Repo mit Token), prüft den SHA-256 und legt sie unter `/engine/<sha>/…` ab. Die Alternative `vercel deploy --prebuilt` stößt an die CLI-Uploadgrenze: 100 MB bei Hobby, 1 GB bei Pro ([Limits](https://vercel.com/docs/limits)); das Artefakt allein hat ~72 MB.
- **Header** über `vercel.json` für **alle** Routen: `Cross-Origin-Opener-Policy: same-origin` und `Cross-Origin-Embedder-Policy: require-corp`. Hash-Pfade bekommen `Cache-Control: public, max-age=31536000, immutable`; HTML und Service Worker werden revalidiert.
- **Kompression:** Vercel komprimiert `application/wasm` automatisch mit gzip oder Brotli ([Compression](https://vercel.com/docs/how-vercel-cdn-works/compression)). Zu erwarten sind 11–20 MB über die Leitung, je nach Stufe.
- **CDN-Cache:** Statische Dateien werden laut Doku „automatically cached … for the lifetime of the deployment“. Die allgemeinen Kriterien nennen aber „Response doesn't exceed 10MB“ ([CDN Cache](https://vercel.com/docs/caching/cdn-cache)). Ob eine ~70-MB-Datei am Edge liegt, klärt ein Test (Frage 6). Funktionieren würde die Auslieferung so oder so.
- **Folgen von COEP** (belegt am 2026-09-24): `api.scryfall.com` und `cards.scryfall.io` senden `Access-Control-Allow-Origin: *`, aber **kein** `Cross-Origin-Resource-Policy`. Bilder müssen deshalb im CORS-Modus laden (`crossorigin="anonymous"` bzw. `fetch` mit `mode: "cors"`). CSS-`url()` auf fremde Hosts geht nicht; dafür erst per `fetch` holen und als Blob einbinden. `COEP: credentialless` würde das entschärfen, fehlt aber in Safari.
- **Service Worker:**
  - Ein Engine-Satz (Worker, Launcher, Wasm) wird erst aktiv, wenn er vollständig geladen und per Hash geprüft ist.
  - Vom Service Worker gelieferte Antworten behalten COOP/COEP. Sonst ist `crossOriginIsolated` offline falsch und die Engine startet nicht.
  - Die alte Version bleibt, bis keine Partie sie mehr nutzt (etwa 70 MB je Version im Cache Storage). `navigator.storage.persist()` anfragen und bei geleertem Speicher sichtbar neu laden.
- **Pflicht vor jedem Start:** Feature-Erkennung (`crossOriginIsolated`, `SharedArrayBuffer`, WasmGC, exnref) mit klarer Meldung. Ohne Isolation hing im Test die Partie still (60 s). OpenMana hat keinen Server-Rückfall.

## 8. Android-Browser und Foldable

- **Mindestversionen** (MDN-Kompatibilitätsdaten, nicht auf Geräten getestet):
  - WasmGC: Chrome 119, Firefox 120, Safari 18.2.
  - Exception Handling mit exnref: **Chrome 137, Firefox 131, Safari 18.4**.
  - `SharedArrayBuffer` mit Isolation: Chrome Android 89.
  - **Samsung Internet ≥ 30** (Blink 143); Version 29 ist Blink 136 und damit zu alt für exnref.
  - Mit `-H:+LegacyExceptions` würden Chromium 119 bzw. Samsung Internet 25 reichen. Das lohnt sich nur, wenn ältere Geräte nötig werden.
- **Speicher:** Spitze 1,1–1,3 GB im Desktop-Test ([MANABREW_WASM.md](MANABREW_WASM.md) §6), mit Commander am oberen Ende. Für Forges eigene Android-App nennt das Forge-README „at least 6GB RAM to run smoothly“. Auf dem Fold7 (12 GB) ist das plausibel, gemessen ist es nicht. Auf kleinen Geräten droht, dass Android den Tab beendet. iOS ist ungetestet; ManaBrew schließt es aus.
- **Rechenzeit:** Desktop-Start 3,9 s, KI-Zug im Standardformat meist Bruchteile einer Sekunde. Es gibt nur einen Thread, also keine parallele KI. Android-Werte fehlen (Frage 5).
- **Hintergrund:** Android friert Tabs im Hintergrund ein oder verwirft sie. Damit ist der Worker und die Partie weg. Einen Reload überlebt nichts.
  - **Empfehlung v1:** Reload beendet die Partie, mit Warnung vor dem Verlassen und sichtbarer Meldung.
  - Forges `GameState` (`initFromGame`/`applyToGame`, Puzzle-Format) wäre später eine **näherungsweise** Wiederaufnahme; Stapel, Trigger und laufende Effekte deckt sie nicht sicher ab.
- **Foldable:** Im Browser löst Falten nur ein Resize aus, die Engine merkt davon nichts. Das Layout-Risiko gehört der UI (Lehre aus ManaStokkr).
- **Wrapper:** Die Android System WebView hat **keinen** `SharedArrayBuffer` (MDN BCD `webview_android: false`; [Chromium-Issue 40914606](https://issues.chromium.org/issues/40914606), „SharedArrayBuffer is unavailable in Android WebView because crossOriginIsolated is false“). Ein Capacitor-Wrapper (Bible §12) kann diese Bridge deshalb **nicht** tragen. Passend wären eine Trusted Web Activity (Bubblewrap) oder eine installierte PWA (WebAPK); beide laufen in Chrome selbst (Frage 8).

## 9. Bekannte Risiken

| # | Risiko | Gegenmaßnahme |
|---|---|---|
| R1 | Web Image ist „experimental“, gibt es nur in Oracle-Binärdistributionen und wird monatlich abgelöst | Toolchain pinnen und archivieren; Updates als eigene PR-Art; Differenztest |
| R2 | Lizenzlage des Outputs (GFTC gegenüber GPL) ungeklärt | Lizenz-Gate vor öffentlicher Auslieferung ([LICENSES.md](LICENSES.md) §3.4) |
| R3 | Nötige Forge-Patches sind nicht upstream; die KI-Dateien ändern sich etwa wöchentlich | kleine Patch-Queue, `git apply --check`, Synchronmodus upstream vorschlagen |
| R4 | Der Anvil-Pfad im Einzel-Thread ist unbewiesen | Spike (Frage 1), Rückfall Option B |
| R5 | Lazy Loading und namentlich erzeugte Karten | Frage 2 |
| R6 | Stille Fehlübersetzung (`FatalUnsupportedNodes` ist standardmäßig aus) oder JDK-Pfade, die erst zur Laufzeit scheitern | Flag einschalten, Differenztest, Engine-Fehler laut anzeigen |
| R7 | Speicherbedarf 1,1–1,3 GB, Hintergrund-Discard, keine Wiederaufnahme | Gerätetest (Frage 5), Reload-Verhalten ehrlich anzeigen |
| R8 | Kein Server-Rückfall: nicht unterstützte Browser können nicht spielen | Feature-Erkennung mit klarer Meldung |
| R9 | COEP erzwingt CORS für jede fremde Ressource | Regel für die UI-Umsetzung (Scryfall erfüllt sie) |
| R10 | Vercel: großes Artefakt, Cache-Kriterium 10 MB, CLI-Uploadgrenze | Frage 6; notfalls Code und Daten trennen oder vorkomprimieren |
| R11 | Keine WebView-Wrapper möglich | TWA/WebAPK (Frage 8) |
| R12 | Die CI-Ressourcen des privaten Repos könnten für `native-image` nicht reichen | Frage 4 |
| R13 | jupnp (CDDL) im Modul | Netzspiel aus der Erreichbarkeit nehmen, Nachweis im Build-Report |

## 10. Abweichungen von der Bible (nicht still geändert, bewusst zu entscheiden)

1. **§3 „pinned upstream Forge“:** Das reicht nicht. Nötig ist upstream **plus** eine GPL-Patch-Queue (Synchronmodus, KI, Input-Pumpe).
2. **§2 „proven direction demonstrated by ManaBrew“:** Die Richtung ist belegt. ManaBrews Browser-Forge ist aber als experimentell markiert, läuft auf einem gepatchten Fork und hat einen Server-Rückfall, den OpenMana nicht hat.
3. **§12 „preferably Capacitor“:** Mit dieser Architektur nicht tragfähig, weil der WebView der `SharedArrayBuffer` fehlt. Stattdessen TWA oder WebAPK.
4. **§4/§17 Bilder und Assets:** Unter COEP müssen fremde Ressourcen im CORS-Modus geladen werden.
5. **§9.6 Reload:** Vorschlag für v1: Ein Reload beendet die Partie, klar angezeigt.
6. **§19.1 „modern browser“:** Das wird zu konkreten Mindestversionen, siehe §8.

## Offene Fragen vor Implementierung

Nur Fragen, die diese Research nicht beantworten konnte.

| # | Offene technische Frage | Klärt | Bis wann |
|---|---|---|---|
| 1 | Läuft Forges Mensch-Pfad (`PlayerControllerHuman` + Inputs) im Einzel-Thread mit der Input-Pumpe (Patch 4) für Mulligan, Priorität/Antippen, Kosten, Ziele, Angriff/Block und Commander-Wahl? | Engine-Spike: upstream-Pin + Patches + Bridge, eine volle Partie gegen Forge-KI in Chrome | vor der Bridge-Umsetzung (entscheidet Option A oder B) |
| 2 | Spielt Forges upstream-Lazy-Loading Karten korrekt, die per Namen entstehen (z. B. `MakeCard`, `ChooseCardName`)? Oder braucht es ManaBrews Fixes `1b515ac`/`5169c6f` bzw. Eager-Loading, und was kostet Eager-Loading im Wasm an Start und Speicher? | gezielte Testkarten im Spike, Messung beider Modi | vor dem Einfrieren der Patch-Queue |
| 3 | Kompiliert Web Image Forge verhaltensgleich? | Differenztest JVM gegen Wasm (gleicher Seed, skriptierte Antworten) mit `-H:+FatalUnsupportedNodes` | Teil des Spikes |
| 4 | Reicht ein Runner des privaten Repos (2 vCPU, 8 GB) für `native-image --tool:svm-wasm` auf Forge, und wie lange dauert es? | Build messen (Spitzen-RAM, Dauer) | vor dem CI-Aufbau |
| 5 | Start, Speicher, KI-Zeit und Tab-Verwerfen auf dem Fold7 (Chrome und Samsung Internet ≥ 30), auch bei Commander? | Messung wie in [MANABREW_WASM.md](MANABREW_WASM.md) §6 auf dem Gerät: sofort mit ManaBrews produktivem Modul möglich, später mit dem eigenen | bevor „Handy unterstützt“ zugesagt wird |
| 6 | Liefert Vercel das ~70-MB-Wasm mit COOP/COEP, Kompression und Edge-Cache aus, und welcher Deploy-Weg passt zum Plan (Hobby/Pro)? | Preview-Deploy mit dem Artefakt; `x-vercel-cache`, `content-encoding`, `crossOriginIsolated` prüfen | vor dem ersten Deploy |
| 7 | Lässt sich Web Image aus `oracle/graal` (GPLv2 mit Classpath Exception) ohne `web-image-enterprise` bauen, und funktioniert es für Forge? | Build-Versuch mit `mx` | nur falls der Oracle-GFTC-Weg für die öffentliche Auslieferung abgelehnt wird |
| 8 | Stellt eine TWA (Bubblewrap) oder WebAPK auf dem Fold7 `crossOriginIsolated` und `SharedArrayBuffer` bereit? | Test-APK über Warehouse installieren | vor Phase 5 (Android-Artefakt) |

## Entscheidung: **Go mit Bedingungen**

**Warum nicht „Blockiert“:**
- Forge läuft nachweislich als Wasm im Browser. ManaBrew spielt damit produktiv „Play vs AI“.
- Wir haben dasselbe produktive Modul selbst betrieben. In Chrome 153 startet es in rund 3,9 s und spielt komplette KI-Partien, auch Commander mit den Anvil-Decks, bei 1,1–1,3 GB Spitzenspeicher.
- Die Buildkette ist in ManaBrews CI belegt, mit Oracle GraalVM EA 25.3.4.1-dev (Tag `jdk-25i3-25.0.4.1-ea.03`). Das GA-Release 25.4.4.1.1 enthält dasselbe Backend. Forge-Patches, Transport (Worker, `SharedArrayBuffer`, `Atomics`) und Auslieferung sind konkret beschrieben.
- Jede offene Frage hat einen konkreten Prüfweg. Für die kritischen gibt es einen Rückfall:
  - Frage 1: Option B;
  - Frage 2: ManaBrews Fixes oder Eager-Loading;
  - Frage 4: Build auf odin oder in einem öffentlichen Repo;
  - Frage 6: ein anderer statischer Host mit eigenen Headern;
  - Frage 8: die installierte PWA ohne Wrapper.

**Warum nicht „Go“ ohne Bedingungen:**
- Die Toolchain ist experimentell und nur als Oracle-Binärdistribution verfügbar.
- Forge upstream braucht Patches.
- Der Anvil-Pfad ist im Einzel-Thread unbewiesen.
- Geräte-, Auslieferungs- und Lizenzfragen sind nur per Messung bzw. Prüfung zu schließen.

**Bedingungen:**
1. **Erster Implementierungsschritt ist der Engine-Spike** (Fragen 1–3), noch ohne UI: upstream-Pin, Patch-Queue und eigene Bridge in einem Worker, eine volle Partie gegen Forge-KI in Chrome, Differenztest JVM gegen Wasm. Scheitert Option A, gilt Option B. UI-Arbeit auf der Engine beginnt erst nach dem Spike.
2. **Build-Ressourcen klären** (Frage 4), bevor die CI aufgebaut wird.
3. **Gerätetest auf dem Fold7** (Frage 5), bevor mobile Unterstützung zugesagt wird.
4. **Vor dem ersten öffentlichen Deploy:**
   - Vercel-Test (Frage 6);
   - Lizenz-Gate: GPL-Pflichten umgesetzt, GFTC-Frage entschieden, jupnp nachweislich nicht im Modul ([LICENSES.md](LICENSES.md) §4).
5. **Android-Wrapper nicht über Capacitor/WebView.** Vor Phase 5 TWA bzw. WebAPK prüfen (Frage 8).
