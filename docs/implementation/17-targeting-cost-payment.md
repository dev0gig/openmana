# 17 — Ziele und Kosten bezahlen

> Umsetzung des zentralen Tasks
> `dev0gig/dropzone/workflow/tasks/completed/openmana-17-targeting-cost-payment.md`,
> Stand **2026-09-28/29**, ausgeführt von Claude Code (Claude Opus 5.5) über den
> Dropzone-Master (`/dm openmana`). Grundlage: [`docs/BIBLE.md`](../BIBLE.md)
> §2 (Forge allein entscheidet über gültige Ziele), §6 („valid spell/ability
> targets are highlighted“), §9 („Cost payment, mulligans, targeting and
> combat need explicit protocol tests“), §10 („visible legal targets“),
> [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md) („Mulligan and cost payment
> have special Forge interaction paths“), Anvils `PROTOKOLL.md` („beim
> Mulligan und beim Bezahlen der Kosten darf also nichts gesperrt werden“),
> Forges `InputSelectTargets`, `TargetSelection`, `InputPayMana`,
> `InputPayManaOfCostPayment`, `ManaPool`, `InputSelectEntitiesFromList`, die
> Spielleiste der Prompts 13–16. Code: `engine/patches/0007-gui-read-only-answers.patch`,
> `engine/bridge/…/RunningInput.java`, `BridgeGuiGame`, `StateBuilder`,
> `TraceSnapshot`, `ScriptedHuman` (`target`), Testpartie `targets-payment`,
> `TargetPaymentTest`; `src/game/card-use.ts` (`playerUse`, `stepSource`),
> `decision-model.ts` (`selectView`, `paymentView`), `decision-panel.tsx`
> (`SelectPart`, `PlayerChoices`, `PaymentPart`, `PoolChoices`),
> `game-table.tsx` (`SeatPlayer`, „Quelle“), `table-labels.ts`
> (`manaSymbolsText`, `playerButtonLabel`), `src/components/ui/game-player.tsx`,
> `src/engine/engine-session.ts` (`tapPlayer`, `useMana`).

## Ergebnis

**Prompt 17 ist umgesetzt.** Zielen und Bezahlen kommen vollständig aus
Forges Daten – und nichts davon ist eine Regel der App:

- **Spieler als Ziel:** Nimmt Forges laufende Eingabe einen Spieler (ein Ziel,
  eine Wahl aus einer Liste, Leben für Phyrexia-Mana), markiert der Zustand
  ihn (`Player.selectable`, gold gestrichelt); gewählte Ziele trägt Forges
  Hervorhebung (`highlighted`, hell durchgezogen). Name und Lebenspunkte des
  Spielers sind dann ein Knopf – am Sitzplatz auf dem Tisch und im
  Entscheidungsbereich –, ein Tipp wirkt sofort (Forges `player.tap`), ein
  zweiter nimmt ein Ziel zurück. **Welche Spieler gültig sind, fragt die Bridge
  Forge selbst**, mit denselben Prüfungen, die Forges Klick ausführt (Patch
  0007); die Oberfläche rechnet nichts. §2.
- **Zahlen, die stimmen:** Eine Auswahl nennt Forges eigene Grenzen für Karten
  und Spieler zusammen („Wähle genau 1 · 0 gewählt · 2 Karten davon liegen auf
  dem Tisch“) – bisher kürzte die Bridge Forges Zielzahl auf die Zahl der
  Karten. §4.
- **Bezahlen sichtbar:** Solange Forge bezahlt, zeigt der Bereich, was noch zu
  zahlen ist („Noch zu zahlen: {1}{R}“, für Screenreader in Worten), die
  Farben schwebenden Manas, die Forge jetzt nähme (ein Knopf je Farbe, Forges
  Klick auf den Manavorrat, neue Eingabe `mana.use`), und bei Phyrexia-Mana
  das eigene Leben. Manaquellen auf dem Tisch werden wie bisher sofort
  angetippt. §3.
- **Die Quelle:** Die Karte, um die es im laufenden Schritt geht (der Spruch,
  die Quelle einer Fähigkeit), steht im Kopf des Bereichs und – liegt sie auf
  dem Tisch – mit „Quelle“ unter ihrem Bild. §5.
