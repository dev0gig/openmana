# Forges KI-Profile: was sie wirklich ändern

> Research zu Prompt 12, Stand **2026-09-25**. Forge
> [`Card-Forge/forge@ed0333f`](https://github.com/Card-Forge/forge/tree/ed0333fecb1fea0671b3e50cadc1da4f71db5798)
> (Version 2.0.15), die vier Profildateien `forge-gui/res/ai/*.ai` dieses Stands
> (SHA-256 in [`src/game/ai-profile-table.ts`](../../src/game/ai-profile-table.ts)).
> Grundlage: Bible §7 („vor Easy/Normal/Hard erst das Verhalten testen und
> ehrlich benennen“). Zwei Wege: der Vergleich der Profilwerte samt der
> Forge-Stellen, die sie lesen (§2), und 2 400 Partien Forge-KI gegen Forge-KI
> (§3–§4). Messungen auf odin (Intel i7-8700T, 12 Threads), GraalVM-JDK
> 25.0.4, JVM-Build der Engine.

## Ergebnis

- **Forge kennt keine Schwierigkeitsstufen.** Ein Profil ist eine Liste von
  121 Stellschrauben der KI (`AiProps`): Wahrscheinlichkeiten und Schwellen,
  wann sie angreift, blockt, kontert, Kampftricks zurückhält, Mulligans nimmt.
  Die vier Profile unterscheiden sich in 80 davon – die meisten betreffen
  seltene Karten oder Spielvarianten, die OpenMana nicht spielt.
- **Keines der Profile ist messbar stärker oder schwächer als Forges Vorgabe.**
  In je 600 Spiegelpartien gegen „Default“ gewann „Cautious“ 47,5 %,
  „Experimental“ 48,2 %, „Reckless“ 52,5 %; jedes 95-%-Intervall enthält
  50 %, der gepaarte Vorzeichentest je Startwert bleibt über 0,05
  (p = 0,067 / 0,161 / 0,082). Die Tendenz (Waghalsig etwas öfter,
  Vorsichtig etwas seltener vorn) ist mit diesen Daten nicht belegt.
- **Die Profile ändern den Stil, und das sichtbar:** „Reckless“ greift mit
  einem Midrange-Deck 26 % öfter mit Kreaturen an (0,86 statt 0,68 je Zug),
  blockt seltener und kontert mit dem Kontrolldeck 12 % öfter; „Cautious“
  greift mit dem Kontrolldeck seltener an und kontert seltener;
  „Experimental“ liegt nahe an „Default“. Mit einem reinen Aggro-Deck spielen
  alle vier praktisch gleich.
- **Kein Profil schummelt.** Alle vier setzen `CHEAT_WITH_MANA_ON_SHUFFLE=true`,
  doch das wirkt nur, wenn Forges Einstellung „KI darf schummeln“ an ist; die
  Engine schaltet sie ab (`ForgeEngine`: `UI_ENABLE_AI_CHEATS=false`), und
  OpenManas Partien haben ohnehin eigene `GameRules` (Vorgabe: aus). Beides
  prüft `AiProfilesTest`.
- **Ein unbekannter Profilname wäre still falsch gewesen:** Forge nimmt jeden
  Namen und spielt dann mit den eingebauten Vorgaben von `AiProps` – die keinem
  Profil entsprechen (z. B. Konter-Chance bei Manawert 1: 50 statt 30 %). Die
  Bridge lehnt deshalb jedes Profil ab, das Forge nicht geladen hat
  (`engine.error invalid-request`), und die Engine nennt ihre Profile beim
  Start (`BootReport.aiProfiles`).

**Für die App heißt das:** Die Profile heißen, was sie sind –
„Standard“, „Vorsichtig“, „Waghalsig“, „Experimentell“ (Übersetzungen von
Forges Namen) –, beschrieben durch belegte Verhaltensunterschiede, nie durch
„leicht“ oder „schwer“. Dazu steht, was die Messung ergab: keine
Schwierigkeitsstufen, kein messbarer Stärkeunterschied (§5).

## 1. Was ein Profil in Forge ist

- `AiProfileUtil.loadAllProfiles` liest beim Start (`FModel.initialize`) jede
  Datei `res/ai/<Name>.ai` als Liste `Eigenschaft=Wert`. Eine unbekannte
  Eigenschaft bricht den Start ab (`AiProps.valueOf`).
- Ein KI-Spieler trägt einen Profilnamen (`LobbyPlayerAi.setAiProfile`); jede
  KI-Entscheidung fragt `AiProfileUtil.getAIProp(spieler, eigenschaft)`. Fehlt
  der Name unter den geladenen Profilen, liefert Forge den **eingebauten
  Vorgabewert** der Eigenschaft (`AiProps.getDefault()`), ohne Warnung.
- Forges Oberflächen bieten zusätzlich „Random (Every Match)“ und „Random
  (Every Game)“ an (`getProfilesDisplayList`). Das sind keine Profile, sondern
  Anweisungen an die Oberfläche; `createAiPlayer` mit festem Profilnamen (so
  ruft die Bridge Forge auf) kennt sie nicht. OpenMana zieht „Zufällig“
  deshalb selbst, je Partie (eine Partie ist hier ein Match aus einem Spiel,
  „Every Match“ und „Every Game“ fallen zusammen).
- Welche Profile es gibt, bestimmt allein der Ordner: Die Engine meldet sie
  sortiert (`ForgeEngine.aiProfiles()`: die Reihenfolge von `File.list()`
  unterscheidet sich zwischen JVM und dem Dateisystem des Browsers).

## 2. Die Werte im Vergleich

80 der 121 Eigenschaften unterscheiden sich zwischen den vier Dateien. Geprüft
wurde für jede, welche Forge-Stelle sie liest (`forge-ai`), und ob sie in
OpenMana überhaupt wirken kann. **Nicht wirksam** in OpenMana:

| Eigenschaften | Warum nicht |
|---|---|
| `SIDEBOARDING_*` (4) | Sideboarding gibt es nur zwischen zwei Spielen eines Matches; OpenManas Matches haben ein Spiel, und ihre `GameRules` (Bridge und Studie bauen sie selbst, nicht über Forges Einstellungen) lassen KI-Sideboarding aus (Vorgabe `false`) |
| `DEFAULT_*PLANAR_DIE*`, `PLANAR_DIE_ROLL_HESITATION_CHANCE`, `MOMIR_*`, `MOJHOSTO_*` (7) | Planechase, Momir Basic und MoJhoSto – Varianten, die OpenMana nicht spielt |
| `CHEAT_WITH_MANA_ON_SHUFFLE` | wirkt nur mit erlaubtem KI-Schummeln (aus, s. o.) |
| `ACTIVELY_PROTECT_VS_CURSE_AURAS` | wird im Code von `ed0333f` nirgends gelesen |
| `CHANCE_TO_ATKTRADE_WHEN_OPP_HAS_MANA`, `ATTACK_INTO_TRADE_WHEN_TAPPED_OUT`, `RANDOMLY_ATKTRADE_ONLY_ON_LOWER_LIFE_PRESSURE` bei „Cautious“, „Default“, „Experimental“ | wirken nur, nachdem `CHANCE_TO_ATTACK_INTO_TRADE` gewürfelt hat – das steht bei diesen drei auf 0 (`AiAttackController` Z. 1244–1256) |
| `MAX_DIFF_IN_CREATURE_COUNT_TO_TRADE` | zählt nur mit `RANDOMLY_TRADE_EVEN_WHEN_HAVE_LESS_CREATS=true` – in allen vier Profilen `false` (`AiBlockController` Z. 1342) |

**Wirksam und spürbar** (Werte: Cautious / Default / Experimental / Reckless;
Fettdruck = weicht von Default ab):

| Bereich | Eigenschaft (Forge-Stelle) | Werte | Was es bewirkt |
|---|---|---|---|
| Angriff | `PLAY_AGGRO`, `CHANCE_TO_ATTACK_INTO_TRADE` (`AiAttackController` Z. 399, 1240–1243) | false/false/false/**true**; 0/0/0/**100** | Nur „Reckless“ wählt die Angriffsstufe „angreifen, auch wenn es einen Abtausch kostet“, sobald der Gegner nicht in Reichweite ist, und hält weniger Kreaturen als Blocker zurück |
| Angriff | `TRY_TO_AVOID_ATTACKING_INTO_CERTAIN_BLOCK` (Z. 1428) | **false**/true/true/true | „Cautious“ lässt eine Zusatzprüfung gegen nutzlose Angriffe in sichere Blocks weg (widerspricht dem Namen, fällt in den Messungen nicht auf) |
| Blocken | `MIN/MAX_CHANCE_TO_RANDOMLY_TRADE_ON_BLOCK`, `ALSO_TRADE_WHEN_HAVE_A_REPLACEMENT_CREAT` (`AiBlockController` Z. 1289–1340); `PLAY_AGGRO` setzt den Mindestgewinn eines unnötigen Abtauschs auf 0 (Z. 1051) | **40–65**/30–70/30–70/**0–50**; **false**/true/true/true | Wie oft die KI zum Tausch blockt, abhängig von ihren Lebenspunkten |
| Verteidigung | `AI_IN_DANGER_THRESHOLD`, `AI_IN_DANGER_MAX_THRESHOLD` (`ComputerUtilCombat` Z. 443) | 4–**6**/4–4/**3–12**/4–4 | Ab wie wenigen Lebenspunkten sie sich „in Gefahr“ sieht und entschlossener blockt; bei einem Bereich wird je Prüfung neu gewürfelt – bei „Experimental“ zwischen 3 und 12 |
| Kontern | `MIN_SPELL_CMC_TO_COUNTER`, `CHANCE_TO_COUNTER_CMC_1/2`, `ALWAYS_COUNTER_PUMP_SPELLS` (`CounterAi` Z. 147–190) | **2**/0/**2**/0; **0**/30/30/**80** %; **50**/75/75/**100** %; **false**/true/true/true | Billige Zaubersprüche lassen „Cautious“ und „Experimental“ öfter durch (Manawert unter 2 nur noch, wenn sie Schaden machen, zerstören, andere Konter oder Auren sind), „Reckless“ kontert sie fast immer. Ab Manawert 3 kontern alle gleich |
| Kampftricks | `TRY_TO_HOLD_COMBAT_TRICKS_UNTIL_BLOCK`, `CHANCE_TO_HOLD_…` (`ComputerUtilCard` Z. 1485–1600, 1828) | **false**/true/true/true; 75/65/75/65 | „Cautious“ lockt nicht mit einem zurückgehaltenen Verstärkungszauber in einen Block, sondern spielt ihn vor dem Angriff |
| Schaden | `CHANCE_TO_CHAIN_TWO_DAMAGE_SPELLS` (`DamageDealAi` Z. 1045), `HOLD_X_DAMAGE_SPELLS_*` | **25**/90/**100**/**75** %; X-Zauber ab 6/5/5/**3** | Zwei Schadenszauber auf ein Ziel kombinieren (in Gefahr immer); X-Schadenszauber früher abfeuern („Reckless“) |
| Entfernung | `ACTIVELY_DESTROY_IMMEDIATELY_UNBLOCKABLE`, `…_ONLY_IN_DNGR`, `…_THRESHOLD` (`ComputerUtilCard` Z. 2099–2135) | **false**/true/true/**false**; –/true/**false**/–; 2/2/**3**/2 | Welche gegnerischen Kreaturen sie zuerst entfernt: „Default“ die, die sie nicht blocken kann, wenn es knapp wird, „Experimental“ immer, „Cautious“ und „Reckless“ nie bevorzugt |
| Planeswalker | `CHANCE_TO_TRADE_(DOWN_)TO_SAVE_PLANESWALKER`, `CHUMP_TO_SAVE_PLANESWALKER_ONLY_ON_LETHAL` | 90/70/70/80; 0/0/**40**/0; true/true/**false**/true | „Experimental“ opfert eher Kreaturen für ihre Planeswalker |
| Mulligan | `MULLIGAN_THRESHOLD` (`ComputerUtil` Z. 2094, 2128) | 4/4/4/**3** | „Reckless“ geht notfalls bis auf drei Karten hinunter und behält dann jede Hand mit Land |
| Länder | `HOLD_LAND_DROP_FOR_MAIN2_IF_UNUSED` (`AiController` Z. 1407) | 100/100/100/**30** % | „Reckless“ legt Länder öfter schon in der ersten Hauptphase |
| Aufblitzen | `FLASH_CHANCE_TO_CAST_FOR_ETB_BEFORE_MAIN1`, `…_RESPOND_TO_STACK_WITH_ETB` (`PermanentCreatureAi`), fortgeschrittene Logik in allen vier an | **0**/10/**20**/**30**; 0/0/**15**/**10** % | Kreaturen mit Aufblitzen **und** Eintrittseffekt früher bzw. als Antwort spielen |
| Kopieren | `CHANCE_TO_COPY_OWN_SPELL_WHILE_ON_STACK`, `ALWAYS_COPY_SPELL_IF_CMC_DIFF` | **0**/30/30/**50** %; **4**/2/2/**1** | eigene Zaubersprüche kopieren |

Kleinere Unterschiede (Scry/Surveil/Explore-Schwellen, Energie, Ausrüstung
umhängen, Opfer-Vorlieben, Sturm, Landzerstörung, Blink/Bounce) stehen in den
Profildateien selbst; sie betreffen einzelne Kartenfamilien.

Dass jedes Profil in der Engine wirklich seine eigenen Werte trägt, prüft
`AiProfilesTest` stichprobenartig (u. a. `PLAY_AGGRO`, Konter-Chancen,
Kampftricks, Gefahrenschwelle, Mulligan-Schwelle).

## 3. Messung

**Werkzeug:** `engine/scripts/ai-profile-study.sh` (JVM-Build der Engine,
`org.openmana.engine.jvm.JvmAiProfileStudyMain` und `AiProfileStudy`, nicht Teil
der Browser-Engine). Jede Partie ist Forge-KI gegen Forge-KI mit festem Seed,
je Sitz ein Profil, ausgewertet aus Forges **strukturierten Spielereignissen**
(`GameEventAttackersDeclared`, `…BlockersDeclared`, `…SpellAbilityCast`,
`…Mulligan`, `…PlayerDamaged`, `…TurnBegan`, `…LandPlayed`; Konterzauber =
Karte mit einer Fähigkeit der API `Counter`), nie aus Texten. Regeln wie in
OpenManas Partien: Constructed, ein Spiel je Match, kein KI-Sideboarding, kein
Schummeln. Die Wasm-Engine spielt bei gleichem Seed dieselben Partien (Prompt
05, gleiche Engine-Spur) – die JVM ist nur der schnellere Ort zum Messen.

**Plan** (`engine/fixtures/ai-profile-study.json`):

- **Drei Decks** (`engine/fixtures/decks/study-*.json`, je 60 Karten aus
  bekannten Standardkarten), jeweils als **Spiegelpartie** – beide Seiten
  gleiches Deck, der einzige Unterschied ist das Profil:
  Aggro (Rot: Eile-Kreaturen, Brandzauber, ein Kampftrick),
  Midrange (Grün-Weiß: Kreaturen, Riesenwuchs, Schwerter zu Pflugscharen, ein
  Planeswalker),
  Kontrolle (Blau-Schwarz: 13 Konterzauber, Entfernung, Aufblitz-Kreaturen).
- **Paarungen:** Cautious, Experimental und Reckless je gegen Default; Default
  gegen Default als Kontrolle.
- **Seeds 1–100** je Deck und Paarung, **beide Sitzreihenfolgen** je Seed
  (gleiche Mischung, getauschte Profile) – 2 400 Partien. Die Kontrolle spielt
  200 Seeds in einer Reihenfolge.
- **Auswertung** (`engine/scripts/ai-profile-summary.mjs`): Siegquote mit
  95-%-Wilson-Intervall; weil beide Reihenfolgen eines Seeds mit denselben
  Karten beginnen, zusätzlich ein **Vorzeichentest je Seed** (Seeds, in denen
  das Profil beide Partien gewann, gegen Seeds, in denen es beide verlor;
  geteilte Seeds entscheidet der Sitz, nicht das Profil).

**Lauf:** 2 400 Partien, 0 gescheitert, 0 Forge-Fehler, keine abgelaufene
Zeitgrenze (`AvailableActions: heuristic timed out` kam nicht vor); im Mittel
2,2 s je Partie, 88 CPU-Minuten auf 4 JVMs (~26 min Wandzeit neben anderen
Sitzungen). Forge schrieb bei den roten Karten ~3 400-mal seinen eigenen
Hinweis „Did not have activator set in SpellAbilityRestriction.canPlay()“ ins
Log – eine Forge-interne Warnung derselben Art wie in Prompt 05 (Nebenwirkung
von `getActivateDescription`), in allen Paarungen gleich, ohne Fehler.

## 4. Ergebnisse

**Siegquote des Profils gegen Default** (alle Decks, beide Sitzreihenfolgen):

| Paarung | Partien | Siegquote | 95-%-Intervall | Seeds beide gewonnen / beide verloren / geteilt | Vorzeichentest p |
|---|---:|---:|---|---|---:|
| Vorsichtig (Cautious) – Standard | 600 | 47,5 % | 43,5–51,5 % | 22 / 37 / 241 | 0,067 |
| Experimentell (Experimental) – Standard | 600 | 48,2 % | 44,2–52,2 % | 20 / 31 / 249 | 0,161 |
| Waghalsig (Reckless) – Standard | 600 | 52,5 % | 48,5–56,5 % | 40 / 25 / 235 | 0,082 |
| Standard – Standard (Kontrolle, Sitz 1) | 600 | 51,2 % | 47,2–55,1 % | – | – |

Vier von fünf Seeds gehen „geteilt“ aus: Wer beginnt und welche Karten er
zieht, entscheidet eine Spiegelpartie viel stärker als das Profil.

**Je Deck** (Siegquote des Profils, je 200 Partien):

| Paarung | Aggro (Rot) | Midrange (Grün-Weiß) | Kontrolle (Blau-Schwarz) |
|---|---:|---:|---:|
| Vorsichtig – Standard | 50,5 % | 49,5 % | 42,5 % |
| Experimentell – Standard | 48,5 % | 50,5 % | 45,5 % |
| Waghalsig – Standard | 49,0 % | 54,0 % | 54,5 % |
| Standard – Standard (Kontrolle) | 55,0 % | 52,5 % | 46,0 % |

**Aggro (Rot)** (Profil / Standard in denselben Partien):

| Kennzahl | Vorsichtig – Standard | Experimentell – Standard | Waghalsig – Standard | Standard – Standard (Kontrolle) |
|---|---|---|---|---|
| Angreifende Kreaturen je eigenem Zug | 0,54 / 0,56 | 0,53 / 0,56 | 0,55 / 0,56 | 0,57 / 0,53 |
| Anteil eigener Züge mit Angriff | 41,3 % / 42,5 % | 41,8 % / 42,3 % | 42,9 % / 43,4 % | 43,8 % / 42,0 % |
| Blocker je gegnerischem Angreifer | 0,07 / 0,08 | 0,08 / 0,08 | 0,06 / 0,09 | 0,07 / 0,07 |
| Zaubersprüche je Partie | 9,2 / 9,3 | 9,3 / 9,3 | 9,1 / 9,2 | 9,3 / 9,3 |
| Konterzauber je Partie | 0,00 / 0,00 | 0,00 / 0,00 | 0,00 / 0,00 | 0,00 / 0,00 |
| Zaubersprüche im gegnerischen Zug je Partie | 1,70 / 1,86 | 1,71 / 1,83 | 1,75 / 1,77 | 1,82 / 1,92 |
| Züge je Partie | 18,1 / 18,1 | 18,1 / 18,1 | 17,8 / 17,8 | 18,1 / 18,1 |

**Midrange (Grün-Weiß)** (Profil / Standard in denselben Partien):

| Kennzahl | Vorsichtig – Standard | Experimentell – Standard | Waghalsig – Standard | Standard – Standard (Kontrolle) |
|---|---|---|---|---|
| Angreifende Kreaturen je eigenem Zug | 0,67 / 0,71 | 0,72 / 0,72 | 0,86 / 0,68 | 0,70 / 0,71 |
| Anteil eigener Züge mit Angriff | 36,7 % / 38,7 % | 38,7 % / 39,2 % | 46,2 % / 39,3 % | 38,5 % / 39,5 % |
| Blocker je gegnerischem Angreifer | 0,32 / 0,33 | 0,32 / 0,33 | 0,28 / 0,32 | 0,33 / 0,29 |
| Zaubersprüche je Partie | 8,7 / 8,7 | 8,7 / 8,7 | 8,4 / 8,4 | 8,8 / 8,7 |
| Konterzauber je Partie | 0,00 / 0,00 | 0,00 / 0,00 | 0,00 / 0,00 | 0,00 / 0,00 |
| Zaubersprüche im gegnerischen Zug je Partie | 0,86 / 0,66 | 0,72 / 0,76 | 0,61 / 0,73 | 0,77 / 0,61 |
| Züge je Partie | 21,2 / 21,2 | 21,3 / 21,3 | 20,2 / 20,2 | 21,3 / 21,3 |

**Kontrolle (Blau-Schwarz)** (Profil / Standard in denselben Partien):

| Kennzahl | Vorsichtig – Standard | Experimentell – Standard | Waghalsig – Standard | Standard – Standard (Kontrolle) |
|---|---|---|---|---|
| Angreifende Kreaturen je eigenem Zug | 0,51 / 0,67 | 0,52 / 0,64 | 0,62 / 0,51 | 0,55 / 0,57 |
| Anteil eigener Züge mit Angriff | 36,7 % / 43,6 % | 36,1 % / 41,9 % | 43,1 % / 38,7 % | 36,4 % / 38,0 % |
| Blocker je gegnerischem Angreifer | 0,05 / 0,06 | 0,05 / 0,06 | 0,03 / 0,05 | 0,04 / 0,06 |
| Zaubersprüche je Partie | 11,8 / 12,6 | 12,4 / 13,0 | 13,3 / 12,7 | 11,9 / 12,0 |
| Konterzauber je Partie | 3,42 / 3,87 | 3,90 / 4,00 | 4,46 / 4,00 | 3,67 / 3,67 |
| Zaubersprüche im gegnerischen Zug je Partie | 6,92 / 6,74 | 7,10 / 6,83 | 6,75 / 7,09 | 6,53 / 6,58 |
| Züge je Partie | 31,1 / 31,1 | 31,6 / 31,6 | 32,7 / 32,7 | 30,1 / 30,1 |

**Was sich damit belegen lässt:** Waghalsig greift mit Midrange (+26 %
angreifende Kreaturen je Zug, 46 statt 39 % der Züge mit Angriff) und
Kontrolle (+22 %) deutlich häufiger an, blockt seltener (Midrange 0,28 statt
0,32 Blocker je Angreifer, Kontrolle 0,03 statt 0,05) und kontert mit dem
Kontrolldeck öfter (4,46 statt 4,00 Konterzauber je Partie, +12 %; gegen die
Kontrolle 3,67 sogar +22 %). Vorsichtig kontert seltener (3,42 statt 3,87) und
greift mit dem Kontrolldeck seltener an (0,51 statt 0,67). Experimentell
greift mit dem Kontrolldeck seltener an (0,52 statt 0,64) und liegt sonst bei
Standard. Mit dem Aggro-Deck unterscheiden sich die Profile praktisch nicht:
Das Deck spielt sich von selbst (Brand und Eile), die Stellschrauben greifen
kaum.

## 5. Was die App daraus macht

- **Namen:** Übersetzungen von Forges Namen – Standard (Default), Vorsichtig
  (Cautious), Waghalsig (Reckless), Experimentell (Experimental) –, dazu
  „Zufällig“ (je Partie eines der vier, von der App gezogen). Keine
  Schwierigkeitswörter; ein Test sucht danach (`ai-profiles.test.ts`).
- **Beschreibungen:** je ein Satz und drei bis vier Unterschiede aus §2, die
  in OpenMana wirken und im Spiel auffallen können
  ([`src/game/ai-profile-table.ts`](../../src/game/ai-profile-table.ts)).
  Wo der Name etwas anderes vermuten ließe (Vorsichtig prüft einen Angriff
  sogar weniger), wird nichts behauptet.
- **Der Hinweis an jeder Profilwahl:** „Forge kennt keine
  Schwierigkeitsstufen: Die Profile ändern, wie die KI spielt – nicht, was sie
  weiß oder darf. In 2 400 Testpartien KI gegen KI gewann keines messbar öfter
  oder seltener als ‚Standard‘.“
- **Geprüft wird bei jedem Build:** Die Beschreibungen gelten für genau diese
  Dateien. `vite/engine-assets.ts` liest die Profile aus dem Datenverzeichnis
  der Engine (`forge-res.inventory.json`, gegen das Manifest geprüft) und
  bricht den Build ab, wenn ein Profil neu, weg oder geändert ist – ein
  Forge-Update mit anderen Profilen braucht erst diese Prüfung (Studie neu
  laufen lassen, Tabelle anpassen).

## 6. Grenzen

- **KI gegen KI ist nicht Mensch gegen KI.** Die Messung zeigt, dass kein
  Profil Forges Vorgabe schlägt; ob sich ein Profil für einen Menschen leichter
  oder schwerer anfühlt, misst sie nicht. Deshalb nennt die App keine Stufe.
- **Drei Decks, Spiegelpartien.** Andere Archetypen (Kombo, Planeswalker-
  lastig, Kommandeur mit 100 Karten) können die Unterschiede größer oder
  kleiner machen; die Werte in §2 gelten unabhängig davon.
- **Zeitgrenze:** Im Browser bricht Patch 0002 eine KI-Überlegung nach 5 s ab
  (auf langsamen Geräten denkbar); auf der JVM kam das in der Studie nicht vor.
  Das betrifft alle Profile gleich.
- Die Stärke-Tendenzen (Waghalsig 52,5 %, Vorsichtig 47,5 %) könnten mit mehr
  Partien signifikant werden; mit 2 400 sind sie es nicht, und selbst dann
  wären es KI-gegen-KI-Unterschiede von wenigen Prozentpunkten.

## 7. Reproduzieren

```bash
bash engine/scripts/build.sh                 # oder nur prepare-forge.sh + build-jvm.sh
bash engine/scripts/ai-profile-study.sh      # ~25 min, 4 JVMs (OPENMANA_STUDY_SHARDS)
cat engine/build/report/ai-profiles/summary.md
```

Gleicher Forge-Stand, gleiche Decks und Seeds ergeben dieselben Partien (Forges
Zufall kommt nur aus dem Seed); die Tabellen oben sind die `summary.md` dieses
Laufs, ins Deutsche gesetzt.
