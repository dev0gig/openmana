# 04 — Forge-Daten und Kartenskripte

> Umsetzung von [`prompts/queue/04-forge-resources-card-scripts.md`](../../prompts/queue/04-forge-resources-card-scripts.md),
> Stand **2026-09-24**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `fbcba6e` (sauberer Build, `engineSourcesModified=false`). Grundlage:
> [`docs/research/FORGE_BUILD.md`](../research/FORGE_BUILD.md) §2 und §5,
> [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md) §5 und offene Frage 2,
> [`docs/research/LICENSES.md`](../research/LICENSES.md) §2/§4 (jupnp).
> Code: [`engine/resources.json`](../../engine/resources.json), `engine/scripts/`
> (`pack-resources.mjs`, `write-manifest.mjs`, `image-classes.mjs`, `build-wasm.sh`),
> [`CardProbe`](../../engine/bridge/src/main/java/org/openmana/engine/smoke/CardProbe.java),
> `ForgeEngine`/`EngineBoot` (Sprache), Protokoll Version 2. Alle Zahlen sind eigene Messungen
> auf odin (Intel i7-8700T, 12 Threads, 15,5 GiB RAM, Debian 13), Node 22.22.3,
> Chrome for Testing 153 headless.

## Ergebnis

**Prompt 04 ist umgesetzt.** Die Engine bettet einen **bewusst gewählten,
vollständig inventarisierten** Satz Forge-Daten aus demselben Forge-Pin ein, mit
den Originalpfaden (`res/…`). Jeder Eintrag von `forge-gui/res` ist in
`engine/resources.json` entweder eingebunden oder mit Begründung ausgelassen;
bringt ein Forge-Update einen neuen Eintrag, bricht der Build ab, bis jemand
entscheidet. Das Engine-Manifest nennt Forge-SHA, Patch-Hash, Toolchain (mit
Prüfsummen), das Ressourcen-Inventar (jede Datei mit Größe und SHA-256), was im
Modul steckt, sowie Größe und SHA-256 jedes Artefakts.

**Karten laden nachweislich, überall gleich.** Eine Kartenprüfung in der Engine
(`CardProbe`) macht aus **jeder** Karte der Datenbank (33 505 Karten, 473
Varianten) und **jedem** Tokenskript (854) eine Spielkarte, prüft je Kartenart
(normal, Transform, Modal-DFC, Schlacht, Split, Aftermath, Raum, Abenteuer,
Flip, Meld, Saga, Klasse, Alchemy) die Gesichter, jede Karte der drei neuesten
Sets (Star Trek, Reality Fracture, The Hobbit) und fünf echte Forge-Effekte, die
Karten per Namen oder zufällig aus allen Karten ins Spiel bringen. Das Ergebnis
ist auf der JVM, in Node und in Chrome **Bit für Bit gleich** (ein Fingerabdruck
über alles), faul und vollständig geladen, auf Englisch und auf Deutsch.

**Netzspiel ist draußen und bleibt draußen.** Netty kam nur über seine eigene
GraalVM-Konfiguration ins Modul (187 Klassen); die ist jetzt ausgeschlossen. Der
Wasm-Build bricht ab, sobald ein Typ von Netty, jupnp (CDDL), Jetty oder der
Servlet-API erreichbar wird, und prüft danach die Klassennamen im fertigen Modul
ein zweites Mal: **0 Klassen** aus diesen Bibliotheken.

Dazu zwei Entscheidungen mit Messung: Forges eigene Texte gibt es jetzt auch auf
**Deutsch** (`--language=de-DE`, Bible §4), und die Engine lädt Karten
standardmäßig **vollständig** (`eager`): Im faulen Modus friert das erste
„zufällige Karte aus allen Karten“ oder „Karte benennen“ Forge im Browser für
17 s ein (Chrome, ruhiger Rechner; Node 23–42 s), vollständiges Laden kostet
dagegen 1,6 s beim Start und 91 MiB. Forge bleibt alleinige Regelautorität;
OpenMana liest nur, was Forge gebaut hat.

## 1. Was gebaut wurde

| Teil | Wo | Inhalt |
|---|---|---|
| Datenauswahl | `engine/resources.json` | `include` (Pfad + Grund), `leftOut` (Pfad + Grund), `languages` (`en-US`, `de-DE`) |
| Packer | `engine/scripts/pack-resources.mjs` | packt aus dem Pin (`git archive`), prüft `resources.json` gegen den Pin (jeder Pfad existiert, jeder `res/`-Eintrag entschieden, Sprachdateien = Sprachen), schreibt Bündel, **Inventar** (`forge-res.inventory.json`) und Ressourcen-Manifest (je Ordner Dateien, Bytes, SHA-256) |
| Manifest | `engine/scripts/write-manifest.mjs` | `engine-manifest.json` Format 2 (§3) |
| Netzspiel-Sperre | `engine/scripts/build-wasm.sh`, `image-classes.mjs` | Netty-Konfiguration ausgeschlossen (`--exclude-config`), `-H:AbortOnTypeReachable` für Netty/jupnp/Jetty/Servlet, SBOM mit Klassen (`--enable-sbom=export,class-level`) → Liste aller Klassen im Modul, zweite Prüfung |
| Reflection | `gen-reflection-config.mjs`, `ListSubscribers.java --interfaces`, `record-agent-config.sh` | Schnittstellen nicht mehr registriert; Agent-Metadaten neu aufgenommen, nur noch Fremdbibliotheken (20 statt 364 Einträge); Forge-Klassen im Agent-Lauf, die der Generator nicht abdeckt, lassen die Aufnahme scheitern |
| Kartenprüfung | `bridge/…/smoke/CardProbe.java`, `jvm/JvmCardProbeMain.java` | fünf Abschnitte (§4), Fingerabdruck; Engine-Befehl `card-probe` |
| Sprache | `ForgeEngine.Language`, `EngineBoot`, `WasmMain` | Start-Argument `--language=en-US\|de-DE`; die Engine startet nicht, wenn die Sprachdateien fehlen oder Forge still auf Englisch zurückfällt |
| Kartenladen | `ForgeEngine.CardLoading.DEFAULT` | Standard `eager` (vorher `lazy`), §7 |
| Build-Fakten | `build-jvm.sh` → `openmana/engine-resources.properties` | SHA-256, Dateizahl und Sprachen des Bündels; die Engine meldet den SHA (`resourcesSha256`) und prüft die Dateizahl beim Entpacken |
| Protokoll 2 | `engine/protocol` | `BootReport.language`, `EngineBuild.resourcesSha256`, `CardLoading`/`EngineLanguage`, `diagnostics.card-probe` → `diagnostics.cards` |
| Tests | `CardProbeTest` (6), `ProtocolContractTest` (+1), Unit-Tests (+4), `node-cards.ts`, `check-card-probes.ts`, `card-probe-check.ts`, `browser-smoke.mjs --cards`, `test-engine.sh` | §8 |

