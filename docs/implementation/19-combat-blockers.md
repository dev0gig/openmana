# 19 — Kampf: Blocker

Stand: 07.10.2026. Zentraler Auftrag: `dev0gig/dropzone/workflow/tasks/completed/openmana-19-combat-blockers.md`.

## Ergebnis

Blocker werden mit Forges eigener Eingabe zugewiesen. Der Tisch zeigt das aktuelle **Blockziel**, die Kreaturen, deren Tipp Forge für dieses Ziel annehmen würde, und alle geplanten Zuordnungen. Mehrere Blocker stehen bei ihrem Angreifer in Forges Reihenfolge; eine Kreatur kann in mehreren Zuordnungen vorkommen. Die App berechnet weder Blockregeln noch Schaden.

- Das Blockziel erhält einen durchgezogenen Rahmen und die Beschriftung „Blockziel“, am Spielfeld und in der Kampfzeile. Andere Angreifer mit einer Forge-Aktion heißen „Blocker zuweisen“.
- Eigene Kreaturen mit Forges `action` sind gold gestrichelt („kann diesen Angreifer blocken“). Zugewiesene Blocker bleiben durchgezogen („blockt“, bei mehreren Angreifern mit deren Anzahl), auch ohne Forges allgemeine Markierung. Ohne Aktion wird nur die Kartenansicht geöffnet.
- Der Bereich sagt, für welche Karte Blocker gewählt werden. „Nicht blocken“ bzw. „Blocks bestätigen“ sendet Forges Knopf 1, mit Forges Freigabezustand. Forge prüft beim Bestätigen zusätzlich Blockpflichten und Beschränkungen.
- Änderungen an den Zuordnungen sperren die Bestätigung erneut für `ARMING_MS`. Doppeltippen, wiederholte Tasten, Nachschauen, Replays, Rechnen und Aufgabe behalten die bestehenden Schutzmaßnahmen. Kein automatisches Antworten.
- Eine blockierende Reihenfolge- oder Schadensfrage verdrängt die Blocker-Bestätigung und verwendet die vorhandenen generischen Entscheidungsfelder. Vorschläge bleiben Entwürfe, zurückgezogene Fragen verschwinden.

## Autorität und Wiederverwendung

**Kein Engine-Neubau, keine Forge-/Protokolländerung.** Protokoll 7 liefert bereits alles Nötige:

| Angabe | Forge-Quelle | Verwendung |
|---|---|---|
| `VisibleCard.highlighted` unter den Angreifern | `InputBlock.setCurrentAttacker` | aktuelles Blockziel, ohne Textanalyse |
| `VisibleCard.action` | `InputBlock.getActivateAction`, dieselben `CombatUtil.canBlock`-Prüfungen wie beim Tipp | Aktion für genau den gewählten Angreifer, einschließlich Zurücknehmen |
| `VisibleCard.playable` | `PlayerControllerHuman.pushBlockerCandidates` | **keine** Erlaubnis für das aktuelle Ziel: Forge markiert auch Blocker, die nur einen anderen Angreifer blocken könnten |
| `GameState.combat[].blockers`, `attacking`, `blocking` | Forge-Zustand | aktuelle Zuordnungen, keine lokale Rekonstruktion |
| `ButtonsQuestion.purpose = block`, `enabled` | laufende Forge-Eingabe | Bestätigung und abgeschaltete Knöpfe |

Code: `src/game/block-model.ts`, `block-labels.ts`, `card-use.ts`, `decision-panel.tsx`, `game-table.tsx`. `TableMoment` erhält die Kampfzuordnungen aus dem gleichen vollständigen Zustand. Kartenansichten lösen IDs weiter gegen den aktuellen Zustand auf. Die Kampfzeilen bleiben während der Blocker-Eingabe einzeln, damit gleiche Angreifer und das gewählte Ziel auseinanderzuhalten sind. Bilder werden nicht überzeichnet; Beschriftungen stehen darunter.

Der generische Hinweis der Kartenansicht behauptet jetzt nicht mehr, dass ein zweiter Tipp jede Aktion zurücknimmt: Ein Tipp auf einen Angreifer wählt das Blockziel. Forges eigene Aktionsworte sagen, was ein weiterer Tipp tut.

## Verifikation

dev0gig verlangte ausdrücklich kleine, speicherschonende Prüfungen. Alle Läufe fanden nacheinander statt; Vitest verwendete einen Worker und maximal 512 MiB JS-Heap. Die bestehenden Engine-/Katalogartefakte wurden wiederverwendet.

