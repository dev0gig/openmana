# 18 — Kampf: Angreifer

> Umsetzung des zentralen Tasks
> `dev0gig/dropzone/workflow/tasks/completed/openmana-18-combat-attackers.md`,
> Stand **2026-09-29**, ausgeführt von Claude Code (Claude Opus 5.5) über den
> Dropzone-Master (`/dm openmana`) in zwei Sitzungen: die erste baute Engine
> und Spieltisch (03:21–04:00), die zweite prüfte alles durch, behob die
> Befunde (§10.1, §10.6) und lieferte Verifikation und Doku. Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §2 (Forge allein entscheidet über Angriffe),
> §6 („valid attackers are obvious“, „summoning sickness has a clear,
> unobtrusive indicator“, „selected cards have a strong state“), §9 („combat
> need[s] explicit protocol tests“), §10 („attack/block guidance“,
> „summoning-sickness indicator“), [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md)
> („Structured data beats parsing“, Kampf als Regressionsschwerpunkt), Forges
> `InputAttack`, `CombatUtil.canAttack`, `PlayerControllerHuman.pushAttackerCandidates`
> und `declareAttackers`, `CardView.isSick`, `PhaseHandler`. Code:
> `engine/patches/0008-gui-attack-answers.patch`, `engine/bridge/…/RunningInput.java`
> (`attack`, `takesPlayer`), `BridgeGuiGame` (`meaningOf`), `StateBuilder`,
> `TraceSnapshot`, `ScriptedHuman` (`guided`), Testpartie `attackers`,
> `AttackersTest`, `Recorder`; `src/game/card-use.ts` (`declaration`,
> `attackUse`, `playerUse`), `attack-model.ts`, `attack-labels.ts`,
> `decision-panel.tsx` (`AttackDecision`, `DefenderChoices`), `game-table.tsx`
> (Kartenunterschrift, `tapCardNow`), `card-sheet.tsx`, `table-labels.ts`.

## Ergebnis

**Prompt 18 ist umgesetzt.** Beim Angreifen sieht ein Anfänger sofort, wer
angreifen kann, wer schon angreift, wer angegriffen wird – und warum eine
Kreatur zurückbleibt. Nichts davon ist eine Regel der App:

- **Wer angreifen kann:** Forges eigene Markierung (`playable`, gold
  gestrichelt, „kann angreifen“); ein Tipp wirkt sofort und trägt Forges
  Worte („Angriff mit Karte“). §3.
- **Wer angreift:** „greift an“, hell durchgezogen, dazu die Schwerter in der
  Kartenunterschrift. Ein Tipp tut, was Forges Worte an der Karte sagen
  (zurücknehmen, zum gewählten Ziel verlegen). §3.
- **Wer angegriffen wird:** der Spieler oder Planeswalker, den Forge als Ziel
  hervorhebt, heißt „wird angegriffen“; weitere Ziele, die Forge anbietet,
  „kann angegriffen werden“ – ein Tipp am Tisch oder ein Knopf im
  Entscheidungsbereich macht sie zum Ziel. §3, §6.
- **Warum nicht:** Forge nennt selbst den Grund, aus dem ein Tipp eine
  Kreatur nicht deklarieren würde – getappt, Einsatzverzögerung, ausgephast,
  aufgestachelt, eine Fähigkeit oder ein Effekt verbietet es (etwa
  Verteidiger), oder nur ein anderes Ziel ginge (Forge-Patch 0008, nur
  lesend). Der Grund steht unter der Karte, in ihrem Namen für
  Screenreader, in der Kartenansicht und vor dem ersten Angreifer im Bereich
  („Bleiben zurück“). §4.
- **Einsatzverzögerung:** eine Sanduhr an jeder Kreatur, für die Forge
  `sick` meldet (Eile schon berücksichtigt), „Einsatzverzögerung“ im Namen und
  in der Kartenansicht samt der Regel in Worten. §5.
- **Entscheidungsbereich:** ein klarer Satz aus Forges Zustand statt Forges
  holpriger Anweisung („Tippe die Kreaturen an, die die Forge-KI angreifen
  sollen.“), Forges Knöpfe nach ihrer Bedeutung – „Mit 2 Kreaturen
  angreifen“ / „Nicht angreifen“, „Alle angreifen“, „Alle zurück“. Vor dem
  ersten Angreifer erklärt er mehr, danach bleibt er so knapp wie die
  Priorität, damit die Spielfelder auch auf dem kleinen Handy Platz behalten.
  §6.
- **Engine: Protokoll 7, Forge-Patch 0008.** Nachweis, dass das Nachfragen
  Forges Partie nicht verändert: dieselben Eingaben mit und ohne Nachfragen
  nachgespielt – Forges Spielprotokoll identisch. §7, §9.