## 2. Welche Forge-Daten in der Engine stecken

Belegt durch Messung: Java Flight Recorder (`jdk.FileRead`, ohne Drosselung) auf
der JVM während Start, KI-Partie (faul und vollständig) und Mensch-Partie, dazu
eine Suche im Forge-Quelltext, wer welchen Ordner liest.

| `forge-gui/res/…` | Entscheidung | Dateien | Bytes | gelesen (JFR) | Grund |
|---|---|---|---|---|---|
| `cardsfolder/` | **drin** | 33 981 | 24,7 MB | alle 33 978 Skripte, **auch im faulen Modus** | Karten, auch solche aus keinem Deck (MakeCard, CopyPermanent, Play). Darin `rebalanced/` (230 Alchemy-Karten), `upcoming/` (343 Vorschaukarten), dazu `mkzip.sh`, `.gitattributes`, `.gitkeep` (Originalordner unverändert) |
| `tokenscripts/` | **drin** | 854 | 0,15 MB | alle | Token |
| `editions/` | **drin** | 681 | 4,1 MB | alle | Drucke, Setcodes, Sammlernummern (Arena-Import), Erscheinungsdaten |
| `formats/` | **drin** | 1 341 | 1,9 MB | 13 (Sanctioned, Casual) | Formate; `Archived/` (1 301) und `Block/` nur mit `LOAD_ARCHIVED_FORMATS` bzw. Limited, als Text fast kostenlos |
| `lists/` | **drin** | 35 | 4,4 MB | 5 (`TypeLists`, `NonStackingKWList`, 3 Achievement-Listen am Spielende) | Typen und Schlüsselwörter (Legalität), Commander-Brackets; der Rest (Bild- und Decklisten) bleibt, damit der Ordner wie upstream ist |
| `blockdata/` | **drin** | 6 | 0,3 MB | 0 | Blöcke, Booster, Druckbögen: für Limited und Booster-Effekte (`MakeCard Booster$`) |
| `ai/` | **drin** | 4 | 0,08 MB | alle | KI-Profile (Bible §7) |
| `languages/en-US.properties` | **drin** | 1 | 0,18 MB | ja | Forges Meldungen, immer geladen (auch Rückfall jeder Sprache) |
| `languages/de-DE.properties`, `cardnames-de-DE.txt` | **drin (neu)** | 2 | 8,5 MB | mit `--language=de-DE` | deutsche Meldungen und Kartennamen in Fragen und Spielverlauf (§6) |
| übrige `languages/` | draußen | 16 | – | – | nur Deutsch und Englisch gehören zu OpenMana |
| `effects/` | **draußen (war drin)** | 2 | 1,6 MB | **0** | zwei GIF-Animationen von Forges **Handy-Oberfläche** (nur `forge-gui-mobile` liest `EFFECTS_DIR`); nicht komprimierbar |
| `defaults/` | **draußen (war drin)** | 9 | 0,25 MB | **0** | Fensterlayouts und Platzhalterbilder von Forges **Desktop-Oberfläche**, Vorgaben für Gauntlet/Turnier |
| `setlookup/` | draußen | 66 | 0,17 MB | 0 | wo Forge Kartenbilder sucht; Bilder kommen von Scryfall |
| `deckgendecks/`, `geneticaidecks/` | draußen | – | 11 MB | 0 | Deckgenerator (`DECKGEN_CARDBASED=false`) |
| `adventure/`, `conquest/`, `quest/`, `puzzle/`, `tutorial/` | draußen | – | ~185 MB zusammen mit den UI-Ordnern | 0 | andere Spielmodi |
| `cube/`, `draft/`, `sealed/` | draußen | – | – | 0 | Limited (kommt mit Limited, dann bewusst) |
| `skins/`, `fonts/`, `sound/`, `music/`, `howto.txt` | draußen | – | – | 0 | Forges Oberfläche |
| `licenses/` | draußen | 4 | – | 0 | Lizenztexte der Fremdbibliotheken: gehören in Credits/Notices der App (Prompt 27), nicht in die laufende Engine |

**Summe:** 36 905 Dateien, 42,3 MiB Text (vorher 36 922 Dateien, 36,0 MiB), Bündel
46,0 MB, **Brotli 4,69 MB statt 5,45 MB**: Die deutschen Texte komprimieren gut,
die weggelassenen GIF/PNG/JPG-Dateien gar nicht. Das Bündel ist
byte-reproduzierbar (sortiert, aus `git archive`), SHA-256
`7e8aebee24e13111188a163cd5f7162ded2411728a85c6abc9ac2f5d5a0e6053`.

