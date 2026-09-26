# 14 — Karten, Hand und sichere Bedienung

> Umsetzung von [`prompts/queue/14-card-hand-interactions.md`](../../prompts/queue/14-card-hand-interactions.md),
> Stand **2026-09-26**, ausgeführt von Claude Code (Claude Opus 5.5) im Dropzone-Standalone-Lauf
> (`fixed/standalone.md` mit den Regeln aus `prompts/naechster-schritt.md`). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §2, §6 („Card interaction“, „Full card view“), §9, §16, §17,
> [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md) („Interaction“, „Live state“, „Forge protocol“),
> Anvils `PROTOKOLL.md` („Wie eine Karte gespielt wird“, `spielbar`/`aktion`/`hervorgehoben`) und
> `TischScreen.kt`/`Kachel.kt` (Tipp, langer Druck, die datierten Lehren zu Mulligan, Bezahlen,
> Angreifen, Blocken), Forges Eingabeschritte (`InputPassPriority`, `InputPayMana`, `InputAttack`,
> `InputBlock`, `InputLondonMulligan`, `InputSelect*`, `PlayerControllerHuman.push*`), der Spieltisch
> (Prompt 13), das Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Engine unverändert.

## Ergebnis

**Prompt 14 ist umgesetzt.** Jede Karte, die der Spieler sehen darf, ist jetzt
ein Bedienelement – auf dem Handy, mit der Maus und per Tastatur:

- **Ansehen ist immer gefahrlos.** Eine Karte öffnet ihre **Kartenansicht**
  (im Hochformat von unten, im Querformat von der Seite): die Karte groß, Forges
  Name, Typ, Kosten, Regeltext und Zustand, der Stapel gleicher Karten, woran sie
  hängt und was an ihr hängt, wem sie gehört, und **was Forge gerade mit ihr
  anbietet**. Dabei geht nichts an die Engine.
- **Spielen braucht einen eigenen Knopf.** Wo Forge einen Tipp anbietet, trägt
  der Hauptknopf der Ansicht Forges eigene Worte („Spiele ein Land“) und schickt
  Forges `card.tap`. Der Knopf ist gegen Fehltipps gesichert (§5); wo ein Tipp
  nachweislich nichts täte, gibt es keinen Knopf.
- **Wo Forge einen Tipp zurücknehmen lässt, wirkt er sofort** – beim Bezahlen,
  Angreifen, Blocken, im London-Mulligan und bei einer Auswahl, die Forge
  verlangt (Anvils Lehren). Ein langer Druck, ein Rechtsklick oder die
  Kontextmenü-Taste zeigen die Karte dort groß.
- **Forges Zustand als Rahmen um das Bild, nie darauf:** gestrichelt gold =
  „kann jetzt benutzt werden“ (spielbar, kann angreifen, kann blocken, kann
  bezahlen, wählbar), durchgezogen hell = „ausgewählt“. Getappt bleibt die
  Vierteldrehung.
- **Tastatur:** je Kartenreihe ein Tab-Halt, Pfeiltasten, Pos1 und Ende wandern
  durch die Karten, Enter/Leertaste bedienen, Escape schließt und führt zur
  Karte zurück (auch dorthin, wohin sie gewandert ist).
- **Nichts wird getippt, solange Forge rechnet**, eine blockierende Frage
  wartet oder die Aufgabe unterwegs ist – die Ansicht sagt warum.

**Nachweise:** siehe §10 – Typecheck, oxlint, **669 Vitest-Tests** (47 neu),
`npm run check` mit dem End-to-End-Test im echten Chrome und der echten Engine:
**„E2E OK“, 0 Befunde** – Ansehen in der echten Partie sendet nichts (Desktop,
Handy), und auf echten Szenen in sechs Größen zeichnet der Prüfstand jeden
Tipp auf: Klick, Doppelklick, langer Druck, Wischen, Tasten; axe überall 0.
Engine unverändert. Kein Blocker.

## 1. Was gebaut wurde