- **Verschachtelte Eingaben:** Modus, X, Kicker, Opfer während des Wirkens
  kommen als Forges Fragen der Reihe nach; eine blockierende Frage steht allein
  (die Knöpfe darunter warten), dann Ziele, dann Bezahlen. In echten Partien
  belegt (Abdeckung `cast-nested`). §6.
- **Anvils Sonderwege bleiben offen:** Beim Bezahlen und beim London-Mulligan
  hängt ein Tipp nie allein an `action`; ein `player.tap` oder `mana.use`, den
  Forge nicht nähme, kommt als `no-effect` zurück, statt still verschluckt zu
  werden (Lücke aus Prompt 02). §7.
- **Engine: Protokoll 6, Forge-Patch 0007.** Nachweis, dass das Nachfragen
  Forges Partie nicht verändert: dieselben Eingaben mit und ohne Nachfragen
  nachgespielt – Forges Spielprotokoll identisch. §8, §10.

Kein Blocker, keine Regel im Client.

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Forge-Patch | `engine/patches/0007-gui-read-only-answers.patch` | nur lesende Auskünfte: `InputSelectTargets.isSelectablePlayer`, `InputPayMana.getRemainingManaCost`, `canUseManaFromPool` (+ `ManaPool.canPayCostWithColor`), `isSelectablePlayer` (in `InputPayManaOfCostPayment`: Leben für Phyrexia-Mana); die Prüfungen der Klicks unverändert in gemeinsame Methoden verschoben |
| Bridge | `RunningInput.java`, `BridgeGuiGame`, `StateBuilder`, `TraceSnapshot`, `Protocol` | fragt die laufende Eingabe; `Player.selectable/highlighted`, `GameState.payment`, `mana.use`, `no-effect` für nicht genommene Spieler/Mana, ungekürzte Auswahlgrenzen, dieselben Angaben in der Engine-Spur |
| Protokoll 6 | `engine/protocol/schema/protocol.schema.json`, `README.md` | §8 |
| Client | `engine/client/src/engine-client.ts` | `useMana(color)`; blockierende Frage → `not-active` |
| Testspieler | `ScriptedHuman` | Spieler nur, wo markiert; `target: players`; Mana aus dem Vorrat, dann Leben beim Bezahlen |
| Testpartie | `engine/fixtures/differential/targets-payment.json`, Deck `smoke-rakdos-targets` | Rakdos gegen Grün: Schock, Lichtbogen-Spur (zwei Ziele), Dunkles Ritual, Gitaxianische Sonde, Zergliedern, Kolaghans Befehl, Heiße Glut (X), Explosiver Blitz (Kicker), Dorfriten; Seed 6 |
| JVM-Test | `TargetPaymentTest` | §9 |
| Spur-Werkzeug | `engine/wasm/spike/trace.ts` | neue Pflicht-Abdeckung `target-player-tap`, `target-multi`, `payment-pool`, `payment-life`, `cast-nested` |
| Oberfläche | `card-use.ts`, `decision-model.ts`, `decision-panel.tsx`, `game-table.tsx`, `table-labels.ts`, `game-player.tsx` | §2–§6 |
| Sitzung, Seite | `engine-session.ts`, `engine-session-context.tsx`, `game-page.tsx` | `tapPlayer`, `useMana` – nur solange Forge wartet, nie während einer Aufgabe; Ablehnungen als Toast bzw. Forges Hinweis |
| Szenen | `scripts/record-table-scenes.ts` → `src/test/fixtures/table-scenes.json` | neu: `target-both`, `payment`, `payment-pool`, `payment-life`, `cast-x`; `target` jetzt Zergliedern (nur Kreaturen), `target-player` mit Forges markierten Spielern |
| Prüfstand | `src/test/table-harness.tsx`, `scripts/e2e/run.ts` Abschnitt 12 | Spieler-Tipps und Mana aus dem Vorrat werden mitgeschrieben; Markierungen von Karten und Spielern getrennt gezählt |

## 2. Spieler als Ziel

Forges eigene Oberflächen machen jeden Spieler anklickbar und lassen die
laufende Eingabe einen sinnlosen Klick hinterher ablehnen
(`InputSelectTargets.onPlayerSelected` zeigt „Cannot target this player“).
OpenMana bietet nur an, was Forge nähme (Regel aus Prompt 14) – dafür braucht
es Forges Antwort **vorher**:

