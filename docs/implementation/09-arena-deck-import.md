# 09 — Arena-Deck-Import

> Umsetzung von [`prompts/queue/09-arena-deck-import.md`](../../prompts/queue/09-arena-deck-import.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `c7bb533` (sauberer Arbeitsbaum). Grundlage: [`docs/BIBLE.md`](../BIBLE.md) §2, §5, §8, §15, §16,
> [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md), die lokale Datenschicht aus Prompt 07, die Kartendaten aus
> Prompt 08 und das Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Code: `src/decks/`
> (Import), `src/cards/scryfall-access.ts` (gemeinsamer Scryfall-Client), `scripts/e2e/run.ts` und
> `scripts/e2e/engine-decks.ts` (End-to-End-Test samt Probe in der echten Engine). Messungen auf odin
> (Intel i7-8700T, 12 Threads, Debian 13, Lastmittel 5–9 durch andere Sitzungen), Node 22.22.3,
> Chrome for Testing 153 headless.

## Ergebnis

**Prompt 09 ist umgesetzt.** Decks aus MTG Arena lassen sich übernehmen:
Decks → „Arena-Deck importieren“ (`/decks/import`), Liste einfügen oder
Textdatei öffnen, „Liste prüfen“, offene Zeilen klären, Namen vergeben,
speichern. Das Deck liegt danach in der lokalen Bibliothek (IndexedDB), samt
unveränderter Liste.

- **Arenas Format vollständig gelesen:** Abschnitte `Deck`, `Sideboard`,
  `Commander`, `Companion` und `About`/`Name`, Anzahl, Set und
  Sammlernummer, Arenas eigene Setcodes (`DAR` = Scryfalls `dom`), Blöcke
  ohne Überschrift nach Arenas Regel (nach der ersten Leerzeile Sideboard),
  dieselbe Karte auf mehreren Zeilen. Jede Zeile ist danach Eintrag,
  Überschrift, About-Angabe, Leerzeile oder ein **gemeldetes Problem mit
  Zeilennummer** – nichts wird still übergangen.
- **Deutsch und englisch, andere Sprachen über den Druck:** Namen werden über
  die Kartendaten auf dem Gerät gefunden (englischer Name, Kartenseite,
  aufgedruckter Name, deutscher Name, Forges Name, Forge-only-Karten wie
  Arenas „A-“-Karten). Nur wo das nicht reicht **und** die Zeile einen Druck
  nennt, fragt OpenMana Scryfalls API – so werden auch französische,
  spanische … Namen und Arenas eigene Übersetzungen eindeutig.
- **Stabile Identitäten, Forges Namen:** Jeder Eintrag bekommt den Namen, den
  Forge kennt (Vorderseite, Split-Karte als „Fire // Ice“, Universes-Beyond-
  Karte unter dem gedruckten Namen), die Oracle-Id von Scryfall und – wo
  bekannt – den genannten Druck. Im End-to-End-Test nimmt die **echte
  Forge-Engine** jedes importierte Deck an und startet damit eine Partie.
- **Nie geraten:** Passt ein Name zu mehreren Karten, die Forge kennt (alte
  deutsche Übersetzungen: „Zwang“ = Duress und Coercion), entscheidet der
  genannte Druck oder der Spieler – im Dialog mit Bild, deutschem und
  englischem Namen, Typzeile, Manakosten und Forge-Namen.
- **Bericht vor dem Speichern:** Zusammenfassung, offene Zeilen mit Nummer,
  Text und Grund, Hinweise (Gefährte, Sideboard nach Arenas Regel, unbekannte
  Sets, ungenutzte About-Angaben) und das Deck genau so, wie es gespeichert
  wird. **Speichern erst, wenn jede Zeile geklärt ist** – korrigiert, gewählt
  oder bewusst weggelassen – und das Deck einen Namen hat.
- **Formate ohne Standard-Annahmen:** keine Deckgröße, keine Kopienzahl,
  keine Bann-Liste – ob ein Deck erlaubt ist, entscheidet Forge. Ein
  Kommandeur macht es zum Commander-Deck (so spielt Forge es), der Gefährte
  kommt ins Sideboard, wo Forge ihn zu Spielbeginn sucht.

**Nachweise:** siehe §9 – Typecheck, oxlint, Frische der erzeugten Dateien,
**352 Vitest-Tests** (54 neu), `npm run check` inklusive End-to-End-Test im
echten Chrome mit dem echten Kartenkatalog, der echten Scryfall-API und der
echten Forge-Engine; Engine unverändert 80/80; frischer Klon grün. Kein
Blocker.

## 1. Was gebaut wurde

```
src/decks/
├── arena-list.ts            Arenas Format lesen (rein): Abschnitte, Einträge, About, Probleme mit Zeilennummer
├── deck-resolve.ts          jede Zeile → Karte, die Forge kennt (Katalog, dann Druck bei Scryfall); Bericht je Zeile
├── deck-plan.ts             Bericht + Entscheidungen des Spielers → was gespeichert wird, was noch sperrt, DeckRecord
├── deck-import-labels.ts    deutsche Texte (Abschnitte, Status, Hinweise, Sperren)
├── deck-import-page.tsx     Seite /decks/import (nachgeladen): Eingabe, Kartendaten einrichten, Bericht, Speichern
├── import-report.tsx        Prüfbericht: Zusammenfassung, „Zu klären“, Vorschau je Abschnitt
├── card-choice-dialog.tsx   „Welche Karte ist gemeint?“
├── fixtures/                Beispiel-Listen im Arena-Format (+ README)
└── *.test.ts(x)             Parser 16, Zuordnung 18, Deck-Aufbau 11, Oberfläche 9
src/cards/scryfall-access.ts   der eine Scryfall-Client der App (erst bei der ersten Nachfrage geladen)
src/components/ui/textarea.tsx shadcn-Registry (radix-maia)
src/routes/page-loading.tsx    Platzhalter, solange eine nachgeladene Seite beim Direktaufruf lädt
scripts/e2e/engine-decks.ts    ein gespeichertes Deck in der echten Engine (Wasm in Node) anspielen
```

Geändert: Router (Route `decks/import`, nachgeladen), Decks-Seite (der
bisher gesperrte Knopf „Arena-Deck importieren“ führt jetzt zum Import),
Startseite (Schritt „Deck importieren“ ist da), Einstellungen (Einrichten der
Kartendaten auch vom Import aus nutzbar), `ScryfallClient` (holt `fetch`
bei jeder Anfrage statt einmal beim Anlegen – nötig für den gemeinsamen
Client), Beschreibung von `DeckCard.set` im Schema (Scryfalls Setcode; keine
Formatänderung, daher keine neue Schema-Version).

## 2. Architektur und Branchenstandard

| Frage | Wahl | Einordnung |
|---|---|---|
| Wo prüfen? | im Browser, gegen den Kartenkatalog auf dem Gerät (Prompt 08) | wie Deckbauer-Seiten mit gespiegelten Scryfall-Massendaten; offline nutzbar, keine Anfrage je Karte (Scryfalls Regel) |
| Was ist die Identität? | Scryfalls **Oracle-Id** + Forges **Kartenname** | Oracle-Id ist der übliche stabile Schlüssel über alle Drucke und Sprachen (Scryfall, Moxfield, Archidekt); Forge braucht seinen Namen (`CardPool.add(name)`) |
| Setcode + Nummer | nur Anzeige und Entscheidungshilfe, nie Identität | Anvils Lehre: Arena-eigene Setcodes kennt Forge nicht; Arena selbst nutzt Set + Nummer für fremdsprachige Listen |
| Scryfall-API | nur für Zeilen, die der Katalog nicht entscheidet und die einen Druck nennen | Ratenlimits (ein Client für die ganze App), Datensparsamkeit (Bible §15), offline weiter nutzbar |
| Mehrdeutig | der genannte Druck, sonst der Spieler | nie raten (Bible §16, Anvil: „never silently discard“) |
| Legalität | nicht geprüft | Forge ist die Regel-Autorität (Bible §2); der Import sagt, was er prüft |
| Oberfläche | eigene Route statt Dialog, **nachgeladen** | lange Berichte am Handy; routenbasiertes Code-Splitting ist Standard (React Router `lazy`) und hält das Start-Bundle klein |

## 3. Das Format (`arena-list.ts`)

Belegt am 2026-09-25: Arenas eigene Exporte, Wizards' Beschreibung dessen,
was Arena importiert (Einträge `4 Basri Ket` und `4 Basri Ket (M21) 7`,
Abschnitte durch Leerzeilen getrennt, Überschriften `Deck`, `Sideboard`,
`Commander`, `Companion`, Blöcke ohne Überschrift „erst Hauptdeck, dann
Sideboard“, Set + Nummer „für fremde Sprachen am besten“), Arenas
`About`/`Name`-Block für den Decknamen, echte Exporte mit Gefährte (steht
**auch im Sideboard**) und mit derselben Karte auf mehreren Zeilen.

```
About
Name Mono-Red Aggro

Companion
1 Lurrus of the Dream-Den (IKO) 226

Deck
4 Lightning Strike (M19) 152
20 Mountain (M19) 277

Sideboard
1 Lurrus of the Dream-Den (IKO) 226
2 Shock (M19) 156
```

- **Eintrag:** `<Anzahl> <Name>`, optional ` (<Set>) <Nummer>`. Das Set muss
  ein Wort in Klammern sein – „B.F.M. (Big Furry Monster)“ bleibt ein Name.
- **Sprache:** Ein deutscher Arena-Client schreibt deutsche Kartennamen
  (Forum-Beleg: „Plains = Englisch / Ebene = Deutsch“); Arena übersetzt
  einige Karten eigenständig – Set + Nummer identifizieren sie trotzdem.
- **Toleriert, obwohl Arena es nicht schreibt:** `4x Name` (Deckseiten),
  Doppelpunkt nach Überschriften, Set ohne Nummer (ohne Druck), Tabs,
  Windows-Zeilenenden, Byte-Order-Mark, die deutschen Abschnittsnamen
  `Kommandeur` und `Gefährte` (**unbestätigt**, ob ein deutscher Client so
  exportiert; sie können keine Kartenzeile fehldeuten, die immer mit einer
  Zahl beginnt).
- **Probleme:** `unrecognized` (weder Eintrag noch Überschrift noch
  About-Angabe, auch unbekannte Überschriften wie `Maybeboard`), `zero-count`
  (`0 Name`). Anzahlen werden nicht begrenzt – das entscheidet Forge.
- Höchstens 200 000 Zeichen (Arena-Listen haben wenige Kilobyte).

## 4. Welche Karte gemeint ist (`deck-resolve.ts`)

Je Name ein Lesezugriff auf den Index `nameKeys` (alle Namen in **einer**
Lese-Transaktion, dazu Forge-only-Karten und die Setcodes), dann:

1. **Rang des Treffers:** eigener Name (Oracle-Name oder Forge-Name) vor
   Vorderseite vor späterer Seite vor aufgedrucktem englischem Alias vor
   gedrucktem deutschem Namen. So ist „Lightning Bolt“ Lightning Bolt und
   nicht die zweite Seite von „Emeritus of Conflict // Lightning Bolt“ (die
   neue „prepare“-Kartenart, 26 solche Überschneidungen im Katalog), und
   „Delver of Secrets“ die doppelseitige Karte, deren Vorderseite er ist.
