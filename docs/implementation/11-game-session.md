# 11 — Spielsitzung

> Umsetzung von [`prompts/queue/11-game-session.md`](../../prompts/queue/11-game-session.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Implementierung
> `679fbfb`; alle Nachweise liefen auf diesem Stand (sauberer Arbeitsbaum, die App meldet keine
> lokalen Änderungen). Grundlage: [`docs/BIBLE.md`](../BIBLE.md) §2, §6 (Partie, Wiederaufnahme),
> §7, §9, §16, [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md),
> [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md) §3.2–§4 und §8
> (ein Worker, Vorwärmen, frischer Worker je Partie, Neuladen beendet die Partie), das Protokoll
> ([`engine/protocol/README.md`](../../engine/protocol/README.md)), die Deckwahl (Prompt 10) und das
> Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Code: `src/engine/engine-session.ts`
> (Sitzung), `src/game/` (Partie), `src/routes/play-page.tsx`, `scripts/e2e/run.ts` (Abschnitt 10).
> Messungen auf odin (Intel i7-8700T, 12 Threads, Debian 13), Node 22.22.3, Chrome for Testing 153
> headless.

## Ergebnis

**Prompt 11 ist umgesetzt.** Die gespeicherten Decks spielen jetzt eine
**echte Partie gegen die Forge-KI** – Forge als WebAssembly im Browser, ohne
Server:

- **Vorwärmen:** Öffnet der Spieler „Spielen“ und hat er Decks, startet die
  Engine von selbst (sichtbar im Engine-Kasten). Meist ist sie bereit, bevor
  die Deckwahl steht; „Partie starten“ wartet dann nicht.
- **Start:** „Partie starten“ zieht das Deck der KI (bei „zufällig“ für jede
  Partie neu), gibt beide Decks als Daten an Forge (das Protokoll-`Deck` mit
  den Namen, die Forge kennt – keine Datei, kein Server) und führt zur Seite
  **„Partie“ (`/play/game`)**. Der Knopf geht, was die Engine auch gerade tut:
  Lädt sie noch, beginnt die Partie, sobald sie bereit ist; ist sie
  gescheitert, startet eine frische.
- **Ausdrückliche Zustände** der Partie, jeder mit einem Weg weiter:
  *wird vorbereitet* (Startschritte der Engine mit Zeit, „Abbrechen“),
  *Forge baut die Partie auf*, *Partie läuft*, *Ergebnis*, *nicht begonnen*
  (Forge hat abgelehnt, mit Forges Bericht) und *abgebrochen / konnte nicht
  starten* (technischer Abbruch, mit Grund). Eine stumme Engine meldet der
  Wächter nach 30 s („Die Engine reagiert seit … nicht“), mit „Partie
  beenden“. Nichts davon sieht wie eine eingefrorene Oberfläche aus.
- **Die laufende Partie** zeigt Forges eigenen Stand – Zug, Schritt, wer am Zug
  ist, Lebenspunkte und Zonengrößen beider Spieler, die Entscheidung, auf die
  Forge wartet, mit Forges deutscher Anweisung („Starthand behalten?“) und
  seinen Antworten („Behalten“, „Mulligan“), Forges Meldungen – und lässt sich
  **nach Bestätigung aufgeben**. Karten und Entscheidungen bedient der
  Spieltisch ab Prompt 13; bis dahin sagt die Seite genau das.
- **Ergebnis** in einem großen Wort („Gewonnen“, „Verloren“, „Unentschieden“,
  aus Forges `result`), dazu der Grund, Lebenspunkte, Züge, Dauer und „Neue
  Partie“. Die Engine der beendeten Partie wird freigegeben (eine Partie je
  Worker) und die nächste gleich vorgewärmt.
- **Neuladen oder Schließen** beendet eine laufende Partie – der Browser fragt
  vorher, und die Seite sagt es, bevor und nachdem es passiert (Bible §6).
- Keine Attrappen: Ohne Engine im Build oder in einem Browser, der sie nicht
  ausführen kann, bleibt „Partie starten“ gesperrt und sagt warum.

**Nachweise:** siehe §9 – Typecheck, oxlint, Frische der erzeugten Dateien,
**468 Vitest-Tests** (50 neu, die Sitzung und die Seiten mit dem **echten**
`EngineClient` über einem geskripteten Worker), `npm run check` mit dem
End-to-End-Test im echten Chrome und der echten Engine (Abschnitt 10 neu:
Vorwärmen, Commander- und Constructed-Partie, Aufgeben, Ergebnis, frische Engine,
Neuladen, gescheiterter Engine-Download, abgelehntes Deck, Handy). Engine
unverändert. Kein Blocker.

## 1. Was gebaut wurde

```
src/engine/
├── engine-session.ts          die Sitzung: Engine (Worker) UND Partie in einem Zustand; vorwärmen, starten, aufgeben, abbrechen
├── engine-session-context.tsx eine Sitzung für die App; Warnung vor dem Verlassen während einer Partie; Abbruch-Toast
├── engine-panel.tsx           Engine-Kasten: neu „Spielt“ (keine „Beenden“-Taste während einer Partie), Sprache von Forge; BootSteps geteilt
└── engine-labels.ts           + ENGINE_LANGUAGE_LABELS
src/game/
├── engine-deck.ts             DeckRecord → Protokoll-Deck (auch vom E2E-Test in Node benutzt)
├── match-setup.ts             die nächste Partie aus der Deckwahl: KI-Deck ziehen, Seed, Namen, KI-Profil
├── game-start.ts              Start-Knopf: ob, was er sagt, was er tut (Spielen-Seite und „Neue Partie“)
├── game-labels.ts             deutsche Wörter: Schritte, Ergebnis, Grund, Ablehnung, Frageart, Antworten
└── game-page.tsx              /play/game (nachgeladen): alle Zustände der Partie
src/routes/play-page.tsx       vorwärmen, echter Start, „Eine Partie läuft“ / „Zur laufenden Partie“
src/app/router.tsx             Route play/game (lazy, unter „Spielen“ in der Navigation)
src/test/game-fixtures.ts      Test-Engine: echter EngineClient über geskriptetem Worker, Nachrichten nach echtem Ablauf
scripts/e2e/run.ts             Abschnitt 10 „Game session“; /play/game in den Oberflächen
scripts/e2e/engine-decks.ts    nimmt die Deck-Übergabe der App (engine-deck.ts) und ihre Sprache
```

## 2. Ablauf und Zustände

Die Sitzung (`EngineSession`) führt **zwei Dinge in einem Zustand**, die
zusammen wechseln: die **Engine** (der Worker) und die **Partie**. Getrennt wären
es zwei Wahrheiten über denselben Worker; zusammen kann nichts auseinanderlaufen.

```
Engine:  idle ──boot──▶ booting ──engine.ready──▶ ready ──match.start──▶ busy ──match.finished──▶ idle (Worker freigegeben)
            ▲              │                         ▲                      │
            └── stop ──────┴──── engine.abort ───────┼──────────────────────┴──▶ aborted ──start/Partie──▶ booting
                                                     └── engine.error (deck-rejected, invalid-request): derselbe Worker
Partie:  queued ──(Engine bereit)──▶ starting ──game.started──▶ playing ──game.end──▶ over (+ match.finished: summary)
            │                          │  engine.error                  │
            │                          └────────────────▶ refused       │ engine.abort / stop / „Partie beenden“
            └── engine.abort ──────────────────────────────────────────▶ aborted (ohne Ergebnis)
```

| Partie | kommt von | zeigt | Weg weiter |
|---|---|---|---|
| `queued` | „Partie starten“, Engine lädt noch oder startet | Startschritte der Engine mit Zeit, nach 30 s „dauert länger als üblich“ | „Abbrechen“ (Engine lädt weiter) |
| `starting` | Engine bereit, `match.start` gesendet | „Forge baut die Partie auf“ | Wächter nach 30 s: „Partie beenden“ |
| `refused` | `engine.error` | Titel je Code, Forges Bericht (unbekannte Karten, Deck), Rat, technische Meldung | „Zur Deckwahl“, „Deck ansehen“; die Engine bleibt bereit |
| `playing` | `game.started` | Zug · Schritt · wer am Zug ist; je Spieler Lebenspunkte und Zonengrößen; Forges Entscheidung (Anweisung, Art, angebotene Antworten); Forges Meldungen | „Aufgeben“ (bestätigt); Wächter: „Partie beenden“ |
| `over` | `game.end` (+ `match.finished`) | „Gewonnen“/„Verloren“/„Unentschieden“, Grund, Lebenspunkte, Züge, Dauer | „Neue Partie“, „Zur Deckwahl“ |
| `aborted` | `engine.abort` (Engine, Client, Spieler) | „Partie abgebrochen“ bzw. „konnte nicht starten“, Abbruchgrund und -meldung, letzter Stand | „Neue Partie“ (frische Engine), „Zur Deckwahl“ |

- **Eine Partie je Worker** (Research §4: Forges Zustand ist statisch): Nach
  `match.finished` gibt die Sitzung den Worker frei; die nächste Partie bootet
  einen frischen. Kommt eine neue Partie, bevor der alte Worker seine
  Zusammenfassung geschickt hat, wird er sofort freigegeben (das Ergebnis steht
  schon). Nie laufen zwei Engines zugleich (je ~1 GB) – der E2E-Test zählt die
  Worker.
- Nach `engine.error` mit `deck-rejected`/`invalid-request` hat Forge die
  Partie nie begonnen; **derselbe Worker nimmt die nächste** (Protokoll). Bei
  den übrigen Codes wird er freigegeben.
- Die Sitzung führt nur, was der geprüfte Client meldet: jede Nachricht hat
  Schema, Reihenfolge und Fragen-Lebenszyklus schon im `EngineClient` bestanden.
  Ein Verstoß ist dort ein technischer Abbruch – nie ein Spielereignis.

## 3. Vorwärmen

- Die Spielen-Seite ruft `prewarm()` auf, sobald die Decks gelesen sind und es
  **mindestens ein Deck** gibt – noch bevor die Wahl steht (die Seite ist die
  Deckwahl, Research §4: „vorgewärmt, sobald die Deckauswahl offen ist“). Ohne
  Deck lädt nichts (1 GB Speicher und ~12,5 MB Download für nichts).
- Nach einer beendeten Partie wärmt die Partie-Seite die nächste Engine vor,
  solange eine neue Partie möglich ist („Neue Partie“ oder „Zur Deckwahl“
  folgen fast immer).
- `prewarm()` wirkt **nur aus `idle`**: nie eine zweite Engine, und nie ein
  stilles Wiederholen einer gescheiterten (der Spieler sieht den Fehler und
  entscheidet). Beendet der Spieler die Engine im Engine-Kasten, startet sie
  auf derselben Seite nicht von selbst neu.

## 4. Decks an Forge (`engine-deck.ts`, `match-setup.ts`)

- **Deck:** je Eintrag `{card: DeckCard.name, count}` – der Name, den Forge
  kennt (Prompt 09) –, Hauptdeck, Sideboard (mit dem Gefährten, dort sucht Forge
  ihn), Kommandeur; leere Abschnitte fallen weg. Kein Druck, keine Scryfall-Id:
  Forge wählt seinen eigenen Druck, die Anzeige bleibt beim Katalog.
- **Format** der Partie = Format des Spieler-Decks (Forge spielt beide in einem;
  die Deckwahl sichert, dass sie passen).
- **KI-Deck „zufällig“** wird beim Start **jeder** Partie neu gezogen
  (`drawAiDeck`, aus den Decks des Formats außer dem eigenen) und in der Partie
  als „zufällig gezogen“ genannt.
- **Namen:** Forge nennt die Spieler „Spieler“ und „Forge-KI“ (sein Spielprotokoll
  benutzt sie, „Spieler hat aufgegeben“); die Oberfläche sagt „Du“ und
  „Forge-KI“ und erkennt die Seiten an `me`, nie am Namen.
- **KI-Profil:** Forges Vorgabe `Default` („Standard“); die Wahl ist Prompt 12.
- **Seed:** Die App zieht ihn selbst – 48 Zufallsbits aus
  `crypto.getRandomValues` (so viel behält `java.util.Random`, mit dem Forge ihn
  benutzt) – und übergibt ihn in `MatchRequest.seed`. Jede Partie bekommt einen
  eigenen; weil die App ihn kennt, kann die Aufzeichnung (Prompt 22) ihn
  speichern, und Seed plus Eingaben spielen eine Partie genau nach (Prompts
  02–05).
- Die Anfrage wird vor dem Senden gegen das Protokoll geprüft
  (`checkMatchRequest` im Client); passt sie nicht, ist das eine sichtbare
  Ablehnung (`invalid-request`), kein Hänger.

## 5. Sprache von Forge

Die App startet die Engine jetzt ausdrücklich mit
`--card-loading=eager --language=de-DE` (`ENGINE_ARGS`). **Kartenladen** wie
Prompt 04 es verlangt („die Oberfläche übergibt den Modus ausdrücklich“).
**Deutsch**, weil der Spieler ab jetzt Forges eigene Sätze liest (Anweisung,
Antworten, Meldungen) und das Design-System für alles Gelesene Deutsch
verlangt; Prompt 04/05 hatten belegt, dass die Sprache nur Forges Wörter
ändert, nie die Partie (Spur deutsch = englisch). Der Engine-Kasten zeigt die
Sprache. Ob es je eine Einstellung dafür gibt, entscheidet Prompt 12.

## 6. Fehler und wie sie aussehen

| Was | Wo es auffällt | Was der Spieler sieht |
|---|---|---|
| Build ohne Engine / Browser ohne Voraussetzungen | vor jedem Laden | „Partie starten“ gesperrt mit Grund (nach der Deckwahl); Engine-Kasten erklärt |
| Engine-Download oder Start scheitert | `engine.abort` (`boot-failed`, …) | Engine-Kasten „Abgebrochen“ + Toast; Start-Knopf „wird dafür neu gestartet“; eine wartende Partie: „konnte nicht starten“ mit Grund |
| Client lässt sich nicht nachladen | Sitzung | wie oben (`boot-failed`, `client-load`) |
| Forge lehnt ein Deck ab | `engine.error` `deck-rejected` | „Die Partie hat nicht begonnen“, „Forge kennt 2 Karten aus „…“ nicht: …“, Rat, Link zum Deck; Engine bleibt bereit |
| Anfrage passt nicht zum Protokoll | Client, vor dem Senden | Ablehnung `invalid-request` mit technischer Meldung |
| Engine schweigt 30 s | Wächter des Clients | „Die Engine reagiert seit 30,0 s nicht“, warten oder „Partie beenden“ (bestätigt) |
| Engine/Worker fällt während der Partie aus | `engine.abort` | „Partie abgebrochen“, Grund, letzter Stand, „Neue Partie“ |
| Nachricht verletzt das Protokoll | Client | technischer Abbruch `protocol-violation`, nie ein Spielereignis |
| Aufgeben geht nicht | Client (`EngineInputError`) oder Engine (`input.rejected`) | Toast bzw. Meldung in der Partie; der Knopf wird wieder frei |
| Neuladen/Schließen während einer Partie | `beforeunload` | Rückfrage des Browsers; danach „Gerade läuft keine Partie … endet, wenn du die Seite neu lädst“ |

## 7. Oberfläche

- **Nur shadcn-Bausteine und Tokens** (`Card`, `Alert`, `AlertDialog`, `Badge`,
  `Button`, `Empty`, `Item`, `Skeleton`, `Spinner`, `FactList`, `ActionBar`);
  keine neue Komponente, keine neue Farbe. Das Ergebniswort ist Cinzel groß in
  Gold (Sieg), Rot (Niederlage) oder Text (Unentschieden) – Anvils Lehre „am
  Ende einer Partie steht groß gewonnen oder verloren“.
- **Aufgeben** braucht zwei Schritte (Anvil: ein danebengegangener Tipp beendete
  dort einmal eine Partie): „Aufgeben“ → „Partie aufgeben? … lässt sich nicht
  rückgängig machen“ → „Aufgeben“; „Weiterspielen“ sendet nichts.
- **Am Handy** steht „Neue Partie“ nach dem Ende in der `ActionBar` über der
  Tab-Leiste; „Aufgeben“ bewusst **nicht** (eine feste Leiste lädt zu
  versehentlichen Tipps ein).
- **Screenreader:** ein unsichtbarer Live-Bereich sagt die Zustandswechsel an
  („Partie läuft“, „Partie beendet: Verloren“). Lade-Kreisel neben Text sind
  ausgeblendet (sein „Lädt“ landete sonst im Knopfnamen: „Lädt Gibt auf …“).
- **Spielen-Seite:** läuft eine Partie, sagt sie das und der Knopf heißt „Zur
  laufenden Partie“; der Engine-Kasten zeigt „Spielt“ mit „Zur Partie“ und
  bietet kein „Engine beenden“ an (das beendete die Partie).
- Die Partie bleibt in der App erhalten, während der Spieler andere Seiten
  besucht; nur Neuladen/Schließen beendet sie.

## 8. Tests

| Datei | Tests | Was |
|---|---:|---|
| `src/engine/engine-session.test.ts` | 26 | Engine (wie bisher, jetzt über den echten Client): nicht enthalten, nicht unterstützt, Startphasen, Start-Argumente, Abbruch und Neustart, Beenden, späte Nachrichten, Nachladefehler; Vorwärmen nur aus `idle`, nie nach einem Fehler. Partie: Start auf bereiter Engine bis Ergebnis (genaue Anfrage, `busy`, Zustand, Fragen, Anweisung, Warten, Aufgeben genau einmal, Ergebnis, Zusammenfassung, Worker freigegeben); Warten auf bootende Engine; Bereit-Zeitlimit beendet die wartende Partie; Boot für eine Partie und nach einem Abbruch; Ablehnung mit Bericht und derselbe Worker; Ablehnung, die den Worker unbrauchbar macht; ungültige Anfrage vor dem Senden; keine zweite Partie; Abbruch während der Partie mit letztem Stand; Protokollverstoß = Abbruch; Wächter (stumm, wieder da, „Partie beenden“); Beenden storniert bzw. bricht ab; Abbrechen der wartenden Partie; nächste Partie vor der Zusammenfassung; Freigabe einer stummen beendeten Engine; Meldungen (begrenzt) und abgelehntes Aufgeben; Aufgeben nur in laufender Partie |
| `src/game/game-page.test.tsx` | 13 | Spielen-Seite: vorwärmen und mit den gewählten Decks starten (genaue `match.start`-Anfrage, Zufallsdeck, Seed); vorwärmen schon vor der Wahl, Deck-Grund zuerst; kein Laden ohne Deck; Browser ohne Voraussetzungen; zurück zur laufenden Partie statt einer zweiten. Partie-Seite: ohne Partie; laufende Partie (Spieler, Zahlen, Entscheidung, Forges Anweisung und Antworten, Verlassen-Warnung, Aufgeben mit Bestätigung, „Weiterspielen“ sendet nichts, Ergebnis, frische Engine vorgewärmt, „Neue Partie“); Ablehnung mit Bericht und Deck-Link, derselbe Worker danach; Abbruch während der Partie (auch als Toast); Engine scheitert beim Start, auch ein zweites Mal (ein Toast ersetzt den anderen); stumme Engine und „Partie beenden“; Abbrechen der wartenden Partie; Handy mit „Neue Partie“ in der Aktionsleiste |
| `src/game/match-setup.test.ts` | 9 | Protokoll-Deck Eintrag für Eintrag, Gefährte nur im Sideboard, Kommandeur, leere Abschnitte; gültige Anfrage mit Namen und Profil; Seed 48 Bit; KI-Deck gewählt, zufällig (je Partie neu, nie das eigene), Spiegelpartie, Commander; keine Partie bei offener Wahl |
| `src/game/game-start.test.ts` | 4 | Start-Knopf je Engine-Zustand, zurück zur laufenden Partie, beendete/abgelehnte Partie hält nichts auf, Gründe in Reihenfolge (Decks, dann Engine) |
| `src/game/game-labels.test.ts` | 6 | jedes Protokoll-Wort hat ein deutsches (Schritte, Ergebnisse, Ablehnungen, Frage- und Knopfarten); Ergebniswort; Grund; Antworten (Mulligan, Münzwurf); Züge/Dauer/Profil |
| `src/app/app.test.tsx` | (3 geändert) | Engine-Kasten über den echten Client: Sprache „Deutsch“, Beenden terminiert den Worker |
| `src/decks/deck-library.test.tsx` | (3 geändert) | stehen beide Decks fest, nennt der Start-Knopf die Engine (jsdom kann sie nicht ausführen) |

Die Test-Engine (`src/test/game-fixtures.ts`) ist der **echte** `EngineClient`
über einem geskripteten Worker: Jede Nachricht der Tests besteht dieselbe
Schema- und Reihenfolgeprüfung wie im Browser, Eingaben landen in der echten
SharedArrayBuffer-Warteschlange und werden dort gelesen. Die Nachrichten folgen
dem Ablauf, den die echte Engine beim Spielstart und Aufgeben schickte (in Node
mitgeschnitten, §10.1).

## 9. Nachweise

Alle auf `679fbfb`, sauberer Arbeitsbaum.

### 9.1 `npm run check` (365 s, Lastmittel 1,3–1,9)

Erzeugte Dateien = Schemas, `tsc -b` (App, Tests, Werkzeuge), `oxlint` ohne
Befund, **468 Vitest-Tests** grün (418 bestehende + 50 neue, §8), dann der
End-to-End-Test: **„E2E OK“, 0 Fehler**, Chrome 153, echte Engine
`0c82db80023ac0cc`, echter Kartenkatalog, echte Scryfall-API. Alle bisherigen
Abschnitte unverändert grün, dazu `/play/game` ohne Partie in den drei Größen
(kein Überlauf, axe 0 Befunde, isoliert).

### 9.2 End-to-End, Abschnitt 10 „Game session“

Auf den Decks aus Abschnitt 8/9 (desktop, dasselbe Profil):

| Schritt | Ergebnis |
|---|---|
| „Spielen“ öffnen (Decks da, kein Klick) | Engine wärmt vor, **„Bereit“ nach 5,4 s**; Start-Knopf „Forge ist bereit.“; Engine-Kasten: Sprache von Forge „Deutsch“, Karten „vollständig geladen“ |
| Commander-Spiegelpartie („E2E Brawl“) starten | **0,87 s** vom Klick bis zur ersten Entscheidung; in diesem Lauf gewann der Spieler den Münzwurf: „Spieler, du hast den Münzwurf gewonnen. Willst du lieber zuerst spielen oder ziehen?“, Antworten „Spielen“/„Ziehen“; je Spieler 40 Lebenspunkte, Hand 0, Bibliothek 59, Kommandozone 1; axe 0, kein Überlauf |
| Durch die App (Decks → Spielen) und zurück | „Eine Partie läuft“, Engine-Kasten „Spielt“ ohne „Engine beenden“, „Zur laufenden Partie“ führt zur selben Partie |
| Aufgeben | Bestätigungsdialog (axe 0) → **„Verloren“**, „Du hast aufgegeben.“, „Du (E2E Brawl) 40 Lebenspunkte“ (axe 0); die verbrauchte Engine wird beendet, die nächste vorgewärmt |
| Constructed gegen „zufällig“ | **0,85 s** bis zur ersten Entscheidung (vorgewärmt); hier der Mulligan („Behalten“/„Mulligan“), je 20 Lebenspunkte, Hand 7, Bibliothek 53; die KI zog „E2E Deutsch (Kopie)“ (zufällig gezogen) |
| Neuladen während der Partie | Chrome fragt (`beforeunload`), danach „Gerade läuft keine Partie“; **nie mehr als eine Engine zugleich** (2 erzeugt, höchstens 1 lebend) |

Frisches Profil (Fehlerwege):

| Schritt | Ergebnis |
|---|---|
| Engine-Download scheitert (HTTP 500 für das Wasm-Modul, per Playwright) | Vorwärmen: Engine-Kasten „Abgebrochen“, „Die Engine konnte nicht starten“, Toast; Start-Knopf bleibt nutzbar („wird dafür neu gestartet“); „Partie starten“ → „Die Partie konnte nicht starten“ mit dem Grund der Engine („the Wasm module could not be instantiated: … 500 Internal Server Error“, axe 0) |
| Modul wieder erreichbar, „Neue Partie“ | frische Engine, Partie läuft nach **5,8 s** (kalter Start inkl. Engine) → aufgegeben |
| Deck mit unbekannter Karte | „Die Partie hat nicht begonnen“: „Forge kennt eine Karte aus „E2E Unbekannt“ nicht: No Such Card Of E2E.“, Link „Deck ansehen“ (axe 0); die Engine bleibt „Bereit“, die nächste Partie läuft **auf demselben Worker** (kein neues `engine-worker.js`) |
| Worker insgesamt | 5 erzeugt, höchstens 1 zugleich |

Handy (412 × 915, Touch): Start 0,84 s; kein Überlauf; „Aufgeben“ 48 px;
Ergebnis: „Neue Partie“ 48 px in der Aktionsleiste **direkt über der
Tab-Leiste**, nicht zusätzlich in der Karte; axe 0 (laufend und Ergebnis).

Abschnitt 8 spielt weiter jedes importierte Deck in der echten Engine (Node),
jetzt mit der Deck-Übergabe der App (`engine-deck.ts`) und Deutsch: 4 Decks,
0 Befunde, Engine bereit nach 6,8–6,9 s, Partie 61–79 ms danach gestartet.

### 9.3 Engine, frischer Klon

- Engine unverändert: erzeugte Protokolldateien = Schema, `tsc`, **80/80**
  Unit-Tests (Protokoll, Client, Worker-Host). `test-engine.sh` nicht erneut:
  `engine/` ist unverändert, die ausgelieferten Artefakte sind die geprüften
  von `0ddfbc3`.
- Frischer Klon von `679fbfb`: `npm ci` 4,3 s; `npm run build` scheitert laut
  („no engine build in …; build it with: bash engine/scripts/build.sh“); mit
  `OPENMANA_ENGINE=omit OPENMANA_CARDS=omit` baut er in 1,0 s; **468 Tests grün**.

### 9.4 Kosten

- **Start-JavaScript** (Vite-Angabe, gzip, beide Stände gleich gebaut):
  222,1 → **229,1 KB** (+7,0 KB: Sitzung mit Partie-Zuständen, Start-Knopf,
  Partie-Plan, deutsche Texte; React + Router unverändert 99,4 KB). Rolldown
  teilt den Start jetzt in mehrere vorgeladene Stücke (die nachgeladene
  Partie-Seite teilt Bausteine mit der Startseite).
- **Nachgeladen:** Partie-Seite **4,7 KB** gzip, erst beim Start einer Partie
  bzw. beim Aufruf von `/play/game`.
- **Speicher:** nie mehr als eine Engine (~1 GB); vorgewärmt wird nur mit
  Decks und nur aus `idle`.

## 10. Befunde

### 10.1 Forges Anweisung kommt nach der Frage

Beim Mulligan schickt Forge zuerst die Knopf-Frage – **ohne Text** – und
danach die Anweisungszeile als eigene Nachricht (`message`, `prompt`:
„Forge-KI beginnt.. Spieler, Du startest 2te.  Starthand behalten?“), dann
`engine.waiting`. Die Sitzung hält deshalb die letzte Anweisung (`prompt`, eine
leere löscht sie) neben den offenen Fragen; die Seite zeigt sie über den
Antworten. Mitschnitt aus der echten Engine (Node, Seed 5):
`game.started` → drei `state` → `question` (buttons, mulligan, Text leer) →
`message prompt` → `engine.waiting` → (Aufgeben) → leerer `prompt` →
`question.withdrawn` → `events` („Spieler hat aufgegeben“, „Forge-KI hat gewonnen
weil alle Gegner besiegt wurden“) → `state` → `game.end` (`AllOpponentsLost`,
`conceded`) → `match.finished`.

### 10.2 Der Münzwurf kommt vor dem Mulligan

Welche Entscheidung zuerst kommt, hängt am Münzwurf – und damit am Seed, den
die App je Partie neu zieht. Gewinnt die KI, beginnt es mit dem Mulligan (Hand
7). **Gewinnt der Spieler, fragt Forge zuerst** „Spieler, du hast den Münzwurf
gewonnen. Willst du lieber zuerst spielen oder ziehen?“ mit den Knöpfen
„Spielen“/„Ziehen“ – **ohne `purpose`** (die Seite nennt es deshalb allgemein
„Entscheidung“) und **bevor die Starthände gezogen sind** (Hand 0, Bibliothek
60 bzw. 59 plus Kommandeur). Gefunden vom E2E-Test, der zunächst fest den
Mulligan erwartete; er prüft jetzt beide echten Anfänge und dass Hand plus
Bibliothek das Deck ergeben. Für Prompt 15/16: diese Frage hat noch keinen
eigenen Zweck im Protokoll.

### 10.3 Forges deutsche Texte sind Forges

Die deutschen Sätze stammen aus Forges Sprachdatei, samt ihrer Eigenheiten
(„beginnt..“, „2te“, doppelte Leerzeichen). Die App zeigt sie unverändert – sie
sind Forges Wort zur aktuellen Entscheidung; Übersetzungslücken gehören
upstream (wie „Forest“, Prompt 04).

### 10.4 Weiteres

- **Gestapelte Fehler-Toasts:** Scheiterte der Engine-Start zweimal (Vorwärmen,
  dann der Start), standen zwei gleiche Toasts übereinander; der hintere ist bei
  sonner halb durchsichtig, axe meldete zu wenig Kontrast. Der Abbruch-Toast hat
  jetzt eine feste Id: ein neuer ersetzt den alten.
- **Die Aktionsleiste schwebte auf kurzen Seiten:** `sticky` klebt nur, wenn
  die Seite länger als der Bildschirm ist; auf der kurzen Ergebnisseite stand
  „Neue Partie“ mitten im Bild. Jetzt füllt die Seitenspalte (`Page`) die
  Höhe zwischen Kopf- und Tab-Leiste, die Leiste rückt ans Ende (`mt-auto`,
  `-mb-6` gegen das Polster der Spalte) – auf jeder Seite an derselben Stelle.
- **Testfalle Playwright:** Ein Ganzseiten-Screenshot setzt in Chromes
  Handy-Emulation die Touch-Eigenschaft zurück (`pointer: coarse` danach
  falsch) – danach gemessene Knöpfe waren 40 statt 48 px hoch. Der Test misst
  deshalb vor Ganzseiten-Screenshots und nimmt mittendrin nur den ersten
  Bildschirm auf.
- **Zeitabhängige Prüfung aus Prompt 10:** Der E2E-Schritt „Exportieren“ ließ
  axe laufen, während das „Mehr“-Menü noch ausblendete (Radix hält es 100 ms
  halbtransparent im DOM) – mal grün, mal „color-contrast“. Der Helfer wartet
  jetzt, bis das Menü weg ist.
- Nach jeder Partie schreibt Forge im Worker `NoSuchFileException:
  /openmana/home/.forge/achievements/constructed.xml` (seine Erfolge lassen sich
  im Web Image nicht speichern) – harmlos, nur in der Worker-Konsole, auf JVM
  und Wasm gleich.
- Ein Lade-Kreisel (`Spinner`, `role="status"`, „Lädt“) in einem Knopf gibt
  diesem Knopf seinen Namen mit („Lädt Gibt auf …“) – neben sichtbarem Text
  jetzt `aria-hidden` (vom Seitentest gefunden).
- Nach dem Aufgeben wartet Forge nicht mehr; die Sitzung liest den
  Wartezustand nach dem Senden frisch vom Client (vom Sitzungstest gefunden: sie
  zeigte sonst weiter „Du bist dran“).

## 11. Entscheidungen und Abweichungen

- **Keine Legalitätsprüfung vor dem Start** (09/10 hatten Forges
  `DeckFormat.getDeckConformanceProblem` für 11 vorgeschlagen): Forge liefert
  dort nur **englische Satzbruchstücke** („is not selected“, „has too many
  commanders“; upstream selbst vermerkt „Needs localization“). Sie deutsch zu
  zeigen hieße, Forges Prosa zu parsen (Bible §16) oder die Regeln in der Bridge
  nachzubauen; englisch zu zeigen bräche die Sprachregel. Forges eigene Lobby
  warnt übrigens nur und lässt „Ignorieren“ zu. Bis Forge strukturierte oder
  übersetzte Befunde hat, spielt Forge jedes Deck, das es bauen kann (wie seit
  05 dokumentiert). Dazu gehört: Arenas Brawl-Decks (60 Karten mit Kommandeur,
  Format `commander` seit 09) spielt Forge als **Commander** (40 Leben), nicht
  als Brawl – das Protokoll kennt nur `constructed`/`commander`.
- **Die App wählt den Seed** (§4) statt `null`: Forge nutzt dann
  `java.util.Random` statt `SecureRandom` – für Mischen und Züge einer
  Freizeitpartie gleichwertig, und der Seed wird aufzeichenbar (22).
- **Vorwärmen erst mit Decks** und nur aus `idle`; kein Leerlauf-Timeout, der
  eine vorgewärmte Engine wieder beendet (der Engine-Kasten kann es, Android
  verwirft Hintergrund-Tabs ohnehin).
- **Hinweise am Start-Knopf in Einrichtungsreihenfolge:** erst die Decks, dann
  die Engine – der Engine-Kasten daneben erklärt Browser-Probleme ausführlich.
- **Engine und Partie in einer Sitzung** (§2) statt einer zweiten Klasse daneben:
  die bestehende `EngineSession` erweitert.
- **Partie-Seite als eigene Route** `/play/game` (nachgeladen) im App-Rahmen;
  den Vollbild-Spieltisch baut Prompt 13 dort.
- **Einzige Eingabe in 11 ist das Aufgeben.** Mulligan, Priorität, Karten usw.
  sind Prompts 13–19; die Seite zeigt Forges Frage und sagt, dass die Bedienung
  mit dem Spieltisch kommt. Anvils „Aufgeben und neue Partie“ in einem Dialog ist
  nicht übernommen (nach dem Aufgeben ist „Neue Partie“ einen Tipp entfernt).
- **Keine Aufzeichnung** der Partie (Prompt 22) – `MatchSetup` hält aber schon,
  was sie braucht (Kopie beider Decks, Seed, Profil, Deck-Ids).
- **Neuladen beendet die Partie**, mit Rückfrage (`beforeunload`) und Hinweis –
  Research §8 „Empfehlung v1“, Bible §6 (Wiederaufnahme erst nach MVP).

## 12. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Spieltisch: Karten, Hand, Zonen, Stapel | 13, 14, 20 |
| Entscheidungen beantworten (Mulligan, Knöpfe, Auswahl …), Priorität, Ziele, Kosten, Kampf | 15–19 |
| KI-Profil wählen, Sprache als Einstellung | 12 |
| Verlauf aus Forges Spielprotokoll (`events` kommen an, werden noch nicht gezeigt) | 21 |
| Partie aufzeichnen (Seed, Decks, Eingaben, Zustände) | 22 |
| Deck-Legalität aus Forge (braucht strukturierte oder übersetzte Befunde) | offen, Kandidat für 23 oder upstream |
| Brawl als eigenes Format (Protokoll kennt nur Constructed/Commander) | offen (neue Protokollversion) |
| „Aufgeben und neue Partie“ in einem Schritt (Anvil) | 30 |
| Wiederaufnahme nach Neuladen | nach MVP (Bible §6) |
| Messung von Vorwärmen und Start auf dem Fold7 | 24 bzw. mit der ersten Auslieferung (31) |

## 13. Reproduzieren

```bash
npm ci
bash engine/scripts/build.sh      # Engine (einmal, ~6 min), falls noch nicht gebaut
npm run cards:build               # Katalog (~45 s)
npm run check                     # Schemas, tsc, oxlint, Vitest, E2E (braucht Internet: Scryfall)
npx vitest run src/engine src/game
```

In der App: Decks importieren → Spielen (die Engine lädt von selbst) → Decks
wählen → „Partie starten“ → „Aufgeben“ → „Neue Partie“.

## 14. Was als Nächstes kommt

Prompt **12 — AI profiles and settings** (PENDING, nicht begonnen: je Lauf genau
ein Prompt).
