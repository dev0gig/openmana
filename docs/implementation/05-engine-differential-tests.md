# 05 — Differenztests JVM gegen WebAssembly

> Umsetzung von [`prompts/queue/05-engine-differential-tests.md`](../../prompts/queue/05-engine-differential-tests.md),
> Stand **2026-09-24**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `0ddfbc3` (sauberer Build, `engineSourcesModified=false`). Grundlage:
> [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md) §3.3, §6 und offene Frage 3
> („Kompiliert Web Image Forge verhaltensgleich?“), die Wiederholungstests aus
> [`02-anvil-bridge.md`](02-anvil-bridge.md) §4 und [`03-worker-transport-protocol.md`](03-worker-transport-protocol.md) §5.
> Code: [`engine/bridge/…/trace/`](../../engine/bridge/src/main/java/org/openmana/engine/trace/) (Engine-Spur),
> [`engine/fixtures/`](../../engine/fixtures/README.md) (Testpartien),
> [`engine/wasm/spike/trace.ts`](../../engine/wasm/spike/trace.ts) (Vergleich, Prüfsumme, Abdeckung),
> [`engine/scripts/test-engine.sh`](../../engine/scripts/test-engine.sh). Alle Zahlen sind eigene Messungen auf
> odin (Intel i7-8700T, 12 Threads, 15,5 GiB RAM, Debian 13), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 05 ist umgesetzt.** `engine/scripts/test-engine.sh` spielt dieselben
skriptgesteuerten Partien mit festen Seeds auf der JVM-Bridge und auf der
Wasm-Bridge (Node und Chrome) und vergleicht sie über eine **strukturierte,
sprachunabhängige Spur** statt über Forges Texte: an jeder Stelle, an der Forge
auf eine Eingabe wartet, an jedem Schrittbeginn und am Spielende ein
vollständiger Schnappschuss aus Forges Modell, dazwischen jedes Forge-Ereignis
und jede Entscheidung der Bridge. Keine dieser Stellen hängt an einer Uhr.
**Jede Abweichung lässt den Test scheitern** und nennt die Stelle: Eintrag,
Zug, Schritt, gelesene Eingaben, das abweichende Feld und das Ereignis bzw. die
Zone auf beiden Seiten. Ein dauerhafter Negativtest beweist das mit absichtlich
verfälschten Spuren.

**Abgedeckt** (von der Spur nachgewiesen, nicht nur behauptet): Mulligan,
Länder und Zauber, Priorität (spielen und abgeben), Kosten automatisch und von
Hand, Ziele auf Karten und Spieler, Stapel (Auflösen, ausgelöste Fähigkeiten,
eine Antwort mit Stapeltiefe 2), Angriff, Blocken, **Blocker-Zuordnung** (zwei
Angreifer geblockt, ein Angreifer von zwei Kreaturen), Zonenwechsel, Spielende
(Leben, Aufgabe, Sieg, Niederlage) und eine **regelkonforme Commander-Partie**
(Kommandant aus der Kommandozone, zurück dorthin, erneut mit
Kommandantensteuer, Kommandantenschaden). Jede der zehn Testpartien nennt in
ihrer Datei, was sie abdecken muss; zeigt ihre Spur es nicht mehr, scheitert
der Test.

**Nachweis:** Alle zehn Testpartien und die vier KI-Partien ergeben auf der
JVM, in Node und in Chrome **dieselbe Spur** (gleiche Einträge, gleiche
SHA-256), bei jeder Einspeisung (eine Eingabe je Warten; 256-Byte-Warteschlange).
Dieselbe Partie auf Deutsch hat **dieselbe Spur** wie auf Englisch, obwohl
Forges Spielprotokoll-Text ein anderer ist; ebenso faul und vollständig
geladene Karten. Die Referenzpartien seit Prompt 02 spielen bitgleich weiter
(Forge-Protokoll `c1e990c6…`, `7c3f673f…`, `e8213ffe…`, `6737df12…`). Damit
ist **Research-Frage 3** („verhaltensgleiche Übersetzung“) für die getesteten
Pfade beantwortet.