Kein Blocker, keine Regel im Client.

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Forge-Patch | `engine/patches/0008-gui-attack-answers.patch` | nur lesende Auskünfte: `CombatUtil.attackRefusal` (warum `canAttack` ablehnt; `canAttack` ist jetzt `attackRefusal == null`, die Prüfungen unverändert in derselben Reihenfolge verschoben), `InputAttack.getCurrentDefender`, `InputAttack.isSelectablePlayer` (die Prüfung aus `onPlayerSelected`/`onCardSelected` in `isDefender` verschoben) |
| Bridge | `RunningInput.attack`, `takesPlayer`, `BridgeGuiGame.meaningOf`, `StateBuilder`, `TraceSnapshot`, `Protocol` | `GameState.attack`, verteidigende Spieler als `selectable`, `Button.meaning` `declare`/`attackAll`/`callBack`, dieselben Angaben in der Engine-Spur |
| Protokoll 7 | `engine/protocol/schema/protocol.schema.json`, `README.md` | §7 |
| Testspieler | `ScriptedHuman` | Regel `guided`: abwechselnd drei Wege zu deklarieren; prüft bei jedem Zustand die Angaben zum Angriff gegen den Zustand |
| Testpartie | `engine/fixtures/differential/attackers.json`, Decks `smoke-green-attackers`, `smoke-green-walkers` | Grün gegen grüne Planeswalker, Seed 8, deutsch; Pflicht-Abdeckungen `attack-planeswalker`, `attack-defender`, `attack-all`, `attack-call-back`, `attack-unavailable-sick`, `-tapped`, `-restricted` |
| JVM-Test | `AttackersTest`, gemeinsamer Mitschreiber `Recorder` | §8 |
| Spur-Werkzeug | `engine/wasm/spike/trace.ts` | die neuen Abdeckungen; ihre Zählregeln mit gebauter Spur geprüft (`trace.test.ts`) |
| Oberfläche | `card-use.ts`, `attack-model.ts`, `attack-labels.ts`, `decision-panel.tsx`, `game-table.tsx`, `card-sheet.tsx`, `table-labels.ts` | §3–§6 |
| Szenen | `scripts/record-table-scenes.ts` → `src/test/fixtures/table-scenes.json` | neu: `attack` (noch kein Angreifer, drei Gründe), `attack-declared` (Angreifer, „Zurückrufen“), `attack-planeswalker` (ein Planeswalker ist das Ziel, drei Ziele) |
| Prüfstand | `scripts/e2e/run.ts` Abschnitt 12 | die drei Szenen in sechs Größen mit erwarteten Markierungen; „Alle angreifen“, „Alle zurück“ und ein Zielwechsel im Bereich werden mitgeschrieben |

## 2. Forges Angriffserklärung im Zustand

`GameState.attack` gibt es genau, solange Forges Angriffs-Eingabe
(`InputAttack`) für den Spieler läuft:

- `defender`: wen eine jetzt angetippte Kreatur angreift – Forges aktuelles
  Ziel, das es selbst hervorhebt (`InputAttack.getCurrentDefender`).
- `defenders`: alles, was Forge angreifen lässt, in Forges Reihenfolge
  (Spieler, Planeswalker, Kämpfe – `Combat.getDefenders`).
- `unavailable`: die Kreaturen des Spielers auf dem Spielfeld, die noch nicht
  angreifen und die ein Tipp jetzt nicht deklarieren würde, je mit Forges
  Grund. Forges Tipp deklariert eine Kreatur genau dann, wenn
  `CombatUtil.canAttack(Kreatur, aktuelles Ziel)` gilt (`onCardSelected`);
  **Patch 0008** verschiebt die Prüfungen von `canAttack` unverändert in
  `attackRefusal`, das den ersten ablehnenden Grund nennt (die frühere
  Sammelprüfung ist in Einzelprüfungen in ihrer eigenen Reihenfolge zerlegt,
  das Kurzschlussverhalten bleibt). Ginge die Kreatur gegen ein anderes der
  angebotenen Ziele, meldet die Bridge `defender` statt Forges Grund.

Die Bridge fragt nur (`RunningInput.attack`); jede Ausnahme beim Fragen lässt
die Angabe weg, statt die Partie zu stören. Dieselbe Frage steht in der
Engine-Spur (`TraceMarkers.attack`), so vergleichen die Differenztests sie auf
JVM, Node und Chrome Eintrag für Eintrag.

**Verteidigende Spieler:** `Player.selectable` gilt jetzt auch beim
Angreifen – für einen verteidigenden Spieler, der nicht schon das Ziel ist
(`InputAttack.isSelectablePlayer`). Ein `player.tap` auf das aktuelle Ziel
oder auf sich selbst lehnt die Bridge als `no-effect` ab; vorher nahm das
Angreifen jeden Spieler-Tipp still an (Lücke aus Prompt 17).

