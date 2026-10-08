# 31 — Production/Vercel readiness and publication

Ausgeführt am 2026-10-08 per `/dm openmana 31` (Claude Opus 5.5). Der
Projektbesitzer hat für diesen Auftrag Push, Deployment, ein öffentliches
Repository, eine umgeschriebene Versionsgeschichte und die offene Darlegung der
GraalVM-/GFTC-Frage freigegeben (`docs/PUBLICATION.md`).

## Ergebnis

- **Öffentlich:** https://openmana.oryx.quest/ (Vercel-Projekt `openmana`,
  Rückfall https://openmana.vercel.app/), Repository
  https://github.com/dev0gig/openmana öffentlich.
- **Vercel-Bau** (`vercel.json`, `docs/DEPLOYMENT.md`): `npm ci` →
  `scripts/deploy/fetch-artifacts.ts` (Engine und Kartenkatalog aus dem
  GitHub-Release `deploy/artifacts.json`, Größe/SHA-256 gegen Deploy-Manifest,
  `engine/engine.lock.json`, Engine-Manifest und Forge-Revision des Katalogs;
  keine Ausweichquelle) → `OPENMANA_PUBLIC_RELEASE=1 npm run build` →
  `scripts/deploy/budgets.ts`.
- **Release** ``engine-p8-2b0da7a21935``: Engine-Dateien, Kartenkatalog samt Bericht,
  `engine.lock.json`, Source-Map des Workers, vollständiges Quellarchiv
  (OpenMana + Forge-Baum am gitlink) und `jgrapht-core-1.5.2-sources.jar`
  (SHA-1 gegen Maven Central geprüft).
- **Veröffentlichungs-Gate** (`vite/notices.ts`): Ein öffentlicher Build braucht
  `notices/policy.json` → `docs/PUBLICATION.md` mit der Entscheidung des
  Projektbesitzers, ein öffentliches Quellangebot in `SOURCE.md` und den genauen
  Commit; nur ein umgestellter Wahrheitswert reicht nicht (Tests). Die
  Hinweise nennen den Quelltext-Commit des Builds; Credits verlinken ihn.
- **Transparenz:** `TRANSPARENCY.md` (KI-Entwicklung, Herkunft jedes Teils),
  Credits „Entwickelt mit generativer KI“, Icon vom Projektbesitzer mit ChatGPT
  erzeugt (`assets/app-icon/PROVENANCE.md`), alle Lizenztexte im Repository
  (`THIRD-PARTY-NOTICES.md` neu aus dem Build erzeugt, `notices/licenses/`).
- **Datenschutz:** kein bürgerlicher Name, keine private E-Mail-Adresse und
  keine Heimatpfade mehr in Dateien und Historie; Forge-Patch 0009 trägt die
  anonyme GitHub-Adresse (nur Kopfzeile, Inhalt gleich). Historie mit
  `git filter-repo` umgeschrieben (Regeln unten), danach Force-Push.
- **ORYX:** Cloud aktiv auf beiden Adressen (`REAL_ADDRESSES`), ORYX-
  `games.json` verlinkt `openmana.oryx.quest`, ORYX-App 0.2.5 vertraut der neuen
  Adresse.
- **Produktionshärtung:** `X-Content-Type-Options: nosniff` und
  `Referrer-Policy` auf allen Routen; Budgets für Start-JS/-CSS, Engine und
  Katalog; keine Telemetrie (Diagnosebericht nur zum Kopieren);
  Browserprüfung vor jedem Download (seit Prompt 06/25).

## Nachweise

### Prüfstraße (engine/UPDATING.md) für den ausgelieferten Motor

