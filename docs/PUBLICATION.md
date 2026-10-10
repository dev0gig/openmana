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

## Entscheidung des Projektbesitzers (2026-10-10): offene Toolchain

Nach der Lizenzprüfung (Prompt 33) und dem Machbarkeitsversuch (Prompt 34,
`docs/research/OPEN_WEB_IMAGE_BUILD_2026-10-09.md`) hat der Projektbesitzer am
2026-10-10 entschieden:

- Die Engine wird nur noch mit **GraalVM Community Edition aus offenem
  Quelltext** gebaut (`oracle/graal` auf labsjdk-ce, `engine/toolchain.lock.json`).
  Keine Oracle-GraalVM-Teile, keine GFTC/NFTC-Bedingungen, kein geschlossener
  Enterprise-Code im Bau oder im Modul.
- Ein kleiner Rest wird **bewusst in Kauf genommen und offen benannt**: 13
  Typen der Compiler-Schnittstelle JVMCI (`jdk.vm.ci.*`) aus dem OpenJDK stehen
  unter „GPLv2 only“ ohne Classpath Exception. Die GraalVM-Laufzeit bringt sie
  in jedes Native-Image-Modul ein (beim früheren Oracle-Build genauso). Ob das
  mit Forges GPLv3 kollidiert, ist nicht juristisch geklärt.
- OpenMana wird damit wieder öffentlich ausgeliefert wie vor der Pause.

Wer Rechte an den betroffenen Teilen hat und Einwände sieht, erreicht den
Projektbesitzer über die Issues des Repositorys; OpenMana wird dann angepasst
oder zurückgezogen. Diese Entscheidung ist keine Rechtsauskunft und behauptet
keine Klärung.

### Frühere Fassung (2026-10-08 bis 2026-10-09): Oracle GraalVM

Bis Prompt 34 übersetzte OpenMana Forge mit Oracle GraalVM Web Image (GFTC);
Teile dieser Laufzeit und der Oracle-JDK-Bibliothek (NFTC) lagen im
ausgelieferten Modul, die Verträglichkeit mit der GPL war offen
(`docs/research/LICENSES.md` §3.4, `docs/research/GRAALVM_LICENSE_RESOLUTION_2026-10-08.md`).
Am 2026-10-09 wurde die Auslieferung pausiert und das Engine-Release
`engine-p8-2b0da7a21935` auf Entwurf gestellt; es bleibt unverändert als
Entwurf erhalten.

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

Die Toolchain wird nicht als Binärpaket mitgeliefert, sondern aus offenen
Quellen gebaut: labsjdk-ce (Archiv mit SHA-256), `oracle/graal` und `mx` an
gepinnten Commits, alles in `engine/toolchain.lock.json`;
`engine/scripts/setup-toolchain.sh` lädt, prüft und baut sie. Ein Neubau mit einer
geänderten JGraphT-Bibliothek ist über `engine/UPDATING.md` möglich, wurde aber
nicht eigens mit einer geänderten JGraphT-Version vorgeführt.

## Technische Umsetzung des Gates

`OPENMANA_PUBLIC_RELEASE=1` (gesetzt im Produktionsbuild, `vercel.json`) baut
nur, wenn `notices/policy.json` auf diese Datei verweist, sie diese
Entscheidung enthält, `SOURCE.md` den öffentlichen Quelltext anbietet und der
genaue Commit bekannt ist (`vite/notices.ts`, Tests in `vite/notices.test.ts`).
Ein bloß umgestellter Wahrheitswert reicht nicht.