- **Patch 0007** verschiebt die Prüfungen aus `onPlayerSelected` unverändert,
  in derselben Reihenfolge, in `playerRefusal`; `isSelectablePlayer` fragt
  dieselbe Methode (oder: der Spieler ist schon gewähltes Ziel – ein Klick
  nimmt es zurück). Forges Verhalten bleibt dasselbe (§10.1: dieselbe Partie
  mit und ohne Nachfragen).
- **`RunningInput.takesPlayer`** fragt je laufender Eingabe: die Zielauswahl
  (`isSelectablePlayer`), die Wahl aus einer Liste (`getValidChoices`, schon
  öffentlich), das Bezahlen (Leben für Mana). Das Angreifen (Verteidiger) bleibt
  außen vor – Prompt 18; jede andere Eingabe ignoriert einen Spieler-Klick
  (`InputBase.onPlayerSelected` tut nichts).
- **Zustand:** `Player.selectable` (Forge nähme den Spieler jetzt),
  `Player.highlighted` (Forges Hervorhebung). Die Oberfläche liest beides in
  `playerUse`: Markierung „wählbar“/„gewählt“, der Tipp „Wählen“/„Auswahl
  aufheben“/„Mit Leben bezahlen“. Im Angriffsschritt hebt Forge den
  angegriffenen Spieler hervor – dort heißt die Markierung „wird angegriffen“,
  ohne Tipp.
- **Wo:** am Sitzplatz (Name und Lebenspunkte, `GamePlayerButton`: die
  Markierungen der Karten als Kontur innen, die keinen Platz braucht – §11.4)
  und im Entscheidungsbereich („Spieler, die Forge hier nimmt“, Gegner zuerst). Beide wirken sofort, ein Doppeltipp zählt einmal
  (`ARMING_MS`), gehaltene Tasten wiederholen nichts; solange Forge rechnet,
  bleiben sie sichtbar, aus, mit Grund.
- **Ablehnung:** Nähme Forges Eingabe den Spieler nicht, lehnt die Bridge den
  `player.tap` als `no-effect` ab – vorher kam er ohne Rückmeldung bei Forge an
  (`selectPlayer` hat keinen Rückgabewert; Lücke aus Prompt 02 §8).

**Mehrere Ziele:** Forges Zielzahlen stehen in der Auswahl (`min`/`max`), jetzt
ungekürzt, und „gewählt“ zählt Forges Hervorhebungen auf Karten und Spielern.
Lichtbogen-Spur hat zwei Teil-Fähigkeiten mit je einem Ziel; bleibt für das
zweite („ein anderes Ziel“) nur ein Kandidat, wählt Forge ihn selbst
(`TargetSelection`: „only one valid non-card, auto-target“) – so in der
Testpartie. Beide Ziele stehen danach am Stapeleintrag (Prompt 16).

## 3. Bezahlen

`GameState.payment` gibt es genau, solange Forges Bezahleingabe läuft:

- `cost`: was noch zu zahlen ist, **genau wie Forges Anweisung es zeigt**
  (`InputPayMana.getRemainingManaCost` = `manaCost.toString(false, pool)`, die
  Zeichenkette hinter „Zahle die Spruchkosten:“; der JVM-Test prüft es an jeder
  Stelle). Die Oberfläche zeigt Forges Symbole wie bei den Kartenkosten
  („{1}{B/P}{B/P}“) und liest sie Screenreadern Symbol für Symbol vor
  (`manaSymbolsText`: „1 beliebig, Schwarz oder Leben, …“) – reine Notation,
  keine Regel.
- `pool`: die Farben schwebenden Manas, mit denen Forge jetzt bezahlen würde
  (`ManaPool.canPayCostWithColor`: dasselbe Mana, das `tryPayCostWithColor`
  nähme, und dieselbe Prüfung `isNeeded`, ohne zu bezahlen). Je Farbe ein
  Knopf („Schwarz aus dem Vorrat (3)“) → `mana.use` → Forges
  `IGameController.useMana`, dieselbe Stelle wie der Klick auf Forges
  Manavorrat. Farben, die Forge nicht nähme, gibt es nicht als Knopf, und die
  Bridge lehnt sie ab (`no-effect`).
- **Leben für Phyrexia-Mana:** Forges Anweisung sagt es selbst („Klicke auf
  deine Lebenspunkte um phyrexianisches Mana zu bezahlen.“); der eigene Sitz ist
  dann markiert und ein Knopf, dazu einer im Bereich („Mit Leben statt Mana
  bezahlen“). Wann, sagt `InputPayManaOfCostPayment.isSelectablePlayer` – die
  Bedingung, unter der sein Klick 2 Leben verbucht.