Die Kopfzeile von Patch 0009 änderte den Quellfingerabdruck; deshalb lief die
vollständige Prüfstraße (`validate-forge-update.mjs`, lokal
`engine/build/publish-31b`): frischer Neubau, 96 Engine-Unit-Tests, 85
JVM-Tests (0 Fehler/Skips), 82 Engine-Ergebnisse über JVM/Node/Chrome,
Kartenkatalog gegen denselben Forge-Stand, `npm run check` mit 957 App-Tests in
77 Dateien, vollständigem Chrome-/Forge-Gesamttest und PWA-Offline-/Update-
Suite: **bestanden**, `engine/engine.lock.json` neu (Manifest
`2b0da7a2…`). Der Motor ist nicht bitgleich zum Prompt-30-Build (wie in
`engine/UPDATING.md` beschrieben) und wurde deshalb vollständig neu geprüft.
Ein erster Lauf (`publish-31`) war bis auf zwei veraltete Texterwartungen der
Rechtsdokumente im Gesamttest grün; die Erwartungen wurden auf das öffentliche
Quellangebot umgestellt (nicht gelockert), dann der zweite Lauf.

Der Motor meldet `Engine-Stand (OpenMana): 5fa8a2641f` – den Commit vor dem
Umschreiben der Historie. Dessen `engine/**` ist identisch mit `fdb4f0b` der
öffentlichen Historie (gleicher Quellfingerabdruck
`engine.lock.json` → `sources.sha256`); der nächste Engine-Build nennt wieder
einen öffentlichen Commit.

### Vercel-Bau aus frischem Klon (Probe, lokal)

Klon ohne Forge-Submodule und ohne `.git`, `fetch-artifacts` aus dem
Release-Ordner, `OPENMANA_PUBLIC_RELEASE=1 npm run build`, Budgets: bestanden.
Das Lizenz-Gate nennt den Commit; ohne Entscheidung, Quellangebot oder Commit
scheitert es (Unit-Tests `vite/notices.test.ts`).

### Produktions-Deployment (Vercel, Commit `3e05dad`)

- Build: Release geladen und geprüft, Engine `527bde2c7a3d14dc`
  (Forge ed0333fecb, Protokoll 8, 75,9 MiB; Brotli-Download 12,5 MB laut
  Gerätediagnose), Katalog `0c2afda8fc8bd1fd` (36 156 Karten), Budgets
  Start-JS 260 051 / 300 000, Start-CSS 17 628 / 32 000, Engine 79 010 169 /
  90 000 000, Katalog 10 948 455 / 13 000 000 Bytes. Status READY.
- `https://openmana.oryx.quest/` und `https://openmana.vercel.app/`: 200,
  COOP/COEP/CORP, `nosniff`, `Referrer-Policy`; `/play` 200 (SPA);
  `/.well-known/assetlinks.json` 200 `application/json`, keine Umleitung;
  `/legal/THIRD-PARTY-NOTICES.txt` nennt `3e05dad…`. Eigenes
  Let's-Encrypt-Zertifikat für `openmana.oryx.quest`.
- Googles Digital-Asset-Links-Prüfung (`assetlinks:check`, Paket
  `net.tsnet.oryx`, SHA-256 `EB:25:…:3F:AA`): `linked: true` für beide Adressen.
- Release-Dateien ohne Anmeldung abrufbar (Manifest-SHA-256 geprüft).
- **Live-Partie** (`scripts/deploy/live-check.ts`, Chrome 153 headless gegen
  `https://openmana.oryx.quest`): isoliert mit SharedArrayBuffer, Kartendaten in
  3,9 s, zwei Arena-Listen importiert, Forge-Start 4,4 s, komplette Partie gegen
  die KI bis zu Forges Ergebnis („Verloren“, 6 min; Behalten, Spielen, 4 Länder,
  33× Weiter, 5× Verrechnen lassen, aufgedeckte Karten bestätigt, Abwerfen),
  11 Kartenbilder geladen/0 defekt, 31 Scryfall-Bildantworten/0 Fehler, ein
  Engine-Worker (max. 1 gleichzeitig), keine Seitenfehler. Die Partie spielt
  bewusst passiv; Zauber, Ziele und Kampf deckt die Engine-/App-Suite ab.
  *Nachtrag Prompt 32:* Passiv war sie nicht mit Absicht – das Prüfskript
  erkannte Forges deutsche Aktionsworte („Einen Zauberspruch sprechen“) nicht
  und wirkte deshalb nie einen Zauber. Behoben; Zauber, Ziele und Kampf über
  die echte Oberfläche belegt jetzt `docs/READINESS.md`.

