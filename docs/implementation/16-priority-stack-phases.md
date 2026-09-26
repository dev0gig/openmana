# 16 — Priorität, Stapel und Phasen

> Umsetzung von [`prompts/queue/16-priority-stack-phases.md`](../../prompts/queue/16-priority-stack-phases.md),
> Stand **2026-09-26**, ausgeführt von Claude Code (Claude Opus 5.5) im Dropzone-Standalone-Lauf
> (`fixed/standalone.md` mit den Regeln aus `prompts/naechster-schritt.md`). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §2, §6 („Reduce meaningless interaction“, „stack/priority is
> understandable without Forge knowledge“, „dangerous irreversible actions receive appropriate
> confirmation“), §9, §10 („clear turn/phase indicator“, „contextual action text“, „clear stack
> visualization“), §16, [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md), Anvils `PROTOKOLL.md`
> („Leere Prioritäten kommen gar nicht erst an“, `anlass: prioritaet`) und `Frageleiste.kt`
> (Phasenstreifen statt Lagebericht, ein Knopf „Weiter“, „Zug beenden“ aus dem Weg – die Lehre vom
> 28.8.2026), Forges `InputPassPriority`, `YieldController` (APINA, Zug beenden, Unterbrechungen),
> `PlayerControllerHuman` (`chooseSpellAbilityToPlay`, `declareAttackers`), `AvailableActions`,
> `StackItemView`, der Spieltisch (Prompt 13), die Kartenbedienung (Prompt 14) und die
> Entscheidungen (Prompt 15). Code: `src/game/turn-model.ts`, `priority-labels.ts`,
> `decision-panel.tsx` (`PriorityDecision`, `EndTurnButton`), `game-table.tsx` (`TurnTrack`,
> `StackEntry`), `card-sheet.tsx` (`StackFacts`), `table-model.ts`, `card-use.ts`,
> `src/components/ui/phase-track.tsx`, `src/cards/card-lookup.ts` (§11.6); Engine: `StateBuilder`,
> `BridgeGuiGame`, `Protocol` (Protokoll 5), `ScriptedHuman` (`play: respond`),
> `PriorityStackTest`, Testpartie `priority-respond`.

## Ergebnis

**Prompt 16 ist umgesetzt.** Zug, Phase, Priorität und Stapel sind jetzt ohne
Forge-Wissen verständlich – und nichts davon ist eine Regel der App:

- **Wo im Zug:** Die Kopfzeile nennt Forges Schritt („Zug 6 · Zweite
  Hauptphase“), daneben eine **Phasenleiste** – die 13 Schritte eines Zuges in
  fünf Phasen, der laufende breit in Gold, die vergangenen gedämpft – und wer
  am Zug ist („Du bist am Zug“ / „Forge-KI am Zug“). §6.
- **Die Priorität spricht:** Statt Forges Lagebericht („Priorität: Player Zug:
  8 (Player) Phase: … Stapel: Leer“ – dieselben Angaben wie Kopf und Stapel, mit
  Spielernamen) sagt der Entscheidungsbereich, worum es geht: „Du kannst jetzt
  eine Karte spielen – oder weitergeben.“, im Zug der KI „Zug der Forge-KI: …“,
  mit etwas auf dem Stapel „Die Forge-KI hat „Kalonischer Keiler“ gewirkt. Du
  kannst darauf antworten – oder es verrechnen lassen.“ – alles aus Forges
  strukturiertem Zustand. §2.
- **Forges OK sagt, was es tut:** „Weiter“ bei leerem Stapel, „Verrechnen
  lassen“ mit etwas darauf, darüber ein Satz, was das Abgeben der Priorität
  bewirkt. **Forges „Zug beenden“ nur nach Rückfrage** (es gibt den Rest des
  Zuges weg, auch einen eigenen Angriff); **Forges „Rückgängig (n)“** mit
  Forges Worten, direkt. §2, §4.
- **Forges automatisches Weitergeben bleibt Forges:** Die Engine gibt jede
  Priorität, in der Forge nichts für den Spieler findet, selbst weiter (APINA);
  was am Tisch ankommt, ist eine Priorität, in der der Spieler handeln kann –
  **in allen Testpartien ausnahmslos belegt**. Die App gibt nie selbst weiter.
  §3.
- **Der Stapel mit Karten:** jeder Eintrag, das Oberste zuerst, mit dem Bild
  seiner Karte (ein Zauberspruch liegt auf dem Stapel, in keiner Zone – bisher
  gab es für ihn nur Forges Text), was er ist (Zauberspruch, aktivierte,
  ausgelöste Fähigkeit), wem er gehört, seinen Zielen und Forges Beschreibung.
  Das Bild öffnet die Kartenansicht: wo die Karte auf dem Stapel liegt, wie
  viel darüber liegt – ansehen, nie antippen. §5.
- **Karten spielt man durch Antippen**, bei der Priorität über die Kartenansicht
  (Forges `card.tap`, Prompt 14) – nie über eine Liste, die die App erfände.
  §2.
- **Engine: Protokoll 5.** Stapeleinträge mit Karte und Art, Forges
  Prioritätsknöpfe mit Bedeutung, eine Auswahl nur noch mit Ids sichtbarer
  Karten, und das Ansehen verändert Forges Spiel nicht mehr (die Nebenwirkung
  aus Prompt 05 §7.2). Neue Testpartie `priority-respond`: der Testspieler hält
  Spontanzauber zurück und antwortet auf die Zaubersprüche der KI. §7.