Beim Aufbau kamen zwei echte Fehler ans Licht: Eine Commander-Partie konnte
nicht enden (§7.1, behoben), und die erste Fassung der Spur selbst veränderte
das Spiel (§7.2, behoben – mit einer offenen Folgerung für den Zustand der
Bridge); dazu zwei Stellen, an denen Forge eine Uhr befragt (§7.3).

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Engine-Spur | `engine/bridge/…/trace/`: `EngineTrace`, `TraceEvents`, `TraceSnapshot`, `TraceRefs` | Checkpoints (`input`, `phase`, `end`) mit Schnappschuss aus Forges Modell, Forges Ereignisse (Guava-EventBus-Abonnent, eine Art je Ereignisklasse), Entscheidungen der Bridge; nur auf Wunsch (`MatchRequest.trace`, `diagnostics.ai-match` mit `trace`) |
| Protokoll 3 | `engine/protocol` | `diagnostics.trace` mit genauem Schema (`TraceSnapshot`, `TracePlayer`, `TraceCard`, `TracePermanent`, `TraceStackItem`, `TraceQuestion` …), `MatchRequest.trace`, `DiagnosticsAiMatchCommand.trace`, `MatchSummary.trace`/`AiMatchResult.trace`, Konstanten `TRACE_CHECKPOINTS`, `TRACE_EVENT_KINDS` |
| Client | `engine/client/src/engine-client.ts` | nimmt die Spur nur an, wenn angefordert, nur lückenlos nummeriert; die Zusammenfassung muss die angekommenen Einträge zählen; sonst `protocol-violation` |
| Testpartien | `engine/fixtures/`: `decks/` (6 Decks), `differential/` (10 Partien), `README.md` | Seed, Decks, Regel des Testspielers, Engine-Einstellungen, welche Wiederholungen laufen, was die Partie abdecken muss; Varianten (`sameGameAs`) |
| Testspieler | `smoke/ScriptedHuman` | Richtlinien als Daten: Angriff `all`/`none`/`alternate`, Block `none`/`one`/`assign` (Angreifer antippen, dann Blocker; erst einer je Angreifer, dann ein zweiter), Aufgabe ab Zug; Kommandant aus der Kommandozone |
| Vergleich | `engine/wasm/spike/trace.ts` | `TraceComparison` (Eintrag für Eintrag, erste Abweichung mit Pfad und Ort), `describeDivergence`, `traceDigest` (SHA-256 über kanonisches JSON), `traceStats`, `traceCoverage` + `COVERAGE`, `REQUIRED_COVERAGE` |
| Werkzeuge | `engine/wasm/test/`: `fixtures.ts`, `check-traces.ts`, `compare-traces.ts`, `node-divergence.ts`; `JvmHumanMatchMain --scenario`, `JvmSmokeMain --trace` | Testpartien laden und streng prüfen, JVM-Spuren prüfen (Abdeckung, Varianten, Vollständigkeit), zwei Spuren vergleichen, Negativtest |
| Wiederholungen | `wasm/spike/replay.ts`, `node-replay.ts`, `node-ai.ts`, `page.ts`, `browser-smoke.mjs` | vergleichen jeden ankommenden Spur-Eintrag sofort mit der JVM-Spur und brechen bei der ersten Abweichung ab; KI-Partien mit `--expect-trace` |
| Build | `ListSubscribers.java`, `gen-reflection-config.mjs` | EventBus-Abonnenten von OpenMana (die Spur) werden für das Wasm-Modul registriert; fehlt der Spur-Abonnent, bricht der Build ab |
| Behoben | `HeadlessGuiBase.showImageDialog` | Forges Erfolgs-Dialog am Spielende wird verworfen statt eine Ausnahme zu werfen (§7.1) |
| Tests | `EngineTraceTest` (5), `ProtocolContractTest` (+1), `trace.test.ts` (12), Client (+3) | §5 |

Nichts davon kennt eine Magic-Regel. Die Spur liest, was Forge weiß; der
Testspieler wählt unter dem, was Forge anbietet; die Abdeckung liest Forges
Ereignisse.

## 2. Die Engine-Spur

### 2.1 Warum eine eigene Spur

Bis Prompt 04 wurden JVM und Wasm über zwei Hashes verglichen: Forges
Spielprotokoll (Text in der Sprache der Engine) und einen Fingerabdruck der
Entscheidungsnachrichten (mit Fragetexten). Beide sagen nur „gleich“ oder
„ungleich“, nie **wo**, und beide sind Prosa. Die Zustände (`state`) der
Oberfläche taugen nicht zum Vergleich: Während KI-Zügen schickt die Bridge sie
höchstens alle 120 ms nach der Uhr, ihre Zahl hängt also von der Geschwindigkeit
der Laufzeit ab.

Die Engine-Spur hat deshalb **eigene Checkpoints, die nur vom Spiel abhängen**,
und liest den Zustand aus **Forges Modell** statt aus den Ansichten der
Oberfläche:

| Checkpoint (`at`) | wann | wozu |
|---|---|---|
| `input` | bevor die Bridge die nächste Eingabe liest (jede Eingabe, auch abgelehnte) | der Zustand, auf den der Spieler reagiert; `inputs` = bis dahin gelesene Eingaben |
| `phase` | Forges `GameEventTurnPhase` (jeder Schrittbeginn, auch in KI-Zügen) | Zwischenstände, damit eine Abweichung in einem KI-Zug nicht erst viel später auffällt |
| `end` | Forges `GameEventGameFinished` | der Endzustand |

### 2.2 Inhalt

Ein Eintrag `{"type": "diagnostics.trace", "n", "at", "inputs", "events", "snapshot"}`:

- **`snapshot`** (aus `Game`, `Player`, `Card`): Zug, Schritt, aktiver Spieler,
  Priorität; je Spieler Leben, verloren, Marken, Manapool, gespielte Länder,
  **Bibliothek in Reihenfolge** (Ids), Hand, Friedhof, Exil, Kommandozone
  (Id, englischer Schlüssel, Gesicht), Spielfeld (dazu getappt, krank,
  Schaden, Marken, Stärke/Widerstand, Loyalität, Verteidigung, angelegt an,
  Besitzer, ausgephast), Kommandanten (gewirkt, Schaden je Spieler); der
  Stapel von oben (Quelle, Spieler, Forges `ApiType` wie `DealDamage`, Zauber
  oder Auslöser, **Ziele**); der Kampf (Angreifer, Verteidiger, Blocker). In
  der Menschenpartie zusätzlich der Sitz des Menschen, Forges Markierungen
  (`playable`, `highlighted`, `selectable`) und die offenen Fragen ohne Worte
  (Art, blockierend, Anlass, Grenzen, Knöpfe aktiv, worauf die Einträge zeigen).
- **`events`**: jedes Forge-Ereignis seit dem vorigen Eintrag, eine Art je
  Ereignisklasse (58, z. B. `cast` mit Zielen und Stapelposition, `resolve`,
  `move` von Zone zu Zone, `attackers`, `blockers`, `damage`, `mana`,
  `priority`, `mulligan`, `log` = Art und Karte einer Protokollzeile), dazu die
  der Bridge: `started`, `question`, `withdrawn`, `answered`, `rejected`,
  `message` (nur die Art), `end`, `input` (die gelesene Eingabe).
- **Keine Texte:** Forges Anzeigetexte (Protokollzeilen, Zieltexte, gewählte
  Modi, Knopfbeschriftungen, Fragetexte) fehlen bewusst. Verweise:
  `c<Karten-Id>`, `p<Spieler-Id>`, `<Zone>:<Spieler-Id>`. Mengen, die Forge als
  Hash-Menge liefert, sind nach Id sortiert. `TraceEvents` implementiert Forges
  Ereignis-Schnittstelle selbst: Bringt ein Forge-Update eine neue
  Ereignisklasse, kompiliert die Bridge nicht, bis jemand entscheidet, wie sie
  in die Spur kommt (wie ein neuer Datenordner den Build stoppt, Prompt 04).

Beispiel (verkürzt, echte Partie `stack-response`, Zug 9): Der Mensch wirkt
Runeclaw Bear, die KI antwortet mit Shock auf eine Kreatur, der Stapel löst sich
von oben auf:

```json
{"e":"cast","card":11,"key":"Runeclaw Bear","player":0,"spell":true,"trigger":false,"stack":0,"targets":[]}
{"e":"priority","player":1,"active":0,"phase":"MAIN1"}
{"e":"cast","card":89,"key":"Shock","player":1,"spell":true,"trigger":false,"stack":1,"targets":["c10"]}
{"e":"resolve","card":89,"key":"Shock","fizzled":false}
{"e":"resolve","card":11,"key":"Runeclaw Bear","fizzled":false}
```

### 2.3 Wie die Spur aus dem Wasm-Modul kommt

Die Spur ist eine **Test-Nachricht des Protokolls** (Version 3), gleichrangig
mit `diagnostics.result` und `diagnostics.cards`: Die Bridge schickt jeden
Eintrag sofort (`host.emit`), der Worker reicht ihn weiter, der Client prüft ihn
gegen das Schema. Gestreamt statt gesammelt, damit auch eine Wasm-Partie, die
abbricht oder hängt, ihre Spur bis zur Abweichung liefert. Die Spur enthält
verdeckte Information; deshalb nimmt der Client sie **nur** an, wenn die Partie
sie angefordert hat, und die Oberfläche fordert sie nie an.

Die Aufzeichnung verändert das Spiel nicht (§7.2): Die Partie mit Spur hat
dasselbe Forge-Protokoll und dieselben Entscheidungen wie ohne
(`EngineTraceTest`). Guava verschluckt Ausnahmen in Ereignis-Abonnenten; die
Spur merkt sich deshalb einen eigenen Fehler und wirft ihn beim nächsten Aufruf
der Bridge – eine lückenhafte Spur kann nicht bestehen.

## 3. Die Testpartien

Jede Partie ist eine kleine JSON-Datei in `engine/fixtures/differential`
(Format und Anleitung: [`engine/fixtures/README.md`](../../engine/fixtures/README.md)),
die Decks liegen in `engine/fixtures/decks`. `fixtures.ts` prüft alles streng
(unbekannte Felder, fehlender Seed, unbekanntes Deck oder unbekannte
Abdeckungs-Kategorie brechen ab, auch als Unit-Test bei jedem Build).