- Manaquellen auf dem Tisch bleiben, was sie seit Prompt 14 sind: Forges
  Markierung, ein Tipp bezahlt sofort. Forges „Auto“ und „Abbrechen“ bleiben
  Forges Knöpfe; die App bezahlt nie selbst.

## 4. Zählen

`selectView` zählt Forges Zahlen, nie eigene: `countRule(min, max, Karten +
Spieler)`; „gewählt“ = Forges Hervorhebung auf den genannten Karten und den
Spielern (unbekannt, sobald eine Karte außerhalb des Zustands liegt). Liegen
genannte Karten auf dem Tisch, sagt der Bereich wie viele; Karten außerhalb
(Friedhof, Bibliothek, verdeckt) stehen als Reihe im Bereich (Prompt 15).

## 5. Die Quelle

Forge schickt mit der Zielauswahl und dem Bezahlen die Karte, um die es geht
(`card`/`cardView`, Prompt 15 – oft in keiner Zone: ein gewirkter Spruch hat
die Hand verlassen und liegt noch nicht auf dem Stapel). `stepSource` nimmt
genau diese Karte; der Kopf des Bereichs zeigt sie mit Bild, und liegt sie auf
dem Tisch (die Quelle einer aktivierten Fähigkeit), steht „Quelle“ unter ihrem
Bild und in ihrem Namen für Screenreader. Die Priorität nennt keine Quelle.

## 6. Verschachtelte Eingaben

Forge baut beim Wirken seine Eingaben aufeinander (`PlaySpellAbility`:
Ansagen wie X, Modi, Ziele, dann `CostPayment`). Jede kommt als eigene Frage,
die Oberfläche zeigt immer die jüngste; eine blockierende steht allein
(Prompt 15). Belegt in echten Partien: Heiße Glut fragt X (blockierend, über
Forges Prioritätsknöpfen; Szene `cast-x`), Zergliedern erst das Ziel, dann das
Bezahlen mit Leben, Lichtbogen-Spur das Ziel, dann das Bezahlen aus dem Vorrat
nach Dunklem Ritual. Die neue Abdeckung `cast-nested` zählt blockierende
Fragen zwischen dem Antippen einer Karte bei der Priorität und ihrem Weg auf
den Stapel.

## 7. Anvils Sonderwege

Anvil (PROTOKOLL.md): Beim Mulligan und beim Bezahlen antwortet Forge auf
„was täte ein Tipp“ nicht immer – wer daraus „geht nicht“ ableitet, sperrt sich
aus. Unverändert und jetzt mit Tests belegt:

- Beim Bezahlen tippt eine Karte sofort, wenn Forge sie markiert (`playable`),
  auch ohne Forges Worte (`card-use.test.ts`, Szene `payment`); der
  London-Mulligan tippt Handkarten ohne `action` (Prompt 14).
- `StateBuilder.mayAskAction` (Prompt 16) fragt beim Bezahlen die eigenen
  Karten – die Manaquellen – weiter; die Testpartie bezahlt von Hand, mit
  „Auto“, aus dem Vorrat und mit Leben.
- Neue Eingaben verschlucken nichts: ein Spieler oder eine Farbe, die Forge
  nicht nähme, kommt als `input.rejected` (`no-effect`) zurück und wird Forges
  Hinweis.

## 8. Engine: Protokoll 6 und Patch 0007

- **Protokoll 6** ([`engine/protocol/README.md`](../../engine/protocol/README.md)):
  `Player.selectable`, `Player.highlighted`, `GameState.payment` (`cost`,
  `pool`), Eingabe `mana.use`, ungekürzte `SelectQuestion.min/max`,
  `no-effect` für Spieler und Mana; die Engine-Spur trägt `players`,
  `highlightedPlayers` und `payment` (dieselben Fragen), so vergleichen die
  Differenztests sie auf JVM, Node und Chrome.
