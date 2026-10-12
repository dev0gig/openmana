/*
 * German names and explanations of Forge's keywords (prompt 47): the card
 * view explains, beside the card, the keywords Forge reports for it now
 * (VisibleCard.keywords, protocol 9) - which ones and in which concrete form
 * is Forge's alone; this file only says them in German.
 *
 * One entry per constant of Forge's Keyword enum (Keyword.java in Forge's
 * game module):
 *  - `forge` is Forge's English reminder text of the keyword, unchanged - the
 *    text the German one translates;
 *  - `source` says where the German wording comes from: "druck" - the
 *    keyword's name and the wording of its reminder text as German Magic
 *    printings have them (the card catalog's printed German texts, latest
 *    printing), fitted to Forge's text where the two differ; "openmana" - no
 *    German printing with a reminder text in the catalog: OpenMana's own
 *    translation of Forge's text;
 *  - `forms` are the concrete forms OpenMana can say in German - each knows
 *    Forge's English title of the form from its parts (amount, cost, detail
 *    as Forge's parser reads them) and is used only where that title is
 *    exactly Forge's (and, where the title alone does not tell forms apart,
 *    Forge's reminder text fits too);
 *  - `general` explains the keyword for every form. A form OpenMana cannot say
 *    (a cost in words, a creature type) keeps the German name and this
 *    explanation, with Forge's concrete form beside it in English, marked.
 *
 * The rule that keeps this true (scripts/keyword-texts.test.ts): every constant of
 * Forge's enum at the pinned commit has exactly one entry here, and its
 * `forge` is Forge's text there - a Forge update that adds a keyword or
 * changes a text fails until the German text was looked at again. A keyword
 * without an entry (never in a checked build) shows Forge's English words,
 * marked "englisch" - never an empty box.
 *
 * Generated once from a table of translations (prompt 47); edit it here.
 */
/** A keyword as the protocol carries it (VisibleCard.keywords, CardKeyword); structural, so scripts in Node can use this file too. */
export interface CardKeyword {
  readonly keyword: string
  readonly title: string
  readonly reminder: string
  readonly amount?: string | undefined
  readonly cost?: string | undefined
  readonly detail?: string | undefined
}

export type KeywordSource = "druck" | "openmana"

/** What a form is made of: the parts Forge sends, and Forge's English reminder text of the form. */
export interface KeywordParts {
  readonly amount?: string | undefined
  readonly cost?: string | undefined
  readonly detail?: string | undefined
  readonly reminder: string
}

export interface KeywordForm {
  /** Forge's English title of this form from the parts, or null if the parts do not make this form. */
  readonly title: (parts: KeywordParts) => string | null
  readonly name: (parts: KeywordParts) => string
  readonly text: (parts: KeywordParts) => string
  /** Where the title alone does not tell Forge's forms apart: whether Forge's form (its reminder text) is this one. */
  readonly accept?: (parts: KeywordParts) => boolean
}

export interface KeywordEntry {
  readonly forge: string
  readonly source: KeywordSource
  /** The keyword's German name. */
  readonly name: string
  /** A German explanation that holds for every form. */
  readonly general: string
  readonly forms: readonly KeywordForm[]
}

const NUMBER_WORDS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"]

/** A number in words up to twelve (two and up; one depends on its noun), else as Forge sends it (digits, X). */
function zahl(n: string): string {
  const number = Number(n)
  return /^\d+$/.test(n) && number >= 2 && number <= 12 ? NUMBER_WORDS[number]! : n
}

function marken(n: string): string {
  return n === "1" ? "eine +1/+1-Marke" : `${zahl(n)} +1/+1-Marken`
}

/** The same after "mit": einer +1/+1-Marke. */
function markenDativ(n: string): string {
  return n === "1" ? "einer +1/+1-Marke" : `${zahl(n)} +1/+1-Marken`
}

function lebenspunkte(n: string): string {
  return n === "1" ? "1 Lebenspunkt" : `${n} Lebenspunkte`
}

function schaden(n: string): string {
  return n === "1" ? "1 Schadenspunkt" : `${n} Schadenspunkte`
}

function rotesMana(n: string): string {
  return /^\d+$/.test(n) && Number(n) >= 1 && Number(n) <= 12 ? "{R}".repeat(Number(n)) : `${n}-mal {R}`
}

/** A keyword without parts: Forge's title is its English name. */
function simple(forge: string, source: KeywordSource, en: string, name: string, text: string, general = text): KeywordEntry {
  return { forge, source, name, general, forms: [{ title: () => en, name: () => name, text: () => text }] }
}

/** "Afflict 2": a number (or X) after the name. */
function counted(forge: string, source: KeywordSource, en: string, name: string, text: (n: string) => string): KeywordEntry {
  return {
    forge, source, name, general: text("N"),
    forms: [{ title: (p) => (p.amount !== undefined ? `${en} ${p.amount}` : null), name: (p) => `${name} ${p.amount}`, text: (p) => text(p.amount!) }],
  }
}

/** "Kicker {2}{R}": a cost of mana after the name (a cost in words has no German form). */
function priced(forge: string, source: KeywordSource, en: string, name: string, text: (c: string) => string, general: string, accept?: (parts: KeywordParts) => boolean): KeywordEntry {
  return {
    forge, source, name, general,
    forms: [{ title: (p) => (p.cost !== undefined ? `${en} ${p.cost}` : null), name: (p) => `${name} ${p.cost}`, text: (p) => text(p.cost!), ...(accept ? { accept } : {}) }],
  }
}

/** "Suspend 4—{1}{U}": a number and a cost of mana. */
function pricedCounted(forge: string, source: KeywordSource, en: string, name: string, text: (n: string, c: string) => string, general: string): KeywordEntry {
  return {
    forge, source, name, general,
    forms: [{ title: (p) => (p.amount !== undefined && p.cost !== undefined ? `${en} ${p.amount}—${p.cost}` : null), name: (p) => `${name} ${p.amount} — ${p.cost}`, text: (p) => text(p.amount!, p.cost!) }],
  }
}

// --- Forms that depend on Forge's detail (a type or quality, in Forge's English words) --------------------

/** Forms of a keyword whose concrete form names a detail: Forge's English title of it, and the German form for each detail OpenMana knows. */
function byDetail(title: (detail: string) => string, known: Readonly<Record<string, { readonly name: string; readonly text: string }>>): KeywordForm {
  return {
    title: (p) => (p.detail !== undefined && known[p.detail] !== undefined ? title(p.detail) : null),
    name: (p) => known[p.detail!]!.name,
    text: (p) => known[p.detail!]!.text,
  }
}

/** Colours as Forge names them in details ("red", or "from red" for "Protection from red" in a card script). */
const COLOURS: Readonly<Record<string, { readonly noun: string; readonly adjective: string }>> = {
  white: { noun: "Weiß", adjective: "weißen" },
  blue: { noun: "Blau", adjective: "blauen" },
  black: { noun: "Schwarz", adjective: "schwarzen" },
  red: { noun: "Rot", adjective: "roten" },
  green: { noun: "Grün", adjective: "grünen" },
}

function protectionForms(): KeywordForm[] {
  const known: Record<string, { name: string; text: string }> = {}
  for (const [colour, { noun, adjective }] of Object.entries(COLOURS)) {
    const form = { name: `Schutz vor ${noun}`, text: `Diese Kreatur kann nicht von ${adjective} Kreaturen geblockt, nicht von ${adjective} Zaubersprüchen oder Fähigkeiten als Ziel bestimmt, nicht von ${adjective} Quellen verletzt und nicht mit ${adjective} Auren oder Ausrüstungen verzaubert oder ausgerüstet werden.` }
    known[colour] = form
    known[`from ${colour}`] = form
  }
  const things = (name: string, what: string) => ({ name: `Schutz vor ${name}`, text: `Diese Kreatur kann von ${what} nicht geblockt, nicht als Ziel bestimmt, nicht verletzt und nicht verzaubert oder ausgerüstet werden.` })
  const everything = { name: "Schutz vor allem", text: "Diese Kreatur kann von nichts geblockt, als Ziel bestimmt, verletzt, verzaubert oder ausgerüstet werden." }
  Object.assign(known, {
    everything, "from everything": everything,
    "each color": things("jeder Farbe", "allem Farbigen"), "from each color": things("jeder Farbe", "allem Farbigen"),
    multicolored: things("allem Mehrfarbigen", "allem Mehrfarbigen"),
    monocolored: things("allem Einfarbigen", "allem Einfarbigen"),
    artifact: things("Artefakten", "Artefakten"), artifacts: things("Artefakten", "Artefakten"),
    creature: things("Kreaturen", "Kreaturen"), creatures: things("Kreaturen", "Kreaturen"),
    enchantment: things("Verzauberungen", "Verzauberungen"), enchantments: things("Verzauberungen", "Verzauberungen"),
    instants: things("Spontanzaubern", "Spontanzaubern"),
    lands: things("Ländern", "Ländern"),
    planeswalker: things("Planeswalkern", "Planeswalkern"), planeswalkers: things("Planeswalkern", "Planeswalkern"),
    Dragon: things("Drachen", "Drachen"), Vampire: things("Vampiren", "Vampiren"), Zombie: things("Zombies", "Zombies"),
    Goblin: things("Goblins", "Goblins"), Werewolf: things("Werwölfen", "Werwölfen"), Demon: things("Dämonen", "Dämonen"),
    Angel: things("Engeln", "Engeln"), Human: things("Menschen", "Menschen"), Elf: things("Elfen", "Elfen"), Spirit: things("Geistern", "Geistern"),
  })
  return [byDetail((detail) => `Protection from ${detail}`, known)]
}

function hexproofForms(): KeywordForm[] {
  const opponents = (what: string) => `Dies kann nicht das Ziel von ${what} sein, die deine Gegner kontrollieren.`
  const known: Record<string, { name: string; text: string }> = {
    monocolored: { name: "Fluchsicher vor Einfarbig", text: opponents("einfarbigen Zaubersprüchen oder Fähigkeiten") },
    multicolored: { name: "Fluchsicher vor Mehrfarbig", text: opponents("mehrfarbigen Zaubersprüchen oder Fähigkeiten") },
    "each color": { name: "Fluchsicher vor jeder Farbe", text: opponents("farbigen Zaubersprüchen oder Fähigkeiten") },
    artifacts: { name: "Fluchsicher vor Artefakten", text: opponents("Artefakt-Zaubersprüchen oder Fähigkeiten von Artefakten") },
    enchantments: { name: "Fluchsicher vor Verzauberungen", text: opponents("Verzauberungszaubersprüchen oder Fähigkeiten von Verzauberungen") },
    creatures: { name: "Fluchsicher vor Kreaturen", text: opponents("Kreaturenzaubersprüchen oder Fähigkeiten von Kreaturen") },
    planeswalkers: { name: "Fluchsicher vor Planeswalkern", text: opponents("Planeswalker-Zaubersprüchen oder Fähigkeiten von Planeswalkern") },
    instants: { name: "Fluchsicher vor Spontanzaubern", text: opponents("Spontanzaubern") },
  }
  for (const [colour, { noun, adjective }] of Object.entries(COLOURS)) known[colour] = { name: `Fluchsicher vor ${noun}`, text: opponents(`${adjective} Zaubersprüchen oder Fähigkeiten`) }
  return [
    { title: () => "Hexproof", name: () => "Fluchsicher", text: () => opponents("Zaubersprüchen oder Fähigkeiten") },
    byDetail((detail) => `Hexproof from ${detail}`, known),
  ]
}

function landwalkForms(): KeywordForm[] {
  const walk = (name: string, land: string) => ({ name, text: `Diese Kreatur kann nicht geblockt werden, solange der verteidigende Spieler ${land} kontrolliert.` })
  return [byDetail((detail) => `${detail}walk`, {
    Plains: walk("Ebenentarnung", "eine Ebene"),
    Island: walk("Inseltarnung", "eine Insel"),
    Swamp: walk("Sumpftarnung", "einen Sumpf"),
    Mountain: walk("Gebirgstarnung", "ein Gebirge"),
    Forest: walk("Waldtarnung", "einen Wald"),
    Desert: walk("Wüstentarnung", "eine Wüste"),
    "Nonbasic land": walk("Nichtstandardland-Tarnung", "ein Nichtstandardland"),
    "Legendary land": walk("Legendäre Landtarnung", "ein legendäres Land"),
  })]
}

function enchantForms(): KeywordForm[] {
  const what: Readonly<Record<string, string>> = {
    creature: "eine Kreatur", land: "ein Land", player: "einen Spieler", opponent: "einen Gegner", permanent: "ein Permanent",
    artifact: "ein Artefakt", enchantment: "eine Verzauberung", planeswalker: "einen Planeswalker", Equipment: "eine Ausrüstung",
    "creature you control": "eine Kreatur, die du kontrollierst", "land you control": "ein Land, das du kontrollierst",
    "artifact you control": "ein Artefakt, das du kontrollierst", "creature an opponent controls": "eine Kreatur, die ein Gegner kontrolliert",
    "creature you don't control": "eine Kreatur, die du nicht kontrollierst", "nonland permanent": "ein Nichtland-Permanent",
    "artifact or creature": "ein Artefakt oder eine Kreatur", "creature or Vehicle": "eine Kreatur oder ein Fahrzeug",
    "creature or land": "eine Kreatur oder ein Land", "creature or planeswalker": "eine Kreatur oder einen Planeswalker",
    "creature or enchantment": "eine Kreatur oder eine Verzauberung", "artifact or enchantment": "ein Artefakt oder eine Verzauberung",
    "tapped creature": "eine getappte Kreatur", "artifact creature": "eine Artefaktkreatur", "legendary creature": "eine legendäre Kreatur",
    "nonbasic land": "ein Nichtstandardland", "basic land you control": "ein Standardland, das du kontrollierst",
    "creature card in a graveyard": "eine Kreaturenkarte in einem Friedhof",
    Plains: "eine Ebene", Island: "eine Insel", Swamp: "einen Sumpf", Mountain: "ein Gebirge", Forest: "einen Wald",
  }
  const known: Record<string, { name: string; text: string }> = {}
  for (const [detail, target] of Object.entries(what)) known[detail] = { name: `Verzaubert ${target}`, text: `Bestimme beim Wirken ${target} als Ziel. Diese Karte kommt an dieses Ziel angelegt ins Spiel.` }
  return [byDetail((detail) => `Enchant ${detail}`, known)]
}