Kein Blocker, keine Regel im Client.

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Zug, Priorität, Stapel als Daten | `src/game/turn-model.ts` | die 13 Schritte in fünf Phasen (`TURN_PHASES`, Forges `PhaseType`-Reihenfolge), wo der Zug steht (`turnSteps`), was ein Stapeleintrag ist (`stackKind` aus `ability`/`trigger`), das Oberste (`stackTop`), wessen Zug (`turnSeat`), wer Priorität hat (`priorityHolder`), die Priorität des Spielers (`priorityQuestion`, `priorityMoment`: Zug, Stapeltiefe, Oberstes, was Weitergeben tut, was Forges zweiter Knopf tut) |
| Worte | `src/game/priority-labels.ts` (nur die Partie-Seite lädt es, §10.4) | Namen der Phasen (`TURN_PHASE_LABELS`), der Stapelarten (`STACK_KIND_LABELS`), „Weiter“/„Verrechnen lassen“ (`PASS_LABELS`) mit Erklärung (`PASS_NOTES`), der Satz der Priorität (`priorityText`), die Rückfrage vor „Zug beenden“ (`endTurnText`), wer am Zug ist (`turnOwnerLabel`) |
| Priorität | `src/game/decision-panel.tsx` | `PriorityDecision` (Worte, oberste Karte daneben, Forges Knöpfe nach Bedeutung), `EndTurnButton` (`AlertDialog`), `ForgeWorking` (wer gerade dran ist, dass Forge anhält, wo der Spieler handeln kann), Ansage einer Priorität mit etwas auf dem Stapel |
| Kopfzeile, Stapel | `src/game/game-table.tsx` | `TurnTrack` (Phasenleiste), `StackEntry` (Karte, Name, Art, wessen, Ziele, Forges Text, „oben“) |
| Phasenleiste | `src/components/ui/phase-track.tsx` (shadcn-Art) | `PhaseTrack`, `PhaseTrackGroup`, `PhaseTrackStep` (`data-state` done/current/upcoming) |
| Kartenansicht | `src/game/card-sheet.tsx` | `StackFacts`: eine Karte auf dem Stapel (ein Zauberspruch oder die Quelle einer Fähigkeit) – was, wessen, wie weit oben, Forges Text und Ziele; kein Antippen |
| Tischmodell | `src/game/table-model.ts`, `card-use.ts`, `table-labels.ts` | Stapelkarten sind sichtbare Karten (`visibleCards`, `locateCard` Zone `stack`, `stackEntriesOf`), `cardUse`: eine Karte auf dem Stapel wird nie angetippt |
| Engine | `engine/bridge/…` | Protokoll 5 (§7): `StackItem.card`/`ability`, `Button.meaning`, sichtbare `select.cards`, `action` ohne Nebenwirkung |
| Testwerkzeug | `ScriptedHuman` (`play: respond`), `engine/fixtures/differential/priority-respond.json`, `engine/wasm/spike/trace.ts` (`priority-response`, `priority-opponent-turn`) | die neue Testpartie und ihre Abdeckung |
| Kartenbilder | `src/cards/card-lookup.ts` (`resolveEngineKey`) | ein Name, der zugleich Seite einer anderen Karte ist, entscheidet sich nach Forges eigenem Namen (§11.6) |
| Tests | `PriorityStackTest` (JVM), `turn-model.test.ts`, `priority.test.tsx`, `game-page.test.tsx`, `card-lookup.test.ts`, E2E Abschnitte 1, 10 und 12 | §9 |
| Szenen | `scripts/record-table-scenes.ts` → `src/test/fixtures/table-scenes.json` | drei neue echte Momente: `opponent-turn`, `respond`, `respond-own` |

## 2. Die Priorität

Die Priorität ist der eine Schritt, der eigene Worte bekommt: Forges
Anweisungszeile ist dort ein Lagebericht (`getTurnPhasePriorityMessage`) mit
den Spielernamen („Player“, „Forge AI“), den Kopf und Stapel ohnehin zeigen.
Der Bereich sagt stattdessen aus Forges strukturiertem Zustand, worum es geht:

| Lage (nur aus `turn`, `stack[0].player/ability/trigger/card`) | Satz | Forges OK |
|---|---|---|
| eigener Zug, Stapel leer | „Du kannst jetzt eine Karte spielen – oder weitergeben.“ | **Weiter** |
| Zug der KI, Stapel leer | „Zug der Forge-KI: Du kannst jetzt etwas spielen – oder weitergeben.“ | **Weiter** |
| oben ein Zauberspruch der KI | „Die Forge-KI hat „X“ gewirkt. Du kannst darauf antworten – oder es verrechnen lassen.“ | **Verrechnen lassen** |
| oben eine Fähigkeit der KI | „Die Forge-KI hat eine Fähigkeit von „X“ aktiviert. …“ / „„X“ der Forge-KI hat eine Fähigkeit ausgelöst. …“ | **Verrechnen lassen** |
| oben etwas vom Spieler | „Du hast „X“ gewirkt. Du kannst noch etwas darauflegen – oder es verrechnen lassen.“ | **Verrechnen lassen** |
| oben eine verdeckte Karte | „Die Forge-KI hat einen verdeckten Zauberspruch gewirkt. …“ (nie geraten) | **Verrechnen lassen** |