- **Patch 0007** ([`engine/patches/README.md`](../../engine/patches/README.md)):
  nur lesende Auskünfte. Die Patch-Regel ist dafür ausdrücklich erweitert:
  außer dem, was der Browser braucht, darf ein Patch eine Auskunft geben, die
  die Oberfläche braucht, um Forges Entscheidung vorher zu zeigen statt
  nachher zu raten – mit derselben, in eine gemeinsame Methode verschobenen
  Prüfung, ohne Wirkung. Die Alternative (Reflexion auf private Felder) wäre
  im Wasm-Bild stiller Bruch bei jedem Forge-Update; ein Patch scheitert beim
  Build laut (`prepare-forge.sh`).
- **Der Zeitpunkt:** Forges Zielauswahl nennt ihre Karten im Konstruktor, bevor
  sie läuft; Spieler kann die Bridge erst fragen, wenn sie läuft. Der Zustand
  unmittelbar vor der Auswahlfrage trägt die Markierung deshalb noch nicht, der
  vor dem ersten Warten schon – maßgeblich ist wie immer der jüngste Zustand.

## 9. Tests

| Test | Was |
|---|---|
| `TargetPaymentTest` (JVM, echte Partie `targets-payment`) | Spieler nur markiert, solange eine Auswahl oder ein Bezahlen offen ist; jeder `player.tap` auf einen markierten Spieler wird genommen (Hervorhebung bzw. Kosten ändern sich); ein Spieler-Tipp und `mana.use` bei der Priorität werden als `no-effect` abgelehnt; `payment` genau während Forges Bezahlens, `cost` = Forges Anweisung, `pool` nur Farben, die schweben, jedes `mana.use` bezahlt; Auswahlgrenzen über die Kartenzahl hinaus; **dieselben Eingaben ohne Nachfragen nachgespielt: Forges Spielprotokoll gleich** (auch die Commander-Partie) |
| `ProtocolContractTest`, Protokoll-, Client- und Spur-Tests (`engine/`) | `mana.use` im Vertrag, Beispiele mit den neuen Feldern, `useMana` im Client, die neuen Abdeckungskategorien (gebaute Spur) |
| Differenztests | die neue Partie in JVM, Node und Chrome gleich; Abdeckung aller Partien vollständig |
| `card-use.test.ts` | `playerUse` (wählbar, gewählt, zurücknehmen, Leben, Angriff, Gründe), `stepSource`, `source` |
| `decision-model.test.ts` | `selectView` mit Spielern (aufgenommen: `target`, `target-player`, `target-both`), `paymentView` (`payment`, `payment-pool`, `payment-life`) |
| `decision-panel.test.tsx` | Spieler-Knöpfe im Bereich und am Sitz, Doppeltipp einmal, Hervorhebung, Bezahlen von Hand, aus dem Vorrat, mit Leben, gesperrt während Forge rechnet, nur ansehen, X beim Wirken, „Quelle“ |
| `engine-session.test.ts`, `game-page.test.tsx` | `tapPlayer`/`useMana` nur solange Forge wartet, Gründe auf Deutsch; ein Spieler als Ziel über den echten Client, Forges Ablehnung als Hinweis |
| `table-labels.test.ts` | `manaSymbolsText`, `playerButtonLabel` |
| E2E Abschnitt 12 | die neuen Szenen in sechs Größen (Platz, axe, Markierungen von Karten und Spielern), Spieler im Bereich und am Sitz antippen, Mana aus dem Vorrat, Leben für Mana – in drei Größen |

## 10. Nachweise

**Commits:** `0c30509` Engine (Protokoll 6, Patch 0007, Bridge, Testspieler,
Testpartie, `TargetPaymentTest`), `4ff24f9` Test-Schalter und Nachweis „Nachfragen
ändert nichts“, `4488eb9` Oberfläche, Szenen, Prüfstand, `1ec3b38` Markierung
der Spieler als Kontur (Befund §11.4), danach Doku und Status. Engine-Build,
JVM-Tests und Differenztests auf **`4488eb9`** (`engineSourcesModified=false`;
`1ec3b38` ändert nur die Oberfläche), der Gesamtlauf `npm run check` auf
**`1ec3b38`**. Ein erster Durchgang von Build und Differenztests auf `0c30509`
war ebenfalls fehlerfrei. odin (Intel i7-8700T, Debian 13, stark belastet:
Lastmittel 12–15 durch parallele Sitzungen), Node 22.22.3, GraalVM
25.4.4.1.1, Chrome for Testing 153.0.8010.12.

### 10.1 Engine