```
src/game/
├── card-use.ts           was eine Karte jetzt kann: Markierung, Tipp (mit Worten), Wirkung des Antippens, Sperrgrund – nur aus Forges Markern und Fragen (rein)
├── card-sheet.tsx        die Kartenansicht (Sheet): Karte groß, Forges Angaben, Forges Angebot, der gesicherte Tipp-Knopf; liest jeden neuen Zustand
├── game-table.tsx        jede sichtbare Karte als Knopf (TableCard), Reihen als Werkzeugleisten, Kartenansicht, Doppeltipp-Schutz, Hinweis im Entscheidungsbereich
├── table-model.ts        + locateCard (wo liegt die Karte jetzt), pileOf (in welchem Stapel gleicher Karten)
├── table-labels.ts       + cardButtonLabel (Name der Karte als Knopf), placeLabel (wo sie liegt)
├── table-cards.ts        + großes Bild (Scryfalls „display“ und „grid“) für die Ansicht
└── game-page.tsx         reicht EngineSession.tapCard an den Tisch (was nicht geschickt werden kann, sagt ein Hinweis); Tischmenü: fehlende Kartendaten erklären und einrichten
src/components/ui/
├── game-card.tsx         + GameCardButton, mark (Rahmen), GameCardRow/-RowItem/-RowButton (Radix Toolbar)
└── game-board.tsx        Innenabstand der Hand in die Kartenreihe (Platz für den Fokusring)
src/hooks/
├── use-card-press.ts     Antippen vs. Ansehen: Klick/Enter, langer Druck, Rechtsklick/Kontextmenü, Wischen ist kein Tipp
└── use-landscape.ts      Hoch- oder Querformat (von wo die Kartenansicht kommt)
src/engine/
├── engine-session.ts     + tapCard (nur solange Forge wartet), deutsche Gründe für Ablehnungen des Clients
└── engine-session-context.tsx   + tapCard
src/test/table-harness.tsx        der Prüfstand zeichnet auf, was der Tisch antippen würde (window.__openmanaTaps)
```

## 2. Ansehen und Antippen

Forge kennt beim Spielen keine Frage: Während einer Priorität klickt man in
Forges eigener Oberfläche einfach eine Karte an, und Forge entscheidet, was
daraus wird (Anvil `PROTOKOLL.md`; Bridge: `card.tap` → `selectCard`). OpenMana
bildet genau das ab – mit einer Schutzstufe davor:

| Schritt (Forges Knöpfe, `purpose`) | Tipp/Klick/Enter auf eine Karte | Langer Druck, Rechtsklick, Kontextmenü-Taste |
|---|---|---|
| Priorität, Spielen oder Ziehen, Mulligan (behalten?), keine Frage | öffnet die Kartenansicht; dort tippt der Hauptknopf | öffnet die Kartenansicht |
| Auswahl (`select`, die Karte ist genannt) | wählt sofort (Forge schaltet um) | öffnet die Kartenansicht |
| Bezahlen (`payment`) | tippt sofort, wo Forge einen Tipp anbietet | öffnet die Kartenansicht |
| Angreifen (`attack`, `attackDeclared`) | tippt sofort, wo Forge einen Tipp anbietet | öffnet die Kartenansicht |
| Blocken (`block`) | tippt sofort, wo Forge einen Tipp anbietet | öffnet die Kartenansicht |
| London-Mulligan (`mulliganBottom`) | eigene Handkarte: wählt sofort | öffnet die Kartenansicht |
| eine Karte, mit der Forge nichts anbietet | öffnet die Kartenansicht (nie ein toter Tipp) | öffnet die Kartenansicht |

**Warum sofort in diesen Schritten** (Anvils datierte Lehren, im Code
nachgeprüft): Forge nimmt dort einen Tipp selbst zurück – ein zweiter Tipp
entfernt Angreifer und Blocker wieder (`InputAttack`/`InputBlock` →
`removeFromCombat`/`removeBlockAssignment`), das Bezahlen ist als Ganzes
abbrechbar, der Mulligan und die Auswahl schalten um – und erst Forges Knopf
macht den Schritt endgültig. Eine Bestätigung je Karte machte in Anvil aus fünf
Mana zehn Knopfdrücke, und mehrere Angreifer hintereinander wurden mühsam
(Rückmeldung vom 29.8.2026). **Warum nicht bei der Priorität:** Dort ist ein
Tipp ein Zauber, ein Land, eine Fähigkeit – der Moment, den Bible §6 und §16
meinen („Looking at a card and committing an action should be distinct“).