| Partie | Seed, Decks | Spieler | Züge | Ende | Eingaben | Spur: Einträge / Ereignisse | Spur (SHA-256) | Forge-Protokoll |
|---|---|---|---|---|---|---|---|---|
| `human-3` | 3, Rot+ gegen Grün | greift an | 15 | Niederlage (Leben) | 44 | 236 / 1 597 | `fa95aed2…` | `c1e990c6…` (seit 02) |
| `human-3-de` | = `human-3`, Deutsch | | 15 | Niederlage | 44 | 236 / 1 597 | **`fa95aed2…`** | `74c6cf69…` (anderer Text) |
| `human-3-lazy` | = `human-3`, faules Laden | | 15 | Niederlage | 44 | 236 / 1 597 | **`fa95aed2…`** | `c1e990c6…` |
| `human-11` | 11, Rot+ gegen Grün | greift an | 14 | Niederlage | 54 | 233 / 2 553 | `a5a73da8…` | `7c3f673f…` (seit 02) |
| `human-5-defend` | 5, Rot+ gegen Grün | ein Blocker je Kampf | 15 | Niederlage | 52 | 244 / 2 366 | `46f7a55f…` | `e8213ffe…` (seit 02) |
| `human-3-concede` | 3, Rot+ gegen Grün | gibt in Zug 3 auf | 4 | Aufgabe | 14 | 56 / 336 | `315a1749…` | `6737df12…` (seit 02) |
| `blocks-multi` | 7, Grün gegen Rot | jeder zweite Angriff, ordnet Blocker zu | 16 | Niederlage | 55 | 260 / 1 874 | `3c90a6a0…` | `ca4a9468…` |
| `blocks-double` | 12, Grün gegen Rot | wie oben, gibt in Zug 13 auf | 13 | Aufgabe | 45 | 205 / 1 563 | `225171b4…` | `9b7bdf4c…` |
| `stack-response` | 3, Grün gegen rote Instants | greift an | 13 | **Sieg** | 46 | 212 / 1 451 | `9fa36afc…` | `722ecc73…` |
| `commander` | 5, Krenko gegen Fynn (je 100 Karten) | greift an | 17 | **Sieg** (40 Leben) | 85 | 303 / 2 798 | `3b60f2c4…` | `56faf88b…` |

KI gegen KI (Forge spielt beide Seiten): Seed 42 faul, vollständig und auf
Deutsch **dieselbe Spur** `51689620…` (257 Einträge; Forge-Protokoll
`d7611b0e…` bzw. deutsch `5fc5fd3c…`), Seed 7 `9e087efc…` (309 Einträge,
`0d52aafc…`).

### 3.1 Abdeckung

`check-traces.ts` liest aus jeder JVM-Spur, was die Partie zeigt
(`traceCoverage`), und vergleicht es mit den `covers` der Partie. Was Prompt 05
verlangt, und wo die Spur es zeigt:

| Prompt 05 | Kategorie(n) | nachgewiesen in |
|---|---|---|
| Mulligan | `mulligan` (Forges Mulligan-Ereignis des Menschen; London: Karte zurück) | allen Partien des Menschen |
| Länder- und Zauberspiel | `land`, `spell`, `zone:Hand->Battlefield`, `zone:Hand->Stack` | `human-3`, `human-11`, `blocks-multi` … |
| Priorität | `priority-play` (Karte bei Priorität angetippt, von Forge angenommen), `priority-pass` | alle vollen Partien (12–18 je Partie); `human-5-defend` |
| Mana/Kosten | `payment-auto`, `payment-manual` (Quelle während der Zahlung angetippt) | `human-3`, `human-11`, `blocks-multi` … |
| Ziele | `target-card`, `target-player` | `human-3`, `human-11`, `commander` |
| Stapel | `stack-resolve`, `trigger`, `stack-response` (Stapeltiefe 2, LIFO) | alle; `commander` (8 Auslöser); `stack-response` |
| Kampf | `attack`, `block` | `human-3`, `human-5-defend`, `blocks-*`, `commander` |
| Blocker-Zuordnung | `block-multi` (zwei Angreifer in einem Kampf geblockt), `block-double` (ein Angreifer, zwei Blocker) | `blocks-multi`, `blocks-double` |
| Zonen | `zone:Library->Hand`, `zone:Hand->Battlefield`, `zone:Hand->Stack`, `zone:Stack->Graveyard`, `zone:Battlefield->Graveyard` (dazu Exil, Kommandozone, Bibliothek → Spielfeld) | alle |
| Spielende | `end-life`, `end-concede`, `end-win`, `end-loss` | `human-3`, `human-3-concede`, `blocks-double`, `stack-response`, `commander` |
| Commander | `commander-cast`, `commander-tax`, `commander-return`, `commander-damage` | `commander` |