**Originalpfade:** Das Bündel enthält die Pfade unterhalb von `forge-gui/`
unverändert (`res/cardsfolder/l/lightning_bolt.txt`); Forge findet sie über
`ForgeConstants` wie in einer Desktop-Installation. Keine Datei wird
umbenannt (anders als bei ManaBrew).

## 3. Das Engine-Manifest (`engine-manifest.json`, Format 2)

| Feld | Inhalt |
|---|---|
| `forge` | Repository und gepinnter Commit |
| `patches` | Anzahl, SHA-256 über alle Patches, Dateinamen |
| `resources` | Format, Forge-Commit (muss dem Pin entsprechen, sonst Abbruch), Dateien, Bytes, Bündelgröße, SHA-256, Sprachen, **je Ordner** Dateien/Bytes/SHA-256, ausgelassene Einträge, **Inventar** (`forge-res.inventory.json`: Datei, Anzahl, SHA-256) |
| `toolchain` | GraalVM (Version, Java-Version, SHA-256 des Archivs), Binaryen (Version, SHA-256), Maven (Version, SHA-512), Node, npm-Werkzeuge des Worker-Bundles (TypeScript, esbuild, Ajv, json-schema-to-typescript) |
| `image` | erreichbare Typen/Felder/Methoden laut `native-image`, Klassen im Modul, **Netzspiel**: erzwungene Sperren, Netzwerk-Klassen im Modul (0), verbliebene Klassen aus Forges Netzspiel-Paket |
| `protocol` | Version (2) und Schema |
| `artefacts` | `engine-worker.js`, `openmana-engine.js`, `openmana-engine.js.wasm`, `forge-res.inventory.json`: Bytes, SHA-256, gzip -9, Brotli 11 |

`forge-res.inventory.json` listet jede eingebettete Datei (`[Pfad, Bytes,
SHA-256]`, nach Pfad sortiert); so zeigt ein Forge-Update im Diff, welche
Kartenskripte sich geändert haben. Die laufende Engine meldet in
`engine.ready.engine.resourcesSha256` denselben SHA-256 wie das Manifest und
bricht den Start ab, wenn das Bündel nicht so viele Dateien hat, wie die Engine
beim Bauen gesehen hat.

## 4. Die Kartenprüfung (`CardProbe`)

Läuft **in** der Engine (JVM: `JvmCardProbeMain`; Browser/Node:
`diagnostics.card-probe`), genau wie das Spiel. Beschreibt Karten nach
**Struktur** (Kartenart, Gesichter, Typ, Kosten, Stärke, Arten der Fähigkeiten,
Auslöser, statische Fähigkeiten, Ersatzeffekte, Schlüsselwörter), nicht nach
Anzeigetext; deshalb hängt das Ergebnis nicht von der Sprache ab. Zeiten stehen
getrennt und sind nicht Teil des Fingerabdrucks.

| Abschnitt | Was | Ergebnis (alle Laufzeiten gleich) |
|---|---|---|
| Karten per Namen | fünf echte Forge-Effekte, die Forge-KI entscheidet, fester Seed: Emerald Collector beschwört **Mox Emerald** (MakeCard `Name$`); Tibalt the Chaotic wirkt eine zufällige Kopie aus einer Namensliste (**Blazing Volley**, Play `AnySupportedCard`); Garth One-Eye benennt eine Karte (**Shivan Dragon**) und darf eine Kopie wirken (NameCard + Play); Raise the Alarm erzeugt **zwei 1/1-Soldaten** (Tokenskript); Pool of Vigorous Growth erzeugt eine Token-Kopie einer **zufälligen Kreatur mit Manawert 3 aus allen Karten** (**Falcon and Redwing**, CopyPermanent `ValidSupportedCopy`) | alle fünf funktionieren, faul und vollständig mit **denselben** Karten |
| repräsentative Karten | 26 Karten, jede Kartenart Forges (Tabelle unten) | alle gefunden, alle Gesichter als Spielzustände |
| Token | **jedes** Tokenskript als Spielkarte | 854/854, 1 335 Fähigkeiten |
| neueste Sets | die drei neuesten Kern-/Erweiterungssets nach Datum, **jede** Karte darin | Star Trek (TRK, 13.11.2026) 91/91, Reality Fracture (FRA, 2.10.2026) 283/285 (2 hat Forge noch nicht umgesetzt: *Command the Stage*, *Loot, the Anomaly*), The Hobbit (HOB, 14.8.2026) 193/193 |
| Datenbank | **jede** Karte und Variante als Spielkarte, Fingerabdruck der Regeln (was die Skripte sagen) und der Spielkarten (was Forge daraus baut) | 33 505/33 505 Karten (97 130 Drucke, 85 321 Fähigkeiten), 473/473 Varianten, 682 Editionen, 0 Fehler; 2 Warnungen aus kaputten upstream-Skripten (§10) |

Repräsentative Karten (Auszug, Forges Kartenart → Spielzustände):

