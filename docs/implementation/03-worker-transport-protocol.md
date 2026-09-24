# 03 — Worker-Transport und Protokoll

> Umsetzung von [`prompts/queue/03-worker-transport-protocol.md`](../../prompts/queue/03-worker-transport-protocol.md),
> Stand **2026-09-24**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `1e8febf` (sauberer Build, `engineSourcesModified=false`). Grundlage:
> [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md) §3.2–§3.4, §4, §7
> und das Spike-Protokoll aus [`02-anvil-bridge.md`](02-anvil-bridge.md) §3.
> Code: [`engine/protocol/`](../../engine/protocol/README.md) (Vertrag),
> [`engine/client/`](../../engine/client/src/engine-client.ts) (Main Thread),
> [`engine/wasm/host/`](../../engine/wasm/host/worker-host.ts) (Worker), Bridge-Änderungen in
> `engine/bridge/…/bridge/`. Alle Zahlen sind eigene Messungen auf odin (Intel i7-8700T,
> 12 Threads, 15,5 GiB RAM, Debian 13), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 03 ist umgesetzt.** Zwischen Oberfläche und Engine gibt es jetzt genau
einen Vertrag: das JSON-Schema in `engine/protocol` (Protokollversion **1**).
Daraus entstehen TypeScript-Typen, Konstanten und vorkompilierte Prüfer; ein
Build mit veralteten erzeugten Dateien bricht ab, und ein Vertragstest hält die
Java-Bridge mit dem Schema in Deckung. Engine → UI läuft per `postMessage`,
UI → Engine über die in der Research beschriebene SharedArrayBuffer-Warteschlange,
jetzt als Ringpuffer mit Längenpräfix, der bei Überlauf laut ablehnt. Der neue
`EngineClient` prüft Browser und Protokollversion, **bevor** die ~70-MB-Engine
geladen wird, prüft jede Nachricht der Engine gegen Schema und Reihenfolge,
führt Buch über offene Fragen und kennt `engine.ready`, `engine.error` und den
technischen Abbruch `engine.abort`.

**Nachweis:** Die vier Mensch-gegen-KI-Partien aus Prompt 02 ergeben auf der JVM
mit dem neuen Protokoll **bitgleich dasselbe Forge-Spielprotokoll** wie vorher
(Forges Spiel ist unberührt). Ihre Aufzeichnungen laufen in Node und Chrome über
den echten Client und die Warteschlange **exakt gleich** zu Ende wie auf der JVM,
einmal eine Eingabe je Warten und einmal mit einer 256-Byte-Warteschlange, die
dabei 3- bis 11-mal über ihr Ende läuft und 2- bis 11-mal voll ist. Bei jeder der
164 Eingaben der langsamen Läufe (je Laufzeit, Node und Chrome) urteilen Client und Engine gleich: was
der Client durchlässt, lehnt die Engine nie aus einem Grund ab, den der Client
hätte kennen können, und was er ablehnt (Antwort auf eine zurückgezogene oder
unbekannte Frage, ungültiger Knopf, unbekannte Karte, Antippen während einer
blockierenden Frage), lehnt die Engine aus demselben Grund ab. Jede der
986 Nachrichten der JVM-Partien und jede Nachricht der Wasm-Partien
entspricht dem Schema; jeder Zustand ist in sich vollständig. Die Fehlerpfade
(falsche Version, abgelehntes Deck, Abbruch mitten in der Partie, kaputte
Nummerierung, Browser ohne Isolation) enden laut und schnell, nie in einem Hänger.

