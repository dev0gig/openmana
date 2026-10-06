/* German block guidance from Forge's structured state, never its prose. */
import type { BlockView } from "./block-model"
import { cardName } from "./table-labels"

export function blockText(view: BlockView): string {
  return view.current === null ? "Wähle einen Angreifer und dann deine Blocker." : `Wähle deine Blocker für „${cardName(view.current)}“.`
}

export function blockConfirmLabel(assigned: number): string {
  return assigned === 0 ? "Nicht blocken" : "Blocks bestätigen"
}

export const BLOCK_TAP_NOTE = "Erst den Angreifer, dann deine Kreaturen antippen. Blocker erneut antippen nimmt diese Zuordnung zurück. Lange drücken oder Rechtsklick zeigt die Karte."
export const BLOCK_CONFIRM_NOTE = "Bestätigen legt die Blocks fest. Forge prüft auch Blockpflichten und Beschränkungen."