## 3. Forges Zustände an der Karte

| Forge sagt | Rahmen | Wort (Ansicht, Screenreader) |
|---|---|---|
| `highlighted` (Forges Auswahl: gewählte Ziele und Karten, der Angreifer beim Blocken, die Karten fürs Bibliotheksende im London-Mulligan) | durchgezogen, hell (`--foreground`) | „ausgewählt“ |
| `playable` (Forges Aktionsmarkierung: Priorität = bezahlbar und zielbar; Angriff = kann angreifen; Block = kann blocken; Bezahlen = liefert Mana) | gestrichelt, gold (`--primary`) | „spielbar“, „kann angreifen“, „kann blocken“, „kann bezahlen“ – je nach Schritt |
| eine offene Auswahl nennt die Karte; im London-Mulligan die eigene Hand | gestrichelt, gold | „wählbar“ |
| `action` ohne Markierung (z. B. Länder in der Priorität: ihre Manafähigkeit; erklärte Angreifer: „aus dem Kampf nehmen“) | keiner | Forges Angebot steht in der Ansicht |
| `tapped` | Vierteldrehung (wie bisher) | „getappt“ |

Der Rahmen liegt in einem Rand, den **jede** Karte freihält – eine Markierung
verschiebt keine Reihe. Gestrichelt gegen durchgezogen unterscheidet die beiden
ohne Farbe (WCAG 1.4.1); beide erreichen 3:1 gegen die Flächen des Tischs
(1.4.11, `design-tokens.test.ts`). Neue Farben braucht es nicht: Gold ist die
eine Akzentfarbe für „tu das“, Pergament der stärkste Kontrast.

**Woher welche Markierung kommt** (Forge, nicht OpenMana):
`PlayerControllerHuman.pushActionableCards` (Priorität: `AvailableActions.collectActionable`
– eigene Karten in Hand, Spielfeld, Flashback mit bezahlbarer, zielbarer Fähigkeit;
Bezahlen: eigene Karten mit spielbarer Manafähigkeit), `pushAttackerCandidates`,
`pushBlockerCandidates` → `setWeaklySelectable` → `playable`; `setHighlighted`
(`InputSelectManyBase`, `InputSelectTargets`, `InputAttack`, `InputBlock`,
`InputLondonMulligan`) → `highlighted`; `Input.getActivateAction` → `action`.

## 4. Die Kartenansicht

- **Inhalt:** Titel = Forges Name der Karte (in der Kartensprache), daneben die
  Markierung; darunter der Ort („Deine Hand“, „Spielfeld der Forge-KI“,
  „Deine Kommandozone“ …); die Karte groß (Katalogbild, Scryfalls große Fassung,
  sonst Forges Worte mit Kosten, Typ, Regeltext); Forges Regeltext; Fakten:
  Typ, Manakosten, Zustand, „6 liegen hier als Stapel“, „Hängt an“, „Daran
  hängt“, Besitz (wenn Besitzer ≠ Beherrscher), Sprache des Bildes; „Was Forge
  anbietet“ mit Forges Worten und – bei mehreren Wegen (`ways`) – der Liste
  („welchen, fragt Forge nach dem Antippen“).
- **Live:** Die Ansicht hält nur die Id der Karte und liest sie aus jedem neuen
  Zustand (`locateCard`). Wandert die Karte (Hand → Spielfeld), zieht die
  Ansicht mit; verlässt sie alles Sichtbare, heißt es „Karte nicht mehr zu
  sehen“ und es gibt keinen Tipp mehr.
- **Erreichbar:** Hochformat von unten (Daumen), Querformat von rechts. Die
  Knopfleiste bleibt stehen, auch wenn die Karte darüber rollt (Handy quer:
  sonst lag „Spiele ein Land“ unter dem Rand, §11.3); im Querformat stehen die
  Knöpfe nebeneinander.