- **Build** (`bash engine/scripts/build.sh`): 669,6 s, davon `native-image`
  193 s bei 5,5 GiB Spitze; Modul 79,10 MB roh / 13,10 MB Brotli, Worker
  29,7 KB Brotli. **70 JVM-Tests grün** (65 nach Prompt 16, dazu die fünf von
  `TargetPaymentTest`), darunter `PriorityStackTest`, `HumanMatchTest` und
  `ProtocolContractTest` mit `mana.use`.
- **Nachfragen ändert nichts:** Die Eingaben der Partie `targets-payment` und
  der Commander-Partie, ohne Nachfragen nachgespielt, ergeben Forges Spielprotokoll
  mit demselben Hash, dieselben Züge und Eingaben.
- **Differenztests** (`bash engine/scripts/test-engine.sh`, 27 min unter
  Last): **75 Läufe, 0 Fehler** (72 nach Prompt 16, dazu die neue Partie in
  JVM, Node und Chrome). `targets-payment` (11 Züge, 52 Eingaben):
  JVM = Node = Chrome – Forge-Protokoll `99aca058…`, die 174
  Protokollnachrichten `1aad7339…`, die Spur (192 Einträge / 1 442 Ereignisse)
  in Node und Chrome Eintrag für Eintrag gleich der JVM-Spur, jetzt mit den
  markierten Spielern und dem Bezahlstand an jedem Prüfpunkt. Abdeckung aller
  Partien vollständig; die neuen Pflicht-Kategorien zeigt `targets-payment`:
  `target-player-tap` 2, `target-multi` 1, `payment-pool` 2, `payment-life` 2,
  `cast-nested` 5 (dazu `human-3-de`: `cast-nested` 3, Spieler als Ziel 2).
- **Engine-Unit-Tests** (`npm run test:unit` in `engine/`): 82 grün (81 nach
  Prompt 16, dazu die gebaute Spur der neuen Kategorien).
- **Szenen** aus den Mitschnitten neu aufgenommen; eine zweite Aufnahme nach
  dem zweiten Differenzlauf ergab dieselben Zustände, Fragen und Anweisungen
  (nur die Nachrichtennummern verschieben sich – Forges Zustandsmeldungen
  während der KI-Züge sind zeitgedrosselt).

### 10.2 Statische Prüfungen und Unit-Tests

Erzeugte Dateien = Schemas, `tsc -b` und `oxlint` ohne Befund, **785
Vitest-Tests in 62 Dateien grün** (759 nach Prompt 16).

### 10.3 Browser-Gesamttest (`npm run check`, 746 s): **E2E OK, 0 Befunde**

- Abschnitt 12 zeigt die 24 aufgenommenen und 6 gebauten Szenen in sechs
  Größen: kein Seiten-Scroll, jeder Bereich im Fenster, Karten in ihren
  Reihen, axe 0 überall. Markierungen wie erwartet, jetzt auch die der
  Spieler (`target-player` 2, `target-both` 2 Karten + 2 Spieler,
  `payment-life` 2 Manaquellen + 1 Spieler, `commander-late` der angegriffene
  Spieler). Auf dem kleinen Handy (360 × 740) haben die Spielfelder mindestens
  80 px (`target-player` genau 80, `stack` 85, `payment-life` 90).
- Antworten in drei Größen (kleines Handy, Handy quer, Desktop): ein Spieler
  im Bereich angetippt → `player.tap` des Gegners; der Sitz doppelt angetippt →
  einmal; Leben für Phyrexia-Mana → `player.tap` des Spielers; Mana aus dem
  Vorrat → `mana.use` Schwarz. Keine Antwort, kein Karten-Tipp nebenbei.
- Die Live-Partie (Abschnitt 10) wie seit Prompt 16: behalten → Land → Weiter,
  Desktop und Handy.

## 11. Befunde

### 11.1 Die Testspieler-Regel ändert einige Referenzpartien

Der Testspieler tippt Spieler jetzt nur, wo Forge sie markiert, und sieht
Forges ungekürzte Zielzahlen: Wo er früher nach allen Karten die Knöpfe
drückte, tippt er nun noch einen markierten Spieler. Einige Referenzpartien
verlaufen dadurch anders (etwa die Commander-Partie). Dass es der Testspieler ist und nicht das Nachfragen: dieselben
Eingaben ohne Nachfragen nachgespielt ergeben dasselbe Forge-Protokoll
(`TargetPaymentTest.askingForgesRunningInputChangesNothing`). Die Szenen sind
neu aufgenommen; `commander-late` wählt seinen Moment jetzt ausdrücklich im
Schritt „Angreifer erklären“.

