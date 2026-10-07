# Herkunft des vorläufigen App-Icons

`anvil-icon.png` ist das offizielle App-Icon von **Anvil**, dem Vorgänger von
OpenMana. Prompt 06 übernimmt es **unverändert** als vorläufiges Icon und
Favicon von OpenMana; ein eigenes OpenMana-Icon ist ausdrücklich noch nicht
Teil der Aufgabe.

| | |
|---|---|
| Quelle | Repository `dev0gig/anvil`, Datei `assets/icon.png` |
| Stand der Quelle | Commit `7c97fbb0161ad26ddfbb31bf4e723925fc917d24` („Neues Kartenmotiv als offizielles App-Icon (0.18.2)“, 2026-09-22) – der Commit, mit dem die Datei in Anvil entstand, zugleich Anvils `main` beim Kopieren |
| Übernommen | 2026-09-24, Byte für Byte kopiert |
| SHA-256 | `6415e9ea97ee21fe8d53590c670d91b41dfe9efe9ad9fa16557c32421c4246e8` (identisch mit der Quelle) |
| Format | PNG, 1254 × 1254 Pixel, RGB, deckend |
| Frühere Herkunft | laut Anvils `ICON.md` das unveränderte, vom Projektbesitzer hochgeladene Bild `file_00000000d0a882439efb0abe11f0f596.png`, dort nur umbenannt und verschoben |

## Abgeleitete Dateien

`scripts/gen-app-icons.py` (`npm run icons`) skaliert das ganze Bild mit
Lanczos, wie Anvils eigener Generator: kein Zuschnitt, kein Rahmen, keine
Rundung, keine Maske, kein Schatten, kein Rand. Das Skript bricht ab, wenn die
Prüfsumme der Quelle nicht stimmt.

| Datei | Größe | Verwendung |
|---|---|---|
| `public/icons/icon-192.png` | 192 × 192 | Manifest (`any` und `maskable`), Logo in App-Kopf, Seitenleiste und Startseite |
| `public/icons/icon-512.png` | 512 × 512 | Manifest (`any` und `maskable`), Installation |
| `public/apple-touch-icon.png` | 180 × 180 | Startbildschirm unter iOS/iPadOS |
| `public/favicon.ico` | 16, 32, 48 | Browser-Tab |

Das Bild ist vollflächig gemalt. Als `maskable` beschneidet die Maske des
Launchers deshalb nur den gemalten Rand – wie bei Anvil, dessen adaptives
Android-Icon dasselbe Bild vollflächig als Vordergrundebene nutzt.

## Rechte

Das Bild stammt aus dem Upload des Projektbesitzers für Anvil und wird hier
auf dessen Anweisung weiterverwendet. Anvil hat keine eigene Lizenzdatei.
Prompt 27 hat den Bytehash und Anvils `ICON.md` abgeglichen: Die Herkunft ist
bis zu diesem Upload nachvollziehbar. Ein ursprünglicher Urheber oder eine
separate Bildlizenz ist dort nicht dokumentiert; es wird keine erfundene
Bildlizenz oder Übernahme unter die Software-GPL behauptet. Vor einer
öffentlichen Veröffentlichung ist die Berechtigung zur Bildweitergabe Teil
der Freigabe gemäß `SOURCE.md`. Auf Android nutzt die gemeinsame ORYX-TWA
dieselbe Web-App; es gibt kein eigenes OpenMana-Android-Paket.