- **Schließen:** „Schließen“, Escape, ein Tipp daneben. Der Fokus kehrt zur
  Karte zurück – dorthin, wo sie jetzt liegt –, ist sie weg, zu Forges
  Entscheidung.
- **Nur ansehen:** Ohne `onTapCard` (eine spätere Wiedergabe, Prompt 22)
  nennt die Ansicht Forges damaliges Angebot („Forge bot an: …“) ohne Knopf.

## 5. Schutz gegen Fehltipps

| Gefahr | Schutz |
|---|---|
| Doppeltipp/-klick: der zweite Druck trifft den Knopf, der gerade erschienen ist | der Knopf nimmt 500 ms nach Erscheinen (oder nach einem Wechsel seiner Bedeutung) nichts an; ein Druck daneben schließt die Ansicht so früh nicht – wie Chromiums eigene Rückfragen (`InputEventActivationProtector`, Doppelklick-Intervall) |
| gehaltenes Enter/Leertaste läuft in den Knopf | die Ansicht nimmt den Fokus selbst, nie den Knopf; eine wiederholte Taste (`repeat`) wird verworfen |
| Doppeltipp auf eine Karte, die sofort tippt | zählt einmal (derselbe 500-ms-Schutz je Karte) |
| Wischen durch eine Kartenreihe | ist kein Tipp: der Browser bricht den Zeiger ab und schickt keinen Klick; bewegt sich ein Finger mehr als 10 px, zählt auch kein langer Druck |
| langer Druck (Android/Chrome) öffnet das Bildmenü oder markiert Text | Kontextmenü verhindert, `select-none`, kein Touch-Callout, Bilder nicht ziehbar; der Klick nach einem langen Druck wird verschluckt |
| Tipp, während Forge rechnet | nichts wird geschickt (ein solcher Tipp würde erst im nächsten Schritt gelesen – in einem anderen Zusammenhang); der Knopf ist aus, mit Grund |
| Tipp, während eine blockierende Frage wartet | nichts (der Client lehnte ihn ohnehin ab: `not-active`); Grund in der Ansicht |
| Ablehnung durch Forge (`input.rejected`, z. B. `no-effect`) | erscheint als Hinweis oben und im Menü – nichts verschwindet still |

## 6. Maus, Tastatur, Touch

| | Ansehen | Bedienen |
|---|---|---|
| Maus | Klick (wo nicht sofort getippt wird), Rechtsklick | Knopf der Ansicht; Klick in den Sofort-Schritten |
| Tastatur | Enter/Leertaste (wo nicht sofort getippt wird), Kontextmenü-Taste oder Umschalt+F10 | Tab zum Knopf der Ansicht, Enter; Enter in den Sofort-Schritten |
| Touch | Tipp (wo nicht sofort getippt wird), langer Druck (500 ms) | Knopf der Ansicht; Tipp in den Sofort-Schritten |

Kartenreihen sind **Werkzeugleisten** (Radix `Toolbar` aus `radix-ui`): ein
Tab-Halt je Reihe, Pfeiltasten, Pos1, Ende; die fokussierte Karte rollt in
Sicht. Eine Reihe ohne sichtbare Karten bleibt eine Liste, die selbst den Fokus
nimmt (eine rollende Fläche muss per Tastatur erreichbar sein). Der Name jeder
Karte für Screenreader: Name, Stapelgröße, Forges Fakten, Markierung und – wo
sie sofort tippt – was der Tipp tut („Goblin Arsonist, blockt, 1/1 – Antippen:
Remove card from combat“); öffnet sie die Ansicht, sagt das `aria-haspopup`.

## 7. Bilder, Laden, Ersatz

- Auf dem Tisch wie bisher: Platzhalter, solange der Katalog gefragt wird;
  Scryfalls kleine oder mittlere Fassung (`srcset`); ohne Bild Forges Name und
  Typ. Neu: Bilder sind nicht ziehbar, kein Bildmenü beim langen Druck.