### 11.2 Forge wählt ein einziges Nicht-Karten-Ziel selbst

`TargetSelection` wählt ohne Frage, wenn keine Karte und genau ein Spieler
gültig ist (Lichtbogen-Spurs „anderes Ziel“ in der Testpartie). Eine echte Zielauswahl mit zwei offenen Zielen und einem schon
gewählten Spieler kam deshalb in keiner Partie vor; der Test der Hervorhebung
eines gewählten Spielers baut sie auf einer aufgenommenen Szene nach.

### 11.3 Die Markierung kommt einen Zustand nach der Auswahlfrage

Siehe §8 „Der Zeitpunkt“. Kein Fehler: Die Oberfläche zeigt immer den jüngsten
Zustand, und bevor Forge wartet, kommt immer einer.

### 11.4 Ein Rahmen um den Spieler kostete die Spielfelder ihre Höhe

Der erste Stand gab Name und Lebenspunkte den Rahmen der Karten (2 px Rand
ringsum, immer Platz dafür) und etwas Innenabstand. Jede Spielerleiste wurde
dadurch rund 8 px höher; auf dem kleinen Handy (360 × 740) blieben den
Spielfeldern in fünf Szenen mit Stapel nur noch 73–77 px statt der geforderten
80 px (E2E Abschnitt 12, „battlefields … px high“). Jetzt ist die Markierung
eine Kontur **innerhalb** des Kastens (`outline` mit negativem Abstand): Sie
braucht keinen Platz, die Leiste ist so hoch wie vor Prompt 17, markiert oder
nicht. Als Knopf auf Touch-Geräten bleibt die Mindesthöhe von 44 px.

## 12. Entscheidungen und Abweichungen

| Frage | Entscheidung | Grund |
|---|---|---|
| Woher weiß die App, welche Spieler gültig sind? | Forge-Patch mit nur lesender Auskunft, dieselbe Prüfung wie der Klick | Prompt 14: kein Tipp, der nachweislich nichts täte; Reflexion auf private Felder bräche still |
| Spieler am Sitz oder im Bereich? | beides, dieselbe Wirkung | der Sitz ist Forges Klickziel („klicke auf deine Lebenspunkte“), der Bereich sagt, was der Schritt nimmt – wie Karten außerhalb des Tisches |
| Manavorrat | Knopf je Farbe, die Forge nähme | Forges eigener Weg (`useMana`, der Klick auf seinen Manavorrat); ohne ihn bliebe schwebendes Mana nur Forges „Auto“ überlassen |
| Manasymbole | Forges Zeichenkette, für Screenreader in Worten | wie die Kartenkosten; Symbolbilder wären Kosmetik |
| Auswahlgrenzen | Forges eigene Zahlen | Karten und Spieler zählen zusammen; gekürzt stimmte „genau 1“ nicht |
| Angriffsschritt | Forges Hervorhebung „wird angegriffen“, kein Spieler-Tipp | der Verteidiger gehört zu Prompt 18 |

## 13. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Angriff: Verteidiger (Spieler, Planeswalker) wählen, Worte für Forges Knöpfe beim Angreifen/Blocken, `sick` | 18/19 |
| Friedhof/Exil blättern – Ziele dort stehen bis dahin als Reihe im Bereich | 20 |
| Forges englische Hinweise beim Zielen („Cannot target this player …“) und Stapeltexte | upstream / 26 |
| Ein Forge-Update, das die Prüfungen in `onPlayerSelected`/`tryPayCostWithColor` ändert, bricht Patch 0007 beim Build – dann den Patch nachziehen | 26 |

## 14. Reproduzieren

```bash
npx vitest run src/game/card-use.test.ts src/game/decision-model.test.ts src/game/decision-panel.test.tsx   # Sekunden
bash engine/scripts/build.sh                                         # u. a. TargetPaymentTest (echte Partien)
bash engine/scripts/test-engine.sh && node scripts/record-table-scenes.ts   # Differenztests, Szenen
npm run check                                                        # alles, inkl. E2E
```

## 15. Was als Nächstes kommt

Prompt 18 (Kampf: Angreifer): Angreifer und Verteidiger erklären, Forges
Knöpfe dabei in Worten, Einsatzverzögerung zeigen.
