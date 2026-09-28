# Testdaten der Differenztests (Prompt 05)

Hier liegen die Partien, mit denen `engine/scripts/test-engine.sh` die Engine
auf der JVM und als WebAssembly (Node, Chrome) vergleicht. Jede Partie läuft
mit festem Seed; ein regelfreier Testspieler (`ScriptedHuman`) spielt sie auf
der JVM, seine Eingaben und die **Engine-Spur** werden aufgezeichnet, Node und
Chrome spielen die Eingaben nach und müssen **dieselbe Spur** erzeugen. Die
Spur (`diagnostics.trace`, siehe
[`docs/implementation/05-engine-differential-tests.md`](../../docs/implementation/05-engine-differential-tests.md))
besteht aus Forges eigenen Ereignissen und vollständigen Schnappschüssen an
festen Punkten – nur Ids, englische Kartenschlüssel, Aufzählungsnamen und
Zahlen, keine Texte. Jede Abweichung lässt den Test scheitern und nennt die
Stelle in der Partie.

```
fixtures/
├── decks/           Decks im Protokoll-Format (MatchRequest.deck), eine Datei je Deck
└── differential/    eine Datei je Partie (Name = Dateiname)
```

## Eine Partie

```json
{
  "description": "Wozu die Partie da ist",
  "match":  { "seed": 7, "format": "constructed",
              "human": { "name": "Player", "deck": "smoke-green" },
              "ai":    { "name": "Forge AI", "profile": "Default", "deck": "smoke-red" } },
  "player": { "attack": "alternate", "block": "assign", "play": "all", "concedeInTurn": 0 },
  "engine": { "language": "en-US", "cardLoading": "eager" },
  "wasm":   { "node": ["lazy", "eager"], "browser": ["lazy"] },
  "covers": ["block", "block-multi", "…"]
}
```

- `match`: die Anfrage an die Engine; `deck` nennt eine Datei in `decks/`.
  Der Seed ist Pflicht (reproduzierbar). Die Engine-Spur schaltet das
  Werkzeug selbst ein (`"trace": true`).
- `player`: die Regel des Testspielers. Er kennt keine Karte und keine Regel,
  er wählt unter dem, was Forge anbietet. `attack`: `all` (jede Kreatur, für
  die Forge einen Angriff anbietet), `none`, `alternate` (in jedem zweiten
  eigenen Kampf). `block`: `none`, `one` (ein Blocker je Kampf, Forge wählt den
  Angreifer), `assign` (Angreifer antippen, dann einen von Forge angebotenen
  Blocker; erst einer je Angreifer, dann ein zweiter für den ersten).
  `play` (Prompt 16): `all` (bei der Priorität jede Karte, die Forge als
  spielbar markiert, einmal je Schritt), `respond` (hält seine Karten für
  Antworten zurück: bei leerem Stapel nur Länder – Forges eigene Worte „Spiele
  ein Land“ –, liegt etwas auf dem Stapel, jede spielbare Karte einmal je
  Stapeltiefe; so bekommt er Priorität im Zug der KI und antwortet auf ihre
  Zaubersprüche). `target` (Prompt 17): `cards` (wo Forge Karten und Spieler
  anbietet, zuerst die Karten), `players` (zuerst den Gegner). Einen Spieler
  tippt er nur an, wo der Zustand ihn als wählbar markiert (`selectable`);
  beim Bezahlen nutzt er zuerst schwebendes Mana, das Forge nähme
  (`mana.use`), dann Leben, wo Forge es nimmt (Phyrexia-Mana).
  `concedeInTurn`: aufgeben ab diesem Zug (0 = nie).
- `engine`: Sprache (`en-US`, `de-DE`), Kartensprache (`cardLanguage`, Standard:
  die Sprache; die Karten in Forges Texten, seit Prompt 12) und Kartenladen
  (`eager`, `lazy`).
- `wasm`: welche Wiederholungen laufen – Node und Chrome, je `lazy` (eine
  Eingabe je Warten, Client und Engine müssen jede Eingabe gleich beurteilen)
  und/oder `eager` (256-Byte-Warteschlange: Umbruch, volle Warteschlange).
- `covers`: was die Partie nachweislich zeigen muss (Kategorien aus
  [`engine/wasm/spike/trace.ts`](../wasm/spike/trace.ts), `COVERAGE`, und
  `zone:<Von>-><Nach>`). Zeigt die Spur es nicht mehr – etwa weil ein
  Forge-Update die KI anders spielen lässt –, scheitert der Test, statt still
  weniger zu prüfen. Zusammen müssen alle Partien abdecken, was Prompt 05
  verlangt (`REQUIRED_COVERAGE`).