- In der Ansicht die große Fassung (Scryfalls `display`, 672 px, oder `grid`
  auf kleinen Schirmen); ohne Bild Forges Name, Kosten, Typ und Regeltext mit
  dem Satz „Kein Kartenbild – Forges Angaben.“ bzw. „Das Bild konnte nicht
  geladen werden.“; solange der Katalog gefragt wird ein Platzhalter mit
  „Kartenbild von … wird gesucht“ für Screenreader.
- **Ohne Kartendaten auf dem Gerät** zeigt der Tisch jede Karte mit Forges
  Worten – und das **Tischmenü sagt warum** („Ohne Kartendaten: keine
  Kartenbilder“) und richtet sie dort ein (Fortschritt, Fehler wie in den
  Einstellungen); die Bilder erscheinen noch während der Partie. Eine Version
  ohne Kartendaten sagt das ebenso.
- Die Identität bleibt Forges: Name, Regeltext und Werte kommen aus dem
  Zustand, das Bild aus dem Katalog (Forges Schlüssel), nie umgekehrt.

## 8. Keine Regeln im Client

Was bedienbar ist, sagt Forge: seine Markierungen (`playable`, `highlighted`,
`action`, `ways`), seine Fragen (Auswahl mit ihren Karten, der Zweck der
Knöpfe) und ob es wartet. OpenMana entscheidet nur, **wie** gefragt wird
(ansehen zuerst oder sofort) – nach dem strukturierten Schritt, nie nach einem
Kartennamen, nie nach Forges Texten. Beschriftungen stammen von Forge; nur wo
Forge keine oder eine unübersetzte gibt, spricht der Schritt: „Auswählen“ /
„Auswahl aufheben“ (eine Auswahl; Forge sagt hartcodiert „select card“),
„Unter die Bibliothek legen“ / „Doch behalten“ (London-Mulligan; Forge sagt
nichts), „Karte antippen“ (Forge markiert, sagt aber nichts).

## 9. Tests

- `src/game/card-use.test.ts` (15): auf den aufgezeichneten Szenen – Priorität
  (spielbares Land: markiert, Ansicht zuerst; Länder mit Manafähigkeit:
  unmarkiert, Tipp in der Ansicht), Mulligan (nichts), Blocken (sofort, der
  Angreifer ausgewählt), erklärter Angriff („kann angreifen“, sofort), Bezahlen
  – und gebaut: Auswahl, London-Mulligan, blockierende Frage, rechnende Engine,
  Aufgabe unterwegs.
- `src/game/card-interaction.test.tsx` (19): Markierungen am Rahmen, Ansehen
  sendet nichts (Fokus in der Ansicht, zurück zur Karte), Fakten, gegnerische
  Karte ohne Knopf, Tipp nur nach dem Scharfschalten, Stapel über die erste
  Karte, gesperrt mit Grund, gehaltene Taste, Ansicht folgt dem Zustand (Karte
  weg), reine Ansicht ohne Knopf, Sofort-Tipp (Doppelklick zählt einmal),
  Rechtsklick, langer Druck, Wischen, rechnende Engine, Tastatur (Pfeile,
  Pos1, Ende, Enter, Escape, ein Tab-Halt), Kontextmenü-Taste, aufgedeckte
  Karten der KI-Hand (gebaut).
- `src/engine/engine-session.test.ts` (+5): `tapCard` schickt `card.tap`,
  nicht während Forge rechnet, deutsche Gründe, nicht während der Aufgabe,
  Forges Ablehnung als Meldung. `src/game/game-page.test.tsx` (+1): der Weg vom
  Kartenknopf bis in die Eingabewarteschlange der Engine, Scharfschalten,
  „Forge rechnet“, Forges Ablehnung als Hinweis; der Kartendaten-Hinweis im
  Tischmenü (1 erweitert). `src/game/game-table.test.tsx`
  (+1, 6 angepasst: Knöpfe und Werkzeugleisten statt Listen, Hinweis in den
  Sofort-Schritten). `src/app/design-tokens.test.ts` (+6: Rahmen 3:1).
- **Wackeltest aus Prompt 12 behoben** (`preferences.test.tsx`, §11.2).

## 10. Nachweise