| Prüfung | Nachweis |
|---|---|
| Frontend | 815 Tests insgesamt abgedeckt: 62 Dateien im sequenziellen Gesamtlauf grün, die zwei Dateien mit korrigierten Erwartungswerten anschließend 34/34 grün; nach der finalen Absicherung fehlender Kampfzuordnungen nochmals die betroffenen vier Dateien mit 91/91 grün. 15 neue Blocker-Tests. |
| Statisch/Build | Schemas aktuell, `tsc -b`, `oxlint`, `npm run build` erfolgreich; Web-Build 7,79 s und 1 087,5 MiB Spitze im Prozessbaum. |
| Browser | `npm run test:e2e -- --no-build --combat-only`: Chrome 153, 21 Szenen-/Viewport-Prüfungen, 0 Befunde, 21 axe-Prüfungen ohne Verletzung. Kleines Handy 360 × 740, Handy quer 915 × 412, Desktop 1440 × 900. Spielfelder beim Doppelblock auf dem kleinen Handy je 104 px; Antwortknöpfe bleiben erreichbar, Touch-Ziele mindestens 44 px. |
| Browser-Interaktionen | In jeder Größe: Zuweisung, Zielwechsel, Doppeltipp zählt einmal, langer Druck/Rechtsklick sendet nichts, Blocker-Tipp zum Zurücknehmen, Nichtblocken/Bestätigung, gebaute Blocker-Reihenfolge `[2,1]` und echte aufgezeichnete Schadensfrage `[1,1]`. |
| Echter Forge-Lauf | `blocks-double` erneut mit dem vorhandenen JVM-Artefakt, `-Xmx384m`: 13 Züge, 45 Eingaben, 271 Logeinträge, keine Forge-Fehler/Thread-Verstöße; 524,4 MiB Spitze. |
| Echter WASM-Vergleich | Diese neue JVM-Aufzeichnung durch den echten `EngineClient`, Worker und SharedArrayBuffer in Node wiederholt: 45 Eingaben, 205/205 Trace-Prüfpunkte gleich, keine Divergenz, Spielprotokoll und Protokollnachrichten gleich. 22,12 s, 1 363,2 MiB Spitze. |

JVM/WASM: Forge-Spielprotokoll SHA-256 `9b7bdf4c2e8aed3af80b9c82276233f55d2406ba4c1318958bb8ea85f2caec8c`, Protokollnachrichten `34c5f8d98fdd3fb82b2766eaa29b5a211d0b59e4f41cf0ad2dc9eda2c5690d69`, Trace `fa21d1c94821d9aa5882995390146c9cea5a98d1ed63adcf55575edbc863b381`. Auch die erwarteten Ablehnungen ungültiger/veralteter Eingaben stimmen überein.

Die WASM-Versuche mit 384 und 768 MiB JS-Heap beendeten ausschließlich den Test-Worker wegen dessen Heapgrenze. Der erfolgreiche Einzelvergleich verwendete 1 536 MiB Heaplimit und startete erst bei mehr als 3,5 GiB verfügbarem RAM. Kein Server-OOM und kein großer Engine-Neubau.

Lokale, ignorierte Berichte: `reports/openmana-19-*.log`, `reports/openmana-19-measure.jsonl`, `reports/combat-e2e/report.json` und Screenshots. Die Browser-UI-Prüfung verwendet unveränderte Forge-Mitschnitte und schreibt gesendete Eingaben mit; sie simuliert keinen Engine-Erfolg. Der tatsächliche Engine-Vergleich ist der separate JVM-/WASM-Lauf.

## Szenen und Grenzen

`block-start` und `block-multiple` kommen unverändert aus den vorhandenen Mitschnitten `blocks-multi` bzw. `blocks-double`. `scripts/record-table-scenes.ts` wählt sie aus strukturierten Zuständen. Die vorhandenen Szenen blieben unverändert. Im frischen JVM-Einzellauf ist der vollständige Zustand von `block-multiple` identisch, abgesehen vom Nachrichten-Zähler `seq` (Positionen 467 und 470, ab 0 gezählt).

Die gepinnte Forge-Version fragt in diesen Partien direkt nach Schadensverteilung. Die Reihenfolgefrage ist ausdrücklich **gebaut**, mit echten Kampfkarten nach dem Protokollschema; der generische Antwortpfad wird geprüft, kein realer Forge-Reihenfolgeaufruf behauptet. Der Fall „ein Blocker, mehrere Angreifer“ und die Marker-Abweichung sind ebenfalls gebaute Grenzen auf echten Zuständen.

Nicht ausgeführt: native-image-/Maven-Neubau, komplette Engine-Differenzsuite, gesamte App-E2E-Suite oder Android-Geräteabnahme. Diese Ressourcenbeschränkung ersetzt keinen späteren Gesamt-/Abnahmetest (Prompts 29/32). Die abgeschnittenen langen Kartenunterschriften auf schmalen Handys bleiben beim responsiven Feinschliff (24); Namen, Kartenansicht und Zuordnungszeilen enthalten den vollständigen Zusammenhang.

## Reproduzieren

```bash
NODE_OPTIONS=--max-old-space-size=512 npx vitest run src/game/block.test.tsx src/game/card-use.test.ts src/game/card-interaction.test.tsx src/game/decision-panel.test.tsx --maxWorkers=1 --no-file-parallelism
npm run build
NODE_OPTIONS=--max-old-space-size=512 npm run test:e2e -- --no-build --combat-only
```

Kein Push/Deployment. Als Nächstes: Prompt 20, Zonen und vollständige Kartenansicht.