Forge bleibt die alleinige Regelautorität. TypeScript enthält keine Magic-Regel;
ein Wächtertest schlägt an, sobald Client, Protokoll-Code oder Worker-Host auf
Phasen, Knopf-Anlässe oder Karteneigenschaften zugreifen.

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Schema | `engine/protocol/schema/protocol.schema.json` | JSON Schema 2020-12: `EngineMessage` (16 Typen), `EngineInput` (5), `WorkerCommand` (3), alle Teile (Zustand, Karte, Frage je Art …); doppelt diskriminierte Unions (`type`, dann `kind`) |
| Generator | `engine/protocol/scripts/generate.mjs` | json-schema-to-typescript → `generated/protocol.ts`, Konstanten → `constants.ts` (Version, jede Aufzählung als Liste), Ajv 8 standalone → `validators.js` (+ `.d.ts`); `--check` scheitert bei veralteten Dateien |
| Laufzeitprüfung | `engine/protocol/src/validate.ts` | `check…` werfen `ProtocolViolation` mit JSON-Pfad und Grund |
| Warteschlange | `engine/protocol/src/input-queue.ts` | SPSC-Ringpuffer auf SharedArrayBuffer: Kopf mit Magic/Layout/Kapazität/Positionen/Zählern, Einträge mit Längenpräfix, Umbruch am Ende, `full`/`too-large`/`corrupt`/`layout` laut |
| Feature-Erkennung | `engine/protocol/src/features.ts` | Wasm GC, exnref, typisierte Funktionsreferenzen (Probemodule), Worker, SharedArrayBuffer, `Atomics.wait`, `crossOriginIsolated` |
| Client | `engine/client/src/` | `EngineClient` (Start, Prüfung, Buchführung, Eingaben, Watchdog, Abbruch), `browserWorkerPort`, `nodeWorkerPort`, `EngineInputError`/`EngineClientError` |
| Worker-Host | `engine/wasm/host/worker-host.ts` + `engine-worker.ts` (Browser) + `node-engine-worker.ts` (Node) | Startreihenfolge mit Prüfungen, Übersetzung der Java-Meldungen, Eingaben aus der Warteschlange, `engine.waiting`, Fehler → `engine.error`/`engine.abort` |
| Bundles | `engine/scripts/bundle-host.mjs` | esbuild: `build/dist/engine-worker.js` (klassisches Worker-Skript, Teil der Engine-Artefakte), `build/harness/spike.js` (Diagnoseseite) |
| Bridge | `Protocol.java`, `BridgeGuiGame`, `StateBuilder`, `Answers`, `HumanMatch`, `WasmMain`, `WasmEngineHost`, `EngineBoot` | Protokoll 1 (§4) |
| Testwerkzeug | `ScriptedHuman`, `JvmHumanMatchMain --messages`, `engine/wasm/spike/replay.ts`, `invariants.ts`, `wasm/test/*.ts` | Aufzeichnung v2, Wiederholung über den Client (lazy/eager), Schnappschuss-Invarianten, Schemaprüfung der JVM-Ausgabe, Fehlerpfade gegen die echte Engine |
| Build | `engine/scripts/build-host.sh` (neu, erster Schritt von `build.sh`), `test-engine.sh`, `write-manifest.mjs` | Schema-Frische, `tsc`, Unit-Tests, Bundles; Manifest mit Worker und Protokollversion |
| npm-Paket | `engine/package.json` (vorher `engine/wasm/package.json`) | typescript 7.0.2, esbuild 0.28.2, ajv 8.20.0, json-schema-to-typescript 16.0.0, @types/node 22.20.4, playwright-core 1.63.0 (alle fest gepinnt) |

Die Einzelheiten des Vertrags (Nachrichten, Fragen, Fehlerarten, Warteschlange,
Versionsregel) stehen in [`engine/protocol/README.md`](../../engine/protocol/README.md);
dieses Dokument hält fest, was gebaut, wie es geprüft und was dabei gefunden wurde.

## 2. Ablauf eines Starts und einer Partie

```
Seite (EngineClient)                          Worker (worker-host.ts)                 Java (Bridge, Forge)
new EngineClient(…).start()
  Feature-Erkennung (Main Thread) ──nein──▶ engine.abort unsupported-browser, kein Worker
  createInputQueue(64 KiB)
  new Worker(engine-worker.js)
  engine.start {protocol:1, queue, …} ──────▶ protocol ≠ 1 ? ──▶ engine.abort protocol-mismatch (≈ 70–90 ms)
                                               Schema, Features, Queue-Kopf prüfen
                                    ◀──────── engine.boot worker-features / launcher-load
                                               importScripts(openmana-engine.js)
                                    ◀──────── engine.boot wasm-fetch-compile
                                                                                     main(): Forge entpacken, FModel
                                    ◀──────── engine.boot java-main ◀──────────────── emit("boot")
                                    ◀──────── engine.ready {protocol, engine, boot} ◀ emit("ready") (Host prüft protocol)
  Protokoll prüfen, Status ready
startMatch(request) ─ Schema ─▶ match.start ─▶ callEngine({command: human-match, …}) ─▶ HumanMatch.play (synchron bis Spielende)
                                    ◀──────── game.started, state, question … ◀─────── host.emit
                                               awaitInput(): Warteschlange leer?
                                    ◀──────── engine.waiting {consumed}                 Forge wartet in Atomics.wait
answer()/tapCard() … ─ Prüfungen ─▶ Ringpuffer ─ Atomics.notify ─▶ read() ──────────▶ nextInput(): seq prüfen
                                    ◀──────── question.answered / input.rejected / …
                                    ◀──────── game.end
                                    ◀──────── match.finished {summary}   ◀──────────── Rückgabe von play()
```