| Art | Karte | Forge | Zustände |
|---|---|---|---|
| normal | Lightning Bolt, Grizzly Bears, Llanowar Elves, Serra Angel, Sol Ring, Rancor, Counterspell, Wrath of God, Liliana of the Veil, Raise the Alarm, Forest | `None` | `Original` |
| Transform | Delver of Secrets, Huntmaster of the Fells | `Transform` | `Original`, `Backside` (Insectile Aberration, Ravager of the Fells) |
| Modal-DFC | Valakut Awakening, Shatterskull Smashing | `Modal` | `Original`, `Backside` |
| Schlacht | Invasion of Zendikar | `Transform` | `Original`, `Backside` (Awakened Skyclave) |
| Split / Aftermath / Raum | Fire // Ice, Cut // Ribbons, Bottomless Pool // Locker Room | `Split` | `Original`, `LeftSplit`, `RightSplit` |
| Abenteuer | Bonecrusher Giant | `Adventure` | `Original`, `Secondary` (Stomp) |
| Flip | Bushi Tenderfoot | `Flip` | `Original`, `Flipped` (Kenzo the Hardhearted) |
| Meld | Bruna, the Fading Light; Gisela, the Broken Blade | `Meld` | `Original`, `Meld` (Brisela, Voice of Nightmares) |
| Saga, Klasse, Alchemy | History of Benalia, Druid Class, A-Alrund's Epiphany | `None` | `Original` |

**Verglichen wird** (`card-probe-check.ts`, `check-card-probes.ts`): jede
Wasm-Prüfung mit der JVM-Prüfung desselben Lade-Modus über den ganzen
Fingerabdruck; auf der JVM faul gegen vollständig (gleiche Karten, Token,
Sets, Datenbank; gleiche per Namen erzeugte Karten); Deutsch gegen Englisch
(gleicher Fingerabdruck, Meldungen und Kartennamen wirklich übersetzt).

## 5. Netzspiel und jupnp

**Vorher (Stand Prompt 03), gemessen mit `-H:+PrintAnalysisCallTree`:** 187
Netty-Klassen mit 710 Methoden, 9 Klassen aus Forges Netzspiel-Paket, 0 aus
jupnp/Jetty/Servlet erreichbar; im Modul standen Klassennamen aus Netty und ein
jupnp-Typname.

**Ursachen und Maßnahmen:**

1. **Netty** kam nicht über Forges Spielcode, sondern über Nettys **eigene**
   `META-INF/native-image`-Konfiguration: Sie registriert Nettys Kanäle für
   Reflection, und damit wurde Nettys halber Transport erreichbar. `build-wasm.sh`
   schließt sie aus (`--exclude-config … 'META-INF/native-image/io\.netty/.*'`):
   **187 → 0 Klassen**, rund 400 Typen und 1 300 Methoden weniger.
2. **Veralteter Agent-Eintrag:** Die in Prompt 01 eingefrorenen
   Reachability-Metadaten registrierten `forge.gamemodes.net.NetworkLogWriter`
   (damals lief Forges tinylog-Konfiguration mit Netzwerk-Log noch). Seit
   Prompt 02 ersetzt die Engine diese Konfiguration; die Metadaten wurden mit
   dem heutigen Stand neu aufgenommen (`record-agent-config.sh`, jetzt auch mit
   einer Mensch-Partie und der deutschen Kartenprüfung) und enthalten nur noch
   Fremdbibliotheken: **20 statt 364** Einträge (345 Forge-Einträge waren
   doppelt, der Generator registriert Forge ohnehin vollständig). Nimmt der
   Agent künftig einen Forge-Zugriff auf, den der Generator nicht abdeckt, oder
   einen aus dem Netzspiel-Paket, scheitert die Aufnahme laut.
3. **jupnp-Typ über Schnittstellen:** Die neue Sperre fand beim ersten Bau
   `org.jupnp.UpnpServiceConfiguration` — „present in a Method object
   reconstructed by reflection“. Grund: Der Generator registrierte auch Forges
   **Schnittstellen**; eine registrierte Schnittstelle behält ihre
   Methodensignaturen als Reflection-Metadaten, und `IGuiBase`/`IDeviceAdapter`
   deklarieren `getUpnpPlatformService()`. Schnittstellen haben keine
   Konstruktoren, ihre Registrierung war also wirkungslos: Der Generator lässt
   jetzt alle 99 aus (`ListSubscribers.java --interfaces`).
4. **Sperren:** `-H:AbortOnTypeReachable` für `io.netty.*`, `org.jupnp.*`,
   `org.eclipse.jetty.*`, `javax.servlet.*`. Wird ein solcher Typ erreichbar,
   bricht der Build mit einer Erreichbarkeitsspur in
   `build/report/native-image-reports/` ab. Danach prüft `image-classes.mjs` die
   Klassennamen im **fertigen** Modul (aus der SBOM mit Klasseninformation):
   **6 888 Klassen, 0 aus Netty/jupnp/Jetty/Servlet.** Erreichbar sind jetzt
   11 105 Typen, 18 189 Felder und 54 542 Methoden (Prompt 03: 11 520 /
   18 800 / 55 854), für Reflection registriert 2 199 Typen (vorher 2 320).

**Was aus Forges Netzspiel-Paket bleibt (5 Klassen, kein Netzwerkcode):**

| Klasse | warum im Modul |
|---|---|
| `forge.gamemodes.net.server.FServerManager` | Patch 0006 fragt `getInstanceIfCreated()` („hostet dieser Prozess eine Netzpartie?“); die Klasse wird geladen, ein Server nie erzeugt (ohne Netty gäbe es auch nichts, womit er laufen könnte) |
| `forge.gamemodes.net.NetworkGameEventListener` | in `HostedMatch.startGame` nur im Zweig „hostet“, nie ausgeführt |
| `DeltaPacket`, `NetworkEventView`, `event.UpdateLobbyPlayerEvent` | Typen in Signaturen von Forges GUI-Klassen (Reflection-Metadaten) |

