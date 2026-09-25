# 13 — Spieltisch-Grundlage

> Umsetzung von [`prompts/queue/13-battlefield-foundation.md`](../../prompts/queue/13-battlefield-foundation.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Implementierung
> `eb8e0ab`; alle Nachweise liefen auf diesem Stand (sauberer Arbeitsbaum, Engine unverändert).
> Grundlage: [`docs/BIBLE.md`](../BIBLE.md) §2, §6 (Spieltisch, Karten, Schlachtfeld), §9, §11, §16,
> [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md) („Game table“, „Live state“), Anvils Tisch
> (`TischScreen.kt`, `Feld.kt`), das Protokoll ([`engine/protocol/README.md`](../../engine/protocol/README.md)),
> die Spielsitzung (Prompt 11), die Kartendaten (Prompt 08) und die Kartensprache (Prompt 12),
> das Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Code: `src/game/game-table.tsx`,
> `table-model.ts`, `table-cards.ts`, `table-labels.ts`, `src/components/ui/game-board.tsx`,
> `game-card.tsx`, `src/app/immersive.tsx`, `src/game/game-page.tsx`. Messungen auf odin (Intel i7-8700T,
> 12 Threads, Debian 13), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 13 ist umgesetzt.** Eine laufende Partie ist jetzt ein **Spieltisch**,
gebaut aus Forges vollständigem Zustand:

- **Feste Bereiche** statt einer langen Seite: oben der Kopf (Zug, Schritt, wer
  am Zug ist, ob Forge auf dich wartet, das Menü), die **Forge-KI** mit ihrer
  Hand, ihr **Spielfeld**, **Stapel und Kampf**, **dein Spielfeld**, **du**,
  Forges **Entscheidung** und **deine Hand**. Der Tisch füllt den Bildschirm
  und rollt nie als Ganzes; was nicht passt, rollt in seinem Bereich – Karten
  seitwärts, Texte nach unten.
- **Hochformat** (Handy, zugeklapptes Foldable, Tablet hochkant): die Bereiche
  untereinander, die Hand unten. **Querformat** (Desktop, gedrehtes Tablet,
  Foldable oder Handy): Spielfelder und Hand links, rechts eine Seitenspalte
  mit der KI neben dem Kopf, Stapel und Kampf neben ihrem Feld, der
  Entscheidung neben deinem Feld und dir neben deiner Hand – beide Spielfelder
  sind immer gleich hoch.
- **Vollbild:** Während die Partie läuft, treten Seitenleiste, Kopfleiste und
  Tab-Leiste der App zurück. Das Menü des Tischs führt zu jeder Seite (die
  Partie läuft weiter), zeigt die Paarung, Forges Meldungen und hat
  „Aufgeben“ (mit Bestätigung).
- **Karten** mit Bildern aus dem Kartenkatalog in der Kartensprache des
  Spielers, ohne Katalog mit Forges eigenen Worten. **Getappt** ist gedreht
  (Magics eigenes Zeichen). Stärke/Widerstandskraft, Schaden, Marken, Angriff,
  Block, verdeckt, ausgephast stehen **unter** dem Bild (Scryfall verbietet,
  Kartenbilder zu überdecken). Gleiche Karten liegen als **Stapel** („9×
  Gebirge“), getappte getrennt; Karten, die Forge irgendwo nennt (Frage,
  Stapel, Kampf, Anhängsel), liegen immer einzeln. Auren und Ausrüstung liegen
  bei der Karte, an die sie angelegt sind – auch die Aura des Gegners auf deiner
  Kreatur.
- **Verborgenes bleibt verborgen:** Die Hand der KI sind Rückseiten (nur die
  Anzahl, keine Id, kein Name); eine Karte, die Forge aufdeckt, erscheint
  offen; verdeckte bleibende Karten der KI sind Rückseiten; die Bibliothek ist
  eine Zahl.
- **Stapel und Kampf** in Forges Worten: oberster Eintrag zuerst, wer ihn
  gespielt hat, ausgelöst oder nicht, die Ziele; im Kampf wer wen angreift und
  wer blockt („Giant Spider greift Forge-KI an – geblockt von Canyon Minotaur,
  Raging Goblin“), gleiche ungeblockte Angreifer in einer Zeile („13 × Goblin
  Token …“).
- **Forges Entscheidung** mit Forges Anweisung, der Art der Frage und den
  Antworten, die Forge anbietet – ehrlich als „hier noch nicht beantwortbar“
  (das kommt mit Prompt 15 ff.); Forges Meldungen erscheinen oben als Hinweis
  und bleiben im Menü.
- **Keine Regeln im Client:** Alles ist Forges – Sitzplätze aus `me`, Reihen
  aus Forges Feldern, Stapel aus identischen Werten, nichts gerechnet, nichts
  erraten.

**Nachweise:** siehe §10 – Typecheck, oxlint, Frische der erzeugten Dateien, **559 Vitest-Tests**
(49 neu: Modell, Bilder, Tisch, Wörter, Vollbild, Meldungen – auf sieben echten, von der Engine
aufgezeichneten Spielständen), `npm run check` mit dem End-to-End-Test im echten Chrome und der
echten Engine: **„E2E OK“, 0 Befunde** – die Live-Partien am Tisch (Desktop, Fenster hochkant und
quer, Handy hochkant und gedreht) und Abschnitt 12 neu: **42 Kombinationen** aus sieben echten
Szenen und sechs Größen, **0 axe-Befunde**, keine Seite rollt, kleinstes Spielfeld 112 px. Engine
unverändert (80/80). Kein Blocker.

## 1. Was gebaut wurde

```
src/game/
├── table-model.ts        Forges Zustand → Tisch: Sitzplätze, Reihen, Stapel gleicher Karten, Anhängsel, Stapel, Kampf (rein, ohne React)
├── table-cards.ts        Bilder der Tischkarten: Forges Schlüssel → Katalogkarte (einmal je Schlüssel) → Bild in der Kartensprache
├── table-labels.ts       deutsche Wörter des Tischs: Marken, Mana, Fakten einer Karte, Stapel- und Kampfzeilen
├── game-table.tsx        der Spieltisch (reine Ansicht eines Zustands; auch für die spätere Wiedergabe, Prompt 22)
└── game-page.tsx         laufende Partie = Tisch im Vollbild, Menü (Paarung, Meldungen, Navigation, Aufgeben), Meldungs-Hinweise
src/components/ui/
├── game-board.tsx        Raster des Tischs: acht Bereiche, Hoch- und Querformat (shadcn-Weise gebaut)
├── game-card.tsx         Karte auf dem Tisch (von der Reihenhöhe bemessen, getappt gedreht, Faktenleiste darunter), Rückseite, Gruppe
└── card-picture.tsx      + `compact` (kleine Karten: wenig Innenabstand im Text-Ersatz)
src/app/
├── immersive.tsx         eine Seite nimmt den ganzen Bildschirm (App-Rahmen tritt zurück)
└── app-shell.tsx         blendet Seitenleiste, Kopf- und Tab-Leiste aus, solange eine Seite es verlangt
src/engine/engine-session.ts   + `noticeCount` (wie viele Meldungen die Partie hatte: neue als Hinweis zeigen)
src/hooks/use-element-height.ts   Höhe eines Elements (ResizeObserver): ein oder zwei Reihen je Spielfeld
scripts/record-table-scenes.ts    echte Szenen aus den Mitschnitten der Engine-Tests → src/test/fixtures/table-scenes.json
src/test/table-scenes.ts          die Szenen für Tests; src/test/table-harness.tsx + scripts/e2e/table-harness.html: Prüfstand des E2E
```

## 2. Die Bereiche

| Bereich | Name (Screenreader) | zeigt |
|---|---|---|
| Kopf | „Spielstand“ | Menü, „Zug 3 · Erste Hauptphase“, „Du bist am Zug“ / „Die Forge-KI ist am Zug“ / „Die Starthände werden gezogen“, „Du bist dran“ / „Forge rechnet“ / „Gibt auf …“; unsichtbar die Überschrift „Partie“ |
| Forge-KI | „Forge-KI“ | Name, das von Forge bestätigte KI-Profil, „am Zug“, „Priorität“, „verloren“, Lebenspunkte, Hand, Bibliothek, Friedhof, Exil, Kommandozone, Manavorrat, Marken des Spielers (Gift …), Kommandeur mit Steuer und Kommandeurschaden; die Hand als Rückseiten |
| Spielfeld der Forge-KI | „Spielfeld der Forge-KI“ | außen Länder und weitere bleibende Karten (die Kommandozone vorneweg), zur Mitte die Kreaturen |
| Stapel und Kampf | „Stapel und Kampf“ | der Stapel (oben zuerst) und die Kampfpaarungen; leer eine Linie |
| Dein Spielfeld | „Dein Spielfeld“ | zur Mitte deine Kreaturen, außen Länder und weitere (Kommandozone vorneweg) |
| Du | „Du“ | wie bei der KI, ohne Hand (die liegt unten) |
| Entscheidung | „Entscheidung“ | Forges Anweisung, die Frage(n), die angebotenen Antworten, „noch nicht beantwortbar“, bzw. „Forge rechnet …“; Warnung einer stummen Engine |
| Deine Hand | „Deine Hand: 7 Karten“ | deine Karten nebeneinander, seitwärts rollend, nie gefächert |

```
Hochformat                         Querformat
┌──────────────────────┐           ┌───────────────────────────┬──────────────┐
│ Kopf                 │           │ Kopf                      │ Forge-KI     │
│ Forge-KI (+ Hand)    │           ├───────────────────────────┼──────────────┤
│ Spielfeld der KI     │  1fr      │ Spielfeld der KI          │ Stapel/Kampf │  1fr
│ ── Stapel/Kampf ──   │           ├───────────────────────────┼──────────────┤
│ Dein Spielfeld       │  1fr      │ Dein Spielfeld            │ Entscheidung │  1fr
│ Du                   │           ├───────────────────────────┼──────────────┤
│ Entscheidung         │           │ Deine Hand                │ Du           │
│ Deine Hand           │           └───────────────────────────┴──────────────┘
└──────────────────────┘
```

- **Beide Spielfelder teilen sich die freie Höhe gleich** (`minmax(0, 1fr)`);
  alles andere nimmt, was sein Inhalt braucht. Im Hochformat sind Stapel/Kampf
  (`max-h-32`) und Entscheidung (`max-h-44`) begrenzt und rollen innen – sie
  drücken die Spielfelder nie weg.
- **Ein oder zwei Reihen:** Ein Spielfeld misst seine Höhe (ResizeObserver):
  ab 176 px zwei Reihen (Kreaturen zur Mitte, Rest außen, wie Anvil), darunter
  eine (Kreaturen zuerst). Die Karten nehmen die Höhe ihrer Reihe; wird es eng,
  werden sie kleiner statt die Seite zu verlängern.
- **Reihen** sind so breit wie ihre Karten, **mittig solange es passt**
  (`justify-content: safe center`), sonst **rollen sie seitwärts**; eine Reihe
  ist per Tastatur erreichbar (sie nimmt den Fokus, bis ihre Karten mit Prompt
  14 selbst bedienbar werden).
- **Hoch- oder Querformat** entscheidet die Ausrichtung des Fensters
  (`landscape:`), nicht das Gerät; Drehen oder Aufklappen legt den Tisch neu
  aus, die Partie merkt davon nichts (E2E: Fenster auf 884×1104, 1104×884,
  zurück, Handy gedreht – dieselbe Frage offen, keine zweite Engine).
- **Zonenzahlen** stehen mit Wort, wo Platz ist, sonst mit Symbol (Hand,
  Bibliothek, Friedhof, Exil, Kommandozone; Container-Abfrage auf die Breite
  der Leiste); Screenreader und Tooltip behalten das Wort.

## 3. Karten auf dem Tisch

- **Bild:** Forges Schlüssel (`VisibleCard.key`, der englische Name der Seite,
  die Forge zeigt) → `resolveEngineKey` im Katalog → `cardDisplay(…, { language })`
  in der Kartensprache des Spielers. Die Seite, die Forge zeigt, zeigt auch das
  Bild (verwandelt: Rückseite). `srcset` aus Scryfalls kleinem (146 px) und
  großem Bild (488 px) mit `sizes="auto"`: der Browser nimmt, was die Karte auf
  dem Bildschirm braucht; Bilder laden erst, wenn sie ins Bild kommen.
- **Gemerkt wird nur die Antwort des Katalogs je Schlüssel** (statische
  Kartendaten, je Katalog-Version), nie eine Karte der Partie: der Tisch zeigt
  immer die Karten des aktuellen Zustands (Anvil-Lehre „Live state“).
- **Kein Raten:** Kann der Katalog einen Schlüssel nicht eindeutig zuordnen –
  Spielsteine eines Namens, die zu Forges Stärke, Widerstandskraft und Farben
  gleich gut passen (Krenkos Goblins: drei Scryfall-Goblins 1/1 rot), Karten nur
  in Forge, Forges Effektkarten der Kommandozone („Stomp (54)'s Effect“) –,
  gibt es kein Bild, sondern Forges Name und Typzeile im Kartenrahmen.
  Während der Katalog gefragt wird: Platzhalter.
- **Getappt:** das Bild um 90° gedreht auf quadratischem Platz; Screenreader
  hören „getappt“.
- **Die Faktenleiste unter dem Bild** (nie auf dem Bild – Scryfall verbietet
  Überdecken, Beschneiden, Tönen): Stapelgröße („9×“), Angriff (Schwerter) und
  Block (Schild), Stärke/Widerstandskraft bzw. Loyalität, Schaden, Marken
  (deutsch), „verdeckt“, „ausgephast“; zu lang wird sie mit „…“ gekürzt, der
  vollständige Text steht im Tooltip und für Screenreader bereit.
- **Stapel gleicher Karten:** Karten, bei denen Forge **jeden** Wert gleich
  meldet (getappt, Marken, Schaden, Kampf, Forges Markierungen …) – nur die Id
  unterscheidet sie –, liegen als eine Karte mit Anzahl. Nie gestapelt: Karten,
  die Forge anderswo nennt (in einer offenen Frage, auf dem Stapel als Quelle
  oder Ziel, im Kampf, als Träger oder Anhängsel).
- **Reihen:** Karten mit Stärke und Widerstandskraft (Forge schickt sie nur für
  Kreaturen und Karten mit aufgedruckten Werten, etwa Fahrzeuge) liegen zur
  Mitte, alle anderen außen. Das ist ein Feld, das da ist oder nicht, keine
  Typprüfung: macht Forge ein Land zur Kreatur, wandert es von selbst.
- **Anhängsel:** Eine Karte mit `attachedTo` liegt in einem Rahmen bei ihrem
  Träger – auf dessen Seite, auch wenn sie dem Gegner gehört; liegt der Träger
  nicht sichtbar auf einem Spielfeld, bleibt sie, wo Forge sie führt.
- **Marken:** Forges Markentypen (`+1/+1`, `Poison`, `Loyalty` … und die
  Schlüsselwort-Marken nach Regel 122.1b) mit deutschen Namen aus Magics
  deutschen Regeltexten; Forge übersetzt Marken selbst nicht, eine fehlende
  steht mit Forges englischem Namen (`lang="en"`).

## 4. Verborgene Information

Der Tisch zeigt genau, was Forge dem Spieler zeigt (`mayView` in der Bridge,
seit Prompt 03):

| Was | Protokoll | Tisch |
|---|---|---|
| Hand der KI | `HiddenCard` (`{hidden: true}`, keine Id, kein Name) | Rückseiten, Anzahl; keine Bilder, keine Namen im Dokument (E2E: 0 Bilder) |
| von Forge aufgedeckte Karte der KI-Hand | `VisibleCard` | offen, mit Bild |
| verdeckte bleibende Karte der KI | `HiddenCard` | Rückseite mit „verdeckt“, einzeln, ihr Platz in Forges Reihenfolge |
| eigene verdeckte Karte | `VisibleCard` mit `faceDown` | so, wie Forge sie zeigt, „verdeckt“ |
| Bibliotheken | nur `library` (Anzahl) | Zahl |
| Karten beider Decks (`game.started.cardNames`) | Liste ohne Besitzer | nicht benutzt |

Die Rückseite ist OpenManas eigene (Token-Farben, Symbol), nie die von Wizards.

## 5. Stapel und Kampf

- **Stapel** in Forges Reihenfolge – der erste Eintrag ist der oberste (Forges
  `MagicStack` fügt vorne an; nachgesehen), markiert „oben“. Je Eintrag: wer
  ihn gespielt hat („Du“/„Forge-KI“ aus `player`), „ausgelöst“, Forges Text,
  die Ziele (Karten mit ihrem Namen vom Tisch, Spieler als „dich“/„Forge-KI“).
- Die Karte eines **Zaubers** auf dem Stapel liegt in Forges Stapelzone, die
  das Protokoll nicht schickt: für Zauber gibt es nur Forges Beschreibung, für
  Fähigkeiten auch die Quelle auf dem Tisch (Befund §11.4, für Prompt 16).
- **Kampf:** je Angreifer, wen er angreift (Spieler oder Planeswalker/Schlacht:
  `defenderKind`) und wer ihn blockt („ungeblockt“ sagt, dass der Schaden
  durchgeht – Anvil-Lehre). Gleiche ungeblockte Angreifer gegen dasselbe Ziel
  teilen eine Zeile („13 × Goblin Token greift Forge-KI an – ungeblockt“); auf
  dem Spielfeld liegen sie einzeln. Angreifende und blockende Karten tragen
  Schwert bzw. Schild in ihrer Leiste.

## 6. Entscheidung, Menü, Meldungen

- **Entscheidung:** Forges Anweisungszeile (`prompt`), je offener Frage ihre Art
  („Mulligan“, „Priorität“, „Kosten bezahlen“ …) und Forges Text, wenn er von
  der Anweisung abweicht, und die Antworten, die Forge anbietet – als Marken,
  nicht als Knöpfe, mit dem Satz „Hier kannst du noch nicht antworten – nur die
  Partie verfolgen und im Menü aufgeben.“ Beantworten ist Prompt 15/16.
- **Menü** (Knopf links im Kopf, 44 px auf Touch): Paarung (Decks, Format, das
  von Forge bestätigte KI-Profil), „Meldungen von Forge“, die Seiten der App
  („Die Partie läuft weiter, wenn du eine andere Seite öffnest. Neu laden oder
  Schließen beendet sie.“) und „Aufgeben“ → Bestätigung „Partie aufgeben?“ →
  „Aufgeben“ / „Weiterspielen“ (wie seit Prompt 11). „Aufgeben“ liegt bewusst
  nicht offen auf dem Tisch (Design-System Regel 5).
- **Meldungen:** Jede Meldung, die Forge während der Partie schickt (Hinweis,
  Fehler, abgelehnte Eingabe), erscheint **oben** als Hinweis (die Hand bleibt
  frei) und bleibt im Menü; der Menüknopf nennt ihre Zahl. Die Sitzung zählt
  sie (`noticeCount`), damit nur neue als Hinweis kommen.

## 7. Vollbild

`useImmersive(true)` auf der laufenden Partie; die App-Hülle blendet
Seitenleiste, Kopf- und Tab-Leiste aus und gibt der Seite `h-dvh`. Endet die
Partie (Ergebnis, Abbruch) oder verlässt der Spieler die Seite, ist der Rahmen
wieder da – die Ergebnisseite steht wie bisher im App-Rahmen mit „Neue Partie“
in der Aktionsleiste. Der Wechsel geschieht vor dem ersten Zeichnen
(Layout-Effekt), ohne Flackern.

## 8. Keine Regeln im Client

| Was der Tisch zeigt | woher |
|---|---|
| wer du bist, wer am Zug ist, wer Priorität hat | `me`, `activePlayer`, `hasPriority` |
| Reihe einer Karte | ob Forge `power`/`toughness` schickt |
| Stapel gleicher Karten | Gleichheit aller Werte, die Forge schickt |
| Anhängsel beim Träger | `attachedTo` |
| getappt, Schaden, Marken, Stärke | Forges Werte, unverändert (kein „verbleibende Widerstandskraft“) |
| Kommandeursteuer, -schaden | `commanders[].tax`, `.damage` (Forge bzw. Bridge) |
| Stapel, Ziele, Kampf | `stack`, `combat` |

Nicht gezeigt, weil es spätere Prompts aus Forges Zustand bauen:
Einsatzbereitschaft (`sick`, Prompt 18/23), spielbare Karten und was ein Tipp
täte (`playable`, `action`, Prompt 14/16), Hervorhebungen (`highlighted`,
Prompt 14/17).

## 9. Tests

| Datei | Tests | Was |
|---|---:|---|
| `src/game/table-model.test.ts` | 15 | die echten Szenen bestehen die Protokollprüfung; Eröffnung (Sitzplätze aus `me`, 7 offene Karten, KI-Hand nur gezählt); Hauptphase (6 Gebirge als Stapel, getappter Wald allein, 2 getappte Riesenspinnen als Stapel); Stapel (Forges Text, Ziel vom Tisch, Zauberkarte nicht sichtbar); Kampf (Paarungen, Kampfkarten nie gestapelt); Verteidigen; späte Commander-Runde (9 Gebirge als Stapel, 14 Angreifer einzeln, Gift, Steuer, Schaden); Effektkarten der Kommandozone; gebaut: Aura des Gegners auf eigener Kreatur, Anhängsel ohne Träger, verdeckte Karten und aufgedeckte Handkarte, Stapel nur bei gleichen Werten, von Fragen genannte Karten, Stapelreihenfolge, Mana und Marken |
| `src/game/table-cards.test.ts` | 6 | Schlüssel (Spielsteine mit Werten), Auflösung am echten Mini-Katalog: je Schlüssel einmal, deutsches/englisches Bild, `srcset`, Rückseite einer verwandelten Karte, kein Bild bei mehrdeutigen Spielsteinen, fehlenden Karten, Forge-Effekten, Forge-only; eindeutiger Spielstein mit Bild |
| `src/game/game-table.test.tsx` | 18 | alle Bereiche benannt, Kopf, KI-Hand nur als Rückseiten, eigene Hand mit Forges Namen, Leben/Zonen/Profil, Partner-Kommandeure mit Namen, Gift und Kommandeur, zwei Reihen mit Stapelanzahl, getappt, Schaden, Angriff/Block, Kommandozone, leere Felder, Stapel, Kampfzeilen (auch 13 gleiche), leerer Stapel, Entscheidung ohne Knöpfe, Bilder mit `srcset`, Platzhalter |
| `src/game/table-labels.test.ts` | 6 | Marken deutsch (auch Schlüsselwort-Marken), fremde englisch markiert; Faktenleiste (Loyalitätsmarken nicht doppelt), gesprochene Fakten, Tooltip-Reihenfolge; Namen; Ziele („dich“), Angriffs- und Blockzeilen mit Planeswalker als Ziel |
| `src/game/game-page.test.tsx` | 18 (2 neu, 4 angepasst) | laufende Partie als Tisch: Regionen, Menü (Paarung, Meldungen, Navigation), Aufgeben aus dem Menü mit Bestätigung, „Weiterspielen“ sendet nichts; Meldungen als Hinweis oben und im Menü; Abbruch, stumme Engine, zurück zur laufenden Partie |
| `src/app/immersive.test.tsx` | 3 | Vollbild ohne Seitenleiste, Kopf- und Tab-Leiste; Rahmen zurück beim Verlassen; andere Seiten behalten ihn |
| `src/engine/engine-session.test.ts` | (1 erweitert) | `noticeCount` zählt jede Meldung, nicht die Anweisung, auch über die 20 gehaltenen hinaus |

**Echte Szenen:** `scripts/record-table-scenes.ts` nimmt aus den Mitschnitten der
Differenztests (`engine/scripts/test-engine.sh`, JVM, regelfreier Testspieler;
`engine/build/report/transcripts/*.messages.jsonl`) sieben Momente nach festen
Regeln aus den strukturierten Nachrichten – Eröffnung, Hauptphase, Zauber auf dem
Stapel, Doppelblock, eigener Block, späte Commander-Runde, Effektkarten – und
faltet die Nachrichten wie die Sitzung (Zustand, offene Fragen, Anweisung,
Meldungen). Unverändert Forges Ausgabe (Engine von `e618079`, Forge `ed0333fecb`,
Protokoll 4); jede Szene besteht die Protokollprüfung.

**End-to-End** (`scripts/e2e/run.ts`):
- Abschnitt 10 (echte Engine, echte Partien) jetzt am Tisch: Commander- und
  Constructed-Partie am Desktop mit Katalog (Tisch füllt das Fenster, kein Rahmen,
  alle Bereiche im Bild, Hand offen mit echten Bildern, KI-Hand nur Rückseiten,
  Kommandeur mit Bild in der Kommandozone), Fenster hochkant/quer/zurück ohne
  Wirkung auf die Partie, durchs Menü in die App und zurück, Aufgeben aus dem
  Menü; am Handy (mit eingerichteten Kartendaten) hochkant und gedreht, 44-px-Menü.
- Abschnitt 11 liest das bestätigte KI-Profil vom Tisch.
- **Abschnitt 12 neu:** Die sieben echten Szenen im echten Tischcode (Prüfstand
  `scripts/e2e/table-harness.html` über den Dev-Server, Katalog wie in der App
  eingerichtet) in sechs Größen – Handy 412×915, Handy quer 915×412, kleines Handy
  360×740, Foldable 884×1104, Tablet quer 1104×884, Desktop 1440×900: die Seite
  rollt nie, jeder Bereich im Fenster, Spielfelder ≥ 80 px und gleich hoch, jede
  Karte in ihrer Reihe, mit 14 Angreifern rollt am Handy eine Reihe seitwärts,
  Bilder geladen (keines gescheitert), Menü ≥ 44 px auf Touch, axe-core, ein
  Bildschirmfoto je Größe und Szene.

## 10. Nachweise

Alle auf `eb8e0ab`, sauberer Arbeitsbaum (die App meldet keine lokalen Änderungen).

### 10.1 `npm run check` (8 min 2 s)

Erzeugte Dateien = Schemas, `tsc -b` (App, Tests, Werkzeuge), `oxlint` ohne Befund, **559
Vitest-Tests** grün (510 bestehende + 49 neue, §9), dann der End-to-End-Test: **„E2E OK“, 0
Befunde**, Chrome 153, echte Engine `42f3bf1c7706cec5`, echter Kartenkatalog, echte Scryfall-API.
Alle bisherigen Abschnitte grün, 10 und 11 jetzt am Tisch.

### 10.2 Live-Partien am Tisch (Abschnitte 10 und 11)

| Schritt | Ergebnis |
|---|---|
| Vorwärmen, Commander-Spiegelpartie („E2E Brawl“) starten | „Bereit“ nach 6,4 s; **0,85 s** vom Klick bis zur ersten Entscheidung (Mulligan: „Behalten“/„Mulligan“) |
| Tisch am Desktop (1440×900) | kein App-Rahmen, keine Seite rollt, alle acht Bereiche im Fenster, beide Spielfelder 359 px; je Spieler 40 Leben, Hand 7, Bibliothek 52, Kommandozone 1, nichts auf dem Spielfeld; deine Hand 7 Karten offen, die KI-Hand 7 Rückseiten ohne ein einziges Bild; **9 Kartenbilder geladen**, keines gescheitert; der Kommandeur in der Kommandozone mit Bild („Valki, Gott der Lügen“); axe 0 |
| Fenster 884×1104 (hochkant), 1104×884 (quer), zurück | Tisch neu ausgelegt (Spielfelder 347 bzw. 352 px), dieselbe Frage offen, keine zweite Engine |
| Menü → „Decks“ → Seitenleiste „Spielen“ → „Zur laufenden Partie“ | Menü axe 0; außerhalb der Partie ist der App-Rahmen zurück; der Tisch zeigt dieselbe Partie |
| Aufgeben aus dem Menü | Bestätigung (axe 0) → „Verloren“, „Du hast aufgegeben.“; nächste Engine vorgewärmt |
| Constructed gegen „zufällig“ | **0,84 s** bis zur ersten Entscheidung; je 20 Leben, Hand 7, Bibliothek 53; das Menü nennt „E2E Deutsch (Kopie) (zufällig gezogen)“ |
| Fehlerwege (frisches Profil) | gescheiterter Engine-Download und abgelehntes Deck wie bisher; „Neue Partie“ nach dem Fehler bis zur Entscheidung 6,9 s; nie zwei Engines (5 erzeugt, höchstens 1) |
| Handy 412×915 (Touch, Kartendaten in 4,1 s eingerichtet) | 0,90 s bis zur Entscheidung; kein Rahmen, nichts rollt, Spielfelder 254 px, Hand 128 px, Menü **48 px**; 6 Bilder geladen, eine Karte mit Forges Worten (Forge-only „A-“-Karte), axe 0 |
| Handy gedreht (915×412) | Spielfelder 130 px, Hand 96 px, alles im Bild, axe 0; zurück hochkant dieselbe Frage |
| Ergebnis am Handy | „Neue Partie“ 48 px in der Aktionsleiste direkt über der Tab-Leiste (Rahmen zurück) |
| Einstellungen (11) | Tisch nennt „Waghalsig“ als Forges Bestätigung, „Waghalsig (zufällig)“ bei Zufall; 0,86 s bis zur Entscheidung |

### 10.3 Echte Szenen in sechs Größen (Abschnitt 12)

Sieben aufgezeichnete Zustände (§9) im echten Tischcode, Katalog wie in der App eingerichtet:

| Größe | kleinstes Spielfeld (Szene) | rollende Reihe bei 14 Angreifern | Menü |
|---|---:|---|---:|
| Handy 412×915 | 173 px (Stapel) | ja | 48 px |
| Handy quer 915×412 | 120 px (Commander spät) | ja | 48 px |
| kleines Handy 360×740 | 112 px (Commander spät) | ja | 48 px |
| Foldable 884×1104 | 286 px (Stapel) | ja | 48 px |
| Tablet quer 1104×884 | 342 px (Commander spät) | ja | 48 px |
| Desktop 1440×900 | 349 px (Commander spät) | ja | – (Maus) |

In allen 42 Kombinationen: die Seite rollt nie, jeder Bereich im Fenster, beide Spielfelder gleich
hoch und ≥ 80 px, jede Karte in ihrer Reihe; **127 Bilder geladen, 0 gescheitert**, 32 Karten mit
Forges Worten (die mehrdeutigen Goblin-Spielsteine, Forges Effektkarten), 1 außerhalb des Bildes noch
nicht geladen (lädt beim Rollen); **axe-core: 0 Befunde** (keine Stufe). 42 Bildschirmfotos
(`reports/e2e/screens/table-*.png`).

### 10.4 Engine, frischer Klon

- Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, **80/80** Unit-Tests (Protokoll,
  Client, Worker-Host). `test-engine.sh` nicht erneut: `engine/` ist unverändert, die
  ausgelieferten Artefakte sind die geprüften von `e618079`.
- Frischer Klon von `eb8e0ab`: `npm ci` 4,6 s; `npm run build` scheitert laut („no engine build
  in …; build it with: bash engine/scripts/build.sh“); mit `OPENMANA_ENGINE=omit
  OPENMANA_CARDS=omit` baut er; **559 Tests grün**.

### 10.5 Kosten

- **Start-JavaScript** (Skripte und Modulvorladungen der `index.html`, gzip -9, beide Stände
  gleich gebaut): 228,5 → **229,7 KB** (+1,2 KB: Vollbild-Umschalter in der App-Hülle,
  Meldungszähler).
- **Nachgeladen:** Partie-Seite 4,6 → **12,1 KB** gzip (der Tisch, sein Modell, Wörter,
  Bildauflösung, Raster und Karten) – erst beim Start einer Partie bzw. beim Aufruf von
  `/play/game`.
- **Bilder:** je Karte Scryfalls kleines (146 px) oder großes (488 px) WebP nach Größe auf dem
  Bildschirm; nur was ins Bild kommt, lädt.

## 11. Befunde

### 11.1 Unsichtbare Texte ließen die Seite rollen

Bei der späten Commander-Szene rollte die ganze Seite auf 1540 × 3421 px, obwohl
jeder Bereich innen rollen sollte: Die Screenreader-Texte (`sr-only`, absolut
positioniert) in seitwärts rollenden Reihen hatten keinen positionierten
Vorfahren; ihr Bezugsrahmen war die Seite, und dort lagen sie weit rechts
außerhalb jeder Reihe – der Überlauf einer Reihe beschneidet sie dann nicht.
Reihen, Bereiche und das Raster sind jetzt positioniert (`relative`); der E2E
prüft in jeder Größe und Szene, dass die Seite nicht rollt.

### 11.2 Querformat: gleich hohe Spielfelder

Erst standen die Spielerleisten im Querformat in eigenen Rasterzeilen neben den
Feldern; eine dreizeilige KI-Leiste (Commander) machte ihr Feld dann 50 px höher
als deines. Jetzt steht die KI neben dem Kopf und du neben der Hand; die Felder
teilen sich zwei `1fr`-Zeilen und sind exakt gleich hoch (E2E prüft es).

### 11.3 Forges deutsche Texte sind teils englisch

Forge liefert Stapelbeschreibungen aus den Kartenskripten englisch
(„Magmastrahl (14) deals 2 damage to Goblin-Brandstifter (55)“), einige
Anweisungen unübersetzt („Select creatures to attack …“) und Knöpfe wie „Call
Back“, „Auto“, „Cancel“. Der Tisch zeigt Forges Worte wie gesendet (Regel seit
Prompt 11: nie Prosa umschreiben oder parsen); die eigenen Beschriftungen der
Entscheidungsarten sind deutsch. Übersetzungslücken gehören upstream; Prompt
15/16 kann Knöpfe nach `purpose` eigenständig deutsch beschriften.

### 11.4 Zauber auf dem Stapel haben keine Karte im Protokoll

`StackItem.source` nennt die Id der Quelle; ein Zauber liegt aber in Forges
Stapelzone, die das Protokoll nicht schickt – der Tisch kann für ihn nur Forges
Beschreibung zeigen, kein Bild. Vorschlag für Prompt 16: `StackItem.card`
(`VisibleCard` der Quelle, wie bei Fragen) mit Protokoll 5.

### 11.5 Spielsteine eines Namens

Scryfall führt mehrere Spielsteine gleichen Namens mit gleicher Stärke,
Widerstandskraft und Farbe (Goblin 1/1 rot: ohne Text, „kann nicht blocken“,
„greift jeden Kampf an“). Forges Werte allein entscheiden das nicht; der Tisch
zeigt dann Forges Worte statt eines womöglich falschen Bildes. Eine eindeutige
Zuordnung bräuchte Forges Spielstein-Skript bzw. dessen Druck (Kandidat für
Prompt 14/20).

### 11.6 Was der erste Gesamtlauf fand

Der erste `npm run check` (vor dem Commit) fand fünf Dinge, alle behoben:
- **Kleines Handy (360×740):** in der späten Commander-Szene nur 68 px je Spielfeld – die
  KI-Leiste war mit Rückseiten-Reihe und zweizeiliger Kommandeur-Zeile 124 px hoch, die
  Entscheidung 149 px. Jetzt: Rückseiten der KI-Hand nur bei breiter Leiste (aufgedeckte Karten
  immer; die Zahl steht daneben), Kommandeursteuer und -schaden als kurze Stücke (Name nur bei
  Partnern), Stapel/Kampf, Entscheidung und Hand nach der Bildschirmhöhe (`clamp(…dvh…)`) → 112 px.
- **Abgebrochene Bildanfragen** im Handy-Querformat (`net::ERR_ABORTED`): Das Spielfeld maß seine
  Höhe erst nach dem ersten Zeichnen und stellte von zwei auf eine Reihe um; der Browser verwarf
  die schon begonnenen kleinen Bilder und nahm größere. Jetzt misst es vor dem ersten Zeichnen.
- **axe im einblendenden Menü:** Kontrast „zu schwach“, gemessen mitten in der Einblend-Animation
  des Menüs (halb durchsichtig). Der Test wartet jetzt das Ende der Animationen ab.

### 11.7 Weiteres

- Angreifer sind während der Erklärung noch ungetappt (Forge tappt beim
  Bestätigen) – der Tisch zeigt Forges Stand.
- Forges Kommandozone enthält auch Effektkarten („Stomp (54)'s Effect“ eines
  Abenteuers) – gezeigt wie gesendet, mit Forges Namen.
- jsdom hat kein Layout: Ob ein Feld eine oder zwei Reihen hat, misst der
  Browser; Unit-Tests sehen den Standard (zwei), der E2E die echten Maße.
- Ein unveränderter Test aus Prompt 12 (`preferences.test.tsx`, „reads the stored
  preferences …“) schlug in einem von sechs vollen Vitest-Läufen unter Last
  einmal fehl und lief in den übrigen fünf grün; nicht verändert, beobachtet.

## 12. Entscheidungen und Abweichungen

- **Vollbild mit eigenem Menü** statt Tisch im App-Rahmen (Design-System §4 hatte
  es vorgesehen): Auf dem Handy kosteten Kopf- und Tab-Leiste 120 px der Höhe.
- **Antworten sichtbar, nicht bedienbar:** Prompt 15 baut die Entscheidungen, 16
  die Priorität; 13 zeigt Forges Frage ehrlich als noch nicht beantwortbar.
  Deshalb erreicht die Live-Partie im E2E nur Forges erste Entscheidung, und das
  volle Spielfeld wird mit echten, aufgezeichneten Zuständen im echten Tischcode
  geprüft (Abschnitt 12) – keine erfundenen Daten, keine Attrappe der Engine.
- **Der Tisch ist eine reine Ansicht** eines Zustands (Menü, Warnungen kommen
  als Teile von außen): Prompt 22 (Wiedergabe) kann ihn für aufgezeichnete
  Zustände benutzen.
- **Stapel gleicher Karten** schon jetzt (Anvil hatte sie): Ohne sie bräuchte die
  späte Commander-Seite am Handy 25 Plätze in zwei Reihen. Genannte Karten
  bleiben einzeln, damit Prompt 14–19 jede davon einzeln bedienen können.
- **Kampfzeilen gebündelt**, Kampfkarten auf dem Feld einzeln.
- **Gebaut, aber noch nicht gezeigt:** Einsatzbereitschaft, spielbare Karten,
  Hervorhebungen (§8) – ihre Darstellung ist Sache von 14/17/18/23.
- **Ansicht der Zonen** (Friedhof, Exil durchblättern) und die große Kartenansicht
  sind Prompt 20; der Tisch zeigt deren Größen und die Kommandozone.

## 13. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Karten ansehen und bedienen, Zustände „spielbar/ausgewählt/hervorgehoben“ | 14 |
| Entscheidungen beantworten (Mulligan, Knöpfe, Auswahl …) | 15 |
| Priorität, Phasenleiste, Stapel mit Karten; `StackItem.card` im Protokoll (§11.4) | 16 |
| Ziele und Kosten auf dem Tisch hervorheben | 17 |
| Angreifer/Blocker bedienen, Einsatzbereitschaft zeigen | 18, 19, 23 |
| Friedhof, Exil, Kommandozone durchblättern, große Kartenansicht | 20 |
| Verlauf aus Forges Spielprotokoll | 21 |
| Wiedergabe aufgezeichneter Partien mit diesem Tisch | 22 |
| Feinschliff aller Größen (Handy quer, sehr kleine Geräte) | 24 |
| Spielstein-Bilder eindeutig (§11.5) | 14/20 |

## 14. Reproduzieren

```bash
npm ci
bash engine/scripts/build.sh      # Engine (einmal, ~6 min), falls noch nicht gebaut
npm run cards:build               # Katalog (~45 s)
npm run check                     # Schemas, tsc, oxlint, Vitest, E2E (Abschnitte 10–12; braucht Internet: Scryfall)
npx vitest run src/game src/app/immersive.test.tsx
# neue echte Szenen nach einem Engine-Test (engine/scripts/test-engine.sh):
node scripts/record-table-scenes.ts
```

In der App: Decks importieren → Spielen → „Partie starten“ → der Tisch; Menü →
„Aufgeben“. Den Prüfstand zeigt ein Dev-Server unter
`/scripts/e2e/table-harness.html?scene=commander-late`.

## 15. Was als Nächstes kommt

Prompt **14 — Cards, hand and safe interaction** (PENDING, nicht begonnen: je Lauf
genau ein Prompt).
