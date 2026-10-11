# Herkunft der Spieltisch-Hintergründe

Zwei Bilder, die der Spieler in den Einstellungen statt des gezeichneten
Holztischs als Spieltisch-Hintergrund wählen kann (2026-10-12, Wunsch des
Projektbesitzers): **Farbenrad** (die fünf Manasymbole im Kreis) und
**Planeswalker** (das Planeswalker-Zeichen in Gold), beide im Stil eines
Chip-Floorplans („Die“).

## Quelle

Die Bilder sind Wallpaper des Projektbesitzers. Sie wurden mit Claude als
HTML-Seiten gebaut, die das Bild in eine Canvas zeichnen. Sie liegen in
seiner Seafile-Bibliothek unter `Pictures/Wallpaper/quellen/` (HTML) und
`Pictures/Wallpaper/bilder/` (fertige PNGs mit Beschriftung).

| Datei hier | Quelle | SHA-256 |
|---|---|---|
| `farbrad-die.html` | `quellen/mtg-farbrad-die.html`, unverändert | `f6a0de16ce24d43696f05e2d272703fb16216b62850d2bcb4d877450b96acbd3` |
| `planeswalker-die.html` | `quellen/mtg-planeswalker-die.html`, unverändert | `ba5ee9122a184bb7bbae2d20a625668855a1a01562c4133d42860de01defeadb` |

Die Symbole sind die Vektor-Glyphen der Schrift **Mana** von Andrew Gioia
(https://github.com/andrewgioia/mana, Schrift unter SIL OFL 1.1). Sie sind
als data-URI in den HTML-Seiten eingebettet. Die Manasymbole und das
Planeswalker-Zeichen selbst sind Marken bzw. geschützte Zeichen von Wizards of
the Coast LLC. OpenMana nutzt sie als inoffizieller Fan-Inhalt nach der
Fan Content Policy, wie die Kartenbilder (siehe `TRANSPARENCY.md`).

## Abgeleitete Dateien

Gerendert am 2026-10-12 in Chromium (Playwright) mit zwei Änderungen
gegenüber den Wallpapern:

1. **Ohne Text, Raster durchgehend.** Alle Beschriftungen der Seiten
   (Elemente `.lb`, z. B. „MAGIC – THE GATHERING“, Konstruktionsangaben) und
   die kleinen Rahmenecken um sie (`.tick`, `.mark`) sind ausgeblendet
   (`.lb, .tick, .mark { display: none }`). Die Seiten dunkeln das Raster
   unter den Beschriftungen ab (`if(inZ)a*=0.12;`); diese Zeile ist entfernt,
   damit dort keine leeren Felder bleiben (Wunsch des Projektbesitzers,
   2026-10-12). Leiterbahnen und Symbol bleiben, wie die Seite sie zeichnet.
2. **Auch hochkant.** Die Seiten nehmen `?w=` und `?h=`. Für das
   Hochformat (Handy) ist der Maßstab der Seite von `S = H / 1440` auf
   `S = Math.min(H / 1440, W / 1300)` begrenzt, damit das Symbol in die Breite
   passt. Im Querformat ergibt das denselben Wert wie vorher.

Danach verlustfrei als WebP gespeichert (Pillow, `lossless=True, method=6`).

| Datei | Größe | Verwendung |
|---|---|---|
| `src/game/table/backgrounds/farbrad-quer.webp` | 2560 × 1440 | Farbenrad, Fenster breiter als hoch |
| `src/game/table/backgrounds/farbrad-hoch.webp` | 1440 × 2560 | Farbenrad, Fenster höher als breit |
| `src/game/table/backgrounds/planeswalker-quer.webp` | 2560 × 1440 | Planeswalker, breiter als hoch |
| `src/game/table/backgrounds/planeswalker-hoch.webp` | 1440 × 2560 | Planeswalker, höher als breit |

Neu rendern: in der HTML-Seite die Zeile `const S=H/1440,` wie oben ändern
und `if(inZ)a*=0.12;` entfernen, sie mit `?w=2560&h=1440` bzw.
`?w=1440&h=2560` in Chromium öffnen, das Stylesheet
`.lb,.tick,.mark{display:none !important}` einfügen, ein
Bildschirmfoto der Seite machen und verlustfrei als WebP speichern.