**Befund zur SBOM:** GraalVM exportiert eine CycloneDX-SBOM. Ohne
Klasseninformation listet sie **jede Bibliothek des Klassenpfads**, auch jupnp,
obwohl keine einzige jupnp-Klasse im Modul steckt; mit Klasseninformation kann
sie Klassen im Fat-JAR nur teilweise Bibliotheken zuordnen (Forge selbst und
2 627 Klassen bleiben ohne Zuordnung). Als Lizenz-Inventar der ausgelieferten
Komponenten taugt sie so nicht; das bleibt Aufgabe von Prompt 27 (Weg: das Modul
aus einzelnen JARs statt aus dem Fat-JAR bauen, oder eigene Zuordnung
Klasse → Bibliothek). Die volle SBOM liegt als Build-Bericht vor
(`build/report/engine-sbom.class-level.json`), die Liste aller Klassen in
`image-classes.txt`.

**Sentry** (Forges Absturzmelder, MIT) bleibt im Modul (197 Klassen), weil
Forge in Fehlerpfaden direkt `Sentry.addBreadcrumb` aufruft. Er wird nie
eingeschaltet (kein `Sentry.init`, kein Ziel) und hat im Browser keinen
Netzwerkweg; Bible §15 (keine versteckte Telemetrie) ist nicht berührt.

## 6. Forges Texte auf Deutsch

**Grundsatz (Vorgabe des Projektbesitzers vom 2026-09-24):** Für das System ist alles
englisch, für den Nutzer sieht alles deutsch aus. So ist es gebaut:
Kartenschlüssel, Regeln, Ids und Entscheidungen sind sprachneutral bzw.
englisch; die Sprache der Engine ändert nachweislich nur Forges eigene Wörter
(Fragen, Knöpfe, Spielverlauf), nie die Partie; Kartenbilder, -namen und -texte
kommen auf Deutsch von Scryfall (Prompt 08). Offen ist nur, woher die deutschen
Wörter für Forges Sätze kommen: Empfehlung ist Forges eigene Übersetzung als
reine Anzeigeschicht (hier eingebaut). Die Alternative, diese Sätze in der App
selbst zu formulieren, hieße Forges Text nachzubauen (Bible §9, §16).
Entscheidung und Umsetzung in der App: Prompt 12.

- Neues Start-Argument `--language=en-US|de-DE` (Standard `en-US`), gesetzt im
  `adjustPrefs`-Rückruf von `FModel.initialize` (Anvil-Lehre: danach wäre es zu
  spät). Im Browser kommen Forges Meldungen aus Ressourcen-Bündeln, die ins
  Modul kompiliert werden (`-H:IncludeResourceBundles=en-US,de-DE`,
  `-H:IncludeLocales=en-US,de-DE`), auf der JVM aus den Dateien — zwei Wege,
  deshalb prüft die Engine beim Start beides: Sprachdateien vorhanden, und
  `lblYes` ist wirklich übersetzt. Sonst startet sie nicht (Forge würde still
  auf Englisch zurückfallen).
- **Nachweis:** Kartenprüfung auf Deutsch hat denselben Fingerabdruck wie auf
  Englisch (Sprache ändert keine Karte); Meldungen („Ja“, „Nein“, „Zug
  beenden“, „Behalten“) und Kartennamen („Blitzschlag“, „Grizzlybären“,
  „Gegenzauber“) sind übersetzt. Die KI-Partie Seed 42 auf Deutsch ist dieselbe
  Partie wie auf Englisch (Züge, Sieger, Lebenspunkte, Zonen, Zahl der
  Protokolleinträge gleich, der Text anders) und auf JVM, Node und Chrome
  bitgleich; die Mensch-Partie Seed 3 auf Deutsch ist dieselbe Partie wie auf
  Englisch und läuft in Node gleich zu Ende.
- **Kartenschlüssel bleiben englisch** (`key`, Scryfall-Zuordnung); welche
  Sprache die App anzeigt und ob Forges Texte deutsch erscheinen, entscheidet
  Prompt 12 (Einstellungen). Die Kartenanzeige selbst kommt laut Bible §4 von
  Scryfall; Forges deutsche Typzeilen und Regeltexte stammen teils aus alten
  Drucken („Beschwörung von Bären“) und sind dafür nicht gedacht.
- **Bekannte Lücke upstream:** In `cardnames-de-DE.txt` heißt Forest „Forest“,
  und die Grundländer haben die Typzeile „Land“ statt „Standardland — …“ (Anvil
  hatte das im eigenen Fork korrigiert). Forges Spielverlauf auf Deutsch sagt
  deshalb „Forest“. Nicht gepatcht (die Patch-Queue gilt heute nur dem Code);
  Ziel: upstream melden oder mit Prompt 12/21 als Datenpatch.

## 7. Faules oder vollständiges Laden (Research-Frage 2)

**Korrektheit: ja.** Forge upstream (`ed0333f`) lädt Karten im faulen Modus
korrekt nach: Eine gesuchte Karte per Namen (`CardDb.getRules` →
`StaticData.lazyLoadCard`), und die ganze Datenbank, sobald ein Effekt oder eine
Entscheidung alle Karten braucht (`ensureAllCardsLoaded` in `MakeCardEffect`,
`ChooseCardNameEffect`, `CopyPermanentEffect`, `PlayEffect`,
`PlayLandVariantEffect`, `GameFormat.getAllCards`,
`PlayerControllerHuman.chooseSingleCardFace`). ManaBrews Korrekturen
(`1b515ac`/`5169c6f`) sind upstream nicht mehr nötig. Die Kartenprüfung belegt
es: dieselben erzeugten Karten, dieselbe Datenbank wie vollständig geladen, auf
JVM und im Wasm.

**Kosten:** Der faule Modus spart beim Start kaum Zeit, denn Forge **parst
trotzdem jedes Skript** einmal, um den Namensindex zu bauen, und verwirft es
danach (JFR: alle 33 978 Dateien gelesen); gespart wird Speicher. Der Preis
kommt später: Das erste Nachladen der ganzen Datenbank dauert, weil Forge dann
jede Karte gegen jede Edition abgleicht (`CardDb.loadCard` ohne Setcode, Aufwand
Karten × Editionen, rund 23 Millionen Schritte):

