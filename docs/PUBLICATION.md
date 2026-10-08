# Veröffentlichung von OpenMana

## Entscheidung des Projektbesitzers (2026-10-08)

Der Projektbesitzer (GitHub: dev0gig) hat am 2026-10-08 entschieden, OpenMana
öffentlich zu veröffentlichen:

- **Öffentlich spielbar** unter https://openmana.oryx.quest/ (Rückfalladresse
  https://openmana.vercel.app/), ohne Konto. Eine Anmeldung gibt es nur in
  ORYX selbst (Google), wenn jemand seine Deck-Sammlung über die ORYX-Cloud
  abgleichen will.
- **Repository öffentlich:** https://github.com/dev0gig/openmana, mit allen
  Lizenztexten, Hinweisen und Herkunftsangaben (`LICENSE`,
  `THIRD-PARTY-NOTICES.md`, `notices/`, `SOURCE.md`, `TRANSPARENCY.md`).
- **Alles transparent:** woher jeder Bestandteil kommt und dass OpenMana mit
  umfassender generativer KI entwickelt wurde (`TRANSPARENCY.md`, Credits in
  der App).
- **App-Icon:** vom Projektbesitzer selbst mit ChatGPT erzeugt und zur
  Weitergabe mit OpenMana freigegeben (`assets/app-icon/PROVENANCE.md`).
- **Versionsgeschichte umgeschrieben**, damit der bürgerliche Name des
  Projektbesitzers nicht in Commit-Nachrichten und alten Dateiständen steht.

## Bewusst offen gelassen: die GraalVM-Frage

OpenMana übersetzt Forge mit **Oracle GraalVM Web Image** nach WebAssembly.
Teile der GraalVM-Laufzeit landen dabei im ausgelieferten Engine-Modul. Oracle
liefert GraalVM unter den **GraalVM Free Terms and Conditions (GFTC)**; diese
erstrecken sich auf Oracle-Anteile im erzeugten Output. Forge steht unter der
GPL-3.0-or-later, die keine zusätzlichen Einschränkungen erlaubt. Ob die
betroffenen Laufzeitteile als „System Libraries“ des Compilers gelten oder ob
die GFTC hier mit der GPL kollidiert, ist **nicht juristisch geklärt**. Der
Quelltext der Web-Image-Laufzeit selbst ist bei Oracle unter GPLv2 mit
Classpath Exception veröffentlicht (`oracle/graal`, Ordner `web-image`).

Der Projektbesitzer veröffentlicht trotzdem, **offen und mit diesem Hinweis**,
statt die Frage zu verschweigen. Die vollständige Herleitung mit Quellen steht
in `docs/research/LICENSES.md` §3.4. Wer Rechte an den betroffenen Teilen hat
und Einwände sieht, erreicht den Projektbesitzer über die Issues des
Repositorys; OpenMana wird dann angepasst oder zurückgezogen.

Diese Entscheidung ist keine Rechtsauskunft und behauptet keine Klärung.

## Was mit jeder öffentlichen Version bereitsteht

- Der Quelltext genau des ausgelieferten Commits (die Credits-Seite und
  `/legal/THIRD-PARTY-NOTICES.txt` nennen ihn).
- Zu jeder Engine-Version ein GitHub-Release (`engine-p<Protokoll>-<Manifest>`)
  mit dem geprüften Engine-Modul, dem Kartenkatalog, dem Engine-Lock, einem
  **vollständigen Quellarchiv** (OpenMana samt Forge-Quellstand am gitlink,
  Patches, Bridge, Protokoll, Build-Skripten) und den **JGraphT-Quellen**
  (LGPL-2.1-Option).
- Bauanleitung: `engine/UPDATING.md`, `engine/README.md`, `cards/README.md`,
  Auslieferung und Rückrollen: `docs/DEPLOYMENT.md`.

Nicht mitgeliefert wird das Oracle-GraalVM-Archiv selbst (Oracle verteilt es
unter der GFTC über https://www.oracle.com/java/technologies/downloads/; Version
und SHA-256 stehen in `engine/engine.lock.json`). Ein Neubau mit einer
geänderten JGraphT-Bibliothek ist über `engine/UPDATING.md` möglich, wurde aber
nicht eigens mit einer geänderten JGraphT-Version vorgeführt.

## Technische Umsetzung des Gates

`OPENMANA_PUBLIC_RELEASE=1` (gesetzt im Produktionsbuild, `vercel.json`) baut
nur, wenn `notices/policy.json` auf diese Datei verweist, sie diese
Entscheidung enthält, `SOURCE.md` den öffentlichen Quelltext anbietet und der
genaue Commit bekannt ist (`vite/notices.ts`, Tests in `vite/notices.test.ts`).
Ein bloß umgestellter Wahrheitswert reicht nicht.
