/*
 * The Zauberchronik (prompt 41, docs/design/SPIELTISCH.md §4.11; the mockup's
 * `.chronik`): Forge's stack and the combat on a panel of the table, in the
 * region "Stapel und Kampf".
 *
 * - Title "Zauberchronik" with the number of entries.
 * - The stack in Forge's order, top first and highlighted: each entry with its
 *   card as a small card (the whole picture; a hidden one is OpenMana's back),
 *   its name (or what it is), a line with a dot for whose it is (yours mana
 *   blue, the Forge-KI's red - and the words "von dir" / "von der Forge-KI",
 *   never the colour alone), its targets and what it is, Forge's own
 *   description, and its number (the oldest 1, the top the highest). The card
 *   opens the card view - by a tap, a long press or a right click -, never
 *   sends anything: a card on the stack is only looked at (prompt 16).
 * - While there is combat, below the entries one short line per attacker:
 *   "Angreifer → Ziel · geblockt von …" from Forge's combat (the arrows across
 *   the table, prompt 43, show the same: table-arrows.tsx); alike unblocked
 *   attackers share a line.
 * - Empty stays honest: "Der Stapel ist leer, niemand kämpft."
 *
 * In hoch the panel is a bar between the battlefields: the title stacked on
 * the left, the entries side by side, scrolling sideways (table.css). Anchors:
 * `data-stack-item`, `data-stack-card`, `data-stack-target`,
 * `data-combat-attacker`.
 */
import { ManaText } from "@/components/ui/mana-symbol"
import type { VisibleCard } from "@openmana/engine-protocol"
import { GameCardButton } from "@/components/ui/game-card"
import { useCardPress } from "@/hooks/use-card-press"
import { STACK_TARGET_LABEL } from "../beginner-help"
import { STACK_KIND_LABELS } from "../priority-labels"
import type { TableCardLookup } from "../table-cards"
import { attackLine, blockLine, cardName, defenderName, stackEntryName, stackOwner, stackTargets } from "../table-labels"
import type { CombatView, StackEntryView, TableView } from "../table-model"
import { TablePicture } from "../table-picture"
import { StripChip } from "./strip-parts"
import { TableCardBack } from "./table-art"
import { TablePanel, TablePanelCount, TablePanelHead, TablePanelTitle } from "./table-panel"

export interface ChronicleProps {
  readonly view: TableView
  readonly pictures: TableCardLookup
  /** Opens the card view of a card on the stack (looking only). */
  readonly onLook: (id: number) => void
  /** The cards a spell or ability on the stack targets (their own card may lie on the stack too). */
  readonly targets: ReadonlySet<number>
  /** The player declares blockers: the combat lines are a draft ("Blocks · noch nicht bestätigt") and show the block target. */
  readonly blocking: boolean
}