| | JVM | Wasm Node | Wasm Chrome |
|---|---|---|---|
| Nachladen aller Karten mitten in der Partie (faul) | 6,7–15,8 s | 23–42 s | **17,3 s** (unter Last 34,7 s) |
| Start bis „bereit“, faul / vollständig (Median aus 3) | – | 4,26 / 6,52 s | **3,46 / 5,06 s** |
| davon `FModel.initialize`, faul / vollständig | 1,9 / 2,6 s¹ | 2,49 / 4,73 s | 1,88 / 3,50 s |
| Speicher, faul / vollständig | – | Prozess 1 145 / 1 344 MiB | Worker 521 / 612 MiB (`measureUserAgentSpecificMemory`) |
| Partie Seed 42 (Forge-intern), faul / vollständig | 2,0 s¹ | 3,8 / 3,8 s | 3,1 / 3,1 s |

¹ Prompt 01. Die Browserzahlen stammen aus drei abwechselnden Läufen auf
ruhigem Rechner (12:49–12:52 Uhr); unter der Last anderer Sitzungen auf odin
streuten sie bis zum Doppelten. Auf einem Handy wären alle Zeiten ein
Vielfaches.

Betroffen sind nicht nur Sonderfälle: **Jede** Karte, bei der der Spieler einen
Kartennamen wählt (Pithing Needle, Meddling Mage, Cranial Extraction …), löst
im faulen Modus beim ersten Mal das Nachladen aus. **Entscheidung:** Standard
ist jetzt `eager` (`ForgeEngine.CardLoading.DEFAULT`, Start-Argument
`--card-loading`, Protokoll-Beschreibung); `lazy` bleibt wählbar und getestet.
Die Oberfläche (Prompt 11) übergibt den Modus ausdrücklich.

## 8. Nachweise

### 8.1 Unit-Tests (65, `build-host.sh`)

Neu: Worker-Host `diagnostics.card-probe` (Antwort `diagnostics.cards`, danach
ist der Worker verbraucht; vor `engine.ready` `not-ready`), eine scheiternde
Kartenprüfung ist ein technischer Abbruch; Client `runCardProbe` (Status
`diagnostics` → `finished`, Ergebnis gespeichert), `diagnostics.cards` außerhalb
einer Diagnose ist ein Protokollverstoß. Beispiele und Schema-Tests für
Protokoll 2; die Tests nutzen jetzt `PROTOCOL_VERSION` statt einer festen Zahl.

### 8.2 JVM (45 Tests im Maven-Build)

- **Neu `CardProbeTest` (6):** keine Befunde; die fünf Effekte erzeugen die
  erwarteten Karten, der letzte lädt die ganze Datenbank; jede Kartenart mit
  ihren Gesichtern (Transform, Modal, Schlacht, Split, Raum, Abenteuer, Flip,
  Meld); jedes Tokenskript; die drei neuesten Sets (jede Karte geladen oder als
  „nicht umgesetzt“ gemeldet); jede Karte der Datenbank als Spielkarte.
- **`ProtocolContractTest` +1:** Sprachen (`ForgeEngine.Language` = Schema =
  Sprachen des Bündels), Lade-Modi, jedes `EngineBuild`-Feld von
  `EngineBoot.engineInfo()` im Schema.
- Die übrigen 38 Tests unverändert grün.

### 8.3 Engine-Testmatrix (`test-engine.sh`)

45 Läufe, **0 Fehler** (odin, Commit `fbcba6e`, 13,6 min):

| Lauf | JVM | Wasm Node | Wasm Chrome |
|---|---|---|---|
| KI-Partie Seed 42 faul / vollständig | `d7611b0e…` (wie seit Prompt 01) | = JVM | = JVM |
| KI-Partie Seed 7 | `0d52aafc…` (wie seit Prompt 01) | = JVM | = JVM |
| KI-Partie Seed 42 **deutsch** | `5fc5fd3c…`: dieselbe Partie wie englisch (20 Züge, Sieger, Leben, Zonen, 444 Einträge) | = JVM | = JVM |
| Mensch-Partien 3, 11, 5-defend, 3-concede | Forge-Protokoll bitgleich wie seit Prompt 02 (`c1e990c6…`, `7c3f673f…`, `e8213ffe…`, `6737df12…`); alle 1 320 Nachrichten der fünf Partien (auch der deutschen) schemakonform | Wiederholung faul und mit 256-Byte-Warteschlange (3–11× Umbruch, 3–11× voll) = JVM | Wiederholung faul (alle vier) und eng (3, 11) = JVM |
| Mensch-Partie 3 **deutsch** | `74c6cf69…`: dieselbe Partie wie englisch (15 Züge, 44 Eingaben, 324 Einträge, gleiche Entscheidungsfolge) | Wiederholung = JVM | – |
| Kartenprüfung faul | Fingerabdruck `1e7a32d0…` | = JVM | = JVM |
| Kartenprüfung vollständig | `bb7d62a0…`; faul = vollständig in Karten, Token, Sets, Datenbank und erzeugten Karten | = JVM | = JVM |
| Kartenprüfung **deutsch** | `1e7a32d0…` = englisch; Meldungen und Namen übersetzt | = JVM | – |
| Fehlerpfade des Protokolls | – | Versionskonflikt 66 ms, abgelehntes Deck → derselbe Worker spielt weiter, Abbruch mitten in der Partie, kaputte Nummerierung | Versionskonflikt 102 ms |
| ohne COOP/COEP | – | – | klare Meldung nach 86 ms |