- **Über den Knöpfen erklärt ein Satz, was Weitergeben bewirkt** – statisch,
  aus den Regeln der Priorität (117.4, 405.5, 500.2), nie eine Vorhersage:
  „„Weiter“ gibt die Priorität ab. Tut danach niemand mehr etwas, geht es zum
  nächsten Schritt.“ bzw. „„Verrechnen lassen“ gibt die Priorität ab. Antwortet
  danach niemand mehr, wird das Oberste auf dem Stapel verrechnet.“ Der Satz ist
  zugleich die Beschreibung des Knopfes für Screenreader.
- **Die oberste Karte steht neben den Worten** (ein Tipp öffnet ihre Ansicht) –
  worauf man antworten würde.
- **Screenreader** hören eine Priorität, wenn etwas auf dem Stapel liegt (eine
  Gelegenheit zu antworten); die übrigen Prioritäten sagt „Du bist dran“.
- **Forges Knöpfe nach ihrer Bedeutung** (`Button.meaning`, §7): `pass` →
  „Weiter“/„Verrechnen lassen“; `undo` → Forges „Rückgängig (1)“, sofort (nimmt
  nur die letzte Aktion zurück, etwa ein für Mana getapptes Land); `endTurn` →
  Forges „Zug beenden …“ mit Rückfrage (§4). Ein Knopf ohne Bedeutung behält
  Forges Worte und sein Verhalten aus Prompt 15. Das Scharfschalten (500 ms)
  gilt unverändert.

## 3. Forges automatisches Weitergeben (APINA)

Bible §6: „priorities/decisions with no meaningful choice may be skipped only
when Forge itself can safely determine that“. Die Engine startet mit Forges
`YIELD_AUTO_PASS_NO_ACTIONS` (seit Prompt 01, Anvils Einstellung):
`PlayerControllerHuman.chooseSpellAbilityToPlay` berechnet mit
`AvailableActions.collectActionable`, ob der Spieler etwas tun kann (Karten der
Hand, des Spielfelds, aus anderen Zonen spielbare; Manafähigkeiten zählen
nicht), setzt `PlayerView.hasAvailableActions` (im Protokoll `canAct`) und die
Markierungen `playable`, und gibt eine Priorität ohne Aktion selbst weiter
(`YieldController.isAutoPassingNoActions`) – sie erreicht den Tisch nie.

- **Belegt:** In allen zwölf Testpartien kamen **241 Prioritätsfragen, jede mit
  `canAct = true`** und mindestens einer als spielbar markierten Karte
  (`PriorityStackTest`, Zählung über die Mitschnitte in §10.1). Der Spieler,
  der Spontanzauber zurückhält, bekommt Priorität auch im Zug der KI (52 von
  108 in `priority-respond`) – die übrigen Testspieler geben ihr Mana im
  eigenen Zug aus und bekamen dort (bis auf eine) keine.
- **Die App gibt nie selbst weiter:** kein Zeitlimit, kein eigenes
  „Auto-Pass“, nichts bei einem neuen Zustand (Tests: Zustände und Zeit
  vergehen, keine Antwort).
- **Wenn Forge rechnet**, sagt der Bereich, wer dran ist („Die Forge-KI ist
  dran …“, aus Forges `hasPriority`) und warum die Partie läuft: „Forge spielt
  von selbst weiter, bis du etwas tun oder entscheiden kannst – dann hält Forge
  an.“

## 4. Zug beenden und Rückgängig

Forges zweiter Knopf der Priorität ist je nach Lage „Rückgängig (n)“
(`canUndoLastAction`, etwa nach einem für Mana getappten Land) oder „Zug
beenden“ (`InputPassPriority.onCancel` → `autoPassUntilEndOfTurn`).

- **„Zug beenden“ gibt den Rest des Zuges weg:** Forge gibt die Priorität bis
  zum Ende des Zuges weiter und lässt einen noch ausstehenden eigenen Angriff
  aus (`PlayerControllerHuman.declareAttackers`: „User initiated yields … still
  skip when not-attacking is legal“). Das ist nicht zurückzunehmen – deshalb
  (Bible §6, Design-System Regel 4) ein `AlertDialog` „Zug beenden?“ mit dem,
  was passiert, „Weiterspielen“ (Fokus) und „Zug beenden“. Anvil hatte den
  Knopf aus demselben Grund aus der Knopfzeile genommen (Projektbesitzer, 28.8.2026:
  „Zug beenden werde ich nie vorzeitig, da klicke ich mich durch bis alle
  Segmente durch sind“); die Rückfrage hält ihn erreichbar, ohne dass ein
  Fehltipp etwas kostet.
- **Die Rückfrage verspricht nur, was Forge tut** – beide Aussagen sind in
  echten Partien geprüft (`PriorityStackTest`): Im eigenen Zug fragt Forge nach
  „Zug beenden“ weder nach Angreifern noch noch einmal bei der Priorität; im Zug
  der KI hält Forge an, sobald die KI einen Zauberspruch wirkt oder angreift
  (Forges Unterbrechungen `YIELD_INTERRUPT_ON_OPPONENT_SPELL`/`…_ATTACKERS`, in
  der Engine unverändert an).
- **„Rückgängig (n)“** steht mit Forges Worten und wird sofort gesendet (auch
  scharfgeschaltet): Es nimmt nur zurück. Geprüft: Land für Mana getappt →
  Forge bietet „Rückgängig (1)“ → gedrückt → das Land ist wieder ungetappt,
  Forges zweiter Knopf wieder „Zug beenden“.

## 5. Der Stapel

