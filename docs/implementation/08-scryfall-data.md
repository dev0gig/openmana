# 08 — Scryfall-Kartendaten

> Umsetzung von [`prompts/queue/08-scryfall-data.md`](../../prompts/queue/08-scryfall-data.md),
> Stand **2026-09-25**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `45f57d7` (sauberer Arbeitsbaum; die App meldet keine lokalen Änderungen). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §2, §4, §14, §15, §17, [`docs/ANVIL_LESSONS.md`](../ANVIL_LESSONS.md),
> die lokale Datenschicht aus Prompt 07 und das Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
> Code: `cards/` (Katalog-Erzeugung), `src/cards/` (Kartendaten in der App), `vite/card-assets.ts`
> (Katalog im Build), `src/storage/` (Schema-Version 2), `scripts/generate-schemas.ts`,
> `scripts/e2e/run.ts`. Scryfall-Regeln geprüft am 2026-09-25 auf https://scryfall.com/docs/api.
> Messungen auf odin (Intel i7-8700T, 12 Threads, Debian 13), Node 22.22.3, Chrome for Testing 153
> headless.

## Ergebnis

**Prompt 08 ist umgesetzt.** OpenMana hat einen **Kartenkatalog**: für jede
Karte (jede Oracle-Identität) die englischen Seiten, den gedruckten deutschen
Text, die Drucke, deren Bild gezeigt wird, und die Namen der Forge-Karten, die
diese Karte sind. Er entsteht zur Bauzeit aus Scryfalls Massendaten
(`all_cards`, jeder Druck in jeder Sprache) und Forges Kartendatenbank, kommt
wie die Engine geprüft (Größe + SHA-256) mit der App und wird im Browser
**einmal je Version** in IndexedDB eingerichtet. Danach laufen Namenssuche und
Anzeige ohne jede Anfrage an Scryfalls API; die Bilder lädt der Browser bei
Bedarf direkt von Scryfalls Bildserver.

- **Stabile Identität für Forge:** Jede Katalogkarte nennt die Forge-Karten,
  die sie ist (33 740 von 33 978 Forge-Skripten zugeordnet, über Name,
  Seitenname, aufgedruckten Alias oder – wo ein Name mehrdeutig ist – Forges
  eigene Set-Dateien). Die übrigen 238 (230 neu ausbalancierte Arena-Karten
  „A-…“, die Scryfall nicht führt, und 8 begründete Ausnahmen) stehen als
  „Forge-Karten ohne Scryfall-Daten“ im Katalog: spielbar, angezeigt mit Forges
  eigenem Text. Eine neue, unerklärte Lücke stoppt den Katalog-Bau.
- **Deutsch zuerst, sauberer Rückfall:** deutscher Name, Typzeile und
  Regeltext je Seite, wo Scryfall sie hat, sonst Englisch – Feld für Feld und
  immer als Englisch gekennzeichnet; deutsches Bild, wo es ein echtes gibt
  (Scryfalls Platzhalter zählen nie), sonst das englische. 30 849 Karten haben
  deutschen Text, 24 929 ein deutsches Bild.
- **Doppelseitige Karten und Druckvarianten:** Seiten mit eigenen Farben,
  Bildern je Seite und Wenden; Split-, Abenteuer-, Flip- und Meld-Karten;
  Schlüssel der Engine (`VisibleCard.key`, der englische Name der gezeigten
  Seite) finden die richtige Seite; Spielsteine über Name, Stärke/
  Widerstandskraft und Farben (oder ehrlich „mehrdeutig“). Unter vielen Drucken
  wählt der Katalog feste, begründete Standarddrucke; einen bestimmten Druck
  (Set + Sammlernummer aus einem Deck) holt `src/cards/prints.ts` gezielt bei
  Scryfall und merkt ihn sich 30 Tage.
- **Scryfalls Regeln eingehalten:** Massendaten für Namen und Bilder,
  API nur für einzelne Drucke (Accept-Header, 2 bzw. 10 Anfragen je Sekunde,
  30 s Pause nach HTTP 429 ohne Wiederholung, Zwischenspeicher), Bilder
  vollständig und unverändert, Nennung in den Credits ohne Logo und ohne
  Anschein einer Unterstützung.
- **COEP/CORS:** Scryfalls Bilder haben kein `Cross-Origin-Resource-Policy`;
  unter COEP `require-corp` laden sie nur im CORS-Modus. Der neue Baustein
  `CardPicture` lädt sie so (und ohne Referrer); der E2E-Test zeigt, dass
  dasselbe Bild ohne CORS-Modus blockiert würde.
- **Versionen und Zwischenspeicher:** Katalog-Manifest mit Scryfall-Stand,
  Quelldatei-SHA-256, Forge-Commit und Zählungen; die Einstellungen zeigen
  Stand, Umfang und Zustand auf dem Gerät („nicht eingerichtet“,
  „unvollständig“, „veraltet“ – dann weiter nutzbar –, „bereit“) und richten
  ein oder aktualisieren mit Fortschritt, abbrechbar.