**Knöpfe:** Forge zeigt beim Angreifen OK und als zweiten Knopf „Alle
angreifen“ (Alpha Strike) oder – sobald Angreifer deklariert sind –
„Zurückrufen“ (`InputAttack.updatePrompt`). Die Bridge liest Forges eigene
Beschriftungsschlüssel (`lblOK`, `lblAlphaStrike`, `lblCallBack`) wie bei der
Priorität und schickt die Bedeutung mit.

## 3. Markierungen auf dem Tisch

`cardUse` (`card-use.ts`) liest Forges Erklärung nur, solange ihre Knöpfe der
laufende Schritt sind und keine Auswahl darüber liegt (`declaration`):

| Karte | Markierung | Tipp |
|---|---|---|
| eigene Kreatur, die Forge markiert (`playable`) und nicht ablehnt | „kann angreifen“, gold gestrichelt | sofort, Forges Worte („Angriff mit Karte“) |
| eigener Angreifer (`attacking`) | „greift an“, hell durchgezogen | sofort, Forges Worte – Forge nimmt ihn vom aktuellen Ziel zurück („Karte aus dem Kampf entfernen“), verlegt ihn von einem anderen Ziel zum aktuellen oder bildet mit Banding eine Gruppe |
| das aktuelle Ziel (Planeswalker, Kampf) | „wird angegriffen“ | keiner (änderte nichts) |
| ein anderes angebotenes Ziel | „kann angegriffen werden“ | sofort (`card.tap`, Forges Worte „Angreifer für Karte deklarieren“) |
| eigene Kreatur, die Forge ablehnt | keine | keiner; Forges Grund (§4) |
| alles andere | die allgemeinen Regeln (Prompt 14) | |

Ziele gelten, wie Forge sie nennt, **auf beiden Seiten**: Einen Kampf
(Belagerung), den der Spieler kontrolliert und ein Gegner beschützt, greift
der Spieler an (§10.1 c). Spieler zeigt `playerUse`: der angegriffene
„wird angegriffen“, ein anderer verteidigender Spieler „kann angegriffen
werden“ mit dem Tipp „Angreifen“.

## 4. Warum eine Kreatur zurückbleibt

Forges Grund (`AttackRefusal`) in den Worten der deutschen Regeln
(`ATTACK_REFUSAL_WORDS`, je ein kurzes Wort und ein Satz):

| Grund | kurz | Satz |
|---|---|---|
| `tapped` | getappt | Getappte Kreaturen können nicht angreifen. |
| `sick` | Einsatzverzögerung | Sie ist erst seit diesem Zug unter deiner Kontrolle und kann noch nicht angreifen. |
| `phasedOut` | ausgephast | Ausgephaste Kreaturen gelten als nicht im Spiel. |
| `goaded` | aufgestachelt | … muss einen Spieler angreifen, der sie nicht aufgestachelt hat. |
| `restricted` | darf nicht angreifen | Eine Fähigkeit oder ein Effekt verbietet ihr den Angriff – etwa Verteidiger. Die Karte sagt, welche. |
| `defender` | nicht dieses Ziel | Dieses Angriffsziel darf sie nicht angreifen, ein anderes schon – wähle erst das andere Ziel. |
| `notCreature`, `tooLate` | der Vollständigkeit halber | |

Der Satz zu `sick` stimmt, weil nur im eigenen Zug angegriffen wird: Eine
Kreatur mit Einsatzverzögerung kam dann in diesem Zug unter die Kontrolle des
Spielers. Wo: unter der Karte (Zeichen und kurzes Wort statt der Werte), im
Namen der Karte („kann nicht angreifen: getappt“), in der Kartenansicht
(„Kann gerade nicht angreifen: …“ und der Satz, statt eines Angebots) und vor
dem ersten Angreifer im Bereich („Bleiben zurück: Llanowarelfen (getappt),
…“). Die App leitet nie selbst einen Grund ab (kein „getappt, also kann sie
nicht angreifen“).

## 5. Einsatzverzögerung

`VisibleCard.sick` ist Forges `CardView.isSick()`: auf dem Spielfeld, eine
Kreatur, noch nicht seit Beginn des letzten Zuges ihres Spielers unter dessen
Kontrolle, ohne Eile. Die Sanduhr steht in der Kartenunterschrift jeder
solchen Kreatur, auf beiden Seiten und in jedem Schritt, „Einsatzverzögerung“
im Namen für Screenreader und in der Kartenansicht mit der Regel (Umfassende
Regeln 302.6): „Noch nicht seit Beginn des letzten Zuges ihres Spielers unter
dessen Kontrolle. Bis sein nächster Zug beginnt, kann sie nicht angreifen und
keine Fähigkeiten mit {T} in den Kosten aktivieren.“ Forge beendet sie erst,
wenn der nächste Zug ihres Spielers beginnt (`PhaseHandler`): Eine Kreatur der
KI aus deren Zug trägt sie im Zug des Spielers noch (§10.1 e).