Außerdem kommen alle Entscheidungsarten außer `order`, `confirm` und `input`
vor (`choose`, `options`, `arrange`, `select`, `distribute` – der Mensch
verteilt Kampfschaden in beiden Block-Partien), Rücknahmen, Ablehnungen und
Zustandswünsche.

## 4. Ablauf in `test-engine.sh`

1. **JVM-Referenz:** KI-Partien mit `JvmSmokeMain --trace`; faul/vollständig und
   Englisch/Deutsch müssen dieselbe Spur haben (`compare-traces.ts`). Die
   Testpartien werden aufgelöst (`fixtures.ts resolve`) und je in einem
   frischen JVM-Prozess gespielt (`JvmHumanMatchMain --scenario`); jede
   Nachricht wird gegen das Schema geprüft (`validate-messages.ts`, jetzt auch
   die Spur: lückenlos, letzter Eintrag am Spielende); `check-traces.ts` prüft
   Abdeckung, Varianten und die Gesamtabdeckung.
2. **Node:** KI-Partien (`node-ai.ts --expect-trace`), jede Testpartie mit den
   Einspeisungen, die sie nennt (`node-replay.ts`), der Negativtest
   (`node-divergence.ts`), die Protokoll-Fehlerpfade, die Kartenprüfung.
3. **Chrome:** dasselbe über die Diagnoseseite; die Seite vergleicht die Spur
   selbst.
4. **Chrome ohne COOP/COEP.**

Zusätzlich scheitert der Lauf, wenn Forges Zeitbudget für „hat der Spieler
etwas zu tun“ abläuft (§7.3), oder wenn tinylog Fehler meldet.

## 5. Nachweise

### 5.1 Unit-Tests (80, `build-host.sh`)

Neu `wasm/test/trace.test.ts` (12): kanonisches JSON, erste Abweichung ohne
Rücksicht auf Schlüsselreihenfolge und mit Pfad, Bericht mit Ort und ganzem
Ereignis, Schnappschuss-Abweichung mit Zonen-Eintrag, zu kurze und zu lange
Spur, der schrittweise Vergleich hört nach der ersten Abweichung auf, Prüfsumme
unabhängig von der Schlüsselreihenfolge, Zeilen und Zählungen; Abdeckung einer
realistischen Spur (mit abgelehntem Antippen, das nicht zählt) und einer Spur
ohne Menschen; alle Testpartien des Repos gültig und zusammen vollständig,
fehlerhafte Testpartien abgelehnt. Client (+3): Spur einer angeforderten
Partie (auch nach `game.end`), nicht angeforderte Spur, Lücke, falsche Zählung,
Zusammenfassung ohne Spur, KI-Partie mit Spur. Schema: Beispiele für Protokoll 3.

### 5.2 JVM (51 Tests im Maven-Build)

Neu `EngineTraceTest` (5): die Partie mit Spur ist die Partie ohne Spur
(Forge-Protokoll, Entscheidungs-Fingerabdruck, Eingaben, GUI-Aufrufe);
dieselben Eingaben ergeben dieselbe Spur (Wiederholung mit `ReplayHost`); die
Spur ist vollständig (ein `input`-Checkpoint je gelesener Eingabe, der letzte am
Ende, Zählung = Zusammenfassung) und enthält **kein** Textfeld; die verdeckte
Hand der KI und die Bibliotheken stehen darin; Blocker-Zuordnung auf zwei
Angreifer (`blocks-multi`, keine abgelehnte Eingabe); die Commander-Partie
endet regulär, Kommandant zweimal gewirkt, zurück in die Kommandozone,
Kommandantenschaden. `ProtocolContractTest` +1: Checkpoints und Ereignisarten
der Bridge = Schema. Die 45 Tests aus 01–04 unverändert grün.

### 5.3 Engine-Testmatrix (`test-engine.sh`)

**Alle Läufe bestanden, 0 Fehler** (Commit `0ddfbc3`, Details §6):

| Lauf | JVM | Wasm Node | Wasm Chrome |
|---|---|---|---|
| KI Seed 42 faul / vollständig / deutsch | Spur `51689620…` ×3 gleich | = JVM (×3) | = JVM (×3) |
| KI Seed 7 | `9e087efc…` | = JVM | = JVM |
| 8 Testpartien | Spuren §3 | je faul und mit 256-Byte-Warteschlange = JVM (16 Läufe) | je faul = JVM, `human-3` und `human-11` auch eng (10 Läufe) |
| `human-3-de` | = `human-3` | faul = JVM | – |
| `human-3-lazy` | = `human-3` | – | – |
| Negativtest (3 Verfälschungen) | – | jede scheitert an genau der verfälschten Stelle | – |
| Kartenprüfung, Protokoll-Fehlerpfade, Versionskonflikt, ohne COOP/COEP | wie Prompt 04 | bestanden | bestanden |

Beispiel eines Abweichungsberichts aus dem Negativtest (der JVM-Wert wurde auf
21 gesetzt):