- **Klare Zustände für fehlende Daten:** kein deutsches Bild, kein deutscher
  Text, keine deutsche Fassung, kein Bild, Bild lädt nicht (offline),
  Forge-Karte ohne Scryfall-Daten, unbekannte Karte, Kartendaten nicht
  eingerichtet, Version ohne Kartendaten – jeweils eigener deutscher Hinweis,
  nie ein leerer Kasten.

**Nachweise:** siehe §10 – Typecheck, oxlint, Frische der erzeugten Dateien,
Unit- und Komponententests (mit einem kleinen **echten** Katalog aus 46
Scryfall-Kartenobjekten und echten Forge-Skripten), der echte Katalog-Bau gegen
die vollständigen Scryfall- und Forge-Daten und der erweiterte End-to-End-Test
im echten Chrome (Einrichten in echte IndexedDB, echte Scryfall-Bilder unter
COEP). Kein Blocker.

## 1. Was gebaut wurde

```
cards/
├── README.md                     Bau, Format, Aktualisierung, Scryfall-Regeln
├── forge-unmatched.json          Forge-Karten ohne Scryfall-Karte, je mit Grund (8)
├── scripts/
│   ├── build-catalog.ts          npm run cards:build: Eingaben holen/zwischenspeichern, bauen, prüfen, schreiben
│   ├── catalog.ts                CatalogBuilder: Druckwahl, deutscher Text, Aliasse, Namensschlüssel, Forge-Abgleich
│   ├── forge-cards.ts            Forges Kartenskripte (Name, CopyFaceFrom, Split) und Set-Dateien lesen
│   ├── scryfall-bulk.ts          Bulk-Index, all_cards-Datei (Stream, geprüft), Set-Liste
│   ├── fixtures.ts               kleiner echter Katalog für Tests
│   └── *.test.ts                 Katalog- und Forge-Leser-Tests
├── fixtures/                     46 Scryfall-Kartenobjekte (gekürzt), Sets, Forge-Skripte, Ausnahmeliste
└── build/                        (ignoriert) cache/ Scryfall-Downloads, dist/ Katalog + Manifest + Bericht
src/cards/
├── scryfall/scryfall.schema.json was OpenMana von Scryfall liest (→ generated/)
├── names.ts                      Namensschlüssel (Katalog-Bau und App gemeinsam)
├── images.ts                     Bild-URLs aus Druck-Id, Seite, Größe, Zeitstempel; Prüfung
├── scryfall-print.ts             ein Scryfall-Druck → Bildangaben, übersetzter Text (Bau und App gemeinsam)
├── card-assets(.ts|-types.ts)    der Katalog dieses Builds (virtual:openmana-cards)
├── catalog-state.ts              was das Gerät hat (cacheIndex)
├── catalog-install.ts            einrichten: Platz, Download, SHA-256, Entpacken, Prüfen, Schreiben
├── card-lookup.ts                Namen, Oracle-Id, Engine-Schlüssel, Spielsteine, Sets
├── card-display.ts               was gezeigt wird: deutsch/englisch je Feld, Bild, Seite
├── scryfall-client.ts            API-Client mit Scryfalls Ratenlimits
├── prints.ts                     bestimmte Drucke holen und 30 Tage merken
├── errors.ts, card-labels.ts     CardDataError, deutsche Texte
├── card-catalog-context.tsx      Zustand für die ganze App, Einrichten mit Fortschritt
├── card-data-card.tsx            Einstellungen: Karte „Kartendaten“
├── card-lookup-dialog.tsx        „Karte nachschlagen“
├── card-details.tsx              eine Karte anzeigen
└── *.test.ts(x)
src/components/ui/card-picture.tsx  Kartenbild (shadcn-Bauweise), dazu aspect-ratio.tsx, progress.tsx (Registry)
vite/card-assets.ts                 Katalog prüfen und ausliefern (wie vite/engine-assets.ts)
scripts/generate-schemas.ts         vorher generate-storage.ts: jetzt drei Ziele (lokale Daten, Katalogzeilen, Scryfall)
```

Die **Einstellungen** haben die neue Karte „Kartendaten“; die **Credits**
nennen Scryfall als Quelle der Kartendaten und -bilder und Wizards of the
Coast als Rechteinhaber. Die Datenbank ist jetzt **Schema-Version 2** (§3).

## 2. Architekturentscheidung und Branchenstandard

**Frage:** Woher kommen deutsche Namen, Texte und Bilder, ohne dass jede
Anzeige Scryfalls API fragt?

| Weg | Bewertung |
|---|---|
| API je Anzeige | von Scryfall ausdrücklich ausgeschlossen („If you need to rapidly look up card names … or resolve a large number of card images, you must use the bulk data files“), offline unbrauchbar |
| Browser lädt Massendaten selbst | `oracle_cards` (24,6 MB gzip) ist nur Englisch; deutsch steht nur in `all_cards` (393 MB gzip) – im Browser, erst recht am Handy, nicht machbar |
| API je Deck (collection + Suche `lang:de`) + Zwischenspeicher | wenig Übertragung, aber deutsche Namen beim Import nicht auffindbar, Karten aus dem Spiel (Spielsteine, Zufallskarten) bräuchten jedes Mal das Netz |
| **Zur Bauzeit aus `all_cards` einen Katalog erzeugen, mit der App ausliefern, im Browser einmal einrichten** | **gewählt.** Der übliche Weg für Programme ohne eigenen Server (Cockatrice baut seine Kartendatenbank aus Massendaten; Deckbauer-Seiten spiegeln Scryfalls Massendaten serverseitig). Offline nutzbar, deutsche Namen suchbar, genau passend zu Forges Kartenstand |