Ob eine Kreatur **angreifen** kann, entscheidet dagegen `CombatUtil` – das
kennt Effekte wie „kann angreifen, als hätte sie Eile“ (`CanAttackIfHaste`).
Deshalb kommt der Grund beim Angreifen aus `attackRefusal`, die Sanduhr aus
`sick`; beides von Forge.

## 6. Der Entscheidungsbereich

`AttackDecision` (`decision-panel.tsx`, Daten aus `attack-model.ts`, Worte aus
`attack-labels.ts`):

- **Überschrift:** wen angetippte Kreaturen angreifen und wer bisher angreift
  (`attackText`): „Tippe die Kreaturen an, die die Forge-KI angreifen
  sollen.“ / „2 Kreaturen greifen an. Weitere, die du antippst, greifen
  „Garruk Wildsprecher“ an.“ – statt Forges Anweisung, die den Namen des
  Ziels mitten in den Satz setzt („Wähle angreifende Kreaturen oder Forge AI
  wähle den anzugreifenden Spieler/Planeswalker“).
- **Ziele:** Bietet Forge mehrere an, stehen sie als Reihe da: das aktuelle
  markiert zum Lesen (für Screenreader „wird angegriffen“), die anderen als
  Knöpfe, die sofort wirken (`player.tap` bzw. `card.tap`, gegen Doppeltipp
  geschützt).
- **Hinweise vor dem ersten Angreifer** (der Kampf ist leer, der Bereich darf
  wachsen): wie viele Kreaturen ein Tipp deklarieren würde (Forges Markierung
  ohne die, die es für das aktuelle Ziel ablehnt), wie das Antippen wirkt
  (bei mehreren Zielen „… das gewählte Ziel angreifen“), wer zurückbleibt und
  warum („Bleiben zurück: Llanowarelfen (getappt), …“), was OK tut („‚Nicht
  angreifen‘ lässt den Angriff in diesem Zug aus.“).
- **Mit Angreifern** zeigt der Tisch den Kampf, und der Bereich hält das Maß
  der Priorität (Prompt 16): der Satz, ein Hinweis – „Ein zweiter Tipp nimmt
  eine Kreatur zurück. Mit dem Bestätigen steht der Angriff fest.“ (Anvils
  Lehre: ein Tipp wirkt sofort, also muss der Satz sagen, wie man ihn
  zurücknimmt) – und die Knöpfe in einer Zeile. Die Gründe stehen weiter
  unter den Karten. Sonst nähme der Bereich auf dem kleinen Handy den
  Spielfeldern die letzte Kartenreihe (§10.6).
- **Knöpfe nach Bedeutung:** `declare` → „Mit n Kreaturen angreifen“ /
  „Nicht angreifen“, `attackAll` → Forges „Alle angreifen“, `callBack` →
  „Alle zurück“ (Forges „Zurückrufen“ sagt nicht, dass es alle sind; kurz
  genug, dass beide Knöpfe auf 360 px in eine Zeile passen).
  Ohne Bedeutung bleiben Forges Worte. Die Knöpfe sind wie alle sendenden
  Knöpfe erst `ARMING_MS` nach der Frage scharf; nichts wird für den Spieler
  deklariert oder bestätigt.

## 7. Engine: Protokoll 7 und Patch 0008

- **Protokoll 7** ([`engine/protocol/README.md`](../../engine/protocol/README.md)):
  `GameState.attack` (`defender`, `defenders`, `unavailable` mit
  `AttackRefusal`), `EntityRef`, `Player.selectable` auch für verteidigende
  Spieler, `ButtonMeaning` `declare`/`attackAll`/`callBack`,
  `TraceMarkers.attack`. `ProtocolContractTest` hält die Konstanten der Bridge
  (`ATTACK_REFUSAL_*`, `MEANING_*`) mit dem Schema gleich.
- **Patch 0008** ([`engine/patches/README.md`](../../engine/patches/README.md)):
  nur lesende Auskünfte nach der Regel aus Prompt 17 – dieselbe Prüfung wie
  Forges Klick, in eine gemeinsame Methode verschoben, ohne Wirkung. Ein
  Forge-Update, das `canAttack` oder `InputAttack` ändert, lässt den Patch beim
  Build laut scheitern (`prepare-forge.sh`).

## 8. Tests

