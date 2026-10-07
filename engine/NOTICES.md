# Lizenzprüfung bei Forge-Updates

Die App erzeugt ihre Engine-Hinweise aus der Klassen-SBOM und den Original-JARs
des ausgewählten Build-Verzeichnisses. Der geprüfte bestehende Build verwendet
die eingefrorene Inventur unter `notices/`. Neue Kandidaten erzeugen eine eigene
Inventur unter `<build>/report/notices-inventory.json`; keine App-Datei wird
dadurch verändert. Ein neuer Forge-Pin darf den unveränderten GPL-Text
wiederverwenden. Neue Bibliotheken/Versionen benötigen vor der App-Abnahme
eine ausdrückliche Lizenzprüfung.

Solche Ergänzungen gehören **nur unter `engine/**`**: Originaltexte als
`engine/notices/<name>.md` (Originalsprache/-inhalt erhalten) und Zuordnungen
im folgenden JSON-Block. Jede `licenseFiles`-Zuordnung benennt `file`, `source`
und SHA-256; jede `engineComponents`-Zuordnung benennt den exakten
`group:artifact:version`, `license` und `texts` (IDs der Lizenzdateien).
`unattributedDependencies` pinnt zusätzliche Original-JARs, die im Fat-JAR
keine `pom.properties` mitführen. Die Original-Klassenbytes müssen passen.

Die `.md`-Dateien sind Lizenzdokumentation, keine kompilierten Eingaben;
die bestehende `sourceIdentity` schließt Dokumentation bereits aus.
Das Lizenzgate und die unveränderten App-Quellen bleiben verbindlich.
Oracle-/GFTC-Freigabe und öffentliche Quellen sind damit nicht geklärt.

```json
{
  "engineComponents": {},
  "licenseFiles": {},
  "unattributedDependencies": []
}
```