function affinityForms(): KeywordForm[] {
  const cheaper = (name: string, each: string) => ({ name: `Affinität zu ${name}`, text: `Dieser Zauberspruch kostet beim Wirken für ${each} du kontrollierst, {1} weniger.` })
  return [byDetail((detail) => `Affinity for ${detail}`, {
    artifacts: cheaper("Artefakten", "jedes Artefakt, das"),
    creatures: cheaper("Kreaturen", "jede Kreatur, die"),
    "artifact creatures": cheaper("Artefaktkreaturen", "jede Artefaktkreatur, die"),
    enchantments: cheaper("Verzauberungen", "jede Verzauberung, die"),
    Equipment: cheaper("Ausrüstungen", "jede Ausrüstung, die"),
    planeswalkers: cheaper("Planeswalkern", "jeden Planeswalker, den"),
    tokens: cheaper("Spielsteinen", "jeden Spielstein, den"),
    Plains: cheaper("Ebenen", "jede Ebene, die"),
    Islands: cheaper("Inseln", "jede Insel, die"),
    Swamps: cheaper("Sümpfen", "jeden Sumpf, den"),
    Mountains: cheaper("Gebirgen", "jedes Gebirge, das"),
    Forests: cheaper("Wäldern", "jeden Wald, den"),
  })]
}

function championForms(): KeywordForm[] {
  const champion = (one: string, another: string) => ({ name: `Beschütze ${one}`, text: `Wenn dieses Permanent ins Spiel kommt, opfere es, falls du nicht ${another}, ${another.startsWith("eine ") ? "die" : another.startsWith("einen ") ? "den" : "das"} du kontrollierst, ins Exil schickst. Wenn dieses Permanent das Spiel verlässt, bringe die ins Exil geschickte Karte unter der Kontrolle ihres Besitzers ins Spiel zurück.` })
  return [byDetail((detail) => `Champion ${detail}`, {
    creature: champion("eine Kreatur", "eine andere Kreatur"),
    Elemental: champion("ein Elementarwesen", "ein anderes Elementarwesen"),
    Faerie: champion("ein Feenwesen", "ein anderes Feenwesen"),
    Merfolk: champion("ein Meervolk", "ein anderes Meervolk"),
    Goblin: champion("einen Goblin", "einen anderen Goblin"),
    Kithkin: champion("einen Kithkin", "einen anderen Kithkin"),
    Elf: champion("einen Elfen", "einen anderen Elfen"),
    "Goblin or Shaman": champion("einen Goblin oder Schamanen", "einen anderen Goblin oder Schamanen"),
    "Treefolk or Warrior": champion("einen Baumhirten oder Krieger", "einen anderen Baumhirten oder Krieger"),
  })]
}

function devourForms(): KeywordForm[] {
  return [{
    title: (p) => (p.amount !== undefined && (p.detail === undefined || p.detail === "creature") ? `Devour ${p.amount}` : null),
    name: (p) => `Verschlingen ${p.amount}`,
    text: (p) => `Sowie dieses Permanent ins Spiel kommt, kannst du beliebig viele Kreaturen opfern. Es kommt für jede so geopferte Kreatur mit ${markenDativ(p.amount!)} ins Spiel.`,
  }]
}

function emergeForms(): KeywordForm[] {
  return [
    { title: (p) => (p.cost !== undefined && (p.detail === undefined || p.detail === "creature") ? `Emerge ${p.cost}` : null), name: (p) => `Auftauchen ${p.cost}`, text: (p) => `Du kannst diesen Zauberspruch wirken, indem du eine Kreatur opferst und ${p.cost} abzüglich des Manabetrags der geopferten Kreatur bezahlst.` },
    { title: (p) => (p.cost !== undefined && p.detail === "artifact" ? `Emerge from artifact ${p.cost}` : null), name: (p) => `Auftauchen aus einem Artefakt ${p.cost}`, text: (p) => `Du kannst diesen Zauberspruch wirken, indem du ein Artefakt opferst und ${p.cost} abzüglich des Manabetrags des geopferten Artefakts bezahlst.` },
  ]
}

function spliceForms(): KeywordForm[] {
  const splice = (onto: string, name: string, when: string): KeywordForm => ({
    title: (p) => (p.cost !== undefined && p.detail === onto ? `Splice onto ${onto} ${p.cost}` : null),
    name: (p) => `${name} ${p.cost}`,
    text: (p) => `Sowie du ${when} wirkst, kannst du diese Karte aus deiner Hand offen vorzeigen und ${p.cost} bezahlen. Falls du dies tust, füge dem Zauberspruch die Effekte dieser Karte hinzu.`,
  })
  return [splice("Arcane", "Arkane Kopplung", "einen arkanen Zauberspruch"), splice("instant or sorcery", "Kopplung mit Spontanzauber oder Hexerei", "einen Spontanzauber oder eine Hexerei")]
}

function typecyclingForms(): KeywordForm[] {
  const kinds: Readonly<Record<string, { readonly name: string; readonly card: string }>> = {
    "basic land": { name: "Standardlandumwandlung", card: "einer Standardlandkarte" },
    Plains: { name: "Ebenenumwandlung", card: "einer Ebene-Karte" },
    Island: { name: "Inselumwandlung", card: "einer Insel-Karte" },
    Swamp: { name: "Sumpfumwandlung", card: "einer Sumpf-Karte" },
    Mountain: { name: "Gebirgsumwandlung", card: "einer Gebirge-Karte" },
    Forest: { name: "Waldumwandlung", card: "einer Wald-Karte" },
    "artifact land": { name: "Artefaktlandumwandlung", card: "einer Artefaktland-Karte" },
    Wizard: { name: "Zaubererumwandlung", card: "einer Zauberer-Karte" },
  }
  return [{
    title: (p) => (p.cost !== undefined && p.detail !== undefined && kinds[p.detail] !== undefined ? `${p.detail.charAt(0).toUpperCase()}${p.detail.slice(1)}cycling ${p.cost}` : null),
    name: (p) => `${kinds[p.detail!]!.name} ${p.cost}`,
    text: (p) => `${p.cost}, wirf diese Karte ab: Durchsuche deine Bibliothek nach ${kinds[p.detail!]!.card}, zeige sie offen vor, nimm sie auf deine Hand und mische danach.`,
  }]
}

function trampleForms(): KeywordForm[] {
  return [
    { title: () => "Trample", name: () => "Verursacht Trampelschaden", text: () => "Diese Kreatur kann überschüssigen Kampfschaden dem Spieler oder Planeswalker zufügen, den sie angreift." },
    { title: () => "Trample Over Planeswalkers", name: () => "Verursacht Trampelschaden über Planeswalker", text: () => "Diese Kreatur kann überschüssigen Kampfschaden dem Beherrscher des Planeswalkers zufügen, den sie angreift." },
  ]
}

function mayhemForms(): KeywordForm[] {
  return [
    { title: (p) => (p.cost !== undefined ? `Mayhem ${p.cost}` : null), name: (p) => `Wahnwitz ${p.cost}`, text: (p) => `Du kannst diese Karte für ${p.cost} aus deinem Friedhof wirken, falls du sie in diesem Zug abgeworfen hast. Zeitpunkts-Einschränkungen gelten weiterhin.` },
    { title: () => "Mayhem", name: () => "Wahnwitz", text: () => "Du kannst diese Karte aus deinem Friedhof spielen, falls du sie in diesem Zug abgeworfen hast. Zeitpunkts-Einschränkungen gelten weiterhin." },
  ]
}

function modularForms(): KeywordForm[] {
  return [
    { title: (p) => (p.amount !== undefined ? `Modular ${p.amount}` : null), name: (p) => `Bausteine ${p.amount}`, text: (p) => `Diese Kreatur kommt mit ${markenDativ(p.amount!)} ins Spiel. Wenn sie stirbt, kannst du ihre +1/+1-Marken auf eine Artefaktkreatur deiner Wahl legen.` },
    { title: () => "Modular—Sunburst", name: () => "Bausteine – Sonneneruption", text: () => "Dies kommt für jede Farbe des Manas, das für sein Wirken ausgegeben wurde, mit einer +1/+1-Marke ins Spiel. Wenn es stirbt, kannst du seine +1/+1-Marken auf eine Artefaktkreatur deiner Wahl legen." },
  ]
}

function vanishingForms(): KeywordForm[] {
  return [
    { title: (p) => (p.amount !== undefined ? `Vanishing ${p.amount}` : null), name: (p) => `Verschwinden ${p.amount}`, text: (p) => `Dieses Permanent kommt mit ${p.amount === "1" ? "einer Zeitmarke" : `${zahl(p.amount!)} Zeitmarken`} ins Spiel. Entferne zu Beginn deines Versorgungssegments eine Zeitmarke von ihm. Wenn die letzte entfernt wird, opfere es.` },
    { title: () => "Vanishing", name: () => "Verschwinden", text: () => "Entferne zu Beginn deines Versorgungssegments eine Zeitmarke von diesem Permanent. Wenn die letzte entfernt wird, opfere es." },
  ]
}

// --- One entry per constant of Forge's Keyword enum (without UNDEFINED), in its order -------------------