- **Jeder Eintrag mit seiner Karte** (`StackItem.card`, §7): bei einem
  Zauberspruch seine eigene Karte, bei einer Fähigkeit ihre Quelle; eine
  verdeckte Karte ist eine Rückseite, nie geraten. Dazu der Name (Forges Name
  in der Kartensprache), die Art („Zauberspruch“, „Aktivierte Fähigkeit“,
  „Ausgelöste Fähigkeit“ – Forges `ability`/`trigger`), „von dir“/„von der
  Forge-KI“, die Ziele („Ziel: dich, Riesenspinne“) und Forges eigene
  Beschreibung (zwei Zeilen, ganz in der Kartenansicht). Das Oberste trägt
  „oben“ (Tooltip: „Wird als Nächstes verrechnet“); bei mehr als einem Eintrag
  nennt die Überschrift die Zahl.
- **Das Bild öffnet die Kartenansicht** – auch mit langem Druck oder
  Rechtsklick. Für eine Karte auf dem Stapel sagt sie, wo sie liegt („Auf dem
  Stapel – von der Forge-KI“), was sie dort ist und wie viel darüber liegt
  („– 1 Eintrag liegt darüber.“, „– wird als Nächstes verrechnet.“), mit
  Forges Text und Zielen; einen Knopf zum Antippen gibt es nicht (Forges
  `card.tap` nimmt nur Karten in den Zonen der Spieler, der Client lehnt andere
  vorher ab). Die Quelle einer Fähigkeit bleibt auf ihrem Spielfeld; ihre
  Ansicht nennt beides.
- Der Stapel bleibt im Bereich `center` (Hochformat bis 8rem, Querformat die
  Seitenspalte); was nicht passt, rollt dort.

## 6. Zug und Phasen in der Kopfzeile

- Erste Zeile wie bisher: „Zug 6 · Zweite Hauptphase“ (Forges Schritt in
  Magics deutschen Worten). Zweite Zeile: die **Phasenleiste** und wer am Zug
  ist – kurz genug für ein 360-px-Handy („Forge-KI am Zug“).
- Die Leiste ist ein Bild der Worte daneben (`aria-hidden`, jeder Balken nennt
  seinen Schritt als Tooltip, jede Gruppe ihre Phase): 13 Balken in fünf
  Gruppen (Anfangsphase, Erste Hauptphase, Kampfphase, Zweite Hauptphase,
  Endphase), der laufende breit in `--primary`, die vergangenen in
  `--muted-foreground`, die kommenden in `--border`. Vor dem ersten Zug gibt es
  keine.
- **Keine Regel:** Die Reihenfolge der Schritte ist Magics feste Zugstruktur
  (dieselbe Liste wie Forges `PhaseType`, die der Test gegen das Protokoll
  prüft). Welcher Schritt läuft, sagt allein Forge; einen Schritt, den Forge
  auslässt (Kampf ohne Angreifer), überspringt die Leiste einfach.

## 7. Engine: Protokoll 5

| Änderung | Warum |
|---|---|
| `StackItem.card` (die Karte, wie Forge sie zeigt; verdeckt `{hidden: true}`), `StackItem.ability`, `source` nur für sichtbare Karten | Ein Zauberspruch liegt auf dem Stapel, in keiner Zone des Zustands – die App hatte für ihn nur Forges Text (Befund 13). Eine Karte auf dem Stapel trägt nie `playable`/`action`/`ways`. |
| `Button.meaning` = `pass`/`endTurn`/`undo` bei der Priorität | Die App darf keine Beschriftung lesen; die Bridge erkennt die Bedeutung wie `purpose` an Forges eigenen Textschlüsseln (`lblOK`, `lblEndTurn`, `lblUndo`). |
| `select.cards` nur mit Ids sichtbarer Karten | Befund 15 §10.4: Ids folgen den Decklisten und würden eine verdeckte Karte verraten. |
| `action` bei Priorität und Bezahlen nur für eigene und von Forge markierte Karten | Befund 05 §7.2: Forge beantwortet „was täte ein Tipp“ dort mit `Card.getAllPossibleAbilities` bzw. `getAllManaAbilities` und **trägt dabei den Spieler als aktivierenden Spieler** in alle Fähigkeiten der Karte ein – bei Karten der KI eine Änderung, die die KI später sieht. In allen anderen Schritten bleibt die Frage für jede sichtbare Karte (Blocker erklären für einen Angreifer der KI, einen Planeswalker angreifen). |

Die Testpartien verlaufen unverändert (Forge-Protokoll von `human-3`
`c1e990c6…`, `human-11` `7c3f673f…` wie seit Prompt 02): Die Nebenwirkung
hatte diese Partien nicht verändert, aber Forges Objekte – jetzt belegt nicht
mehr (`PriorityStackTest`: keine Karte der KI mit `action` bei Priorität oder
Bezahlen).

**Neue Testpartie `priority-respond`** (rote Spontanzauber gegen Grün, Seed 3,
deutsch): Der Testspieler (`play: respond`) spielt bei leerem Stapel nur Länder
– erkannt an Forges eigenen Worten „Spiele ein Land“, verglichen wie die Bridge
Forges Beschriftungen vergleicht – und tippt, sobald etwas auf dem Stapel
liegt, jede Karte an, die Forge als spielbar markiert. So bekommt er Priorität
im Zug der KI und antwortet auf ihre Zaubersprüche. Neue Abdeckungen der
Differenztests: `priority-opponent-turn`, `priority-response` (jetzt Pflicht).

## 8. Keine Regeln im Client

- Wer am Zug ist, wer Priorität hat, was auf dem Stapel liegt und was es ist,
  was Forges Knöpfe tun: Forges Felder. Keine Karte, kein Name, keine Mechanik
  im Code; nie ein Satz von Forge zerlegt.