Befehle (`engine.start`, `match.start`) wirken nur, wenn der Worker frei ist;
während der Partie steckt er in Forges Java-Stack und liest ausschließlich die
Warteschlange. Ein abgelehntes Deck oder eine formal falsche Anfrage beendet den
Befehl mit `engine.error`, bevor Forge die Partie beginnt; derselbe Worker nimmt
danach eine neue Partie an. Alles nach `game.started` ist bei einem Fehler ein
technischer Abbruch.

## 3. Warteschlange und Worker-Host

- **Form:** ein Schreiber (Seite), ein Leser (Worker). Kopf aus 8 Int32 (Magic
  `OMQU`, Layout 1, Kapazität als Zweierpotenz, Schreib- und Leseposition in Bytes,
  Zähler geschriebener und gelesener Einträge), dahinter der Ring. Ein Eintrag ist
  4 Byte Länge + UTF-8-JSON und darf über das Ringende laufen. Veröffentlicht wird
  mit `Atomics.store` der Schreibposition **nach** dem Kopieren; der Leser sieht die
  Bytes nach seinem `Atomics.load` (JavaScripts Speichermodell).
- **Laut statt verloren:** Passt eine Eingabe nicht, schreibt `write()` nichts und
  wirft `full`; der Client macht daraus `EngineInputError("queue-full")`. Eine
  Eingabe, die nie passen könnte, ist `too-large`. Falsches Magic, falsches Layout
  oder unstimmige Positionen weigert der Leser (`layout`, `corrupt`) → `transport-error`.
- **Warten nur bei leerer Warteschlange:** `awaitInput()` nimmt die nächste Eingabe;
  ist keine da, meldet der Host `engine.waiting {consumed}` und blockiert erst dann
  in `Atomics.wait`. Die Seite muss also nicht mehr auf eine Aufforderung warten
  (Prompt 02: `input.wait` + genau ein `write()`), sondern darf jederzeit schreiben.
- **Ein Code für Browser und Node:** Der Worker-Host ist TypeScript. Der Browser
  bekommt ihn als esbuild-Bundle (klassisches Worker-Skript, weil der GraalVM-Launcher
  per `importScripts` lädt); Node führt dieselben Quellen direkt aus (Type Stripping).

## 4. Bridge: was sich für Protokoll 1 geändert hat

| Änderung | Warum |
|---|---|
| `seq` an jeder Eingabe, streng 1, 2, 3 …; sonst `IllegalStateException` → `engine.abort engine-failure` | Eine verlorene, doppelte oder vertauschte Eingabe darf keine Partie auf falscher Grundlage weiterlaufen lassen |
| `input.rejected.seq` | Die UI ordnet die Ablehnung der Aktion zu, die sie ausgelöst hat |
| `kind` in jeder Antwort, falsche Art → `invalid` | Antworten sind typsicher (`AnswerBodyFor<"buttons">`), eine verwechselte Antwort wird nie als eine andere gelesen |
| `question.answered {id, seq}` | Jede Frage wird von genau einer Nachricht geschlossen; vorher verschwanden beantwortete Fragen stillschweigend, der Client konnte „offen“ nie sicher wissen |
| `blocking` an jeder Frage | Die UI muss nicht wissen, welche Arten blockieren; die Engine sagt es (Bible §9.1: der Client rechnet nichts aus) |
| `message.kind` (`prompt`, `notice`, `error`, `incorrect-action`); Forges Fehlerdialog kein eigener Typ `error` mehr | Kein Namenskonflikt mit `engine.error`; die UI kann jede Art gezielt darstellen |
| Karten-Id/-Ansicht an Fragen, Hinweisen und Ereignissen nur bei `mayView` | Eine verdeckte Karte verlässt die Engine nie mit Id (Regel aus 02, jetzt überall) |
| kein `state` ohne Spiel; `game.end` immer mit allen Feldern; `options.suggested` nur bei gültigem Vorschlag | Der Vertrag kennt keine Teil-Schnappschüsse und keine optionalen Pflichtangaben |
| `engine.ready`-Nutzlast mit `protocol`, `engine` (camelCase, Typen), `boot` | Protokoll-, Forge- und Build-Version beim Start (Research §3.2) |
| Fehlercodes in `WasmMain.handle` (`deck-rejected`, `invalid-request`, `engine-failure`) | Der Host unterscheidet „Befehl fehlgeschlagen“ von „Engine kaputt“ |

Forges Spielverlauf ist davon unberührt: Die vier Testpartien ergeben auf der JVM
**dasselbe Forge-Spielprotokoll wie in Prompt 02** (§5.2).

## 5. Nachweise