```
engine trace diverges at entry 29 (turn 2 MAIN1, 11 inputs read, checkpoint input)
  at snapshot.players[1].life: JVM 21 / Wasm 20
```

## 6. Messwerte

odin, sauberer Build auf `0ddfbc3`, Chrome for Testing 153 headless, Node 22.22.3.

| Größe | Wert |
|---|---|
| Build gesamt (`build.sh`) | 377,9 s; `build-host` 2,3 s (80 Unit-Tests), Maven mit 51 Tests 77,7 s (2,42 GiB Spitze), `native-image` 122,2 s (5,97 GiB Spitze) |
| Wasm-Modul | 78 977 240 B = 75,3 MiB roh, 19,6 MiB gzip -9, **12,47 MiB Brotli 11** (04: 75,4 / 19,6 / 12,45 MiB); 6 894 Klassen (+6: die Spur), 11 124 erreichbare Typen (+19) |
| Worker-Bundle `engine-worker.js` | 394 KiB roh, 38,8 KiB gzip, 27,6 KiB Brotli (04: 333 / 32 / 24 KiB) – die genauen Prüfer der Spur |
| `test-engine.sh` | **14,9 min, 64 Läufe, 0 Fehler** (04: 13,6 min, 45 Läufe): JVM 20, Node 26, Chrome 18 |
| Spur je Partie | 56–303 Einträge, 336–2 798 Ereignisse; kompakt rund 2 KB je Eintrag (`human-3`: 461 KB für 236 Einträge); Aufzeichnung mit Spur 1,5 MB (lesbar formatiert) |
| Kosten der Spur, JVM (`human-3`, frische JVM, je 3 Läufe abwechselnd) | Partie 1 853 ms statt 1 778 ms (Median, **+4 %**); Forge-Protokoll gleich (`c1e990c6…`) |
| Kosten der Spur, Wasm in Node (`human-3`, eine Eingabe je Warten, je 3 Läufe) | Partie 2 192 ms statt 1 948 ms (Median, **+12 %**); 562 statt 326 Nachrichten, Schemaprüfung im Client 46 statt 25 ms je Partie; Antwort je Eingabe im Median 12 statt 11 ms, höchstens 275 statt 247 ms; Spitzenspeicher gleich (1,46 GiB) |
| Chrome, Wiederholungen mit Spur | Antwort je Eingabe im Median 4–18 ms, höchstens 525 ms (KI-Zug mit Schritt-Checkpoints); Schemaprüfung 18–53 ms je Partie (einzeln höchstens 3,7 ms); Partie 0,7–4,0 s; alle Prozesse der Instanz 1,95–2,05 GiB |

Die Spur kostet also nur in Tests etwas: Eine Partie ohne `trace` läuft wie
vorher (dieselben Nachrichten, dieselbe Dauer).

## 7. Befunde

### 7.1 Commander-Partien konnten nicht enden (behoben)

Die erste Commander-Partie brach am Spielende mit „the game ended without Forge
calling finishGame“ ab. Ursache: Am Spielende aktualisiert Forge die Erfolge des
Menschen (`FControlGameEventHandler` → `AchievementCollection.updateAll`), und
ein neu erreichter Erfolg wird mit `showImageDialog` angezeigt (zuerst in den
Commander-Partien, drei von drei Seeds; die bisherigen Testpartien hatten nie
einen neuen Erfolg ausgelöst). `HeadlessGuiBase` warf dort – wie für jeden
Oberflächenpfad – eine Ausnahme; Guavas EventBus verschluckte sie, bevor Forge
`finishGame` aufrief. `showImageDialog` hat in Forge keinen anderen Aufrufer;
die Engine verwirft den Dialog jetzt (Erfolge gehören zu Forges eigenen
Oberflächen). Die Konstruktion hat den Fehler laut gemacht statt still: Die
Bridge prüft, dass Forge das Spielende meldet.

### 7.2 Die erste Spur veränderte das Spiel (behoben)

Die erste Fassung schrieb auch „was ein Antippen jetzt bewirkt“ in die Spur
(wie das Feld `action` des Zustands), für alle Karten beider Spieler. Die
Partie mit Spur wich daraufhin von der ohne ab (Block-Partie: Forge-Protokoll
`eee9bc03…` statt `90a5978b…`). Ursache: Forge berechnet das über
`Card.getAllPossibleAbilities(Spieler)` → `SpellAbility.setActivatingPlayer`
bzw. `SpellAbilityRestriction.canPlay`, das einen fehlenden aktivierenden
Spieler **setzt** – eine Nebenwirkung auf Forges Spielzustand, auch für die
verdeckte Hand der KI. Die Spur enthält jetzt nur Forges eigene Markierungen
(reine Nachschlagen in den Mengen der GUI); `EngineTraceTest` sichert „mit Spur =
ohne Spur“.