Der Katalog ist **kein Wiederveröffentlichen** von Scryfall-Daten: er ist ein
interner Bestandteil der App (nicht im Repository, kein öffentlicher
Datensatz), abgeleitet und auf Anzeige und Suche zugeschnitten; OpenMana ist
das „zusätzliche Programm“, für das Scryfall seine Daten bereitstellt.

Weitere Wahlen: **JSON Lines + gzip** mit Kopf- und Endzeile (dasselbe Muster
wie die Sicherung aus 07, streamfähig, `DecompressionStream` in jedem
Browser); **ein Datensatz je Oracle-Identität** statt je Druck (36 156 statt
542 689, Bildadressen aus Id + Zeitstempel statt gespeicherter URLs); **Web
Locks** gegen zwei gleichzeitig einrichtende Tabs; **Bilder direkt von
Scryfalls Bildserver** im HTTP-Cache des Browsers (ein Jahr `max-age`),
eigenes Offline-Vorhalten erst mit dem Service Worker (Prompt 25).

## 3. Datenbank: Schema-Version 2

Migration 2 (Zwischenspeicher dürfen geleert werden, Nutzerdaten bleiben
unangetastet – ein echter Test mit einer Datenbank aus Prompt 07 belegt es):

| Store | Schlüssel | Indizes | Inhalt |
|---|---|---|---|
| `scryfallCards` (neu aufgebaut) | `oracleId` | `nameKeys` (mehrfach) | `CardRecord`: eine Karte des Katalogs |
| `scryfallPrints` (neu) | `id` | `print` `[set, collectorNumber, lang]`, `oracleId` | `PrintRecord`: ein bestimmter Druck, von der API geholt |
| `scryfallSets` (neu) | `code` | `arenaCode`, `forgeCodes` (mehrfach) | `SetRecord`: Set mit Arena- und Forge-Codes |
| `forgeOnlyCards` (neu) | `name` | `nameKeys` (mehrfach) | Forge-Karte ohne Scryfall-Daten, mit Grund |
| `cacheIndex` (geleert) | `key` | wie bisher | Eintrag `card-catalog` (partial/complete, Version, Zahl), „gibt es nicht“-Merker für Drucke |

Alle vier sind Zwischenspeicher: nie in Sicherungen, bei Bedarf neu geladen.
Ältere Sicherungen (Schema 1) laden unverändert (die Nutzer-Stores ändern sich
nicht; E2E-Test lädt eine Sicherung mit Schema 1).

`CardRecord` (vollständig im Schema beschrieben):

