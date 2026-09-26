# 15 — Forges Entscheidungen beantworten

> Umsetzung von [`prompts/queue/15-forge-decisions.md`](../../prompts/queue/15-forge-decisions.md),
> Stand **2026-09-26**, ausgeführt von Claude Code (Claude Opus 5.5) im Dropzone-Standalone-Lauf
> (`fixed/standalone.md` mit den Regeln aus `prompts/naechster-schritt.md`). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §6 („Reduce meaningless interaction“, „Card interaction“), §9
> (Fragen mit Nummern und Rücknahme, die Entscheidungsarten), §16,
> [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md) („Forge protocol“, „Failure visibility“,
> „Interaction“), Anvils Frageleiste (`Frageleiste.kt`: die acht Arten und die datierten Lehren vom
> 28.8. und 4.9.2026), das Protokoll (neun Fragearten, `engine/protocol/schema`), die Brücke
> (`BridgeGuiGame`: welche Forge-Methode welche Frage stellt; `Answers`: strenge Prüfung),
> Spieltisch (Prompt 13) und Kartenbedienung (Prompt 14), das Design-System
> [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Code: `src/game/decision-model.ts`,
> `decision-panel.tsx`, `game-table.tsx`, `card-sheet.tsx`, `game-page.tsx`, `table-picture.tsx`,
> `src/engine/engine-session.ts`, `src/components/ui/game-decision.tsx`, `game-board.tsx`,
> `checkbox.tsx`, `src/index.css` (`short:`). **Engine unverändert.**

## Ergebnis

**Prompt 15 ist umgesetzt.** Jede Frage, die Forge dem Spieler stellt, lässt
sich jetzt am Spieltisch beantworten – im **Entscheidungsbereich direkt über
der Hand** (im Querformat neben der eigenen Tischhälfte):

- **Alle neun Fragearten des Protokolls** haben ihre Bedienung: Forges zwei
  Knöpfe, die Auswahl von Karten, die Wahl aus einer Liste, Ja oder Nein, eine
  von mehreren Möglichkeiten (auch Listen, die Forge nur zeigt), eine Zahl oder
  ein Text, eine Reihenfolge, Karten nach oben oder unter die Bibliothek
  (Hellsicht) und das Verteilen einer Menge (Kampfschaden) – §2.
- **Nichts wird für den Spieler entschieden.** Forges Vorschlag ist nur der
  erste Entwurf; gesendet wird nur, was der Spieler drückt. Eine Antwort, die
  nicht zu Forges Zahlen passt, wird nie gesendet – ihr Knopf bleibt aus und
  sagt, was fehlt. Absendeknöpfe reagieren erst 0,5 s nach dem Erscheinen: Forge
  stellt die nächste Frage sofort, oft mit einem Knopf an derselben Stelle – §3.
- **Nichts verschwindet still.** Eine zurückgezogene Frage nimmt ihre
  Bedienelemente und den Entwurf mit; eine Antwort, die der Client oder Forge
  ablehnt, erscheint oben als Hinweis – §4.
- **Nah an der Hand, auch auf kleinen Bildschirmen.** Der Bereich wächst nur so
  weit, wie eine Frage es braucht (höchstens 36 % eines Hochformat-Bildschirms, für bloßen Text 28 %),
  seine Antwortknöpfe kleben unten und bleiben beim Rollen einer langen Liste in
  Reichweite; auf einem quer gehaltenen Handy nimmt eine Frage die ganze
  Seitenspalte – §5.
- **In der echten Partie geprüft:** Der Browser-Gesamttest spielt in Chrome mit
  der echten Engine: behalten, Priorität weitergeben, ein Land über die
  Kartenansicht spielen, weitergeben – am Desktop mit der Maus und am Handy per
  Touch. Dazu beantwortet er jede Frageart in drei Größen und prüft das Layout
  in sechs (§9).

Keine Regel im Client: Geprüft werden nur die Zahlen, die die Frage selbst
mitbringt, und die Engine prüft dieselben noch einmal (§7). Kein Blocker.

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Entscheidungen als Daten | `src/game/decision-model.ts` | welche Frage jetzt beantwortet wird (`currentDecision`: eine blockierende allein, sonst Knöpfe und Auswahl nebeneinander), erster Entwurf je Art (Forges Vorschlag oder nichts), ob ein Entwurf passt (`check*`: nur Forges Zahlen), die Antwort als `AnswerBody` des Protokolls, Wörter für Einträge (Spieler als „Du“/„Forge-KI“ über `me`) |
| Entscheidungsbereich | `src/game/decision-panel.tsx` | die Bedienung aller neun Arten (§2), gesicherte Absendeknöpfe (`SendButton`), Gründe für ausgeschaltete Knöpfe, Ansage neuer Entscheidungen für Screenreader |
| Bausteine | `src/components/ui/game-decision.tsx` (shadcn-Art), `checkbox.tsx` (Registry) | Kopf (fragende Karte, Art, Forges Worte), Kartenreihe einer Frage, kurze Zeilen, Antwortknöpfe, die unten kleben; Kontrollkästchen für Mehrfachwahl |
| Platz | `src/components/ui/game-board.tsx`, `src/index.css` | `GameBoard decision` = `compact`/`tall`/`expanded` (§5), neue Variante `short:` (Fenster höchstens 32rem hoch) |
| Tisch | `src/game/game-table.tsx` | `onAnswer` (von der Seite, wie `onTapCard`), der Bereich misst, ob Forges Worte hineinpassen, Kartenansicht für Karten aus Forges Fragen |
| Kartenansicht | `src/game/card-sheet.tsx` | eine Karte einer Frage, die in keiner Zone liegt (Bibliothek beim Hellsehen), erscheint so, wie die Frage sie zeigt; Fokus zurück zu dem, was sie geöffnet hat |
| Sitzung | `src/engine/engine-session.ts`, `engine-session-context.tsx` | `answer(frage, antwort)`: nur solange Forge wartet, nie während der Aufgabe, deutsche Gründe für Ablehnungen des Clients |
| Seite | `src/game/game-page.tsx` | Antworten an die Sitzung, abgelehnte als Hinweis oben; Bilder auch für die Karten aus Forges Fragen |
| Tests | `src/game/decision-model.test.ts`, `decision-panel.test.tsx`, `game-page.test.tsx`, `engine-session.test.ts`, `src/test/built-questions.ts`, E2E Abschnitte 10 und 12 | §8 |
| Szenen | `scripts/record-table-scenes.ts` → `src/test/fixtures/table-scenes.json` | neun neue echte Momente aus den Testpartien (§8) |

## 2. Die Fragearten

| Art | Forge fragt so (Beispiele) | Bedienung | erster Entwurf | senden erst, wenn | Antwort |
|---|---|---|---|---|---|
| `buttons` | `updateButtons`: Behalten/Mulligan, Spielen/Ziehen, OK/Zug beenden, Auto/Abbrechen, OK/Alle angreifen, OK/Zurückrufen, Ja/Nein einer Fähigkeit („darf“) | Forges zwei Knöpfe mit Forges Worten (Knopf 1 gold, Knopf 2 umrandet); ein abgeschalteter bleibt sichtbar, aus, mit Grund; beim London-Mulligan dazu, wie viele Handkarten Forge markiert hat | – | Forge den Knopf eingeschaltet hat | `button` |
| `select` | `setSelectables`: Ziele, Karten zum Abwerfen | Karten auf dem Tisch werden dort angetippt (sofort, Prompt 14); Karten, die der Tisch nicht zeigt (Friedhof, Exil, Bibliothek, verdeckt), als Kartenreihe im Bereich (sofort, Doppeltipp zählt einmal); wie viele, und wie viele gewählt, wo Forges Markierung es für jede Karte sagt; bestätigt wird mit Forges OK | – | – (jeder Tipp ist Forges Klick) | `choices: [nr]` |
| `choose` | `getChoices`, `chooseSingleEntityForEffect`, `chooseEntitiesForEffect`: Modus, Farbe, Karte, Spieler | Auswahlkarten (ein Kreis bei einer Wahl, Kästchen bei mehreren; bei Karten eine Kartenreihe); ab 12 Einträgen eine Suche, höchstens 50 Treffer zugleich (die übrigen genannt) | Forges Vorschlag (nur gültige, höchstens max) | Anzahl in min…max | `choices` |
| `confirm` | `confirm`, `showConfirmDialog` | Forges Worte für ja und nein (sonst „Ja“/„Nein“); Forges Vorschlag gold hervorgehoben | – | – | `yes` |
| `options` | `getAbilityToPlay` („Wähle Fähigkeit“), `showOptionDialog`; mit `revealed`: `reveal`, `getChoices` mit negativem Maximum | Auswahlkarten und „Bestätigen“, „Abbrechen“ (0), wo Forge es erlaubt; eine Liste, die Forge nur zeigt: ihre Karten zum Ansehen und Forges eine Taste | Forges Vorschlag | eine gewählt | `option` |
| `input` | `showInputDialog` | Feld (Zahlentastatur bei Zahlen); Forges Vorschläge füllen es, gesendet wird erst mit „Bestätigen“ oder Enter | Forges Vorschlag | eine ganze Zahl (Java-`int`), wo Forge eine Zahl verlangt | `value` |
| `order` | `order`: gleichzeitige Auslöser, Schadensreihenfolge, Karten in eine Zone | nummerierte Liste mit Pfeilen; wo Forge Einträge übrig lassen darf: hinzufügen, herausnehmen; Forges `top` nennt Platz 1 („Lege zuerst“) | Forges Vorschlag; „alle ordnen“: Forges Reihenfolge | alle geordnet bzw. Anzahl in Forges Grenzen | `order` |
| `arrange` | `manipulateCardList` (Hellsicht) | jede Karte oben oder unter dem Stapel, Reihenfolge je Seite mit Pfeilen, der Rest des Stapels als Zahl dazwischen („… dazwischen 48 weitere Karten …“) | nichts verändert: alle oben, in Forges Reihenfolge | jede Karte genau einmal, nur erlaubte Seiten | `top`, `bottom` |
| `distribute` | `assignCombatDamage`, `assignGenericAmount` | je Ziel − Wert +, „x von y verteilt · noch z offen“ | jedes Ziel auf Forges Minimum | Summe = Gesamt, jedes ≥ Minimum | `amounts` |

Eine **blockierende** Frage (alle außer `buttons` und `select`) steht allein:
Solange sie offen ist, nimmt die Engine keine andere Antwort und keinen Tipp.
Forges Knöpfe des laufenden Schritts bleiben darunter offen (§10.2), werden aber
nicht gezeigt. Ohne blockierende Frage stehen Forges Knöpfe und seine Auswahl
nebeneinander.

Die **fragende Karte** (Forge schickt sie mit der Frage: der Zauber, der
bezahlt wird, der Angreifer, dessen Schaden verteilt wird) steht als kleines
Bild vor Forges Worten; ein Tipp darauf öffnet die Kartenansicht. Karten einer
Frage, die in keiner Zone des Tisches liegen, öffnet die Ansicht so, wie die
Frage sie zeigt („Aus Forges Frage – diese Karte liegt nicht sichtbar auf dem
Tisch“), ohne Knopf.

## 3. Nichts wird für den Spieler entschieden

- **Die App antwortet nie selbst.** Die Sitzung schickt nur, was die Seite ihr
  gibt, und die Seite nur, was der Spieler drückt. Kein Zeitlimit, keine
  Standardantwort, nichts bei einem neuen Zustand (Test: rendern, warten,
  neue Zustände – keine Antwort).
- **Forges Vorschlag ist nur der erste Entwurf** (vorausgewählt, hervorgehoben),
  nie eine Antwort.
- **Was Forge selbst überspringt, bleibt übersprungen** – und nur das (Bible §6):
  eine Karte mit genau einer Fähigkeit fragt nicht, eine leere Wahl ohne
  Minimum auch nicht (so macht es Forges eigene Oberfläche; die Brücke seit
  Prompt 02). Mehr wird nicht übersprungen; Forges automatisches Weitergeben
  der Priorität ist Prompt 16.
- **Schutz gegen Fehlklicks** (wie die Kartenansicht in Prompt 14):

| Gefahr | Schutz |
|---|---|
| Doppelklick: der zweite Druck trifft den Knopf der nächsten Frage, der an derselben Stelle erscheint (Forge fragt sofort weiter) | Absendeknöpfe nehmen 500 ms nach dem Erscheinen ihrer Frage nichts an (`ARMING_MS`); jede neue Frage (neue Nummer) schaltet neu scharf |
| gehaltenes Enter/Leertaste läuft in den nächsten Knopf | wiederholte Tasten (`repeat`) werden verworfen |
| Doppeltipp auf eine Karte einer Auswahl im Bereich | zählt einmal |
| Antworten, während Forge rechnet (seine Fragen ändern sich dabei) | nichts wird gesendet, die Knöpfe sind aus, der Grund steht da |
| eine unfertige Antwort (zu wenige gewählt, Summe offen, keine Zahl) | nie gesendet: der Knopf ist aus und sagt, was fehlt |

## 4. Rücknahmen, veraltete und abgelehnte Antworten

- **Rücknahme ist normal:** Forge zieht Fragen seines Schritts bei jeder
  Änderung zurück (neue Knöpfe beim Bezahlen, neue Auswahl). Die Bedienelemente
  gehören zur Nummer der Frage und verschwinden mit ihr, ebenso ein Entwurf; die
  nächste Frage beginnt frisch (auch dieselbe Art mit neuer Nummer).
- **Der Client lehnt ab, was er schon weiß** (die Frage ist zu, eine andere muss
  zuerst beantwortet werden, falsche Art, nicht im Protokoll): nichts wird
  gesendet, oben erscheint „Die Antwort wurde nicht gesendet“ mit dem Grund.
- **Forge lehnt ab, was nur die Engine weiß** (`input.rejected`: die Antwort
  passt nicht, die Frage wurde inzwischen zurückgezogen): Forges Hinweis oben und
  im Menü („Forge hat eine Eingabe nicht ausgeführt: …“); eine blockierende
  Frage bleibt offen, der Entwurf auch – der Spieler kann korrigieren.
- Getestet mit dem echten Client über einen geskripteten Worker (Seite und
  Sitzung) und in Chrome.

## 5. Nah an der Hand, auch auf kleinen Bildschirmen

Der Bereich liegt, wo er seit Prompt 13 liegt: im Hochformat direkt über der
Hand, im Querformat in der Seitenspalte neben der eigenen Tischhälfte. Seine
**Antwortknöpfe kleben an seinem unteren Rand** (Anvil-Lehre: primäre Aktionen
nie am Ende einer langen Rolle); darüber rollt, was nicht passt. Er wächst nur,
wenn der Inhalt es braucht:

| `GameBoard decision` | wann | Hochformat | niedriges Querformat (`short:`, höchstens 32rem hoch) |
|---|---|---|---|
| `compact` | Forges Knöpfe, Ja/Nein, eine Auswahl auf dem Tisch – wenn es passt | höchstens 7–11rem (wie bisher) | seine Zeile der Seitenspalte |
| `tall` | Forges Worte passen nicht (gemessen, einmal je Frage), Stapel oder Kampf zeigen etwas | bis 28 % der Höhe, nur so weit wie nötig; mehr Worte rollen im Bereich (die Spielfelder behalten ihren Platz – beim Bezahlen tippt man dort Länder) | unverändert (der Stapel bleibt sichtbar – vielleicht will man antworten) |
| `expanded` | eine blockierende Frage mit Liste, Formular oder Mengen; Karten außerhalb des Tisches; Worte, die nicht passen, bei leerem Stapel und Kampf | bis 36 %; Stapel und Kampf behalten einen schmaleren Streifen, die Spielfelder eine Kartenreihe | beide mittleren Zeilen der Seitenspalte; Stapel und Kampf treten zur Seite |

Gemessen im Prüfstand mit den echten und den gebauten Szenen im Gesamttest
(Abschnitt 12) – §9.4.

## 6. Forges Worte

- **Forges Knöpfe und Fragen kommen deutsch** (die Engine startet mit
  `--language=de-DE`): „Behalten“, „Mulligan“, „Spielen“, „Ziehen“, „OK“,
  „Zug beenden“, „Auto“, „Abbrechen“, „Alle angreifen“, „Zurückrufen“, „Ja“,
  „Nein“. Sie stehen, wie Forge sie schickt; ein Knopf ohne Wort heißt, was er
  im Protokoll tut: „OK“ (1), „Abbrechen“ (2). Die Hinweise aus Prompt 13
  („Forges Knöpfe teils englisch“) stammten aus einer englischen Testpartie.
- **Die Worte eines laufenden Schritts sind Forges aktuelle Anweisungszeile**,
  nicht der Text der Frage: der ist die Zeile des Augenblicks, in dem der
  Schritt begann – oft die vorige (§10.1). Eine blockierende Frage bringt ihren
  eigenen Text; die Anweisungszeile gehört dann zum wartenden Schritt darunter
  und bleibt weg.
- **Spieler als Einträge** heißen wie auf dem Tisch „Du“ und „Forge-KI“ – aus
  dem `me` des Zustands, nie aus Namen.
- Forges eigene Übersetzungsfehler stehen, wie Forge sie schickt (§10.3).

## 7. Keine Regeln im Client

Geprüft wird nur, was die Frage selbst sagt: `min`/`max`, `remainingMin`/
`remainingMax` (negativ = beliebig; beide 0 = alle ordnen), `total` und `min`
je Ziel, erlaubte Seiten, ob eine Zahl verlangt ist – dieselben Zahlen, die die
Brücke vor Forge noch einmal prüft (`Answers`). Welche Karte ein gültiges Ziel
ist, wie viel Schaden tödlich wäre, welche Reihenfolge klug ist: entscheidet
Forge bzw. der Spieler. Kein Kartenname, keine Mechanik im Code.

## 8. Tests

- `src/game/decision-model.test.ts` (22): welche Frage jetzt beantwortet wird
  (echt: Modus, Hellsicht, Fähigkeit, Kampfschaden – je mit den offenen Knöpfen
  darunter; Ziel, Abwerfen, Mulligan), Knopfworte (echt: Play/Draw, Ja/Nein),
  Auswahl (echt: Ziel auf dem Tisch, Ziel = Spieler, zwei abwerfen; gebaut:
  Bibliothek und verdeckt), Wahl (echt: Modus; gebaut: mehrere, Spieler),
  Ja/Nein (gebaut), Möglichkeiten (echt), Eingabe (gebaut), Reihenfolge
  (gebaut), Hellsicht (echt), Verteilen (echt), Bilder der Fragen, die gebauten
  Fragen des Prüfstands gegen das Protokoll. Jede Antwort wird mit dem
  Protokoll-Prüfer des Clients geprüft.
- `src/game/decision-panel.test.tsx` (29): jede Art im echten Tischcode – Knöpfe
  (Scharfschalten, abgeschaltet mit Grund, „Forge rechnet“, gehaltene Taste,
  Aufgabe unterwegs, London-Mulligan mit Zahl der markierten Karten), Auswahl (Worte der Anweisungszeile statt des alten Texts,
  Karten außerhalb des Tisches: sofort, Doppeltipp einmal, Rechtsklick sieht nur
  an), Wahl (einer, mehrere bis zum Maximum, „Nichts wählen“, Suche mit 120
  Einträgen, Kartenreihe), Ja/Nein, Möglichkeiten (echt, fragende Karte,
  gezeigte Liste), Eingabe (Zahl, falsche Zahl, Enter, Vorschläge),
  Reihenfolge (alle, einige), Hellsicht, Verteilen, Rücknahme mitsamt Entwurf,
  nichts ohne den Spieler, Ansage.
- `src/engine/engine-session.test.ts` (+6): `answer` schickt die Antwort, nicht
  während Forge rechnet, deutsche Gründe (falsche Art, nie gefragt,
  zurückgezogen), nur die blockierende Frage, Forges Ablehnung als Hinweis mit
  offener Frage, nicht während der Aufgabe, nichts von selbst.
- `src/game/game-page.test.tsx` (+2): mit dem echten Client über einen
  geskripteten Worker: behalten (Knopf erst scharf), Priorität, Land über die
  Kartenansicht, neue Priorität neu scharf, weitergeben, Forges Ablehnung
  sichtbar; eine blockierende Wahl bis zu Forges Bestätigung.
- Angepasst: `game-table.test.tsx` (der Bereich ohne Seite: Forges Knöpfe aus,
  „Nur ansehen“), `game-labels.test.ts` (`questionChoices` entfällt),
  `table-model.test.ts` (16 Szenen).
- **Neue echte Szenen** (`scripts/record-table-scenes.ts`, dieselben
  Aufzeichnungen der Testpartien wie seit Prompt 13, Regeln nur nach
  strukturierten Nachrichten): `play-draw`, `target`, `target-player`,
  `yes-no`, `discard`, `choose-mode`, `scry`, `ability`, `damage`. Die sieben
  alten Szenen blieben Byte für Byte gleich.
- **Gebaut** (die Testpartien erreichen sie nicht): Ja/Nein als eigene Frage,
  Zahl, Reihenfolge, gezeigte Liste, Mehrfachwahl, Karten außerhalb des Tisches
  (`src/test/built-questions.ts`, im Prüfstand mit `&built=`); jede gegen das
  Protokoll geprüft.

## 9. Nachweise

Alle Nachweise liefen auf **`3a0d80e`** mit sauberem Arbeitsbaum (Implementierung
`cf4d2ad`, Nachbesserungen `7af8623`, `6e5b34a`, Test `3a0d80e`; dazwischen drei
Commits der ORYX-Sitzung, §10.8). Engine unverändert: `engine/` ist in diesem
Prompt nicht berührt, Engine-Id `42f3bf1c7706cec5` wie seit Prompt 13. odin
(Intel i7-8700T, Debian 13), Node 22.22.3, Chrome for Testing 153.0.8010.12.

### 9.1 Statische Prüfungen und Unit-Tests

Erzeugte Dateien = Schemas, `tsc -b` und `oxlint` ohne Befund, **729
Vitest-Tests in 60 Dateien grün** (669 nach Prompt 14; 59 neue aus diesem Prompt,
§8, und einer der ORYX-Sitzung).

### 9.2 Browser-Gesamttest (`node scripts/e2e/run.ts`, 11 min 14 s): **E2E OK, 0 Befunde**

Alle bisherigen Abschnitte (HTTP, Oberflächen, Engine-Start, lokale Daten,
Kartendaten, Deck-Import mit echter Engine, Bibliothek, Einstellungen,
PWA, ohne Isolation, ORYX-Cloud) und neu:

- **Abschnitt 10 – die echte Partie wird gespielt** (§9.3), am Desktop mit der
  Maus und am Handy per Touch; die erste Entscheidung weiter mit Forges
  deutschen Worten geprüft, Ansehen einer Karte sendet weiter nichts.
- **Abschnitt 12 – jede Frageart:** 16 echte Szenen (7 aus Prompt 13/14, 9 neue
  Entscheidungsmomente) und 6 gebaute Fragen in **sechs Größen** (132
  Kombinationen): die Seite rollt nie, jeder Bereich im Fenster, die
  Antwortknöpfe im Fenster, keine Kontrolle unter 44 px auf Touch-Geräten,
  **axe 0 in allen 132**; dazu in drei Größen (kleines Handy, Handy quer,
  Desktop) jede Art **beantwortet**, die aufgezeichnete Antwort exakt die des
  Protokolls (§9.4).

### 9.3 Die echte Partie (Abschnitt 10)

| | Desktop (Maus), Constructed | Handy 412 × 915 (Touch) |
|---|---|---|
| Partiestart (Engine vorgewärmt) | 0,88 s (Commander: 0,87 s) | 0,86 s |
| Forges erste Frage | „Spielen“/„Ziehen“ (Münzwurf gewonnen) | ebenso |
| Antworten | „Spielen“ → „Behalten“ → Land „Gebirge“ über seine Kartenansicht (Forges `card.tap`) → „OK“ | ebenso, per Tipp |
| eigene bleibende Karten | 0 → 1 | 0 → 1 |
| Dauer vom ersten Druck bis zum letzten | 3,2 s | 3,3 s |
| Forges Knöpfe | 40 px (Maus) | 48 px (Touch) |
| Hinweise, Seitenfehler | keine | keine |
| axe (laufende Partie danach) | 0 | – |

Jeder Druck wartete, bis die Knöpfe scharf waren, und musste von Forge
angenommen werden (die Frage wechselt) – eine Ablehnung hätte den Test
scheitern lassen.

### 9.4 Alle Fragearten in sechs Größen (Abschnitt 12)

Höhe des Entscheidungsbereichs / Höhe seines Inhalts in px (was nicht passt,
rollt im Bereich; die Knöpfe kleben unten) und die Spielfelder daneben:

| Szene | Handy 412 × 915 | Handy quer 915 × 412 | kleines Handy 360 × 740 | Tablet 884 × 1104 | Tablet quer 1104 × 884 | Desktop 1440 × 900 |
|---|---|---|---|---|---|---|
| Mulligan (`buttons`) | 140/139 · Felder 258 | 259/258 · 130 | 140/139 · 173 | 120/119 · 353 | 351/351 · 352 | 362/362 · 363 |
| Ziel (`select`, langer Text) | 329/343 · 164 | 259/363 · 130 | 266/399 · 100 | 232/231 · 297 | 351/363 · 352 | 362/362 · 363 |
| Ja/Nein einer Fähigkeit (Stapel voll) | 220/219 · 145 | 129/219 · 130 | 207/239 · 85 | 160/159 · 270 | 351/351 · 352 | 358/358 · 359 |
| Modus (`choose`) | 316/315 · 170 | 259/335 · 130 | 266/335 · 100 | 276/275 · 275 | 351/351 · 352 | 362/362 · 363 |
| Hellsicht (`arrange`) | 329/483 · 114 | 259/483 · 130 | 266/499 · 74 | 376/375 · 186 | 351/483 · 352 | 358/459 · 359 |
| Kampfschaden (`distribute`) | 329/353 · 114 | 259/353 · 130 | 266/461 · 74 | 354/353 · 202 | 351/353 · 352 | 358/358 · 359 |
| Reihenfolge (gebaut) | 329/381 · 164 | 259/381 · 130 | 266/489 · 100 | 382/381 · 222 | 351/381 · 352 | 362/368 · 363 |
| Mehrfachwahl (gebaut) | 329/413 · 164 | 259/413 · 130 | 266/413 · 100 | 397/413 · 214 | 351/413 · 352 | 362/405 · 363 |

- Kleinste Kontrolle des Bereichs auf Touch-Geräten: **44 px** (Pfeile,
  Plus/Minus), Knöpfe 48 px, Auswahlkarten 46 px; am Desktop 36–40 px (Maus).
- Beantwortet (kleines Handy, Handy quer, Desktop; jede Antwort genau so): Mulligan
  `button 1`, Spielen/Ziehen `button 2`, Ziel abbrechen `button 2`, Modus
  `choices [2]`, Hellsicht `top [2] bottom [1]`, Fähigkeit `option 2`,
  Kampfschaden `amounts [1, 1]`, Ja/Nein (gebaut) `yes false`, Zahl (gebaut)
  `value "3"`, Reihenfolge (gebaut) `order [1, 3, 2]`, gezeigte Liste (gebaut)
  `option 1`, Mehrfachwahl (gebaut) `choices [2, 4]`, Karte außerhalb des
  Tisches (gebaut) `choices [1]`; kein Antippen einer Tischkarte dabei.

### 9.5 Kosten

Beide Stände gleich gebaut (volle Engine und Kartendaten, gzip -9): Das
**Start-JavaScript bleibt unverändert** (246,1 KB vor und nach der
Implementierung, `4d92b2a` → `cf4d2ad`; die Zunahme gegenüber Prompt 14, 242,9 KB,
ist die neue ORYX-Cloud-Datei). Die nachgeladene **Partie-Seite** wächst von
16,7 auf 25,7 KB (25,8 KB auf `3a0d80e`).

### 9.6 Der Weg zum grünen Lauf

- **Lauf 1:** Die erste echte Partie (Commander) zeigte 180 s lang keine
  Entscheidung. Nachgestellt in einem eigenen Profil kam Forges erste Frage
  nach 0,3 s; in den Läufen 3–5 startete dieselbe Partie in 0,87 s. Eine
  App-Ursache fand sich nicht; odin war zu der Zeit knapp an Speicher (§10.10).
  Der Test sagt seitdem bei einem solchen Hänger, was die Seite zeigt, und legt
  ein Bildschirmfoto ab.
- **Läufe 2 und 4** wurden von außen beendet (SIGTERM, Exit 143 – §10.10).
- **Lauf 3** (vollständig, 4 Befunde): kleines Handy mit Stapel – Spielfelder
  68–70 px, weil der Bereich für langen Text bis 36 % wuchs → für Text nur noch
  28 % (§5); die ORYX-Attrappe kannte die neue Spielzeit-Meldung der
  Cloud-Datei 1.1.x nicht (404) → ergänzt (§10.8).
- **Lauf 4** zusätzlich: „Daten nach dem Löschen der Website-Daten“ – der Test
  las die Zahl der Decks, bevor sie der neu geöffneten Datenbank gefolgt war
  (Lauf 3 und 5 grün) → er wartet bis zu 10 s darauf.
- **Lauf 5:** E2E OK, 0 Befunde.

## 10. Befunde

### 10.1 Die Texte der laufenden Schritte sind oft die vorigen

Die Brücke gibt einer Knopf- oder Auswahlfrage die Anweisungszeile mit, die in
dem Augenblick galt, als Forge sie stellte. Forges Zielauswahl
(`InputSelectTargets`) nennt ihre Karten aber schon im Konstruktor, **vor**
ihrer Anweisung: In den Aufzeichnungen trägt die Auswahl „Magmastrahl … wähle
ein Ziel“ den Text „Priorität: Player Zug: 8 … Ziehsegment“. Ebenso trägt die
Mulligan-Frage den Text der vorigen Frage („… wer beginnt?“). Anvil hatte das am
28.8.2026 gemeldet bekommen („ich drücke Spielen und es steht immer noch
spielen oder ziehen da“). Deshalb zeigt der Bereich für laufende Schritte
Forges aktuelle Anweisungszeile, nie den Fragetext.

### 10.2 Forges Knöpfe bleiben unter einer blockierenden Frage offen

Wählt der Spieler während der Priorität einen Modus, bezahlt er einen Zauber und
hellsieht dabei, verteilt er Kampfschaden während des Angriffs: Die Knöpfe des
Schritts (Priorität, Bezahlen, erklärter Angriff) bleiben offen, solange Forge
die blockierende Frage stellt, und werden erst danach zurückgezogen. Beantworten
lassen sie sich dann nicht (der Client lehnt mit `not-active` ab). Der Bereich
zeigt deshalb nur die blockierende Frage (`currentDecision`).

### 10.3 Forges deutsche Übersetzung hat Fehler

In Forges `de-DE.properties` (gepinnter Stand `ed0333fecb`):
`lblNCombatDamage` = „{0} Commander-Schaden“ (gemeint: Kampfschaden – die
Verteilfrage des Kampfschadens heißt auf Deutsch also „2 Commander-Schaden“),
`lblArrangeCardsToBePutOnTopOfYourLibrary` = „Ordne Karten, welche **unter** die
Bibliothek gelegt werden sollen“ (gemeint: oben darauf), `lblPayFirst`
unübersetzt. OpenMana zeigt Forges Worte, wie Forge sie schickt; die eigene
Zeile darunter („0 von 2 verteilt …“) stimmt. Vorschlag: Korrektur upstream
bzw. als Patch mit dem nächsten Forge-Update (Prompt 26).

### 10.4 Die Auswahlfrage nennt auch Ids verdeckter Karten

`setSelectables` schickt in `cards` die Id **jeder** wählbaren Karte, auch einer,
die der Spieler nicht sehen darf – die Einträge (`items`) verbergen sie richtig
(`{nr, hidden: true}`). Da Forge Ids in Decklisten-Reihenfolge vergibt, könnte
eine Id die Karte verraten (Grund der Regel aus Prompt 02). Die App benutzt
`cards` nicht (nur die Einträge); die Brücke sollte dort nur sichtbare Ids
senden. Vorschlag: mit dem Engine-Neubau von Prompt 16 (Protokoll 5).

### 10.5 Eine Auswahl ohne Karte: das Ziel ist ein Spieler

Zielt ein Zauber nur auf Spieler (Schock ohne Kreaturen), nennt Forges Auswahl
keine Karte; gewählt würde mit `player.tap`. Welche Spieler gültig sind, sagt
Forge erst beim Tipp (`InputSelectTargets.onPlayerSelected` prüft dann). Ein
Tipp, der nachweislich nichts täte, wird nie angeboten (Prompt 14) – deshalb
sagt der Bereich hier ehrlich, dass Spieler noch nicht wählbar sind, und
„Abbrechen“ führt weiter. Spieler als Ziele samt Forges gültigen Spielern im
Protokoll: Prompt 17.

### 10.6 Abwerfen hat keine Knöpfe

Beim Abwerfen einer genauen Anzahl („Faithless Looting: zwei abwerfen“) schaltet
Forge beide Knöpfe ab – die Brücke sendet dann keine Knopffrage – und beendet
die Auswahl selbst, sobald genug Karten gewählt sind. Der Bereich zeigt dann nur
die Anzahl und wo die Karten liegen.

### 10.7 „An beliebige Stelle“ bietet der gepinnte Forge nie an

Prompt 02 hatte `arrange` mit `toAnywhere` als Lücke für diesen Prompt notiert.
Im gepinnten Forge ruft nur `arrangeForMove` die Methode `manipulateCardList`
auf, stets mit `toAnywhere = false`. Oben/unten deckt damit alles ab, was Forge
fragt; sollte ein Forge-Update es ändern, fällt es in Prompt 26 auf (die Frage
trägt das Flag).

### 10.8 Eine parallele Sitzung im selben Arbeitsbaum

Während dieses Laufs hat eine andere Sitzung die ORYX-Cloud-Datei auf 1.1.0
gebracht (`src/cloud`, Commit `4d92b2a`); ihr Test war zwischenzeitlich rot.
Getrennt gehalten: Nur eigene Dateien wurden gestaged und committet, die
Nachweise liefen danach auf einem sauberen Stand.

### 10.9 Der Prüfstand erschöpfte Chrome auf einem vollen Rechner

Ein erster Probelauf lud alle Szenen je Größe in **einer** Seite (über 40
Aufrufe des Dev-Servers mit Hunderten Modulen). Auf odin, mit vier weiteren
Sitzungen und vollem Swap, brach Chrome mit `net::ERR_INSUFFICIENT_RESOURCES`
ab und die Seite stürzte ab. Jetzt bekommt jede Szene eine frische Seite (das
Profil behält die Kartendaten), die Protokoll-Prüfer laufen nicht mehr im
Prüfstand (die gebauten Fragen prüft der Unit-Test), und jede Art wird in drei
Größen beantwortet (Layout weiter in sechs).

### 10.10 earlyoom beendet den Test, wenn odin der Speicher ausgeht

Auf odin läuft `earlyoom` (`-m 8 -s 5 --prefer (java|node)`): Fällt der freie
Speicher unter 8 % und der freie Swap unter 5 %, beendet es zuerst
node-Prozesse (SIGTERM → Exit 143). Der Swap war an diesem Morgen dauerhaft
voll, andere Sitzungen fuhren schwere node-Jobs (VLCTY-Analysen mit bis zu 8 GB
Heap, ein Stresstest) – zweimal traf es den Testlauf. Lehre: vor einem
Gesamttest `free -h` ansehen und schwere Jobs anderer Sitzungen abwarten; ein
Exit 143 ohne Testbefund ist kein App-Fehler.

## 11. Entscheidungen und Abweichungen

| Frage | Entscheidung | Grund |
|---|---|---|
| Sofort antworten oder erst markieren? | Wahl, Möglichkeiten, Reihenfolge, Hellsicht, Verteilen: markieren, dann „Bestätigen“. Forges Knöpfe und Ja/Nein: ein Druck. Auswahl: sofort (Forge schaltet um, sein OK bestätigt) | Anvil 28.8.2026: „Ein Tipp schreibt nicht mehr direkt ins Spiel; er markiert, und was markiert ist, sieht man, bevor es abgeschickt wird.“ Anvil beantwortete Optionen noch sofort; hier auch dort ein Bestätigen, weil etwa „welche Fähigkeit“ nicht zurückzunehmen ist – ein Druck mehr |
| Ausgeschaltete Knöpfe | sichtbar, aus, mit Grund (Design-System Regel 4) | Anvil blendete beim Blocken das tote „Abbrechen“ aus; das Blocken selbst ist Prompt 19 |
| Wörter der Priorität | Forges „OK“ und „Zug beenden“ unverändert | verständliche Priorität, Phasenleiste, Auto-Pass: Prompt 16 |
| Anfang einer Reihenfolge | „alle ordnen“: Forges Reihenfolge; sonst Forges Vorschlag oder leer | Bestätigen ohne Umsortieren = Forges eigene Reihenfolge, keine erfundene |
| Anfang des Verteilens | jedes Ziel auf Forges Minimum, nichts vorverteilt | tödlichen Schaden auszurechnen wäre eine Regel (Forges Desktop tut es mit Forge-Hilfen); der Spieler verteilt |
| Wachsen des Bereichs | gemessen (einmal je Frage) statt fest | lange Anweisungen (Magmastrahl mit Erinnerungstext) passen sonst nicht; nie hin und her |
| Zuklappen wie in Anvil | nein | der Bereich liegt im Raster und deckt die Spielfelder nie zu (Anvils Leiste lag über dem Feld) |
| Spieler als Ziel | nicht in diesem Prompt | §10.5, Prompt 17 |

## 12. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Spieler als Ziel (`player.tap`), Forges gültige Spieler im Protokoll | 17 |
| Priorität verständlich (Worte für „OK“, Phasenleiste, Forges Auto-Pass), Stapel mit Karten | 16 |
| Kampf: Worte für OK/Zurückrufen beim Angriff und Blocken, Kampfschaden auf den verteidigenden Spieler (Trampelschaden: `distribute` ohne Verteidiger, seit Prompt 02) | 18/19 |
| `select.cards` nennt Ids verdeckter Karten (§10.4) | 16/17 (Engine-Neubau) |
| Forges Übersetzungsfehler (§10.3) | upstream / 26 |
| Zonen blättern (Friedhof, Exil) – Karten daraus stehen bis dahin als Reihe im Entscheidungsbereich | 20 |