- Die einzigen festen Kenntnisse sind Magics Zugstruktur (für die Leiste) und
  die Erklärung, was das Abgeben der Priorität bewirkt – statische Sätze, die
  nichts vorhersagen: Ob danach jemand etwas tut, entscheidet Forge.

## 9. Tests

- **Engine, JVM** (`PriorityStackTest`, 9 Tests in echten Partien: die
  Referenzpartien Seed 3 und 11 und die neue `priority-respond`; alles, was die
  Bridge sendet, wird mitgeschrieben):
  - Forge fragt bei der Priorität nur, wo es etwas für den Spieler findet: vor
    jeder Prioritätsfrage `canAct` und eine markierte Karte (APINA); der
    Antworten-Spieler bekommt Priorität im Zug der KI.
  - Die Knöpfe der Priorität: OK = `pass`, der zweite `endTurn` oder `undo`;
    kein anderer Knopf trägt eine Bedeutung.
  - „Zug beenden“ in der ersten Hauptphase eines eigenen Zuges, in dem die
    unveränderte Partie angriff: danach in diesem Zug weder eine Frage nach
    Angreifern noch eine Priorität; die Partie läuft in späteren Zügen weiter.
  - „Zug beenden“ in einem ruhigen Moment eines KI-Zuges: Forge fragt genau
    beim Zauberspruch der KI (Zug 4) bzw. bei ihrem Angriff (Zug 8) wieder – nie
    an einem anderen ruhigen Moment.
  - „Rückgängig“: ein eigenes Land für Mana getappt → Forge bietet
    „Rückgängig (1)“ → gedrückt → das Land ist ungetappt, der zweite Knopf
    wieder „Zug beenden“.
  - Stapeleinträge: Karte = Quelle, nie `playable`/`action`/`ways`, ein
    Auslöser immer eine Fähigkeit; Zaubersprüche, Fähigkeiten und Einträge der
    KI kamen vor. Die Antwort des Spielers lag über dem Zauber der KI.
  - Ansehen ohne Nebenwirkung: bei Priorität und Bezahlen keine Karte der KI
    mit `action`; die eigenen Karten behalten ihre.
  - Eine Auswahl nennt genau die Ids ihrer sichtbaren Einträge.
  - `ProtocolContractTest`: die Bedeutungen = Schema. **65 JVM-Tests** grün.
- **Engine, Node:** 81 Unit-Tests (neu: die Abdeckungen
  `priority-opponent-turn`/`priority-response` mit einer gebauten Spur; die
  Protokollbeispiele in Version 5; die echten Zustände neu aufgenommen, jetzt
  mit Stapelkarten).
- `src/game/turn-model.test.ts` (13): die Schritte = Protokoll-Phasen in fünf
  Phasen; vergangene/laufende/kommende Schritte; die Priorität der
  aufgezeichneten Momente (eigener Zug, Zug der KI, ihr Zauber oben, die eigene
  Antwort oben) samt Worten; gebaute Oberste (Zauberspruch, aktivierte und
  ausgelöste Fähigkeit beider Spieler, verdeckt, ohne Spieler); Forges zweiter
  Knopf; die Rückfrage; wer am Zug ist und wer Priorität hat.
- `src/game/priority.test.tsx` (13, im echten Tischcode): Worte statt Lagebericht,
  „Weiter“ erst scharf, nichts von selbst (neue Zustände, Zeit); „Zug beenden …“
  fragt (Fokus auf „Weiterspielen“, nur Bestätigen sendet Knopf 2);
  „Rückgängig (1)“ sofort; Zug der KI; KI-Zauber oben mit Karte daneben,
  „Verrechnen lassen“, Ansage; eigene Antwort oben, Stapelreihenfolge; Karten
  spielen ist ihr Tipp (kein Auswahlfeld im Bereich); Stapeleintrag mit Karte,
  Art, Besitzer, Ziel und Forges Text; Kartenansicht einer Stapelkarte (nur
  „Schließen“); ausgelöste Fähigkeit mit Quelle auf dem Spielfeld;
  Phasenleiste und keine vor dem ersten Zug; „Die Forge-KI ist dran …“.
- `src/game/game-page.test.tsx` (+2, mit dem echten Client): „Zug beenden“
  fragt, „Weiterspielen“ sendet nichts, Bestätigen sendet Forges Knopf 2; die
  Kopfzeile mit Phasenleiste und die Worte der Priorität. Angepasst: „Weiter“
  statt „OK“.
- `table-model.test.ts` (+1: Stapelkarten, `locateCard` auf dem Stapel,
  `stackEntriesOf`), `card-lookup.test.ts` (+1: §11.6); angepasst
  `decision-panel.test.tsx`, `game-table.test.tsx`, `table-labels.test.ts`.
- **Neue echte Szenen** (`scripts/record-table-scenes.ts`, Partie
  `priority-respond`, deutsch): `opponent-turn` (Priorität im Versorgungssegment
  der KI), `respond` („Wucherndes Wachstum“ der KI oben), `respond-own`
  („Schock“ des Spielers über dem „Kalonischen Keiler“ der KI). Die 16 alten
  Szenen sind bis auf die neuen Protokollfelder (Knopfbedeutungen,
  Stapelkarten) und die Zählung der Zustände gleich.

## 10. Nachweise

