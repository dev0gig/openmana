# OpenMana — Nächster Schritt

Arbeite im Repository `dev0gig/openmana` und setze die Entwicklung anhand des dokumentierten Zustands fort.

## 1. Kontext laden

Lies zuerst:
- `README.md`
- `docs/BIBLE.md`
- `docs/ANVIL_LESSONS.md`
- `prompts/STATUS.md`
- relevante Dokumentation unter `docs/research/`

Falls der nächste Queue-Prompt auf Anvil Bezug nimmt, nutze zusätzlich `dev0gig/anvil`, insbesondere `PROTOKOLL.md`, `AUDIT.md` und relevante Implementierung, als Referenz.

Verlasse dich für den Projektfortschritt auf den aktuellen Repository-Stand und `prompts/STATUS.md`, nicht auf Annahmen aus früheren Sessions.

## 2. Nächsten Prompt bestimmen

Prüfe `prompts/STATUS.md` und bestimme den ersten noch nicht abgeschlossenen Prompt in numerischer Reihenfolge unter `prompts/queue/`.

Statusregeln:
- `COMPLETE` → überspringen.
- `PENDING` → nächster ausführbarer Prompt.
- `IN_PROGRESS` → vorhandenen Stand prüfen und genau diesen Prompt sauber fertigstellen.
- `BLOCKED` → nicht überspringen. Blocker innerhalb von Bible/Architektur prüfen. Besteht er weiter, dokumentieren und STOPPEN.

Spätere Prompts dürfen nie einen blockierten früheren Prompt umgehen.

## 3. Genau EINEN Prompt ausführen

Bearbeite pro Lauf ausschließlich einen einzigen Queue-Prompt. Keine Bündelung.

Setze ihn in `prompts/STATUS.md` zunächst auf `IN_PROGRESS`, lies anschließend die vollständige Prompt-Datei und führe sie vollständig aus.

Halte dich strikt an Bible, Research, Anvil Lessons und bestehende Architekturentscheidungen.

**Forge ist dauerhaft die alleinige Autorität für Magic-Regeln.** OpenMana darf keine parallele Magic-Regelengine entwickeln und keine Karten-/Mechanik-Sonderfälle im UI hardcoden.

## 4. Bestehenden Code respektieren

Bevor du neu implementierst:
- vorhandenen Code prüfen,
- bestehende Lösungen suchen,
- Duplikate vermeiden,
- funktionierende Features erhalten,
- unabhängige Bereiche nicht ohne Notwendigkeit verändern.

Vorhandene geeignete Abstraktionen erweitern statt zweite Lösungen daneben zu bauen.

## 5. Qualität prüfen

Führe alle für den Prompt relevanten Tests aus, soweit anwendbar:
- Build
- TypeScript/Compiler
- Unit Tests
- Integration Tests
- Forge-/WASM-Tests
- bestehende Regressionstests

Keine Tests entfernen oder abschwächen, um einen grünen Build zu erzwingen. Keine Mock-/Fake-Ergebnisse als Nachweis ausgeben.

## 6. STATUS.md aktualisieren

Ein Prompt darf nur `COMPLETE` werden, wenn:
1. alle Anforderungen erfüllt sind,
2. relevante Tests erfolgreich waren,
3. verlangte Dokumentation vorhanden ist,
4. keine bekannten kritischen Fehler des Prompts offen sind,
5. der Stand committed und gepusht werden kann.

Dokumentiere:
- Promptnummer und Titel
- Status
- ausführender Agent
- Commit
- kurze Zusammenfassung
- wichtige neue/geänderte Komponenten
- ausgeführte Tests und Ergebnisse
- relevante technische Erkenntnisse
- bewusste Abweichungen/Entscheidungen

Setze den nächsten numerischen Prompt als `Next`, aber führe ihn nicht aus.

## 7. Blocker

Kann der Prompt nicht korrekt abgeschlossen werden, setze ihn auf `BLOCKED` und dokumentiere:
- exakte Ursache
- technische Evidenz
- getestete Lösungswege
- warum diese nicht funktionierten
- was zur Fortsetzung benötigt wird

Keine Architektur eigenmächtig umgehen. Keinen späteren Queue-Prompt beginnen.

## 8. Abschluss

Committe und pushe den fertigen Stand einschließlich `prompts/STATUS.md`.

Danach STOPPEN. Nicht automatisch mit dem nächsten Queue-Prompt fortfahren.

Eine neue Claude-, Codex- oder ChatGPT-Session muss allein anhand des Repositorys und `prompts/STATUS.md` erkennen können, was fertig ist, was zuletzt gemacht wurde, welche Tests bestanden wurden, welche Blocker bestehen und welcher Prompt als Nächstes dran ist.