**Folgerung für die Bridge (offen, Ziel Prompt 14/16):** `StateBuilder` fragt
`action` für jede sichtbare Karte ab, also auch für Karten der KI auf dem
Spielfeld, während der Mensch Priorität hat (nur dort hat der Aufruf die
Nebenwirkung, `InputPassPriority.getActivateAction`). Das geschieht an
deterministischen Stellen und in allen Tests identisch auf JVM, Node und
Chrome; trotzdem verändert die Anzeigeschicht so Forges Objekte. Vorschlag:
`action` während der Priorität nur für Karten berechnen, die Forge selbst als
spielbar markiert hat (`playable`).

### 7.3 Zwei Uhren in Forge

- **APINA-Zeitbudget:** Ob der Spieler „überhaupt etwas tun kann“ (automatisches
  Weitergeben der Priorität, `AvailableActions`) berechnet Forge mit 50 ms je
  Karte (höchstens 1,5 s); läuft das Budget ab, gelten ungeprüfte Karten als
  spielbar, und der Spieler bekommt eine Priorität mehr. Auf einer langsamen
  Laufzeit könnte das anders ausgehen als auf der JVM. In keinem Lauf
  abgelaufen; `test-engine.sh` scheitert jetzt, sobald Forge das meldet.
- **KI-Zeitgrenze** (Patch 0002, 5 s je Entscheidung): meldet nichts. Wird sie
  je erreicht, zeigt die Spur die Abweichung an der KI-Entscheidung.

### 7.4 Weitere Befunde

- **Sprachunabhängigkeit belegt:** Die deutsche Partie hat Eintrag für Eintrag
  dieselbe Spur wie die englische (Menschen- und KI-Partie), obwohl Forges
  Protokolltext ein anderer ist. Forges Spiel hängt nicht an der Sprache.
- **Stapeltiefe 2 kam nur von der KI:** Nach dem eigenen Zauber gibt Forge dem
  Testspieler nur Priorität, wenn er noch etwas tun kann (APINA); der Spieler
  gibt sein Mana im eigenen Zug aus. Die Antwort auf dem Stapel liefert deshalb
  die KI (`stack-response`: Shock als Antwort auf einen Kreaturenzauber).
- **Forge fragt nicht, ob der Kommandant in die Kommandozone soll:** Der
  gestorbene Kommandant ging ohne Rückfrage dorthin (kein `confirm`).
- **Forge prüft Commander-Decks nicht beim Start**, nur in seiner eigenen Lobby
  (`GameLobby`: Größe, Einzelstücke, Farbidentität). Die Testdecks sind trotzdem
  regelkonform (Kommandant + 99, Einzelstücke außer Standardländern). Für den
  Import (Prompt 09/11): Die Engine nimmt jedes Deck an.
- **Forge meldet in jeder Commander-Partie** `findByView: id=… (zone=Stack …)
  not found` (die KI merkt sich den gewirkten Kommandanten über eine veraltete
  Ansicht). Die Partie läuft regulär weiter, auf allen Laufzeiten gleich.
- **Doppelblocks brauchen freie Kreaturen:** Mit „jeder zweite Angriff“
  blockte der Testspieler in 15 Seeds nur einmal mit zwei Kreaturen (Seed 12);
  mit „nie angreifen“ dauerten zwei von drei Partien 94 bzw. 102 Züge. Daher
  die Aufgabe in Zug 13 in `blocks-double`.
- **Guavas EventBus findet Abonnenten per Reflection:** Ohne Registrierung wäre
  die Spur im Wasm-Modul still leer geblieben; der Build registriert jetzt auch
  OpenMana-Abonnenten und bricht ab, wenn der Spur-Abonnent fehlt.

## 8. Entscheidungen und Abweichungen