| Test | Was |
|---|---|
| `AttackersTest` (JVM, echte Partie `attackers`) | die Erklärung genau, solange Forges Angriffsknöpfe offen sind; das Ziel ist eines der Ziele, der Gegner immer eines; jede eigene Kreatur, die noch nicht angreift, hat entweder Forges Angriffs-Angebot oder einen Grund – nie beides; getappt und Einsatzverzögerung stimmen mit der Karte; jeder Tipp auf ein anderes Ziel wird genommen und macht es zum Ziel (Planeswalker und Spieler); ein Tipp auf sich selbst, auf das aktuelle Ziel und auf eine abgelehnte Kreatur kommt als `no-effect` zurück; die Knöpfe tragen ihre Bedeutung; **dieselben Eingaben ohne Nachfragen: Forges Spielprotokoll gleich** |
| `ProtocolContractTest`, `PriorityStackTest` | `AttackRefusal` im Vertrag; Bedeutungen außerhalb der Priorität nur beim Angreifen |
| `trace.test.ts` (Engine-Unit-Test) | die Zählregeln der neuen Abdeckungen mit gebauter Spur: ein Tipp auf das schon gewählte Ziel und ein abgelehnter Tipp sind kein Zielwechsel, der Angriff der KI nicht der des Spielers |
| Differenztests | die neue Partie in JVM, Node und Chrome gleich; Abdeckung aller Partien vollständig |
| `attack.test.tsx` | auf den Szenen `attack`, `attack-declared`, `attack-planeswalker`: Markierungen, Taps und Gründe (`card-use.ts`), der Satz, die Hinweise und „Bleiben zurück“ vor dem ersten Angreifer, mit Angreifern nur der eine Hinweis (die Gründe unter den Karten), Knöpfe nach Bedeutung (einmal gesendet, erst scharf), Ziele im Bereich (das aktuelle ohne Knopf, der Zielwechsel als `player.tap`, Doppeltipp einmal), Grund und Einsatzverzögerung an der Karte und in der Kartenansicht; gebaut: eine Kreatur, die nur ein anderes Ziel angreifen dürfte, und ein Ziel auf der eigenen Seite |
| `card-use.test.ts`, `game-table.test.tsx`, `table-model.test.ts` | Angreifer in `commander-late` jetzt „greift an“; Einsatzverzögerung im Namen; die neuen Szenen im Schema |
| E2E Abschnitt 12 | die drei Szenen in sechs Größen (Platz, axe, erwartete Markierungen von Karten und Spielern); „Alle angreifen“, „Alle zurück“ und ein Zielwechsel im Bereich werden mitgeschrieben |

## 9. Nachweise

**Commits:** `b2191e0` Engine (Protokoll 7, Patch 0008, Bridge, Testspieler
`guided`, Testpartie `attackers`, `AttackersTest`, `Recorder`), `31bb92c`
Engine-Doku und der Versions-Test des Worker-Hosts, `852a353` Oberfläche,
Szenen, Prüfstand, `90da05c` die Befunde der Selbstprüfung (§10.1),
`466c3f7` Unit-Test der Zählregeln, `74dd0f2` ein Kommentar, `7d297d1` der
kompakte Angriffsbereich (Befund des Browser-Gesamttests, §10.6), danach
Doku und Status. odin (Intel i7-8700T, 15,5 GiB, Debian 13; parallel lief
eine andere Sitzung mit Android-Emulator und Gradle – die schweren Läufe
starteten deshalb erst bei freiem Speicher und hatten einen Speicherschutz,
der sie vor earlyoom selbst beendet hätte; er griff nie), Node 22.22.3,
Chrome for Testing 153.0.8010.12.

### 9.1 Engine

- **Build** (`bash engine/scripts/build.sh`, erste Sitzung, 03:44–03:52):
  474 s, davon `native-image` 154 s bei 5,3 GiB Spitze; Modul 75,3 MiB roh /
  12,5 MiB Brotli, Worker 29,8 KiB Brotli, 6 898 Klassen, keine aus den
  Netzspiel-Bibliotheken. Vermerk `openmana.commit=b2191e0`,
  `engineSourcesModified=true` (§10.4).
- **Gleich dem committeten Stand** (zweite Sitzung, `466c3f7`): die
  Bridge-Quellen der Build-Kopie = `engine/bridge/src` (bis auf die beim Build
  erzeugten Properties), der Patch-Hash `2418d61b…` = der der committeten
  Patches, der Worker aus dem committeten Stand nachgebaut byte-gleich
  (`5f5a0124…`, wie im Manifest); seit `b2191e0` sind in `engine/` nur zwei
  READMEs und `worker-host.test.ts` geändert.
- **75 JVM-Tests grün** (70 nach Prompt 17, dazu die fünf von
  `AttackersTest`; Maven 111 s bei 2,4 GiB Spitze), darunter
  `AttackersTest` mit „Nachfragen ändert nichts“ (Forges Spielprotokoll mit
  und ohne Nachfragen gleich), `PriorityStackTest`, `TargetPaymentTest` und
  `ProtocolContractTest` mit `AttackRefusal`.
