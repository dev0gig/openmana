# 10 — Deck-Bibliothek

> Umsetzung von [`prompts/queue/10-deck-library.md`](../../prompts/queue/10-deck-library.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Implementierung `7aab76f`,
> Nachträge `c2f2084` (Import-Texte nicht im Start-Bundle) und `58aaa58` (zeitabhängiger Test aus 08);
> alle Nachweise liefen auf `58aaa58` (sauberer Arbeitsbaum, die App meldet keine lokalen Änderungen). Grundlage: [`docs/BIBLE.md`](../BIBLE.md) §2, §4, §5, §6,
> §15, §16, [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md), die lokale Datenschicht (Prompt 07), die
> Kartendaten (Prompt 08), der Deck-Import (Prompt 09) und das Design-System
> [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Code: `src/decks/` (Bibliothek, Deckwahl),
> `src/storage/decks.ts` (Speichern), `src/routes/decks-page.tsx` und `play-page.tsx`,
> `scripts/e2e/run.ts` (Abschnitt 9). Messungen auf odin (Intel i7-8700T, 12 Threads, Debian 13,
> Lastmittel 2–10 durch andere Sitzungen), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 10 ist umgesetzt.** Die importierten Decks bilden eine Bibliothek auf
dem Gerät, und für eine Partie lassen sich das eigene Deck und das Deck der KI
wählen:

- **Liste (`/decks`):** jedes Deck mit Titelkarte, Format, Kartenzahlen,
  Kommandeur und Gefährte und wie deutsch seine Karten sind; **Suche** nach dem
  Decknamen oder dem Namen **irgendeiner Karte** darin (deutsch, englisch,
  Kartenseite, Forges Name), **Formatfilter** und **Sortierung** (Name, zuletzt
  geändert, zuletzt angelegt) – alles in der Adresse, also nach einem Neuladen
  und mit dem Zurück-Knopf noch da.
- **Deck-Details (`/decks/:id`):** Kommandeur, Gefährte, Hauptdeck und
  Sideboard Karte für Karte – deutscher Name, Forges Name, der genannte Druck,
  Sprachhinweis –, Überblick (Format, Zahlen, Daten der Liste) und
  **Kartensprache** (welche Karten nicht ganz deutsch sind und warum). Jede
  Karte öffnet ihre volle Ansicht. Die **Bilder der Drucke, die die Liste
  nennt**, holt OpenMana einmal bei Scryfall (deutsch, wo es den Druck deutsch
  gibt).
- **Aktionen:** **Mit diesem Deck spielen** (die Hauptaktion; am Handy in einer
  festen Leiste über der Tab-Leiste), **Umbenennen**, **Duplizieren**,
  **Exportieren** (Arena-Liste mit Forges Namen oder die importierte Liste
  unverändert; kopieren oder als Textdatei speichern), **Erneut importieren**
  (die gespeicherte Liste ändern oder ersetzen; frühere Kartenwahl bleibt;
  Ersetzen wird bestätigt; Id und Anlage bleiben), **Als Deck der KI wählen**,
  **Löschen** (bestätigt).
- **Deckwahl (`/play`):** dein Deck und das Deck der KI – eines deiner Decks
  oder **zufällig**: für jede Partie neu aus den passenden Decks gezogen (gleiches
  Format, nicht dein eigenes). Beides bleibt gespeichert. Was nicht passt (anderes
  Format, gelöscht, beschädigt, kein zweites Deck für den Zufall), sagt die Seite
  – nie wird eine Wahl still ersetzt. Die Partie selbst startet mit Prompt 11.
- **Die importierte Liste bleibt beim Deck** (Umbenennen und Duplizieren
  ändern sie nicht; ein erneuter Import ersetzt sie durch die neue), neben den
  geklärten Karten. Neu gespeichert wird der **Gefährte** (Schema-Version 3).

**Nachweise:** siehe §10 – Typecheck, oxlint, Frische der erzeugten Dateien,
**418 Vitest-Tests** (66 neu), `npm run check` inklusive End-to-End-Test
im echten Chrome mit echtem Kartenkatalog, echter Scryfall-API und echter
Forge-Engine (Abschnitt 9 neu); Engine unverändert 80/80; frischer Klon grün.
Kein Blocker.

## 1. Was gebaut wurde

```
src/decks/
├── deck-view.ts            ein gespeichertes Deck zum Anzeigen: Karte je Eintrag, Sprache, Titelkarte, Bild des genannten Drucks
├── library.ts              Suche, Formatfilter, Sortierung (rein; die Abfrage steht in der Adresse)
├── library-labels.ts       deutsche Texte (Teile, Sortierung, Sprache, Deckwahl), Name einer Kopie
├── arena-export.ts         ein Deck als Arena-Liste mit Forges Namen; Dateinamen
├── deck-selection.ts       Deckwahl für die Partie: Einstellungen, Prüfung, Zufall aus den passenden Decks
├── named-prints.ts         die genannten Drucke, die der Katalog nicht hat, einmal bei Scryfall erfragen
├── deck-details-page.tsx   /decks/:id (nachgeladen): Überblick, Kartensprache, Teile, Kartenansicht
├── deck-actions.tsx        Spielen + Menü (Umbenennen, Duplizieren, Exportieren, Erneut importieren, KI, Löschen)
├── deck-dialogs.tsx        Umbenennen, Löschen (bestätigt), Exportieren
├── deck-update-page.tsx    /decks/:id/import (nachgeladen): die Import-Seite für ein bestehendes Deck
├── deck-picker-dialog.tsx  Deck wählen (dein Deck, Deck der KI mit „Zufällig“)
├── catalog-hint.tsx        ohne Kartendaten: sagen, was fehlt, und sie gleich einrichten
└── *.test.ts(x)            Ansicht 10, Bibliothek 7, Export 7, Deckwahl 9, Oberfläche 16
src/storage/decks.ts        getDeck, renameDeck, duplicateDeck, replaceDeck, deleteDeck (+ Tests 9)
src/cards/print-key.ts      printKey/ResolvedPrint ohne den Scryfall-Code (der lädt erst bei Bedarf)
src/components/ui/          action-bar.tsx (neu, shadcn-Bauweise); dropdown-menu, select, toggle(-group) (Registry)
src/test/deck-fixtures.ts   Decks für Tests, gespeichert wie vom Import
```

Geändert: Decks-Seite (die Bibliothek), Spielen-Seite (Deckwahl, feste
Startleiste am Handy), Import-Seite (Modus „Deck neu importieren“), Resolver
(frühere Wahl eines Decks, `previous`), Deck-Plan (Gefährte im Datensatz),
Router (zwei nachgeladene Routen), Startseite (Schritt „Gegner wählen“),
Speicherfehler `not-found`, Schema (Version 3, `DeckRecord.companion`,
Migration 3), E2E (Abschnitt 9, Konsolenfehler mit Herkunft).

## 2. Architektur und Branchenstandard

| Frage | Wahl | Einordnung |
|---|---|---|
| Wo lebt der Zustand der Liste (Suche, Filter, Sortierung)? | in der **Adresse** (`?q=…&format=…&sort=…`), ersetzt statt je Buchstabe ein Verlaufseintrag | üblich für Such- und Filterseiten (teilbar, Zurück-Knopf, Neuladen); kein Speicher nötig |
| Deck-Details | eigene Route, **nachgeladen** | wie der Import: routenbasiertes Code-Splitting hält den Start klein |
| Aktionen | eine Hauptaktion sichtbar, der Rest in einem Menü („Mehr“) | Muster von Drive, Moxfield u. a.; Anvil-Lehre: die Hauptaktion bleibt erreichbar |
| Handy | **feste Aktionsleiste** über der Tab-Leiste (`ActionBar`, `sticky`) | Bible §16/Anvil: feste Hauptaktion statt Knopf am Ende einer langen Liste |
| Unumkehrbares | Löschen und Ersetzen mit `AlertDialog` | Design-System Regel 4 |
| Änderungen | lesen + schreiben in **einer** Transaktion; ein gelöschtes Deck wird nie wiederbelebt (`not-found`), ein beschädigtes nie überschrieben | IndexedDB-Transaktionen sind die Konsistenzgrenze; „last write wins“ zwischen Tabs, aber ohne Wiederauferstehung |
| Deckwahl | als **Einstellung** (`play.humanDeck`, `play.aiDeck`) | Anvil-Lehre: Einmaliges bleibt aus dem wiederholten Startweg; die Wahl hält bis zur Änderung |
| Zufälliges Deck der KI | ein Modus, **gezogen beim Start jeder Partie** (Prompt 11) aus den gültigen Decks gleichen Formats außer dem eigenen | wie Forges „Random“-Deck; Überraschung ist der Sinn (Anvil: „Zufall“-Knopf für die KI) |
| Export | Arena-Format, zwei Fassungen: Forges Namen (wieder importierbar ohne Rückfrage) und die importierte Liste unverändert (für MTG Arena) | Arena-Text ist das Austauschformat der Deckseiten; die Originalliste ist Pflicht (Bible §5) |
| Bilder genannter Drucke | nur Drucke, die der Katalog nicht hat, **einmal** über den einen Scryfall-Client (30 Tage gemerkt) | Scryfalls Regel: keine Anfrage je angezeigter Karte; Massendaten zuerst (Bible §4) |

## 3. Die Liste

- **Zeile je Deck:** Titelkarte (Kommandeur, sonst die Hauptdeck-Karte mit dem
  höchsten Manawert – nie ein Land; bei Gleichstand mehr Exemplare, dann
  Listenreihenfolge; aus Zahlen des Katalogs, nie aus Namen oder Texten),
  Name, „Constructed · 60 Karten · Sideboard 15“, Abzeichen für Kommandeur,
  Gefährte und „N Karten nicht ganz deutsch“, Änderungsdatum. Die ganze Zeile
  ist ein Link zu den Details.
- **Suche** (`library.ts`): enthält der Deckname oder irgendein Name
  irgendeiner Karte den Text? Verglichen wird mit den Namensschlüsseln des
  Katalogs (`cards/names.ts`: Groß/klein, Akzente, ß, Satzzeichen), also auch
  „Zwang“ (deutsch für Duress), eine Rückseite („Tibalt“) oder Forges Name
  („Daryl“). Ohne Kartendaten: Forges Namen.
- **Format** als Umschalter (nur bei mehr als einem Format), **Sortierung**
  als Auswahl; nichts gefunden: „Kein Deck passt“ mit „Suche zurücksetzen“.
- Beschädigte Einträge stehen weiter in der Liste (Design-System Regel 4).

## 4. Deck-Details

- **Teile** in dieser Reihenfolge: Kommandeur, Gefährte („spielt aus dem
  Sideboard – dort sucht Forge ihn“), Hauptdeck, Sideboard. Je Eintrag: Anzahl,
  Name wie im Spiel (Forges Karte, deutsch wo vorhanden – eine doppelseitige
  Karte mit ihrer Vorderseite, eine Universes-Beyond-Karte so, wie die Engine
  sie später meldet), „Forge: …“ wenn der Name abweicht, der genannte
  Druck („MID 47“) und ein Abzeichen, wenn die Karte nicht ganz deutsch ist.
- **Kartensprache** (`deck-view.ts`): je verschiedene Karte (dieselbe Karte in
  Hauptdeck und Sideboard zählt einmal) eine von fünf Klassen – deutsch
  (Name, Typzeile, Text und Bild), teilweise englisch, englisch (Scryfall kennt
  keine deutsche Fassung), nur Forge (keine Scryfall-Daten), ohne Kartendaten
  – mit den Namen der nicht ganz deutschen Karten, nach Grund gruppiert.
- **Bild je Eintrag** (`pictureOf`): nennt die Liste einen Druck, den der
  Katalog nicht hat, wird er einmal bei Scryfall erfragt (`named-prints.ts` →
  `lookupPrints`, samt deutscher Fassung). Gezeigt wird: der genannte Druck
  **deutsch**, wo es ihn deutsch mit echtem Bild gibt; sonst das deutsche Bild
  der Karte (Bible §4: Deutsch zuerst); sonst der genannte Druck; sonst das
  übliche Bild. Platzhalterbilder zählen nie. Solange Scryfall antwortet (oder
  wenn es nicht erreichbar ist), steht das übliche Bild da; die Seite sagt es.
- **Kartenansicht:** die vorhandene `CardDetails` mit dem Druck des Eintrags;
  für Forge-only- und unbekannte Karten ein Hinweis statt eines erfundenen
  Bildes. Die geöffnete Karte wird über ihre Kennung gegen den aktuellen
  Deckstand aufgelöst (Bible §16: keine veralteten Kartenobjekte).
- Gelöscht (anderer Tab) oder falscher Link: „Deck nicht gefunden“;
  beschädigt: „Beschädigtes Deck“ mit dem Weg zur Prüfung.

## 5. Aktionen

| Aktion | Was passiert | Speicher |
|---|---|---|
| Mit diesem Deck spielen | setzt `play.humanDeck`, öffnet „Spielen“ | `writeSetting` |
| Umbenennen | Dialog; leer geht nicht; Hinweis, wenn ein anderes Deck so heißt (erlaubt) | `renameDeck`: Name (getrimmt) + `updatedAt` |
| Duplizieren | Kopie „Name (Kopie)“, „(Kopie 2)“ …, öffnet sie | `duplicateDeck`: neue Id, gleiche Karten **und gleiche Liste** (`source` samt `importedAt`), jetzt angelegt |
| Exportieren | Dialog: Arena-Liste mit Forges Namen oder importierte Liste; kopieren (Zwischenablage) oder Textdatei (`Name.txt`, `Name (Original).txt`) | – |
| Erneut importieren | Import-Seite mit der gespeicherten Liste und dem Decknamen; frühere Wahl bleibt; „Deck ersetzen“ nach Bestätigung | `replaceDeck`: Id und `createdAt` bleiben, alles andere aus dem neuen Import |
| Als Deck der KI wählen | setzt `play.aiDeck` | `writeSetting` |
| Löschen | nach Bestätigung („Endgültig löschen“); gespielte Partien behalten ihre Kopie | `deleteDeck` |

- **Export mit Forges Namen** (`arena-export.ts`): `About`/`Name`, dann
  `Commander`, `Companion`, `Deck`, `Sideboard` wie Arena; Drucke mit **Arenas
  Setcode** (`DAR` für Scryfalls `dom`), wo das Deck einen kennt. Diese Liste
  ergibt beim Import **dasselbe Deck ohne offene Zeile und ohne Anfrage bei
  Scryfall** (Tests mit dem Test-Katalog, E2E mit dem echten). Für MTG Arena
  selbst ist die importierte Liste besser: Forge kennt manche Karten unter
  anderem Namen (Universes Beyond: „Daryl, Hunter of Walkers“ statt „Hansk,
  Slayer Zealot“) – der Dialog sagt das.
- **Erneut importieren** (Resolver-Option `previous`): Passt ein Name zu
  mehreren Karten, bleiben Name und Druck ohne Entscheidung und hat das Deck
  genau eine davon, wird diese genommen („Wie bisher im Deck“) – die Wahl hat
  der Spieler beim ersten Import getroffen. Eine jetzt getroffene Wahl und ein
  entscheidender Druck gehen vor. Weggelassene Zeilen muss der Spieler erneut
  weglassen (sichtbar, nie still). Drucke, die Scryfall schon beantwortet hat,
  kommen aus dem lokalen Speicher (30 Tage).

## 6. Deckwahl für die Partie (`deck-selection.ts`)

- **Einstellungen:** `play.humanDeck` (Deck-Id oder nichts) und `play.aiDeck`
  (`{kind: "random"}` – Vorgabe – oder `{kind: "deck", deckId}`), geprüft wie
  jede Einstellung; ein ungültiger gespeicherter Wert fällt sichtbar zurück.
- **Format:** Forge spielt beide Decks in einem Format (`MatchRequest.format`),
  also muss das Deck der KI das Format deines Decks haben. Andere Decks stehen
  im Auswahldialog, gesperrt, mit Grund. Das ist Forges Spielweise, keine
  Legalitätsprüfung.
- **Zufällig:** gezogen wird beim Start jeder Partie (Prompt 11,
  `drawAiDeck`, jedes Deck gleich wahrscheinlich) aus den gültigen Decks
  deines Formats **außer deinem eigenen**. Gibt es keins, ist „Zufällig“
  gesperrt und die Seite sagt warum; dein eigenes Deck lässt sich der KI
  trotzdem ausdrücklich geben (Spiegelpartie).
- **Was nicht passt, wird gesagt, nie ersetzt:** gelöschtes oder beschädigtes
  Deck, anderes Format, kein zweites Deck für den Zufall – der Start-Knopf
  nennt den Grund. Sind beide Decks gesetzt, sagt er, dass das Starten mit dem
  nächsten Schritt kommt.

## 7. Datenbank: der Gefährte (Schema-Version 3)

- `DeckRecord.companion` (optional, `DeckCard[]`): welche Karte der Gefährte
  ist, wie Arenas `Companion`-Abschnitt. Er steht weiter **auch im Sideboard**
  (dort sucht Forge ihn, `Match.assignCompanion`); das Feld sagt nur, welche
  Karte es ist – für Anzeige und Export. Ohne das Feld ginge beim Export der
  `Companion`-Abschnitt verloren.
- **Migration 3** ändert keinen gespeicherten Datensatz (das Feld ist
  optional): Decks von vorher sind gültig, wie sie sind, und zeigen keinen
  Gefährten, bis ihre Liste erneut importiert wird. Ältere Sicherungen laden
  unverändert; eine Sicherung von Version 3 lehnt eine ältere App ab (so
  gewollt).
- **Folge:** Der Kartenkatalog trägt die Schema-Version im Kopf (Prompt 08)
  und wurde neu gebaut (`npm run cards:build -- --offline`, gleiche Zahlen, neue
  Id `4647d01ae90b1c6a`); ein eingerichteter älterer Katalog gilt als „veraltet“,
  bleibt aber nutzbar, bis er aktualisiert wird.
- Neuer Speicherfehler `not-found` („Der Eintrag ist nicht mehr da“) für
  Änderungen an einem Deck, das inzwischen gelöscht wurde.

## 8. Kosten

- **Start-JavaScript** (Vite-Angabe, gzip): 207,7 → **221,7 KB**; App-Code
  108,4 → 122,4 KB (+14,0 KB: Liste mit Suche, Filter und Sortierung,
  Deckwahl samt Auswahldialog, `ToggleGroup`, Radix-`Select` allein ~5,9 KB –
  gemessen durch Weglassen), React + Router 99,4 KB unverändert. Die Liste und
  „Spielen“ sind Hauptziele der Tab-Leiste und laden deshalb mit der App.
- **Nachgeladen:** Deck-Details **11,3 KB** gzip (erst beim Öffnen eines
  Decks), „Deck neu importieren“ 1,0 KB (+ Import-Seite 11,2 KB), der
  Scryfall-Code für Drucke (`prints.ts`, 2,1 KB) wieder erst bei der ersten
  Nachfrage – vorher band ihn der Import (seit 09) statisch ein.
- **Scryfall:** Für das E2E-Deck „E2E Izzet“ (11 genannte Drucke) trägt der
  Katalog 6 selbst, einer gehört zu einer Karte nur bei Forge (nie gefragt);
  für die übrigen 4 genau **1× `/cards/collection` und 4× die deutsche
  Fassung** (1× 404 = „gibt es nicht deutsch“), einmal je 30 Tage.
  Rundreise des Exports und erneuter Import: **0 Anfragen**.
- **Zeiten** (E2E, echter Katalog): exportierte Liste erneut prüfen 74 ms,
  erneuter Import mit geänderter Liste 88 ms; Katalog-Neubau nach dem
  Schemawechsel 64 s offline.

## 9. Tests

| Datei | Tests | Was |
|---|---:|---|
| `src/storage/decks.test.ts` | 9 | ein Deck lesen (gefunden/beschädigt/fehlt), umbenennen (getrimmt, nur Name + Zeit; leer, gelöscht, beschädigt → abgelehnt, nichts geschrieben, nichts wiederbelebt), duplizieren (gleiche Karten und Liste, neue Id; belegte Id ersetzt nichts), ersetzen (Id und Anlage bleiben, alter Gefährte fällt weg, gelöschtes Deck bleibt weg), löschen (auch beschädigte), Änderungen werden gemeldet, abgelehnte nicht |
| `src/decks/deck-view.test.ts` | 10 | echter Test-Katalog: Namen deutsch/Forge, Teile und Zahlen, Kommandeur/Gefährte, ohne Kartendaten nie geraten, Sprachklassen (verschiedene Karten, Reihenfolge), Titelkarte, welche Drucke Scryfall gefragt wird, welches Bild (deutscher Druck, Platzhalter zählt nicht, deutsches Kartenbild vor englischem Druck), Lesen der Bibliothek |
| `src/decks/library.test.ts` | 7 | Abfrage in der Adresse (Rundreise, Vorgaben, Unbekanntes), Suche (Deckname; jede Kartenbezeichnung inkl. deutsch, Rückseite, Forge-Name; ohne Katalog), Formatfilter, Sortierung (deutsche Reihenfolge, Zahlen, Datum), Name einer Kopie |
| `src/decks/arena-export.test.ts` | 7 | Überschriften und Reihenfolge wie Arena, Arenas Setcodes, Commander zuerst; **Rundreise** Export → Import für drei Beispiellisten: dieselben Karten, keine offene Zeile; Name; Dateinamen |
| `src/decks/deck-selection.test.ts` | 9 | Einstellungen (gültig, Rückfall), nichts gewählt, Zufall aus dem Format ohne eigenes Deck, Spiegelpartie, anderes Format/gelöscht/beschädigt benannt, Rückfall gemeldet, Lesen, Ziehen gleich verteilt |
| `src/decks/deck-library.test.tsx` | 16 | Oberfläche: Liste (Zahlen, Sprache), Suche/Format in der Adresse und „Kein Deck passt“, Sortierung aus der Adresse, ohne Kartendaten; Details (Teile, Sprache, Kartenansicht, Scryfall nur für ELD 115 und 2X2 361), fehlend, beschädigt; Umbenennen, Duplizieren, Löschen (Abbrechen, Bestätigen), Export (Zwischenablage, Datei), Spielen/KI; erneuter Import (Ersetzen bestätigt, Id und Anlage bleiben), frühere Wahl bleibt; Deckwahl (Zufall, gesperrtes Format, Spiegelpartie, gelöschtes Deck) |
| `src/decks/deck-resolve.test.ts` | +3 | `previous`: offene Namen wie bisher, Wahl jetzt gewinnt, beide/keine im Deck bleibt offen, Druck gewinnt |
| `src/decks/deck-plan.test.ts` | +1 | Gefährte im Datensatz; ohne Gefährte kein Feld |
| `src/storage/migrations.test.ts` | +1 | Version 2 → 3 lässt jeden Datensatz, wie er ist |
| `src/app/design-tokens.test.ts` | +3 | destruktiver Text auf seiner Tönung über Dialog, Karte und Hintergrund ≥ 4,5:1 |
| bestehend | 352 | grün; angepasst: Spielen-Seite (Deckwahl statt „die Deckwahl folgt“), Zeile der Decks-Seite (Datum eigene Zeile, „Kommandeur 1“), Schema-Version 3, Kartendaten-Test wartet auf sein Abzeichen (§11.5) |

## 10. Nachweise

Alle auf `58aaa58`, sauberer Arbeitsbaum, Chrome for Testing 153.0.8010.12
headless, echte Engine `0c82db80023ac0cc`, echter Katalog `4647d01ae90b1c6a`.

### 10.1 `npm run check` (364 s, Lastmittel 5,6–6,4)

Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund, **418 Tests**
grün, End-to-End **0 Fehler**, axe ohne jeden Befund (alle Oberflächen in drei
Größen – neu darunter „Deck nicht gefunden“ – und jeder Dialog des Abschnitts 9).

### 10.2 End-to-End, Abschnitt 9 „Deck library“

| Prüfung | Ergebnis |
|---|---|
| Liste | „E2E Brawl“, „E2E Deutsch“, „E2E Izzet“; „Constructed · 60 Karten · Sideboard 3“ + „Gefährte: Lurrus aus der Traumhöhle“, „Commander · 59 Karten · Kommandeur 1“ + „Kommandeur: Valki, Gott der Lügen“ |
| Suche, Filter, Adresse | „Zwang“ findet nur „E2E Deutsch“ (deutscher Name von Duress), `?q=Zwang`, nach Neuladen gleich („1 von 3 Decks“); Format „Commander“ nur „E2E Brawl“ |
| Details | Hauptdeck 60, Sideboard 3, Gefährte Lurrus; Kartensprache nennt u. a. „A-Luminarch Aspirant“ (nur Forge); **12 Kartenbilder geladen, 0 fehlerhaft**; Kartenansicht mit Bild |
| Genannte Drucke | `POST /cards/collection` 200, `GET /cards/mh2/290/de` 404, `/cards/eld/115/de`, `/cards/dom/254/de`, `/cards/m21/159/de` je 200 |
| Umbenennen | „E2E Izzet Tempo“ |
| Export | Liste beginnt mit `About` / `Name E2E Izzet Tempo` / `Companion` / `1 Lurrus of the Dream-Den (IKO) 226`, enthält `20 Island (DAR) 254` (Arenas Code) und „Daryl, Hunter of Walkers“; Zwischenablage = Liste; Downloads „E2E Izzet Tempo.txt“ (= Liste) und „E2E Izzet Tempo (Original).txt“ (= die importierte Liste, Byte für Byte) |
| Rundreise | exportierte Liste als neues Deck importiert: alle Zeilen geklärt, **keine Scryfall-Anfrage**, Hauptdeck, Sideboard und Gefährte gleich dem Original (Anzahl, Name, Druck) |
| Duplizieren | „E2E Deutsch (Kopie)“ öffnet sich unter eigener Id; Karten und Liste gleich |
| Erneut importieren | startet mit der gespeicherten Liste; geändert („44 Wald“ + „2 Insel“): „Zwang“ → Duress „Wie bisher im Deck“, nur Zeile 7 (Gale) offen → weggelassen; Name bleibt; „„E2E Deutsch (Kopie)“ ersetzen?“ bestätigt; **gleiche Id und Anlage**, Liste = geänderte, Hauptdeck `[6 Lightning Bolt m11 149, 2 Duress, 2 Rampant Growth m10 201, 4 Delver of Secrets mid 47, 44 Forest, 2 Island]`; **0 Scryfall-Anfragen** |
| Löschen | „„E2E Rundreise“ löschen?“ → „Endgültig löschen“ → Liste ohne das Deck, IndexedDB ohne es |
| Sortierung | „Zuletzt geändert“: Kopie, Izzet Tempo, Brawl, Deutsch; `?sort=updated` |
| Deckwahl | „Zufällig aus 2 Constructed-Decks, jede Partie neu.“; Commander-Deck im Dialog gesperrt; „E2E Deutsch“ gewählt; nach Neuladen beides gespeichert; eigenes Deck Commander → „Das Deck der KI hat ein anderes Format …“; „Zufällig“ gesperrt (kein zweites Commander-Deck); Spiegelpartie gewählt; Einstellungen `play.humanDeck`/`play.aiDeck` wie erwartet; „Partie starten“ gesperrt mit Grund |
| Handy mit Touch (eigenes Profil, Decks per Sicherung, ohne Kartendaten) | Hinweis „Ohne Kartendaten …“; Aktionsleiste oben und nach 700 px Scrollen **direkt über der Tab-Leiste** (y 778 + 73 = 851 = Tab-Leiste); Knöpfe 48 px, Menüeintrag 44 px (Layout-Höhe); kein Überlauf; „Mit diesem Deck spielen“ → „Spielen“ mit dem Deck, Startleiste über der Tab-Leiste |
| **Echte Forge-Engine** | alle vier Decks, wie sie danach gespeichert sind (auch das erneut importierte mit Inseln): kein „deck-rejected“, `game.started` mit genau den Karten des Decks, Aufgabe beendet die Partie; Engine bereit nach 6,4–12,0 s, Partie 63–85 ms danach |

### 10.3 Engine, frischer Klon

- Engine unverändert (`engine/` ohne Änderung): erzeugte Protokolldateien =
  Schema, `tsc`, **80/80** Unit-Tests. `test-engine.sh` nicht erneut gelaufen
  (die ausgelieferten Artefakte sind die geprüften von `0ddfbc3`).
- Frischer Klon von `58aaa58`: `npm ci` 4,0 s; `npm run build` ohne Engine
  scheitert laut (`EngineAssetsError: no engine build …`); mit
  `OPENMANA_ENGINE=omit OPENMANA_CARDS=omit` baut er; **418** Tests grün.

## 11. Befunde

### 11.1 Der rote Bestätigungsknopf war zu blass

axe fand im Löschen-Dialog `color-contrast`: destruktiver Text auf seiner
eigenen 20-%-Tönung über dem Dialog erreichte **4,43:1** (nötig 4,5:1). Das
betraf schon „Lokale Daten zurücksetzen“ aus Prompt 07, dessen Dialog nie per
axe geprüft wurde. `--destructive` ist jetzt etwas heller (L 0,71 → 0,74:
4,64:1 im Dialog, 4,83:1 auf Karten); `design-tokens.test.ts` rechnet die
Tönung jetzt mit (der Test schlägt mit dem alten Wert fehl).

### 11.2 Ein Dialog darf beim Schließen seinen Titel nicht verlieren

Die Kartenansicht leerte ihren Inhalt sofort beim Schließen; während der
Schließ-Animation stand ein Dialog ohne Namen im Dokument (axe
`aria-dialog-name`). Jetzt bleibt die Karte bis zum Ende angezeigt – und sie
wird über ihre Kennung aus dem aktuellen Deck gelesen, nicht als altes Objekt
gehalten (Bible §16).

### 11.3 Drucke: der Katalog trägt die meisten, der Rest kostet wenig

Von 11 Drucken, die die englische Arena-Liste nennt, trägt der Katalog 6 (als
üblichen deutschen oder englischen Druck), einer gehört zu einer Karte, die nur
Forge kennt (Arenas „A-“-Karte, nie gefragt); für 4 fragt die Detailseite
einmal Scryfall, in einer Sammelanfrage plus einer Anfrage je deutscher
Fassung. Eine
404 ist dabei Scryfalls Antwort „gibt es nicht deutsch“ (MH2 290); der
E2E-Test notiert Konsolenfehler jetzt mit ihrer Herkunft, um sie von echten
Fehlern zu trennen.

### 11.4 Ein Schemawechsel verlangt einen neuen Kartenkatalog

Die Zeilen des Katalogs sind Datensätze des lokalen Schemas und tragen seine
Version (Prompt 08). Auch ein Wechsel, der nur Decks betrifft, macht den
eingebauten Katalog ungültig: neu bauen (`--offline` genügt, 64 s), gleiche
Zahlen, neue Id. Im Browser gilt ein älterer Katalog als „veraltet“ und bleibt
nutzbar. Festgehalten in `cards/README.md`.

### 11.5 Weiteres

- Der Scryfall-Code (`prints.ts`) lud seit Prompt 09 nicht mehr erst bei
  Bedarf: statische Importe von `printKey` zogen ihn mit (Build-Warnung
  `INEFFECTIVE_DYNAMIC_IMPORT`). `printKey` steht jetzt in `print-key.ts`.
- Touch-Größen misst der Test an der Layout-Höhe: während der Zoom-Animation
  eines Menüs ist ein 44-px-Eintrag 41,8 px (× 0,95) hoch.
- Unter Last brauchten nachgeladene Seiten in jsdom länger als die 1 s, die
  Testing Library wartet → 5 s global; ein Test aus 08 prüfte ein Abzeichen
  aus einer asynchronen Abfrage sofort und schlug einmal zufällig fehl → er
  wartet jetzt darauf.

## 12. Entscheidungen und Abweichungen

- **Gefährte als eigenes Feld** (Schema 3), wie in Prompt 09 für diesen Fall
  vorgemerkt: sonst verlöre der Export den `Companion`-Abschnitt still. Optional,
  daher ohne Umbau gespeicherter Decks (07 empfahl vor der ersten echten
  Umwandlung von Nutzerdaten eine Rettungssicherung – diese Migration wandelt
  nichts um).
- **Zufall ohne eigenes Deck:** Ein zufälliger Gegner, der dein eigenes Deck
  zieht, wirkt wie ein Fehler; die Spiegelpartie bleibt als ausdrückliche Wahl.
  Gezogen wird beim Start jeder Partie, nicht beim Wählen (Überraschung; neue
  Ziehung je Partie, ohne erneut zu wählen). Das Ziehen selbst ist gebaut und
  getestet (`drawAiDeck`), benutzt wird es mit dem Start in Prompt 11.
- **Bild: Deutsch vor genanntem Druck.** Nennt die Liste einen Druck, den es
  nicht auf Deutsch gibt, zeigt OpenMana das deutsche Bild der Karte (anderer
  Druck) statt des englischen – Bible §4 „Deutsch zuerst“; der genannte Druck
  bleibt als Text und im Export. Universes-Beyond-Karten zeigen den Druck mit
  dem Namen, unter dem Forge sie spielt.
- **Kein Speichern der Liste-Historie:** ein erneuter Import ersetzt die
  gespeicherte Liste (bestätigt); Rückweg über eine Sicherung. Die Bible
  verlangt die Originalliste des Imports, keine Versionen.
- **Namen dürfen doppelt sein** (die Id unterscheidet); der Umbenennen-Dialog
  weist darauf hin, Kopien bekommen freie Namen.
- **Deckwahl als Einstellung** statt jedes Mal neu; Startseite: „Gegner
  wählen“ gilt jetzt als vorhanden (das KI-Profil folgt mit Prompt 12).
- **`printKey` in eigenes Modul:** Der Scryfall-Code (`prints.ts`) lud wegen
  statischer Importe (schon seit 09) nicht mehr erst bei Bedarf; jetzt wieder.
- **Menü nicht modal** (`DropdownMenu modal={false}`): ein Dialog, der aus dem
  Menü öffnet, bekommt Fokus und Zeiger sofort (belegt im E2E).

## 13. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Partie mit den gewählten Decks starten, Zufall ziehen, Deck an Forge übergeben; Legalität vor dem Start (Forges `DeckFormat.getDeckConformanceProblem`) | 11 |
| KI-Profil wählen | 12 |
| Karten im Deck ändern (Deckbauer) – nicht verlangt; Änderungen gehen über „Erneut importieren“ | – |
| Manasymbole und Farben als Symbole in Liste und Details | 14 |
| „Zuletzt gespielt“ als Sortierung (braucht aufgezeichnete Partien) | 22 |
| Gefährte älterer Decks (vor Schema 3) wird erst mit einem erneuten Import bekannt | bei Gelegenheit (Spieler) |

## 14. Reproduzieren

```bash
npm ci
bash engine/scripts/build.sh      # Engine (einmal, ~6 min), falls noch nicht gebaut
npm run cards:build               # Katalog (~45 s; nach dem Schemawechsel neu nötig)
npm run check                     # Schemas, tsc, oxlint, Vitest, E2E (braucht Internet: Scryfall-Bilder und -API)
npx vitest run src/decks src/storage/decks.test.ts
```

In der App: Decks → ein Deck antippen; Spielen → „Dein Deck wählen“, „Deck der KI wählen“.

## 15. Was als Nächstes kommt

Prompt **11 — Game session foundation** (PENDING, nicht begonnen: je Lauf genau
ein Prompt). Er verbindet die gewählten Decks mit Forge: Worker vorwärmen,
Laden/Bereit/Fehler/Abbruch/Spielende, Decks an Forge übergeben (mit
`drawAiDeck` für „Zufällig“), keine Attrappen.