Eine **Variante** ist dieselbe Partie mit anderen Engine-Einstellungen und muss
exakt dieselbe Spur haben:

```json
{ "description": "…", "sameGameAs": "human-3", "engine": { "language": "de-DE" }, "wasm": { "node": ["lazy"], "browser": [] } }
```

Unbekannte Felder, Seeds ohne Zahl, unbekannte Decks oder Kategorien lehnt
[`engine/wasm/test/fixtures.ts`](../wasm/test/fixtures.ts) ab (auch als
Unit-Test bei jedem Build).

## Die Partien

| Partie | Decks | Spieler | deckt vor allem ab |
|---|---|---|---|
| `human-3` | Rot+ gegen Grün, Seed 3 | greift an, blockt nie | Mulligan, Länder und Zauber, Priorität, Kosten automatisch und von Hand, Ziele auf Karten und Spieler, Hellsicht, Modi, Niederlage durch Leben (Referenzpartie seit Prompt 02) |
| `human-11` | dieselben, Seed 11 | wie oben | Abenteuer (Optionen), zwei Karten abwerfen, Exil |
| `human-5-defend` | dieselben, Seed 5 | greift nie an, ein Blocker je Kampf | Blocken, Priorität abgeben |
| `human-3-concede` | dieselben, Seed 3 | gibt in Zug 3 auf | Aufgeben |
| `human-3-de` | Variante von `human-3` | – | Deutsch: dieselbe Spur wie Englisch |
| `human-3-lazy` | Variante von `human-3` | – | faules Kartenladen: dieselbe Spur (nur JVM) |
| `human-3-de-cards-en` | Variante von `human-3` | – | Deutsch mit englischen Karten (Prompt 12): dieselbe Spur (JVM, Node) |
| `blocks-multi` | Grün gegen Rot, Seed 7 | greift jeden zweiten Kampf an, ordnet Blocker zu | zwei Angreifer in einem Kampf geblockt, Kampfschaden verteilen |
| `blocks-double` | dieselben, Seed 12 | wie oben, gibt in Zug 13 auf | ein Angreifer von zwei Kreaturen geblockt |
| `stack-response` | Grün gegen rote Instants, Seed 3 | greift an | die KI antwortet auf einen Zauber (Stapeltiefe 2, LIFO), Sieg |
| `priority-respond` | rote Instants gegen Grün, Seed 3, deutsch | hält Instants zurück (`play: respond`), blockt nie | Priorität im Zug der KI (nur wo Forge etwas für den Spieler findet), Antwort des Spielers auf den Zauber der KI (Stapeltiefe 2), Niederlage (Prompt 16) |
| `commander` | Krenko gegen Fynn (je 100 Karten, regelkonform), Seed 5 | greift an | Kommandant aus der Kommandozone, zurück dorthin, erneut mit Kommandantensteuer, Kommandantenschaden, 40 Leben, Sieg |

## Eine Partie hinzufügen

1. Deck(s) nach `decks/`, Partie nach `differential/`; `covers` zunächst leer
   lassen ist nicht erlaubt – eine Partie muss sagen, wozu sie da ist.
2. Spielen und Abdeckung ansehen:
   `node engine/wasm/test/fixtures.ts resolve /tmp/s && java -cp engine/build/jvm/openmana-engine-jvm.jar org.openmana.engine.jvm.JvmHumanMatchMain --bundle engine/build/resources/forge-res.bin --scenario /tmp/s/<name>.scenario.json --out /tmp/<name>.json`,
   dann `node engine/wasm/test/check-traces.ts --transcripts <Ordner>`.
3. `covers` auf das setzen, was die Partie zuverlässig zeigt, und
   `bash engine/scripts/test-engine.sh` laufen lassen.

Kein Deck und keine Partie ist eine Regel: Nichts in OpenMana darf auf diese
Namen reagieren (Bible §2).

## Die KI-Profil-Studie (Prompt 12)

`ai-profile-study.json` ist kein Differenztest, sondern der Plan der Messung,
was Forges KI-Profile ändern (`bash engine/scripts/ai-profile-study.sh`,
Ergebnis und Schlüsse in
[`docs/research/AI_PROFILES.md`](../../docs/research/AI_PROFILES.md)): drei
Decks als Spiegelpartie (`decks/study-aggro-red.json`,
`study-midrange-gw.json`, `study-control-ub.json`, je 60 Karten), jedes
Nicht-Standard-Profil gegen „Default“ in beiden Sitzreihenfolgen je Seed,
„Default“ gegen sich selbst als Kontrolle.