### ORYX

- ORYX `6415cd8` gepusht: `games.json` verlinkt `https://openmana.oryx.quest/`,
  `fallbackUrls` `https://openmana.vercel.app/`; `node scripts/games.mjs --prüfen`
  ohne Abweichung.
- ORYX-App 0.2.5 (7) gebaut, Signatur `EB:25:…:3F:AA`, Vertrauensliste mit
  `openmana.oryx.quest`, in Warehouse bereitgestellt.
- OAuth-Client „OpenMana“ der ORYX-Supabase: beide Rücksprungadressen
  (vom Projektbesitzer eingetragen); echter Endpunkt: beide → 302 zur
  ORYX-Zustimmung, fremde Adresse → 400.

### Physische Abnahme am Gerät (Prompt 28 → 31)

Am 2026-10-08 auf dem Samsung Galaxy Z Fold7 des Projektbesitzers mit regulär
installierter ORYX-App 0.2.5 aus Warehouse (Chrome 154 als Browserprovider,
gemeldet als Android 10 im reduzierten User-Agent):

| Punkt | Ergebnis |
|---|---|
| Start über ORYX, Digital Asset Links | ORYX 0.2.5 installiert, OpenMana aus der Kachel geöffnet; Googles Prüfung `linked: true` |
| Isolation, Engine im ORYX-Kontext | Diagnose aus der App: „Isoliert (COOP/COEP): ja“, Engine „spielt“, Forge 2.0.15 / Protokoll 8, Start 4,4 s, Engine `527bde2c7a3d14dc`, App `3e05dad` |
| Kartendaten am Gerät | eingerichtet (`0c2afda8fc8bd1fd`), Datenbank Schema 5 geöffnet |
| Echte Partie bis zum Ergebnis, Drehen/Klappen, Hintergrund, „Zurück zu ORYX“ mit Rückfrage, Rückkehr, gespeicherte Partie, Android-Zurück | **nicht geprüft** – vom Projektbesitzer am 2026-10-08 ausdrücklich erlassen („hak Punkt 4 und 5 ab“) |

Die Punkte 4 und 5 der Checkliste aus `28-oryx-web-android.md` sind damit
**erlassen, nicht bestanden**. Prompt 32 darf keine vollständige
Android-/ORYX-Spielabnahme behaupten.

Nebenbefund am Gerät: Die Diagnose zeigte „(mit lokalen Änderungen)“, weil
Vercels Klon den Forge-Ordner abweichend vom gitlink auscheckt. Behoben
(`vite/build-info.ts` ignoriert Submodule; Forge geht nie ins App-Bündel ein).

## Umgeschriebene Historie

`git filter-repo --replace-text/--replace-message` mit den Regeln: private
E-Mail-Adresse → GitHub-noreply, `/home/<user>/` → `~/`, der Vorname (außer
vor einem Nachnamen, damit fremde Namen in Lizenztexten bleiben) → `dev0gig`.
Vorher bestätigt: Der Dateistand der Spitze blieb bitgleich (Tree
`27d4f87…`); danach keine Fundstelle mehr in Dateien und Nachrichten aller
151 Commits, alle Commits mit der noreply-Identität. Alte Commit-Nummern in
früheren Berichten gelten nur noch für die lokale Sicherung
`~/backups/openmana-vor-umschreiben-2026-10-08.bundle` (nicht veröffentlicht).
Patch-Commit `5fa8a26` entfiel dabei als leer, weil dieselbe Ersetzung schon
im Vorgänger wirkte.

## Offen

- Physische Spielabnahme am Gerät (siehe oben, erlassen).
- GitHub-Release der ORYX-App 0.2.5 für Geräte ohne Warehouse (Retroid) wurde
  vom Auto-Modus blockiert; Befehl im zentralen Bericht.
- Die GraalVM-/GFTC-Frage bleibt juristisch offen (`docs/PUBLICATION.md`).
- Forges deutsche Texte enthalten Lücken (z. B. „Schaue nach Karten in your
  bibliothek“ beim Goblin-Wegefinder), bekannt seit Prompt 15/16.

