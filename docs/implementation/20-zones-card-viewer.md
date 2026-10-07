# 20 — Zonen und vollständige Kartenansicht

Stand: 07.10.2026. Zentraler Auftrag: `dev0gig/dropzone/workflow/tasks/completed/openmana-20-zones-card-viewer.md`.

## Ergebnis

„Zonen ansehen“ im Tischkopf öffnet die Zonenwahl: Friedhof, Exil und Kommandozone beider Spieler einschließlich Forges Effektkarten sowie die Karten auf dem Stapel. Alle Listen enthalten ihre aktuellen Karten. Die Bibliothek bleibt Forges Zahl, verdeckte Karten bleiben eine Zahl ohne Identität. Die Hand und das Spielfeld bleiben direkt am Tisch zugänglich.

Jeder Knopf der Zonenwahl öffnet eine Liste, jeder Listeneintrag die bestehende Kartenansicht. Das Ansehen sendet nichts, auch nicht in Schritten, in denen ein Tipp auf dem Tisch sofort handelt. Die Liste folgt jedem vollständigen Forge-Zustand. Leere Zonen sind leer; verborgene Karten erhalten weder Namen noch ein Betrachtungsziel.

Die Ansicht kann mit „Vorige Karte“ und „Nächste Karte“ durch die aktuelle Zone bzw. den gewählten Kartenstapel blättern. Zonenquellen speichern Spieler-ID und Zonenschlüssel; Kartenstapel speichern ausschließlich IDs. Karten werden gegen den aktuellen Zustand aufgelöst. Eine verschwundene/verdeckte Karte sagt „Karte nicht mehr zu sehen“ und bietet keine Aktion. Eine bewegte Karte zeigt ihren aktuellen Ort und ihre aktuellen Fakten. Der Aktionsknopf verwendet die tatsächlich betrachtete ID, mit erneuter Sperre nach einem Kartenwechsel auch bei identischem Aktionstext.

Für Karten, die ausschließlich in einer Forge-Frage vorkommen, hält `CardLook` die Fragen-ID statt einer alten `VisibleCard`-Kopie. Jede Darstellung liest die aktuelle `cardView` derselben offenen Frage; eine zurückgezogene Frage kann nicht durch eine andere mit derselben Karten-ID wiederbelebt werden.

## Kartenbilder und Kartenseiten

`useTableCards` und `cardDisplay` bleiben der eine Weg vom lokalen Scryfall-Katalog zum Bild. Die aufgelöste Katalogantwort liefert zusätzlich die statischen Kartenseiten und ihre Bilder. Forges Schlüssel entscheidet über die anfänglich gezeigte Seite; eine Änderung dieses Schlüssels setzt die Betrachtung zurück. Seitenknöpfe ändern ausschließlich die Darstellung, keine Transformation, keinen Spielzustand und keine Aktions-ID.

Katalogangaben werden als Betrachtungsinformationen beschriftet; Forges aktueller Regeltext, Zustand und Aktionsangebot bleiben maßgeblich. Wenn Forge in einer Zone keinen Regeltext sendet, kann der Katalog seine Angaben ergänzen. Deutsch und Englisch folgen `cardDisplay`, mit gekennzeichnetem englischem Ersatz. Fehlende oder fehlgeschlagene Bilder zeigen Text. Verdeckte Karten lösen keine Katalogidentität auf. Kein Bild wird überzeichnet oder beschnitten.

## Umsetzung und Grenzen

- `src/game/zone-sheet.tsx`: aktuelle Zonenlisten, verschachtelte Kartenansicht, Rückkehr zur Liste.
- `src/game/card-view-model.ts`: aktuelle Fragenquellen und sichtbare Browse-IDs.
- `src/game/card-sheet.tsx`: aktuelle Auflösung, Navigation, Kartenseiten, feste Aktionsleiste, Fokus und Arming.
- `src/game/table-cards.ts`: statische Katalogseiten, kein Spielzustand im Cache.
- `src/components/ui/game-zone-button.tsx`: shadcn-Knopf im Tischkopf, mindestens 44 px bei Touch; die kompakten Spielerzähler verbrauchen keinen zusätzlichen Platz.
- `scripts/e2e/run.ts --zones-only`: kleiner sequenzieller Browserlauf mit aufgezeichneten Forge-Zuständen und ausdrücklich gebauten Darstellungsgrenzen.

