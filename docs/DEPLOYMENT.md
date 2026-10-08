# Deployment und Rollback

OpenMana ist eine statische Web-App (PWA) auf Vercel, Projekt `openmana`.
Produktion folgt `main` auf GitHub (`dev0gig/openmana`); jeder Push auf `main`
erzeugt ein Produktions-Deployment und verbraucht Vercel-Kontingent – deshalb
nur auf ausdrückliche Anweisung des Projektbesitzers pushen (`AGENTS.md`).

| Adresse | Rolle |
|---|---|
| https://openmana.oryx.quest/ | Hauptadresse (ORYX-Domain, Vercel-Domain des Projekts) |
| https://openmana.vercel.app/ | Rückfalladresse, gleicher Build |

Beide Adressen sind eigene Ursprünge: Decks, Einstellungen und Partien liegen
je Adresse in einer eigenen IndexedDB. Die ORYX-Cloud ist auf beiden aktiv
(`REAL_ADDRESSES` in `src/cloud/cloud-sync.ts`; beide Adressen stehen im
OAuth-Client `OpenMana` der ORYX-Supabase).

## Was ein Deployment baut

`vercel.json`:

1. `npm ci`
2. `node scripts/deploy/fetch-artifacts.ts` – lädt Engine und Kartenkatalog aus
   dem GitHub-Release, das `deploy/artifacts.json` nennt, und prüft jede Datei
   (Größe, SHA-256) gegen `deploy/artifacts.json`, `engine/engine.lock.json`,
   das Engine-Manifest und die Forge-Revision des Katalogs. Keine Ausweichquelle.
3. `OPENMANA_PUBLIC_RELEASE=1 … npm run build` – Schemas, Typprüfung, Vite-Build.
   Das Lizenz-Gate (`vite/notices.ts`) verlangt die Entscheidung in
   `docs/PUBLICATION.md`, das Quellangebot in `SOURCE.md` und den genauen Commit
   (`VERCEL_GIT_COMMIT_SHA`); Engine und Katalog werden erneut geprüft und
   inhaltsadressiert unter `/engine/<id>/` und `/cards/<id>/` abgelegt; Hinweise
   und Lizenztexte entstehen aus dem tatsächlichen Bundle.
4. `node scripts/deploy/budgets.ts` – Größenbudgets (Start-JavaScript und -CSS
   gzip, Engine-Modul, Katalog). Überschreitung = Build schlägt fehl.

Header (`vercel.json`, getestet in `vite/deployment.test.ts`): COOP/COEP/CORP
auf jeder Antwort (ohne sie startet die Engine nicht), `nosniff`,
`Referrer-Policy`, `immutable` nur für inhaltsadressierte Dateien, `no-cache`
für `sw.js` und `assetlinks.json`, SPA-Fallback nie für Engine-, Karten-,
Asset-, Rechts- oder `.well-known`-Dateien.

Fehler werden nie heimlich übertragen: Es gibt keine Telemetrie. Abbrüche
zeigen Grund und technische Meldung; die Engine-Diagnose (Einstellungen)
erzeugt einen kopierbaren Bericht. Browser ohne die nötigen Fähigkeiten
(SharedArrayBuffer/Isolation, WasmGC, Ausnahmen, Worker) bekommen vor jedem
Download eine Prüfung mit der fehlenden Voraussetzung (`device-support.tsx`).

## Neue Engine- oder Katalogversion

Nur nach einem vollständigen, bestandenen Forge-Update (`engine/UPDATING.md`),
das `engine/engine.lock.json` geschrieben hat:

```sh
node engine/scripts/engine-lock.mjs verify <build>/dist
node scripts/deploy/prepare-release.ts --engine <build>/dist --cards <build>/catalog --out <release-dir>
bash scripts/deploy/source-archive.sh <release-dir>          # Quellarchiv des aktuellen Commits samt Forge
curl -fLo <release-dir>/jgrapht-core-1.5.2-sources.jar \
  https://repo1.maven.org/maven2/org/jgrapht/jgrapht-core/1.5.2/jgrapht-core-1.5.2-sources.jar
git add deploy/artifacts.json && git commit …
git tag <tag aus deploy/artifacts.json> && git push origin <tag>
gh release create <tag> <release-dir>/* --title "Engine <tag>" --notes-file …
```

Das Release muss stehen, **bevor** `main` mit dem neuen
`deploy/artifacts.json` gepusht wird – sonst scheitert der Build (gewollt).
Release-Assets nie ersetzen oder löschen: Ältere Deployments und das
Quellangebot hängen an ihnen. Eine neue Engine = neues Release, neuer Tag.

Vor dem Push lokal proben (frischer Klon ohne Forge und ohne `.git`, wie Vercel):

```sh
git clone --no-recurse-submodules . /tmp/om && cd /tmp/om && rm -rf .git && npm ci
VERCEL_GIT_COMMIT_SHA=<sha> node scripts/deploy/fetch-artifacts.ts --from <release-dir>
VERCEL_GIT_COMMIT_SHA=<sha> OPENMANA_PUBLIC_RELEASE=1 OPENMANA_ENGINE_DIR=.artifacts/engine OPENMANA_CARDS_DIR=.artifacts/cards npm run build
node scripts/deploy/budgets.ts
```

## Nach dem Deployment prüfen

- `/` und eine Unterroute 200 mit COOP/COEP/CORP; `crossOriginIsolated` im Browser.
- `/.well-known/assetlinks.json` 200, `application/json`, keine Umleitung.
- `/legal/THIRD-PARTY-NOTICES.txt` nennt den ausgelieferten Commit.
- Eine echte Partie gegen Forge im Browser bis zum Ergebnis; Kartenbilder von
  Scryfall laden unter COEP (CORS-Modus).
- Service Worker: Ein neues Deployment wartet, bis alle alten Tabs zu sind
  (Prompt 25); nie erzwingen.

## Rollback

Die App ist statisch; ein Rollback ist ein Zurückschalten auf ein älteres
Deployment, kein Datenumbau:

1. **Sofort:** Vercel-Dashboard → Projekt `openmana` → Deployments → das letzte
   gute Produktions-Deployment → „Instant Rollback“ (oder
   `vercel rollback <deployment-url>`). Beide Adressen zeigen danach wieder
   darauf. Das löst keinen neuen Build aus.
2. **Dauerhaft:** den fehlerhaften Commit auf `main` mit `git revert` rückgängig
   machen und (mit Freigabe) pushen; nie die Historie von `main` umschreiben.
   Ein Engine-Rollback ist das Zurücksetzen von `deploy/artifacts.json` und
   `engine/engine.lock.json` auf den vorigen Stand – das alte Release besteht
   unverändert.
3. **Spielerdaten:** Die lokale Datenbank migriert nur vorwärts (`SchemaVersion`).
   Ein Rollback über eine Schemaänderung hinweg lässt die ältere App eine neuere
   Datenbank als „neuer“ melden (gewollt, nichts wird überschrieben); deshalb
   Schemaänderungen nie zusammen mit riskanten Änderungen ausrollen.
4. **Service Worker:** Ein Rollback ist für den Worker einfach eine neue
   Version; offene Tabs wechseln erst, wenn alle alten geschlossen sind.

## ORYX und Android

OpenMana läuft auf Android nur in der gemeinsamen ORYX-App (`net.tsnet.oryx`,
Trusted Web Activity). `public/.well-known/assetlinks.json` nennt deren
Signatur; die Liste der vertrauten Adressen der ORYX-App entsteht aus
`games.json` im Repo `dev0gig/oryx-games` (`node scripts/games.mjs`). Ändert
sich OpenManas Adresse, braucht die ORYX-App einen neuen Build.