### 5.1 Unit-Tests (61, `node:test`, laufen in `build-host.sh` bei jedem Build)

| Datei | Tests | prüft |
|---|---|---|
| `protocol/test/schema.test.ts` | 13 | jedes Nachrichtenbeispiel gültig und jede Art abgedeckt; jede Frageart hat Frage + Antwort + festes `blocking`; echte Zustände aus Forge (Fixtures) gültig; unbekannte/fehlende Typen, fremde Felder, falsche `blocking`-Werte, `seq` < 1, Antworten ohne `kind`, Knopf 3, leere Decks laut abgelehnt; ein Zustand ohne irgendeinen Teil wird abgelehnt (keine Teil-Schnappschüsse); verdeckte Karte nur `{hidden: true}`; Version Schema = TS = `Protocol.java`; erzeugte Dateien aktuell |
| `protocol/test/input-queue.test.ts` | 10 | Kopf-Layout, Kapazitätsregeln, Leser weist fremde/falsche Puffer ab; FIFO; Einträge und Längenpräfix über das Ringende an jeder Stelle, Mehrbyte-UTF-8; volle Warteschlange ändert kein Byte; zu große und leere Eingaben; Zeitlimit; unstimmige Positionen und kaputte Einträge als `corrupt`; 20 000 Zufallsschritte gegen ein Modell (> 100 Überläufe, > 100 Umbrüche) |
| `protocol/test/input-queue-threads.test.ts` | 1 | zwei echte Threads: 5 000 Eingaben zufälliger Größe mit blockierendem Leser, der Schreiber weicht bei voller Warteschlange aus; alles kommt vollständig, einmal und in Reihenfolge an |
| `protocol/test/features.test.ts` | 5 | dieses Node erfüllt alles; Browser ohne COOP/COEP nennt beide fehlenden Punkte; Probemodule einzeln |
| `client/test/engine-client.test.ts` | 18 | Start, Versionskonflikt vor dem Lesen, keine Worker ohne Features, Abbrüche (Engine, Worker-Fehler, Schemaverstoß, Ready-Timeout), abgelehntes Deck → wieder bereit, Reihenfolgeverstöße; **veraltete und unbekannte Antworten** werden nicht gesendet, die Engine lehnt sie ungeprüft gesendet als `stale` ab; **zurückgezogene und beantwortete Fragen** werden geschlossen; blockierende Frage; Antippen gegen den letzten **vollständigen Zustand** (ersetzt, nie gemischt); `queue-full`; Watchdog `stalled`/`responsive`; `abort()` |
| `client/test/no-rules.test.ts` | 1 | Client, Protokoll-Code und Worker-Host greifen auf keine Phase, keinen Knopf-Anlass und keine Karteneigenschaft zu |
| `wasm/test/worker-host.test.ts` | 13 | mit simulierter Java-Seite: Startreihenfolge, Versionskonflikt (Seite und Engine), fehlende Features, unbrauchbare Warteschlange, Launcher-/Java-Fehler, `not-ready`, `already-started`, ganze Partie aus der Warteschlange, abgelehntes Deck → nächste Partie, `invalid-request` ohne Forge-Aufruf, Fehler nach Spielbeginn = Abbruch, kaputte Warteschlange = `transport-error`, unlesbare Java-Daten, KI-Testpartie |

### 5.2 JVM (38 Tests im Maven-Build + Referenzpartien)

- **Neu:** `ProtocolContractTest` (5): Version, Fragearten, Anlässe, Ablehnungsgründe,
  Nachrichtenarten und Nachrichtentypen von `Protocol.java` = Schema; **jede
  Forge-Phase** (`PhaseType`) steht im Schema; `blocking` je Frageart fest.
  `HumanMatchTest` +3: jede Frage genau einmal geschlossen, Ablehnungen mit ihrer
  `seq`, beantwortete Fragen nennen die richtige Eingabe, nichts offen bei Spielende,
  Eingaben lückenlos nummeriert (19 Tests); kaputte oder fehlende `seq` bricht die
  Partie laut ab; eine Antwort der falschen Art ist `invalid` und ändert Forges
  Spiel nicht (gleiches Forge-Protokoll wie ohne sie).
- **Referenzpartien mit dem Testspieler** (`test-engine.sh`, Schritt 1):

