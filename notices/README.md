# Lizenzinventur

`policy.json` enthält die **geprüften** exakten Engine-Koordinaten, Lizenzwahl,
Textzuordnung und den Hash der geprüften `engine-inventory.json`.
`license-files.json` bindet jeden ergänzten Originaltext an Quelle und SHA-256.
Fehlende Originaldateien werden mit ihrer tatsächlichen Ersatzquelle benannt;
es gibt keine automatische Lizenzvermutung aus Paketnamen.

`engine-inventory.json` enthält die vollständige Typzuordnung des verifizierten
WASM-Moduls. Der Compiler ordnet mit dem Fat-JAR nicht alles korrekt zu;
`scripts/notices/engine-inventory.py` ergänzt daher Original-JAR-/Bytevergleiche.
Unbekannte und mehrdeutige Typen sowie jupnp-/Netzwerktypen führen zum Fehler.
`unattributedDependencies` pinnt Bibliotheken ohne `pom.properties`:
tinylog/Sentry laut Forge-POM, XMLPull laut mxparser-POM,
Checker Qual laut Guava-Parent-POM. Der Bytevergleich ist zusätzlich Pflicht.

Nach einem anderen Engine-Build:

1. `node engine/scripts/engine-lock.mjs verify <build>/dist`.
2. Die App erzeugt für neue vollständige Builds automatisch deren Inventur
   unter `<build>/report/notices-inventory.json`. Fehlende Build-Nachweise sind
   ein Fehler; es gibt keinen Rückfall auf eine fremde Engine-Inventur.
3. Neue Koordinaten, Originaltexte und Notice-Dateien überprüfen. Bei einem
   isolierten Forge-Update Ergänzungen gemäß `engine/NOTICES.md` ausschließlich
   unter `engine/**` ablegen. Ungeklärte Oracle-Bedingungen offen lassen.
4. App mit diesem Build und seinem Katalog über `OPENMANA_ENGINE_DIR` /
   `OPENMANA_CARDS_DIR` bauen und `npm run check` ausführen.

`vite/notices.ts` ermittelt die tatsächlich gerenderten npm-Pakete, prüft sie
gegen den Lock, erhält alle LICENSE/NOTICE/Copyright-Dateien und ergänzt
CSS/Fonts, shadcn und Ajv-Standalone-Code. Es erzeugt
statische Auslieferungsdateien unter `dist/legal/`. Die geprüfte Root-Fassung
`THIRD-PARTY-NOTICES.md` wird ausdrücklich mit
`cp dist/legal/THIRD-PARTY-NOTICES.txt THIRD-PARTY-NOTICES.md` übernommen, nicht
bei jedem Build überschrieben: Forge-Update-Builds müssen die App-Quellen erhalten.
Das PWA-Manifest bindet diese Dateien an ihre SHA-256 und hält
sie offline verfügbar. Im Dev-Server stammen Drittanbieterhinweise aus dem
letzten Build, Repository-Lizenz und Quellenanleitung aus dem aktuellen Checkout.

Originaltexte in `licenses/` bleiben in ihrer Originalsprache erhalten. Der
komplette Oracle-Distributionsanhang ist ein vorsorglicher Zusatz und keine
Liste der ausgelieferten Komponenten. JDK-Lizenztexte mit ISO-8859-1 sind
texttreu nach UTF-8 übertragen; Originalhash und Zeichensatz stehen pro Datei
im Anhang. `SOURCE.md` und das bestehende Oracle-/Quellcode-Gate gelten weiter.

Gezielte Tests: `npm test -- vite/notices.test.ts` und
`python3 -B scripts/notices/test_engine_inventory.py`. Die vollständige
Browser-/PWA-Abnahme ist Bestandteil von `npm run check`.