export const KEYWORD_TEXTS: Readonly<Record<string, KeywordEntry>> = {
  ABSORB: counted("If a source would deal damage to this creature, prevent %d of that damage.", "openmana", "Absorb", "Absorbieren", (n) => `Falls eine Quelle dieser Kreatur Schaden zufügen würde, verhindere ${schaden(n)} davon.`),
  AFFINITY: { forge: "This spell costs {1} less to cast for each %s you control.", source: "druck", name: "Affinität", general: "Dieser Zauberspruch kostet beim Wirken für jedes Permanent der genannten Art, das du kontrollierst, {1} weniger.", forms: affinityForms() },
  AFFLICT: counted("Whenever this creature becomes blocked, defending player loses %d life.", "druck", "Afflict", "Pestilenz", (n) => `Immer wenn diese Kreatur geblockt wird, verliert der verteidigende Spieler ${lebenspunkte(n)}.`),
  AFTERLIFE: counted("When this creature dies, create {%1$d:1/1 white and black Spirit creature token} with flying.", "druck", "Afterlife", "Seelenwandlung", (n) => `Wenn diese Kreatur stirbt, erzeuge ${n === "1" ? "einen fliegenden 1/1 weißen und schwarzen Geist-Kreaturenspielstein" : `${zahl(n)} fliegende 1/1 weiße und schwarze Geist-Kreaturenspielsteine`}.`),
  AFTERMATH: simple("Cast this spell only from your graveyard. Then exile it.", "druck", "Aftermath", "Nachhall", "Wirke diesen Zauberspruch nur aus deinem Friedhof. Schicke ihn danach ins Exil."),
  AMPLIFY: counted("As this creature enters, put {%d:+1/+1 counter} on it for each %s card you reveal in your hand.", "druck", "Amplify", "Verstärkung", (n) => `Sowie diese Kreatur ins Spiel kommt, lege für jede Karte auf deiner Hand, die du vorzeigst und die einen Kreaturentyp mit ihr gemeinsam hat, ${marken(n)} auf sie.`),
  ANNIHILATOR: counted("Whenever this creature attacks, defending player sacrifices {%d:permanent}.", "druck", "Annihilator", "Vernichter", (n) => `Immer wenn diese Kreatur angreift, opfert der verteidigende Spieler ${n === "1" ? "ein Permanent" : `${zahl(n)} Permanente`}.`),
  ASCEND: simple("If you control ten or more permanents, you get the city's blessing for the rest of the game.", "druck", "Ascend", "Aufstieg", "Falls du zehn oder mehr Permanente kontrollierst, erhältst du für den Rest der Partie den Segen der Stadt."),
  ASSIST: simple("Another player can pay up to %s of this spell's cost.", "openmana", "Assist", "Beistand", "Ein anderer Spieler kann einen beliebigen Teil der allgemeinen Manakosten dieses Zauberspruchs für dich bezahlen."),
  AURA_SWAP: priced("%s: You may exchange this Aura with an Aura card in your hand.", "druck", "Aura swap", "Aurentausch", (c) => `${c}: Tausche diese Aura gegen eine Aurakarte aus deiner Hand aus.`, "Bezahle die Aurentausch-Kosten: Tausche diese Aura gegen eine Aurakarte aus deiner Hand aus."),
  AWAKEN: pricedCounted("If you cast this spell for %s, also put {%d:+1/+1 counter} on target land you control and it becomes a 0/0 Elemental creature with haste. It's still a land.", "druck", "Awaken", "Erwecken", (n, c) => `Falls du diesen Zauberspruch für ${c} wirkst, lege außerdem ${marken(n)} auf ein Land deiner Wahl, das du kontrollierst. Es wird zu einer 0/0 Elementarwesen-Kreatur mit Eile. Es ist immer noch ein Land.`, "Falls du diesen Zauberspruch für seine Erwecken-Kosten wirkst, lege außerdem die genannte Anzahl +1/+1-Marken auf ein Land deiner Wahl, das du kontrollierst. Es wird zu einer 0/0 Elementarwesen-Kreatur mit Eile. Es ist immer noch ein Land."),
  BACKUP: counted("When this creature enters, put {%1$d:+1/+1 counter} on target creature. If that's another creature, it gains the following ability until end of turn.", "druck", "Backup", "Hilfestellung", (n) => `Wenn diese Kreatur ins Spiel kommt, lege ${marken(n)} auf eine Kreatur deiner Wahl. Falls es eine andere Kreatur ist, erhält sie bis zum Ende des Zuges die folgende Fähigkeit.`),
  BANDING: simple("Any creatures with banding, and up to one without, can attack in a band. Bands are blocked as a group. If any creatures with banding you control are blocking or being blocked by a creature, you divide that creature's combat damage, not its controller, among any of the creatures it's being blocked by or is blocking.", "openmana", "Banding", "Gruppenbildung", "Kreaturen mit Gruppenbildung und bis zu eine Kreatur ohne können zusammen als Gruppe angreifen; eine Gruppe wird nur als Ganzes geblockt. Blockt eine deiner Kreaturen mit Gruppenbildung oder wird sie geblockt, verteilst du – nicht der Beherrscher der anderen Kreatur – deren Kampfschaden auf die beteiligten Kreaturen."),
  BANDSWITH: { forge: "can attack in a band with another %s", source: "openmana", name: "Gruppenbildung mit anderen", general: "Diese Kreatur kann zusammen mit einer anderen Kreatur der genannten Art als Gruppe angreifen.", forms: [] },
  BARGAIN: simple("You may sacrifice an artifact, enchantment, or token as you cast this spell.", "druck", "Bargain", "Feilschen", "Du kannst ein Artefakt, eine Verzauberung oder einen Spielstein opfern, sowie du diesen Zauberspruch wirkst."),
  BATTLE_CRY: simple("Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.", "druck", "Battle cry", "Schlachtruf", "Immer wenn diese Kreatur angreift, erhält jede andere angreifende Kreatur +1/+0 bis zum Ende des Zuges."),
  BEAM_ME_UP: priced("You may cast this card from your graveyard for %s if you also return a creature you control to its owner's hand. Then exile this spell.", "openmana", "Beam me up", "Hochbeamen", (c) => `Du kannst diese Karte für ${c} aus deinem Friedhof wirken, falls du zusätzlich eine Kreatur, die du kontrollierst, auf die Hand ihres Besitzers zurückbringst. Schicke diesen Zauberspruch danach ins Exil.`, "Du kannst diese Karte für ihre Hochbeamen-Kosten aus deinem Friedhof wirken, falls du zusätzlich eine Kreatur, die du kontrollierst, auf die Hand ihres Besitzers zurückbringst. Schicke diesen Zauberspruch danach ins Exil."),
  BESTOW: priced("If you cast this card for its bestow cost, it's an Aura spell with enchant creature. It becomes a creature again if it's not attached to a creature.", "druck", "Bestow", "Göttergabe", (c) => `Falls du diese Karte für ${c} wirkst, ist sie ein Aura-Zauberspruch, der eine Kreatur verzaubert. Sie wird wieder zu einer Kreatur, falls sie an keine Kreatur angelegt ist.`, "Falls du diese Karte für ihre Göttergabe-Kosten wirkst, ist sie ein Aura-Zauberspruch, der eine Kreatur verzaubert. Sie wird wieder zu einer Kreatur, falls sie an keine Kreatur angelegt ist."),
  BLITZ: priced("If you cast this spell for its blitz cost, it gains haste and \"When this creature dies, draw a card.\" Sacrifice it at the beginning of the next end step.", "druck", "Blitz", "Blitz", (c) => `Falls du diesen Zauberspruch für ${c} wirkst, erhält er Eile und „Wenn diese Kreatur stirbt, ziehe eine Karte.“ Opfere ihn zu Beginn des nächsten Endsegments.`, "Falls du diesen Zauberspruch für seine Blitz-Kosten wirkst, erhält er Eile und „Wenn diese Kreatur stirbt, ziehe eine Karte.“ Opfere ihn zu Beginn des nächsten Endsegments."),
  BLOODTHIRST: counted("If an opponent was dealt damage this turn, this creature enters with {%d:+1/+1 counter} on it.", "druck", "Bloodthirst", "Blutdurst", (n) => `Falls einem Gegner in diesem Zug Schaden zugefügt wurde, kommt diese Kreatur mit ${markenDativ(n)} ins Spiel.`),
  BUSHIDO: counted("Whenever this creature blocks or becomes blocked, it gets +%1$d/+%1$d until end of turn.", "druck", "Bushido", "Bushido", (n) => `Immer wenn diese Kreatur blockt oder geblockt wird, erhält sie +${n}/+${n} bis zum Ende des Zuges.`),
  BUYBACK: priced("You may pay an additional %s as you cast this spell. If you do, put it into your hand instead of your graveyard as it resolves.", "druck", "Buyback", "Rückkauf", (c) => `Du kannst zusätzlich ${c} bezahlen, sowie du diesen Zauberspruch wirkst. Falls du dies tust, nimm ihn auf deine Hand statt auf deinen Friedhof, sowie er verrechnet wird.`, "Du kannst zusätzlich die Rückkaufkosten bezahlen, sowie du diesen Zauberspruch wirkst. Falls du dies tust, nimm ihn auf deine Hand statt auf deinen Friedhof, sowie er verrechnet wird."),
  CASCADE: simple("When you cast this spell, exile cards from the top of your library until you exile a nonland card whose mana value is less than this spell's mana value. You may cast that spell without paying its mana cost if its mana value is less than this spell's mana value. Then put all cards exiled this way that weren't cast on the bottom of your library in a random order.", "druck", "Cascade", "Kaskade", "Wenn du diesen Zauberspruch wirkst, schicke so lange Karten oben von deiner Bibliothek ins Exil, bis du eine Nichtland-Karte mit niedrigerem Manabetrag als diesem Zauberspruch ins Exil schickst. Du kannst sie wirken, ohne ihre Manakosten zu bezahlen. Lege danach alle so ins Exil geschickten Karten, die nicht gewirkt wurden, in zufälliger Reihenfolge unter deine Bibliothek."),
  CASUALTY: counted("As you cast this spell, you may sacrifice a creature with power %1$d or greater. When you do, copy this spell.", "druck", "Casualty", "Todesopfer", (n) => `Sowie du diesen Zauberspruch wirkst, kannst du eine Kreatur mit Stärke ${n} oder mehr opfern. Wenn du dies tust, kopiere diesen Zauberspruch.`),
  CHAMPION: { forge: "When this permanent enters, sacrifice it unless you exile another %s you control. When this permanent leaves the battlefield, return the exiled card to the battlefield under its owner's control.", source: "druck", name: "Beschützen", general: "Wenn dieses Permanent ins Spiel kommt, opfere es, falls du nicht ein anderes Permanent der genannten Art, das du kontrollierst, ins Exil schickst. Wenn dieses Permanent das Spiel verlässt, bringe die ins Exil geschickte Karte unter der Kontrolle ihres Besitzers ins Spiel zurück.", forms: championForms() },
  CHANGELING: simple("This card is every creature type.", "druck", "Changeling", "Wandelwicht", "Diese Karte hat alle Kreaturentypen."),
  CHOOSE_A_BACKGROUND: simple("You can have a Background as a second commander.", "druck", "Choose a Background", "Wähle einen Hintergrund", "Du kannst einen Hintergrund als zweiten Kommandeur haben."),
  CIPHER: simple("Then you may exile this spell card encoded on a creature you control. Whenever that creature deals combat damage to a player, its controller may cast a copy of the encoded card without paying its mana cost.", "druck", "Cipher", "Chiffrieren", "Dann kannst du diese Zauberspruchkarte auf eine Kreatur codiert, die du kontrollierst, ins Exil schicken. Immer wenn jene Kreatur einem Spieler Kampfschaden zufügt, kann ihr Beherrscher eine Kopie der codierten Karte wirken, ohne ihre Manakosten zu bezahlen."),
  COMPANION: simple("Reveal your companion from outside the game if your deck meets the companion restriction.", "druck", "Companion", "Gefährte", "Erfüllt dein Deck die Bedingung deines Gefährten, kannst du ihn von außerhalb der Partie offen vorzeigen und später wirken."),
  COMPLEATED: simple("This planeswalker enters with two fewer loyalty counters for each Phyrexian mana symbol life was paid for.", "druck", "Compleated", "Vollendet", "Phyrexanisches Mana in den Kosten dieses Planeswalkers kann statt mit Mana mit 2 Lebenspunkten bezahlt werden. Er kommt für jedes so bezahlte Symbol mit zwei Loyalitätsmarken weniger ins Spiel."),
  CONSPIRE: simple("As an additional cost to cast this spell, you may tap two untapped creatures you control that each share a color with it. If you do, copy it.", "druck", "Conspire", "Verschwören", "Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du zwei ungetappte Kreaturen tappen, die du kontrollierst und die jeweils eine Farbe mit ihm gemeinsam haben. Falls du dies tust, kopiere ihn."),
  CONVOKE: simple("Your creatures can help cast this spell. Each creature you tap while playing this spell reduces its cost by {1} or by one mana of that creature's color.", "druck", "Convoke", "Einberufen", "Deine Kreaturen können dir helfen, diesen Zauberspruch zu wirken. Jede Kreatur, die du dabei tappst, bezahlt {1} oder ein Mana ihrer Farbe."),
  CRAFT: { forge: "%s, Exile this artifact, %s: Return this card transformed under its owner's control. Craft only as a sorcery.", source: "druck", name: "Anfertigung", general: "Bezahle die Anfertigungskosten und schicke dieses Artefakt sowie die genannten Permanente, die du kontrollierst, und/oder Karten aus deinem Friedhof ins Exil: Bringe diese Karte transformiert unter der Kontrolle ihres Besitzers ins Spiel zurück. Spiele Anfertigung wie eine Hexerei.", forms: [] },
  CREW: counted("Tap any number of creatures you control with total power %1$d or more: This Vehicle becomes an artifact creature until end of turn.", "druck", "Crew", "Bemannen", (n) => `Tappe eine beliebige Anzahl an Kreaturen, die du kontrollierst und die zusammen Stärke ${n} oder mehr haben: Dieses Fahrzeug wird bis zum Ende des Zuges zu einer Artefaktkreatur.`),
  CUMULATIVE_UPKEEP: priced("At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.", "druck", "Cumulative upkeep", "Kumulative Versorgung", (c) => `Lege zu Beginn deines Versorgungssegments eine Altersmarke auf dieses Permanent. Opfere es dann, falls du nicht für jede Altersmarke auf ihm ${c} bezahlst.`, "Lege zu Beginn deines Versorgungssegments eine Altersmarke auf dieses Permanent. Opfere es dann, falls du nicht für jede Altersmarke auf ihm die Versorgungskosten bezahlst."),
  CYCLING: priced("%s, Discard this card: Draw a card.", "druck", "Cycling", "Umwandlung", (c) => `${c}, wirf diese Karte ab: Ziehe eine Karte.`, "Bezahle die Umwandlungskosten und wirf diese Karte ab: Ziehe eine Karte."),
  DASH: priced("You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.", "druck", "Dash", "Sturmangriff", (c) => `Du kannst diesen Zauberspruch für ${c} wirken. Falls du dies tust, erhält er Eile und kehrt zu Beginn des nächsten Endsegments aus dem Spiel auf die Hand seines Besitzers zurück.`, "Du kannst diesen Zauberspruch für seine Sturmangriff-Kosten wirken. Falls du dies tust, erhält er Eile und kehrt zu Beginn des nächsten Endsegments aus dem Spiel auf die Hand seines Besitzers zurück."),
  DAYBOUND: simple("If a player casts no spells during their own turn, it becomes night next turn.", "druck", "Daybound", "Tagaktiv", "Falls ein Spieler in seinem eigenen Zug keine Zaubersprüche wirkt, wird es im nächsten Zug Nacht."),
  DEATHTOUCH: simple("Any amount of damage this deals to a creature is enough to destroy it.", "druck", "Deathtouch", "Todesberührung", "Jede beliebige Menge Schaden, die dies einer Kreatur zufügt, reicht aus, um sie zu zerstören."),
  DECAYED: simple("This creature can't block. When it attacks, sacrifice it at end of combat.", "druck", "Decayed", "Verwesung", "Diese Kreatur kann nicht blocken. Wenn sie angreift, opfere sie am Ende des Kampfes."),
  DEFENDER: simple("This creature can't attack.", "druck", "Defender", "Verteidiger", "Diese Kreatur kann nicht angreifen."),
  DELVE: simple("As an additional cost to cast this spell, you may exile any number of cards from your graveyard. Each card exiled this way reduces the cost to cast this spell by {1}.", "druck", "Delve", "Wühlen", "Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du beliebig viele Karten aus deinem Friedhof ins Exil schicken. Jede so ins Exil geschickte Karte senkt die Kosten um {1}."),
  DEMONSTRATE: simple("When you cast this spell, you may copy it. If you do, choose an opponent to also copy it. Players may choose new targets for their copies.", "druck", "Demonstrate", "Demonstrieren", "Wenn du diesen Zauberspruch wirkst, kannst du ihn kopieren. Falls du dies tust, bestimme einen Gegner, der ihn ebenfalls kopiert. Spieler können neue Ziele für ihre Kopien bestimmen."),
  DETHRONE: simple("Whenever this creature attacks the player with the most life or tied for the most life, put a +1/+1 counter on it.", "druck", "Dethrone", "Entthronen", "Immer wenn diese Kreatur den Spieler mit den meisten Lebenspunkten oder einen der Spieler mit gleich vielen meisten Lebenspunkten angreift, lege eine +1/+1-Marke auf sie."),
  DEVOUR: { forge: "As this object enters, you may sacrifice any number of %2$s. This permanent enters with {%1$s:+1/+1 counter} on it for each permanent sacrificed this way.", source: "druck", name: "Verschlingen", general: "Sowie dieses Permanent ins Spiel kommt, kannst du beliebig viele Permanente der genannten Art opfern. Es kommt für jedes so geopferte Permanent mit der genannten Anzahl +1/+1-Marken ins Spiel.", forms: devourForms() },
  DEVOID: simple("This card has no color.", "druck", "Devoid", "Fahl", "Diese Karte hat keine Farbe."),
  DISGUISE: priced("You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.", "druck", "Disguise", "Verkleidung", (c) => `Du kannst diese Karte verdeckt für {3} als eine 2/2 Kreatur mit Abwehr {2} wirken. Decke sie zu einem beliebigen Zeitpunkt für ${c} auf.`, "Du kannst diese Karte verdeckt für {3} als eine 2/2 Kreatur mit Abwehr {2} wirken. Decke sie zu einem beliebigen Zeitpunkt für ihre Verkleidungskosten auf."),
  DISTURB: priced("You may cast this card from your graveyard transformed for its disturb cost.", "druck", "Disturb", "Aufstören", (c) => `Du kannst diese Karte für ${c} transformiert aus deinem Friedhof wirken.`, "Du kannst diese Karte für ihre Aufstören-Kosten transformiert aus deinem Friedhof wirken."),
  DOCTORS_COMPANION: simple("You can have two commanders if the other is the Doctor.", "druck", "Doctor's companion", "Begleiter des Doctors", "Du kannst zwei Kommandeure haben, falls der andere der Doctor ist."),
  DOUBLE_AGENDA: simple("Start the game with this conspiracy face down in the command zone and secretly choose two different card names. You may turn this conspiracy face up any time and reveal those names.", "openmana", "Double agenda", "Doppelte Agenda", "Beginne die Partie mit dieser Verschwörung verdeckt in der Kommandozone und nenne geheim zwei verschiedene Kartennamen. Du kannst diese Verschwörung jederzeit aufdecken und die Namen offenlegen."),
  DOUBLE_STRIKE: simple("This creature deals both first-strike and regular combat damage.", "druck", "Double Strike", "Doppelschlag", "Diese Kreatur fügt sowohl Erstschlag- als auch normalen Kampfschaden zu."),
  DOUBLE_TEAM: simple("When this creature attacks, if it's not a token, conjure a duplicate of it into your hand. Then both cards perpetually lose double team.", "openmana", "Double team", "Doppelteam", "Wenn diese Kreatur angreift und kein Spielstein ist, beschwöre ein Duplikat von ihr auf deine Hand. Danach verlieren beide Karten dauerhaft Doppelteam."),
  DREDGE: counted("If you would draw a card, instead you may put exactly {%d:card} from the top of your library into your graveyard. If you do, return this card from your graveyard to your hand. Otherwise, draw a card.", "druck", "Dredge", "Ausgraben", (n) => `Falls du eine Karte ziehen würdest, kannst du stattdessen genau ${n === "1" ? "eine Karte" : `${zahl(n)} Karten`} oben von deiner Bibliothek auf deinen Friedhof legen. Falls du dies tust, bringe diese Karte aus deinem Friedhof auf deine Hand zurück. Ziehe andernfalls eine Karte.`),
  ECHO: priced("At the beginning of your upkeep, if this permanent came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.", "druck", "Echo", "Echo", (c) => `Falls dieses Permanent seit Beginn deines letzten Versorgungssegments unter deine Kontrolle gekommen ist, opfere es zu Beginn deines Versorgungssegments, es sei denn, du bezahlst ${c}.`, "Falls dieses Permanent seit Beginn deines letzten Versorgungssegments unter deine Kontrolle gekommen ist, opfere es zu Beginn deines Versorgungssegments, es sei denn, du bezahlst seine Echokosten."),
  EMBALM: priced("%s, Exile this card from your graveyard: Create a token that's a copy of this card, except it's white, it has no mana cost, and it's a Zombie in addition to its other types. Embalm only as a sorcery.", "druck", "Embalm", "Einbalsamieren", (c) => `${c}, schicke diese Karte aus deinem Friedhof ins Exil: Erzeuge einen Spielstein, der eine Kopie von ihr ist, außer dass er weiß ist, keine Manakosten hat und zusätzlich zu seinen anderen Typen ein Zombie ist. Spiele Einbalsamieren wie eine Hexerei.`, "Bezahle die Einbalsamieren-Kosten und schicke diese Karte aus deinem Friedhof ins Exil: Erzeuge einen Spielstein, der eine Kopie von ihr ist, außer dass er weiß ist, keine Manakosten hat und zusätzlich zu seinen anderen Typen ein Zombie ist. Spiele Einbalsamieren wie eine Hexerei."),
  EMERGE: { forge: "You may cast this spell by sacrificing {1:%2$s} and paying the emerge cost reduced by that %2$s's mana value.", source: "druck", name: "Auftauchen", general: "Du kannst diesen Zauberspruch wirken, indem du ein Permanent der genannten Art opferst und die Auftauchen-Kosten abzüglich seines Manabetrags bezahlst.", forms: emergeForms() },
  ENCHANT: { forge: "Target a %1$s as you cast this. This card enters attached to that %1$s.", source: "druck", name: "Verzaubert", general: "Bestimme beim Wirken ein Ziel der genannten Art. Diese Karte kommt an dieses Ziel angelegt ins Spiel.", forms: enchantForms() },
  ENCORE: priced("%s, Exile this card from your graveyard: For each opponent, create a token copy that attacks that opponent this turn if able. They gain haste. Sacrifice them at the beginning of the next end step. Activate only as a sorcery.", "druck", "Encore", "Zugabe", (c) => `${c}, schicke diese Karte aus deinem Friedhof ins Exil: Erzeuge für jeden Gegner einen Spielstein, der eine Kopie von ihr ist und jenen Gegner in diesem Zug angreift, falls möglich. Die Spielsteine erhalten Eile. Opfere sie zu Beginn des nächsten Endsegments. Spiele Zugabe wie eine Hexerei.`, "Bezahle die Zugabe-Kosten und schicke diese Karte aus deinem Friedhof ins Exil: Erzeuge für jeden Gegner einen Spielstein, der eine Kopie von ihr ist und jenen Gegner in diesem Zug angreift, falls möglich. Die Spielsteine erhalten Eile. Opfere sie zu Beginn des nächsten Endsegments. Spiele Zugabe wie eine Hexerei."),
  ENLIST: simple("As this creature attacks, you may tap a nonattacking creature you control without summoning sickness. When you do, add its power to this creature’s until end of turn.", "druck", "Enlist", "Abkommandieren", "Sowie diese Kreatur angreift, kannst du eine nicht angreifende Kreatur ohne Einsatzverzögerung tappen, die du kontrollierst. Wenn du dies tust, addiere bis zum Ende des Zuges deren Stärke zur Stärke dieser Kreatur."),
  ENTWINE: priced("Choose both if you pay the entwine cost.", "druck", "Entwine", "Verflechtung", (c) => `Bestimme beide Modi, falls du ${c} zusätzlich bezahlst.`, "Bestimme beide Modi, falls du die Verflechtungskosten zusätzlich bezahlst."),
  EPIC: simple("For the rest of the game, you can't cast spells. At the beginning of each of your upkeeps for the rest of the game, copy this spell except for its epic ability. If the spell has any targets, you may choose new targets for the copy.", "druck", "Epic", "Episch", "Für den Rest der Partie kannst du keine Zaubersprüche wirken. Kopiere zu Beginn jedes deiner Versorgungssegmente für den Rest der Partie diesen Zauberspruch außer seiner epischen Fähigkeit. Hat der Zauberspruch Ziele, kannst du neue Ziele für die Kopie bestimmen."),
  EQUIP: priced("%s: Attach to target %s you control. Equip only as a sorcery.", "druck", "Equip", "Ausrüsten", (c) => `${c}: Lege diese Karte an eine Kreatur deiner Wahl an, die du kontrollierst. Spiele Ausrüsten wie eine Hexerei.`, "Bezahle die Ausrüsten-Kosten: Lege diese Ausrüstung an ein passendes Permanent deiner Wahl an, das du kontrollierst. Spiele Ausrüsten wie eine Hexerei.", (p) => { const r = p.reminder; return r.includes("Attach to target creature you control.") }),
  ESCAPE: priced("You may cast this card from your graveyard for its escape cost.", "druck", "Escape", "Befreiung", (c) => `Du kannst diese Karte für ${c} aus deinem Friedhof wirken.`, "Du kannst diese Karte für ihre Befreiungskosten aus deinem Friedhof wirken."),
  ESCALATE: priced("Pay this cost for each mode chosen beyond the first.", "druck", "Escalate", "Eskalieren", (c) => `Bezahle ${c} für jeden gewählten Modus außer dem ersten.`, "Bezahle die Eskalieren-Kosten für jeden gewählten Modus außer dem ersten."),
  ETERNALIZE: priced("%s, Exile this card from your graveyard: Create a token that's a copy of this card, except it's black, it's 4/4, it has no mana cost, and it's a Zombie in addition to its other types. Eternalize only as a sorcery.", "druck", "Eternalize", "Verewigen", (c) => `${c}, schicke diese Karte aus deinem Friedhof ins Exil: Erzeuge einen Spielstein, der eine Kopie von ihr ist, außer dass er eine schwarze 4/4 Kreatur ohne Manakosten und zusätzlich zu seinen anderen Typen ein Zombie ist. Spiele Verewigen wie eine Hexerei.`, "Bezahle die Verewigen-Kosten und schicke diese Karte aus deinem Friedhof ins Exil: Erzeuge einen Spielstein, der eine Kopie von ihr ist, außer dass er eine schwarze 4/4 Kreatur ohne Manakosten und zusätzlich zu seinen anderen Typen ein Zombie ist. Spiele Verewigen wie eine Hexerei."),
  EVOKE: priced("You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.", "druck", "Evoke", "Herbeirufen", (c) => `Du kannst diesen Zauberspruch für ${c} wirken. Falls du dies tust, wird er geopfert, wenn er ins Spiel kommt.`, "Du kannst diesen Zauberspruch für seine Herbeirufungskosten wirken. Falls du dies tust, wird er geopfert, wenn er ins Spiel kommt."),
  EVOLVE: simple("Whenever a creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.", "druck", "Evolve", "Weiterentwicklung", "Immer wenn eine Kreatur unter deiner Kontrolle ins Spiel kommt und falls deren Stärke oder Widerstandskraft höher ist als die dieser Kreatur, lege eine +1/+1-Marke auf diese Kreatur."),
  EXALTED: simple("Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.", "druck", "Exalted", "Edelmut", "Immer wenn eine Kreatur, die du kontrollierst, alleine angreift, erhält sie +1/+1 bis zum Ende des Zuges."),
  EXPLOIT: simple("When this creature enters, you may sacrifice a creature.", "druck", "Exploit", "Ausschlachten", "Wenn diese Kreatur ins Spiel kommt, kannst du eine Kreatur opfern."),
  EXTORT: simple("Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life.", "druck", "Extort", "Abnötigen", "Immer wenn du einen Zauberspruch wirkst, kannst du {W/B} bezahlen. Falls du dies tust, verliert jeder Gegner 1 Lebenspunkt und du erhältst ebenso viele Lebenspunkte dazu."),
  FABRICATE: counted("When this creature enters, put {%1$d:+1/+1 counter} on it, or create {%1$d:1/1 colorless Servo artifact creature token}.", "druck", "Fabricate", "Fabrizieren", (n) => `Wenn diese Kreatur ins Spiel kommt, lege ${marken(n)} auf sie oder erzeuge ${n === "1" ? "einen 1/1 farblosen Servo-Artefaktkreaturenspielstein" : `${zahl(n)} 1/1 farblose Servo-Artefaktkreaturenspielsteine`}.`),
  FADING: counted("This permanent enters with {%d:fade counter} on it. At the beginning of your upkeep, remove a fade counter from it. If you can't, sacrifice it.", "openmana", "Fading", "Schwinden", (n) => `Dieses Permanent kommt mit ${n === "1" ? "einer Schwundmarke" : `${zahl(n)} Schwundmarken`} ins Spiel. Entferne zu Beginn deines Versorgungssegments eine Schwundmarke von ihm. Kannst du das nicht, opfere es.`),
  FEAR: simple("This creature can't be blocked except by artifact creatures and/or black creatures.", "druck", "Fear", "Furcht", "Diese Kreatur kann nur von Artefaktkreaturen und/oder schwarzen Kreaturen geblockt werden."),
  FIREBENDING: counted("Whenever this creature attacks, add %s. This mana lasts until end of combat.", "druck", "Firebending", "Feuerbändigen", (n) => `Immer wenn diese Kreatur angreift, erzeuge ${rotesMana(n)}. Bis zum Ende des Kampfes verlierst du dieses Mana nicht.`),
  FIRST_STRIKE: simple("This creature deals combat damage before creatures without first strike.", "druck", "First Strike", "Erstschlag", "Diese Kreatur fügt Kampfschaden vor Kreaturen ohne Erstschlag zu."),
  FLANKING: simple("Whenever this creature becomes blocked by a creature without flanking, the blocking creature gets -1/-1 until end of turn.", "druck", "Flanking", "Flankenangriff", "Immer wenn eine Kreatur ohne Flankenangriff diese Kreatur blockt, erhält die blockende Kreatur -1/-1 bis zum Ende des Zuges."),
  FLASH: simple("You may cast this spell any time you could cast an instant.", "druck", "Flash", "Aufblitzen", "Du kannst diesen Zauberspruch zu jedem Zeitpunkt wirken, zu dem du einen Spontanzauber wirken könntest."),
  FLASHBACK: priced("You may cast this card from your graveyard for its flashback cost. Then exile it.", "druck", "Flashback", "Rückblende", (c) => `Du kannst diese Karte für ${c} aus deinem Friedhof wirken. Schicke sie danach ins Exil.`, "Du kannst diese Karte für ihre Rückblendekosten aus deinem Friedhof wirken. Schicke sie danach ins Exil."),
  FLYING: simple("This creature can't be blocked except by creatures with flying or reach.", "druck", "Flying", "Fliegend", "Diese Kreatur kann nur von fliegenden Kreaturen und Kreaturen mit Reichweite geblockt werden. (Ältere deutsche Karten nennen das „Flugfähigkeit“.)"),
  FOR_MIRRODIN: simple("When this Equipment enters, create a 2/2 red Rebel creature token, then attach this to it.", "openmana", "For Mirrodin", "Für Mirrodin!", "Wenn diese Ausrüstung ins Spiel kommt, erzeuge einen 2/2 roten Rebell-Kreaturenspielstein und lege sie dann an ihn an."),
  FORETELL: priced("During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost.", "druck", "Foretell", "Vorherbestimmung", (c) => `Während deines Zuges kannst du {2} bezahlen und diese Karte aus deiner Hand verdeckt ins Exil schicken. Wirke sie in einem späteren Zug für ${c}.`, "Während deines Zuges kannst du {2} bezahlen und diese Karte aus deiner Hand verdeckt ins Exil schicken. Wirke sie in einem späteren Zug für ihre Vorherbestimmungskosten."),
  FORTIFY: priced("%s: Attach to target land you control. Fortify only as a sorcery.", "druck", "Fortify", "Befestigen", (c) => `${c}: Lege diese Karte an ein Land deiner Wahl an, das du kontrollierst. Spiele Befestigen wie eine Hexerei.`, "Bezahle die Befestigen-Kosten: Lege diese Karte an ein Land deiner Wahl an, das du kontrollierst. Spiele Befestigen wie eine Hexerei."),
  FREERUNNING: priced("You may cast this spell for its freerunning cost if you dealt combat damage to a player this turn with an Assassin or commander.", "druck", "Freerunning", "Parkour", (c) => `Du kannst diesen Zauberspruch für ${c} wirken, falls du in diesem Zug einem Spieler mit einem Assassinen oder einem Kommandeur Kampfschaden zugefügt hast.`, "Du kannst diesen Zauberspruch für seine Parkour-Kosten wirken, falls du in diesem Zug einem Spieler mit einem Assassinen oder einem Kommandeur Kampfschaden zugefügt hast."),
  FRENZY: counted("Whenever this creature attacks and isn't blocked, it gets +%d/+0 until end of turn.", "openmana", "Frenzy", "Tobsucht", (n) => `Immer wenn diese Kreatur angreift und nicht geblockt wird, erhält sie +${n}/+0 bis zum Ende des Zuges.`),
  FUSE: simple("You may cast one or both halves of this card from your hand.", "druck", "Fuse", "Fusion", "Du kannst eine oder beide Hälften dieser Karte aus deiner Hand wirken."),
  GIFT: simple("You may promise an opponent a gift as you cast this spell. If you do, when it enters, they %s.", "druck", "Gift", "Geschenk", "Du kannst einem Gegner ein Geschenk versprechen, sowie du diesen Zauberspruch wirkst. Falls du dies tust, erhält er das auf der Karte genannte Geschenk, bevor die anderen Effekte wirken."),
  GRAFT: counted("This permanent enters with {%d:+1/+1 counter} on it. Whenever another creature enters, you may move a +1/+1 counter from this permanent onto it.", "druck", "Graft", "Pfropfen", (n) => `Dieses Permanent kommt mit ${markenDativ(n)} ins Spiel. Immer wenn eine andere Kreatur ins Spiel kommt, kannst du eine +1/+1-Marke von diesem Permanent auf sie legen.`),
  GRAVESTORM: simple("When you cast this spell, copy it for each permanent that was put into a graveyard from the battlefield this turn. If the spell has any targets, you may choose new targets for any of the copies.", "druck", "Gravestorm", "Gräbersturm", "Wenn du diesen Zauberspruch wirkst, kopiere ihn einmal für jedes Permanent, das in diesem Zug aus dem Spiel auf einen Friedhof gelegt wurde. Du kannst neue Ziele für die Kopien bestimmen."),
  HARMONIZE: priced("You may cast this card from your graveyard for its harmonize cost. You may tap a creature you control to reduce that cost by {X}, where X is its power. Then exile this spell.", "druck", "Harmonize", "Harmonisieren", (c) => `Du kannst diese Karte für ${c} aus deinem Friedhof wirken. Du kannst eine Kreatur tappen, die du kontrollierst, um diese Kosten um {X} zu senken, wobei X gleich ihrer Stärke ist. Schicke diesen Zauberspruch danach ins Exil.`, "Du kannst diese Karte für ihre Harmonisieren-Kosten aus deinem Friedhof wirken. Du kannst eine Kreatur tappen, die du kontrollierst, um diese Kosten um {X} zu senken, wobei X gleich ihrer Stärke ist. Schicke diesen Zauberspruch danach ins Exil."),
  HASTE: simple("This creature can attack and {T} as soon as it comes under your control.", "druck", "Haste", "Eile", "Diese Kreatur kann angreifen und {T} benutzen, sobald sie unter deine Kontrolle kommt."),
  HAUNT: simple("When this is put into a graveyard from the battlefield, exile it haunting target creature.", "druck", "Haunt", "Spuk", "Wenn dies aus dem Spiel auf einen Friedhof gelegt wird, schicke es ins Exil, sodass es bei einer Kreatur deiner Wahl spukt."),
  HEXPROOF: { forge: "This can't be the target of %s spells or abilities your opponents control.", source: "druck", name: "Fluchsicher", general: "Dies kann nicht das Ziel von Zaubersprüchen oder Fähigkeiten der genannten Art sein, die deine Gegner kontrollieren.", forms: hexproofForms() },
  HIDEAWAY: counted("When this permanent enters, look at the top {%d:card} of your library, exile one face down, then put the rest on the bottom of your library.", "druck", "Hideaway", "Refugium", (n) => `Wenn dieses Permanent ins Spiel kommt, schaue dir die obersten ${n === "1" ? "Karte" : `${zahl(n)} Karten`} deiner Bibliothek an, schicke eine davon verdeckt ins Exil und lege dann den Rest unter deine Bibliothek.`),
  HIDDEN_AGENDA: simple("Start the game with this conspiracy face down in the command zone and secretly choose a card name. You may turn this conspiracy face up any time and reveal that name.", "openmana", "Hidden agenda", "Geheime Agenda", "Beginne die Partie mit dieser Verschwörung verdeckt in der Kommandozone und nenne geheim einen Kartennamen. Du kannst diese Verschwörung jederzeit aufdecken und den Namen offenlegen."),
  HORSEMANSHIP: simple("This creature can't be blocked except by creatures with horsemanship.", "openmana", "Horsemanship", "Reiterei", "Diese Kreatur kann nur von Kreaturen mit Reiterei geblockt werden."),
  IMPENDING: pricedCounted("If you cast this spell for its impending cost, it enters with {%2$d:time counter} and isn't a creature until the last is removed. At the beginning of your end step, remove a time counter from it.", "druck", "Impending", "Unheilsdrohend", (n, c) => `Falls du diesen Zauberspruch für ${c} wirkst, kommt er mit ${n === "1" ? "einer Zeitmarke" : `${zahl(n)} Zeitmarken`} ins Spiel und ist keine Kreatur, bis die letzte entfernt wurde. Entferne zu Beginn deines Endsegments eine Zeitmarke von ihm.`, "Falls du diesen Zauberspruch für seine Unheilsdrohend-Kosten wirkst, kommt er mit der genannten Anzahl Zeitmarken ins Spiel und ist keine Kreatur, bis die letzte entfernt wurde. Entferne zu Beginn deines Endsegments eine Zeitmarke von ihm."),
  IMPROVISE: simple("Your artifacts can help cast this spell. Each artifact you tap after you're done activating mana abilities pays for {1}.", "druck", "Improvise", "Improvisieren", "Deine Artefakte können dir helfen, diesen Zauberspruch zu wirken. Jedes Artefakt, das du tappst, nachdem du mit dem Aktivieren deiner Manafähigkeiten fertig bist, bezahlt {1}."),
  INCREMENT: simple("Whenever you cast a spell, if the amount of mana you spent is greater than this creature’s power or toughness, put a +1/+1 counter on this creature.", "druck", "Increment", "Inkrement", "Immer wenn du einen Zauberspruch wirkst und falls die Menge Mana, die du dafür ausgegeben hast, größer ist als die Stärke oder Widerstandskraft dieser Kreatur, lege eine +1/+1-Marke auf diese Kreatur."),
  INDESTRUCTIBLE: simple("Effects that say \"destroy\" don't destroy this.", "druck", "Indestructible", "Unzerstörbar", "Effekte, die „zerstören“, zerstören dies nicht."),
  INFECT: simple("This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.", "druck", "Infect", "Infizieren", "Diese Kreatur fügt Kreaturen Schaden in Form von -1/-1-Marken und Spielern in Form von Giftmarken zu."),
  INGEST: simple("Whenever this creature deals combat damage to a player, that player exiles the top card of their library.", "openmana", "Ingest", "Verschlucken", "Immer wenn diese Kreatur einem Spieler Kampfschaden zufügt, schickt jener Spieler die oberste Karte seiner Bibliothek ins Exil."),
  INTIMIDATE: simple("This creature can't be blocked except by artifact creatures and/or creatures that share a color with it.", "druck", "Intimidate", "Einschüchtern", "Diese Kreatur kann nur von Artefaktkreaturen und/oder Kreaturen geblockt werden, mit denen sie eine Farbe gemeinsam hat."),
  KICKER: priced("You may pay an additional %s as you cast this spell.", "druck", "Kicker", "Bonus", (c) => `Du kannst zusätzlich ${c} bezahlen, sowie du diesen Zauberspruch wirkst.`, "Du kannst zusätzlich die Bonuskosten bezahlen, sowie du diesen Zauberspruch wirkst.", (p) => { const r = p.reminder; return !r.includes(" and/or ") }),
  JOB_SELECT: simple("When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.", "druck", "Job select", "Auftragsauswahl", "Wenn diese Ausrüstung ins Spiel kommt, erzeuge einen 1/1 farblosen Held-Kreaturenspielstein und lege sie dann an ihn an."),
  JUMP_START: simple("You may cast this card from your graveyard by discarding a card in addition to paying its other costs. Then exile this card.", "druck", "Jump-start", "Katalyse", "Du kannst diese Karte aus deinem Friedhof wirken, indem du zusätzlich zu ihren anderen Kosten eine Karte abwirfst. Schicke sie danach ins Exil."),
  LANDWALK: { forge: "This creature is unblockable as long as defending player controls {1:%s}.", source: "druck", name: "Landtarnung", general: "Diese Kreatur kann nicht geblockt werden, solange der verteidigende Spieler ein Land der genannten Art kontrolliert.", forms: landwalkForms() },
  LEVEL_UP: priced("%s: Put a level counter on this. Level up only as a sorcery.", "druck", "Level up", "Stufe aufsteigen", (c) => `${c}: Lege eine Stufenmarke auf dies. Spiele Stufe aufsteigen wie eine Hexerei.`, "Bezahle die Stufenkosten: Lege eine Stufenmarke auf dies. Spiele Stufe aufsteigen wie eine Hexerei."),
  LIFELINK: simple("Damage dealt by this creature also causes its controller to gain that much life.", "druck", "Lifelink", "Lebensverknüpfung", "Schaden, den diese Kreatur zufügt, lässt ihren Beherrscher ebenso viele Lebenspunkte dazuerhalten."),
  LIVING_METAL: simple("During your turn, this Vehicle is also a creature.", "openmana", "Living metal", "Lebendes Metall", "Während deines Zuges ist dieses Fahrzeug zusätzlich eine Kreatur."),
  LIVING_WEAPON: simple("When this Equipment enters, create a 0/0 black Phyrexian Germ creature token, then attach this to it.", "druck", "Living Weapon", "Lebende Waffe", "Wenn diese Ausrüstung ins Spiel kommt, erzeuge einen 0/0 schwarzen Phyrexianer-Keim-Kreaturenspielstein und lege sie dann an ihn an."),
  MADNESS: priced("If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.", "druck", "Madness", "Wahnsinn", (c) => `Falls du diese Karte abwirfst, wirf sie ins Exil ab. Wenn du dies tust, wirke sie für ${c} oder lege sie auf deinen Friedhof.`, "Falls du diese Karte abwirfst, wirf sie ins Exil ab. Wenn du dies tust, wirke sie für ihre Wahnsinn-Kosten oder lege sie auf deinen Friedhof."),
  MAYHEM: { forge: "You may cast this card from your graveyard for %s if you discarded it this turn. Timing rules still apply.", source: "druck", name: "Wahnwitz", general: "Du kannst diese Karte aus deinem Friedhof wirken, falls du sie in diesem Zug abgeworfen hast. Zeitpunkts-Einschränkungen gelten weiterhin.", forms: mayhemForms() },
  MELEE: simple("Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.", "druck", "Melee", "Tumult", "Immer wenn diese Kreatur angreift, erhält sie bis zum Ende des Zuges +1/+1 für jeden Gegner, den du in diesem Kampf angegriffen hast."),
  MENTOR: simple("Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.", "druck", "Mentor", "Mentor", "Immer wenn diese Kreatur angreift, lege eine +1/+1-Marke auf eine angreifende Kreatur deiner Wahl mit geringerer Stärke."),
  MENACE: simple("This creature can't be blocked except by two or more creatures.", "druck", "Menace", "Bedrohlich", "Diese Kreatur kann nur von zwei oder mehr Kreaturen geblockt werden."),
  MEGAMORPH: priced("You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its megamorph cost and put a +1/+1 counter on it.", "druck", "Megamorph", "Megamorph", (c) => `Du kannst diese Karte verdeckt für {3} als eine 2/2 Kreatur wirken. Decke sie zu einem beliebigen Zeitpunkt für ${c} auf und lege eine +1/+1-Marke auf sie.`, "Du kannst diese Karte verdeckt für {3} als eine 2/2 Kreatur wirken. Decke sie zu einem beliebigen Zeitpunkt für ihre Megamorph-Kosten auf und lege eine +1/+1-Marke auf sie."),
  MIRACLE: priced("You may cast this card for its miracle cost when you draw it if it's the first card you drew this turn.", "druck", "Miracle", "Mirakulum", (c) => `Du kannst diese Karte für ${c} wirken, wenn du sie ziehst, falls es die erste Karte ist, die du in diesem Zug gezogen hast.`, "Du kannst diese Karte für ihre Mirakulum-Kosten wirken, wenn du sie ziehst, falls es die erste Karte ist, die du in diesem Zug gezogen hast."),
  MOBILIZE: counted("When this creature attacks, create {%1$d:tapped and attacking 1/1 red Warrior creature token}. Sacrifice them at the beginning of the next end step.", "druck", "Mobilize", "Mobilisieren", (n) => `Wenn diese Kreatur angreift, erzeuge ${n === "1" ? "einen getappten und angreifenden 1/1 roten Krieger-Kreaturenspielstein" : `${zahl(n)} getappte und angreifende 1/1 rote Krieger-Kreaturenspielsteine`}. Opfere ${n === "1" ? "ihn" : "sie"} zu Beginn des nächsten Endsegments.`),
  MODULAR: { forge: "This creature enters with {%d:+1/+1 counter} on it. When it dies, you may put its +1/+1 counters on target artifact creature.", source: "druck", name: "Bausteine", general: "Dies kommt mit +1/+1-Marken ins Spiel. Wenn es stirbt, kannst du seine +1/+1-Marken auf eine Artefaktkreatur deiner Wahl legen.", forms: modularForms() },
  MORE_THAN_MEETS_THE_EYE: priced("You may cast this card converted for %s.", "openmana", "More Than Meets the Eye", "Mehr als man sieht", (c) => `Du kannst diese Karte umgewandelt für ${c} wirken.`, "Du kannst diese Karte umgewandelt für ihre angegebenen Kosten wirken."),
  MORPH: priced("You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.", "druck", "Morph", "Morph", (c) => `Du kannst diese Karte verdeckt für {3} als eine 2/2 Kreatur wirken. Decke sie zu einem beliebigen Zeitpunkt für ${c} auf.`, "Du kannst diese Karte verdeckt für {3} als eine 2/2 Kreatur wirken. Decke sie zu einem beliebigen Zeitpunkt für ihre Morph-Kosten auf."),
  MULTIKICKER: priced("You may pay an additional %s any number of times as you cast this spell.", "druck", "Multikicker", "Multibonus", (c) => `Du kannst zusätzlich beliebig oft ${c} bezahlen, sowie du diesen Zauberspruch wirkst.`, "Du kannst zusätzlich beliebig oft die Multibonus-Kosten bezahlen, sowie du diesen Zauberspruch wirkst."),
  MUTATE: priced("If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.", "druck", "Mutate", "Mutation", (c) => `Falls du diesen Zauberspruch für ${c} wirkst, lege ihn auf oder unter eine Nicht-Mensch-Kreatur deiner Wahl, die du besitzt. Sie mutieren zur oben liegenden Kreatur mit zusätzlich allen Fähigkeiten der darunter liegenden Karten.`, "Falls du diesen Zauberspruch für seine Mutationskosten wirkst, lege ihn auf oder unter eine Nicht-Mensch-Kreatur deiner Wahl, die du besitzt. Sie mutieren zur oben liegenden Kreatur mit zusätzlich allen Fähigkeiten der darunter liegenden Karten."),
  MYRIAD: simple("Whenever this creature attacks, for each opponent other than defending player, you may create a token that's a copy of this creature that's tapped and attacking that player or a planeswalker they control. Exile the tokens at end of combat.", "druck", "Myriad", "Myriade", "Immer wenn diese Kreatur angreift, kannst du für jeden Gegner außer dem verteidigenden Spieler einen Spielstein erzeugen, der eine Kopie dieser Kreatur ist und getappt und jenen Gegner oder einen seiner Planeswalker angreifend ins Spiel kommt. Schicke die Spielsteine am Ende des Kampfes ins Exil."),
  NIGHTBOUND: simple("If a player casts at least two spells during their own turn, it becomes day next turn.", "druck", "Nightbound", "Nachtaktiv", "Falls ein Spieler in seinem eigenen Zug zwei oder mehr Zaubersprüche wirkt, wird es im nächsten Zug Tag."),
  NINJUTSU: priced("%s, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your %s tapped and attacking.", "druck", "Ninjutsu", "Ninjutsu", (c) => `${c}, bringe einen ungeblockten Angreifer, den du kontrollierst, auf die Hand zurück: Bringe diese Karte aus deiner Hand getappt und angreifend ins Spiel.`, "Bezahle die Ninjutsu-Kosten und bringe einen ungeblockten Angreifer, den du kontrollierst, auf die Hand zurück: Bringe diese Karte getappt und angreifend ins Spiel.", (p) => { const r = p.reminder; return r.includes("from your hand tapped") }),
  OUTLAST: priced("%s, {T}: Put a +1/+1 counter on this creature. Outlast only as a sorcery.", "druck", "Outlast", "Standhaft", (c) => `${c}, {T}: Lege eine +1/+1-Marke auf diese Kreatur. Spiele Standhaft wie eine Hexerei.`, "Bezahle die Standhaft-Kosten und tappe diese Kreatur: Lege eine +1/+1-Marke auf sie. Spiele Standhaft wie eine Hexerei."),
  OFFERING: { forge: "You may cast this card any time you could cast an instant by sacrificing a %1$s and paying the difference in mana costs between this and the sacrificed %1$s. Mana cost includes color.", source: "openmana", name: "Opfergabe", general: "Du kannst diese Karte zu jedem Zeitpunkt wirken, zu dem du einen Spontanzauber wirken könntest, indem du ein Permanent der genannten Art opferst und die Differenz der Manakosten zwischen beiden bezahlst. Die Manakosten schließen die Farbe ein.", forms: [] },
  OFFSPRING: priced("You may pay an additional %s as you cast this spell. If you do, when this creature enters, create a 1/1 token copy of it.", "druck", "Offspring", "Nachwuchs", (c) => `Du kannst zusätzlich ${c} bezahlen, sowie du diesen Zauberspruch wirkst. Falls du dies tust, erzeuge, wenn diese Kreatur ins Spiel kommt, einen 1/1 Spielstein, der eine Kopie von ihr ist.`, "Du kannst zusätzlich die Nachwuchs-Kosten bezahlen, sowie du diesen Zauberspruch wirkst. Falls du dies tust, erzeuge, wenn diese Kreatur ins Spiel kommt, einen 1/1 Spielstein, der eine Kopie von ihr ist."),
  OVERLOAD: priced("You may cast this spell for its overload cost. If you do, change its text by replacing all instances of \"target\" with \"each.\"", "druck", "Overload", "Überlast", (c) => `Du kannst diesen Zauberspruch für ${c} wirken. Falls du dies tust, ersetze in seinem Text jedes „deiner Wahl“-Ziel durch „jede“ bzw. „jedes“.`, "Du kannst diesen Zauberspruch für seine Überlast-Kosten wirken. Falls du dies tust, ersetze in seinem Text jedes „deiner Wahl“-Ziel durch „jede“ bzw. „jedes“."),
  PARADIGM: simple("Then exile this spell. After you first resolve a spell with this name, you may cast a copy of it from exile without paying its mana cost at the beginning of each of your first main phases.", "druck", "Paradigm", "Paradigma", "Schicke diesen Zauberspruch danach ins Exil. Nachdem du zum ersten Mal einen Zauberspruch mit diesem Namen verrechnet hast, kannst du zu Beginn jeder deiner ersten Hauptphasen eine Kopie davon aus dem Exil wirken, ohne ihre Manakosten zu bezahlen."),
  PARTNER: simple("You can have two commanders if both have partner.", "druck", "Partner", "Partner", "Du kannst zwei Kommandeure haben, falls beide Partner haben.", "Du kannst zwei Kommandeure haben, falls beide diese Fähigkeit haben."),
  PARTNER_WITH: { forge: "When this creature enters, target player may put %s into their hand from their library, then shuffle.", source: "druck", name: "Partner von", general: "Wenn diese Kreatur ins Spiel kommt, kann ein Spieler deiner Wahl die genannte Partnerkarte aus seiner Bibliothek auf seine Hand nehmen und danach mischen.", forms: [] },
  PERSIST: simple("When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter on it.", "druck", "Persist", "Beharrlichkeit", "Wenn diese Kreatur stirbt und falls keine -1/-1-Marke auf ihr lag, bringe sie mit einer -1/-1-Marke unter der Kontrolle ihres Besitzers ins Spiel zurück."),
  PHASING: simple("This phases in or out before you untap during each of your untap steps. While it's phased out, it's treated as though it doesn't exist.", "openmana", "Phasing", "Phasing", "Dies phast vor dem Enttappen in jedem deiner Enttappsegmente ein oder aus. Solange es ausgephast ist, wird es behandelt, als gäbe es es nicht."),
  PLOT: priced("You may pay %s and exile this card from your hand. Cast it as a sorcery on a later turn without paying its mana cost. Plot only as a sorcery.", "druck", "Plot", "Aushecken", (c) => `Du kannst ${c} bezahlen und diese Karte aus deiner Hand ins Exil schicken. Wirke sie in einem späteren Zug wie eine Hexerei, ohne ihre Manakosten zu bezahlen. Spiele Aushecken wie eine Hexerei.`, "Du kannst die Aushecken-Kosten bezahlen und diese Karte aus deiner Hand ins Exil schicken. Wirke sie in einem späteren Zug wie eine Hexerei, ohne ihre Manakosten zu bezahlen. Spiele Aushecken wie eine Hexerei."),
  POISONOUS: counted("Whenever this creature deals combat damage to a player, that player gets {%d:poison counter}.", "openmana", "Poisonous", "Giftig", (n) => `Immer wenn diese Kreatur einem Spieler Kampfschaden zufügt, erhält jener Spieler ${n === "1" ? "eine Giftmarke" : `${zahl(n)} Giftmarken`}.`),
  PROTECTION: { forge: "This creature can't be blocked, targeted, dealt damage, or equipped/enchanted by %s.", source: "druck", name: "Schutz", general: "Diese Kreatur kann von allem mit der genannten Eigenschaft nicht geblockt, nicht als Ziel bestimmt, nicht verletzt und nicht verzaubert oder ausgerüstet werden.", forms: protectionForms() },
  PROTOTYPE: priced("You may cast this spell with different mana cost, color, and size. It keeps its abilities and types.", "openmana", "Prototype", "Prototyp", (_c) => "Du kannst diesen Zauberspruch mit anderen Manakosten, anderer Farbe und anderer Größe wirken. Er behält seine Fähigkeiten und Typen.", "Du kannst diesen Zauberspruch mit anderen Manakosten, anderer Farbe und anderer Größe wirken. Er behält seine Fähigkeiten und Typen."),
  PROVOKE: simple("Whenever this creature attacks, you may have target creature defending player controls untap and block it if able.", "druck", "Provoke", "Provozieren", "Immer wenn diese Kreatur angreift, kannst du eine Kreatur deiner Wahl, die der verteidigende Spieler kontrolliert, enttappen lassen; sie blockt diese Kreatur, falls möglich."),
  PROWESS: simple("Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.", "druck", "Prowess", "Bravour", "Immer wenn du einen Nichtkreatur-Zauberspruch wirkst, erhält diese Kreatur +1/+1 bis zum Ende des Zuges."),
  PROWL: priced("You may pay %s rather than pay this spell's mana cost if a player was dealt combat damage this turn by a source that, at the time it dealt that damage, was under your control and had any of this spell's creature types.", "druck", "Prowl", "Beutezug", (c) => `Du kannst ${c} statt der Manakosten dieses Zauberspruchs bezahlen, falls einem Spieler in diesem Zug Kampfschaden von einer Quelle zugefügt wurde, die du damals kontrolliert hast und die einen Kreaturentyp dieses Zauberspruchs hatte.`, "Du kannst die Beutezug-Kosten statt der Manakosten dieses Zauberspruchs bezahlen, falls einem Spieler in diesem Zug Kampfschaden von einer Quelle zugefügt wurde, die du damals kontrolliert hast und die einen Kreaturentyp dieses Zauberspruchs hatte."),
  RAMPAGE: counted("Whenever this creature becomes blocked, it gets +%1$d/+%1$d until end of turn for each creature blocking it beyond the first.", "druck", "Rampage", "Raserei", (n) => `Immer wenn diese Kreatur geblockt wird, erhält sie bis zum Ende des Zuges +${n}/+${n} für jede Kreatur außer der ersten, die sie blockt.`),
  RAVENOUS: simple("This creature enters with X +1/+1 counters on it. If X is 5 or more, draw a card when it enters.", "druck", "Ravenous", "Unersättlich", "Diese Kreatur kommt mit X +1/+1-Marken ins Spiel. Falls X gleich 5 oder mehr ist, ziehe eine Karte, wenn sie ins Spiel kommt."),
  REACH: simple("This creature can block creatures with flying.", "druck", "Reach", "Reichweite", "Diese Kreatur kann fliegende Kreaturen blocken."),
  READ_AHEAD: simple("Chapter abilities of this Saga can’t trigger the turn it entered the battlefield unless it has exactly the number of lore counters on it specified in the chapter symbol of that ability.", "druck", "Read ahead", "Überblättern", "Kapitelfähigkeiten dieser Saga lösen in dem Zug, in dem sie ins Spiel kam, nur aus, falls genau so viele Kapitelmarken auf ihr liegen, wie das Kapitelsymbol angibt."),
  REBOUND: simple("If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, you may cast this card from exile without paying its mana cost.", "druck", "Rebound", "Abprall", "Falls du diesen Zauberspruch aus deiner Hand wirkst, schicke ihn ins Exil, sowie er verrechnet wird. Zu Beginn deines nächsten Versorgungssegments kannst du diese Karte aus dem Exil wirken, ohne ihre Manakosten zu bezahlen."),
  RECOVER: priced("When a creature is put into your graveyard from the battlefield, you may pay %s. If you do, return this card from your graveyard to your hand. Otherwise, exile this card.", "druck", "Recover", "Bergung", (c) => `Wenn eine Kreatur aus dem Spiel auf deinen Friedhof gelegt wird, kannst du ${c} bezahlen. Falls du dies tust, bringe diese Karte aus deinem Friedhof auf deine Hand zurück. Schicke sie andernfalls ins Exil.`, "Wenn eine Kreatur aus dem Spiel auf deinen Friedhof gelegt wird, kannst du die Bergungskosten bezahlen. Falls du dies tust, bringe diese Karte aus deinem Friedhof auf deine Hand zurück. Schicke sie andernfalls ins Exil."),
  RECONFIGURE: priced("%s: Attach to target creature you control; or unattach from a creature. Reconfigure only as a sorcery. While attached, this isn't a creature.", "druck", "Reconfigure", "Rekonfigurieren", (c) => `${c}: Lege diese Karte an eine Kreatur deiner Wahl an, die du kontrollierst, oder löse sie von einer Kreatur. Spiele Rekonfigurieren wie eine Hexerei. Solange sie angelegt ist, ist sie keine Kreatur.`, "Bezahle die Rekonfigurieren-Kosten: Lege diese Karte an eine Kreatur deiner Wahl an, die du kontrollierst, oder löse sie von einer Kreatur. Spiele Rekonfigurieren wie eine Hexerei. Solange sie angelegt ist, ist sie keine Kreatur."),
  REFLECT: priced("As this enters, each opponent may pay %s. When they do, they create a token copy of this except it lacks this ability.", "openmana", "Reflect", "Spiegeln", (c) => `Sowie dies ins Spiel kommt, kann jeder Gegner ${c} bezahlen. Wenn er dies tut, erzeugt er einen Spielstein, der eine Kopie hiervon ist, außer dass er diese Fähigkeit nicht hat.`, "Sowie dies ins Spiel kommt, kann jeder Gegner die Spiegeln-Kosten bezahlen. Wenn er dies tut, erzeugt er einen Spielstein, der eine Kopie hiervon ist, außer dass er diese Fähigkeit nicht hat."),
  REINFORCE: pricedCounted("%s, Discard this card: Put {%d:+1/+1 counter} on target creature.", "druck", "Reinforce", "Unterstützung", (n, c) => `${c}, wirf diese Karte ab: Lege ${marken(n)} auf eine Kreatur deiner Wahl.`, "Bezahle die Unterstützungskosten und wirf diese Karte ab: Lege die genannte Anzahl +1/+1-Marken auf eine Kreatur deiner Wahl."),
  RENOWN: counted("When this creature deals combat damage to a player, if it isn't renowned, put {%d:+1/+1 counter} on it and it becomes renowned.", "druck", "Renown", "Ruhm", (n) => `Wenn diese Kreatur einem Spieler Kampfschaden zufügt und falls sie nicht ruhmvoll ist, lege ${marken(n)} auf sie und sie wird ruhmvoll.`),
  REPLICATE: priced("As an additional cost to cast this spell, you may pay %s any number of times. If you do, copy it that many times. You may choose new targets for the copies.", "druck", "Replicate", "Reproduktion", (c) => `Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du beliebig oft ${c} bezahlen. Falls du dies tust, kopiere ihn entsprechend oft. Du kannst neue Ziele für die Kopien bestimmen.`, "Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du die Reproduktionskosten beliebig oft bezahlen. Falls du dies tust, kopiere ihn entsprechend oft. Du kannst neue Ziele für die Kopien bestimmen."),
  RETRACE: simple("You may cast this card from your graveyard by discarding a land card in addition to paying its other costs.", "druck", "Retrace", "Zurückverfolgen", "Du kannst diese Karte aus deinem Friedhof wirken, indem du zusätzlich zu ihren anderen Kosten eine Länderkarte abwirfst."),
  RIOT: simple("This creature enters with your choice of a +1/+1 counter or haste.", "druck", "Riot", "Aufruhr", "Du bestimmst, ob diese Kreatur mit einer +1/+1-Marke oder mit Eile ins Spiel kommt."),
  RIPPLE: counted("When you cast this spell, you may reveal the top {%d:card} of your library. You may cast any of those cards with the same name as this spell without paying their mana costs. Put the rest on the bottom of your library in any order.", "druck", "Ripple", "Wallung", (n) => `Wenn du diesen Zauberspruch wirkst, kannst du die obersten ${n === "1" ? "Karte" : `${zahl(n)} Karten`} deiner Bibliothek aufdecken. Du kannst jede davon mit dem gleichen Namen wie dieser Zauberspruch wirken, ohne ihre Manakosten zu bezahlen. Lege den Rest in beliebiger Reihenfolge unter deine Bibliothek.`),
  SADDLE: counted("Tap any number of other creatures you control with total power %1$d or more: This Mount becomes saddled until end of turn. Saddle only as a sorcery.", "druck", "Saddle", "Aufsatteln", (n) => `Tappe eine beliebige Anzahl anderer Kreaturen, die du kontrollierst und die zusammen Stärke ${n} oder mehr haben: Dieses Reittier ist bis zum Ende des Zuges gesattelt. Spiele Aufsatteln wie eine Hexerei.`),
  SCAVENGE: priced("%s, Exile this card from your graveyard: Put a number of +1/+1 counters equal to this card's power on target creature. Scavenge only as a sorcery.", "druck", "Scavenge", "Ausplündern", (c) => `${c}, schicke diese Karte aus deinem Friedhof ins Exil: Lege so viele +1/+1-Marken, wie die Stärke dieser Karte beträgt, auf eine Kreatur deiner Wahl. Spiele Ausplündern wie eine Hexerei.`, "Bezahle die Ausplündern-Kosten und schicke diese Karte aus deinem Friedhof ins Exil: Lege so viele +1/+1-Marken, wie die Stärke dieser Karte beträgt, auf eine Kreatur deiner Wahl. Spiele Ausplündern wie eine Hexerei."),
  SHADOW: simple("This creature can block or be blocked by only creatures with shadow.", "druck", "Shadow", "Irrealität", "Diese Kreatur kann nur Kreaturen mit Irrealität blocken und nur von solchen geblockt werden."),
  SHROUD: simple("This can't be the target of spells or abilities.", "druck", "Shroud", "Verhüllt", "Dies kann nicht das Ziel von Zaubersprüchen oder Fähigkeiten sein."),
  SKULK: simple("This creature can't be blocked by creatures with greater power.", "druck", "Skulk", "Schleichen", "Diese Kreatur kann von Kreaturen mit größerer Stärke nicht geblockt werden."),
  SNEAK: priced("You may cast this spell for %s if you also return an unblocked attacker you control to hand during the declare blockers step.", "druck", "Sneak", "Finte", (c) => `Du kannst diesen Zauberspruch für ${c} wirken, falls du während des Blocker-deklarieren-Segments zusätzlich einen deiner ungeblockten Angreifer auf die Hand zurückbringst.`, "Du kannst diesen Zauberspruch für seine Finte-Kosten wirken, falls du während des Blocker-deklarieren-Segments zusätzlich einen deiner ungeblockten Angreifer auf die Hand zurückbringst."),
  SOULBOND: simple("You may pair this creature with another unpaired creature when either enters. They remain paired for as long as you control both of them.", "druck", "Soulbond", "Seelengebunden", "Du kannst diese Kreatur mit einer anderen ungebundenen Kreatur verbinden, wenn eine von beiden ins Spiel kommt. Sie bleiben verbunden, solange du beide kontrollierst."),
  SOULSHIFT: counted("When this creature dies, you may return target Spirit card with mana value %d or less from your graveyard to your hand.", "druck", "Soulshift", "Seelenwanderung", (n) => `Wenn diese Kreatur stirbt, kannst du eine Geist-Karte deiner Wahl mit Manabetrag ${n} oder weniger aus deinem Friedhof auf deine Hand zurückbringen.`),
  SPACE_SCULPTOR: simple("CARDNAME divides the battlefield into alpha, beta, and gamma sectors. If a creature isn't assigned to a sector, its controller assigns it to one. Opponents assign first.", "openmana", "Space sculptor", "Raumbildner", "Diese Karte teilt das Spielfeld in die Sektoren Alpha, Beta und Gamma. Ist eine Kreatur keinem Sektor zugeordnet, ordnet ihr Beherrscher sie einem zu; Gegner ordnen zuerst zu."),
  SPECIALIZE: priced("%s, Choose a color, discard a card of that color or associated basic land type: This card perpetually specializes into that color. Activate only as a sorcery.", "openmana", "Specialize", "Spezialisieren", (c) => `${c}, bestimme eine Farbe und wirf eine Karte dieser Farbe oder des zugehörigen Standardlandtyps ab: Diese Karte spezialisiert sich dauerhaft auf diese Farbe. Aktiviere dies nur wie eine Hexerei.`, "Bezahle die Spezialisieren-Kosten, bestimme eine Farbe und wirf eine Karte dieser Farbe oder des zugehörigen Standardlandtyps ab: Diese Karte spezialisiert sich dauerhaft auf diese Farbe. Aktiviere dies nur wie eine Hexerei."),
  SPECTACLE: priced("You may cast this spell for its spectacle cost rather than its mana cost if an opponent lost life this turn.", "druck", "Spectacle", "Spektakel", (c) => `Du kannst diesen Zauberspruch für ${c} statt seiner Manakosten wirken, falls ein Gegner in diesem Zug Lebenspunkte verloren hat.`, "Du kannst diesen Zauberspruch für seine Spektakel-Kosten statt seiner Manakosten wirken, falls ein Gegner in diesem Zug Lebenspunkte verloren hat."),
  SPLICE: { forge: "As you cast an %2$s spell, you may reveal this card from your hand and pay its splice cost. If you do, add this card's effects to that spell.", source: "druck", name: "Kopplung", general: "Sowie du einen Zauberspruch der genannten Art wirkst, kannst du diese Karte aus deiner Hand offen vorzeigen und ihre Kopplungskosten bezahlen. Falls du dies tust, füge dem Zauberspruch die Effekte dieser Karte hinzu.", forms: spliceForms() },
  SPLIT_SECOND: simple("As long as this spell is on the stack, players can't cast other spells or activate abilities that aren't mana abilities.", "druck", "Split second", "Sekundenbruchteil", "Solange dieser Zauberspruch auf dem Stapel liegt, können Spieler keine anderen Zaubersprüche wirken und keine Fähigkeiten aktivieren, die keine Manafähigkeiten sind."),
  SPREE: simple("Choose one or more additional costs.", "druck", "Spree", "Exzess", "Bestimme einen oder mehrere Modi und bezahle jeweils deren zusätzliche Kosten."),
  SQUAD: priced("As an additional cost to cast this spell, you may pay %s any number of times. When this creature enters, create that many tokens that are copies of it.", "druck", "Squad", "Trupp", (c) => `Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du beliebig oft ${c} bezahlen. Wenn diese Kreatur ins Spiel kommt, erzeuge entsprechend viele Spielsteine, die Kopien von ihr sind.`, "Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du die Trupp-Kosten beliebig oft bezahlen. Wenn diese Kreatur ins Spiel kommt, erzeuge entsprechend viele Spielsteine, die Kopien von ihr sind."),
  START_YOUR_ENGINES: simple("If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.", "openmana", "Start your engines", "Motoren an!", "Hast du kein Tempo, beginnt es bei 1. Es steigt in jedem deiner Züge einmal, wenn ein Gegner Lebenspunkte verliert. Das höchste Tempo ist 4."),
  STARTING_INTENSITY: counted("", "openmana", "Starting intensity", "Startintensität", (n) => `Diese Karte beginnt die Partie mit Intensität ${n}.`),
  STATION: counted("Tap another creature you control: Put charge counters equal to its power on this Spacecraft. Station only as a sorcery. It’s an artifact creature at %d+.", "openmana", "Station", "Station", (n) => `Tappe eine andere Kreatur, die du kontrollierst: Lege so viele Ladungsmarken auf dieses Raumschiff, wie ihre Stärke beträgt. Spiele Station wie eine Hexerei. Ab ${n} Ladungsmarken ist es eine Artefaktkreatur.`),
  STORIED: simple("If you control three or more artifacts, legendaries, and/or Sagas, you have an enduring story for the rest of the game.", "druck", "Storied", "Sagenumwoben", "Falls du drei oder mehr Artefakte, legendäre Permanente und/oder Sagen kontrollierst, hast du für den Rest der Partie einen zeitlosen Mythos."),
  STORM: simple("When you cast this spell, copy it for each other spell that was cast before it this turn. You may choose new targets for the copies.", "druck", "Storm", "Sturm", "Wenn du diesen Zauberspruch wirkst, kopiere ihn einmal für jeden anderen Zauberspruch, der in diesem Zug vor ihm gewirkt wurde. Du kannst neue Ziele für die Kopien bestimmen."),
  STRIVE: priced("CARDNAME costs %s more to cast for each target beyond the first.", "openmana", "Strive", "Bestreben", (c) => `Dieser Zauberspruch kostet beim Wirken für jedes Ziel nach dem ersten ${c} mehr.`, "Dieser Zauberspruch kostet beim Wirken für jedes Ziel nach dem ersten die Bestreben-Kosten mehr."),
  SUNBURST: simple("This enters with either a +1/+1 or charge counter on it for each color of mana spent to cast it based on whether it's a creature.", "druck", "Sunburst", "Sonneneruption", "Dies kommt für jede Farbe des Manas, das für sein Wirken ausgegeben wurde, mit einer Marke ins Spiel: einer +1/+1-Marke, falls es eine Kreatur ist, sonst einer Ladungsmarke."),
  SURGE: priced("You may cast this spell for its surge cost if you or a teammate has cast another spell this turn.", "druck", "Surge", "Schwall", (c) => `Du kannst diesen Zauberspruch für ${c} wirken, falls du oder ein Teamkamerad in diesem Zug bereits einen anderen Zauberspruch gewirkt hat.`, "Du kannst diesen Zauberspruch für seine Schwall-Kosten wirken, falls du oder ein Teamkamerad in diesem Zug bereits einen anderen Zauberspruch gewirkt hat."),
  SUSPEND: pricedCounted("If you could begin to cast this card by putting it onto the stack from your hand, you may pay %s and exile it with {%d:time counter} on it. At the beginning of your upkeep, remove a time counter. When the last is removed, play it without paying its mana cost. If you cast a creature spell this way, it gains haste until you lose control of the spell or the permanent it becomes.", "druck", "Suspend", "Aussetzen", (n, c) => `Statt diese Karte aus deiner Hand zu wirken, kannst du ${c} bezahlen und sie mit ${n === "1" ? "einer Zeitmarke" : `${zahl(n)} Zeitmarken`} ins Exil schicken. Entferne zu Beginn deines Versorgungssegments eine Zeitmarke von ihr. Wenn die letzte entfernt wird, wirke sie, ohne ihre Manakosten zu bezahlen. Wirkst du so eine Kreatur, hat sie Eile.`, "Statt diese Karte aus deiner Hand zu wirken, kannst du ihre Aussetzen-Kosten bezahlen und sie mit der genannten Anzahl Zeitmarken ins Exil schicken. Entferne zu Beginn deines Versorgungssegments eine Zeitmarke von ihr. Wenn die letzte entfernt wird, wirke sie, ohne ihre Manakosten zu bezahlen. Wirkst du so eine Kreatur, hat sie Eile."),
  TEAMWORK: counted("As an additional cost to cast this spell, you may tap any number of creatures you control with total power %d or more.", "druck", "Teamwork", "Teamwork", (n) => `Als zusätzliche Kosten, um diesen Zauberspruch zu wirken, kannst du eine beliebige Anzahl an Kreaturen tappen, die du kontrollierst und die zusammen Stärke ${n} oder mehr haben.`),
  TIERED: simple("Choose one additional cost.", "druck", "Tiered", "Stufenmagie", "Bestimme einen Modus und bezahle dessen zusätzliche Kosten."),
  TOXIC: counted("Players dealt combat damage by this creature also get {%d:poison counter}.", "druck", "Toxic", "Toxisch", (n) => `Spieler, denen von dieser Kreatur Kampfschaden zugefügt wird, erhalten außerdem ${n === "1" ? "eine Giftmarke" : `${zahl(n)} Giftmarken`}.`),
  TRAINING: simple("Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature.", "druck", "Training", "Training", "Immer wenn diese Kreatur zusammen mit einer Kreatur mit größerer Stärke angreift, lege eine +1/+1-Marke auf diese Kreatur."),
  TRAMPLE: { forge: "This creature can deal excess combat damage to the player or planeswalker it's attacking.", source: "druck", name: "Trampelschaden", general: "Diese Kreatur kann überschüssigen Kampfschaden dem Spieler oder Planeswalker zufügen, den sie angreift.", forms: trampleForms() },
  TRANSFIGURE: priced("%s, Sacrifice this creature: Search your library for a creature card with the same mana value as this creature and put that card onto the battlefield, then shuffle. Transfigure only as a sorcery.", "druck", "Transfigure", "Umgestalten", (c) => `${c}, opfere diese Kreatur: Durchsuche deine Bibliothek nach einer Kreaturenkarte mit dem gleichen Manabetrag wie diese Kreatur, bringe sie ins Spiel und mische danach. Spiele Umgestalten wie eine Hexerei.`, "Bezahle die Umgestalten-Kosten und opfere diese Kreatur: Durchsuche deine Bibliothek nach einer Kreaturenkarte mit dem gleichen Manabetrag wie diese Kreatur, bringe sie ins Spiel und mische danach. Spiele Umgestalten wie eine Hexerei."),
  TRANSMUTE: priced("%s, Discard this card: Search your library for a card with the same mana value as this card, reveal it, and put it into your hand, then shuffle. Transmute only as a sorcery.", "druck", "Transmute", "Transmutation", (c) => `${c}, wirf diese Karte ab: Durchsuche deine Bibliothek nach einer Karte mit dem gleichen Manabetrag wie diese Karte, zeige sie offen vor, nimm sie auf deine Hand und mische danach. Spiele Transmutation wie eine Hexerei.`, "Bezahle die Transmutationskosten und wirf diese Karte ab: Durchsuche deine Bibliothek nach einer Karte mit dem gleichen Manabetrag wie diese Karte, zeige sie offen vor, nimm sie auf deine Hand und mische danach. Spiele Transmutation wie eine Hexerei."),
  TRIBUTE: counted("As this creature enters, an opponent of your choice may put {%d:+1/+1 counter} on it.", "druck", "Tribute", "Tribut", (n) => `Sowie diese Kreatur ins Spiel kommt, kann ein Gegner deiner Wahl ${marken(n)} auf sie legen.`),
  TYPECYCLING: { forge: "%s, Discard this card: Search your library for %s, reveal it, put it into your hand, then shuffle.", source: "druck", name: "Typumwandlung", general: "Bezahle die Umwandlungskosten und wirf diese Karte ab: Durchsuche deine Bibliothek nach einer Karte der genannten Art, zeige sie offen vor, nimm sie auf deine Hand und mische danach.", forms: typecyclingForms() },
  UMBRA_ARMOR: simple("If enchanted permanent would be destroyed, instead remove all damage marked on it and destroy this Aura.", "druck", "Umbra armor", "Totembeistand", "Falls das verzauberte Permanent zerstört würde, entferne stattdessen allen Schaden von ihm und zerstöre diese Aura."),
  UNDAUNTED: simple("This spell costs {1} less to cast for each opponent.", "druck", "Undaunted", "Unverzagt", "Dieser Zauberspruch kostet beim Wirken für jeden Gegner {1} weniger."),
  UNDYING: simple("When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter on it.", "druck", "Undying", "Unverwüstlich", "Wenn diese Kreatur stirbt und falls keine +1/+1-Marke auf ihr lag, bringe sie mit einer +1/+1-Marke unter der Kontrolle ihres Besitzers ins Spiel zurück."),
  UNEARTH: priced("%s: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.", "druck", "Unearth", "Exhumieren", (c) => `${c}: Bringe diese Karte aus deinem Friedhof ins Spiel zurück. Sie erhält Eile. Schicke sie zu Beginn des nächsten Endsegments oder falls sie das Spiel verlassen würde ins Exil. Spiele Exhumieren wie eine Hexerei.`, "Bezahle die Exhumieren-Kosten: Bringe diese Karte aus deinem Friedhof ins Spiel zurück. Sie erhält Eile. Schicke sie zu Beginn des nächsten Endsegments oder falls sie das Spiel verlassen würde ins Exil. Spiele Exhumieren wie eine Hexerei."),
  UNLEASH: simple("You may have this creature enter with a +1/+1 counter on it. It can't block as long as it has a +1/+1 counter on it.", "druck", "Unleash", "Entfesselt", "Du kannst diese Kreatur mit einer +1/+1-Marke ins Spiel kommen lassen. Sie kann nicht blocken, solange eine +1/+1-Marke auf ihr liegt."),
  VANISHING: { forge: "This permanent enters with {%d:time counter} on it. At the beginning of your upkeep, remove a time counter from it. When the last is removed, sacrifice it.", source: "druck", name: "Verschwinden", general: "Dieses Permanent kommt mit Zeitmarken ins Spiel. Entferne zu Beginn deines Versorgungssegments eine Zeitmarke von ihm. Wenn die letzte entfernt wird, opfere es.", forms: vanishingForms() },
  VIGILANCE: simple("Attacking doesn't cause this creature to tap.", "druck", "Vigilance", "Wachsamkeit", "Diese Kreatur wird beim Angreifen nicht getappt."),
  WARD: priced("Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player %s.", "druck", "Ward", "Abwehr", (c) => `Immer wenn dieses Permanent das Ziel eines Zauberspruchs oder einer Fähigkeit wird, den bzw. die ein Gegner kontrolliert, neutralisiere ihn bzw. sie, es sei denn, jener Spieler bezahlt ${c}.`, "Immer wenn dieses Permanent das Ziel eines Zauberspruchs oder einer Fähigkeit wird, den bzw. die ein Gegner kontrolliert, neutralisiere ihn bzw. sie, es sei denn, jener Spieler bezahlt die Abwehrkosten.", (p) => { const r = p.reminder; return r.endsWith("unless that player pays " + p.cost + ".") }),
  WARP: priced("You may cast this card from your hand for its warp cost. Exile this creature at the beginning of the next end step, then you may cast it from exile on a later turn.", "openmana", "Warp", "Warp", (c) => `Du kannst diese Karte für ${c} aus deiner Hand wirken. Schicke diese Kreatur zu Beginn des nächsten Endsegments ins Exil; danach kannst du sie in einem späteren Zug aus dem Exil wirken.`, "Du kannst diese Karte für ihre Warp-Kosten aus deiner Hand wirken. Schicke diese Kreatur zu Beginn des nächsten Endsegments ins Exil; danach kannst du sie in einem späteren Zug aus dem Exil wirken."),
  WEB_SLINGING: priced("You may cast this spell for %s if you also return a tapped creature you control to its owner’s hand.", "druck", "Web-slinging", "Netzschuss", (c) => `Du kannst diesen Zauberspruch für ${c} wirken, falls du zusätzlich eine getappte Kreatur, die du kontrollierst, auf die Hand ihres Besitzers zurückbringst.`, "Du kannst diesen Zauberspruch für seine Netzschuss-Kosten wirken, falls du zusätzlich eine getappte Kreatur, die du kontrollierst, auf die Hand ihres Besitzers zurückbringst."),
  WITHER: simple("This deals damage to creatures in the form of -1/-1 counters.", "druck", "Wither", "Verdorren", "Dies fügt Kreaturen Schaden in Form von -1/-1-Marken zu."),
  MAYFLASHCOST: priced("You may cast CARDNAME as though it had flash if you pay %s more to cast it.", "openmana", "MayFlashCost", "Aufblitzen gegen Aufpreis", (c) => `Du kannst diese Karte wirken, als hätte sie Aufblitzen, falls du beim Wirken zusätzlich ${c} bezahlst.`, "Du kannst diese Karte wirken, als hätte sie Aufblitzen, falls du beim Wirken die genannten Zusatzkosten bezahlst."),
  MAYFLASHSAC: simple("You may cast CARDNAME as though it had flash. If you cast it any time a sorcery couldn't have been cast, the controller of the permanent it becomes sacrifices it at the beginning of the next cleanup step.", "openmana", "MayFlashSac", "Aufblitzen mit Opfer", "Du kannst diese Karte wirken, als hätte sie Aufblitzen. Wirkst du sie zu einem Zeitpunkt, zu dem du keine Hexerei wirken könntest, opfert der Beherrscher des Permanents sie zu Beginn des nächsten Aufräumsegments."),
}