| Szenario | Züge | Ende | Eingaben | Forge-Protokoll (SHA-256) | = Prompt 02 | Entscheidungsnachrichten | Fingerabdruck (neu) |
|---|---|---|---|---|---|---|---|
| `3` (Seed 3) | 15 | Niederlage | 44 | `c1e990c6…` | **ja, bitgleich** | 160 | `21a39a3a…` |
| `11` (Seed 11) | 14 | Niederlage | 54 | `7c3f673f…` | **ja, bitgleich** | 190 | `dabfb3c6…` |
| `5-defend` (Seed 5, blockt) | 15 | Niederlage | 52 | `e8213ffe…` | **ja, bitgleich** | 189 | `1455e451…` |
| `3-concede` (Seed 3, gibt in Zug 4 auf) | 4 | Niederlage, aufgegeben | 14 | `6737df12…` | **ja, bitgleich** | 41 | `51480dde…` |

- **Alle 986 Nachrichten** dieser vier Partien (309 Zustände,
  183 Fragen) entsprechen dem Schema, jeder Zustand ist in sich vollständig
  (alle Ids auflösbar: Spieler, Karten, Kampf, Anhänge, Stapelziele), jede Frage wird
  genau einmal geschlossen, bei `game.end` ist nichts offen (`validate-messages.ts`).

### 5.3 Wasm über Client und Warteschlange (`test-engine.sh`, Schritte 2–4)

| Lauf | Ergebnis |
|---|---|
| Node: KI gegen KI, Seed 42 lazy/eager, Seed 7 | bestanden: Forge-Protokoll = JVM (`d7611b0e…`, `0d52aafc…`) |
| Node: Wiederholung **lazy** (Client-Prüfung jeder Eingabe) | alle gleich wie JVM — `3`: 44 Eingaben; `11`: 54 Eingaben; `5-defend`: 52 Eingaben; `3-concede`: 14 Eingaben |
| Node: Wiederholung **eager** (256-Byte-Warteschlange) | alle gleich wie JVM — `3`: 44 Eingaben, 9× Umbruch, 8× voll; `11`: 54 Eingaben, 11× Umbruch, 11× voll; `5-defend`: 52 Eingaben, 11× Umbruch, 10× voll; `3-concede`: 14 Eingaben, 3× Umbruch, 2× voll |
| Node: Fehlerpfade (`node-protocol.ts`) | alle 4 bestanden (siehe unten) |
| Chrome: KI gegen KI, Seed 42 lazy/eager, Seed 7 | bestanden: Forge-Protokoll = JVM (`d7611b0e…`, `0d52aafc…`) |
| Chrome: Wiederholung **lazy** (Client-Prüfung jeder Eingabe) | alle gleich wie JVM — `3`: 44 Eingaben; `11`: 54 Eingaben; `5-defend`: 52 Eingaben; `3-concede`: 14 Eingaben |
| Chrome: Wiederholung **eager** (256-Byte-Warteschlange) | alle gleich wie JVM — `3`: 44 Eingaben, 9× Umbruch, 8× voll; `11`: 54 Eingaben, 11× Umbruch, 11× voll |
| Chrome: Seite kündigt Protokoll 999 an | bestanden: Worker weist nach 100 ms ab (`protocol-mismatch`), bevor der Launcher lädt |
| Chrome ohne COOP/COEP | bestanden: Meldung nach 86 ms: „Dieser Browser kann die Forge-Engine nicht ausführen. Es fehlt: Cross-Origin-Isolation (COOP/COEP-Header), SharedArrayBuffer.“ |

Bei jeder Wiederholung verglichen: Forge-Protokoll (Hash, Einträge), Fingerabdruck
aller Entscheidungsnachrichten, Forges GUI-Aufrufe je Methode, Eingaben, Züge,
Ergebnis, Sieger, Grund, Aufgabe, Ablehnungen je Grund; keine Forge-Fehler, keine
Arbeit auf anderen Threads, kein Protokollverstoß (der Client hätte abgebrochen),
jeder Zustand in sich vollständig, gegnerische Hand nie sichtbar, `state.request`
jedes Mal mit einem Zustand beantwortet, bevor die Engine wieder wartet.

**Client und Engine urteilen gleich** (langsame Läufe, je Partie; Summe über vier Partien in Node):

| Eingabe | Client (eigene Prüfung) | Engine (dieselbe Eingabe, vom Test ungeprüft hinterhergeschickt) | Anzahl |
|---|---|---|---|
| angenommen (Knöpfe, Auswahl, Antippen, Zustandswunsch, Aufgeben) | lässt durch | führt aus, keine Ablehnung | 145 |
| Antwort auf eine zurückgezogene Frage | `stale` | `stale` | 4 |
| Antwort auf eine nie gestellte Frage (9 999 999) | `unknown-question` | `stale` | 4 |
| Knopf 3 | `malformed` (Schema) | `invalid` | 4 |
| Karte −5 | `unknown-card` | `unknown-card` | 4 |
| Antippen während einer blockierenden Frage | `not-active` | `not-active` | 3 |

