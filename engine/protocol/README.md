# OpenMana-Protokoll (Version 1)

Der **einzige Vertrag** zwischen der OpenMana-Oberfläche und der Engine (Forge
im Dedicated Worker). Die Oberfläche sieht keine Forge-Klassen und rechnet
keine Regel aus; Forge entscheidet alles, das Protokoll transportiert und
prüft nur. Eingeführt mit Prompt 03, Nachweise in
[`docs/implementation/03-worker-transport-protocol.md`](../../docs/implementation/03-worker-transport-protocol.md).

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

- `ProtocolVersion` ist eine ganze Zahl (jetzt **1**). UI, Worker-Host und
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
| `engine.ready` | Forge ist bereit: `protocol`, `engine` (Forge-Version und -Commit, Patch-Zahl und -Hash, OpenMana-Commit, `engineSourcesModified`, `synchronous`), `boot` (Ressourcen, Zeiten, Kartenladen) |
| `engine.waiting` | Die Warteschlange ist leer und Forge wartet auf den Spieler. `consumed` = gelesene Eingaben; alles bis dahin ist fertig verarbeitet. Eine wartende Engine ist nicht „hängend“ |
| `engine.error` | Ein Befehl schlug fehl, der Worker bleibt nutzbar: `deck-rejected` (mit `report.unknownCards`), `invalid-request`, `not-ready`, `already-started` |
| `engine.abort` | **Technischer Abbruch**, kein Spielergebnis; der Worker ist verloren (siehe unten) |
| `match.finished` | Forge hat die Partie verlassen; technische Zusammenfassung (Hashes, Zähler) |
| `diagnostics.result` | Ergebnis einer KI-gegen-KI-Testpartie (nur Tests) |
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
(`MatchRequest`: Seed, Format, Mensch mit Deck, KI mit Profil und Deck),
`diagnostics.ai-match` (nur Tests). Befehle wirken nur, wenn der Worker frei
ist: Während einer Partie steckt er in Forges Java-Stack und liest nur die
Warteschlange.

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
npm run test:unit         # Protokoll, Client, Worker-Host (node:test)
npm run bundle            # Worker- und Diagnose-Bundle (esbuild)
```

`engine/scripts/build-host.sh` macht alles zusammen und läuft als erster
Schritt von `build.sh`.

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
