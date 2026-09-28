# Forge-Patch-Queue

Forge upstream (`engine/forge`, gepinnt per Submodule) läuft im Browser nicht
unverändert: GraalVM Web Image kennt nur **einen** Java-Thread. Die Patches hier
machen Forge dafür tauglich. Sie werden bei jedem Build frisch auf eine Kopie des
gepinnten Stands angewendet (`engine/scripts/prepare-forge.sh`); das Submodule
selbst bleibt unverändert.

| Nr. | Datei | Inhalt | Herkunft |
|---|---|---|---|
| 0001 | `0001-forge-synchronous-mode.patch` | Schalter `-Dforge.synchronous=true`: `ThreadUtil.invokeInGameThread`, `limit`, `executeWithTimeout` laufen im aufrufenden Thread, `isGameThread()` = true, `isMultiCoreSystem()` = false; `AiController` bewertet Fähigkeiten ohne eigenen Thread | `witchesofthehill/forge@51b7d50` (khaliostr), ohne den dort zurückgenommenen LDA-Guard |
| 0002 | `0002-ai-cooperative-deadline.patch` | Kooperative Zeitgrenze in `AiController.chooseSpellAbilityToPlayFromList` (ohne Thread greift das bisherige Timeout nie) | `witchesofthehill/forge@026be2f` (khaliostr) |
| 0003 | `0003-ai-attack-sequential.patch` | `AiAttackController` prüft Pflichtangriffe im Synchronmodus nacheinander statt im Thread-Pool | `witchesofthehill/forge@43847a6` (JacopoMadaluni) |
| 0004 | `0004-sync-input-pump.patch` | **Input-Pumpe** (Research: „Patch 4“): Im Synchronmodus wartet `InputSyncronizedBase.awaitLatchRelease()` nicht mehr auf einen GUI-Thread, sondern ruft eine von der Einbettung gesetzte Pumpe (`setSynchronousInputPump`), bis `stop()` den Latch löst. Ohne Pumpe scheitert die Eingabe laut statt zu hängen | OpenMana, Prompt 02 |
| 0005 | `0005-sync-no-comfort-timers.patch` | Im Synchronmodus keine Komfort-Timer: `AbstractGuiGame.awaitNextInput` („Warte auf Gegner“ nach 250 ms), `showWaitingTimer` und `ThreadUtil.delay` (z. B. `InputLockUI`) laufen nicht. Sie zeigen nur Hinweise an; Spielablauf und Regeln bleiben unberührt | OpenMana, Prompt 02 |
| 0006 | `0006-local-games-without-server-manager.patch` | Neu `FServerManager.getInstanceIfCreated()`; `HostedMatch.startGame` und `InputPassPriority.showAndWait` fragen nur einen **vorhandenen** Netzwerk-Manager. Vorher baute jede lokale Partie Netty-Event-Loops (zwei Thread-Gruppen) und Netzwerk-Einstellungen auf, die sie nie nutzte | OpenMana, Prompt 02 |
| 0007 | `0007-gui-read-only-answers.patch` | **Nur lesende Auskünfte für die Oberfläche:** `InputSelectTargets.isSelectablePlayer` (würde ein Klick diesen Spieler als Ziel nehmen oder zurücknehmen?), `InputPayMana.getRemainingManaCost` (was noch zu zahlen ist, wie Forges Anweisung es zeigt), `InputPayMana.canUseManaFromPool` + `ManaPool.canPayCostWithColor` (würde Mana dieser Farbe aus dem Vorrat bezahlen?), `InputPayMana.isSelectablePlayer` (in `InputPayManaOfCostPayment`: Leben für Phyrexia-Mana). Die bisherigen Prüfungen sind unverändert in gemeinsame Methoden verschoben (`playerRefusal`, `manaToPayWithColor`), die der Klick und die neue Auskunft beide nutzen | OpenMana, Prompt 17 |

0001–0003 stammen aus ManaBrews Forge-Fork (GPL-3.0-or-later wie Forge selbst,
siehe `docs/research/LICENSES.md`) und sind auf `Card-Forge/forge@ed0333f`
angepasst. 0004–0007 sind für OpenMana neu geschrieben (Begründung in der
jeweiligen Patch-Beschreibung, Nachweise in
[`docs/implementation/02-anvil-bridge.md`](../../docs/implementation/02-anvil-bridge.md)).
Jede geänderte Stelle trägt im Quelltext den Vermerk
`OpenMana patch NNNN (2026-09-24, …)` (GPLv3 §5a: Änderungshinweis mit Datum).

**Ohne** `-Dforge.synchronous=true` verhält sich Forge mit diesen Patches wie
upstream — mit zwei Ausnahmen: Die kooperative Zeitgrenze aus 0002 gilt immer,
und nach 0006 legt eine lokale Partie keinen Netzwerk-Manager mehr an (ein
Netzwerkspiel erzeugt ihn wie bisher selbst).
Die OpenMana-Bridge setzt den Schalter auf der JVM genauso wie im Browser, damit
beide Laufzeiten dieselben Pfade nehmen (Voraussetzung für den JVM/Wasm-Vergleich).

## Regeln

- Nummeriert, eine Sache pro Patch, im `git format-patch`-Format mit
  Begründung, Herkunft und Datum.
- Nur, was für den Betrieb im Browser **nötig** ist – oder, seit Prompt 17,
  eine **nur lesende Auskunft**, die die Oberfläche braucht, um Forges eigene
  Entscheidung vorher zu zeigen statt nachher zu raten (0007: welche Spieler
  ein Klick nähme, was noch zu zahlen ist). Solch eine Auskunft stellt dieselbe
  Prüfung wie Forges Klick – die Prüfung wird dafür in eine gemeinsame Methode
  verschoben, nie abgeschrieben – und verändert nichts. Keine Regel-, Karten-
  oder KI-Änderungen „nebenbei“ (Bible §2). ManaBrews verhaltensändernde Patches
  (Unentschieden bei Obergrenzen, `PERFORMANCE_MODE`, `renderAbilityText`,
  Performance-Caches) sind bewusst **nicht** übernommen.
- `prepare-forge.sh` prüft jeden Patch mit `git apply --check` und bricht laut ab,
  wenn er nicht mehr passt. Dann den Patch an den neuen Forge-Stand anpassen —
  nie das Submodule von Hand ändern.

## Einen Patch anpassen oder neu erstellen

```bash
cd engine/forge
git switch -c patch-arbeit                  # nur lokal, wird nie gepusht
git am ../patches/*.patch                   # bestehende Queue einspielen
# … ändern, committen …
git format-patch --zero-commit -N -o ../patches <forge-pin>..HEAD
git switch --detach <forge-pin> && git branch -D patch-arbeit
```

Danach Dateinamen kurz halten (`NNNN-thema.patch`), `engine/scripts/build.sh`
und `engine/scripts/test-engine.sh` laufen lassen.

## Später zu prüfen

- Prompt 02 hat den Mensch-gegen-KI-Pfad mit zwei vollen Partien durchlaufen
  (Mulligan, Priorität, Kosten, Ziele, Angriff, Entscheidungen): Außer den
  Stellen aus 0004–0006 startet Forge dort keinen Thread (Test
  `HumanMatchTest.everythingRunsOnOneThread`). Mechaniken, die diese Partien
  nicht berühren (etwa Commander-Wahl, Planechase, Sideboarding zwischen
  Partien), können weitere Stellen zeigen; Prompt 05 (Differenztests) und die
  Regressionstests (29) decken sie auf.
- Ein Synchronmodus upstream bei Card-Forge würde diese Queue ersetzen
  (Research: FORGE_BUILD.md §4).
