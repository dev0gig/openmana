# OpenMana-Protokoll (Version 4)

Der **einzige Vertrag** zwischen der OpenMana-Oberfläche und der Engine (Forge
im Dedicated Worker). Die Oberfläche sieht keine Forge-Klassen und rechnet
keine Regel aus; Forge entscheidet alles, das Protokoll transportiert und
prüft nur. Eingeführt mit Prompt 03, Nachweise in
[`docs/implementation/03-worker-transport-protocol.md`](../../docs/implementation/03-worker-transport-protocol.md);
Version 2 mit Prompt 04 (siehe [unten](#änderungen-in-version-2-prompt-04)),
Version 3 mit Prompt 05 (siehe [unten](#änderungen-in-version-3-prompt-05)),
Version 4 mit Prompt 12 (siehe [unten](#änderungen-in-version-4-prompt-12)).

```
 UI ──ruft──▶ EngineClient (Main Thread) ──WorkerCommand (postMessage, nur wenn der Worker frei ist)──▶ Worker-Host
                    │                     ──EngineInput (SharedArrayBuffer-Warteschlange)───────────▶ (Forge wartet)
 UI ◀─Events── EngineClient ◀──────────── EngineMessage (postMessage) ──────────────────────────────── Worker-Host ◀── Bridge (Java)
```

| Teil | Wo |
|---|---|
| Schema (die Quelle) | [`schema/protocol.schema.json`](schema/protocol.schema.json), JSON Schema 2020-12 |
| erzeugt daraus | `src/generated/protocol.ts` (Typen), `constants.ts` (Version, alle Aufzählungen), `validators.js` (vorkompilierte Prüfer, Ajv standalone, kein `eval`) |
| Laufzeitprüfung | [`src/validate.ts`](src/validate.ts): `checkEngineMessage`, `checkEngineInput`, `checkWorkerCommand`, `checkMatchRequest`, `checkGameState` werfen `ProtocolViolation` mit Pfad und Grund |
| Eingabewarteschlange | [`src/input-queue.ts`](src/input-queue.ts) |
| Feature-Erkennung | [`src/features.ts`](src/features.ts) |
| Client (Main Thread) | [`../client/src/engine-client.ts`](../client/src/engine-client.ts) |
| Worker-Host | [`../wasm/host/worker-host.ts`](../wasm/host/worker-host.ts) |
| Java-Seite | `engine/bridge/…/bridge/Protocol.java` (Namen), `BridgeGuiGame`, `StateBuilder`, `WasmMain` |

## Versionen

- `ProtocolVersion` ist eine ganze Zahl (jetzt **4**). UI, Worker-Host und
  Engine müssen **genau dieselbe** Version sprechen; es gibt keine
  Aushandlung. Eine App liefert UI und Engine immer zusammen aus
  (`engine.lock.json`, Prompt 25/26); eine Abweichung heißt „alter Cache“ oder
  „falscher Build“ und wird laut abgelehnt:
  - der Worker prüft `engine.start.protocol` **vor** allem anderen, also bevor
    die ~70-MB-Engine lädt (`engine.abort`, `protocol-mismatch`, gemessen 69 ms);
  - der Worker prüft `protocol` in Javas Ready-Meldung (Engine und Host aus
    verschiedenen Builds);
  - der Client prüft `engine.ready.protocol` und `game.started.protocol`, bevor
    er den Rest der Nachricht überhaupt liest.
- Jede Änderung am Schema ist eine neue Version: Schema ändern,
  `ProtocolVersion` und `Protocol.VERSION` (Java) **gemeinsam** hochzählen,
  `npm run generate` in `engine/`, Tests. Drei Tests halten das zusammen:
  `schema.test.ts` (Schema = erzeugte Konstante = `Protocol.java`),
  `ProtocolContractTest` (Java-Namen = Schema, jede Forge-Phase im Schema) und
  `build-host.sh` (erzeugte Dateien = Schema, sonst bricht der Build ab).
- Ein Forge-Update ändert die Protokollversion **nicht**, solange die Bridge
  den Vertrag hält (Bible §3). Ändert Forge etwas, das die Bridge nicht mehr
  abbilden kann (z. B. eine neue Phase), schlägt `ProtocolContractTest` beim
  Build fehl, nicht beim Spieler.

## Nachrichten

### Engine → UI (`EngineMessage`, postMessage)

| `type` | Zweck |
|---|---|
| `engine.boot` | Fortschritt des Starts: `worker-features` (mit `features`), `launcher-load`, `wasm-fetch-compile`, `java-main`; `t` = ms seit Worker-Start |
| `engine.ready` | Forge ist bereit: `protocol`, `engine` (Forge-Version und -Commit, Patch-Zahl und -Hash, OpenMana-Commit, `engineSourcesModified`, `synchronous`, `resourcesSha256` = SHA-256 der eingebauten Forge-Daten wie im `engine-manifest.json`), `boot` (Ressourcen, Zeiten, `cardLoading`, `language` = Forges Wörter, `cardLanguage` = die Karten darin, `aiProfiles` = Forges geladene KI-Profile, sortiert) |
| `engine.waiting` | Die Warteschlange ist leer und Forge wartet auf den Spieler. `consumed` = gelesene Eingaben; alles bis dahin ist fertig verarbeitet. Eine wartende Engine ist nicht „hängend“ |
| `engine.error` | Ein Befehl schlug fehl, der Worker bleibt nutzbar: `deck-rejected` (mit `report.unknownCards`), `invalid-request`, `not-ready`, `already-started` |
| `engine.abort` | **Technischer Abbruch**, kein Spielergebnis; der Worker ist verloren (siehe unten) |
| `match.finished` | Forge hat die Partie verlassen; technische Zusammenfassung (Hashes, Zähler) |
| `diagnostics.result` | Ergebnis einer KI-gegen-KI-Testpartie (nur Tests) |
| `diagnostics.cards` | Ergebnis der Kartenprüfung (`CardProbeResult`, nur Tests; die Objekte in den Abschnitten sind freie Diagnose, kein UI-Vertrag) |
| `diagnostics.trace` | Ein Eintrag der **Engine-Spur** (nur Tests, nur wenn angefordert, siehe [unten](#die-engine-spur-nur-tests)) |
| `game.started` | Partie beginnt (`protocol`, Namen, KI-Profil, Format, `cardNames` beider Decks ohne Besitzer) |
| `state` | **vollständiger** Zustand, nie ein Delta; `seq` steigt streng |
| `events` | neue Einträge aus Forges Spielprotokoll, **vor** dem Zustand, den sie erklären |
| `message` | Text von Forge: `kind` = `prompt` (Anweisungszeile), `notice` (Hinweisdialog), `error` (Fehlerdialog), `incorrect-action` |
| `question` | Eine Entscheidung (neun Arten, s. u.), mit `id` und `blocking` |
| `question.withdrawn` | Forge fragt das nicht mehr (normal, kein Fehler) |
| `question.answered` | Die Antwort mit `seq` wurde angenommen und hat die Frage geschlossen |
| `input.rejected` | Eine Eingabe wurde **nicht** ausgeführt: `seq`, `reason`, `detail`, `input` |
| `game.end` | Spielende aus Sicht des Spielers; alle Felder immer vorhanden (notfalls `null`) |

### UI → Engine (`EngineInput`, Warteschlange)

`answer` (mit `question`, `kind` und den Feldern seiner Art), `card.tap`,
`player.tap`, `state.request`, `concede`. Jede Eingabe trägt `seq` = 1, 2, 3 …
ohne Lücken; der Client vergibt sie, die Bridge prüft sie. Eine Lücke, eine
Wiederholung oder eine fehlende Nummer heißt, dass der Transport kaputt ist:
**technischer Abbruch** statt eines Spiels auf falscher Grundlage.

### UI → Worker (`WorkerCommand`, postMessage)

`engine.start` (Protokollversion, Adressen von Launcher und Modul, Argumente,
die Warteschlange, ob Cross-Origin-Isolation Pflicht ist), `match.start`
(`MatchRequest`: Seed, Format, Mensch mit Deck, KI mit Profil – eines aus
`boot.aiProfiles`, sonst `engine.error invalid-request` – und Deck; nur in
Tests `trace`), `diagnostics.ai-match` (nur Tests, optional `trace`) und
`diagnostics.card-probe` (nur Tests). Befehle wirken
nur, wenn der Worker frei ist: Während einer Partie steckt er in Forges
Java-Stack und liest nur die Warteschlange.

**Start-Argumente** (`engine.start.args`), jedes andere Argument bricht den
Start ab (`engine.abort`, `boot-failed`):

| Argument | Standard | Bedeutung |
|---|---|---|
| `--card-loading=eager\|lazy` | `eager` | Wie Forge seine Kartenskripte liest (`CardLoading`). `lazy` spart rund 90 MiB, lädt aber die ganze Datenbank mitten in der Partie nach, sobald ein Effekt oder der Spieler alle Karten braucht (im Wasm gemessen: 17 s Stillstand in Chrome, bis 42 s in Node; vollständig laden kostet 1,6 s beim Start) |
| `--language=en-US\|de-DE` | `en-US` | Sprache von Forges eigenen Texten (Fragen, Knöpfe, Spielverlauf) und der Kartennamen darin (`EngineLanguage`). Kartenschlüssel (`key`) bleiben immer englisch; die Kartenanzeige kommt von Scryfall |

## Fragen

| `kind` | `blocking` | Antwort |
|---|---|---|
| `select` | nein | `choices` (1..max Nummern, wirken wie Klicks); die Frage bleibt offen, bis Forge die Auswahl ändert |
| `buttons` | nein | `button` 1 oder 2 (muss aktiv sein); `purpose` sagt wofür |
| `choose` | ja | `choices` (min..max, verschieden) |
| `confirm` | ja | `yes` |
| `options` | ja | `option` (0 = abbrechen, nur wenn `cancellable`) |
| `input` | ja | `value` (Text, bei `numeric` eine ganze Zahl) |
| `order` | ja | `order` (Forges Doppelliste mit `remainingMin/Max`) |
| `arrange` | ja | `top` und `bottom`, jede Karte genau einmal |
| `distribute` | ja | `amounts` parallel zu `items`, Summe = `total` |

- **Lebenszyklus:** Jede Frage wird von **genau einer** Nachricht geschlossen:
  `question.answered` (die Antwort mit dieser `seq` wurde angenommen) oder
  `question.withdrawn`. Ids steigen streng und werden nie wiederverwendet. Bei
  `game.end` ist keine Frage mehr offen.
- **Blockierend** (`blocking: true`): Solange sie offen ist, kann nur sie
  beantwortet werden; Antippen und Antworten auf andere Fragen lehnt die
  Engine als `not-active` ab. `state.request` und `concede` gehen immer.
- **Veraltete Antworten:** Eine Antwort auf eine nicht (mehr) offene Frage
  führt die Engine nie aus (`input.rejected`, `stale`). Der Client kennt den
  Lebenszyklus und lehnt so eine Antwort schon selbst ab (`EngineInputError`
  `stale` bzw. `unknown-question`), ohne sie zu senden. Die Engine bleibt
  trotzdem die Instanz: Zwischen Rücknahme und Antwort kann eine Nachricht
  unterwegs sein, dann lehnt sie die Engine ab.

## Was der Client prüft (und was nicht)

Vor dem Senden, synchron und laut (`EngineInputError`):
`no-match` (keine laufende Partie), Schema (`malformed`), Frage-Id
(`unknown-question`, `stale`), blockierende Frage (`not-active`), Art der
Antwort (`wrong-kind`), Karte/Spieler im letzten Zustand sichtbar
(`unknown-card`, `unknown-player`), Warteschlange (`queue-full`, `too-large`).

Bei jeder Nachricht der Engine: Schema und Reihenfolge (ein Zustand älter
als der vorige, eine wiederverwendete Frage-Id, eine zweite offene
Knopf-/Auswahl-/blockierende Frage, das Schließen einer nicht offenen Frage,
eine Rückmeldung zu einer nie gesendeten Eingabe, eine Nachricht im falschen
Zustand des Lebenszyklus). Ein Verstoß ist ein **technischer Abbruch**
(`protocol-violation`).

Nicht: ob eine Antwort inhaltlich passt (Anzahl, Bereich, Summe, aktiver
Knopf) und ob Forge ein Antippen annimmt. Das prüft die Bridge und meldet es
mit `input.rejected` (`invalid`, `no-effect`). Magic-Regeln prüft niemand
außer Forge.

## Fehler: `engine.error` gegen `engine.abort`

- **`engine.error`**: Der Befehl ging nicht, die Engine ist aber heil. Nach
  `deck-rejected`/`invalid-request` nimmt derselbe Worker ein neues
  `match.start` an (Forge hat die Partie nie begonnen).
- **`engine.abort`** (`origin` = `engine` oder `client`): Es geht nicht
  weiter, der Client beendet den Worker. Gründe:
  `unsupported-browser` (mit `missing`), `protocol-mismatch`,
  `transport-error` (Warteschlange unbrauchbar), `boot-failed`,
  `engine-failure` (Ausnahme in Forge/Bridge während einer Partie),
  `worker-error`, `protocol-violation`, `ready-timeout` (Standard 180 s),
  `terminated` (die UI hat abgebrochen, `EngineClient.abort()`).
- **Watchdog, kein Abbruch:** Arbeitet die Engine (nicht wartend) und schweigt
  `stallTimeoutMs` lang (Standard 30 s), meldet der Client `stalled`; die UI
  zeigt „Engine reagiert nicht“ und bietet einen Neustart an. Spricht die
  Engine wieder, folgt `responsive`. Kein Timeout für den Menschen, keine
  automatische Antwort.

## Die Eingabewarteschlange

Ein SharedArrayBuffer, von der Seite angelegt und in `engine.start` übergeben.
Ein Schreiber (Client, blockiert nie), ein Leser (Worker, blockiert mit
`Atomics.wait` nur bei leerer Warteschlange).

```
Kopf, 8 × Int32 = 32 Byte
  [0] Magic 0x4f4d5155 ("OMQU")   [1] Layout-Version (1)   [2] Kapazität (Zweierpotenz, 64 B … 16 MiB)
  [3] Schreibposition (Bytes)     [4] Leseposition (Bytes) [5] geschriebene Einträge
  [6] gelesene Einträge           [7] reserviert
Daten: Ring von `Kapazität` Bytes; Eintrag = 4 Byte Länge (little-endian) + UTF-8-JSON,
darf über das Ringende laufen. Belegt = Schreib- − Leseposition (modulo 2^32).
```

- Der Schreiber kopiert die Bytes und veröffentlicht sie erst dann mit
  `Atomics.store` der Schreibposition und weckt den Leser mit `Atomics.notify`.
- **Voll = laut:** Passt eine Eingabe nicht, wirft `write()` (`full`) und
  schreibt **nichts**; der Client meldet `queue-full`, die UI zeigt es und
  darf es erneut versuchen, sobald die Engine wartet. Nie wird etwas still
  verworfen oder überschrieben.
- Der Leser prüft Magic, Layout-Version und Kapazität und weigert sich laut
  (`transport-error`); unstimmige Positionen oder kaputtes UTF-8 sind
  `corrupt`.
- Standardgröße 64 KiB (Eingaben sind 30–120 Byte). Die Tests fahren ganze
  Partien auch mit 256 Byte, damit Ringüberlauf und volle Warteschlange
  wirklich vorkommen.

## Feature-Erkennung

`detectEngineFeatures()` prüft vor dem Laden: WebAssembly mit GC, Exception
Handling (exnref) und typisierten Funktionsreferenzen (drei winzige
Probemodule), Dedicated Worker, SharedArrayBuffer, `Atomics.wait` und im
Browser `crossOriginIsolated`. Der Client prüft im Main Thread und legt ohne
Unterstützung gar keinen Worker an; der Worker prüft noch einmal. Die Meldung
nennt, was fehlt (deutsch).

## Befehle

```bash
cd engine
npm run generate          # nach einer Schema-Änderung (dann Version hochzählen!)
npm run check:generated   # erzeugte Dateien = Schema?
npm run typecheck         # tsc, strict
npm run test:unit         # Protokoll, Client, Worker-Host, Spur-Werkzeug (node:test)
npm run bundle            # Worker- und Diagnose-Bundle (esbuild)
```

`engine/scripts/build-host.sh` macht alles zusammen und läuft als erster
Schritt von `build.sh`.

## Die Engine-Spur (nur Tests)

Für die Differenztests JVM gegen WebAssembly (Prompt 05) schickt die Engine auf
Wunsch eine **strukturierte, sprachunabhängige Aufzeichnung der Partie**:
`MatchRequest.trace: true` bzw. `diagnostics.ai-match` mit `trace: true`. Die
Oberfläche setzt das nie: Die Spur enthält verdeckte Information (Bibliotheken,
die Hand der KI).

- Jede Nachricht `diagnostics.trace` ist ein nummerierter Checkpoint (`n` = 1,
  2, 3 … ohne Lücke) mit `at` = `input` (Forge wartet auf die nächste Eingabe),
  `phase` (ein Schritt beginnt) oder `end` (Forge hat die Partie beendet),
  `inputs` (bis dahin gelesene Eingaben), `events` (alles seit dem vorigen
  Eintrag) und `snapshot` (die ganze Partie aus Forges Modell: jede Zone jedes
  Spielers samt Bibliotheksreihenfolge, Stapel mit Zielen und `api`, Kampf,
  im Menschenspiel Forges Markierungen und die offenen Fragen ohne Worte).
- Ereignisse (`TraceEvent`, `e` = `TraceEventKind`): je Forge-Ereignisklasse
  eine Art (`cast`, `resolve`, `move`, `attackers`, `blockers`, `damage`,
  `mana`, `priority`, `phase`, `log` …) und die der Bridge (`started`,
  `question`, `withdrawn`, `answered`, `rejected`, `message`, `end`, `input`).
  Nur Ids, englische Kartenschlüssel, Aufzählungsnamen, Zahlen und Verweise
  (`c<Karten-Id>`, `p<Spieler-Id>`, `<Zone>:<Spieler-Id>`), nie Forges Texte.
- Kein Checkpoint hängt an einer Uhr: Dieselbe Partie ergibt auf JVM, Node und
  Chrome dieselbe Spur, auf Deutsch dieselbe wie auf Englisch.
- Der Client nimmt `diagnostics.trace` nur an, wenn die Partie bzw. die
  KI-Testpartie sie angefordert hat, nur lückenlos nummeriert, und prüft am
  Ende, dass `MatchSummary.trace.entries` bzw. `AiMatchResult.trace.entries`
  genau die angekommenen Einträge zählt. Alles andere ist ein
  `protocol-violation`.

Vergleich, Prüfsumme und Abdeckung: [`engine/wasm/spike/trace.ts`](../wasm/spike/trace.ts);
die Testpartien: [`engine/fixtures`](../fixtures/README.md).

## Änderungen in Version 4 (Prompt 12)

- Start-Argument `--card-language=en-US|de-DE` (Standard: die `--language`):
  die Sprache der **Karten** in Forges Texten und Kartenansichten (Namen,
  Typzeilen, Regeltexte, über Forges `CardTranslation`), unabhängig von Forges
  eigenen Wörtern. Die App startet Forge immer deutsch und die Karten in der
  Kartensprache des Spielers. `BootReport.cardLanguage` bestätigt sie.
- `BootReport.aiProfiles`: die KI-Profile, die Forge geladen hat
  (`res/ai/*.ai`), nach Namen sortiert. `match.start` mit einem anderen Profil
  lehnt die Bridge ab (`engine.error invalid-request`, die Engine bleibt
  bereit) – Forge selbst spielte einen unbekannten Namen still mit seinen
  eingebauten Vorgabewerten.
- Nachweis, dass die Kartensprache nur Wörter ändert: die Testpartie
  `human-3-de-cards-en` (gleiche Engine-Spur wie `human-3`) und die
  Kartenprüfung „Deutsch mit englischen Karten“ auf JVM, Node und Chrome.

## Änderungen in Version 3 (Prompt 05)

- `MatchRequest.trace` und `DiagnosticsAiMatchCommand.trace` (optional, nur
  Tests), neue Nachricht `diagnostics.trace` (`DiagnosticsTrace` mit
  `TraceCheckpoint`, `TraceEvent`/`TraceEventKind`, `TraceSnapshot` …),
  `MatchSummary.trace` und `AiMatchResult.trace` (`TraceSummary`: Einträge und
  Ereignisse). Neue Konstanten `TRACE_CHECKPOINTS`, `TRACE_EVENT_KINDS`.
- Eine Partie ohne `trace` verläuft und klingt genau wie in Version 2.

## Änderungen in Version 2 (Prompt 04)

- Neues Start-Argument `--language=en-US|de-DE`; `engine.ready.boot.language`
  meldet die Sprache, `CardLoading` und `EngineLanguage` sind eigene
  Aufzählungen (auch als Konstanten `CARD_LOADINGS`, `ENGINE_LANGUAGES`).
- `engine.ready.engine.resourcesSha256`: welche Forge-Daten die Engine
  eingebaut hat (derselbe Wert wie `resources.sha256` im Manifest).
- Standard des Kartenladens ist jetzt `eager` (vorher `lazy`).
- Neuer Testbefehl `diagnostics.card-probe` mit Antwort `diagnostics.cards`.

## Änderungen gegenüber dem Spike-Protokoll `0.2-spike` (Prompt 02)

- Version ist eine Zahl (1) statt `"0.2-spike"`; `engine.ready` trägt sie.
- Jede Eingabe hat `seq`; `input.rejected` nennt sie.
- Jede Antwort nennt `kind`; eine falsche Art ist `invalid`.
- Jede Frage hat `blocking`; neu `question.answered`, damit jede Frage genau
  einmal geschlossen wird.
- Forges Fehlerdialog ist `message` mit `kind: "error"` (vorher eigener Typ
  `error`); `message` hat immer `kind`, `incorrectAction` entfällt.
- Karten-Id und Kartenansicht hängen an Fragen, Hinweisen und Ereignissen nur
  noch, wenn der Spieler die Karte sehen darf.
- Ein Zustand ohne Spiel wird nicht mehr gesendet (kein Teil-Schnappschuss);
  `game.end` hat immer alle Felder.
- Transport: `input.wait {n}` + Ein-Fach-Postfach → `engine.waiting {consumed}`
  + Ringpuffer; Worker-Nachrichten `boot/ready/fatal/protocol/response` →
  `engine.*`, Bridge-Nachrichten unverändert durchgereicht, `match.finished`.
