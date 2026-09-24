# 06 — Web-App- und PWA-Grundgerüst

> Umsetzung von [`prompts/queue/06-web-pwa-skeleton.md`](../../prompts/queue/06-web-pwa-skeleton.md),
> Stand **2026-09-24**, ausgeführt von Claude Code (Claude Opus 5.5). Alle Nachweise liefen auf dem
> Commit `cfb2252` (sauberer Arbeitsbaum; die App meldet `modified: false`). Grundlage:
> [`docs/BIBLE.md`](../BIBLE.md) §6, §11–§17, [`docs/research/OPENMANA_ENGINE_PLAN.md`](../research/OPENMANA_ENGINE_PLAN.md)
> §4 und §7 (Worker, COOP/COEP, Vercel), die Engine-Artefakte aus Prompt 01–05 und das
> Design-System [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Code: `src/` (App), `vite/` (Build-Plugins),
> `scripts/e2e/run.ts` (End-to-End-Test). Messungen auf odin (Intel i7-8700T, 12 Threads,
> Debian 13), Node 22.22.3, Chrome for Testing 153 headless.

## Ergebnis

**Prompt 06 ist umgesetzt.** OpenMana hat eine Web-App im Wurzelverzeichnis
des Repos: React 19, Vite 8, TypeScript 7 im Strict-Modus, Tailwind CSS 4 mit
shadcn/ui – ein gängiger, für Vercel geeigneter Stack. Sie hat die sechs
Oberflächen **Start, Decks, Spielen, Partien, Einstellungen und Credits**,
eine Seitenleiste ab Tablet-Breite und eine Tab-Leiste auf dem Handy, alles
deutsch beschriftet. Ein eigenes **OpenMana-Design-System** (dunkles
Nachtblau, Gold, Cinzel für Überschriften, Touch-Größen ab 44 px) ist
festgelegt, dokumentiert und per Test abgesichert.

Die App bindet die **echte Engine** an: Auf „Spielen“ startet „Engine laden“
Forge im Dedicated Worker über den vorhandenen `EngineClient`; die Seite zeigt
Forges eigene Startschritte, dann „Bereit“ mit den Angaben der Engine (Forge
2.0.15 `ed0333fecb`, Engine-Build, Protokoll 3) oder den Grund eines Abbruchs.
Es gibt **keine erfundenen Spieldaten**: Decks und Partien sind ehrlich leer,
„Partie starten“ bleibt gesperrt und sagt warum. Der Build übernimmt die
Engine aus `engine/build/dist` nur **geprüft** (Größe und SHA-256 jeder Datei
laut Manifest, gleiche Protokollversion) und legt sie inhaltsadressiert unter
`/engine/<id>/` ab; ohne gültige Engine bricht er laut ab.

**Header und PWA:** Dev-Server, Vorschau und `vercel.json` senden auf jeder
Route COOP `same-origin`, COEP `require-corp` und CORP `same-origin` (eine
Quelle, per Test gleich gehalten). Ohne diese Header zeigt die App klar, dass
die Engine hier nicht laufen kann, und lädt sie gar nicht erst. Ein
Web-App-Manifest mit Icons macht die App installierbar – Chrome meldet keine
Installierbarkeitsfehler. Das **vorläufige App-Icon** ist Anvils Icon, Byte für
Byte übernommen, mit Herkunftsnachweis.

**Nachweise:** Typecheck (App, Tests, Werkzeuge), oxlint, 82 Unit- und
Komponententests, ein End-to-End-Test im echten Chrome mit der echten Engine
(alle Seiten in drei Größen samt axe-Prüfung, Engine-Start über Vorschau und
Dev-Server, Installierbarkeit, Negativtest ohne Isolation), dazu die 80
bestehenden Engine-Unit-Tests und ein frischer Klon ohne Engine. Alles grün,
kein Blocker.

## 1. Was gebaut wurde

```
openmana/
├── index.html, vite.config.ts, vitest.config.ts, vercel.json, components.json, .oxlintrc.json
├── tsconfig.json → tsconfig.app.json (src), tsconfig.test.json (Tests), tsconfig.node.json (Werkzeuge)
├── package.json / package-lock.json    die App (npm), unabhängig von engine/package.json
├── assets/app-icon/                    Anvils Icon (Original) + PROVENANCE.md
├── public/                             Manifest, Icons (aus dem Original skaliert), favicon.ico
├── scripts/gen-app-icons.py            Icons erzeugen (Pillow, reine Lanczos-Skalierung)
├── scripts/e2e/run.ts                  End-to-End-Test (Chrome, echte Engine)
├── vite/                               Build-Plugins und ihre Tests
│   ├── engine-assets.ts                Engine prüfen, ausliefern, als virtual:openmana-engine melden
│   ├── build-info.ts                   App-Version und Commit (virtual:openmana-build)
│   ├── isolation-headers.ts            COOP/COEP/CORP – eine Quelle für Dev, Vorschau, Vercel
│   ├── aliases.ts                      die einzigen Wege von src/ nach engine/
│   └── watch.ts                        was der Dev-Server beobachtet (siehe §9.1)
└── src/
    ├── main.tsx, index.css             Einstieg; Design-Tokens (shadcn-Theme)
    ├── app/                            Router, App-Rahmen, Navigation, Build-Info (+ Tests)
    ├── routes/                         die sechs Oberflächen, „nicht gefunden“, Fehlerseite
    ├── engine/                         EngineSession, Engine-Anzeige, Gerätecheck, deutsche Texte
    ├── components/                     Brand, Page/PageHeader, FactList, TextLink, AppSidebar
    ├── components/ui/                  shadcn/ui (radix-maia) + BottomNav (shadcn-Bauweise)
    └── test/                           Test-Setup und die zwei festen Ersatzwerte für Build-Module
```

| Route | Oberfläche | Inhalt jetzt |
|---|---|---|
| `/` | Start | Logo und Claim, „Spielen“/„Decks“, drei Schritte bis zur Partie (was noch fehlt, ist als „folgt“ markiert), Gerätecheck |
| `/decks` | Decks | leer; „Arena-Deck importieren“ gesperrt mit Hinweis |
| `/play` | Spielen | Partie vorbereiten (kein Deck → „Partie starten“ gesperrt), **Forge-Engine** laden/beenden |
| `/matches` | Partien | leer; Aufzeichnung folgt |
| `/settings` | Einstellungen | App-Version und Commit, Engine-Build (Forge-Stand, Patches, Protokoll, GraalVM, Größe), Gerätecheck, Weg zu den Credits |
| `/credits` | Credits | enthaltene Software (Forge, GraalVM Web Image, Bibliotheken und Schriften), Vorbild ManaBrew, KI-Unterstützung (ChatGPT, Claude), App-Icon, Fan-Projekt-Hinweis |
| sonst | nicht gefunden | im App-Rahmen, Navigation bleibt |

## 2. Stack und Branchenstandard

| Baustein | Wahl | Einordnung |
|---|---|---|
| UI | React 19.3 + React Router 8.4 (Data Mode, `createBrowserRouter`) | verbreitetster React-Weg für eine SPA; kein Server-Rendering nötig, die App ist statisch |
| Build | Vite 8.3 (Rolldown) | Standard für React-SPAs, Vercel erkennt es direkt |
| Sprache | TypeScript 7.0.2 strict (wie `engine/`), `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, nur löschbare Syntax | derselbe Compiler prüft App und die importierten Engine-Quellen |
| Styling | Tailwind CSS 4 + shadcn/ui (Stil `radix-maia`, Radix-Primitives, Lucide) | Vorgabe des Projektbesitzers für alle Web-Oberflächen; shadcn ist ein etabliertes Baukastensystem, dessen Theme über Tokens läuft |
| Tests | Vitest 5 + Testing Library + jsdom; End-to-End mit `playwright-core` 1.63 und Chrome for Testing 153 (dieselben wie die Engine-Tests) + axe-core 4.13 | übliche Kombination; der E2E-Test nutzt bewusst den Chrome der Engine-Tests |
| Lint | oxlint 1.85 (Korrektheit, React-Hooks-Regeln, jsx-a11y) | ESLints TypeScript-Parser (typescript-eslint) unterstützt TypeScript 7 noch nicht (`typescript <6.1`); oxlint braucht keine TypeScript-API |

Alle Pakete sind wie in `engine/` exakt gepinnt. `shadcn` ist nur
Entwicklungsabhängigkeit (sein `tailwind.css` wird beim Bauen eingebettet).

## 3. Design-System

Festgelegt in [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Kurz:

- **Nur shadcn/ui-Bausteine und Tokens**, kein eigenes CSS in Seiten. Fehlt ein
  Baustein, wird er in shadcn-Bauweise ergänzt (`BottomNav`).
- **Nur dunkel:** Nachtblau `#0d121b`, Karten eine Stufe heller, Pergament-Weiß
  für Text, Gold für Hauptaktionen und Fokus. Kein helles Theme.
- **Schriften:** Cinzel (Überschriften, Wortmarke) und Inter (Text), gebündelt
  statt vom Font-CDN.
- **Touch zuerst:** auf Touch-Geräten Bedienflächen ab 44 px (zentral in den
  Button- und Sidebar-Varianten), Tab-Leiste 64 px hoch.
- **Barrierefreiheit:** Kontraste aus den Tokens nachgerechnet (alle
  Text/Fläche-Paare ≥ 4,5:1, die meisten > 7:1), Textlinks unterstrichen,
  benannte Regionen, axe-core im E2E-Test ohne ernste Befunde.
- **Ehrliche Zustände:** leer heißt leer, Gesperrtes sagt warum, Fehler zeigen
  sich an Ort und Stelle und als Toast.

## 4. Engine-Anbindung

### 4.1 Build: welche Engine die App ausliefert (`vite/engine-assets.ts`)

- Liest `engine/build/dist/engine-manifest.json` (Format 2) und prüft die drei
  Laufzeitdateien `engine-worker.js`, `openmana-engine.js`,
  `openmana-engine.js.wasm`: vorhanden, Größe und **SHA-256 wie im Manifest**,
  Protokollversion = `PROTOCOL_VERSION` der App. Jeder Fehler ist ein lauter
  Abbruch mit Grund („no engine build in …; build it with: bash
  engine/scripts/build.sh“, „has SHA-256 …, the manifest says …“, „speaks
  protocol 4, the app speaks protocol 3“).
- **Inhaltsadresse:** `id` = die ersten 16 Hexziffern eines SHA-256 über die
  Prüfsummen der Laufzeitdateien (jetzt `0c82db80023ac0cc`). Gleiche Engine,
  gleiche Adresse – deshalb dürfen `/engine/<id>/…` für immer im Cache bleiben.
- `vite build` kopiert die Dateien samt Manifest nach `dist/engine/<id>/` und
  prüft die Kopie erneut. Der Dev-Server liefert sie direkt aus
  `engine/build/dist` (mit den Isolations-Headern, fremde Dateinamen → 404).
- Die App erfährt über das Modul `virtual:openmana-engine`, wo die Engine liegt
  und was ihr Manifest sagt (Forge-Commit, Patches, Protokoll, GraalVM,
  Größen). **Ohne Engine:** Der Produktions-Build scheitert;
  `OPENMANA_ENGINE=omit` baut absichtlich ohne (die App sagt dann „Diese
  App-Version enthält keine Forge-Engine“); der Dev-Server startet auch ohne und
  zeigt den Grund. `OPENMANA_ENGINE_DIR` zeigt auf ein anderes Engine-Verzeichnis.

### 4.2 Laufzeit: `EngineSession` (`src/engine/engine-session.ts`)

- Eine Sitzung für die ganze App (React-Kontext im App-Rahmen), damit die
  Engine weiterläuft, wenn man die Seite wechselt. Immer höchstens eine Engine
  (etwa 1 GB); sie startet **nur auf Knopfdruck**. Vorwärmen beim Öffnen der
  Deckwahl ist Aufgabe von Prompt 11.
- Zustände: `unavailable` (Build ohne Engine), `unsupported` (Browser kann es
  nicht; Feature-Erkennung aus `engine/protocol`, vor jedem Download),
  `idle`, `booting` (die vier `engine.boot`-Phasen der Engine mit Zeiten),
  `ready` (`engine.ready`: Forge-Version und -Commit, Engine-Build, Protokoll,
  Startbericht), `aborted` (`engine.abort` mit Grund und Technikdetail).
  „Engine beenden“ beendet den Worker und gibt den Speicher frei.
- Der **Engine-Client wird erst beim Start nachgeladen** (dynamischer Import):
  er trägt die Schemaprüfer des Protokolls (383 KB), die sonst die Hälfte des
  Start-Bundles wären. Scheitert das Nachladen, ist das ein sichtbarer Abbruch
  (`boot-failed`, Stufe `client-load`), kein Hänger.
- Ein Abbruch erscheint auf „Spielen“ als Hinweis und zusätzlich als Toast –
  auch wenn man gerade auf einer anderen Seite ist.
- Die UI importiert von der Engine nur `engine/protocol` und `engine/client`
  (Aliase `@openmana/engine-protocol[/<datei>]`, `@openmana/engine-client`).
  `src/app/boundary.test.ts` lässt jeden anderen Weg nach `engine/` scheitern
  (nachweislich: ein Test-Import von `engine/wasm/host` wurde erkannt).

### 4.3 Was die Engine-Anzeige zeigt

Nur Angaben der Engine selbst bzw. ihres Manifests: Startschritte und -zeit,
Forge `versionCode` + Commit (Forges eigene Versionszeichenkette ist in
diesem Build nur „GIT“), Engine-Build-Commit (mit Hinweis bei lokalen
Änderungen), Protokoll, Zahl der Forge-Dateien, Kartenlade-Modus. Vor dem
Laden: Größe (75,8 MB, Brotli 12,5 MB) und der Speicherbedarf.

## 5. Header und Auslieferung

- **COOP/COEP/CORP** stehen einmal in `vite/isolation-headers.ts` und gelten
  für Dev-Server und `vite preview`; `vercel.json` setzt dieselben Werte auf
  `/(.*)`. `vite/deployment.test.ts` hält alles gleich.
- **Caching auf Vercel:** `/assets/*` (Vite-Hashes) und `/engine/*`
  (Inhaltsadresse) `public, max-age=31536000, immutable`; HTML, Manifest und
  Icons behalten Vercels Standard (Revalidierung).
- **SPA-Fallback:** Alle App-Routen gehen auf `index.html`, aber nie
  `/assets/`, `/engine/` oder `/icons/` – eine fehlende Engine-Datei wird so
  ein 404 statt einer HTML-Seite, die der Worker nicht versteht.
- **Vercel-Build:** `npm ci` und `npm run build`. Auf Vercel gibt es keinen
  Engine-Build (GraalVM, ~6 min, 6 GB RAM); der Build scheitert dort deshalb
  bewusst laut, bis Prompt 31 die gepinnte, geprüfte Engine als Release-Artefakt
  hineinholt (Research §7, offene Frage 6). Für eine reine UI-Vorschau geht
  `OPENMANA_ENGINE=omit`. **Es wurde nichts deployt.**

## 6. PWA-Grundlagen

- `public/manifest.webmanifest`: `id` `/` (stabile Identität für spätere
  Installationen und die Android-Hülle), Name, Kurzname, Beschreibung,
  `lang` `de`, `start_url`/`scope` `/`, `display` `standalone`,
  `orientation` `any` (Handy, Foldable, Tablet), Theme- und Hintergrundfarbe
  `#0d121b`, Icons 192/512 als `any` und `maskable`.
- `index.html`: `lang="de"`, `class="dark"`, `color-scheme` dark,
  `theme-color`, Favicon, Apple-Touch-Icon, Manifest.
- **Kein Service Worker in diesem Schritt.** Chrome verlangt für die
  Installation keinen mehr (Nachweis: keine Installierbarkeitsfehler per CDP
  `Page.getInstallabilityErrors`). Ein Service Worker, der Antworten liefert,
  muss COOP/COEP erhalten, die Engine versioniert und geprüft zwischenspeichern
  und Updates ohne laufende Partie einspielen – genau das ist Prompt 25. Ein
  halber Service Worker jetzt könnte dort die Isolation still brechen. Offline
  funktioniert die App deshalb **noch nicht**, und sie behauptet es auch nicht.

## 7. App-Icon

`assets/app-icon/anvil-icon.png` ist Anvils `assets/icon.png`, byte-gleich
(SHA-256 `6415e9ea…46e8`, 1254 × 1254, Stand `dev0gig/anvil@7c97fbb`), mit
Herkunftsnachweis in [`assets/app-icon/PROVENANCE.md`](../../assets/app-icon/PROVENANCE.md).
`scripts/gen-app-icons.py` skaliert es wie Anvils eigener Generator mit
Lanczos – ohne Zuschnitt, Rahmen, Maske oder Rand – auf 192, 512, 180
(Apple) und 16/32/48 (favicon.ico); ein zweiter Lauf ist byte-gleich. Das Bild
ist vollflächig gemalt, deshalb dient es unverändert auch als `maskable` (die
Maske schneidet nur den gemalten Rand, wie bei Anvils adaptivem Android-Icon).
Neu gestaltet wird es später; für die öffentliche Veröffentlichung prüft
Prompt 27 auch das Icon.

## 8. Nachweise

Alle auf `cfb2252`.

### 8.1 Typecheck und Lint

`tsc -b` über drei Projekte (App, Tests, Werkzeuge) ohne Fehler; die
Engine-Quellen, die die App importiert, werden dabei mit den strengen
App-Einstellungen mitgeprüft. `oxlint` ohne Befund; dass die Hook-Regeln
greifen, zeigte eine absichtlich falsche Komponente (Exit 1).

### 8.2 Unit- und Komponententests (82, Vitest)

| Datei | Tests | Was |
|---|---:|---|
| `src/engine/engine-session.test.ts` | 8 | Build ohne Engine und Browser ohne Voraussetzungen starten nie; Boot durch die vier Phasen bis `ready` mit Zeiten und absoluten Engine-URLs; Abbruch mit Grund, neuer Versuch mit frischem Client; Beenden ignoriert späte Nachrichten; Abbruch vor dem Nachladen verwirft den Client; gescheitertes Nachladen = Abbruch (schemakonform); doppelter Start wird ignoriert. Jede Test-Nachricht wird gegen das echte Protokollschema geprüft. |
| `src/app/app.test.tsx` | 17 | jede Oberfläche im Rahmen mit `h1`, Tab-Leiste mit den vier Zielen, `aria-current`, Navigation, Einstellungen über das Zahnrad, Credits über Einstellungen, 404 im Rahmen; keine erfundenen Daten (leere Decks/Partien, gesperrte Aktionen); Credits trennen die Arten; Engine-Anzeige: laden → Schritte → Bereit mit Engine-Angaben → beenden, Abbruch mit Grund und „Erneut versuchen“, kein Ladeknopf ohne Voraussetzungen |
| `src/app/design-tokens.test.ts` | 20 | 18 Text/Fläche-Paare ≥ 4,5:1, Theme-Farbe = Token, nur eine (dunkle) Palette |
| `src/app/pwa.test.ts` | 7 | Manifest installierbar, Icons in behaupteter Größe, Farben, `index.html`-Links, favicon 16/32/48, Anvil-Icon byte-gleich und Herkunft vermerkt |
| `src/app/boundary.test.ts` | 4 | nur die erlaubten Wege nach `engine/`, kein Name von Worker-Host/Bridge/Forge, Build-Module an genau einer Stelle gelesen |
| `vite/engine-assets.test.ts` | 13 | Engine-Prüfung (vollständig, fehlend, falsche Größe, falscher SHA-256, fehlende Datei, anderes Protokoll, kaputtes Manifest), Inhaltsadresse, URLs mit Basis-Pfad, `OPENMANA_ENGINE` streng, Plugin: Build ohne Engine scheitert, Dev ohne Engine meldet Grund, `omit`, Kopie wird geprüft |
| `vite/deployment.test.ts` | 13 | `vercel.json`: Build-Einstellungen, Isolations-Header auf acht Beispielpfaden, Dauer-Cache nur für Hash-Pfade, SPA-Fallback nie für Engine/Assets/Icons; Dev/Vorschau = dieselben Header; Dev-Server-Beobachtung |

### 8.3 End-to-End-Test (`npm run test:e2e`, rund 50 s mit Build; `npm run check` gesamt 59 s)

Echter Chrome 153 gegen `vite preview` des Produktions-Builds und gegen den
Dev-Server, mit der echten Engine `0c82db80023ac0cc`:

1. **HTTP:** `/`, Deep-Links und unbekannte Pfade liefern die App; jede Antwort
   (HTML, Manifest, Icon, alle Engine-Dateien) trägt COOP/COEP/CORP; Engine-Dateien
   mit richtigem Typ (`application/wasm` …) und vollständig; der Dev-Server
   ebenso, unbekannte Engine-Datei → 404 mit Headern.
2. **Alle sechs Oberflächen** bei 412 × 915 (Touch), 884 × 1104 (Touch) und
   1440 × 900: `h1` und Seitentitel stimmen, `crossOriginIsolated` ist wahr,
   keine Konsolenfehler, keine fehlgeschlagenen Anfragen, kein waagrechtes
   Überlaufen, am Handy Tab-Leiste statt Seitenleiste und umgekehrt,
   **axe-core ohne Befund** (18 Prüfläufe, 0 Befunde jeder Stufe; ernste
   oder kritische ließen den Test scheitern),
   Touch-Geräte melden `pointer: coarse`. Kein einziges Engine-Byte wird
   geladen, solange niemand fragt.
3. **Engine-Start** über die Vorschau (Desktop und Handy) und über den
   Dev-Server: vor dem Klick keine Engine-Datei und kein Client-Modul geladen,
   danach Worker, Launcher und Wasm; „Bereit“ mit Forge `2.0.15 (ed0333fecb)`,
   Engine-Build `0ddfbc3a04`, Protokoll 3, alle vier Schritte erledigt;
   „Engine beenden“ führt zurück zu „Nicht geladen“.
4. **PWA:** Chrome liest das Manifest ohne Fehler, **keine
   Installierbarkeitsfehler** (in einem echten Profil; im Inkognito-Kontext
   prüft Chrome das nicht).
5. **Ohne COOP/COEP:** Start zeigt „Dieser Browser kann die Forge-Engine nicht
   ausführen“, „Spielen“ nennt die fehlende Cross-Origin-Isolation und bietet
   kein Laden an; es wird nichts von der Engine heruntergeladen.

Bericht und Screenshots (erster Bildschirm und ganze Seite je Zustand) landen
in `reports/e2e/` (nicht versioniert).

### 8.4 Bestehende Tests und frischer Klon

- Engine (unverändert): erzeugte Protokolldateien = Schema, `tsc` strict,
  **80/80 Unit-Tests** (Protokoll, Client, Worker-Host).
- Frischer Klon von `cfb2252` ohne Engine-Build: `npm ci` 4 s; `npm run build`
  scheitert laut mit dem Hinweis auf `engine/scripts/build.sh`;
  `OPENMANA_ENGINE=omit npm run build` baut in 0,9 s ohne `dist/engine`;
  alle 82 Tests grün (sie hängen an keinem Engine-Build).

## 9. Messwerte

| | roh | gzip -9 |
|---|---:|---:|
| App-Code (`index-*.js`) | 199 KB | 63 KB |
| React + Router (`react-*.js`, eigener, lange gültiger Chunk) | 314 KB | 98 KB |
| CSS | 69 KB | 12 KB |
| Engine-Client mit Schemaprüfern (erst beim Engine-Start) | 407 KB | 39 KB |
| Engine (Worker, Launcher, Wasm) | 75,8 MiB | Brotli 12,5 MiB |

Start-JavaScript damit **161 KB gzip**; solange der Engine-Client mit den
Prüfern im Start-Bundle steckte, waren es 198 KB (Vites eigene Angabe: 163
statt 198 KB). Schriften kommen als woff2-Teilmengen nach Unicode-Bereich, der
Browser lädt nur, was er braucht (latin-Teilmengen: Inter 48 KB, Cinzel
26 KB). `vite build` 3–5 s.

**Engine bis „Bereit“ in der App** (Chrome, vollständiges Kartenladen): 5,0 s
bei ruhigerem odin (Lastmittel 5,9), 5,4–6,9 s beim Nachweis auf `cfb2252`
(Lastmittel 8–9), davon Download und Übersetzen 0,6–0,9 s, Forge-Start mit
allen Karten 4,3–6,0 s. Zum Vergleich unter derselben Last (Lastmittel 11):
Engine-Diagnoseseite 8,7 s, App 9,1 s – die App kostet beim Start praktisch
nichts; Prompt 04 hatte 5,06 s (Median) gemessen.

## 10. Befunde

### 10.1 Der Dev-Server stürzte über die Forge-Quellen ab (behoben)

Vite beobachtet standardmäßig das ganze Projekt. Unter `engine/` liegen aber
Forges Quellen (Submodule) und der Engine-Bauordner (~37 000 Ressourcendateien):
Der Dev-Server belegte alle Datei-Beobachter des Systems und stürzte mit
`ENOSPC: System limit for number of file watchers reached` ab – das hätte jedes
`npm run dev` getroffen und nebenbei andere Programme auf odin gestört.
`vite/watch.ts` lässt unter `engine/` nur `protocol/` und `client/` beobachten
(die einzigen Teile, die die App importiert), dazu nie `dist/` und `reports/`.

### 10.2 Forges Versionszeichenkette ist „GIT“

`engine.ready.engine.forgeVersion` stammt aus Forges `BuildInfo` und lautet
für Nicht-Release-Builds „GIT“. Aussagekräftig ist `forgeVersionCode`
(`2.0.15`, aus Forges `pom.xml`); die App zeigt diese.

### 10.3 Forges Startmeldungen erscheinen als Konsolenfehler

Beim vollständigen Kartenladen schreibt Forge 21 Datenhinweise als Fehler in
die Konsole des Workers (19 Karten ohne Set, darunter Alchemy-Karten, und
zweimal „Upcoming set Star Trek (TRK) dated in the future“). Das sind bekannte
Upstream-Hinweise – dieselben stehen im Maven-Log des Engine-Builds – und keine
App-Fehler. Der E2E-Test trennt deshalb Worker-Ausgaben (werden im Bericht
festgehalten) von Fehlern der Seite (lassen den Test scheitern).

### 10.4 Die Schemaprüfer gehören nicht ins Start-Bundle

Das Protokoll prüft jede Engine-Nachricht mit vorkompilierten Ajv-Prüfern
(383 KB). Solange die App den Protokoll-Index statisch importierte, landeten sie
im Start-Bundle. Jetzt importiert die App für die erste Seite nur die kleinen
Dateien (`features`, `generated/constants`) direkt, und der Client samt Prüfern
kommt per dynamischem Import beim Engine-Start.

### 10.5 Weiteres

- Chrome prüft die Installierbarkeit nur in einem echten Profil, nicht im
  Inkognito-Kontext eines Tests (`in-incognito`); der E2E-Test nutzt dafür ein
  temporäres Profil.
- Startzeiten schwanken auf odin stark mit der Last anderer Sitzungen
  (Lastmittel 6–11 während dieses Laufs); Vergleiche nur unter gleicher Last.

## 11. Entscheidungen und Abweichungen

- **shadcn/ui als Grundlage des Design-Systems** statt einer ganz eigenen
  Komponentensammlung: Vorgabe des Projektbesitzers für alle Web-Oberflächen.
  Die OpenMana-Identität entsteht über Tokens, Schriften, Stil und Regeln
  (`DESIGN_SYSTEM.md`); Arena dient nur als UX-Vorbild.
- **Nur dunkles Farbschema**, kein helles Theme.
- **Deutsche Oberfläche**, englische Codes/Routen (`/decks`, `/play` …), wie
  der Grundsatz „für den Nutzer alles deutsch, für das System alles englisch“.
- **Tab-Leiste mit vier Zielen** am Handy; Einstellungen hinter dem Zahnrad,
  Credits hinter den Einstellungen (Material-Richtwert: höchstens fünf Ziele,
  seltene Dinge aus dem wiederholten Weg).
- **Kein Service Worker** vor Prompt 25 (§6).
- **Engine nur auf Knopfdruck**, kein Vorwärmen (Prompt 11).
- **Engine im Build aus dem lokalen `engine/build/dist`**; die Auslieferung auf
  Vercel über ein gepinntes Release-Artefakt ist Prompt 31 (Research §7).
- **Credits bewusst knapp und ehrlich:** Scryfall erscheint, sobald Kartendaten
  genutzt werden (Prompt 08); vollständige Lizenztexte und
  THIRD-PARTY-NOTICES sind Prompt 27; die GraalVM-Lizenzfrage bleibt als offen
  benannt. ManaBrew steht als Vorbild **und** als Quelle der Patches 0001–0003.
- **Schriften gebündelt** statt vom Google-Font-CDN (COEP, Datenschutz).

## 12. Bekannte Lücken (mit Ziel-Prompt)

- Offline, Engine-Cache, Updates, Speicher-Persistenz → 25.
- KI-Profil, Kartensprache, `prefers-reduced-motion` app-weit, weitere
  Diagnose → 12.
- Speicher (IndexedDB) → 07, Kartendaten → 08, Deck-Import → 09/10,
  Partie → 11 ff.
- Echte Auslieferung auf Vercel samt Engine, Test von Rewrite-/Dateivorrang,
  Kompression und Edge-Cache → 31 (Research-Frage 6).
- Messung auf dem Fold7 (Research-Frage 5): Mit einer ausgelieferten Version
  reicht dafür „Spielen → Engine laden“ auf dem Gerät.
- `LICENSE`, THIRD-PARTY-NOTICES, Prüfung des Icons für die Veröffentlichung → 27.
- Android-Hülle (TWA) mit demselben Icon → 28.

## 13. Reproduzieren

```bash
npm ci                                   # App-Abhängigkeiten (Wurzel)
bash engine/scripts/build.sh             # einmal die Engine bauen (~6 min), falls engine/build/dist fehlt
npm run dev                              # Entwicklung: http://localhost:5173 (mit COOP/COEP)
npm run check                            # tsc -b, oxlint, Vitest, End-to-End-Test (baut selbst)
npm run build && npm run preview         # Produktions-Build ansehen
OPENMANA_ENGINE=omit npm run build       # Build ohne Engine (nur UI)
npm run icons                            # Icons neu aus dem Original erzeugen (Pillow)
```

Nach einem neuen Engine-Build den Dev-Server neu starten (er prüft die Engine
beim Start).

## 14. Was als Nächstes kommt

Prompt **07 — IndexedDB local data layer** (PENDING, nicht begonnen:
`naechster-schritt.md` führt genau einen Prompt je Lauf aus).