**Commits:** `6eb3087` Engine (Protokoll 5, Testpartie, JVM-Tests), `9f3ff08`
JVM-Test „Zug beenden hält beim Zauberspruch und Angriff an“, `492e07d`
Oberfläche, `519c745` E2E (Entwicklungsserver erst aufwärmen), `977b204` Test
ohne implizites `any`, `eb4ff6c` Kartenbild-Nachschlag (§11.6) und E2E
(Protokollversion, ausgeblendete Tippziele), `dca8e9f` Worte der Priorität in
eigenem Modul (§10.4), `e2892b4` E2E (axe nach Übergängen). Engine-Build und
Differenztests auf `6eb3087` (`engineSourcesModified=false`; die Engine-Quellen
sind seitdem unverändert, `9f3ff08` fügt nur einen JVM-Test hinzu), die 65
JVM-Tests auf `eb4ff6c`, der Gesamtlauf `npm run check` auf **`e2892b4`** –
jeweils mit sauberem Arbeitsbaum. odin (Intel i7-8700T, Debian 13), Node
22.22.3, GraalVM 25.4.4.1.1, Chrome for Testing 153.0.8010.12.

### 10.1 Engine

- **Build** (`bash engine/scripts/build.sh`): 349,5 s, davon `native-image`
  108 s bei 6,0 GiB Spitze, Maven samt JVM-Tests 73 s bei 2,3 GiB. Engine-Id
  `79b08e1a19afa7ae`, Modul 78,95 MB roh / 13,09 MB Brotli (Worker 408 KB /
  29 KB Brotli).
- **Differenztests** (`bash engine/scripts/test-engine.sh`, ~18 min): **72
  Läufe, 0 Fehler** – JVM-Referenzen, jede Testpartie in Node und Chrome
  nachgespielt, KI-Partien, Kartenprüfungen, Chrome ohne Isolation. Die neue
  Partie `priority-respond` (14 Züge, 140 Eingaben): JVM = Node = Chrome –
  Forge-Protokoll `91697aa7…` und die 443 Protokollnachrichten `7a3447e3…` in
  allen drei gleich, die Spur (319 Einträge / 1 961 Ereignisse) in Node und
  Chrome Eintrag für Eintrag gleich der JVM-Spur. Abdeckung aller Partien
  vollständig, einschließlich der neuen Pflicht-Kategorien
  (`priority-response`, `priority-opponent-turn`). Die Referenzpartien
  verlaufen wie seit Prompt 02 (`human-3` `c1e990c6…`, `human-11` `7c3f673f…`).
- **Prioritäten in den Mitschnitten** (alle zwölf Testpartien): 241
  Prioritätsfragen, **alle mit `canAct`**; 53 im Zug der KI (52 davon in
  `priority-respond`); 8 mit etwas auf dem Stapel (6 mit dem Zauber der KI
  oben, 2 mit der eigenen Antwort darüber).

### 10.2 Statische Prüfungen und Unit-Tests

Erzeugte Dateien = Schemas, `tsc -b` und `oxlint` ohne Befund, **759
Vitest-Tests in 62 Dateien grün** (729 nach Prompt 15, 30 neue).

### 10.3 Browser-Gesamttest (`npm run check` 11 min 51 s): **E2E OK, 0 Befunde**

- **Abschnitt 1:** Der erste Entwicklungsserver nach dem Engine-Neubau lud
  sich im Aufwärmen einmal neu (2 Navigationen, 5,6 s) – danach startete die
  Engine in 5,9 s.
- **Abschnitt 10 – die echte Partie:** am Desktop (Maus, Constructed) und am
  Handy (Touch) je „Spielen“ → „Behalten“ → ein Land über seine Kartenansicht
  („Gebirge“ bzw. „Insel“) → **„Weiter“**; die Priorität in Worten (nicht
  Forges Lagebericht), die Phasenleiste der Kopfzeile auf Forges Schritt
  (`MAIN1`, gleich den Worten darüber); Forges Knöpfe 40 px (Maus) / 48 px
  (Touch); 3,2 bzw. 3,3 s vom ersten bis zum letzten Druck; axe 0, keine
  Meldung.
- **Abschnitt 12 – der Spieltisch:** 19 echte und 6 gebaute Szenen in sechs
  Größen (150 Kombinationen), **axe 0 überall**; die neuen Szenen mit Forges
  Markierungen (4, 4 und 2 spielbare Spontanzauber); kleinstes Tippziel
  29 × 40 px (die Karten des Stapels). In drei Größen (kleines Handy, Handy
  quer, Desktop) **beantwortet:** „Weiter“ → Knopf 1, „Verrechnen lassen“ →
  Knopf 1, „Zug beenden …“ → Rückfrage (axe 0) → „Weiterspielen“ sendet nichts
  → „Zug beenden“ → Knopf 2. In allen sechs Größen die **Kartenansicht einer
  Stapelkarte**: „Auf dem Stapel: Zauberspruch von der Forge-KI – 1 Eintrag
  liegt darüber.“, nur „Schließen“, nichts gesendet, axe 0.

Höhe des Entscheidungsbereichs / seines Inhalts in px (`c` compact, `t` tall,
`e` expanded):

| Szene | Handy 412 × 915 | Handy quer 915 × 412 | kleines Handy 360 × 740 | Tablet 884 × 1104 | Tablet quer 1104 × 884 | Desktop 1440 × 900 |
|---|---|---|---|---|---|---|
| eigene Priorität (`main-phase`) | c 160/159 | e 259/258 | e 180/179 | c 144/143 | c 351/351 | c 362/362 |
| Zug der KI (`opponent-turn`) | e 180/179 | e 259/258 | e 180/179 | c 144/143 | c 351/351 | c 358/358 |
| KI-Zauber oben (`respond`) | t 200/199 | t 129/199 | t 207/215 | c 162/161 | c 351/351 | c 358/358 |
| eigene Antwort oben (`respond-own`) | t 180/179 | t 129/199 | t 207/215 | c 162/161 | c 351/351 | c 358/358 |