Alle Nachweise liefen auf **`1b3e3b6`** mit sauberem Arbeitsbaum (Engine
unverändert: `engine/` ist in diesem Prompt nicht berührt, Engine-Id
`42f3bf1c7706cec5` wie in Prompt 13). odin (Intel i7-8700T, Debian 13),
Node 22.22.3, Chrome for Testing 153.

### 10.1 `npm run check` (8 min 52 s): **E2E OK, 0 Befunde**

Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund, **669
Vitest-Tests** (622 bestehende + 47 neue), dann der End-to-End-Test im echten
Chrome mit der echten Engine, dem echten Katalog und Scryfalls echten Bildern.

### 10.2 Ansehen in der echten Partie (Abschnitt 10)

| | Desktop, Commander | Handy (Tipp) |
|---|---|---|
| Karte | „Valki, Gott der Lügen“ in der Kommandozone | „Gebirge“ aus der Hand |
| Ansicht | Titel = Karte, Bild geladen, Fokus in der Ansicht | ebenso, von unten |
| Forges Angebot in der ersten Entscheidung | „Mit dieser Karte bietet Forge gerade nichts an.“ – nur „Schließen“ | ebenso |
| axe | 0 | 0 |
| „Schließen“ | 40 px (Maus) | 48 px |
| danach | Forge wartet auf dieselbe Entscheidung, kein Hinweis | ebenso |

### 10.3 Echte Szenen in sechs Größen (Abschnitt 12)

Sieben aufgezeichnete Szenen × sechs Größen: nichts rollt, jede Karte in ihrer
Reihe, Bilder geladen, **axe 0 in allen 42 Kombinationen und in jeder offenen
Kartenansicht**. Markierungen wie erwartet (Priorität: 1 „spielbar“, Blocken:
1 „ausgewählt“, erklärter Angriff: 1 „kann angreifen“, Mulligan: keine).

| Größe | kleinste Karte | Ansicht von | Knopf der Ansicht | Tipps (Prüfstand) | Wischen |
|---|---|---|---|---|---|
| Handy 412 × 915 | 41 × 79 px | unten | 48 px | Priorität [25], Blocken [58] | 0 → 189 px, kein Tipp |
| Handy quer 915 × 412 | 62 × 87 px | rechts | 48 px | [25], [58] | – |
| kleines Handy 360 × 740 | 59 × 95 px | unten | 48 px | [25], [58] | 0 → 188 px, kein Tipp |
| Foldable/Tablet 884 × 1104 | 76 × 129 px | unten | 48 px | [25], [58] | – |
| Tablet quer 1104 × 884 | 82 × 115 px | rechts | 48 px | [25], [58] | – |
| Desktop 1440 × 900 | 84 × 117 px | rechts | 40 px | [25], [58, 58] | – |

Je Größe geprüft: das spielbare Land öffnet seine Ansicht (**kein Tipp**);
ein Druck auf „Spiele ein Land“ einen Frame nach dem Öffnen **tippt nicht**,
ein späterer genau einmal ([25]); ein Doppelklick auf eine Karte öffnet und
hält die Ansicht, ohne zu tippen; beim Blocken tippt ein Tipp/Klick sofort
([58]), ein Doppelklick **einmal** (Desktop: [58, 58] = Klick + Doppelklick),
**langer Druck** (Touch, echter Chrome-Touch über CDP) bzw. **Rechtsklick**
zeigt die Karte, ohne zu tippen. Tastatur (Desktop): → 59, Ende 33, Pos1 53,
Enter öffnet (Fokus in der Ansicht), Escape zurück zu 53, Tab verlässt die
Hand. Kleinste Karte überall über WCAG 2.2s 24 × 24 px.

### 10.4 Kosten

Start-JavaScript (Skripte und Modulvorladungen der `index.html`, gzip -9,
beide Stände gleich gebaut): 241,6 → **242,9 KB** (+1,3 KB). Partie-Seite
(nachgeladen): 12,0 → **16,7 KB** gzip (Kartenansicht, Bedienlogik,
Werkzeugleisten).

### 10.5 Der erste Gesamtlauf