| Feld | Inhalt |
|---|---|
| `oracleId`, `name`, `layout` | Scryfalls Oracle-Id, englischer Oracle-Name („Vorder // Rück“ bei mehreren Seiten), Layout |
| `faces[]` | englische Seiten: Name, Manakosten (fehlend = keine; `{0}` bleibt `{0}`), Typzeile, Regeltext, Stärke/Widerstandskraft/Loyalität/Verteidigung, eigene Farben |
| `manaValue`, `colors`, `colorIdentity` | für Sortierung und Suche; keine Regel-Aussage |
| `forgeNames[]` | die Forge-Karten, die diese Karte sind (leer: Forge kennt sie nicht) |
| `nameKeys[]` | alle Namen, unter denen sie gefunden wird |
| `de` | gedruckter deutscher Text je Seite (nur echt übersetzte Felder) + Druck, aus dem er stammt |
| `prints.de`, `prints.fallback` | Standarddrucke: bestes deutsches Bild, bestes englisches (oder einzige Sprache) |
| `aliases[]` | andere aufgedruckte englische Namen mit ihrem Druck |

## 4. Der Katalog-Bau (`cards/`)

`npm run cards:build` (Details: [`cards/README.md`](../../cards/README.md)).
Auf odin **≈ 45 s**: 542 689 Scryfall-Kartenobjekte gelesen und gegen das
Scryfall-Schema geprüft, 33 978 Forge-Skripte und 681 Set-Dateien gelesen.
Ergebnis (Scryfall-Stand 2026-09-24, Forge `ed0333fecb`):

| | |
|---|---|
| Karten | **36 156** (übersprungen: 3 049 Art-Series-, Decktyp- und Wendedrucke) |
| mit deutschem Text / deutschem Bild | **30 849 / 24 929** |
| Sets | 1 052 |
| Forge-Skripte zugeordnet | **33 740 von 33 978** – per Name 32 965, Seitenname 738, Alias 29, Set-Datei 8; 3 mehrdeutig (Un-Karten gleichen Namens) |
| Forge-Karten ohne Scryfall-Daten | 238 = 230 „A-…“ (von Scryfall nicht geführt) + 8 in `forge-unmatched.json` |
| Forge-Karten mit deutschem Text / Bild | 30 845 / 24 925 |
| Datei | Katalog `cacfe9aca953cd50`: **10,4 MiB gzip** (10 948 463 Bytes; entpackt 45 577 485), 37 448 Zeilen |

Gleiche Eingaben ergeben dieselbe Datei – auch auf Rechnern mit anderer
Sprache (zweimal gebaut, einmal mit `LC_ALL=de_DE.UTF-8`: bytegleich; sortiert
wird nach Zeichencodes, nie nach `localeCompare`).

**Druckwahl** (für `prints.de` und `prints.fallback`, in dieser Reihenfolge):
echtes Bild (Scan > niedrige Auflösung; Platzhalter nie deutsch), keine
Inhaltswarnung, nicht übergroß, normaler Rahmen (kein Borderless, Goldrand,
Showcase, Extended, Full Art, textlos), kein Promo, Papier, neuester; bei
Gleichstand entscheidet die Id. **Deutscher Text:** der vollständigste
übersetzte Druck, bei Gleichstand der mit dem gezeigten Bild, dann der neueste.

**Befund Scryfall-Daten:** Manche deutschen Drucke tragen englische
„gedruckte“ Texte (deutscher Forest mit `printed_name` „Forest“, deutscher
Delver of Secrets aus MID mit englischem Namen über deutschem Regeltext). Ein
Feld zählt deshalb nur als deutsch, wenn es sich vom englischen unterscheidet;
sonst steht das englische da und ist als Englisch gekennzeichnet.

**Namensschlüssel** (`src/cards/names.ts`): Groß-/Kleinschreibung, Akzente,
Ligaturen (Æ), typografische Apostrophe, Striche, Doppelpunkte und
Auslassungspunkte gleichen sich an („Where We're Going . . .“ bei Forge =
„Where We're Going...“ bei Scryfall; „Ratonhnhaké꞉ton“ mit Modifikator-
Doppelpunkt), ß → ss, Umlaute ohne Punkte – auf beiden Seiten gleich. Nichts
sonst wird zusammengelegt.

**Forge-Abgleich:** Forge nennt eine Karte nach ihrem ersten Zustand, eine
Split-Karte nach beiden („Fire // Ice“, `CardRules.getName()`), und manche
Skripte übernehmen Seiten aus anderen (`CopyFaceFrom:`). Zuordnung: Name →
Seitenname → aufgedruckter Alias; ist ein Name mehrdeutig oder unbekannt,
entscheiden Forges eigene Set-Einträge (Scryfall-Code + Sammlernummer):
so wird „P-Joven and Chandler“ (Forges Name für die Playtest-Karte) zur Karte
aus „Unknown Event“, „Joven and Chandler“ zur Karte aus MBC.

## 5. Im Build und im Browser

- **`vite/card-assets.ts`** (wie die Engine): nimmt `cards/build/dist` nur,
  wenn Größe und SHA-256 zum Manifest passen, die Datensätze zum lokalen
  Schema der App gehören und – wenn die Engine da ist – der Katalog gegen
  **denselben Forge-Commit** abgeglichen wurde; liefert ihn unter
  `/cards/<id>/card-catalog.jsonl.gz` aus (immutable in `vercel.json`, kein
  SPA-Rückfall). Ohne Katalog scheitert der Build laut; `OPENMANA_CARDS=omit`
  baut bewusst ohne (die App sagt es dann).
- **Einrichten** (`catalog-install.ts`, erst beim Einrichten nachgeladen):
  freien Platz prüfen (nichts schreiben, wenn es nicht passt) → Eintrag
  „partial“ und Katalog-Stores leeren (eine Transaktion) → herunterladen →
  SHA-256 prüfen (der gzip-Datei, oder der entpackten Daten, falls der Server
  sie mit `Content-Encoding: gzip` schickt – so macht es Vites Vorschau) →
  als Strom entpacken, jede Zeile gegen das Schema, Kopf zuerst, Endzeile mit
  passenden Zählungen zuletzt → in Stapeln zu 1 000 schreiben (`relaxed`) →
  „complete“. Abbrechbar; ein Abbruch oder Fehler lässt „partial“ stehen, der
  nächste Versuch beginnt neu. Ein Tab nach dem anderen (Web Locks).
- **Nachschlagen** (`card-lookup.ts`): über den Index `nameKeys` – genaue
  Namen, Namensanfänge für die Suche, Oracle-Id, **Engine-Schlüssel** (Seite
  der Karte, nie über deutsche Namen, Spielsteine nur bei eindeutigem Name +
  Stärke/Widerstandskraft + Farben), Forge-Karten ohne Scryfall-Daten, Sets
  über Scryfall-, Arena- oder Forge-Code.
- **Anzeige** (`card-display.ts`, rein): Bild (angefragter Druck → Alias-Druck
  → deutsch → englisch) mit richtiger Seite; Name, Typzeile, Text je Seite
  deutsch oder englisch mit Kennzeichnung; Manakosten und Werte immer aus dem
  Oracle. Im Spiel bleibt Forges Live-Text maßgeblich (13/14/20).
- **Bestimmte Drucke** (`prints.ts` + `scryfall-client.ts`): Druck selbst per
  `/cards/collection` (75 je Anfrage, 500 ms Abstand), deutsche Fassung je Druck
  (`/cards/:set/:nr/de`, 100 ms Abstand); auch „gibt es nicht“ wird gemerkt;
  30 Tage frisch, ohne Netz gilt der alte Stand, nie eine Vermutung. Erster
  Nutzer ist der Deck-Import (09).
- **Bilder** (`images.ts`, `card-picture.tsx`): WebP-Fassungen `thumb`
  (146 × 204), `grid` (488 × 680), `display` (672 × 936); URL aus Druck-Id,
  Seite, Größe und Bild-Zeitstempel – nach der Regel, die der Katalog-Bau an
  **jeder** Katalog-URL prüft. `crossOrigin="anonymous"`,
  `referrerPolicy="no-referrer"`, `object-contain` (nie beschnitten).

## 6. Scryfalls Regeln

| Regel (Scryfall, 2026-09-25) | Umsetzung |
|---|---|
| User-Agent + Accept an api.scryfall.com; im Browser den Browser-UA lassen | Katalog-Bau: `OpenMana-CardCatalog/<Version>` + Accept; App: nur Accept |
| Search/Named/Random/Collection 2 je s, sonst 10 je s | eigene Warteschlangen mit 500 bzw. 100 ms Abstand (`scryfall-client.ts`, getestet) |
| 429 sperrt 30 s, nicht ignorieren | 30 s nichts senden, Fehler melden, keine Wiederholung (getestet) |
| mindestens 24 h zwischenspeichern; viele Namen/Bilder → Massendaten | Katalog aus Massendaten; Drucke 30 Tage; die App fragt nie je Anzeige |
| kein Paywall, kein Logo, keine vorgetäuschte Unterstützung, Mehrwert | Credits nennen Scryfall als Datenquelle ohne Logo, mit „steht in keiner Verbindung“ |
| Bilder nicht beschneiden, verzerren, einfärben, mit Zeichen versehen | `CardPicture` zeigt immer das ganze Bild (`object-contain`), auch als Miniatur |
| CORS: Origin-Header nötig | der Browser sendet ihn; Bilder im CORS-Modus (COEP) |

## 7. Oberfläche

- **Einstellungen → „Kartendaten“:** Scryfall-Stand, Karten, davon mit
  deutschem Text/Bild, Forge-Karten ohne Scryfall-Daten, Download-Größe,
  Zustand auf dem Gerät; Knöpfe „Kartendaten einrichten“ / „Kartendaten
  aktualisieren“ / „Erneut einrichten“, „Abbrechen“ mit Fortschrittsbalken
  („Lade … von … MB“, „Speichere … von … Einträgen“), „Karte nachschlagen“.
  Fehler mit deutscher Überschrift, Rat und technischem Detail.
- **„Karte nachschlagen“:** Suche ab zwei Buchstaben, deutsch oder englisch;
  Treffer mit Miniatur; Detailansicht mit Bild, deutschem Namen und englischem
  darunter, Typzeile, Regeltext je Seite, Werten, Hinweisen („Keine deutsche
  Fassung – englisch“, „Kein deutsches Bild – Bild englisch“, „Text teilweise
  englisch“, „Bild in geringer Auflösung“), „Rückseite zeigen“, Druck- und
  Quellenangabe, Künstlername. „Keine Scryfall-Daten zu dieser Karte“ für
  Forge-Karten ohne Scryfall-Daten, „Keine Karte gefunden“ sonst.
- **Credits:** Karte „Kartendaten und Kartenbilder“ mit Scryfall (Stand) und
  der Fan Content Policy von Wizards of the Coast.
- Neue Bausteine: `AspectRatio`, `Progress` (shadcn-Registry), `CardPicture`
  (shadcn-Bauweise, `src/components/ui/card-picture.tsx`).

## 8. Kosten

- **Start-JavaScript:** 192 → **206,7 KB gzip** (Vite-Angabe: App-Code
  94 → 107,4 KB, React + Router 99 KB; +14,7 KB: Prüfer der vier neuen
  Datensatzarten +4 KB, Kartendaten-Oberfläche und -Logik, AspectRatio,
  Progress). Einrichten samt Katalog-Prüfern (8,2 KB gzip) wird erst beim
  Einrichten nachgeladen; die Scryfall-API-Prüfer kommen erst mit dem ersten
  Druck-Abruf (Prompt 09). CSS 14,3 KB gzip.
- **Einmal je Katalog-Version:** 10,4 MiB Download (gzip); in Chrome ~4–5 s
  bis „Bereit“, danach **66 MB** IndexedDB (Chromes Angabe) – siehe §10.3.
- **Katalog-Bau:** ~42 s auf odin (1 CPU-Kern), einmalig ~390 MB Download.

## 9. Tests

| Datei | Tests | Was |
|---|---|---|
| `cards/scripts/catalog.test.ts` | 19 | Druckwahl, deutscher Text (englische „gedruckte“ Felder), Doppelseiten, Split/Abenteuer/Flip/Meld, Aliasse, nur-japanisch, Spielsteine, Sets, Forge-Abgleich (Name/Seite/Alias/Set-Datei), Ausnahmen und Abbruch bei Unerklärtem, Reihenfolge, Determinismus, Ablehnung unbekannter Daten |
| `cards/scripts/forge-cards.test.ts` | 6 | Forge-Namen (Split, CopyFaceFrom), Set-Dateien wie Forges `CARD_PATTERN` |
| `src/cards/names.test.ts` | 16 | Schlüssel für alle gefundenen Schreibvarianten, idempotent, trennt verschiedene Karten |
| `src/cards/images.test.ts` | 3 | URL-Regel, Zerlegen, nur vorhandene Seiten |
| `src/cards/catalog-install.test.ts` | 17 | einrichten, einmal je Version, ersetzen, entpackt geliefert, Hash, Schema, Endzeile, Zählungen, Kopf, Format, Download-Fehler, zu groß, Platz vorab und beim Schreiben (QuotaExceededError), ohne Web Crypto, Abbrechen, zwei Tabs |
| `src/cards/card-lookup.test.ts` | 12 | alle Namensarten, Suche, Engine-Schlüssel, Spielsteine, Forge-only, Sets |
| `src/cards/card-display.test.ts` | 11 | deutsch/englisch je Feld, Bildquelle, Seiten, Alias-Druck, bestimmter Druck, kein Bild |
| `src/cards/scryfall-client.test.ts` | 6 | Accept, Abstände, 429-Pause, 404, Fehler, Formatprüfung |
| `src/cards/prints.test.ts` | 6 | holen, merken, „gibt es nicht“, 30 Tage, ohne Netz |
| `src/cards/card-data.test.tsx` | 10 | Einstellungen, Einrichten mit Fortschritt, Fehler und Wiederholen, Version ohne Katalog, Nachschlagen, Bild lädt/scheitert, Wenden, keine deutsche Fassung, Forge-only, unbekannt, Credits |
| `vite/card-assets.test.ts` | 11 | Prüfung, Adresse, Schema-Version, Forge-Gleichstand, omit, Kopie in den Build |
| `src/storage/migrations.test.ts` | +1 | echte Migration 1 → 2 mit Daten aus Prompt 07 |
| `vite/deployment.test.ts` | +1 | `/cards/…` mit Isolation-Headern, immutable, ohne SPA-Rückfall |

## 10. Nachweise

Alle auf `45f57d7`, sauberer Arbeitsbaum, Chrome for Testing 153.0.8010.12
headless, echte Engine `0c82db80023ac0cc`, echter Katalog `cacfe9aca953cd50`.

### 10.1 Erzeugte Dateien, Typecheck, Lint

`node scripts/generate-schemas.ts --check` (lokale Daten, Katalogzeilen,
Scryfall), `tsc -b` (App, Tests, Werkzeuge inkl. `cards/`), `oxlint` – ohne
Befund.

### 10.2 Unit- und Komponententests: **298** (179 bestehende + 119 neue)

Siehe §9. Die Datenschicht und das Einrichten laufen mit `fake-indexeddb`;
die Tests bauen mit dem echten Katalog-Bau einen kleinen echten Katalog aus
46 Scryfall-Kartenobjekten (gekürzt, `cards/fixtures/`) und echten
Forge-Skripten. Bestehende Tests der Datenschicht sind jetzt versionsneutral
(`SCHEMA_VERSION`, `SCHEMA_VERSION + 1`) statt „Version 1“ fest.

### 10.3 End-to-End-Test (`scripts/e2e/run.ts`, `npm run check` 1:48 min, 0 Fehler)

Alle bisherigen Prüfungen (sechs Oberflächen in drei Größen mit axe-core,
Engine-Start über Vorschau/Handy/Dev-Server, lokale Daten, Quota, PWA, ohne
Isolation) – jetzt mit Schema-Version 2 (eine Sicherung mit Schema 1 lädt
unverändert) – plus Abschnitt 7 „Card data“:

| Prüfung | Ergebnis |
|---|---|
| Auslieferung | Vorschau: `/cards/<id>/card-catalog.jsonl.gz` mit Isolation-Headern, **`Content-Encoding: gzip`** (sirv), entpackt 45 577 485 Bytes; Dev-Server: `application/gzip`, 10 948 463 Bytes, unbekannte Datei 404 mit COEP |
| nichts ungefragt | auf keiner Oberfläche eine Anfrage an `/cards/` oder an einen fremden Host (auch nicht an Scryfall), bevor der Spieler es will |
| Einrichten (Vorschau, vom Browser entpackt) | **4,8 s** bis „Bereit“; 36 156 Karten, 1 052 Sets, 238 Forge-only in IndexedDB; Eintrag `complete`, Version = Katalog; genau ein Download; danach weiter `crossOriginIsolated`; Chrome meldet **66 MB** IndexedDB |
| Einrichten wie Vercel (`application/gzip`, von der App entpackt) | Abbrechen während des Einrichtens → „wurde abgebrochen“ + „Unvollständig“; „Erneut einrichten“ → **4,9 s** (inkl. Abbruch) bis „Bereit“ |
| beschädigter Download | ein gekipptes Byte → „Die heruntergeladenen Kartendaten sind fehlerhaft“, Eintrag bleibt `partial` |
| Nachschlagen deutsch | „Blitzschlag“: echtes deutsches Bild von `cards.scryfall.io` geladen (`display`-WebP), Typzeile „Spontanzauber“, englischer Name darunter |
| Rückseite | „Geheimnisstöberer // Insekten-Scheußlichkeit“: Vorderseite geladen, „Rückseite zeigen“ → Bild der Rückseite (`/back/`) geladen |
| nur englisch | „Akki Lavarunner“: „Keine deutsche Fassung – englisch“, Bild geladen |
| Forge-only / unbekannt | „Drake Stone“ → „Keine Scryfall-Daten zu dieser Karte“; „Zzyzx Unbekannt“ → „Keine Karte gefunden“ |
| Handy (412 × 915) | Dialog mit Abenteuerkarte ohne Überlauf, axe ohne Befund |
| **COEP-Nachweis** | dasselbe Scryfall-Bild: mit `crossOrigin="anonymous"` geladen, ohne **blockiert** (`ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`) |
| Bilder offline | Bildserver gesperrt → „Wald“ zeigt Name, Typzeile, Text und „Das Bild konnte nicht geladen werden.“ (`data-state="failed"`) |
| bleibt | nach Neuladen „Bereit“, Karten noch da; Einstellungen zählen „36.156 Karten“ |
| „Daten prüfen“ mit Katalog | jeder der ~37 500 Einträge gegen sein Schema: **1,8 s**, alles in Ordnung |
| axe-core | Einstellungen mit Kartendaten, Detailansicht (Desktop, Handy): 0 Befunde |
| Konsole | keine Fehler außer den absichtlich blockierten Bildern (44, nur im Zeitfenster der beiden Blockade-Schritte zugelassen) |

### 10.4 Katalog-Bau, Engine, frischer Klon

- `npm run cards:build -- --offline` auf dem Commit: 41,5 s, Katalog
  `cacfe9aca953cd50`, Zahlen wie §4; zweiter Bau mit anderer Sprache
  bytegleich.
- Engine unverändert (`engine/` ohne Änderung): erzeugte Protokolldateien =
  Schema, `tsc`, **80/80** Unit-Tests. `test-engine.sh` nicht erneut gelaufen
  (die ausgelieferten Artefakte sind die geprüften von `0ddfbc3`).
- Frischer Klon ohne Engine und Katalog: `npm ci` 4,8 s; `npm run build`
  scheitert laut (Engine fehlt); mit `OPENMANA_ENGINE=omit` scheitert er laut
  am fehlenden Katalog („build it with: npm run cards:build“); mit beiden
  `omit` baut er; **298** Tests grün.

## 11. Befunde

### 11.1 Scryfalls Massendaten sind jetzt JSON Lines

Die Bulk-Dateien liegen seit 2025/26 als `jsonl.gz` vor (`jsonl_download_uri`,
`compressed_size`); die älteren Felder `download_uri`/`size` gibt es nicht
mehr. Der Katalog-Bau liest sie als Strom, ohne sie zu entpacken.

### 11.2 Deutsch bei Scryfall

- 58 512 deutsche Drucke zu 30 866 Oracle-Identitäten; ihre Bilder: 73 %
  niedrige Auflösung, 19 % **Platzhalter**, 8 % Scan. Platzhalter sind
  Scryfalls allgemeine Ersatzbilder – sie gelten nie als deutsches Bild.
- Manche deutschen Drucke tragen englische „gedruckte“ Texte (Forest mit
  `printed_name` „Forest“, MID-Delver mit englischem Namen, obwohl das Bild
  „Geheimnisstöberer“ zeigt): deshalb zählt nur, was sich vom Englischen
  unterscheidet (§4).
- Deutsche Standardländer haben meist gar keinen Regeltext (365 von 379
  Wald-Drucken) oder nur „G“ (das große Manasymbol) – so steht es auch im
  Katalog, ohne Ersatz zu erfinden.
- Scryfall führt die **neu ausbalancierten Arena-Karten („A-…“) nicht mehr**;
  Forge hat 230 davon. Sie bleiben spielbar und erscheinen mit Forges Text.
- Universes-Beyond-Karten: Scryfall führt den Namen der
  „Universes Within“-Fassung als Oracle-Namen (Hansk, Slayer Zealot) und den
  aufgedruckten Namen als `printed_name` (Daryl, Hunter of Walkers); Forge
  kennt 29 Karten nur unter dem aufgedruckten Namen → Aliasse.

### 11.3 COEP und Scryfalls Bilder – bestätigt

Research R9 (Prompt 00) ist jetzt im Browser belegt: Scryfall sendet
`Access-Control-Allow-Origin: *`, aber kein `Cross-Origin-Resource-Policy`;
unter `require-corp` lädt ein Bild nur im CORS-Modus. `COEP: credentialless`
wäre die Alternative, fehlt aber in Safari – CORS-Modus funktioniert überall.

### 11.4 Vites Vorschau entpackt `.gz`-Dateien

`vite preview` (sirv) liefert `card-catalog.jsonl.gz` mit
`Content-Encoding: gzip` und leerem `Content-Type` aus; der Browser entpackt
dann selbst. Die App prüft deshalb, was ankommt (gzip-SHA-256 oder
JSON-Lines-SHA-256, Fortschritt nach `Content-Encoding`). Vercel liefert
`.gz` als `application/gzip`; beide Wege sind im E2E-Test belegt.

### 11.5 Weiteres

- Ajv-standalone-Prüfer lassen sich nicht wegoptimieren (Zuweisungen auf
  oberster Ebene, bekannt seit Prompt 03): die Prüfer der Katalogzeilen sind
  deshalb ein eigenes erzeugtes Modul, das nur beim Einrichten geladen wird.
- Scryfalls Namen: Forge und Scryfall unterscheiden sich bei Auslassungspunkten
  („. . .“/„...“), Modifikator-Doppelpunkt (U+A789) und Geviertstrich im Namen –
  die Namensschlüssel gleichen das aus.
- Forge-Skripte können Seiten übernehmen (`CopyFaceFrom:`, 23 Split-Karten wie
  Bind // Liberate): der Leser folgt dem.
- Beim Wenden einer Karte ist das neue Bild nach ~50 ms da; ein Screenshot
  direkt nach dem Ladeereignis kann es noch ungezeichnet zeigen – der E2E-Test
  wartet deshalb auf `img.decode()`.

## 12. Entscheidungen und Abweichungen

- **Katalog zur Bauzeit statt Laufzeit-Download von Scryfall** (§2), mit der
  App ausgeliefert wie die Engine; nicht im Git (Größe, und kein
  Wiederveröffentlichen). Folge für Prompt 31: Vercel braucht den Katalog wie
  die Engine (Release-Asset oder Bau im Vercel-Build; Hinweis in
  `prompts/STATUS.md`).
- **Kein automatisches Einrichten** beim App-Start: 10 MB lädt die App erst,
  wenn der Spieler es will (Einstellungen, später Deck-Import und Spiel).
- **Katalog an Forges Stand gebunden:** jede Karte nennt ihre Forge-Namen, und
  der Build verlangt denselben Forge-Commit wie die Engine – dafür muss nach
  einem Forge-Update auch der Katalog neu gebaut werden (Prompt 26).
- **Standarddrucke fest gewählt** (neuester regulärer Druck mit echtem Bild –
  wie Scryfalls eigene Standardwahl, z. B. Lightning Bolt aus MSC); eine
  Einstellung dafür gibt es nicht (Prompt 12 entscheidet über Sprache).
- **Bilder im HTTP-Cache** des Browsers (Scryfall: ein Jahr `max-age`); eigenes
  Vorhalten für offline erst mit dem Service Worker (Prompt 25).
- **Tokens** nur, wenn Name + Stärke/Widerstandskraft + Farben eindeutig
  passen; sonst „mehrdeutig“ und Forges Text (13/14).
- **Mehrdeutige Un-Karten** (3 Forge-Namen) tragen ihren Forge-Namen auf allen
  passenden Katalogkarten; die Anzeige sagt „mehrdeutig“ statt zu raten.
- Katalog-Stores sind Zwischenspeicher (Migration darf sie leeren, nie in
  Sicherungen); `scryfallPrints` bleibt über Katalog-Versionen erhalten.
- `scripts/generate-storage.ts` heißt jetzt `scripts/generate-schemas.ts`
  (drei Ziele).

## 13. Bekannte Lücken (mit Ziel-Prompt)

| Lücke | Ziel |
|---|---|
| Arena-Import: Zeilen parsen, Arena-Set-Codes, deutsche Namen, Drucke holen (`ensurePrints`), Importbericht | 09 |
| „Kartendaten fehlen“ beim Import/Spielstart automatisch einrichten statt nur in den Einstellungen | 09/11 |
| Spielkarten aus dem Engine-Zustand anzeigen (`resolveEngineKey`, `cardDisplay`, Forges Live-Text maßgeblich, Tokens mit Farben/Werten) | 13/14/20 |
| Manasymbole als Symbole statt `{1}{R}` | 14 |
| Kartensprache/Anzeige-Einstellungen (z. B. immer englisch) | 12 |
| Bilder und Katalog offline vorhalten, Katalog-Update beim App-Update | 25 |
| Katalog auf Vercel (wie die Engine) und öffentlich erst nach den Lizenzen | 31, 27 |
| Katalog neu bauen bei jedem Forge-Update, neue Lücken entscheiden | 26 |
| Scryfall-Migrationen (gelöschte/zusammengelegte Druck-Ids) für gemerkte Drucke | 26 (bei Bedarf) |

## 14. Reproduzieren

```bash
npm ci
bash engine/scripts/build.sh      # Engine (einmal, ~6 min), falls noch nicht gebaut
npm run cards:build               # Katalog (~45 s; lädt beim ersten Mal ~390 MB von Scryfall)
npm run check                     # Schemas, tsc, oxlint, Vitest, E2E in Chrome (braucht Internet für Scryfalls Bilder)
```

## 15. Was als Nächstes kommt

Prompt **09 — Arena deck import** (PENDING, nicht begonnen: je Lauf genau ein
Prompt). Er nutzt `findCardsByName` (deutsche und englische Namen), die
Forge-Namen der Katalogkarten, `findForgeOnly`, `findSetByArenaCode` und
`ensurePrints` für angegebene Drucke.