Keine Engine-, Forge-, Protokoll-, Datenbank- oder Katalogmigration; vorhandene geprüfte Artefakte. Kein Engine-Neubau, keine volle App-/Engine-Differenzsuite und kein Gerätetest in diesem Auftrag. Der Browser-Prüfstand protokolliert Eingaben und simuliert keinen Engine-Erfolg. DFC-Testfälle ersetzen ausdrücklich nur die dargestellte Karte auf einem aufgezeichneten Zustand; sie sind kein Nachweis einer von Forge ausgeführten Transformation. Gesamtabnahme bleibt bei den späteren Prompts.

## Verifikation

Alle Prüfungen liefen sequenziell, Vitest mit einem Worker und ohne Dateiparallelität; Node erhielt ein Heap-Limit von 512 MiB. Dieses Limit ist keine Messung des gesamten Prozess- oder Browserverbrauchs. Lokale Rohberichte und Screenshots stehen unter `reports/openmana-20-*` und `reports/zones-e2e/` (ignoriert).

| Prüfung | Ergebnis |
| --- | --- |
| Relevante Komponenten-, Modell- und Entscheidungstests | 114/114 in acht Dateien; nach der gemeinsamen Darstellung für Fragenkarten und zwei zusätzlichen Tests abschließend 75/75 in den vier betroffenen Dateien. Damit 116 unterschiedliche Tests abgedeckt, keine vollständige Frontend-Suite. |
| Lint, Schema-Prüfung, TypeScript und Produktionsbuild | Erfolgreich; letzter Vite-Build 8,65 s, vorhandene Engine-/Katalogartefakte geprüft und wiederverwendet. |
| Chrome 153, sechs aufgezeichnete Szenen in drei Größen | 18 Szenen-/Viewportprüfungen, keine Fehler oder axe-Verstöße. Kleinste Spielfeldhöhe: 85 px auf dem kleinen Handy, 120 px quer, 349 px am Desktop. |
| Zonen und vollständige Ansicht in allen drei Größen | Beide Friedhöfe, leeres Exil, echtes Exil/Kommandoeffekte, Stapel und Kartenstapel erfolgreich geöffnet/durchgesehen; keine Spiel-Eingabe beim Ansehen. |
| Ausdrücklich gebaute DFC-/Fallback-Darstellung | Beide Seiten und DE→EN-Ersatz geprüft, aktueller Aktionsknopf und Schließen im Viewport; keine Eingabe beim Seitenwechsel. Screenshots auf kleinem Handy und quer visuell geprüft. |

Der erste Browserlauf fand eine unzulässige leere ARIA-Liste und zu wenig Spielfeldplatz auf dem kleinen Handy. Die leere Zone hat jetzt keine Listenrolle; die neue Zonenwahl sitzt im Tischkopf und im Sheet, sodass zusätzliche Knöpfe die Spieler- und Stapelbereiche nicht vergrößern. Der vollständige Nachlauf dieses Prüfbereichs ist grün. Die Abschlussprüfung bestätigt außerdem die ausgewählte Aktions-ID mit erneutem Arming sowie die aktuelle Auflösung derselben Fragenquelle statt gespeicherter Kartenobjekte.

Rohbelege: `reports/openmana-20-final-unit.log`, `reports/openmana-20-final-retest.log`, `reports/openmana-20-final-build.log`, `reports/openmana-20-browser-final.log` und `reports/zones-e2e/report.json`. Der erste Browserbericht bleibt als `reports/openmana-20-browser-first.json` erhalten. Die gebauten DFC-Fälle behalten die Aktion der aufgezeichneten Ausgangskarte; „Spiele ein Land“ in ihrem Screenshot beweist die Erreichbarkeit der Aktionsleiste, keine echte Forge-Aktion für Delver.

```bash
NODE_OPTIONS=--max-old-space-size=512 npx vitest run src/game/card-view.test.tsx src/game/card-interaction.test.tsx src/game/game-table.test.tsx src/game/table-cards.test.ts src/game/decision-panel.test.tsx src/game/block.test.tsx src/app/boundary.test.ts src/app/motion.test.ts --maxWorkers=1 --no-file-parallelism
NODE_OPTIONS=--max-old-space-size=512 npm run lint
NODE_OPTIONS=--max-old-space-size=512 npm run build
NODE_OPTIONS=--max-old-space-size=512 npm run test:e2e -- --no-build --zones-only
```

Kein Push/Deployment. Als Nächstes: Prompt 21, Ereignisverlauf in der Partie.