2. **Mehrere Karten auf dem besten Rang:**
   - alle dieselbe Forge-Karte (Un-Karten-Varianten, 3 Fälle): diese
     Forge-Karte, welches Bild gemeint ist, bleibt offen (wählbar);
   - genau eine davon kennt Forge (Playtest-Karte neben der echten): diese;
   - sonst **mehrdeutig** – der genannte Druck entscheidet, sonst der
     Spieler. Im echten Katalog: **32 solche Namen**, davon 24 alte deutsche
     Doppelübersetzungen („Zwang“ = Duress/Coercion, „Wucherndes Wachstum“ =
     Rampant Growth/Overgrowth, „Feuersturm“, „Vergeltung“ …), dazu
     Playtest-Paare („Joven and Chandler“/„P-Joven and Chandler“) und
     Rückseiten mehrerer „prepare“-Karten. (Bei 6 weiteren Namen kennt Forge
     nur eine der Karten, bei 11 keine.)
3. **Englischer Name, der auch der deutsche Name einer anderen Karte ist**
   (2 Fälle: „Sturmgeist“, „Regeneration“): der englische, mit Hinweis und
   Wahlmöglichkeit.
4. **Karte nur bei Forge** (Arenas „A-“-Karten, die Scryfall nicht mehr
   führt, und 8 gelistete): über Forges Namen. Ein „A-…“-Name, den Forge so
   nicht kennt, wird nie über den Druck aufgelöst (Scryfall kennt nur das
   Original).