Die Entscheidungs-Fingerabdrücke der Mensch-Partien haben sich gegenüber Prompt 03
geändert (`0bb46f13…` statt `21a39a3a…` bei Seed 3), weil `game.started` jetzt
Protokoll 2 nennt; Forges Spiel und die Entscheidungsfolge sind gleich.

## 9. Messwerte

odin, sauberer Build auf `fbcba6e`, Chrome for Testing 153 headless, Node 22.22.3.

| Größe | Wert |
|---|---|
| Build gesamt (`build.sh`) | 392,9 s; `build-host` 2,0 s (65 Unit-Tests), `pack-resources` 2,2 s, Maven mit 45 Tests 66,7 s (2,4 GiB Spitze), `native-image` 140,9 s (5,4 GiB Spitze), dazu Manifest mit Brotli-Messung (Prompt 03: 386,2 s) |
| Forge-Datenbündel | 36 905 Dateien, 42,3 MiB Text, Bündel 46,0 MB, Brotli 4,69 MB (Prompt 03: 36 922 Dateien, 36,0 MiB, 39,4 MB, Brotli 5,45 MB) |
| Wasm-Modul | 79 093 118 B = 75,4 MiB roh, 19,6 MiB gzip -9, **12,45 MiB Brotli 11** (Prompt 03: 69,2 / 19,5 / 13,2 MiB): größer im Speicher (+6,5 MB Bild-Heap: deutsche Texte), kleiner über die Leitung (−0,8 MB) |
| Worker-Bundle `engine-worker.js` | 333 KiB roh, 32 KiB gzip, 24 KiB Brotli (neue Prüfer für Protokoll 2) |
| Inventar `forge-res.inventory.json` | 4,1 MiB roh, 1,5 MiB Brotli (nur Prüfwerkzeug, nicht für den Browser) |
| Im Modul | 11 105 erreichbare Typen, 6 888 Klassen, 0 aus Netzwerk-Bibliotheken |
| Start bis „bereit“ (Chrome, Median) | faul 3,46 s (Prompt 03: 3,4–3,5 s), vollständig 5,06 s — das größere Bündel kostet beim Start nichts Messbares (Entpacken 0,73 s wie zuvor) |
| Worker-Speicher (Chrome) | faul 521 MiB, vollständig 612 MiB (Prompt 03: 502 / 593 MiB; +19 MiB für die deutschen Texte im Bündel) |
| Kartenprüfung, Dauer | JVM 17,6 s (faul) / 19,3 s (vollständig) / 28 s (faul, deutsch) je Prozess; Node 20–64 s; Chrome 30 s (vollständig) bis 61 s (faul, unter Last) |
| Kartenprüfung, Speicher | Chrome bis 2,1 GiB alle Prozesse (Worker 735–779 MiB), Node-Prozess bis 2,1 GiB: sie baut jede Karte als Spielkarte, eine Partie braucht davon einen Bruchteil |
| Deutsch zur Laufzeit | Karten als Spielkarten bauen dauert auf Deutsch länger (JVM-Datenbankdurchlauf 8,4 statt 6,7 s: Übersetzungen je Karte); in einer Partie mit 60–100 Karten nicht spürbar |

## 10. Befunde

- **Forge parst im faulen Modus beim Start trotzdem alle Skripte** (für den
  Namensindex) und lädt später die ganze Datenbank mit dem Aufwand
  Karten × Editionen nach (§7).
- **Nettys eigene GraalVM-Konfiguration** zog 187 Netty-Klassen ins Modul, ohne
  dass Forge sie brauchte (§5).
- **Registrierte Schnittstellen** halten ihre Methodensignaturen als
  Reflection-Metadaten: so wurde jupnp als Typ erreichbar (§5).
- **GraalVMs SBOM** beschreibt den Klassenpfad, nicht das Modul, und kann im
  Fat-JAR kaum zuordnen (§5) → Prompt 27.
- **Kaputte upstream-Skripte**, auf allen Laufzeiten gleich gemeldet:
  „SVar 'TrigSwitch' not defined in Card (Desert Were-Worm)“ und
  „SubAbility 'DBCleanup' not found for: Nascent Metamorph“. Forge baut die
  Karten trotzdem; ob sie im Spiel richtig wirken, entscheidet Forge. Kandidaten
  für einen upstream-Hinweis.
- **Zeitabhängigkeit in Forge:** Forge ordnet Vorschaukarten
  (`cardsfolder/upcoming`, 343) dem ersten Set zu, dessen Datum in der Zukunft
  liegt (heute Star Trek), und liest Editionsdaten in der Zeitzone der Laufzeit
  (JVM und Browser: die des Geräts, hier Europe/Vienna). Am Erscheinungstag
  eines Sets kann sich deshalb die Zuordnung von Drucken ändern (nicht die
  Regeln). Für Wiederholungen aufgezeichneter Partien über ein Erscheinungsdatum
  hinweg (Prompt 22) wichtig.
- **Sentry** ist Teil von Forges Fehlerpfaden (197 Klassen im Modul), bleibt
  aber aus (§5).
- **Forges deutsche Grundländer** (§6).
- Die Messungen liefen teils, während auf odin andere Sitzungen arbeiteten
  (Lastmittel bis 12); Zeiten schwanken deshalb. Verglichen wird innerhalb
  desselben Laufs.

## 11. Entscheidungen und Abweichungen

