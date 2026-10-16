# OpenMana-Partiebericht

## 1. Vorwort für die lesende KI

Dies ist der Bericht über eine Partie *Magic: The Gathering*, gespielt in OpenMana: ein Mensch gegen die KI der Regel-Engine Forge. Forge ist die alleinige Regelinstanz; OpenMana zeigt nur, was Forge meldet, und gibt die Eingaben des Menschen an Forge weiter.

**Wozu der Bericht dient:** Du sollst das Spiel des Menschen beurteilen – seine Schwächen, vergeudete Züge, verpasste Landdrops, ungenutztes Mana, nicht gespielte spielbare Karten, fragwürdige Angriffe und Blocks, zu frühes oder zu spätes Passen und bessere Spiellinien. Der Bericht selbst urteilt nicht; er legt die Tatsachen der Partie vor. Beurteile jede Entscheidung mit dem Wissen, das der Spieler in diesem Moment hatte.

**Begriffe:** „Spieler“ ist immer der Mensch, „Forge-KI“ immer sein Gegner. Kartennamen stehen englisch, wie Forge sie als Kennnamen liefert; Forges eigene Texte (Fragen, Hinweiszeilen, Protokollzeilen, Beschriftungen der Knöpfe) stehen wörtlich in Anführungszeichen, in der Sprache, in der Forge spielte. Jede Karte trägt ihre Kennung, etwa „Lightning Bolt (#53)“: Forge vergibt sie je Partie, gleiche Karten unterscheiden sich so. Anhang A nennt zu jeder Kennung den Namen.

**Verdeckt bleibt verdeckt:** Die Hand der Forge-KI, beide Bibliotheken und verdeckte Karten kannte der Spieler nicht; die Aufzeichnung enthält von ihnen nur die Anzahl, und so steht es auch hier („eine verdeckte Karte“). Karten, die Forge aufdeckte, stehen mit Namen. Die Deckliste der Forge-KI steht nur in Anhang B; sie war während der Partie nicht bekannt.

**Zugzählung:** Forge zählt die Züge über beide Spieler fortlaufend – Zug 1 gehört dem Spieler, der beginnt, Zug 2 dem anderen und so weiter. Jede Zugüberschrift nennt darum beides, etwa „Zug 25 (13. Zug des Spielers)“ oder „Zug 26 (13. Zug der Forge-KI)“.

**Herkunft jeder Aussage:** Alles stammt aus der Aufzeichnung der Partie (Forges Nachrichten und die Eingaben des Spielers, in der Reihenfolge des Empfangs). Verweise wie [L123] nennen den Eintrag 123 der Aufzeichnung (Feld `seq` in der zugehörigen JSON-Datei). Nichts ist aus dem Unterschied zweier Spielstände erschlossen. Genau zwei Stellen sind gekennzeichnete Lesarten: (1) **Ungenutzte Möglichkeiten** – beim letzten Passen des Spielers in einer eigenen Hauptphase bei leerem Stapel gelesen aus Forges Spielstand: welche Handkarten Forge als spielbar markiert hatte, welche Länder ungetappt waren und ob der Landdrop noch offen war; (2) **Vermutung** – Forge nennt zu einer Lebensänderung ohne Schaden keine Quelle; der Bericht schreibt dann „Quelle von Forge nicht genannt“ und nennt höchstens das in diesem Moment verrechnete Stapelobjekt, ausdrücklich als Vermutung.

**Entscheidungen des Spielers** stehen als Dreiklang: *Frage* (was Forge wissen wollte, mit Phase und Schritt), *Angebot* (alle Knöpfe mit Beschriftung und Bedeutung, alle wählbaren Karten und Spieler, bei der Priorität die Karten, die Forge als spielbar markierte) und *Antwort* (was der Spieler tat). Sie sind fortlaufend nummeriert (E1, E2 …); Angriffe, Blocks und Schaden nennen die Entscheidung, die ihnen voranging. Gleiche Prioritätsfragen, die der Spieler unmittelbar nacheinander und ohne Ereignis dazwischen mit „passen“ beantwortete, stehen als eine Zeile mit Zähler. Das Weiterschalten einer Anzeige der Gegneraktionen ist keine Spielentscheidung und fehlt (Anzahl in Anhang C).

**Fragearten Forges in Spielerworten:** *Priorität* – der Spieler darf jetzt etwas spielen oder passen (passen = nichts tun und Forge weitermachen lassen; „Zug beenden“ = bis zum Ende dieses Zuges passen). *Angreifer wählen* – Kreaturen antippen, die angreifen sollen, dann bestätigen (ohne Kreatur = nicht angreifen). *Blocker wählen* – eigene Kreaturen einem Angreifer zuordnen, dann bestätigen. *Mulligan* – die Starthand behalten oder neu ziehen; danach so viele Karten unter die Bibliothek legen, wie Forge verlangt. *Ziel wählen / Auswahl* – Karten oder Spieler wählen, die Forge anbietet. *Kosten bezahlen* – Manaquellen antippen, Mana aus dem Vorrat nehmen oder Forge automatisch zahlen lassen. *Modus / eine Möglichkeit wählen* – eine von Forges Optionen. *Reihenfolge festlegen* und *Karten anordnen* – etwa beim Hellsehen oben oder unten. *Ja oder Nein* – eine Bestätigung.

## 2. Kopf

- Beginn: 2026-10-08 00:00 UTC
- Dauer: 1 min
- Modus: Normal (Forge-Format constructed)
- Deck des Spielers: „OpenMana Smoke Red+“ · Deck der Forge-KI: in Anhang B
- KI-Profil: „Default“ (in OpenMana: „Standard“)
- Seed: 3
- OpenMana-Version: 0.1.0-test-recorded
- Forge-Version: 2.0.15 (Commit ed0333fecb1f), Engine-Protokoll 9
- Status: beendet
- Ergebnis: Die Forge-KI hat gewonnen. Forges Grund: `AllOpponentsLost`. Zugzahl laut Forge: 4. Aufgegeben: ja.

## 3. Deckliste des Spielers

- Name: „OpenMana Smoke Red+“
- Hauptdeck (60 Karten):
  - 22 × Mountain
  - 4 × Raging Goblin
  - 2 × Goblin Raider
  - 4 × Goblin Piker
  - 4 × Goblin Arsonist
  - 2 × Bonecrusher Giant
  - 2 × Hill Giant
  - 2 × Canyon Minotaur
  - 4 × Shock
  - 4 × Lightning Bolt
  - 4 × Magma Jet
  - 2 × Abrade
  - 2 × Faithless Looting
  - 2 × Fiery Confluence
- Sideboard: leer

## 4. Starthand und Mulligan

- [L4] Hand des Spielers (7): Bonecrusher Giant (#53), Goblin Raider (#59), Mountain (#45), Goblin Arsonist (#55), Mountain (#34), Mountain (#37), Mountain (#33)
- [L5] Forges Hinweiszeile: „Forge AI is going first. Player, you are going 2nd. Do you want to keep your hand?“
- [L6] **E1** · Zug 0, vor dem ersten Zug
  - Frage: Mulligan (Frage 1) · Forges Hinweiszeile: „Forge AI is going first. Player, you are going 2nd. Do you want to keep your hand?“
  - Angebot: Knöpfe: 1 „Keep“, 2 „Mulligan“; Hand: Bonecrusher Giant (#53), Goblin Raider (#59), Mountain (#45), Goblin Arsonist (#55), Mountain (#34), Mountain (#37), Mountain (#33)
  - Antwort: in der Aufzeichnung nicht enthalten (Eingabe 1 fehlt; Forge bestätigte eine Antwort auf diese Frage). Forge nahm die Antwort an [L6].
- [L9] Hand des Spielers (7): Mountain (#41), Fiery Confluence (#24), Mountain (#28), Shock (#49), Mountain (#26), Lightning Bolt (#4), Mountain (#33)
- [L10] Forges Hinweiszeile: „Return 1 card(s) to the bottom of your library“
- [L14] Forges Hinweiszeile: „Return 0 card(s) to the bottom of your library“
- [L15] **E2** · Zug 0, vor dem ersten Zug
  - Frage: Karten unter die Bibliothek legen (Frage 3) · Forges Hinweiszeile: „Return 0 card(s) to the bottom of your library“
  - Angebot: Knöpfe: 1 „OK“, 2 „Auto“ – nicht verfügbar; Hand: Mountain (#41), Fiery Confluence (#24), Mountain (#28), Shock (#49), Mountain (#26), Lightning Bolt (#4), Mountain (#33); schon für unten gewählt: Mountain (#41)
  - Antwort: in der Aufzeichnung nicht enthalten (Eingabe 3 fehlt; Forge bestätigte eine Antwort auf diese Frage). Forge nahm die Antwort an [L15].
- [L16] Forge-Protokoll (`MULLIGAN`): „Player has mulliganed down to 6 cards.“
- [L18] Hand des Spielers (6): Fiery Confluence (#24), Mountain (#28), Shock (#49), Mountain (#26), Lightning Bolt (#4), Mountain (#33)
- [L19] Forges Hinweiszeile: „Forge AI is going first. Player, you are going 2nd. Do you want to keep your hand?“
- [L20] **E3** · Zug 0, vor dem ersten Zug
  - Frage: Mulligan (Frage 4) · Forges Hinweiszeile: „Forge AI is going first. Player, you are going 2nd. Do you want to keep your hand?“
  - Angebot: Knöpfe: 1 „Keep“, 2 „Mulligan“; Hand: Fiery Confluence (#24), Mountain (#28), Shock (#49), Mountain (#26), Lightning Bolt (#4), Mountain (#33)
  - Antwort: in der Aufzeichnung nicht enthalten (Eingabe 4 fehlt; Forge bestätigte eine Antwort auf diese Frage). Forge nahm die Antwort an [L20].
- [L21] Forge-Protokoll (`MULLIGAN`): „Forge AI has kept a hand of 7 cards“
- [L21] Forge-Protokoll (`MULLIGAN`): „Player has kept a hand of 6 cards“

## 5. Zugprotokoll

### Zug 1 (1. Zug der Forge-KI)

#### Lage zu Beginn

- Zustand [L24] · Leben: Spieler 20 · Forge-KI 20
- Spieler – Hand (6): Fiery Confluence (#24), Mountain (#28), Shock (#49), Mountain (#26), Lightning Bolt (#4), Mountain (#33)
- Spieler – Länder (0): ungetappt: keine; getappt: keine
- Spieler – übriges Spielfeld (0): nichts
- Spieler – Friedhof (0): keine
- Spieler – Exil (0): keine
- Spieler – Bibliothek: 54 Karten
- Forge-KI – Hand: 6 Karten (verdeckt)
- Forge-KI – Länder (1): ungetappt: Forest (#116); getappt: keine
- Forge-KI – übriges Spielfeld (0): nichts
- Forge-KI – Friedhof (0): keine
- Forge-KI – Exil (0): keine
- Forge-KI – Bibliothek: 53 Karten

#### Ablauf

- [L21] Forge-Protokoll (`TURN`): „Turn 1 (Forge AI)“
- [L23] Forge-Protokoll (`LAND`): „Forge AI played Forest (116)“ – Karte: Forest (#116) – von: Forge-KI

#### Stand am Zugende

- Zustand [L24] · Leben: Spieler 20 · Forge-KI 20
- Handkarten: Spieler 6 · Forge-KI 6
- Kreaturen auf dem Feld (Karten mit Stärke/Widerstandskraft von Forge): Spieler 0 · Forge-KI 0

### Zug 2 (1. Zug des Spielers)

#### Lage zu Beginn

- Zustand [L29] · Leben: Spieler 20 · Forge-KI 20
- Spieler – Hand (7): Fiery Confluence (#24), Mountain (#28), Shock (#49), Mountain (#26), Lightning Bolt (#4), Mountain (#33), Goblin Arsonist (#55)
- Spieler – Länder (0): ungetappt: keine; getappt: keine
- Spieler – übriges Spielfeld (0): nichts
- Spieler – Friedhof (0): keine
- Spieler – Exil (0): keine
- Spieler – Bibliothek: 53 Karten
- Forge-KI – Hand: 6 Karten (verdeckt)
- Forge-KI – Länder (1): ungetappt: Forest (#116); getappt: keine
- Forge-KI – übriges Spielfeld (0): nichts
- Forge-KI – Friedhof (0): keine
- Forge-KI – Exil (0): keine
- Forge-KI – Bibliothek: 53 Karten

#### Ablauf

- [L26] Forge-Protokoll (`TURN`): „Turn 2 (Player)“
- [L28] Forges Hinweiszeile: „Priority: Player Turn: 2 (Player) Phase: Main phase, precombat Stack: Empty“
- [L31] Forge lehnte Eingabe 5 ab (die Eingabe selbst fehlt in der Aufzeichnung): Die Frage war schon beantwortet oder zurückgezogen. Forge: „question 9999999 is not open“
- [L32] Forge lehnte Eingabe 6 ab (die Eingabe selbst fehlt in der Aufzeichnung): Die Antwort passte nicht zur Frage. Forge: „button must be 1 or 2, got 3“
- [L33] Forge lehnte Eingabe 7 ab (die Eingabe selbst fehlt in der Aufzeichnung): Diese Karte ist gerade nicht sichtbar. Forge: „no visible card with this id“
- [L34] Forge lehnte Eingabe 8 ab (die Eingabe selbst fehlt in der Aufzeichnung): Die Frage war schon beantwortet oder zurückgezogen. Forge: „question 2 is not open“
- [L38] Forge-Protokoll (`LAND`): „Player played Mountain (28)“ – Karte: Mountain (#28) – von: Spieler
- [L43] Forges Hinweiszeile: „Shock (49) - Shock deals 2 damage to any target. Select any target“
- [L54] Forges Hinweiszeile: „Shock (49) - Shock (49) deals 2 damage to Forge AI. Pay Mana Cost: {R}“
- [L56] **E4** · Zug 2 (Spieler am Zug), Erste Hauptphase
  - Frage: Kosten bezahlen (Frage 10) · es geht um Shock (#49) · Forges Hinweiszeile: „Shock (49) - Shock (49) deals 2 damage to Forge AI. Pay Mana Cost: {R}“
  - Angebot: Knöpfe: 1 „Auto“, 2 „Cancel“; noch zu zahlen: {R}; spielbar markiert: Mountain (#28, Spielfeld, Forge: „Pay mana with card“)
  - Antwort: in der Aufzeichnung nicht enthalten (Eingabe 13 fehlt; Forge bestätigte eine Antwort auf diese Frage). Forge nahm die Antwort an [L56].
- [L58] Forge-Protokoll (`STACK_ADD`): „Player cast Shock targeting \[Forge AI\]“ – Karte: Shock (#49) – von: Spieler
- [L58] Forge-Protokoll (`DAMAGE`): „Shock (49) deals 2 non-combat damage to Forge AI.“ – Karte: Shock (#49) – von: Spieler (nach E4)
- [L58] Forge-Protokoll (`LIFE`): „Life: Forge AI 20 > 18“ – Quelle von Forge nicht genannt
- [L58] Forge-Protokoll (`STACK_RESOLVE`): „Shock (49) - Shock (49) deals 2 damage to Forge AI.“ – Karte: Shock (#49) – von: Spieler

#### Ungenutzte Möglichkeiten

- Der Spieler passte in diesem Zug in keiner eigenen Hauptphase bei leerem Stapel selbst (Forges automatisches Passen oder keine Hauptphase mit Frage). Gelesen aus dem letzten Zustand einer eigenen Hauptphase bei leerem Stapel: Erste Hauptphase, Zustand [L55]; Forge meldete dort, der Spieler könne etwas tun: ja.
- Landdrop offen: nein (Forge: 1 von 1 Land gespielt).
- Ungetappte Länder: Mountain (#28).
- Als spielbar markierte Handkarten: keine.

#### Stand am Zugende

- Zustand [L55] · Leben: Spieler 20 · Forge-KI 20
- Handkarten: Spieler 5 · Forge-KI 6
- Kreaturen auf dem Feld (Karten mit Stärke/Widerstandskraft von Forge): Spieler 0 · Forge-KI 0

### Zug 3 (2. Zug der Forge-KI)

#### Lage zu Beginn

- Zustand [L59] · Leben: Spieler 20 · Forge-KI 18
- Spieler – Hand (5): Fiery Confluence (#24), Mountain (#26), Lightning Bolt (#4), Mountain (#33), Goblin Arsonist (#55)
- Spieler – Länder (1): ungetappt: keine; getappt: Mountain (#28, getappt)
- Spieler – übriges Spielfeld (0): nichts
- Spieler – Friedhof (1): Shock (#49)
- Spieler – Exil (0): keine
- Spieler – Bibliothek: 53 Karten
- Forge-KI – Hand: 6 Karten (verdeckt)
- Forge-KI – Länder (1): ungetappt: Forest (#116); getappt: keine
- Forge-KI – übriges Spielfeld (0): nichts
- Forge-KI – Friedhof (0): keine
- Forge-KI – Exil (0): keine
- Forge-KI – Bibliothek: 53 Karten

#### Ablauf

- [L58] Forge-Protokoll (`TURN`): „Turn 3 (Forge AI)“
- [L61] Forge-Protokoll (`LAND`): „Forge AI played Forest (113)“ – Karte: Forest (#113) – von: Forge-KI

#### Stand am Zugende

- Zustand [L59] · Leben: Spieler 20 · Forge-KI 18
- Handkarten: Spieler 5 · Forge-KI 6
- Kreaturen auf dem Feld (Karten mit Stärke/Widerstandskraft von Forge): Spieler 0 · Forge-KI 0

### Zug 4 (2. Zug des Spielers)

#### Lage zu Beginn

- Zustand [L64] · Leben: Spieler 20 · Forge-KI 18
- Spieler – Hand (5): Fiery Confluence (#24), Mountain (#26), Lightning Bolt (#4), Mountain (#33), Goblin Arsonist (#55)
- Spieler – Länder (1): ungetappt: Mountain (#28); getappt: keine
- Spieler – übriges Spielfeld (0): nichts
- Spieler – Friedhof (1): Shock (#49)
- Spieler – Exil (0): keine
- Spieler – Bibliothek: 53 Karten
- Forge-KI – Hand: 6 Karten (verdeckt)
- Forge-KI – Länder (2): ungetappt: Forest (#116), Forest (#113); getappt: keine
- Forge-KI – übriges Spielfeld (0): nichts
- Forge-KI – Friedhof (0): keine
- Forge-KI – Exil (0): keine
- Forge-KI – Bibliothek: 52 Karten

#### Ablauf

- [L61] Forge-Protokoll (`TURN`): „Turn 4 (Player)“
- [L63] Forges Hinweiszeile: „Priority: Player Turn: 4 (Player) Phase: Upkeep step Stack: Empty“
- [L68] Forge-Protokoll (`GAME_OUTCOME`): „Turn 2“
- [L68] Forge-Protokoll (`GAME_OUTCOME`): „Player has conceded“
- [L68] Forge-Protokoll (`GAME_OUTCOME`): „Forge AI has won because all opponents have lost“
- [L68] Forge-Protokoll (`MATCH_RESULTS`): „Player: 0 Forge AI: 1“
- [L70] Die Partie ist zu Ende: Die Forge-KI hat gewonnen. Forges Grund: `AllOpponentsLost`. Zugzahl laut Forge: 4. Aufgegeben: ja.

#### Ungenutzte Möglichkeiten

- In diesem Zug zeigt die Aufzeichnung keinen Zustand einer Hauptphase des Spielers mit leerem Stapel; nichts zu lesen.

#### Stand am Zugende

- Zustand [L69] · Leben: Spieler 20 · Forge-KI 18
- Handkarten: Spieler 5 · Forge-KI 6
- Kreaturen auf dem Feld (Karten mit Stärke/Widerstandskraft von Forge): Spieler 0 · Forge-KI 0

## 6. Spielende

- Die Forge-KI hat gewonnen. Forges Grund: `AllOpponentsLost`. Zugzahl laut Forge: 4. Aufgegeben: ja.
- Leben laut Forges Ergebnis: Spieler 20
- Leben laut Forges Ergebnis: Forge-KI 18
- Zustand [L69] · Leben: Spieler 20 · Forge-KI 18
- Handkarten: Spieler 5 · Forge-KI 6
- Kreaturen auf dem Feld (Karten mit Stärke/Widerstandskraft von Forge): Spieler 0 · Forge-KI 0
- Bibliotheken: Spieler 53 · Forge-KI 52

## Anhang A – Kennung → Name

Nur Karten, die in der Aufzeichnung irgendwann sichtbar waren. Die Typzeile steht, wie Forge sie sendet (in Forges Kartensprache).

| Kennung | Name | Typzeile | Besitzer |
| ---: | --- | --- | --- |
| 4 | Lightning Bolt | Instant | Spieler |
| 24 | Fiery Confluence | Sorcery | Spieler |
| 26 | Mountain | Basic Land - Mountain | Spieler |
| 28 | Mountain | Basic Land - Mountain | Spieler |
| 33 | Mountain | Basic Land - Mountain | Spieler |
| 34 | Mountain | Basic Land - Mountain | Spieler |
| 37 | Mountain | Basic Land - Mountain | Spieler |
| 41 | Mountain | Basic Land - Mountain | Spieler |
| 45 | Mountain | Basic Land - Mountain | Spieler |
| 49 | Shock | Instant | Spieler |
| 53 | Bonecrusher Giant | Creature - Giant | Spieler |
| 55 | Goblin Arsonist | Creature - Goblin Shaman | Spieler |
| 59 | Goblin Raider | Creature - Goblin Warrior | Spieler |
| 113 | Forest | Basic Land - Forest | Forge-KI |
| 116 | Forest | Basic Land - Forest | Forge-KI |

## Anhang B – Deckliste der Forge-KI (während der Partie nicht bekannt)

Diese Liste war dem Spieler während der Partie **nicht bekannt**. Urteile über seine Entscheidungen nur mit dem, was er zu diesem Zeitpunkt sehen konnte.

- Name: „OpenMana Smoke Green“
- Hauptdeck (60 Karten):
  - 22 × Forest
  - 4 × Llanowar Elves
  - 4 × Grizzly Bears
  - 4 × Runeclaw Bear
  - 4 × Kalonian Tusker
  - 4 × Centaur Courser
  - 4 × Trained Armodon
  - 4 × Giant Spider
  - 2 × Craw Wurm
  - 4 × Giant Growth
  - 4 × Rampant Growth
- Sideboard: leer

## Anhang C – Herkunft

- Kennung der Aufzeichnung: 00000000-0000-4000-8000-000000000022
- Logeinträge: 71 (von Forge 71, vom Spieler 0)
- Engine-Protokoll: 9 · Engine-Manifest SHA-256: 9cd60fb8416a16d3d09c5db96b519749025ca9f05f45df46c5fb14b89181dde9
- Nicht als Entscheidung aufgeführt: 0 weitergeschaltete Anzeigen der Gegneraktionen, 0 Zustandsanfragen der App.
- Die vollständige Aufzeichnung ist die zugehörige JSON-Datei („openmana-wiedergabe-00000000-0000-4000-8000-000000000022.json“, „JSON speichern“). Dieser Bericht ist aus ihr abgeleitet und ersetzt sie nicht.