- **Engine-Unit-Tests** (`npm run test:unit` in `engine/`, `466c3f7`): 83
  grün (82 nach Prompt 17, dazu die Zählregeln der Angriffs-Abdeckung);
  `check:generated` und `tsc` ohne Befund.
- **Differenztests** (`bash engine/scripts/test-engine.sh`, `466c3f7`, 18 min
  11 s): **78 Läufe, 0 Fehler** (75 nach Prompt 17, dazu die neue Partie in
  JVM, Node und Chrome). `attackers` (15 Züge, 52 Eingaben): JVM = Node =
  Chrome – Forge-Protokoll `fc1123d9…`, die 216 Protokollnachrichten
  `d12fe66d…` und Forges GUI-Aufrufe, die Spur (244 Einträge / 1 952
  Ereignisse, `6caad83e…`) in Node und Chrome Eintrag für Eintrag gleich der
  JVM-Spur, jetzt mit Forges Angriffserklärung an jedem Prüfpunkt. Abdeckung
  aller 14 Partien vollständig; die neuen Pflicht-Kategorien zeigt
  `attackers`: `attack-planeswalker` 1, `attack-defender` 2, `attack-all` 2,
  `attack-call-back` 1, `attack-unavailable-sick` 2, `-tapped` 2,
  `-restricted` 4 (Einsatzverzögerung als Grund auch in `stack-response` 12,
  `blocks-double` 11, `blocks-multi` 8, `commander` 2). Die übrigen Partien
  verlaufen wie zuvor, etwa `targets-payment` mit Forge-Protokoll
  `99aca058…` wie nach Prompt 17. Spitze: Node 1,5 GiB, Chrome 2,1 GiB.
- **Szenen** aus den Mitschnitten dieses Laufs neu aufgenommen: alle 27
  Szenen gleich in Zustand, Fragen, Anweisung und Hinweisen; sechs
  unterscheiden sich nur in der Nummer der Zustandsnachricht (`seq` – Forges
  Zustandsmeldungen während der KI-Züge sind zeitgedrosselt). Die committete
  Szenendatei bleibt.

### 9.2 Statische Prüfungen und Unit-Tests

Erzeugte Dateien = Schemas, `tsc -b` und `oxlint` ohne Befund, **800
Vitest-Tests in 63 Dateien grün** (785 nach Prompt 17; 795 nach der ersten
Sitzung, dazu vier Tests zu den Befunden aus §10.1 und einer zum kompakten
Bereich, §10.6) – im Lauf `npm run check` auf `7d297d1`.

### 9.3 Browser-Gesamttest (`npm run check`, 12 min 41 s auf `7d297d1`): **E2E OK, 0 Befunde**

- Der erste Lauf (auf `74dd0f2`, 799 Vitest-Tests grün) fand genau einen
  Befund: `commander-late` auf dem kleinen Handy, Spielfelder 75 statt 80 px
  (§10.6). Nach der Korrektur `7d297d1` lief der zweite ohne Befund.
- Abschnitt 12 zeigt die 27 aufgenommenen und 6 gebauten Szenen in sechs
  Größen: kein Seiten-Scroll, jeder Bereich im Fenster, Karten in ihren
  Reihen, axe 0 überall. Markierungen wie erwartet: `attack` eine Kreatur
  „kann angreifen“ und der angegriffene Spieler, `attack-declared` ein
  Angreifer, `attack-planeswalker` die bereite Kreatur und Nissa, Garruk
  „wird angegriffen“, der Spieler als anderes Ziel, `commander-late` 14
  Angreifer. Auf dem kleinen Handy (360 × 740): `commander-late` Bereich 180
  statt 207 px (Inhalt 179 statt 291), Spielfelder 89 px; `attack-declared`
  128 px, `attack` 113 px und `attack-planeswalker` 100 px (beide `expanded`,
  der Kampf ist noch leer).
- Antworten in drei Größen (kleines Handy, Handy quer, Desktop): „Alle
  angreifen“ und „Alle zurück“ → Forges Knopf 2, ein anderes Ziel im Bereich
  → `player.tap` des Gegners; keine Antwort nebenbei.
- Die Live-Partie (Abschnitt 10) wie seit Prompt 16: behalten → Land →
  Weiter, Desktop und Handy.

## 10. Befunde

### 10.1 Selbstprüfung: fünf Fehler der ersten Sitzung behoben

Die zweite Sitzung ging den ganzen Diff gegen Forges Quelltext durch
(`InputAttack`, `CombatUtil`, `CardView`, `PhaseHandler`) und behob:

a. **Die Zahl der bereiten Kreaturen** („n weitere Kreaturen können
   angreifen (gold gestrichelt)“) zählte Forges Markierung. Die setzt Forge
   aber mit `canAttack(Kreatur)` ohne Ziel (`pushAttackerCandidates`) – also
   auch für Kreaturen, die nur ein anderes Ziel angreifen dürften. Auf dem
   Tisch sind die (richtig) nicht markiert; jetzt zählen sie auch im Text
   nicht.
b. **Der Tipp-Hinweis** „ein zweiter Tipp nimmt sie zurück“ stimmte bei
   mehreren Zielen nicht ganz: Ein Tipp auf einen Angreifer eines anderen
   Ziels verlegt ihn zum gewählten (`declareAttacker` nach
   `removeFromCombat`). Der Satz nennt jetzt „das gewählte Ziel“; die Regeln
   in `AGENTS.md` sagen, dass der Tipp auf einen Angreifer Forges Worte trägt.
c. **Ein Ziel auf der eigenen Seite** (ein Kampf, den ein Gegner beschützt;
   Forge nimmt ihn über `playerAttacks.isOpponentOf(getProtectingPlayer())`)
   blieb ohne Markierung und Tipp, weil die Oberfläche Ziele nur beim Gegner
   suchte. Jetzt gilt Forges Liste auf beiden Seiten.
d. **„wird angegriffen“ im Bereich** stand nur in einem `aria-label` auf einem
   `span` – verboten für diese Rolle und von Screenreadern nicht vorgelesen
   (axe meldet es bei sichtbarem Text nur als „zu prüfen“). Jetzt wie am
   Sitzplatz: Text nur für Screenreader und Tooltip.
e. **Die Erklärung der Einsatzverzögerung** lautete „Erst seit diesem Zug
   unter der Kontrolle ihres Spielers“. Forge beendet sie aber erst zu Beginn
   des nächsten Zuges ihres Spielers – eine Kreatur der KI aus deren Zug
   (Szene `attack`: die Riesenspinne der KI) trägt sie im Zug des Spielers
   noch. Der Text folgt jetzt der Regel (§5).

Dazu fehlte, anders als bei den Prompts 16 und 17, ein Unit-Test der
Zählregeln der neuen Abdeckungen; er ist ergänzt (`trace.test.ts`).

### 10.2 Forges Markierung und das aktuelle Ziel

Forges „kann angreifen“ (`playable`) heißt „kann irgendein Ziel angreifen“,
Forges Tipp aber „greift das aktuelle Ziel an“. Wo beides auseinanderfällt,
folgt der Tisch der Erklärung (`unavailable` mit `defender`): keine
Markierung, kein Tipp, der Grund „nicht dieses Ziel“. In den Testpartien kam
das nicht vor (keine Karte dort verbietet einzelne Ziele); die Tests bauen den
Fall auf einer aufgenommenen Szene nach.

### 10.3 Was ein Tipp auf einen Angreifer tut, sagt Forge

`InputAttack.onCardSelected`: Greift die Kreatur das aktuelle Ziel an, nimmt
ein Tipp sie zurück – außer Banding ist möglich, dann bildet er eine Gruppe;
greift sie ein anderes Ziel an, verlegt ein Tipp sie zum aktuellen. Die
Oberfläche bildet das nicht nach: Sie zeigt Forges Worte (`action`), die aus
genau dieser Eingabe kommen (`getActivateAction`).

### 10.4 Die abgebrochene Verifikation der ersten Sitzung

Die erste Sitzung endete während der Differenztests (Schritt 2 von 4, Wasm in
Node) und vor dem Browser-Gesamttest; Doku und Abschluss fehlten. Die zweite
hat die Differenztests und den Gesamttest vollständig neu laufen lassen (§9).
Ihr Engine-Build (03:44–03:52, `b2191e0`) war mit
`engineSourcesModified=true` vermerkt: Uncommittet waren laut `git status`
direkt nach dem Build nur die Testdatei `worker-host.test.ts` und zwei
READMEs – alle drei seit `31bb92c` committet, keine davon fließt in ein
Artefakt. Statt eines erneuten Builds (Spitze 5,3 GiB, während eine andere
Sitzung auf odin einen Android-Emulator und Gradle betrieb) ist die Gleichheit
der Artefakte mit dem committeten Stand belegt (§9.1).

### 10.5 Angreifer in `commander-late`

Seit Prompt 14 bekamen deklarierte Angreifer keine Markierung (Forge hebt sie
nicht hervor), Krenko trug Forges „kann angreifen“. Jetzt sind alle 14
„greift an“ (E2E: `selected: 14` statt `usable: 1`).

### 10.6 Der Angriffsbereich nahm den Spielfeldern auf dem kleinen Handy die Höhe