/** One box of the card view: a keyword the card has now, explained. */
export interface KeywordBox {
  /** Forge's keyword and form - stable for a list. */
  readonly key: string
  readonly name: string
  readonly text: string
  /** The language of name and text: German, or English where OpenMana has no German text (Forge's own words). */
  readonly lang: "de" | "en"
  /** Forge's concrete form in English, beside a German explanation that holds for every form of the keyword. */
  readonly forgeForm?: string
}

function partsOf(keyword: CardKeyword): KeywordParts {
  return { amount: keyword.amount, cost: keyword.cost, detail: keyword.detail, reminder: keyword.reminder }
}

/** The box of one keyword as Forge reports it: its German form, else its German name and explanation with Forge's form, else Forge's words. */
export function keywordBox(keyword: CardKeyword): KeywordBox {
  const key = `${keyword.keyword}|${keyword.title}`
  const entry = KEYWORD_TEXTS[keyword.keyword]
  if (entry === undefined) {
    return { key, name: keyword.title, text: keyword.reminder.trim() !== "" ? keyword.reminder : "Forge sendet zu diesem Schlüsselwort keinen Erklärungstext.", lang: "en" }
  }
  const parts = partsOf(keyword)
  const form = entry.forms.find((f) => f.title(parts) === keyword.title && (f.accept?.(parts) ?? true))
  if (form !== undefined) return { key, name: form.name(parts), text: form.text(parts), lang: "de" }
  return { key, name: entry.name, text: entry.general, lang: "de", forgeForm: keyword.title }
}

/** The boxes of a card's keywords in Forge's order, each explanation once; none without keywords. */
export function keywordBoxes(keywords: readonly CardKeyword[] | undefined): readonly KeywordBox[] {
  const seen = new Set<string>()
  const boxes: KeywordBox[] = []
  for (const keyword of keywords ?? []) {
    const box = keywordBox(keyword)
    const same = `${box.name}\u0000${box.text}\u0000${box.forgeForm ?? ""}`
    if (seen.has(same)) continue
    seen.add(same)
    boxes.push(box)
  }
  return boxes
}