Ein erster `npm run check` während der Umsetzung (vor dem Commit) fand zwei
Dinge: 16 abgebrochene Bildanfragen `net::ERR_NETWORK_CHANGED` (die
nächtliche Sicherung auf odin stoppte gerade Datenbank-Container, §11.7) und
eine Tastaturprüfung, die den Fokus las, bevor Radix ihn verschiebt (§11.1).
Die Prüfung wartet jetzt auf den erwarteten Fokus; der Nachweislauf oben lief
nach der Sicherung.

## 11. Befunde

### 11.1 Radix bewegt den Fokus einen Takt später

Zweimal gleiche Ursache: Radix setzt den Fokus absichtlich außerhalb von
Reacts Stapelverarbeitung (`setTimeout`).

- **Pfeiltasten:** Die Werkzeugleiste verschiebt den Fokus einen Takt nach
  der Taste. Die erste Fassung der Browser-Prüfung las ihn sofort und sah ihn
  „nicht wandern“ (erster Gesamtlauf); gezielt nachgemessen wandert er
  korrekt (53 → 59 → 45). Unit- und E2E-Test warten jetzt auf den
  erwarteten Fokus.
- **Nach einem Dialog:** Endete ein Test mit offenem Dialog, sprang Radix'
  Fokus-Rückgabe (`FocusScope`, nach dem Abbau) in den **nächsten** Test und
  nahm dort den Fokus weg – die Tastaturprüfung scheiterte nur in der vollen
  Datei. `src/test/setup.ts` wartet nach dem Aufräumen einen Takt. Im Browser
  gibt es das nicht (dort bleibt die Seite).

### 11.2 Der Wackeltest aus Prompt 12 war ein Testfehler

`preferences.test.tsx` („reads the stored preferences …“) scheiterte unter
Last (in Prompt 13 einmal in sechs Läufen). **Nachgestellt:** 6 parallele
Schleifen × 4 Läufe → **5 von 24** scheiterten, genau an zwei Stellen: das
Attribut für weniger Bewegung auf `<html>` und die Kartensprache der Engine.
Beides setzen React-Effekte **nach** dem Zeichnen; der Test prüfte sofort,
nachdem der Text erschien, und war unter Last schneller als die Effekte. Jetzt
wartet er auf dieselben Ergebnisse (`waitFor`) – unter derselben Last **24 von
24** grün. Kein Fehler der App.

### 11.3 Querformat: der Knopf lag unter dem Rand

Auf dem gedrehten Handy (915 × 412) schob das große Bild „Spiele ein Land“
aus dem sichtbaren Bereich der Ansicht (Bildschirmfoto während der
Umsetzung). Die Knopfleiste bleibt jetzt stehen (`sticky`), die Karte rollt
darüber; im Querformat stehen die Knöpfe nebeneinander.

### 11.4 Forges Worte für einen Tipp sind teils englisch

„Spiele ein Land“, „Aktiviere Fähigkeit“ kommen deutsch, aber „Remove card from
combat“, „Declare blockers for card“ (Kampf) fehlen in Forges deutscher Datei,
und `InputSelectEntitiesFromList`/`InputSelectTargets` sagen hartcodiert
„select card“ / „select card as target“. Gezeigt wie gesendet; bei der Auswahl
spricht der Schritt („Auswählen“). Für 18/19: Kampfwörter nach Schritt und
Markern deutsch fassen.

### 11.5 Priorität: Forges `action` ist mehr als `playable`

`action` kommt aus `getAllPossibleAbilities(Spieler, true)` – dazu gehören die
Manafähigkeiten der Länder und Zauber, die Forges Heuristik für nicht
bezahlbar hält. `playable` (Forges Aktionsmarkierung) lässt Manafähigkeiten weg
und prüft Bezahlbarkeit mit der KI-Heuristik. OpenMana markiert nach
`playable` und bietet den Tipp nach `action` an (Anvil: „keine Aktion“ heißt
dort beweisbar „ein Tipp täte nichts“) – ein Land kann in der Priorität also
Mana erzeugen, ein unmarkierter Zauber lässt sich trotzdem versuchen (Forge
fragt dann beim Bezahlen). So wird kein legaler Zug versteckt, den die
Heuristik übersieht (etwa Kosten, die mit Kreaturen statt Mana bezahlt werden).

