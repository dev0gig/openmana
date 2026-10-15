# Herkunft und KI-Transparenz

Was in OpenMana steckt, wer es gemacht hat und wie. Ohne Rechtsbewertung –
nur, was tatsächlich passiert ist. Die Lizenzen stehen in `LICENSE`,
`THIRD-PARTY-NOTICES.md`, `notices/licenses/` und `SOURCE.md`.

## Idee und Leitung

Idee, Richtung, Prioritäten und jede Freigabe stammen vom Projektbesitzer
(GitHub: **dev0gig**). Er hat jede Aufgabe gestellt, Ergebnisse geprüft und
entschieden, was veröffentlicht wird.

## Mit generativer KI entwickelt

OpenMana wurde mit **umfassender Unterstützung durch generative künstliche
Intelligenz** entwickelt und ausgearbeitet. Praktisch der gesamte eigene
Programmcode, die Tests, Build- und Prüfskripte, Recherche, Dokumentation und
die deutschen Oberflächentexte wurden von KI-Agenten geschrieben, nach den
Aufgaben und Vorgaben des Projektbesitzers:

- **OpenAI** – ChatGPT und Codex (GPT-Modelle): Programmcode, Recherche,
  Dokumentation; außerdem das App-Icon (siehe unten).
- **Anthropic** – Claude (Claude Code): Programmcode, Recherche,
  Dokumentation.

Die Aufträge liegen als nummerierte Aufgaben (Prompts 00–32) vor; was je
Aufgabe gebaut und geprüft wurde, steht in `docs/implementation/`. Commits
dieser Agenten tragen teils einen `Co-Authored-By`-Vermerk des jeweiligen
Modells.

## Nicht von KI

- **Magic-Regeln, Kartenverhalten und Gegner-KI:** Forge (Card-Forge-Community,
  https://github.com/Card-Forge/forge, GPL-3.0-or-later), unverändert bis auf
  die Patch-Reihe in `engine/patches/` (Herkunft je Patch dort). Die
  „KI“-Gegner in Partien sind Forges eigene, regelbasierte Spieler – keine
  generative KI.
- **Kartentexte, Kartenbilder, Set-Angaben:** Scryfall (https://scryfall.com),
  Rechte bei Wizards of the Coast. Kartenbilder werden nie verändert oder erzeugt.
  Hinweis nach der Fan Content Policy, deutsch übersetzt: „OpenMana ist
  inoffizieller Fan-Inhalt, gestattet im Rahmen der Fan Content Policy. Nicht
  von Wizards genehmigt/befürwortet. Teile der verwendeten Materialien sind
  Eigentum von Wizards of the Coast. ©Wizards of the Coast LLC.“
  Im Wortlaut: “OpenMana is unofficial Fan Content permitted under the Fan
  Content Policy. Not approved/endorsed by Wizards. Portions of the materials
  used are property of Wizards of the Coast. ©Wizards of the Coast LLC.”
- **Manasymbole und Kartenrückseite:** eigene Zeichnungen von OpenMana
  (`src/components/ui/mana-symbol.tsx`, `src/game/table/table-art.tsx`), nicht
  die von Wizards of the Coast: Deren Fan Content Policy nimmt Logos und Marken,
  darunter die Manasymbole, ausdrücklich aus.
- **Bibliotheken und Schriften:** siehe `THIRD-PARTY-NOTICES.md`.
- **WebAssembly-Übersetzung:** GraalVM Community Edition mit Web Image, aus
  offenem Quelltext gebaut (Werkzeug, seit Prompt 35; vorher Oracle GraalVM);
  Teile seiner Laufzeit und des OpenJDK stecken im Engine-Modul (siehe `SOURCE.md`).
- **Technische Vorlage:** ManaBrew (https://github.com/witchesofthehill/manabrew)
  zeigte, dass Forge als WebAssembly im Browser läuft. Drei Forge-Patches
  stammen aus ManaBrews Forge-Fork (GPL); Code aus ManaBrews AGPL-Hauptrepository
  wurde nicht übernommen.
- **ORYX-SDK** (`src/cloud/oryx-sdk.js`): unveränderte Kopie aus dem ORYX-Projekt
  desselben Projektbesitzers.

## App-Icon

Vom Projektbesitzer selbst mit **ChatGPT (OpenAI)** erzeugt, zuerst als Icon
von Anvil (OpenManas Vorgänger) verwendet, bytegleich übernommen. Es wird mit
OpenMana unter GPL-3.0-or-later weitergegeben. Einzelheiten:
`assets/app-icon/PROVENANCE.md`.

## Daten und Netz

OpenMana läuft im Browser. Decks, Einstellungen und Partien bleiben lokal
(IndexedDB). Es gibt keine Analyse, kein Tracking und keine versteckte
Fehlerübertragung; ein Diagnosebericht wird nur angezeigt und auf Wunsch
kopiert. Netzanfragen gehen an die eigene Seite, an Scryfall (Kartenbilder,
einzelne Drucke) und – nur wenn du dich mit ORYX verbindest – an die ORYX-Cloud
(Deck-Sammlung, Anmeldung über Google bei ORYX).
