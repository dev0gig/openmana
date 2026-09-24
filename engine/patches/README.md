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

Alle drei stammen aus ManaBrews Forge-Fork (GPL-3.0-or-later wie Forge selbst,
siehe `docs/research/LICENSES.md`) und sind auf `Card-Forge/forge@ed0333f`
angepasst. Jede geänderte Stelle trägt im Quelltext den Vermerk
`OpenMana patch NNNN (2026-09-24, …)` (GPLv3 §5a: Änderungshinweis mit Datum).

**Ohne** `-Dforge.synchronous=true` verhält sich Forge mit diesen Patches wie
upstream — mit einer Ausnahme: Die kooperative Zeitgrenze aus 0002 gilt immer.
Die OpenMana-Bridge setzt den Schalter auf der JVM genauso wie im Browser, damit
beide Laufzeiten dieselben Pfade nehmen (Voraussetzung für den JVM/Wasm-Vergleich).

## Regeln

- Nummeriert, eine Sache pro Patch, im `git format-patch`-Format mit
  Begründung, Herkunft und Datum.
- Nur, was für den Betrieb im Browser **nötig** ist. Keine Regel-, Karten- oder
  KI-Änderungen „nebenbei“ (Bible §2). ManaBrews verhaltensändernde Patches
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

- Weitere Stellen, die im Human-gegen-KI-Pfad einen Thread starten
  (`FThreads.invokeInBackgroundThread`, Timer in `AbstractGuiGame`,
  `ThreadUtil.delay`), zeigt erst Prompt 02 (Input-Pumpe, Patch 4 laut Research).
- Ein Synchronmodus upstream bei Card-Forge würde diese Queue ersetzen
  (Research: FORGE_BUILD.md §4).