### 11.6 Die Nebenwirkung von `getActivateDescription` bleibt für Prompt 16

Offen seit Prompt 05 (§7.2): `StateBuilder.action` ruft während der Priorität
`getAllPossibleAbilities` auch für die sichtbaren Karten der KI auf und setzt
dabei deren aktivierenden Spieler. Prompt 14 braucht keine Änderung an der
Engine; Prompt 16 baut die Engine ohnehin neu (`StackItem.card`, Protokoll 5).
Vorschlag dort: `action` während der Priorität nur für eigene Karten und für
Karten, die Forge als spielbar markiert (so bleiben Karten spielbar, die du
aus dem Exil des Gegners wirken darfst, und die KI-Karten unberührt).

### 11.7 Die nächtliche Sicherung stört den Browser-Test

Um ca. 01:00 hält `restic-backup-system.sh` auf odin Datenbank-Container an
(`pg_dumpall`, `docker stop`/`start`). Die Docker-Netze ändern sich, und
Chrome bricht laufende Anfragen mit `net::ERR_NETWORK_CHANGED` ab – im
ersten Lauf 7 Kartenbilder im Querformat-Handy. Kein Fehler der App: den
Lauf nach der Sicherung wiederholen.

## 12. Entscheidungen und Abweichungen

- **Ansehen zuerst, außer wo Forge zurücknehmen lässt** (§2) – die
  Anvil-Fassung nach den Rückmeldungen des Projektbesitzers, nicht „ein Tipp
  spielt“ und nicht „jede Karte bestätigen“.
- **Kein Mauszeiger-Vorschau-Fenster (Hover).** Die Ansicht deckt „ansehen“
  auf allen Geräten gleich ab; eine Vorschau beim Überfahren wäre reine
  Bequemlichkeit am Desktop (Kandidat für 20/24).
- **Karten sind kleiner als 44 px auf kleinen Handys.** Sie richten sich nach
  ihrer Reihe (Prompt 13); ihr Mindestmaß ist WCAG 2.2s 24 × 24 px (der
  E2E-Test misst es). Ein Fehltipp öffnet dort nur die Ansicht.
- **Keine neuen Farb-Tokens:** Gold (tu das) und Pergament (ausgewählt), durch
  gestrichelt/durchgezogen unterscheidbar.
- **Einsatzverzögerung (`sick`) noch nicht gezeigt** – das verlangt Prompt 18
  ausdrücklich.
- **Spielsteine eines Namens** bekommen weiter kein geratenes Bild (Befund 11.5
  aus Prompt 13); Forges `set` für Spielsteine ist ein Kandidat für Prompt 20.
- **Engine unverändert** (§11.6).

## 13. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Forges Knöpfe und Fragen beantworten (Behalten/Mulligan, OK, Zug beenden, Optionen, Zahlen …); die Live-Partie bleibt bis dahin an Forges erster Entscheidung stehen | 15 |
| Mehrere Wege einer Karte (`ways`): Forge fragt nach dem Tipp mit einer Optionsfrage | 15 |
| Priorität, Stapel, Phasen; die `action`-Nebenwirkung der Brücke | 16 |
| Ziele und Bezahlen: Quelle und nötige Anzahl zeigen, Spieler als Ziel antippen (`player.tap`), Forges Hervorhebung von Spielern | 17 |
| Angriff/Blocken: Anleitung, deutsche Wörter, Einsatzverzögerung | 18/19 |
| Friedhof, Exil, Stapel blättern, doppelseitige Karten drehen, Hover-Vorschau | 20 |

## 14. Reproduzieren

```bash
npx vitest run src/game/card-use.test.ts src/game/card-interaction.test.tsx   # Kartenbedienung (Sekunden)
npm run check                                                                  # alles, inkl. E2E-Abschnitt 12 mit den Gesten
```

## 15. Was als Nächstes kommt

Prompt 15 (Forges Entscheidungen): die Knöpfe und Fragen im Entscheidungsbereich
bedienbar machen – damit erreicht die Live-Partie zum ersten Mal die Priorität,
und die Kartenbedienung dieses Prompts wirkt im echten Spiel.