| Entscheidung | Branchenüblich? | Begründung |
|---|---|---|
| **`effects/` und `defaults/` nicht eingebettet**, obwohl der Prompt sie nennt | ja: nur ausliefern, was die Laufzeit braucht, belegt durch Messung | Die Research hatte sie als „Vorgaben“ eingeordnet; tatsächlich sind es Animationen und Layouts von Forges eigenen Oberflächen. Die Engine liest sie nie (JFR, Quelltextsuche); `effects/` allein wären ~12 % des Downloads gewesen. Bewusste, dokumentierte Abweichung |
| **Jeder `res/`-Eintrag muss entschieden sein**, sonst Build-Abbruch | ja (explizite Allowlist mit Begründung, „fail closed“) | Ein Forge-Update mit neuem Datenordner fällt beim Bauen auf, nicht beim Spieler |
| **Ganze Ordner statt Einzeldateien** (z. B. alle `lists/`, alle `formats/`) | ja | Robust gegen Forge-Updates (neue Dateien sind automatisch dabei); ungelesene Textdateien kosten komprimiert fast nichts |
| **Inventar als eigene Datei**, Manifest klein | ja (Prüfsummenlisten neben Artefakten, wie `SHA256SUMS`) | Das Manifest bleibt lesbar (5 KB); das Inventar (4 MB) ist für Prüfung und Diff da |
| **Deutsch jetzt einbetten**, Standard Englisch | ja (Sprachressourcen liefert die Engine, die Sprache wählt die App) | Bible §4 und Research-Plan §5; +1,1 MB Brotli, durch das Weglassen von `effects/` mehr als ausgeglichen; die Wahl in der App gehört zu Prompt 12 |
| **Standard `eager`** statt `lazy` | – | Messung §7: 1,6 s beim Start gegen 17–42 s Stillstand mitten in der Partie |
| **Netzspiel per Sperre** statt Bibliotheken aus dem JAR zu löschen | ja (Build-Policy per Analyse, z. B. „forbidden dependencies“) | Löschen hätte die JVM-Referenz verändert (anderer Klassenpfad als im Browser) und Fehler auf die Laufzeit verschoben; die Sperre zeigt die Ursache mit Spur |
| **Kartenprüfung in der Engine** statt Einzeltests pro Karte | ja (Golden-Master/Fingerprint-Vergleich über Laufzeiten) | Ein Durchlauf prüft alle 33 505 Karten auf JVM und im Browser; Abweichungen zeigt `card-probe-check.ts` je Abschnitt |
| **Protokoll 2** | – | `language`, `resourcesSha256` und der Diagnosebefehl sind Vertragsänderungen; genaue Versionsgleichheit wie in 03 |
| SBOM nicht als Lizenzinventar | – | Befund §5; Prompt 27 |

## 12. Bekannte Lücken (bewusst offen, mit Ziel-Prompt)

| Lücke | Wirkung heute | wohin |
|---|---|---|
| Lizenzinventar der tatsächlich enthaltenen Bibliotheken (SBOM-Zuordnung im Fat-JAR unbrauchbar) | Klassennamen und Netzwerk-Sperre sind belegt, die Bibliotheksliste nicht | 27 |
| Deutsche Grundländer in Forges Daten | „Forest“ im deutschen Spielverlauf | 12/21, upstream |
| Sprachwahl in der App, Anzeige von Forges deutschen Texten | Engine kann es, die App fragt noch nicht | 12 |
| Limited-Daten (`cube/`, `draft/`, `sealed/`) | Limited nicht möglich | wenn Limited kommt |
| Zwei kaputte upstream-Kartenskripte | Forge meldet sie, baut die Karten | upstream |
| Speicher der Kartenprüfung selbst (lädt jede Karte) | nur ein Testwerkzeug | – |

Die Lücken aus 02 §8 und 03 §9 bleiben unverändert offen.

## 13. Offene Fragen der Research: Stand nach 04

| # | Frage | Stand |
|---|---|---|
| 2 | Lazy Loading und namentlich erzeugte Karten | **Beantwortet** (§7): upstream korrekt, ManaBrews Korrekturen unnötig; eager kostet in Chrome 1,6 s beim Start und 91 MiB, lazy 17 s (Chrome) bis 42 s (Node) Stillstand beim ersten Bedarf aller Karten → Standard eager |
| 3 | Verhaltensgleiche Übersetzung | weitere Belege: jede Karte, jedes Token und die fünf Effekte JVM = Node = Chrome. Vollständiger Differenztest bleibt Prompt 05 |

Die übrigen Fragen stehen wie in [`01-engine-spike.md`](01-engine-spike.md) §7.

## 14. Reproduzieren

```bash
git submodule update --init --depth 1 engine/forge   # einmalig
bash engine/scripts/build.sh                          # ~6,5 min
bash engine/scripts/test-engine.sh                    # ~14 min
```

Einzeln: `java -cp engine/build/jvm/openmana-engine-jvm.jar
org.openmana.engine.jvm.JvmCardProbeMain --bundle
engine/build/resources/forge-res.bin --card-loading lazy --language de-DE`,
`node engine/wasm/test/node-cards.ts --card-loading eager --expect <jvm.json>`,
`node engine/wasm/test/browser-smoke.mjs --cards --card-loading lazy`. Welche
Dateien Forge liest: JVM mit
`-XX:StartFlightRecording:filename=x.jfr,jdk.FileRead#enabled=true,jdk.FileRead#threshold=0ms,jdk.FileRead#throttle=off`
starten, dann `jfr print --events jdk.FileRead x.jfr`.

## 15. Was als Nächstes kommt

**Prompt 05 — JVM/WASM differential tests** (nicht begonnen): ein Testgerüst
für gleichwertige skriptgesteuerte Partien auf JVM- und Wasm-Bridge mit festen
Seeds über strukturierte Spuren (Mulligan, Länder und Zauber, Priorität, Kosten,
Ziele, Stapel, Kampf, Zonen, Spielende, Commander). Die Kartenprüfung und die
Vergleichswerkzeuge dieses Prompts sind dafür eine Grundlage.