Wo der Inhalt höher ist als der Bereich (Handy quer, kleines Handy mit
Stapel), rollt der Text im Bereich, die Knöpfe kleben unten (Prompt 15).

### 10.4 Kosten

Beide Stände gleich gebaut (nur die Oberfläche, `OPENMANA_ENGINE=omit
OPENMANA_CARDS=omit`, gzip -9): **Start-JavaScript unverändert** 251,4 →
251,5 KB (`a651b2a` → `dca8e9f`); die nachgeladene Partie-Seite 26,4 →
28,9 KB. Ein erster Stand (`eb4ff6c`) hatte das Start-JavaScript um 2,3 KB
vergrößert: Die neuen Worte standen in `game-labels.ts`, das auch die
Startseite lädt, und zogen über den Kartennamen die Namen der Marken mit →
eigenes Modul `priority-labels.ts`.

### 10.5 Der Weg zum grünen Lauf

- **Lauf 1** (`492e07d`): brach beim Engine-Start auf dem Entwicklungsserver
  ab – Vite bündelte nach dem Engine-Neubau seine Abhängigkeiten neu und lud die
  Seite mitten im Start neu (§11.7) → Aufwärmen (`519c745`).
- **Lauf 2** (`519c745`): scheiterte an `tsc` (ein Test mit implizitem `any`,
  `vitest` prüft keine Typen) → `977b204`.
- **Lauf 3** (`977b204`): 2 Befunde des Tests selbst – die Diagnose-Prüfung
  erwartete fest „Protokoll: Version 4“ (dieselbe Falle wie in Prompt 12), und
  eine ausgeblendete Stapelkarte (Handy quer, große Frage) zählte als
  0 × 0-Tippziel; beim Durchsehen der Bildschirmfotos dazu das fehlende Bild
  von „Wucherndes Wachstum“ (§11.6) → `eb4ff6c`.
- **Lauf 4** (`eb4ff6c`): E2E OK, 0 Befunde. Danach die Größenmessung (§10.4) →
  `dca8e9f`.
- **Lauf 5** (`dca8e9f`): axe meldete zu wenig Kontrast an „Du bist dran“ und
  „Weiter“ – gemessen mitten im Überblenden zu Gold (Knöpfe und Marken haben
  weiche Übergänge), als Forge nach dem letzten Druck gerade wieder wartete; in
  der fertigen Darstellung ist der Kontrast hoch → axe wartet laufende
  Übergänge ab und misst die echte Partie erst, wenn Forge wieder wartet
  (`e2892b4`).
- **Lauf 6** (`e2892b4`): **E2E OK, 0 Befunde.**

## 11. Befunde

### 11.1 Forges automatisches Weitergeben ist lückenlos

Keine der 241 Prioritätsfragen aller Testpartien kam ohne `canAct`: APINA
(`YIELD_AUTO_PASS_NO_ACTIONS`, seit Prompt 01 gesetzt) lässt nichts durch, wo
Forge keine Aktion findet (Manafähigkeiten zählen dabei nicht). Die App braucht
kein eigenes Weitergeben – und darf keins haben: Wo Forge fragt, gibt es etwas
zu entscheiden.

### 11.2 Die Nebenwirkung gab es auch beim Bezahlen

Befund 05 §7.2 nannte `InputPassPriority`. Beim Durchsehen aller Eingabeschritte
fand sich dieselbe Nebenwirkung in `InputPayMana.getActivateAction`
(`getAllManaAbilities` → `setActivatingPlayer` für die Manafähigkeiten jeder
gefragten Karte). Beide sind jetzt beschränkt (§7). Die Testpartien verlaufen
unverändert – die Nebenwirkung hatte diese Partien nicht verändert, wohl aber
Forges Objekte.

### 11.3 Forges Stapeltexte sind für Zaubersprüche englisch

Auch mit `--language=de-DE`: „Schock (29) - Schock (29) deals 2 damage to Forge
AI.“, „Wucherndes Wachstum (68) - Search your library for a basic land card,
…“ – Forges `getStackDescription` übersetzt nur die Kartennamen; ausgelöste
Fähigkeiten stehen deutsch (ihr Kartentext), mit Forges Zusätzen
(„(Targeting: …)“). Gezeigt wie gesendet, als zweite Zeile; Name, Art,
Besitzer und Ziele kommen deutsch aus den Feldern. Upstream bzw. Prompt 26.

### 11.4 „Zug beenden“ lässt den eigenen Angriff aus

`PlayerControllerHuman.declareAttackers`: „User initiated yields (pass until end
of turn) still skip when not-attacking is legal“ – im eigenen Zug nach „Zug
beenden“ kein Angriff mehr (geprüft). Das ist der Grund für die Rückfrage.

### 11.5 Forges Unterbrechungen wirken auch in der Engine ohne Oberfläche

Forge hebt „Zug beenden“ auf, wenn der Gegner einen Zauberspruch wirkt oder
angreift (`YieldController.onSpellAbilityCast`/`onAttackersDeclared`, ausgelöst
von Forges eigenem Ereignis-Abonnenten `FControlGameEventHandler`; Vorgaben
`YIELD_INTERRUPT_ON_OPPONENT_SPELL`/`…_ATTACKERS` an). Geprüft, weil die
Rückfrage es verspricht und die Engine ohne Forges Oberfläche läuft: Zug 4
(Zauberspruch) und Zug 8 (Angriff) der Partie `priority-respond`.

