# 02 — Anvil-Bridge im Einzel-Thread (Spike)

> Umsetzung von [`prompts/queue/02-anvil-bridge-single-thread.md`](../../prompts/queue/02-anvil-bridge-single-thread.md),
> Stand **2026-09-24**, ausgeführt von Claude Code. Grundlage:
> [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md) §3 (Option A, „Anvil-Weg“).
> Verhaltensreferenz: Anvils [`PROTOKOLL.md`](https://github.com/dev0gig/anvil/blob/7c97fbb0161ad26ddfbb31bf4e723925fc917d24/PROTOKOLL.md)
> (`dev0gig/anvil@7c97fbb`) und `forge-anvil` (`dev0gig/forge@745f26d`, nur gelesen, nichts eingebunden).
> Code: [`engine/bridge/…/bridge/`](../../engine/bridge/src/main/java/org/openmana/engine/bridge/),
> [`engine/wasm/`](../../engine/wasm/), Patches 0004–0006 in [`engine/patches/`](../../engine/patches/README.md).
> Alle Zahlen sind eigene Messungen auf odin (Intel i7-8700T, 12 Threads, 15,5 GiB RAM, Debian 13).

## Ergebnis

**Der Spike ist gelungen; der Anvil-Weg (Research-Option A) trägt auch im
Einzel-Thread.** Forges eigener Mensch-Pfad — `PlayerControllerHuman` mit seinen
Inputs — läuft vollständig auf **einem** Thread: auf der JVM und als
WebAssembly in Node 22 und in einem Dedicated Worker in Chrome 153. Wartet Forge
auf den Menschen, blockiert der Worker mit `Atomics.wait` mitten in Forges
Java-Stack, bis die Seite die nächste Eingabe in einen SharedArrayBuffer
schreibt; verschachtelte Entscheidungen (Ziele und Kosten während eines
Zaubers) liegen einfach tiefer auf demselben Stack.

**Nachweis:** Ein regelfreier Testspieler spielt über das Protokoll vier
Partien gegen Forges KI (drei bis zum Ende, eine mit Aufgeben): Mulligan mit
London-Rücklage, Karten per Antippen **außerhalb** einer Frage spielen, Kosten
automatisch und durch Antippen der Quellen bezahlen, Ziele auf Karten und
Spieler, Angreifen, Blocken, alle vorkommenden blockierenden Fragearten,
zurückgezogene Fragen und absichtlich falsche Eingaben. Seine 164 Eingaben
werden aufgezeichnet und in Node und Chrome erneut in die Wasm-Engine gegeben:
**alle acht Wasm-Partien enden exakt wie auf der JVM** — gleiches
Forge-Spielprotokoll, gleiche Entscheidungsnachrichten samt Fragenummern,
Rücknahmen und Ablehnungen (je SHA-256), gleiche Aufrufe Forges in die GUI.
Die Nachweise liefen auf dem Commit `5a2ed62` (sauberer Build,
`openmana.engineSourcesModified=false`).

Forge bleibt die alleinige Regelautorität: Die Bridge formt nur um und reicht
weiter. Keine Annahme der Research ist widerlegt, es gibt keinen Blocker. Zwei
Stolpersteine, die nur im Wasm auftreten und ohne den Wiederholungstest
unbemerkt geblieben wären, sind behoben (§7.1 Logging, §7.2 EventBus).

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Bridge | `engine/bridge/src/main/java/org/openmana/engine/bridge/` | `BridgeGuiGame` (Forges `IGuiGame` für den Menschen: Fragen, Zustand, Ereignisse, Input-Pumpe), `StateBuilder` (vollständiger Zustand aus Forges Views, Sichtbarkeit über Forges `mayView`), `Answers` (prüft Antworten streng), `Protocol` (Namen auf der Leitung), `HumanMatch` (Partie Mensch gegen Forge-KI aus JSON-Decks), `ProtocolTrace` (Fingerabdruck der Entscheidungsnachrichten), `EngineHost` (Schnittstelle zur UI-Seite) |
| Forge-Patches | `engine/patches/0004–0006` | 0004 Input-Pumpe, 0005 keine Komfort-Timer im Synchronmodus, 0006 kein Netzwerk-Manager in lokalen Partien (Begründung je Patch in der Patch-Beschreibung) |
| Wasm-Anbindung | `engine/wasm/java/…/WasmEngineHost.java`, `WasmMain.java` | Befehl `human-match`; `emit` → `postMessage`, `awaitInput` → `Atomics.wait` |
| Eingabekanal | `engine/wasm/host/input-channel.js`, `worker-core.js` | SharedArrayBuffer mit einem Fach: Worker meldet `input.wait`, Seite schreibt genau eine Eingabe, Worker liest (§2) |
| Logging | `ForgeEngine.LOGGING` | eigene tinylog-Konfiguration ohne Aufrufer-Abfrage, auf JVM und Wasm (§7.1) |
| Reflection | `engine/scripts/ListSubscribers.java`, `gen-reflection-config.mjs` | alle `@Subscribe`-Methoden von Forge für Guavas EventBus registriert (§7.2) |
| Testspieler | `engine/bridge/…/smoke/ScriptedHuman.java` | spielt nur über das Protokoll, kennt keine Karte und keine Regel (wählt unter dem, was Forge anbietet); Varianten „verteidigt“ und „gibt auf“ |
| Wiederholung | `smoke/ReplayHost.java`, `engine/wasm/spike/replay-driver.js` | spielt aufgezeichnete Eingaben erneut ein (JVM bzw. Browser/Node) und vergleicht das Ende |
| Aufzeichner | `jvm/JvmHumanMatchMain.java` | JVM-Partie mit dem Testspieler; schreibt die Aufzeichnung (`openmana-input-transcript/1`) |
| Tests | `engine/bridge/src/test`, `engine/wasm/test/node-replay.mjs`, `browser-smoke.mjs --transcript` | JVM-Unit-Tests (Maven, 30 Tests), Wasm-Wiederholung in Node und Chrome, eingebunden in `engine/scripts/test-engine.sh` |
| Diagnoseseite | `engine/wasm/spike/` | zusätzlich Modus `?replay=<Aufzeichnung>`. **Keine Oberfläche** |

Nichts davon kennt eine Magic-Regel. Die Bridge formt Forges Views in JSON um,
reicht Eingaben an Forges eigene Controller-Methoden weiter (`selectCard`,
`selectPlayer`, `selectButtonOk/Cancel`, `concede`) und prüft Antworten nur
formal (Nummer vorhanden, Anzahl im von Forge genannten Rahmen, Summe gleich dem
von Forge genannten Gesamtwert).

## 2. So wartet Forge im Einzel-Thread auf den Menschen

Forge stellt Entscheidungen auf drei Wegen (Anvil, M2): als Methode mit
Rückgabewert, als Knopfzustand (`updateButtons`) und als wählbare Karten
(`setSelectables`). Die beiden letzten gehören zu einem `InputSyncronizedBase`,
der auf der JVM mit einem `CountDownLatch` schläft, bis ein **anderer** Thread
(Forges GUI) ihn löst. Im Browser gibt es keinen anderen Thread.

```
Forge (Spiel-Thread = der einzige Thread im Worker)
  InputPassPriority.showAndWait()
    └─ awaitLatchRelease()                    Patch 0004: im Synchronmodus Pumpe statt Latch-Warten
         └─ BridgeGuiGame.pumpOnce()          veraltete Fragen zurückziehen, Zustand senden
              └─ host.awaitInput()            Wasm: Worker postet input.wait, blockiert in Atomics.wait
                   ← Seite schreibt {"type":"card.tap","card":17} in den SharedArrayBuffer
              └─ controller.selectCard(…)     Forge entscheidet, was das Antippen heißt
                   └─ Forge öffnet InputSelectTargets.showAndWait()
                        └─ awaitLatchRelease() → pumpOnce() → awaitInput() …   (verschachtelt, derselbe Stack)
```

- **Blockierende Fragen** (Methoden mit Rückgabewert, z. B. `getChoices`,
  `confirm`, `order`) warten in `BridgeGuiGame.ask()` direkt auf ihre Antwort.
  Solange sie offen sind, wird nur **ihre** Antwort angenommen; Antippen und
  Antworten auf andere Fragen werden als `not-active` abgelehnt,
  `state.request` wird bedient, `concede` beendet die Partie sofort.
- **Zustand ohne Timer:** vor jeder Wartestelle geht der aktuelle Zustand
  hinaus; während KI-Zügen aus Forges `update*`-Rückrufen, gedrosselt auf
  höchstens alle 120 ms per Uhrvergleich (Anvil hatte einen 120-ms-Timer).
- **Zurückziehen ohne Timer:** Anvil verließ sich auf Forges
  „Warte auf Gegner“-Timer, der offene Knopf-/Auswahlfragen ersetzt. Der
  läuft im Synchronmodus nicht (Patch 0005); die Bridge zieht deshalb vor jeder
  Wartestelle Fragen zurück, deren Input nicht mehr läuft.
- **Eingabekanal (Browser):** ein SharedArrayBuffer mit Steuerwort, Länge und
  64 KiB Nutzlast. Der Worker postet `{type:"input.wait", n}` und blockiert mit
  `Atomics.wait`; die Seite beantwortet jedes `input.wait` mit genau einem
  `write()`, das den Worker per `Atomics.notify` weckt. Der Kanal weigert sich
  laut, eine ungelesene Eingabe zu überschreiben oder eine zu lange anzunehmen.
  Das ist bewusst die kleinste Form; die versionierte Warteschlange mit Lese-
  und Schreibzeiger ist Aufgabe von Prompt 03.

## 3. Protokoll des Spikes (Version `0.2-spike`)

JSON-Objekte mit Feld `type`. Englische Namen; §3.6 ordnet sie Anvils
deutschen Namen zu. Prompt 03 macht daraus das versionierte Schema in
`engine/protocol` — bis dahin ist `Protocol.java` die Quelle.

### 3.1 Engine → UI

| `type` | Felder | Bedeutung |
|---|---|---|
| `game.started` | `protocol`, `human`, `ai`, `aiProfile`, `format`, `cardNames` | Partie beginnt. `cardNames`: beide Decks in **einer** sortierten Liste ohne Besitzer (Bildvorladen, Anvil-Lehre) |
| `state` | `seq`, `running`, `turn`, `phase`, `activePlayer`, `me`, `players[]`, `stack[]`, `combat[]` | vollständiger Zustand (kein Delta), §3.5 |
| `events` | `entries[]` mit `kind`, `text`, evtl. `card`, `actor` (`me`/`opponent`) | Forges GameLog, Stufe MEDIUM, **vor** dem Zustand, den sie erklären |
| `message` | `text`, evtl. `title`, `card` + `cardView`, `incorrectAction` | Forges Hinweiszeile; `cardView`, weil die Karte beim Bezahlen in keiner Zone liegt (Anvil-Lehre) |
| `error` | `title`, `text` | Forges Fehlerdialog |
| `question` | `id`, `kind`, `text`, je Art weitere Felder (§3.3), evtl. `card` + `cardView` (welche Karte fragt) | eine Entscheidung |
| `question.withdrawn` | `id` | Forge hat die Frage zurückgezogen; normal, kein Fehler |
| `input.rejected` | `reason`, `detail`, `input` | eine Eingabe wurde **nicht** ausgeführt (§3.4) |
| `game.end` | `winner`, `reason`, `turns`, `result` (`win`/`loss`/`draw` aus Sicht des Spielers), `players[]`, `conceded` | Spielende |

### 3.2 UI → Engine

| `type` | Felder | Bedeutung |
|---|---|---|
| `answer` | `question` + je Art (§3.3) | eine Frage beantworten |
| `card.tap` | `card` | Karte antippen, **ohne** dass gefragt wurde — so wird bei Priorität gespielt, bezahlt, angegriffen, geblockt, beim Mulligan zurückgelegt. Forge entscheidet, was es heißt |
| `player.tap` | `player` | Spieler antippen (Forges `selectPlayer`, z. B. Spieler als Ziel). Neu gegenüber Anvil |
| `state.request` | — | frischen Zustand anfordern; wird jederzeit sofort bedient |
| `concede` | — | aufgeben; ohne zweite Rückfrage (Anvil-Lehre), Forge beendet die Partie |

Der Partiestart ist im Spike ein Worker-Befehl (`{"command":"human-match",
"seed", "format", "human": {"name","deck"}, "ai": {"name","profile","deck"}}`,
Decks als JSON mit englischen Kartennamen). Unbekannte oder von Forge nicht
unterstützte Karten stoppen den Start mit **vollständiger** Liste
(`unknownCards`), nichts wird still weggelassen.

### 3.3 Fragearten

| `kind` | Felder der Frage | Antwort | Forge-Weg |
|---|---|---|---|
| `select` | `min`, `max`, `cards` (Ids), `items` | `choices: [nr, …]` — jede Nummer wird wie ein Klick an Forge gegeben; die Frage bleibt offen, bis Forge die Auswahl ändert | `setSelectables` (Ziele, abwerfen …) |
| `choose` | `min`, `max`, `items`, evtl. `suggested` | `choices: [nr, …]` | `getChoices`, `chooseSingleEntityForEffect`, `chooseEntitiesForEffect` |
| `buttons` | `buttons: [{nr, label, enabled}]`, evtl. `purpose` | `button: 1 \| 2` (muss aktiv sein) | `updateButtons` |
| `confirm` | `suggested`, evtl. `yesLabel`/`noLabel`, `card` | `yes: true \| false` | `confirm`, `showConfirmDialog` |
| `options` | `items`, evtl. `suggested`, `cancellable`, `revealed` | `option: nr` (0 nur wenn `cancellable`) | `showOptionDialog`, `getAbilityToPlay`; mit `revealed` eine Anzeige mit einem OK (`reveal`, `getChoices` mit negativem Maximum) |
| `input` | `numeric`, `suggested`, evtl. `items` | `value: "…"` | `showInputDialog` |
| `order` | `top`, `remainingMin`, `remainingMax`, `items`, evtl. `suggested` | `order: [nr, …]` — Forges Doppelliste: gewählte Einträge in Reihenfolge, der Rest bleibt zurück, Anzahl in Forges Grenzen (negativ = beliebig) | `order` |
| `arrange` | `toTop`, `toBottom`, `toAnywhere`, `others`, `items` (nur die beweglichen Karten) | `top: [nr, …]`, `bottom: [nr, …]` — jede Karte genau einmal, nur auf erlaubte Seiten | `manipulateCardList` (Hellsicht u. ä.). **Neu** gegenüber Anvil |
| `distribute` | `total`, `min`, `items`, evtl. `card` | `amounts: [n, …]` parallel zu `items`, Summe = `total` | `assignCombatDamage`, `assignGenericAmount` |

`items`: `{nr, text, card?, cardView?, player?}`; eine Karte, die der Spieler
nicht sehen darf, steht nur als `{nr, hidden: true}` darin.

`purpose` bei `buttons` (Anvil: `anlass`), erkannt über Forges eigene
Beschriftungs-Schlüssel (`lblOK`, `lblEndTurn`, `lblKeep` …) bzw. den laufenden
Input: `priority`, `mulligan`, `mulliganBottom`, `payment`, `attack`,
`attackDeclared`, `block`.

### 3.4 Ablehnungen (`input.rejected.reason`)

| Grund | Wann | Frage danach |
|---|---|---|
| `stale` | Antwort auf eine unbekannte, zurückgezogene oder schon beantwortete Frage | – |
| `not-active` | eine blockierende Frage ist offen; nur sie kann jetzt beantwortet werden | bleibt offen |
| `invalid` | Antwort passt nicht (Knopf inaktiv, Nummer außerhalb, Anzahl/Summe falsch, doppelt) | bleibt offen |
| `malformed` | unbekannter `type` oder kein JSON-Objekt | – |
| `unknown-card` | keine für den Spieler sichtbare Karte mit dieser Id | – |
| `unknown-player` | kein Spieler mit dieser Id | – |
| `no-effect` | Forge hat das Antippen in diesem Schritt nicht angenommen | – |

### 3.5 Zustand (`state`)

- Spieler: `id`, `name`, `ai`, `me`, `life`, `hasPriority`, `canAct` (Forge:
  gibt es gerade überhaupt etwas zu tun), `lost`, `maxHandSize`, `landsPlayed`,
  `landsAllowed`, `counters`, `mana` (`W U B R G C`), `zones` (`battlefield`,
  `hand`, `graveyard`, `exile`, `command`), `library` (**nur die Anzahl**),
  `commanders` (`card`, `cast`, `tax` = 2 × `cast`, `damage[]`).
- Karte: `id`, `key` (englischer Oracle-Name, Schlüssel für Scryfall), `name`,
  `typeLine`, `cost`, `set`, `power`/`toughness` (nur wenn vorhanden),
  `loyalty`, `text` (nur Spielfeld, Kommandozone und eigene Hand), `colors`/`printedColors`
  (nur wenn geändert), `tapped`, `sick`, `faceDown`, `damage`, `owner`,
  `controller`, `attacking`, `blocking`, `token`, `phasedOut`, `counters`,
  `attachedTo`/`attached` und Forges Marker: `playable` (etwas lässt sich mit
  der Karte tun), `action` (was ein Antippen jetzt bewirkt, Forges Text),
  `ways` (mehrere Möglichkeiten), `highlighted` (Forges Markierung, z. B. beim
  London-Mulligan).
- **Verborgene Karten** (gegnerische Hand u. a., entschieden von Forges
  `mayView`): nur `{"hidden": true}` — **ohne Id**. Forge vergibt Karten-Ids in
  Decklisten-Reihenfolge; eine Id verriete die Karte (Anvil schickte sie mit).
- `stack[]`: `id`, `text`, `source`, `player`, `trigger`, `targets[]`;
  `combat[]`: `attacker`, `defender`, `defenderKind` (`player`/`card`),
  `blockers[]` (während des Blockens aus Forges geplanten Blockern, Anvil-Lehre).

### 3.6 Zuordnung Anvil → OpenMana

| Anvil (`PROTOKOLL.md`) | OpenMana-Spike |
|---|---|
| `art` | `type` |
| `partie.starten` | Worker-Befehl `human-match` (Decks als JSON statt Dateiname) |
| `gestartet` (+ `bilder`) | `game.started` (+ `cardNames`) |
| `zustand` | `state` |
| `ereignisse` (`neu[]`: `typ`, `text`, `karte`, `wer`) | `events` (`entries[]`: `kind`, `text`, `card`, `actor`) |
| `frage` (`nr`, `typ`, `punkte`, `vorschlag`) | `question` (`id`, `kind`, `items`, `suggested`) |
| `frage.weg` | `question.withdrawn` |
| `antwort` | `answer` |
| `karte.antippen` (`id`) | `card.tap` (`card`) |
| — | `player.tap` (neu) |
| `zustand.bitte` | `state.request` |
| `aufgeben` | `concede` |
| `meldung` (`ansicht`) | `message` (`cardView`) |
| `fehler` | `error` |
| `ende` (`sieger`, `grund`, `zuege`, `ergebnis` `sieg`/`niederlage`/`unentschieden`) | `game.end` (`winner`, `reason`, `turns`, `result` `win`/`loss`/`draw`) |
| — (Antwort still verworfen bzw. zurechtgebogen) | `input.rejected` (neu) |
| Fragearten `antippen`, `karten`, `knoepfe`, `jaNein`, `optionen`, `zahl`, `ordnen`, `verteilen` | `select`, `choose`, `buttons`, `confirm`, `options`, `input`, `order`, `distribute`; neu `arrange` |
| Antwortfelder `wahl`, `knopf`, `ja`, `zahl` (Option), `text`/`zahl` (Eingabe), `betraege` | `choices`/`order`, `button`, `yes`, `option`, `value`, `amounts` |
| `anlass` (`prioritaet` …) | `purpose` (`priority`, `mulligan`, `mulliganBottom`, `payment`, `attack`, `attackDeclared`, `block`) |
| Spieler: `ichSelbst`, `leben`, `marken`, `amDruecker`, `kannHandeln`, `handMax`, `laendereiGespielt`, `laendereiErlaubt`, `zonen` (`feld`, `hand`, `friedhof`, `exil`, `kommando`), `bibliothek`, `kommandanten` (`gewirkt`, `steuer`, `schaden`) | `me`, `life`, `counters`, `hasPriority`, `canAct`, `maxHandSize`, `landsPlayed`, `landsAllowed`, `zones` (`battlefield`, `hand`, `graveyard`, `exile`, `command`), `library`, `commanders` (`cast`, `tax`, `damage`) |
| Karte: `schluessel`, `typ`, `kosten`, `staerke`, `widerstand`, `loyalitaet`, `getappt`, `krank`, `schaden`, `greiftAn`, `blockt`, `spielstein`, `ausgephast`, `hervorgehoben`, `spielbar`, `aktion`, `haengtAn`, `angehaengt`, `farben`, `farbenGedruckt`, `verdeckt` | `key`, `typeLine`, `cost`, `power`, `toughness`, `loyalty`, `tapped`, `sick`, `damage`, `attacking`, `blocking`, `token`, `phasedOut`, `highlighted`, `playable`, `action`, `attachedTo`, `attached`, `colors`, `printedColors`, `hidden` |
| Kampf: `angreifer`, `verteidiger`, `verteidigerArt` (`spieler`/`karte`), `blocker[]` | `combat[]`: `attacker`, `defender`, `defenderKind` (`player`/`card`), `blockers[]` |
| `hallo`/`willkommen`, `abgeloest`, `decks`, `logs`, `log.holen`, `partie.beenden`, `voll` | entfallen (kein Server, keine Dateien; Abbruch = `worker.terminate()`) |

## 4. Nachweise

### 4.1 JVM-Tests (30, TestNG, laufen in jedem Maven-Build)

| Klasse | Tests | prüft |
|---|---|---|
| `HumanMatchTest` | 16 | drei volle Partien (Seeds 3, 11 und 5 „verteidigt“) + Wiederholungen: jede Partie endet mit Ergebnis aus Spielersicht; **alles auf einem Thread** (keine Thread-Verletzung, Forge startet keinen seiner Threads); Mulligan über Knöpfe + markierte Handkarten; Karten per Antippen bei Priorität (≥ 5 je Partie, Länder und Zauber im Forge-Protokoll); Kosten automatisch und von Hand; Ziele auf Karten (Auswahl) und Spieler (`player.tap`); Angriff und Block per Antippen (Forge zeigt den Blocker als blockend); alle blockierenden Fragearten (Hellsicht als `arrange` ohne verdeckte Karte, dreimal Modi, Abenteuer-Option, zwei Karten abwerfen); Rücknahmen und laute Ablehnung (unbekannte/zurückgezogene Frage, inaktiver Knopf, unbekannte Karte, Antippen während einer blockierenden Frage); `state.request` sofort bedient; verborgene Karten ohne Id und Name; gleicher Seed + gleiche Eingaben = gleiche Partie; **die Aufzeichnung allein reproduziert die Partie** (`ReplayHost`); Aufgeben endet sofort als Niederlage; unbekannte Karten stoppen den Start mit Bericht |
| `AnswersTest` | 8 | strenge Antwortprüfung je Frageart (Bereich, Anzahl, Doppelte, Summe, Forges Doppellisten-Grenzen, Seiten beim Anordnen) |
| `ForgeLoggingTest` | 1 | Forge loggt ohne Aufrufer-Abfrage (§7.1) |
| `AiSmokeMatchTest`, `ResourceBundleReaderTest` | 2 + 3 | aus Prompt 01, unverändert grün |

### 4.2 Engine-Testmatrix (`engine/scripts/test-engine.sh`)

Vier Mensch-Szenarien, je auf der JVM aufgezeichnet und in Node und Chrome
nachgespielt, dazu die KI-Partien aus Prompt 01 und der Negativtest:

| Szenario | Züge | Ende | Eingaben | Entscheidungsnachrichten | Forge-Protokoll (SHA-256) | Fingerabdruck (SHA-256) | JVM = Node = Chrome |
|---|---|---|---|---|---|---|---|
| `3` (Seed 3) | 15 | Niederlage | 44 | 147 | `c1e990c6…` | `6108436c…` | ja |
| `11` (Seed 11) | 14 | Niederlage | 54 | 175 | `7c3f673f…` | `99e5829c…` | ja |
| `5-defend` (Seed 5, greift nie an, blockt) | 15 | Niederlage | 52 | 172 | `e8213ffe…` | `4ac3ce30…` | ja |
| `3-concede` (Seed 3, gibt in Zug 4 auf) | 4 | Niederlage, `conceded` | 14 | 37 | `6737df12…` | `820f2000…` | ja |
| KI gegen KI, Seed 42 lazy/eager, Seed 7 (Prompt 01) | 20/20/24 | – | – | – | `d7611b0e…`, `0d52aafc…` | – | ja, unverändert |
| Chrome ohne COOP/COEP | – | klare Meldung nach 74 ms | – | – | – | – | – |

Verglichen wird bei jeder Wiederholung (`replay-driver.js`): Forge-Protokoll
(Hash + Anzahl Einträge), Fingerabdruck aller Nachrichten außer `state`/`events`
(Fragen mit Nummern, Rücknahmen, Ablehnungen, Hinweise, Start, Ende), Forges
GUI-Aufrufe je Methode (`updateZones`, `updateCards` … — wichtig für §7.2),
Zahl der Eingaben, Züge, Ergebnis, Sieger, Grund, Aufgabe; keine Forge-Fehler,
keine Arbeit auf anderen Threads, Ablehnungen je Grund wie auf der JVM,
gegnerische Hand nie sichtbar. `state` und `events` sind ausgenommen, weil ihr
Takt einer Uhr folgt.

Was die Testspieler in den vier Partien taten (Zähler aus den Aufzeichnungen):

| | `3` | `11` | `5-defend` | `3-concede` |
|---|---|---|---|---|
| Karten bei Priorität angetippt | 13 | 13 | 13 | 2 |
| Länder / Zauber im Forge-Protokoll | 7 / 7 | 3 / 10 | 4 / 10 | 1 / 1 |
| Zahlung automatisch / von Hand (Quellen angetippt) | 3 / 3 (4) | 5 / 5 (8) | 5 / 4 (6) | 1 / 0 |
| Mulligan genommen / London-Rücklage angetippt | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 |
| Ziele: Auswahl-Antworten / Spieler angetippt | 2 / 2 | 8 / 1 | 5 / 1 | 0 / 1 |
| Angreifer / Blocker angetippt | 2 / – | 1 / – | – / 2 (Forge zeigt sie danach als blockend) | – |
| blockierende Fragen | 3× Modus (Fiery Confluence), 1× Hellsicht (Magma Jet) | 1× Option (Abenteuer, Bonecrusher Giant), 2× Hellsicht | 3× Modus | – |
| Fragen gestellt / zurückgezogen | 50 / 37 | 61 / 46 | 61 / 44 | 11 / 7 |
| abgelehnt: stale / invalid / unknown-card / not-active | 2 / 1 / 1 / 1 | 2 / 1 / 1 / 1 | 2 / 1 / 1 / 1 | 2 / 1 / 1 / – |
| `state.request` bedient | 2 | 2 | 2 | 1 |
| gegnerische Handkarten in Zuständen, alle verborgen | 381 | 359 | 352 | 126 |

Die zusätzlichen Eingaben (Zustandswunsch, abgelehntes Antippen) ändern Forges
Partie nachweislich nicht: Seed 3 hat mit und ohne sie dasselbe
Forge-Protokoll `c1e990c6…`.

## 5. Messwerte

odin, sauberer Build auf `5a2ed62`, Chrome for Testing 153.0.8010.12 headless,
Node 22.22.3.

| Größe | Wert |
|---|---|
| Build gesamt | 310,5 s (Maven mit 30 Tests 50,4 s bei 2,4 GiB Spitze; `native-image` 107,7 s bei 5,8 GiB Spitze) |
| Wasm-Modul | 69,2 MiB roh, 19,5 MiB gzip -9, 13,2 MiB Brotli 11 (01: 68,7 / 19,4 / 13,1) — die Bridge kostet rund 0,5 MiB |
| Spielbereit (Worker gestartet → `ready`) | Chrome 3,3–3,5 s, Node 4,1–4,2 s (wie 01) |
| Partiedauer JVM (frische JVM) / Node / Chrome | Seed 3: 1,62 / 1,87 / 1,79 s · Seed 11: 2,08 / 2,46 / 2,36 s · 5-defend: 2,04 / 2,44 / 2,34 s · Aufgeben: 0,85 / 0,53 / 0,69 s |
| Antwortzeit der Engine je Eingabe (Eingabe geschrieben → nächstes `input.wait`, KI-Züge eingeschlossen) | Chrome: Median 4–11 ms, 95 % ≤ 206 ms, max. 262 ms · Node: Median 4–13 ms, 95 % ≤ 247 ms, max. 303 ms |
| Speicher Chrome (RSS aller Prozesse der Instanz) | Leerlauf 0,86–0,87 GiB, Spitze 1,74–1,81 GiB → Engine ≈ +0,88–0,94 GiB (01: +0,93 GiB); `measureUserAgentSpecificMemory`: Worker 502 MiB (KI-Partie: 501 MiB) |
| Speicher Node (Spitze des Prozesses) | 1,17–1,22 GiB (KI-Partien: 1,06–1,26 GiB) |

Eine Mensch-Partie kostet also gegenüber der KI-Partie aus Prompt 01 keinen
messbaren Speicher; die Engine antwortet auf eine Eingabe typisch in rund 10 ms
und bleibt auch mit KI-Zug unter einer Drittelsekunde.

## 6. Abweichungen von Anvil und warum

| Anvil | OpenMana-Spike | Grund |
|---|---|---|
| Antwort auf eine nicht mehr offene Frage wird still verworfen | `input.rejected` mit `stale` | Research §3.4 / Bible §16: nichts verschwindet still |
| Krumme Antworten werden zurechtgebogen (auffüllen, normieren) | abgelehnt (`invalid`), Frage bleibt offen | Bible §9.5: laut scheitern; die UI soll Fehler sehen, nicht verdeckt bekommen |
| Ohne Antwort nimmt der Dienst nach einer Weile den Vorschlag | kein Timeout, keine automatische Antwort | Research §3.4: echte Entscheidungen trifft nur der Mensch |
| Knopf-/Auswahl-Fragen beantwortet ein eigener Executor-Thread, Zustand per 120-ms-Timer | Input-Pumpe auf dem Spiel-Thread (Patch 0004), Zustand vor jeder Wartestelle + Uhrvergleich | im Browser gibt es genau einen Java-Thread |
| Offene Knopf-/Auswahlfragen verschwanden, sobald Forge neue setzte oder sein „Warte auf Gegner“-Timer sie ersetzte | Jede Frage gehört dem Input, der sie gestellt hat; vor jeder Wartestelle zieht die Bridge Fragen beendeter Inputs zurück. Eine Auswahl, die ein Input schon im Konstruktor nennt (`InputSelectTargets`), gehört dem nächsten wartenden Input | Forges Timer laufen im Synchronmodus nicht (Patch 0005); ohne die zweite Regel wäre jede Zielauswahl sofort wieder zurückgezogen worden |
| verborgene Karten mit Id (`verdeckt` + `id`) | nur `hidden: true`, ohne Id | Ids folgen der Deckliste und verrieten die Karte |
| `ordnen` ordnet immer alle Einträge | `order` mit Forges Doppellisten-Grenzen (`remainingMin/Max`) | sonst hätte z. B. ein „wähle beliebig viele“ alles gewählt |
| Hellsicht über `manipulateCardList` mit dem ganzen Stapel | eigene Art `arrange` nur mit den beweglichen Karten, Rest als Anzahl | Forge reicht die ganze Bibliothek herein; sie darf die Engine nicht verlassen |
| keine Spieler-Auswahl | `player.tap` | Forge bietet Spieler als Ziel über `selectPlayer` an |
| Partiestart mit Deck-Dateien, Mitschrift als Dateien, Netty-WebSocket | JSON-Decks, Verlauf über das Protokoll, `postMessage` + SharedArrayBuffer | kein Server, kein Dateisystem, keine Prozesse (Prompt-Vorgabe) |

## 7. Befunde

### 7.1 tinylog braucht im Wasm eine eigene Konfiguration (behoben)

Die erste Wasm-Partie brach **vor der ersten Eingabe** mit einer
`NullPointerException` ab. Mit Debug-Namen im Modul (neuer Schalter
`OPENMANA_WASM_DEBUG_NAMES=1` für `build-wasm.sh`) zeigte die Spur:
`InputSyncronizedBase.awaitLatchRelease` → `TaggedLogger.trace` →
`TinylogLoggingProvider.log` → `RuntimeProvider.getCallerClassName` →
`stripAnonymousPart(null)`. Forges `tinylog.properties` setzt Level je Paket
(`level@io.netty` …) und schreibt `{class-name}` in jede Zeile; beides lässt
tinylog 2.7 bei **jedem** aktiven Log-Aufruf die aufrufende Klasse auf dem
Java-Stack suchen. Web Image hat keinen solchen Stack, die Suche liefert `null`.
Betroffen wäre jede Forge-Logzeile gewesen, nicht nur diese; die KI-Partie aus
01 loggte zufällig nichts auf aktiven Stufen.

Lösung (`ForgeEngine.LOGGING`): Die Engine ersetzt Forges Konfiguration beim
Start auf **beiden** Laufzeiten durch `console`, Stufe INFO, Format
`[{level}] {message}` — ohne Aufrufer. Eine Kontrollzeile beim Start lässt die
Engine sofort scheitern, falls doch etwas den Aufrufer braucht. Im Maven-Test
startet TestNG (über SLF4J → `slf4j-tinylog`) tinylog schon vor dem ersten
Test; dort setzt Surefire dieselbe Konfiguration über `tinylog.configuration`,
und die Engine prüft, dass genau sie gilt.

### 7.2 Forges Ereignis-Abonnenten müssen vollständig registriert sein (behoben)

Forge verteilt Spielereignisse über Guavas EventBus (Spielprotokoll,
Ereignis-Handler der GUI, Sound, Haptik). EventBus findet seine
`@Subscribe`-Methoden per Reflection; im Image unsichtbare Methoden bekommen
**still** nichts. Registriert war bisher nur `GameLogFormatter.recieve` — über
die Tracing-Agent-Daten aus der KI-Partie von Prompt 01. Der Mensch-Pfad hängt
aber an `FControlGameEventHandler.receiveGameEvent` (daraus kommen
`updateZones`, `updateCards` …). `engine/scripts/ListSubscribers.java` sucht
jetzt beim Build alle `@Subscribe`-Methoden in Forges Klassen (10 in 8 Klassen)
und registriert sie; ein nicht ladbarer Klassenpfad bricht den Build ab. Der
Wiederholungstest vergleicht Forges GUI-Aufrufe je Methode zwischen JVM und
Wasm und würde ein Verstummen sofort melden.

### 7.3 Weitere Funde

- **Forges Mensch-Pfad startet ohne Patches Threads, die im Browser nie
  liefen:** den Netzwerk-Manager mit zwei Netty-Event-Loops bei jedem
  lokalen Spielstart (`FServerManager.getInstance()`, behoben mit 0006) und
  Komfort-Timer für Warteanzeigen (behoben mit 0005). Danach startet Forge
  während einer Partie keinen Thread mehr (Test prüft die Thread-Namen).
- **Nicht unterstützte Karten** baut Forge als Platzhalter ein und fragt
  später mit `getChoices(…, -1, -1)` nach ihnen; das lief in eine endlose
  Ablehnungsschleife. Jetzt stoppt der Start mit der Liste der Karten
  (`isUnsupported`), und negative Grenzen gelten als reine Anzeige (Anvil-Lehre).
- **`InputSelectTargets` nennt seine wählbaren Karten im Konstruktor**, bevor
  er als Input läuft. Die Auswahlfrage wäre deshalb sofort als „zu einem
  beendeten Input gehörig“ zurückgezogen worden; sie gehört jetzt dem nächsten
  wartenden Input.
- **Hellsicht reicht die ganze Bibliothek herein** (`manipulateCardList`):
  daraus wurde die eigene Frageart `arrange` mit nur den beweglichen Karten.
- **`order` ist Forges Doppelliste**, kein reines Sortieren: mit Grenzen, wie
  viele Einträge zurückbleiben dürfen oder müssen.
- **Mehrfachauswahl** (zwei Karten abwerfen): Die Auswahlfrage bleibt nach
  einer Antwort offen, bis Forge die wählbaren Karten ändert; sonst endete das
  Abwerfen nach der ersten Karte.
- **`/tmp` lief voll:** Während der Entwicklung blieben rund 30
  JVM-Testläufe à ~37 000 entpackte Dateien in `/tmp/openmana-engine-*`
  liegen, bis die Inodes des tmpfs erschöpft waren (1 048 575 von 1 048 576);
  andere Programme auf odin konnten ein paar Minuten lang keine Dateien in
  `/tmp` anlegen. Aufgeräumt; JVM-Läufe löschen ihr Verzeichnis jetzt beim
  Beenden (`TempRoot`), Tests entpacken unter `target/`.
- Die Seeds der KI-Partien aus 01 spielen weiter dieselben Partien: Patches,
  Bridge und Logging ändern Forges Spielverlauf nicht.

## 8. Bekannte Lücken (bewusst offen, mit Ziel-Prompt)

| Lücke | Wirkung heute | wohin |
|---|---|---|
| `distribute` bei Kampfschaden bietet den Verteidiger nicht an; Forge erwartet ihn als Schlüssel `null` und überlässt dem GUI die Regel „erst tödlicher Schaden an die Blocker“ beim Trampeln (Forges Desktop-Dialog nutzt Forge-Hilfen). `maySkip` wird nicht angeboten | konservativ: nie eine regelwidrige Zuteilung, aber kein Überschuss auf den Spieler. In den Testpartien nicht vorgekommen | 18/19 (Kampf) |
| `arrange` bietet „an beliebige Stelle“ (`toAnywhere`) noch nicht an; das Flag zeigt nur, dass Forge es erlauben würde | Karten lassen sich nur nach oben/unten legen | 15 (Entscheidungen) |
| Verdeckte Karten auf dem Spielfeld (Morph u. a.) des Gegners: ohne Id, also nicht antippbar/benennbar außerhalb einer Auswahlfrage | in den Testdecks nicht vorhanden | 13/17 (Spielfeld, Ziele): Forges eigene verdeckte Ids nutzen |
| `player.tap` meldet nicht, ob Forge den Spieler angenommen hat (`selectPlayer` hat keinen Rückgabewert) | eine wirkungslose Spieler-Auswahl bleibt ohne Meldung | 17 (Ziele) |
| Eingabekanal hat ein Fach und keine Versionsprüfung | reicht für eine Eingabe je Wartestelle | 03 (Transport und Protokoll) |
| Commander: `format: "commander"` und Kommandanten-Zustand sind verdrahtet, aber in keiner Mensch-Partie getestet | ungeprüft | 11/12 und Differenztests (05) |
| Sideboarding zwischen Partien (`sideboard` gibt `null`) | Deck bleibt unverändert; es gibt nur Einzelpartien | später bei Bedarf |
| Ein Worker spielt genau eine Partie (Forges statischer Zustand) | neuer Worker je Partie, ~4 s Start (Prompt 01) | 25 (Lebenszyklus) |

## 9. Offene Fragen der Research: Stand nach 02

| # | Frage | Stand |
|---|---|---|
| 1 | Läuft Forges Mensch-Pfad (`PlayerControllerHuman` + Inputs) im Einzel-Thread mit der Input-Pumpe für Mulligan, Priorität/Antippen, Kosten, Ziele, Angriff/Block und Commander-Wahl? | **Ja** für Mulligan, Priorität/Antippen, Kosten, Ziele, Angriff und Block, auf JVM, Node und Chrome (§4). **Option A gilt**, Option B wird nicht gebraucht. Die Commander-Wahl ist noch nicht in einer Mensch-Partie gelaufen → Prompts 11/12, Differenztests 05 |
| 3 | Verhaltensgleiche Übersetzung | weitere Belege: vier Mensch-Partien JVM = Node = Chrome, einschließlich aller Entscheidungsnachrichten und Forges GUI-Aufrufe. Vollständiger Differenztest bleibt Prompt 05 |

Die übrigen Fragen stehen unverändert wie in
[`01-engine-spike.md`](01-engine-spike.md) §7.

## 10. Reproduzieren

```bash
git submodule update --init --depth 1 engine/forge   # einmalig
(cd engine/wasm && npm ci)                            # einmalig
bash engine/scripts/build.sh                          # ~5 min, JVM-Tests laufen mit
bash engine/scripts/test-engine.sh                    # ~4 min: JVM, Node, Chrome, Negativtest
```

Ergebnisse: `engine/build/report/test-report.json`, je Lauf eine JSON-Datei in
`engine/build/report/runs/`, Aufzeichnungen in `engine/build/report/transcripts/`.
Eine Aufzeichnung einzeln: `node engine/wasm/test/node-replay.mjs --transcript
engine/build/report/transcripts/human-3.json` bzw. `node
engine/wasm/test/browser-smoke.mjs --transcript …`. Für lesbare Wasm-Stackspuren
bei der Fehlersuche: `OPENMANA_WASM_DEBUG_NAMES=1 bash engine/scripts/build-wasm.sh`
(Modul ~80 MiB, nicht für Auslieferung).

## 11. Was als Nächstes kommt

**Prompt 03 — Worker transport and protocol** (nicht begonnen): aus
`Protocol.java` und §3 wird `engine/protocol` mit Schema und TypeScript-Typen;
der Eingabekanal wird zur Warteschlange mit Lese-/Schreibzeiger, Überlauf- und
Versionsprüfung; `ready`/Fehler/technischer Abbruch als eigene Nachrichten.
Die Wiederholungstests dieses Prompts sind dafür die Messlatte: dieselben
Aufzeichnungen müssen auch über das neue Protokoll gleich enden.