| Entscheidung | Branchenüblich? | Begründung |
|---|---|---|
| **Aufzeichnen und nachspielen** (JVM-Spieler entscheidet, Wasm spielt die Eingaben nach) statt zwei unabhängiger Spieler | ja: Record/Replay-Differenztests mit einer Referenzimplementierung („Oracle“) | eine Regel des Testspielers, keine zweite Implementierung in TypeScript; weicht Wasm ab, passen die aufgezeichneten Eingaben nicht mehr, und die Spur zeigt wo |
| **Strukturierte Spur** mit eigenen, uhrfreien Checkpoints statt der Zustände der Oberfläche oder des Protokoll-Texts | ja: Golden-Trace-Vergleich strukturierter Ereignisse | der Prompt verlangt es; zeigt die erste Abweichung mit Pfad, hängt nicht an Sprache oder Takt; die bisherigen Text-Hashes bleiben als zusätzliche Prüfung (gleiche Sprache) |
| **Schnappschuss aus Forges Modell, mit verdeckter Information** | ja (Test-Instrumentierung sieht alles) | Abweichungen fallen früh auf (z. B. eine andere Mischung der Bibliothek), nicht erst, wenn eine Karte sichtbar wird; nur auf Wunsch, der Client lehnt ungewollte Spuren ab |
| **Spur als Protokollnachricht, gestreamt** (Protokoll 3) statt am Ende gesammelt | – | auch eine abbrechende oder hängende Wasm-Partie liefert ihre Spur bis zur Abweichung; derselbe Weg wie die echte Partie (Client, Warteschlange, Schema) |
| **Genaues Schema für den Schnappschuss**, lockeres für Ereignisse | – | der Schnappschuss ist ein stabiler Vertrag; Ereignisse folgen Forges Klassen und wachsen mit Forge. Preis: Worker-Bundle +3,6 KiB Brotli |
| **Testpartien als Daten** mit `covers` statt fester Prüfsummen im Repo | ja (Fixtures + Assertions statt Golden Files) | Forge-Updates ändern die KI und damit jede Prüfsumme; was eine Partie abdecken soll, bleibt. Die Prüfsummen stehen in dieser Doku als Stand |
| **Eine Karte kennt keine Regel**: Abdeckung aus Forges Ereignissen | – | die Kategorien lesen `cast`, `blockers`, `move` …, nie Kartennamen |
| **Regelkonforme Commander-Decks** mit vielen Standardländern | – | klein (je 11 Einträge), aber echte 100-Karten-Decks; der Kommandant bestimmt die Partie |
| `human-3-lazy` nur auf der JVM | – | faules Laden im Wasm prüfen die KI-Partien und die Kartenprüfung; die Variante belegt, dass die Menschenpartie davon nicht abhängt |

## 9. Bekannte Lücken

| Lücke | Wirkung heute | wohin |
|---|---|---|
| `action` im Zustand verändert bei Priorität Forges Objekte (§7.2) | deterministisch, in keinem Test sichtbar | 14/16 |
| KI-Zeitgrenze meldet nichts (§7.3) | ein Treffer zeigte sich nur als Spur-Abweichung | bei Bedarf Patch 0002 um eine Meldung ergänzen |
| Entscheidungsarten `order`, `confirm`, `input` in keiner Testpartie | durch Unit-Tests der Bridge (`AnswersTest`) und Schema abgedeckt, nicht JVM gegen Wasm | 15 (Entscheidungs-UI) |
| Mehrspieler-Commander, Partner, Kommandant mit alternativen Kosten | nicht getestet | 11/12 bei Bedarf |
| Engine prüft Decks nicht auf Formatregeln (§7.4) | jedes Deck wird angenommen | 09/11 |
| Geräte (Fold7) | Differenztest nur auf odin | Research-Frage 5 |

Die Lücken aus 02 §8, 03 §9 und 04 §12 bleiben unverändert offen;
„Commander in einer Mensch-Partie ungetestet“ (02 §8) ist geschlossen.

## 10. Offene Fragen der Research: Stand nach 05

| # | Frage | Stand |
|---|---|---|
| 1 | Anvil-Weg im Einzel-Thread inkl. Commander-Wahl | **jetzt auch Commander**: Kommandant aus der Kommandozone, Steuer, Rückkehr, Schaden auf JVM, Node und Chrome gleich |
| 3 | Verhaltensgleiche Übersetzung | **beantwortet für die getesteten Pfade:** zehn Menschen- und vier KI-Partien Eintrag für Eintrag gleich auf JVM, Node und Chrome; jede künftige Abweichung scheitert mit ihrer Stelle |

Die übrigen Fragen stehen wie in [`01-engine-spike.md`](01-engine-spike.md) §7.

## 11. Reproduzieren

```bash
git submodule update --init --depth 1 engine/forge   # einmalig
bash engine/scripts/build.sh                          # ~9 min (Unit- und JVM-Tests laufen mit)
bash engine/scripts/test-engine.sh                    # ~16 min: JVM, Node, Chrome
```

Einzeln: `node engine/wasm/test/fixtures.ts list`,
`node engine/wasm/test/node-replay.ts --transcript engine/build/report/transcripts/commander.json --feeding eager`,
`node engine/wasm/test/compare-traces.ts <a> <b>`,
`node engine/wasm/test/check-traces.ts --transcripts engine/build/report/transcripts`.
Ergebnisse: `engine/build/report/test-report.json`, je Lauf eine JSON-Datei in
`engine/build/report/runs/` (Spur-Urteil unter `trace`), Aufzeichnungen mit Spur
in `engine/build/report/transcripts/`, die Abdeckung je Partie in
`runs/jvm-traces.json`.

## 12. Was als Nächstes kommt

**Prompt 06 — OpenMana web/PWA skeleton** (nicht begonnen): die eigentliche
Web-App auf `engine/protocol` und `engine/client`. Jede Engine-Änderung ab jetzt
läuft durch diesen Differenztest; ein Forge-Update (Prompt 26) nutzt ihn als
Tor.
