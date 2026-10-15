/*
 * The legend of OpenMana's own mana symbols (2026-10-15): which drawn sign
 * stands for which symbol on the cards. Shown in the table's help sheet and on
 * the credits page; shadcn `Item`s only. It explains the notation, never what
 * a card may do (Forge decides).
 */
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { ManaSymbol } from "@/components/ui/mana-symbol"

/** One row: the symbols it shows (notation without braces), the sign's name and its meaning in Magic. */
export const MANA_LEGEND: readonly { readonly symbols: readonly string[]; readonly sign: string; readonly meaning: string }[] = [
  { symbols: ["W"], sign: "Sonne", meaning: "Weißes Mana" },
  { symbols: ["U"], sign: "Wellen", meaning: "Blaues Mana" },
  { symbols: ["B"], sign: "Mondsichel", meaning: "Schwarzes Mana" },
  { symbols: ["R"], sign: "Flamme", meaning: "Rotes Mana" },
  { symbols: ["G"], sign: "Blatt", meaning: "Grünes Mana" },
  { symbols: ["C"], sign: "Sechseck", meaning: "Farbloses Mana – nur farbloses Mana bezahlt es" },
  { symbols: ["2"], sign: "Zahl", meaning: "Beliebiges Mana in dieser Menge" },
  { symbols: ["X"], sign: "Buchstabe", meaning: "X, Y oder Z – eine Menge, die beim Wirken festgelegt wird" },
  { symbols: ["W/U", "2/G"], sign: "Schräg geteilt", meaning: "Hybrides Mana – eine der beiden Hälften bezahlt es" },
  { symbols: ["G/P"], sign: "Herz", meaning: "Phyrexanisches Mana – ein Mana dieser Farbe oder 2 Lebenspunkte" },
  { symbols: ["T"], sign: "Gekippte Karte", meaning: "Tappen – die Karte quer drehen" },
  { symbols: ["Q"], sign: "Gespiegelte gekippte Karte", meaning: "Enttappen – die Karte wieder gerade drehen" },
  { symbols: ["S"], sign: "Schneeflocke", meaning: "Schnee-Mana – von einer Schnee-Quelle erzeugt" },
  { symbols: ["E"], sign: "Blitz", meaning: "Energie" },
]

export const MANA_LEGEND_INTRO =
  "OpenMana zeichnet eigene Manasymbole, nicht die von Wizards of the Coast. So entsprechen sie den Symbolen auf den Karten:"

/** The legend as a list of rows - each sign beside its name and meaning. */
export function ManaLegend() {
  return (
    <ItemGroup role="list" aria-label="Manasymbole" className="gap-2">
      {MANA_LEGEND.map((row) => (
        <Item key={row.sign} role="listitem" variant="outline" size="xs" data-slot="mana-legend-row">
          <ItemMedia className="text-2xl">
            {row.symbols.map((symbol) => <ManaSymbol key={symbol} symbol={symbol} decorative />)}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{row.sign}</ItemTitle>
            <ItemDescription className="line-clamp-none">{row.meaning}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
