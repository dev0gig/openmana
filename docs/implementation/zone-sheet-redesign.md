# Zonenansicht neu gestaltet (14.10.2026)

Wunsch des Projektinhabers vom 14.10.2026, außerhalb der nummerierten Prompts. Beschreibung des Ergebnisses: `docs/design/SPIELTISCH.md` §4.20.

## Ergebnis

- **Umschalter statt großer Knöpfe:** zwei shadcn-`ToggleGroup`s – „Du“/„Forge-KI“ und „Friedhof“/„Exil“/„Kommando“/„Stapel“, die Zahlen als `Badge`. Die Namen nennen Spieler, Zone und Zahl („Dein Friedhof: 6 Karten“, „Stapel, gemeinsam: 1 Eintrag“). Leere Zonen sind gedämpft, bleiben aber wählbar (per Tastatur erreichbar, ihre Leere lesbar). Der Stapel gehört beiden: Während er gezeigt wird, ist kein Spieler gewählt; ein Spielerknopf führt zu dessen zuletzt gezeigter Zone zurück.
- **Raster ganzer Kartenbilder:** `CardTile` (`src/components/ui/card-tile.tsx`, shadcn-artig gebaut) mit `TablePicture` (`sizes="auto"`, ohne Bild Name und Typzeile in Kartenform). Spalten über Container-Queries nach der Breite des Sheets: 2 / 3 ab 24 rem / 4 ab 36 rem / 5 ab 42 rem; das seitliche Sheet wird dafür nach Bildschirmbreite auf `max-w-xl`/`2xl`/`3xl` verbreitert. Jede Kachel ist ein Knopf von mindestens 44 px.
- **Gruppen „×N“:** gleiche Karten werden genau so zusammengefasst wie die Stapel des Spielfelds – alle Werte Forges gleich (`cardSignature`, jetzt aus `table-model.ts` exportiert) und keine Karte, die eine offene Frage, der Stapel oder der Kampf nennt (`namedCardIds`). Der Stapel wird nie gruppiert.
- **Forges Markierung:** `cardUse` entscheidet wie am Tisch; „nutzbar“ ist der goldene Rahmen um das Bild (`GAME_CARD_MARKS` aus `game-card.tsx`, jetzt exportiert), nie auf dem Bild. Forges Angebot steht im Namen und `title` der Kachel statt in einer eigenen Zeile. Die Zonenansicht tippt nie.
- **Ruhiger Kopf und leerer Zustand:** nur Titel und Zahl; eine leere Zone zeigt das shadcn-`Empty` mit `Layers`-Symbol. Der Hinweis auf verdeckte Karten und die Stapel-Reihenfolge bleiben, kurz.
- **Blättern:** Eine Kachel öffnet die Kartenansicht mit der Zone als Quelle; sie blättert in der Reihenfolge des Rasters (`browseIds` → `zoneBrowseIds` in `src/game/zone-model.ts`, eine Gruppe Karte für Karte). Die Kartenansicht konnte Zonen schon blättern (Prompt 20/50, Knöpfe, Pfeiltasten, Wischen); neu ist nur die Reihenfolge und die Berücksichtigung der offenen Fragen beim Gruppieren. Die Hand bleibt in Forges Reihenfolge und ungruppiert.

## Befund zur Reihenfolge

Geprüft im Quelltext des gesperrten Forge-Stands (`engine/build/publish-52h/work/forge`) und der Brücke:

- `StateBuilder` sendet je Zone `PlayerView.getCards(zone)`; das ist `CardView.getCollection(zone.getCards(false))`, also Forges `cardList` in ihrer Reihenfolge.
- `Zone.add(card, index)` hängt ohne Position an (`cardList.add(c)`). `GameAction.moveToGraveyard` und `exile` geben keine Position mit (`moveTo(zone, c, cause, params)` → `position = null`); `moveTo(ZoneType, c, libPosition, …)` verwendet die Position nur für die Bibliothek. Karten, die gleichzeitig wandern, kommen in der Reihenfolge, die ihr Spieler gewählt hat (`orderMoveToZoneList`).
- Ausnahme: Forges `ReorderZone`-Effekt ordnet einen Friedhof neu; im Kartenbestand nutzen ihn nur Fossil Find und Search for Survivors (zufällig). Danach nennt „zuletzt“ die oberste Karte des Friedhofs, nicht zwingend die zuletzt hinzugekommene.
- Die Kommandozone ist nicht chronologisch: `Zone.add` setzt einen Kommandeur an den Anfang (Index 0, bei Oathbreaker die Signaturkarte an Index 1).

Folge: Friedhof und Exil werden neueste zuerst gezeigt, die neueste Kachel trägt das Abzeichen „zuletzt“ (nur bei mehr als einer sichtbaren Karte, nie bei einer verdeckten neuesten Karte). Kommandozone und Stapel behalten Forges Reihenfolge ohne Abzeichen.

## Prüfung

`npx tsc -b && npx oxlint && npx vitest run` (Tests: `src/game/zone-sheet.test.tsx`, `src/game/zone-model.test.ts`, angepasst `src/game/card-view.test.tsx`). Der Ende-zu-Ende-Lauf `scripts/e2e/run.ts --zones-only` wurde auf die Radios des Umschalters umgestellt, in diesem Auftrag aber nicht ausgeführt; ebenso kein `npm run check`, kein Engine-Bau.