5. **Karte, die Forge nicht kennt:** „nicht spielbar“ (im Katalog 1 310
   Karten, v. a. Un-Sets, Mystery-Booster-Playtests, Alchemy „Horizons:
   Baldur's Gate“ – für Arena-Listen praktisch nur Alchemy).
6. **Nur ein Spielstein** dieses Namens: nicht gefunden, mit Hinweis.

Danach, **nur** für nicht gefundene und mehrdeutige Zeilen mit Set (dem
Katalog bekannt) und Nummer: `ensurePrints` (Prompt 08) über den einen
Scryfall-Client (`/cards/collection`, 2 Anfragen je Sekunde, 30 Tage
gemerkt). Der Druck identifiziert eine unbekannte Zeile, entscheidet eine
mehrdeutige – oder die Zeile bleibt offen und sagt warum („Druck gehört zu
…“, „Druck unbekannt“, „Scryfall nicht erreichbar“).

**Setcodes:** zuerst Arenas Code (`arenaCode` der Sets, 227 Sets; 24
weichen von Scryfall ab, z. B. Arenas `DAR` = Scryfalls `dom`, `7E` =
`7ed`), dann Scryfalls eigener. Ein unbekannter Code ist nur ein Hinweis
(übliches Bild).

## 5. Was gespeichert wird (`deck-plan.ts`)

- Einträge derselben Karte **und** desselben Drucks in einem Abschnitt
  werden addiert; andere Drucke bleiben eigene Einträge (Forge addiert sie).
- Der **Gefährte** kommt ins Sideboard, wo Forge ihn sucht
  (`Match.assignCompanion` liest das Sideboard); steht er dort schon (wie
  Arena exportiert), bleibt er einmal dort.
- `format`: `commander`, wenn die Liste einen Kommandeur nennt, sonst
  `constructed` – wie Forge das Deck spielt (Protokoll `MatchFormat`), kein
  Legalitätsurteil. Arena-Brawl-Decks spielt Forge damit als Commander.
- `DeckRecord` (Schema aus Prompt 07, unverändert): Forges Name, Anzahl,
  `set` = Scryfalls Setcode + `collectorNumber` (nur wenn beides bekannt und
  der Druck nicht nachweislich zu einer anderen Karte gehört), `oracleId`
  (nicht bei Forge-only-Karten und offenen Varianten), `scryfallId` (wo der
  Druck bekannt ist: einer der üblichen Drucke des Katalogs oder bei Scryfall
  nachgefragt), `source.text` = die geprüfte Liste **unverändert** (auch mit
  weggelassenen Zeilen), Zeitstempel. Geprüft vor dem Schreiben
  (`assertRecord`), geschrieben über `LocalDatabase.write`.

## 6. Oberfläche

- **Decks:** Knopf „Arena-Deck importieren“ (leere Bibliothek und Liste).
- **Import (`/decks/import`):** „Deckliste“ mit Textfeld und „Textdatei
  öffnen“ (UTF-8, UTF-16 mit Byte-Order-Mark; anderes wird abgelehnt und
  gesagt, warum). Ohne Kartendaten: Karte „Kartendaten nötig“ mit Einrichten
  und Fortschritt direkt hier; „Liste prüfen“ bleibt bis dahin gesperrt und
  sagt warum.
- **Prüfbericht:** Zustand („Alle Zeilen geklärt“ / „N Zeilen sind noch zu
  klären“), Format, Kartenzahlen je Abschnitt, Hinweise; „Zu klären“ mit
  Zeilennummer, Originaltext, Grund und den Aktionen **Karte wählen** und
  **Weglassen** (rückgängig: „Wieder aufnehmen“); **Deck speichern** mit
  Namen (aus `About`/`Name` vorbelegt) – gesperrt mit Grund, solange etwas
  offen ist; darunter das Deck je Abschnitt mit Miniatur, deutschem Namen,
  Forge-Name, Druck und Hinweisen. Während eine Wahl neu geprüft wird, bleibt
  der Bericht stehen (kein Springen).
- Nur shadcn-Bausteine: neu `Textarea` (Registry); sonst `Card`, `Item`,
  `Dialog`, `Alert`, `Field`, `Badge`, `Button`, `Skeleton`, `Spinner`,
  `CardPicture`. Alles für den Spieler deutsch, Route englisch.

## 7. Kosten

- **Start-JavaScript:** 206,7 → **207,7 KB gzip** (Vite-Angabe: App-Code
  107,4 → 108,4 KB – Route, Link, Platzhalter; React + Router 99 KB
  unverändert).
- **Nachgeladen:** Import-Seite samt Parser, Zuordnung und Bericht
  **13,2 KB gzip** (erst beim Öffnen), Scryfall-Client samt Prüfern 5,1 KB
  gzip (erst bei der ersten Nachfrage).
- **Prüfzeit** im echten Chrome (E2E): englische Arena-Liste mit 21 Zeilen
  **0,12 s**; deutsche Liste mit zwei Nachfragen bei Scryfall **1,3 s**.
- **Scryfall:** für die deutsche Testliste genau 1× `/cards/collection` und
  2× die deutsche Fassung des Drucks; für die englische keine einzige Anfrage.

## 8. Tests

| Datei | Tests | Was |
|---|---:|---|
| `src/decks/arena-list.test.ts` | 16 | Arena-Exporte (englisch, Gefährte, Brawl, deutsch mit BOM/CRLF/deutschen Abschnitten), Arenas Regel für Blöcke ohne Überschrift (auch nach Kommandeur, Überschrift mitten im Block, Karte direkt nach About), was Deckseiten schreiben, jede unlesbare Zeile mit Nummer, unbekannte Abschnitte, About, Groß-/Kleinschreibung, leerer Text, große Anzahlen |
| `src/decks/deck-resolve.test.ts` | 18 | echter Test-Katalog: englischer und deutscher Export, Rückseiten, Aliasse und Forge-Namen, nicht spielbar/Spielstein/unbekannt/„A-“, mehrdeutig mit Wahl (ungültige Wahl wirkungslos), Arenas Setcodes; Druck identifiziert/entscheidet/gehört zu anderer Karte/unbekannt/Scryfall nicht erreichbar, keine Anfrage für geklärte Zeilen, ohne Nachfrage wird nichts geraten; die Regeln einzeln (eigener Name vor Seite, „Zwang“, „Sturmgeist“, Varianten, Playtest neben echter Karte, Forge-only gleichen Namens) |
| `src/decks/deck-plan.test.ts` | 11 | Abschnitte, Drucke, Addieren, Scryfall-Id aus dem Katalog, Gefährte (im Sideboard / ergänzt), Commander, Sperren in Listenreihenfolge, Weglassen, leeres Hauptdeck, gültiger `DeckRecord` (Schema), Name nötig |
| `src/decks/deck-import.test.tsx` | 9 | Weg von der Decks-Seite, Kartendaten auf der Import-Seite einrichten, englischer Export bis in die Datenbank, offene Zeilen: wählen, weglassen, wieder aufnehmen, Name; Commander; fremdsprachiger Name über Scryfall (Stellvertreter-`fetch` mit echten Kartenobjekten), Scryfall nicht erreichbar und „Erneut prüfen“, Textdatei (und abgelehnte Nicht-Textdatei), Liste bearbeiten |
| bestehend | 298 | unverändert grün (zwei Tests erwarten statt des gesperrten Knopfs jetzt den Link zum Import) |

## 9. Nachweise

Alle auf `c7bb533`, sauberer Arbeitsbaum, Chrome for Testing 153.0.8010.12
headless, echte Engine `0c82db80023ac0cc`, echter Katalog `cacfe9aca953cd50`.

### 9.1 `npm run check` (188 s, Lastmittel 8,7)

Erzeugte Dateien = Schemas, `tsc -b`, `oxlint` ohne Befund, **352 Tests**
grün, End-to-End **0 Fehler**.

### 9.2 End-to-End, Abschnitt 8 „Deck import“

| Prüfung | Ergebnis |
|---|---|
| Weg hinein | Decks → „Arena-Deck importieren“ → Import-Seite; ohne Kartendaten ist „Liste prüfen“ gesperrt, „Kartendaten einrichten“ direkt dort: 4,8 s |
| Englische Arena-Liste (21 Zeilen) | „Alle Zeilen geklärt“ in 0,12 s, Name „E2E Izzet“ aus `About`, Hauptdeck 60 / Sideboard 3; „Geheimnisstöberer – Forge: Delver of Secrets · MID 47“, „Hansk, Slayer Zealot – Forge: Daryl, Hunter of Walkers“, „Insel – Forge: Island · **DOM 254**“ (Arenas `DAR`), „A-Luminarch Aspirant“, „Wucherndes Wachstum – Forge: Rampant Growth“; Gefährte „Lurrus aus der Traumhöhle“ im Sideboard; **keine** Anfrage an Scryfalls API |
| Deutsche Liste | „2 Zeilen sind noch zu klären“: Zeile 4 „Zwang“ (mehrdeutig), Zeile 7 „Gale, Primeval Conduit“ (Forge kennt sie nicht); „6 × Blitzschlag“ (Blitzschlag + französisch „Foudre (M11) 149“, über Scryfall erkannt); „Wucherndes Wachstum (M10) 201“ – der Druck entschied für Rampant Growth; Speichern gesperrt |
| Wählen, weglassen, Name | Dialog mit zwei Kandidaten (Duress/Coercion), Duress gewählt; Zeile 7 weggelassen; „Das Deck braucht einen Namen.“; gespeichert als „E2E Deutsch“ |
| Commander als Textdatei | `brawl.txt` mit BOM und CRLF: sofort geprüft, Kommandeur Valki, „Forge spielt das Deck als Commander-Partie“ |
| Neu laden, IndexedDB | alle drei Decks gelistet; Datensätze wie erwartet (`dom`/`254`, Forge-only ohne Oracle-Id, Sideboard „Lurrus of the Dream-Den“ + „Shock“, deutsches Hauptdeck `[6 Lightning Bolt, 2 Duress, 2 Rampant Growth, 4 Delver of Secrets, 46 Forest]`, Listen unverändert) |
| Scryfall-API | 1× `POST /cards/collection`, `GET /cards/m11/149/de`, `GET /cards/m10/201/de`, alle 200 |
| axe-core | Bericht englisch, Bericht mit offenen Zeilen, Handy, Auswahldialog: je 0 Befunde; Import-Seite in allen drei Größen (Oberflächen-Durchlauf): 0 Befunde, kein Überlauf |
| **Echte Forge-Engine** | jedes gespeicherte Deck (Constructed ×2, Commander) als `match.start` an die Engine (dasselbe Wasm-Modul, Node): **kein „deck-rejected“**, `game.started` nennt genau die Karten des Decks, Aufgabe beendet die Partie; Engine bereit nach 9,6–12,0 s (Last), Partie gestartet 70–152 ms danach |

### 9.3 Engine, frischer Klon

- Engine unverändert (`engine/` ohne Änderung): erzeugte Protokolldateien =
  Schema, `tsc`, **80/80** Unit-Tests. `test-engine.sh` nicht erneut gelaufen
  (die ausgelieferten Artefakte sind die geprüften von `0ddfbc3`).
- Frischer Klon von `c7bb533`: `npm ci`; `npm run build` ohne Engine
  scheitert laut; mit `OPENMANA_ENGINE=omit OPENMANA_CARDS=omit` baut er;
  **352** Tests grün.

## 10. Befunde

### 10.1 Deutsche Arena-Listen haben deutsche Namen – und alte Doppelnamen

Ein deutscher Arena-Client exportiert deutsche Kartennamen; Arena übersetzt
einige Karten eigenständig. Im Katalog tragen **32 Namen** mehrere Karten,
die Forge kennt, 24 davon aus alten deutschen Übersetzungen. Deshalb
entscheidet der genannte Druck, sonst der Spieler – nie eine Vermutung.

### 10.2 Die neue „prepare“-Kartenart überschneidet sich mit bekannten Karten

Karten wie „Emeritus of Conflict // Lightning Bolt“ tragen als zweite Seite
den Namen einer anderen, bekannten Karte. Die Rangfolge „eigener Name vor
Seitenname“ macht „Lightning Bolt“ eindeutig; nur Rückseiten mehrerer solcher
Karten („Peer Review“) bleiben mehrdeutig.

### 10.3 Forge nimmt die Namen des Katalogs an

Die echte Engine akzeptierte alle geprüften Namensarten: Vorderseiten
doppelseitiger und Abenteuer-Karten, Split-Karten mit „ // “, Arenas
„A-“-Karten, Universes-Beyond-Karten unter dem gedruckten Namen. Damit ist
der Weg Katalog → `forgeNames` → Forge belegt, nicht nur angenommen.

### 10.4 Weiteres

- **Gemeinsamer Scryfall-Client:** `ScryfallClient` band `fetch` beim
  Anlegen; für einen Client über die ganze Laufzeit (Ratenlimits zählen je
  Client) holt er es jetzt bei jeder Anfrage (Tests fanden es).
- **Nachgeladene Route:** React Router warnt beim Direktaufruf einer
  `lazy`-Route ohne `HydrateFallback` (und zeigt bis dahin nichts) – jetzt
  `PageLoading`; der End-to-End-Test fand die Warnung.
- Arena listet dieselbe Karte mehrfach, wenn sich Exemplare im Kunststil
  unterscheiden; der Import addiert sie.

## 11. Entscheidungen und Abweichungen

- **Keine Legalitätsprüfung** (Bible §2): keine Deckgröße, keine Kopienzahl,
  keine Farbidentität, keine Bann-Liste. Der Bericht sagt, was geprüft wird.
  Forge prüft Decks beim Start einer Partie nicht (Befund aus Prompt 05) –
  siehe §12.
- **Gefährte ohne eigenes Feld:** Er liegt im Sideboard (Forge braucht nicht
  mehr); die Liste bleibt beim Deck. Ein eigenes Feld wäre eine
  Schema-Änderung mit Migration – erst, wenn die Bibliothek (10) es braucht.
- **`DeckCard.set` = Scryfalls Setcode** (Kleinbuchstaben), nicht Arenas –
  damit `ensurePrints` den Druck später findet; die Schema-Beschreibung sagt
  es jetzt (keine Formatänderung, keine neue Schema-Version).
- **Weglassen ist eine bewusste Entscheidung**, kein stilles Verwerfen: die
  Zeile steht bis zum Speichern als „Weggelassen“ im Bericht und bleibt in
  der gespeicherten Liste.
- **Scryfall nur für offene Zeilen mit Druck** – nicht, um geklärte Zeilen
  zu bestätigen oder Bilder bestimmter Drucke vorzuladen (das kann die
  Bibliothek, Prompt 10).
- **„4x“ und deutsche Abschnittsnamen** werden toleriert, obwohl Arena sie
  nicht schreibt bzw. es unbestätigt ist.
- **Eigene Seite statt Dialog**, nachgeladen; der Bericht bleibt beim
  Aktualisieren stehen.

## 12. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Deck ansehen, umbenennen, erneut importieren/aktualisieren, exportieren; Bilder der genannten Drucke (`ensurePrints` für geklärte Zeilen) | 10 |
| Deck-Legalität: Forge prüft beim Start nicht – Vorschlag: vor Spielstart Forges eigene Prüfung (`DeckFormat.getDeckConformanceProblem`) über die Engine abfragen und anzeigen | 11 |
| Gefährte als eigenes Feld, falls die Bibliothek ihn zeigen soll | 10 |
| Deutsche Abschnittsnamen und „A-“-Karten in deutschen Arena-Exporten mit einem echten deutschen Export bestätigen | bei Gelegenheit (Projektbesitzer) |
| Andere Formate (MTGO `.dek`, Moxfield/Archidekt-Links) | nicht verlangt |
| Manasymbole als Symbole | 14 |

## 13. Reproduzieren

```bash
npm ci
bash engine/scripts/build.sh      # Engine (einmal, ~6 min), falls noch nicht gebaut
npm run cards:build               # Katalog (~45 s)
npm run check                     # Schemas, tsc, oxlint, Vitest, E2E (braucht Internet: Scryfall-Bilder und -API)
npx vitest run src/decks          # nur der Import
```

In der App: Decks → „Arena-Deck importieren“.

## 14. Was als Nächstes kommt

Prompt **10 — Deck library** (PENDING, nicht begonnen: je Lauf genau ein
Prompt). Er baut auf den gespeicherten Decks auf: Liste, Details,
Umbenennen, Duplizieren, Löschen, erneut importieren, Export, und wählt
Spieler- und KI-Deck.
