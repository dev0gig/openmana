/*
 * Forge's card database as the card catalog needs it: the name of every card
 * script (the name Forge's deck lists and the engine protocol use) and the
 * printings Forge's edition files list for it. Read from the same Forge
 * checkout the engine is built from (engine/forge, pinned), so the catalog
 * and the engine agree on which cards exist.
 *
 * Card scripts (res/cardsfolder/<letter>/*.txt): "Name:" per state, states
 * separated by "ALTERNATE", "AlternateMode:" names how they belong together.
 * A state may instead take another card's face whole ("CopyFaceFrom:Bind",
 * CardRules' placeholder faces) and then has that card's name. Forge names a
 * card after its first state, a split card after both ("Fire // Ice",
 * CardRules.getName()).
 *
 * Edition files (res/editions/*.txt): [metadata] with Code and ScryfallCode,
 * then sections of "<collector number> <rarity> <name> @<artist>" lines
 * (CardEdition.Reader.CARD_PATTERN; the sections of
 * EditionSectionWithCollectorNumbers).
 */
import fs from "node:fs"
import path from "node:path"

export interface ForgeCard {
  /** Path below cardsfolder, for reports. */
  readonly file: string
  /** The Forge card name. */
  readonly name: string
  /** The name of every state, in file order (the first is the main one). */
  readonly states: readonly string[]
  /** Forge's AlternateMode (DoubleFaced, Split, Adventure, Modal, Flip, Meld …), null for one state. */
  readonly mode: string | null
}

export interface ForgeEditionEntry {
  readonly collectorNumber: string
  readonly name: string
}

export interface ForgeEdition {
  readonly file: string
  readonly code: string
  readonly code2: string
  /** Lower case, as Scryfall writes set codes (CardEdition.getScryfallCode()). */
  readonly scryfallCode: string
  readonly name: string
  readonly entries: readonly ForgeEditionEntry[]
}

export interface ForgeCardDatabase {
  readonly cards: readonly ForgeCard[]
  readonly editions: readonly ForgeEdition[]
}

/** The sections of an edition file that list cards with collector numbers (Forge's EditionSectionWithCollectorNumbers). */
const CARD_SECTIONS: ReadonlySet<string> = new Set([
  "cards",
  "special slot",
  "precon product",
  "borderless",
  "etched",
  "showcase",
  "full art",
  "extended art",
  "alternate art",
  "retro frame",
  "buy a box",
  "promo",
  "prerelease promo",
  "bundle",
  "box topper",
  "jumpstart",
  "rebalanced",
  "eternal",
  "conjured",
  "scheme",
  "printsheets",
])

/** Forge's CARD_PATTERN: optional collector number, optional rarity, the name, optional artist and parameters. */
const CARD_LINE = /^(?:(.?[0-9A-Z-]+\S*[A-Z]*)\s)?(?:([SCURML])\s)?([^@$]+)(?: @([^$]*))?(?: \$\{(.+)\})?$/

export class ForgeDataError extends Error {
  override name = "ForgeDataError"
}

/** One card script. Throws if it names no card. */
export function parseCardScript(file: string, text: string): ForgeCard {
  const states = text.split(/^ALTERNATE\s*$/m).map((part) => (/^Name:(.*)$/m.exec(part) ?? /^CopyFaceFrom:(.*)$/m.exec(part))?.[1]?.trim() ?? null)
  const named = states.filter((name): name is string => name !== null && name !== "")
  const main = named[0]
  if (main === undefined) throw new ForgeDataError(`${file}: no Name: or CopyFaceFrom: line`)
  const mode = /^AlternateMode:(.*)$/m.exec(text)?.[1]?.trim() || null
  const second = named[1]
  const name = mode === "Split" && second !== undefined ? `${main} // ${second}` : main
  return { file, name, states: named, mode }
}

/** One edition file (null if it has no [metadata] code). */
export function parseEdition(file: string, text: string): ForgeEdition | null {
  const metadata = new Map<string, string>()
  const entries: ForgeEditionEntry[] = []
  let section = ""
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === "") continue
    const header = /^\[(.+)\]$/.exec(line)
    if (header) {
      section = (header[1] ?? "").trim().toLowerCase()
      continue
    }
    if (section === "metadata") {
      const eq = line.indexOf("=")
      if (eq > 0) metadata.set(line.slice(0, eq).trim().toLowerCase(), line.slice(eq + 1).trim())
    } else if (CARD_SECTIONS.has(section)) {
      const match = CARD_LINE.exec(line)
      const collectorNumber = match?.[1]
      const name = match?.[3]?.trim()
      if (collectorNumber && name) entries.push({ collectorNumber, name })
    }
  }
  const code = metadata.get("code")
  if (!code) return null
  return {
    file,
    code,
    code2: metadata.get("code2") ?? code,
    scryfallCode: (metadata.get("scryfallcode") ?? code).toLowerCase(),
    name: metadata.get("name") ?? code,
    entries,
  }
}

function listFiles(dir: string, extension: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    // Code-point order, the same on every machine (see byCodePoint in catalog.ts).
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.endsWith(extension)) out.push(full)
    }
  }
  walk(dir)
  return out
}

/** Every card script and edition of a Forge res/ directory. */
export function readForgeCardDatabase(resDir: string): ForgeCardDatabase {
  const cardsDir = path.join(resDir, "cardsfolder")
  const editionsDir = path.join(resDir, "editions")
  if (!fs.existsSync(cardsDir) || !fs.existsSync(editionsDir)) {
    throw new ForgeDataError(`${resDir} is not Forge's res/ directory (cardsfolder/ and editions/ expected); is the engine/forge submodule checked out?`)
  }
  const cards = listFiles(cardsDir, ".txt").map((file) => parseCardScript(path.relative(cardsDir, file), fs.readFileSync(file, "utf8")))
  const editions = listFiles(editionsDir, ".txt")
    .map((file) => parseEdition(path.relative(editionsDir, file), fs.readFileSync(file, "utf8")))
    .filter((edition): edition is ForgeEdition => edition !== null)
  return { cards, editions }
}