**Die Fehlerpfade gegen die echte Engine** (`node-protocol.ts`, Node; Versionskonflikt und Negativtest auch in Chrome):

| Szenario | Ergebnis |
|---|---|
| `version-mismatch` | Seite kündigt Protokoll 999 an → `engine.abort protocol-mismatch` (origin engine), keine Startphase begonnen (65 ms) |
| `deck-rejected` | Deck mit „Definitely Not A Magic Card“ → `engine.error deck-rejected` mit vollständigem Bericht, Status wieder `ready`; **derselbe Worker** spielt danach die Aufgabe-Partie gleich wie die JVM zu Ende (`6737df12…`); zweite Partie im selben Worker → `already-started` (4983 ms) |
| `abort-mid-game` | `abort()` während Forge in `Atomics.wait` steckt → Worker beendet, `engine.abort terminated` (origin client), kein `game.end`, danach wird jede Eingabe abgelehnt (4613 ms) |
| `broken-sequence` | am Client vorbei eine Eingabe mit `seq` 99 in die Warteschlange → `engine.abort engine-failure`: „java.lang.IllegalStateException: input sequence broken: expected seq 1, got {"type":"state…“ (4666 ms) |

## 6. Messwerte

| Größe | Wert |
|---|---|
| Build gesamt (sauber, `build.sh`) | 386,2 s; davon `build-host` 3,8 s (npm-Prüfung, Schema, `tsc`, 61 Unit-Tests, Bundles), Maven mit 38 Tests 77,5 s (2,2 GiB Spitze), `native-image` 144,5 s (5,9 GiB Spitze) |
| Wasm-Modul | 69,2 MiB roh, 19,5 MiB gzip -9, 13,2 MiB Brotli 11 (02: 69,2 / 19,5 / 13,2) |
| Worker-Bundle `engine-worker.js` | 290 KiB roh (minifiziert), 28 KiB gzip, 20 KiB Brotli — überwiegend die Schema-Prüfer |
| Erzeugte Prüfer `validators.js` | 427 KiB unminifiziert; minifiziert rund 300 KiB, gzip rund 29 KiB (gemessen mit esbuild) — so viel kommt später ins App-Bundle |
| Engine spielbereit (Worker-Start → `engine.ready`) | Chrome 3,4–3,5 s, Node 4,1–4,2 s (wie 01/02) |
| Antwort der Engine je Eingabe (geschrieben → nächstes `engine.waiting`, KI-Züge eingeschlossen) | Chrome: Median 7–13 ms, 95 % ≤ 205 ms, max. 268 ms · Node: Median 4–13 ms, 95 % ≤ 249 ms, max. 313 ms |
| Schema-Prüfung aller Engine-Nachrichten im Client | Chrome: 90–386 Nachrichten je Partie, zusammen 11,8–21,4 ms (im Mittel 0,05–0,13 ms je Nachricht, einzeln höchstens 1,5 ms) · Node: 88–386 Nachrichten je Partie, zusammen 15,1–29,9 ms (im Mittel 0,07–0,17 ms je Nachricht, einzeln höchstens 2,4 ms) |
| Speicher | Chrome: alle Prozesse der Instanz Leerlauf 0,86 GiB, Spitze 1,74–1,79 GiB; Node (Prozess inkl. Worker) Spitze 1,19–1,25 GiB (02: Chrome +0,9 GiB, Node 1,17–1,22 GiB) |

## 7. Entscheidungen und Abweichungen

| Entscheidung | Branchenüblich? | Begründung |
|---|---|---|
| **Schema zuerst** (JSON Schema als Quelle, TS-Typen und Prüfer erzeugt, erzeugte Dateien eingecheckt, `--check` im Build) | ja: so arbeiten OpenAPI-/Protobuf-Verträge; json-schema-to-typescript und Ajv sind die Standardwerkzeuge | Der Vertrag gehört keiner Sprache: Java schreibt, TypeScript liest. Eingecheckte Erzeugnisse machen Vertragsänderungen im Review sichtbar (Research §6: Schema-Diff bei Forge-Updates) und der App-Build braucht keinen Generator |
| **Strenge Prüfung jeder Engine-Nachricht zur Laufzeit**, Verstoß = technischer Abbruch | teils: viele Apps prüfen nur Eingaben; Laufzeitprüfung auch der eigenen Gegenseite ist bei kritischen Grenzen üblich | Bible §2: die UI darf nur verlässliche Daten zeigen; ein leiser Fehler wäre schlimmer als ein lauter Abbruch. Kosten gemessen (§6): unter einer Millisekunde je Zustand. Das Schema erlaubt `null` überall dort, wo Forge laut Code `null` liefern kann, damit seltene echte Spiele nicht an Formalien scheitern |
| **Genaue Versionsgleichheit** statt Semver-Aushandlung | für Client und Server, die zusammen ausgeliefert werden: ja | UI und Engine kommen in einer App-Version (`engine.lock.json`); eine Abweichung heißt „alter Cache/falscher Build“, nicht „ältere Gegenseite“. Ein Forge-Update ändert die Version nicht, solange die Bridge den Vertrag hält |
| **Eigener Ringpuffer** statt einer Bibliothek (z. B. `ringbuf.js`) | Ringpuffer auf SharedArrayBuffer sind ein bekanntes Muster; Bibliotheken dafür sind klein und selten gepflegt | ~200 Zeilen mit festem Layout, das beide Seiten prüfen (Magic, Version), dazu das genaue Fehlerverhalten, das Research §3.4 verlangt (laut bei voll, nie überschreiben). Abgesichert durch Modell- und Zwei-Thread-Tests |
| Warteschlange **begrenzt, laut, ohne Gegendruck** | ja (bounded queue + explizite Ablehnung) | Der Main Thread darf nie blockieren; bei 64 KiB passen Hunderte Eingaben. Voll wird sie nur, wenn die Engine sehr lange rechnet und die UI weiter sendet; dann soll die UI es zeigen, nicht puffern |
| `question.answered` neu, `question.withdrawn` bleibt | — | Jede Frage hat damit ein eindeutiges Ende; die Rücknahme behält ihren Namen aus Anvil (`frage.weg`) und 02 |
| Der Client prüft **formale** Protokollfakten (Ids, Art, blockierend, sichtbare Karten), **nicht** den Inhalt einer Antwort (Anzahl, Bereich, Summe, aktiver Knopf) | — | Die Inhaltsprüfung liegt schon in der Bridge (`Answers.java`); eine zweite Kopie in TypeScript würde auseinanderlaufen. Die Entscheidungs-UI (Prompt 15) zeigt die Grenzen aus der Frage an und kann eine gemeinsame Prüfung dann bewusst einführen |
| Befehle per `postMessage`, Eingaben per Warteschlange | — | Research §3.4: die Engine liest die Warteschlange nur, wenn sie wartet; `engine.start` übergibt die Warteschlange selbst, `match.start` kommt, solange der Worker frei ist |
| Diagnose-KI-Partie (`diagnostics.ai-match`) im Vertrag | — | Die Engine-Tests laufen über denselben Client wie die App; die Nachricht ist als „nur Tests“ markiert |
| TypeScript 7.0.2 (native Compiler), Node führt `.ts` direkt aus, Tests mit `node:test` | TS 7 ist seit 2026 der aktuelle Stand; `node:test` + Type Stripping ist die schlanke Alternative zu Vitest/ts-node | Nur prüfbar-löschbare TS-Syntax (`erasableSyntaxOnly`), keine Laufzeitabhängigkeit, 26 npm-Pakete insgesamt. Die App (Prompt 06) darf Vite/Vitest nutzen; der Engine-Teil bleibt davon unabhängig |
| Paket von `engine/wasm/package.json` nach `engine/package.json` | — | Protokoll, Client, Host und Tests sind ein Engine-Paket; die Pfade in Doku und Skripten sind nachgezogen |
| Research-Plan: „UI importiert `engine/protocol` und den Worker-Host“ | Abweichung (klein) | Die UI importiert `engine/protocol` (Typen, Prüfer) und `engine/client` (den `EngineClient`); den Worker-Host lädt sie nur als Datei `engine-worker.js`. So bleibt die harte Trennung UI → Protokoll → Bridge → Wasm |

## 8. Befunde

- **Der GraalVM-Launcher darf in Node nicht als ES-Modul laden.** Mit dem neuen
  `engine/package.json` (`"type": "module"`) hätte Node `build/dist/openmana-engine.js`
  als ES-Modul behandelt; der Launcher ist aber ein klassisches Skript, das Node an
  einem globalen `require` erkennt. Der Node-Worker lädt ihn jetzt wie `importScripts`
  im Browser (`vm.runInThisContext`) und stellt `require` bereit, näher am Browser
  als das frühere CommonJS-Laden.
- **Ajv-Standalone für JSON Schema 2020-12 lässt sich nicht tree-shaken:** der Code
  setzt Eigenschaften auf oberster Ebene (Auswertungsverfolgung), esbuild muss alles
  behalten. Das Worker-Bundle trägt deshalb alle Prüfer mit (290 KiB minifiziert, 28 KiB gzip). Eine eigene,
  kleinere Prüfdatei für den Worker brächte 0,2 % des Engine-Downloads und wurde
  bewusst nicht gebaut.
- **Watchdog-Fehler vom Test gefunden:** Die Stille zählte zunächst ab der letzten
  Nachricht, auch wenn die Engine davor nur auf den Spieler wartete; maßgeblich ist
  die Zeit, seit sie wieder arbeitet. Behoben, der Test bleibt.
- **Forge-GUI-Methode `message(String, String)`** kollidierte mit dem neuen Helfer
  gleichen Namens (Überladung statt Override); umbenannt (`messageOf`).
- **Der Fake-Launcher im Worker-Host-Test war zu nett:** Er startete Java synchron;
  der echte Launcher startet Java erst nach dem asynchronen Laden des Moduls. Der Test
  bildet das jetzt ab (sonst hätte er die Reihenfolge `wasm-fetch-compile` → `java-main`
  falsch bestätigt).
- **Für die spätere Wiederaufnahme laufender Partien** (Bible, neuer Abschnitt
  „Match persistence / resume“ vom 2026-09-24): Seed plus lückenlos nummerierte
  Eingaben reproduzieren in allen Tests eine Partie bitgenau (JVM, Node, Chrome,
  lazy und eager). Deterministisches Nachspielen wäre damit ein Kandidat für eine
  **vollständige** statt näherungsweise Wiederherstellung; offen ist, ob Forges
  kooperative KI-Zeitgrenze (Patch 0002) auf langsamen Geräten den Determinismus
  bricht. Nicht umgesetzt, nur festgehalten.

## 9. Bekannte Lücken (bewusst offen, mit Ziel-Prompt)

| Lücke | Wirkung heute | wohin |
|---|---|---|
| Inhaltliche Antwortprüfung nur in der Bridge | die UI erfährt eine unpassende Anzahl/Summe erst als `input.rejected invalid` | 15 (Entscheidungs-UI) |
| Karten auf dem Stapel haben im Zustand nur `source` (Id) und Text, keine Kartenansicht | Stapel-Anzeige braucht die Karte (Bild) | 16 (Priorität, Stapel) |
| `distribute` mit leerer Liste (Kampfschaden ohne Blocker) wäre ein Schemaverstoß | laut statt still; in den Testpartien nicht vorgekommen | 18/19 (Kampf, siehe 02 §8) |
| Der Watchdog meldet `stalled`, die UI dafür fehlt | nur Ereignis | 11 (Spielsitzung), 06 (UI) |
| Wiederverwendung eines Workers nach einer Partie | ein Worker je Partie (Forges statischer Zustand) | 25 (Lebenszyklus) |
| Fold7/Android-Messung der Warteschlange | nur Desktop gemessen | Research-Frage 5 |

Die Lücken aus 02 §8 (Trampeln, „an beliebige Stelle“, verdeckte gegnerische
Karten auf dem Feld, `player.tap` ohne Rückmeldung, Commander ungetestet) bleiben
unverändert offen; „Eingabekanal ohne Warteschlange/Versionsprüfung“ ist mit
diesem Prompt geschlossen.

## 10. Reproduzieren

```bash
git submodule update --init --depth 1 engine/forge   # einmalig
bash engine/scripts/build.sh                          # ~6 min: Host/Protokoll (Unit-Tests), Forge, JVM-Tests, Wasm
bash engine/scripts/test-engine.sh                    # ~10 min: JVM, Node, Chrome, Fehlerpfade, Negativtest
```

Nur der TypeScript-Teil (Sekunden): `bash engine/scripts/build-host.sh`. Einzelne
Läufe: `node engine/wasm/test/node-replay.ts --transcript engine/build/report/transcripts/human-3.json --feeding eager`,
`node engine/wasm/test/node-protocol.ts --transcript engine/build/report/transcripts/human-3-concede.json`,
`node engine/wasm/test/browser-smoke.mjs --transcript … --feeding lazy`.
Ergebnisse: `engine/build/report/test-report.json`, je Lauf eine JSON-Datei in
`engine/build/report/runs/`, Aufzeichnungen und Nachrichtenprotokolle der JVM in
`engine/build/report/transcripts/`.

## 11. Was als Nächstes kommt

**Prompt 04 — Forge resources and card scripts** (nicht begonnen): Ressourcen-
Inventar und Manifest prüfen, repräsentative Karten (DFC, Token, neue Sets) laden,
Netzspiel/jupnp aus der Erreichbarkeit nehmen. Die Oberfläche (ab Prompt 06) baut
auf `engine/client` und `engine/protocol` auf und sieht Forge nie direkt.