export function Chronicle({ view, pictures, onLook, targets, blocking }: ChronicleProps) {
  const { stack, combat } = view
  const entries = stack.length === 1 ? "1 Eintrag" : `${stack.length} Einträge`
  if (stack.length === 0 && combat.length === 0) {
    return (
      <TablePanel data-chronicle="empty" className="table-chronicle">
        <TablePanelHead>
          <TablePanelTitle>
            Zauber&shy;chronik
          </TablePanelTitle>
          <TablePanelCount aria-hidden>0</TablePanelCount>
        </TablePanelHead>
        <p className="table-chronicle-empty">Der Stapel ist leer, niemand kämpft.</p>
      </TablePanel>
    )
  }
  return (
    <TablePanel className="table-chronicle">
      <TablePanelHead>
        <TablePanelTitle>
          Zauber&shy;chronik <span className="sr-only">· {entries}</span>
        </TablePanelTitle>
        <TablePanelCount aria-hidden title={entries}>
          {stack.length}
        </TablePanelCount>
      </TablePanelHead>
      <div className="table-chronicle-body">
        {stack.length > 0 ? (
          <ol aria-label={`Stapel, oben zuerst: ${entries}`} className="table-chronicle-list">
            {stack.map((entry, index) => (
              <ChronicleEntry key={entry.id} entry={entry} top={index === 0} number={stack.length - index} pictures={pictures} onLook={onLook} targets={targets} />
            ))}
          </ol>
        ) : null}
        {combat.length > 0 ? (
          <div className="table-chronicle-combat">
            <h3 className="table-chronicle-combat-title">{blocking ? "Blocks · noch nicht bestätigt" : "Kampf"}</h3>
            <ul className="table-chronicle-fights">
              {combatLines(combat, blocking).map((line) => (
                <CombatLine key={line.key} line={line} blocking={blocking} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </TablePanel>
  )
}

/**
 * One entry of the stack (prompt 16's facts, the chronicle's look): its card
 * (opens the card view), its name, a line with whose it is (dot and words), its
 * targets and what it is, Forge's description, its number.
 */
function ChronicleEntry({ entry, top, number, pictures, onLook, targets }: { entry: StackEntryView; top: boolean; number: number; pictures: TableCardLookup; onLook: (id: number) => void; targets: ReadonlySet<number> }) {
  const name = stackEntryName(entry) ?? STACK_KIND_LABELS[entry.kind]
  const owner = stackOwner(entry.controller)
  const aimed = stackTargets(entry)
  const facts = [...(aimed !== null ? [aimed] : []), STACK_KIND_LABELS[entry.kind], ...(owner !== null ? [owner] : [])].join(" · ")
  const text = entry.text !== null && entry.text.trim() !== "" ? entry.text : null
  return (
    <li data-stack-item={entry.id} data-top={top || undefined} data-controller={entry.controller ?? undefined} className="table-chronicle-entry" title={[name, facts, text].filter(Boolean).join(" · ")}>
      <span className="table-chronicle-card">
        {entry.card !== null ? (
          <StackCard card={entry.card} pictures={pictures} onLook={onLook} target={targets.has(entry.card.id)} />
        ) : entry.hidden ? (
          <TableCardBack>
            <span className="sr-only">verdeckte Karte</span>
          </TableCardBack>
        ) : null}
      </span>
      <span className="table-chronicle-words">
        <span data-slot="chronicle-name" className="table-chronicle-name">
          {name}
          {top ? <span className="sr-only"> · oben, wird als Nächstes verrechnet</span> : null}
        </span>
        <span data-slot="chronicle-facts" className="table-chronicle-facts">{facts}</span>
        {text !== null ? <span data-slot="chronicle-text" className="table-chronicle-text"><ManaText text={text} /></span> : null}
      </span>
      <span aria-hidden className="table-chronicle-number">
        {number}
      </span>
    </li>
  )
}

/** A card on the stack: the whole picture, a control that only looks (tap, long press, right click). */
function StackCard({ card, pictures, onLook, target }: { card: VisibleCard; pictures: TableCardLookup; onLook: (id: number) => void; target: boolean }) {
  const press = useCardPress({ onPrimary: () => onLook(card.id), onLook: () => onLook(card.id) })
  const name = cardName(card)
  return (
    <GameCardButton
      data-stack-card={card.id}
      data-stack-target={target || undefined}
      mark={target ? "target" : null}
      aria-label={`${name} ansehen${target ? ` · ${STACK_TARGET_LABEL}` : ""}`}
      aria-haspopup="dialog"
      title={`${name}${target ? ` · ${STACK_TARGET_LABEL}` : ""}`}
      {...press}
    >
      <TablePicture card={card} pictures={pictures} />
    </GameCardButton>
  )
}

/** One short line of combat: "Angreifer → Ziel · Blocker" - the arrow a picture of the words "greift … an", which screen readers get. */
function CombatLine({ line, blocking }: { line: CombatLineView; blocking: boolean }) {
  const { view, count } = line
  const defender = defenderName(view)
  return (
    <li data-combat-attacker={view.attacker.id} className="table-chronicle-fight" title={`${count > 1 ? `${count} × ` : ""}${cardName(view.attacker.card)} ${attackLine(view)} · ${blockLine(view)}`}>
      {blocking && view.attacker.card?.highlighted === true ? <StripChip>Blockziel</StripChip> : null}
      <span className="table-chronicle-attacker">
        {count > 1 ? `${count} × ` : null}
        {cardName(view.attacker.card)}
      </span>
      {defender !== null ? (
        <>
          <span aria-hidden> → {defender}</span>
          <span className="sr-only"> {attackLine(view)}</span>
        </>
      ) : (
        <span> {attackLine(view)}</span>
      )}
      <span className="table-chronicle-blockers"> · {blockLine(view)}</span>
    </li>
  )
}

export interface CombatLineView {
  readonly key: string
  readonly view: CombatView
  readonly count: number
}

/**
 * Combat in lines. Unblocked attackers that are the same card in the same
 * state (Forge's values, like a pile on the battlefield) attacking the same
 * target share a line ("13 × Goblin → Forge-KI · ungeblockt"); while blockers
 * are declared every attacker keeps its own line (each is a block target).
 */
export function combatLines(combat: readonly CombatView[], blocking = false): CombatLineView[] {
  const lines: { key: string; view: CombatView; count: number; signature: string | null }[] = []
  for (const view of combat) {
    const card = view.attacker.card
    const signature =
      !blocking && card !== null && view.blockers.length === 0 ? JSON.stringify([card.key, card.name, card.power, card.toughness, card.damage, card.counters ?? null, view.defender]) : null
    const same = signature === null ? undefined : lines.find((line) => line.signature === signature)
    if (same) same.count++
    else lines.push({ key: String(view.attacker.id), view, count: 1, signature })
  }
  return lines.map(({ key, view, count }) => ({ key, view, count }))
}