Der erste Browser-Gesamttest fand genau einen Befund: in `commander-late`
auf dem kleinen Handy (360 × 740) Spielfelder von 75 statt der geforderten
80 px. Der Angriffsbereich brauchte dort 291 px – Satz, drei Hinweise und zwei
Knöpfe, die umbrachen, weil „Mit 14 Kreaturen angreifen“ und „Alle
zurücknehmen“ um wenige Pixel nicht nebeneinander passten. Weil der Kampf
(14 Angreifer) auf dem Tisch steht, bekam der Bereich den Modus `tall` (bis
28 % der Höhe), und mit den hohen Sitzplätzen einer Commander-Partie blieb
den Spielfeldern zu wenig. Vor Prompt 18 passte Forges eine Zeile in den
kompakten Bereich. Behoben: Hinweise nur vor dem ersten Angreifer (dann ist
der Kampf leer und der Bereich darf wachsen), mit Angreifern ein Hinweis wie
bei der Priorität und „Alle zurück“ – der Bereich braucht dort jetzt rund
175 px (§9.3).

## 11. Entscheidungen und Abweichungen

| Frage | Entscheidung | Grund |
|---|---|---|
| Woher kennt die App den Grund? | Forge-Patch mit nur lesender Auskunft (`attackRefusal`), dieselbe Prüfung wie `canAttack` | Bible §2; aus `tapped`/`sick` selbst zu schließen wäre eine Regel im Client (Effekte wie „kann angreifen, als hätte sie Eile“) |
| Grund gegen welches Ziel? | gegen das aktuelle – ginge ein anderes, heißt der Grund `defender` | Forges Tipp deklariert gegen das aktuelle Ziel |
| Wie wählt man das Ziel? | am Tisch (Spieler, Planeswalker) und im Bereich, dieselbe Wirkung | Forges Klickziele; der Bereich zeigt alle auf einmal, auch auf dem kleinen Handy |
| Satz statt Forges Anweisung | aus Forges Zustand (`attackText`) | Forges Satz nennt den Spieler beim Namen und passt nicht zu Planeswalkern; wie bei der Priorität (Prompt 16) |
| „Zurückrufen“ | „Alle zurück“ | sagt, dass es alle Angreifer betrifft; passt neben „Mit 14 Kreaturen angreifen“ in eine Zeile |
| Hinweise im Bereich | nur vor dem ersten Angreifer; danach ein Hinweis wie bei der Priorität | mit Angreifern braucht der Kampf auf dem Tisch Platz; die Gründe stehen unter den Karten (§10.6) |
| Grund in der Kartenunterschrift | statt der Werte, solange angegriffen wird | die Unterschrift ist eine Zeile; die Werte bleiben im Namen und in der Kartenansicht |
| Einsatzverzögerung | Sanduhr aus Forges `sick` an jeder Kreatur | Bible §6 „clear, unobtrusive indicator“; Forge kennt Eile und Kontrollwechsel |

## 12. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Blocker deklarieren, der Angriff der KI aus Sicht des Spielers | 19 |
| Angriffspflichten und -beschränkungen („muss angreifen“, „kann nicht allein angreifen“) prüft Forge erst beim OK; bei einem Verstoß kommt Forges englischer Hinweis „Attack declaration invalid“ und die Erklärung beginnt neu – welche Pflicht verletzt ist, sagt Forge nicht | upstream / 23 |
| Banding: Der Hinweis im Bereich nennt es nicht; was ein Tipp dann tut, sagen Forges Worte an der Karte | 23 |
| Auf dem kleinen Handy sind hochkant liegende Karten so schmal, dass die Unterschrift lange Gründe abschneidet („⊘ darf …“, „⊘ Ei…“) – wie jede lange Unterschrift dort. Sichtbar bleibt das Zeichen ⊘ (und die Sanduhr); den vollen Grund zeigen die Kartenansicht, der Name für Screenreader und vor dem ersten Angreifer der Bereich | 24 |
| Angriffskosten (Propaganda): bezahlt wird nach dem OK über Forges Bezahlen (Prompt 17), eine eigene Vorschau gibt es nicht | 23 |
| Ein Forge-Update, das `canAttack` oder `InputAttack` ändert, bricht Patch 0008 beim Build – dann den Patch nachziehen | 26 |

## 13. Reproduzieren

```bash
npx vitest run src/game/attack.test.tsx src/game/card-use.test.ts          # Sekunden
(cd engine && npm run test:unit)                                          # Engine-Unit-Tests, u. a. die Zählregeln
bash engine/scripts/build.sh                                              # u. a. AttackersTest (echte Partien)
bash engine/scripts/test-engine.sh && node scripts/record-table-scenes.ts # Differenztests, Szenen
npm run check                                                             # alles, inkl. E2E
```

## 14. Was als Nächstes kommt

Prompt 19 (Kampf: Blocker): Blocker deklarieren und zuordnen, wen die KI
angreift, Forges Knöpfe dabei in Worten.