### 11.6 Ein Kartenname, der zugleich die Seite einer anderen Karte ist

„Rampant Growth“ ist eine eigene Karte und seit 2026 auch die zweite Seite von
„Studious First-Year“ (SOS). `resolveEngineKey` hielt den Namen für mehrdeutig
(beide sind Forge-Karten) – der Tisch zeigte „Wucherndes Wachstum“ ohne Bild,
mit Forges Worten. Jetzt entscheidet der Name, unter dem Forge die Karte führt
(`forgeNames`: „Rampant Growth“ bzw. „Studious First-Year“); nur wo auch das
nicht trennt, bleibt es mehrdeutig. Test mit beiden Karten. (Zeigt Forge einmal
die vorbereitete Seite von Studious First-Year als eigenen Zauber, erscheint das
Bild der Karte „Rampant Growth“ – derselbe Spruch.)

### 11.7 Der Entwicklungsserver lädt nach einem Engine-Neubau einmal neu

Die Engine-Id gehört zu Vites Konfiguration; nach einem Neubau bündelt der erste
Entwicklungsserver die Abhängigkeiten neu und lädt offene Seiten Sekunden
später neu. Im Test traf das den Engine-Start (nie „Bereit“). Der Test wärmt
den Server jetzt auf (wartet, bis 5 s lang keine Navigation mehr kommt). Für
Entwickler: nach einem Engine-Neubau die erste Seite einmal neu laden lassen.

### 11.8 axe und weiche Übergänge

Knöpfe und Marken haben `transition-all`; eine Messung im Überblenden (ein
Knopf wird freigegeben, eine Marke wechselt die Variante) ergibt Mischfarben
mit zu wenig Kontrast. Die Messung wartet jetzt laufende Animationen und
Übergänge ab (keine endlosen wie Ladekreisel, höchstens 3 s).

### 11.9 `/tmp` auf odin war zu 90 % voll

Arbeitsordner anderer Sitzungen belegten `/tmp` (tmpfs). Engine-Build,
Differenztests und Gesamttest liefen deshalb mit Arbeitsordnern auf der Platte
(`NATIVE_IMAGE_OPTIONS=-J-Djava.io.tmpdir=…`, `JDK_JAVA_OPTIONS`, `TMPDIR`
unter `engine/build/tmp`) – ohne Einfluss auf die Ergebnisse, aber ohne Gefahr
für die anderen Sitzungen.

## 12. Entscheidungen und Abweichungen

| Frage | Entscheidung | Grund |
|---|---|---|
| Forges Lagebericht bei der Priorität | ersetzt durch Worte aus dem Zustand | er wiederholt Kopf und Stapel mit Spielernamen; Anvil ersetzte ihn durch den Phasenstreifen (28.8.2026) |
| Forges „OK“ | „Weiter“/„Verrechnen lassen“ nach dem Stapel, mit Erklärung | „contextual action text“ (Bible §10); die Bedeutung liefert die Bridge (`meaning`), nie die Beschriftung |
| „Zug beenden“ | bleibt Forges Knopf, nur nach Rückfrage | gibt den Rest des Zuges weg (auch einen eigenen Angriff); Anvil nahm ihn aus der Knopfzeile, hier bleibt er erreichbar, ein Fehltipp kostet nichts |
| „Rückgängig“ | Forges Worte, sofort | nimmt nur zurück |
| Phasenleiste | Balken in fünf Gruppen, nicht Punkte mit Namen | passt neben „Forge-KI am Zug“ auf 360 px; der Name des Schritts steht in der Zeile darüber |
| Forges Stapeltext | bleibt (zweite Zeile, ganz in der Ansicht) | Forges Worte; Name, Art, Besitzer und Ziele kommen deutsch aus den Feldern (Befund §11) |
| Eigener Auto-Pass der App | keiner | Forges APINA entscheidet (Bible §6); die App gibt nie selbst weiter |

## 13. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Spieler als Ziel (`player.tap`), Forges gültige Spieler | 17 |
| Kampf: Worte für Forges OK beim Angreifen/Blocken, `sick` zeigen | 18/19 |
| Forges Stapeltexte für Zaubersprüche teils englisch, mit Ids | upstream / 26 |
| Fähigkeiten auf Karten der KI, die jeder Spieler aktivieren darf (sehr selten): bei der Priorität ohne Forges Markierung kein `action` mehr – Forges APINA übersieht sie ebenso | 26 (mit Forge prüfen) |
| Verlauf der KI-Züge (was die KI tat, während Forge rechnete) | 21 |

## 14. Reproduzieren

```bash
npx vitest run src/game/turn-model.test.ts src/game/priority.test.tsx   # Priorität, Stapel, Phasen (Sekunden)
bash engine/scripts/build-jvm.sh                                          # u. a. PriorityStackTest (echte Partien)
bash engine/scripts/test-engine.sh && node scripts/record-table-scenes.ts # Differenztests, neue Szenen
npm run check                                                             # alles, inkl. E2E
```

## 15. Was als Nächstes kommt

Prompt 17 (Ziele und Kosten): Spieler als Ziel antippen (`player.tap`) samt
Forges gültigen Spielern im Protokoll, Quelle und nötige Anzahl beim Bezahlen.
