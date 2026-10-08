/*
 * The engine trace in the differential tests (prompt 05). The engine sends it
 * during a match that asks for it (diagnostics.trace, see the bridge's
 * EngineTrace): numbered checkpoints, each a complete snapshot of Forge's game
 * plus every event since the previous one - ids, English card keys, enum
 * names and numbers, never Forge's display texts.
 *
 * Here: comparing two traces entry by entry (any difference fails and is
 * reported with its place in the game), a digest, counts, and which parts of
 * the game a trace covers. Runs in the browser (diagnostics page) and in Node
 * (tests); no Node API.
 *
 * Test tooling, not the client: it reads game content (phases, purposes,
 * zones) to describe what a game exercised, which the client never does.
 */
import type { DiagnosticsTrace, TraceEvent, TraceQuestion, TraceSnapshot } from "../../protocol/src/index.ts";

export type TraceEntry = DiagnosticsTrace;

/** Where two traces first differ. */
export interface TraceDivergence {
  /** Number (n) of the first entry that differs or is missing. */
  entry: number;
  /** JSON path inside that entry, e.g. events[3].card or snapshot.players[1].battlefield[0].tapped. */
  path: string;
  /** The value in the reference trace (the JVM's); undefined if it has none. */
  reference: unknown;
  /** The value in the compared trace; undefined if it has none. */
  actual: unknown;
  /** Where in the game: turn, step, inputs read, checkpoint kind (from the reference entry if there is one). */
  context: string;
  /** The whole event or snapshot part around the difference, for the report. */
  referenceOwner?: unknown;
  actualOwner?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** JSON with object keys sorted (arrays keep their order): equal values give equal text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * The first difference between two JSON values in document order: objects
 * are compared regardless of key order, arrays element by element (a longer
 * array differs at the first extra element).
 */
export function firstDifference(a: unknown, b: unknown, path = ""): { path: string; a: unknown; b: unknown } | null {
  if (Object.is(a, b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (isObject(a) && isObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const key of keys) {
      const d = firstDifference(a[key], b[key], path ? `${path}.${key}` : key);
      if (d) return d;
    }
    return null;
  }
  return { path, a, b };
}

function describePlace(entry: TraceEntry | undefined): string {
  if (!entry) return "after the end of the other trace";
  const s = entry.snapshot;
  return `turn ${s.turn}${s.phase ? ` ${s.phase}` : ""}, ${entry.inputs} inputs read, checkpoint ${entry.at}`;
}

/** The event or snapshot element a path points into (events[3] or snapshot.players[1]), for a readable report. */
function owner(entry: TraceEntry | undefined, path: string): unknown {
  if (!entry) return undefined;
  const event = /^events\[(\d+)\]/.exec(path);
  if (event) return entry.events[Number(event[1])];
  const part = /^snapshot\.(players\[(\d+)\]|stack|combat|questions|gui)/.exec(path);
  if (part) {
    if (part[2] !== undefined) {
      const player = entry.snapshot.players[Number(part[2])];
      const zone = /^snapshot\.players\[\d+\]\.(\w+)(\[(\d+)\])?/.exec(path);
      if (player && zone && zone[1] && zone[3] !== undefined) {
        const list = (player as unknown as Record<string, unknown>)[zone[1]];
        if (Array.isArray(list)) return list[Number(zone[3])];
      }
      return player;
    }
    return (entry.snapshot as unknown as Record<string, unknown>)[part[1]!];
  }
  return undefined;
}

/**
 * Compares a trace as it arrives with a reference trace (the JVM's), entry
 * by entry. The first difference is kept; later entries are not compared
 * (after a difference the games have parted).
 */
export class TraceComparison {
  readonly #reference: readonly TraceEntry[];
  #compared = 0;
  #divergence: TraceDivergence | null = null;

  constructor(reference: readonly TraceEntry[]) {
    this.#reference = reference;
  }

  /** Entries compared so far. */
  get compared(): number {
    return this.#compared;
  }

  get divergence(): TraceDivergence | null {
    return this.#divergence;
  }

  /** The next entry of the compared trace; returns the divergence if this entry differs. */
  add(entry: TraceEntry): TraceDivergence | null {
    if (this.#divergence) return this.#divergence;
    const index = this.#compared;
    this.#compared++;
    const reference = this.#reference[index];
    if (!reference) {
      this.#divergence = { entry: index + 1, path: "", reference: undefined, actual: entry, context: `${describePlace(entry)} (the reference trace has only ${this.#reference.length} entries)` };
      return this.#divergence;
    }
    const d = firstDifference(reference, entry);
    if (d) {
      this.#divergence = {
        entry: index + 1,
        path: d.path,
        reference: d.a,
        actual: d.b,
        context: describePlace(reference),
        referenceOwner: owner(reference, d.path),
        actualOwner: owner(entry, d.path),
      };
    }
    return this.#divergence;
  }

  /** The compared trace is complete: the reference must not have more entries. */
  finish(): TraceDivergence | null {
    if (this.#divergence) return this.#divergence;
    if (this.#compared < this.#reference.length) {
      const missing = this.#reference[this.#compared];
      this.#divergence = { entry: this.#compared + 1, path: "", reference: missing, actual: undefined, context: `${describePlace(missing)} (the compared trace ends after ${this.#compared} entries)` };
    }
    return this.#divergence;
  }
}

function brief(value: unknown, max = 600): string {
  const text = value === undefined ? "(nothing)" : canonicalJson(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** One readable paragraph: where, what differs, and the surrounding event or snapshot part on both sides. */
export function describeDivergence(d: TraceDivergence, names: { reference: string; actual: string } = { reference: "JVM", actual: "Wasm" }): string {
  const lines = [`engine trace diverges at entry ${d.entry} (${d.context})${d.path ? ` at ${d.path}` : ""}: ${names.reference} ${brief(d.reference, 300)} / ${names.actual} ${brief(d.actual, 300)}`];
  if (d.referenceOwner !== undefined || d.actualOwner !== undefined) {
    lines.push(`  ${names.reference}: ${brief(d.referenceOwner)}`);
    lines.push(`  ${names.actual}: ${brief(d.actualOwner)}`);
  }
  return lines.join("\n");
}

/** A trace written one entry per line (JvmSmokeMain --trace). */
export function parseTraceLines(text: string): TraceEntry[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as TraceEntry);
}

/** Compares two complete traces. */
export function compareTraces(reference: readonly TraceEntry[], actual: readonly TraceEntry[]): TraceDivergence | null {
  const comparison = new TraceComparison(reference);
  for (const entry of actual) {
    if (comparison.add(entry)) break;
  }
  return comparison.finish();
}

/** SHA-256 (hex) over the canonical JSON of every entry, one per line. Equal traces, equal digest. */
export async function traceDigest(entries: readonly TraceEntry[]): Promise<string> {
  const text = entries.map((e) => canonicalJson(e)).join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface TraceStats {
  entries: number;
  events: number;
  checkpoints: Record<string, number>;
  eventKinds: Record<string, number>;
  /** Largest stack in any snapshot. */
  maxStack: number;
}

export function traceStats(entries: readonly TraceEntry[]): TraceStats {
  const checkpoints: Record<string, number> = {};
  const eventKinds: Record<string, number> = {};
  let events = 0;
  let maxStack = 0;
  for (const entry of entries) {
    checkpoints[entry.at] = (checkpoints[entry.at] ?? 0) + 1;
    maxStack = Math.max(maxStack, entry.snapshot.stack.length);
    for (const e of entry.events) {
      events++;
      eventKinds[e.e] = (eventKinds[e.e] ?? 0) + 1;
    }
  }
  return { entries: entries.length, events, checkpoints, eventKinds, maxStack };
}

/**
 * What a human-vs-AI trace can show the scripted player did or met, from
 * Forge's events, the bridge's decisions and the snapshots. "zone:<from>-><to>"
 * entries (any player) come on top of these.
 */
export const COVERAGE: Readonly<Record<string, string>> = {
  mulligan: "the player took a mulligan (Forge's mulligan event; London: cards put back)",
  land: "the player played a land",
  spell: "the player cast a spell",
  "priority-pass": "the player passed priority (OK on a priority question)",
  "priority-play": "the player played a card by tapping it at priority",
  "priority-response": "the player played a card at priority while the stack was not empty (an answer on top of it; prompt 16)",
  "priority-opponent-turn": "Forge gave the player priority in the opponent's turn (prompt 16)",
  "payment-auto": "a cost paid with Forge's automatic payment",
  "payment-manual": "a cost paid by tapping mana sources",
  "target-card": "a spell or ability of the player targeted a card",
  "target-player": "a spell or ability of the player targeted a player",
  "target-player-tap": "the player chose a player by tapping them (a player.tap Forge took in a selection; prompt 17)",
  "target-multi": "a spell or ability of the player went on the stack with two or more targets (prompt 17)",
  "payment-pool": "a cost paid with floating mana from the pool (a mana.use Forge took; prompt 17)",
  "payment-life": "life paid for mana by tapping the player during a payment (Phyrexian mana; prompt 17)",
  "cast-nested": "a blocking decision answered while the player's spell or ability was being put on the stack (mode, X, optional cost …; prompt 17)",
  trigger: "a triggered ability went on the stack",
  "stack-resolve": "a spell or ability resolved from the stack",
  "stack-response": "a spell or ability went on top of another one (stack depth 2 and more, resolved last in, first out)",
  attack: "the player declared attackers",
  "attack-planeswalker": "the player attacked a planeswalker or battle (a card as defender; prompt 18)",
  "attack-defender": "the player made another defender the defender by tapping it (a player.tap or card.tap Forge took while attackers were declared; prompt 18)",
  "attack-all": "the player declared every creature that could attack with Forge's Alpha Strike (prompt 18)",
  "attack-call-back": "the player took every declared attacker back with Forge's Call Back (prompt 18)",
  "attack-unavailable-sick": "Forge said a creature of the player could not attack because of summoning sickness (the state's attack; prompt 18)",
  "attack-unavailable-tapped": "Forge said a creature of the player could not attack because it was tapped (prompt 18)",
  "attack-unavailable-restricted": "Forge said a creature of the player could not attack because of a keyword or effect, e.g. defender (prompt 18)",
  block: "the player declared a blocker",
  "block-multi": "the player blocked two or more attackers at once (assigned blockers to attackers)",
  "block-double": "the player blocked one attacker with two or more creatures",
  "decision-choose": "a choice from a list (choose)",
  "decision-options": "a choice between options (options)",
  "decision-arrange": "cards put on top or bottom of a pile (arrange, e.g. scry)",
  "decision-confirm": "a yes/no question (confirm)",
  "decision-order": "an ordering (order)",
  "decision-distribute": "an amount distributed (distribute)",
  "combat-defender-assignment": "Forge accepted a combat distribution with positive damage to the defending player",
  "combat-lethal-assignment": "Forge accepted a distribution with its lethal-assignment prerequisites",
  "decision-input": "a number or text entered (input)",
  "decision-select": "cards selected on the table (select)",
  "question-withdrawn": "Forge withdrew a question",
  "input-rejected": "an input was rejected loudly",
  "state-request": "a state request was served",
  "end-win": "the game ended with the player winning",
  "end-loss": "the game ended with the player losing",
  "end-draw": "the game ended in a draw",
  "end-life": "a player lost by life",
  "end-poison": "a player lost by poison",
  "end-concede": "the player conceded",
  "commander-cast": "the player cast its commander from the command zone",
  "commander-tax": "the player cast its commander again (commander tax)",
  "commander-return": "the player's commander returned to the command zone",
  "commander-damage": "the player's commander dealt combat damage",
};

/**
 * What prompt 05 asks the differential fixtures to cover together: mulligan,
 * land/spell play, priority, mana/cost payment, targeting, stack, combat,
 * block assignment, zone movement, game end, and Commander - and since
 * prompt 16 the player's priority in the opponent's turn and answers on the
 * stack, since prompt 17 players chosen by tapping them, several targets,
 * mana from the pool, life for mana and decisions while a spell is cast, since
 * prompt 18 the declaration of attackers - a planeswalker attacked, the
 * defender switched, Alpha Strike and Call Back, and Forge's reasons why a
 * creature cannot attack (summoning sickness, tapped, an effect). The
 * fixtures (engine/fixtures/differential) name what each covers;
 * the union must contain all of these.
 */
export const REQUIRED_COVERAGE: readonly string[] = [
  "mulligan",
  "land",
  "spell",
  "priority-pass",
  "priority-play",
  "priority-response",
  "priority-opponent-turn",
  "payment-auto",
  "payment-manual",
  "target-card",
  "target-player",
  "target-player-tap",
  "target-multi",
  "payment-pool",
  "payment-life",
  "cast-nested",
  "trigger",
  "stack-resolve",
  "stack-response",
  "attack",
  "attack-planeswalker",
  "attack-defender",
  "attack-all",
  "attack-call-back",
  "attack-unavailable-sick",
  "attack-unavailable-tapped",
  "attack-unavailable-restricted",
  "block",
  "block-multi",
  "block-double",
  "combat-defender-assignment",
  "combat-lethal-assignment",
  "zone:Library->Hand",
  "zone:Hand->Battlefield",
  "zone:Hand->Stack",
  "zone:Stack->Graveyard",
  "zone:Battlefield->Graveyard",
  "end-win",
  "end-loss",
  "end-life",
  "end-concede",
  "commander-cast",
  "commander-tax",
  "commander-return",
  "commander-damage",
];

/** Whether the declaration of attackers at this checkpoint offers this player or card as a defender other than the current one. */
function isDefender(snapshot: TraceSnapshot | null, kind: "player" | "card", id: number | undefined): boolean {
  const attack = snapshot?.gui?.attack;
  if (attack === undefined || id === undefined) return false;
  const current = attack.defender;
  return attack.defenders.some((d) => d.kind === kind && d.id === id) && !(current !== null && current.kind === kind && current.id === id);
}

function zoneOf(ref: unknown): { zone: string; player: string } | null {
  if (typeof ref !== "string") return null;
  const i = ref.lastIndexOf(":");
  return i < 0 ? null : { zone: ref.slice(0, i), player: ref.slice(i + 1) };
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Counts, per coverage category, how often a human-vs-AI trace shows it. A
 * trace without a human seat (AI against AI) only yields the zone, stack,
 * trigger and end categories.
 */
export function traceCoverage(entries: readonly TraceEntry[]): Record<string, number> {
  const hits: Record<string, number> = {};
  const hit = (key: string) => {
    hits[key] = (hits[key] ?? 0) + 1;
  };
  const human = entries.find((e) => e.snapshot.human !== undefined && e.snapshot.human !== null)?.snapshot.human ?? null;
  const questions = new Map<number, TraceQuestion | TraceEvent>();
  const answers = new Map<number, Record<string, unknown>>();
  let open = new Map<number, TraceQuestion | TraceEvent>();
  /** Card, player and mana taps by input seq and what they were for; a rejected tap does not count. */
  const taps = new Map<number, readonly string[]>();
  /** The player tapped a card at priority and its spell or ability is not on the stack yet (the seq of that tap), else null. */
  let casting: number | null = null;
  let previous: TraceSnapshot | null = null;

  const openPurposes = () => new Set([...open.values()].filter((q) => q["kind"] === "buttons").map((q) => String(q["purpose"] ?? "")));

  for (const entry of entries) {
    if (previous) open = new Map((previous.questions ?? []).map((q) => [q.id, q]));
    for (const e of entry.events) {
      switch (e.e) {
        case "question": {
          const id = num(e["id"]);
          if (id !== undefined) {
            open.set(id, e);
            questions.set(id, e);
          }
          // Asked at this entry's checkpoint (the one before the next input): whose turn it is then.
          if (e["kind"] === "buttons" && e["purpose"] === "priority" && human !== null && entry.snapshot.active !== null && entry.snapshot.active !== human) {
            hit("priority-opponent-turn");
          }
          break;
        }
        case "withdrawn":
          open.delete(num(e["id"]) ?? -1);
          hit("question-withdrawn");
          break;
        case "answered": {
          const q = questions.get(num(e["id"]) ?? -1);
          if (q && q["blocking"] === true) hit(`decision-${String(q["kind"])}`);
          if (q?.["kind"] === "distribute" && Array.isArray(q["prerequisites"])) {
            const values = answers.get(num(e["seq"]) ?? -1)?.["amounts"];
            if (Array.isArray(values) && Array.isArray(q["items"]) && q["items"].some((ref, i) => typeof ref === "string" && ref.startsWith("p") && Number(values[i]) > 0)) hit("combat-defender-assignment");
            if (Array.isArray(values) && values.length > 0 && q["prerequisites"].length > 0) hit("combat-lethal-assignment");
          }
          answers.delete(num(e["seq"]) ?? -1);
          if (q && q["blocking"] === true && casting !== null) hit("cast-nested");
          open.delete(num(e["id"]) ?? -1);
          break;
        }
        case "rejected":
          hit("input-rejected");
          answers.delete(num(e["seq"]) ?? -1);
          taps.delete(num(e["seq"]) ?? -1);
          if (casting === num(e["seq"])) casting = null;
          break;
        case "input": {
          const input = isObject(e["input"]) ? e["input"] : {};
          const purposes = openPurposes();
          if (input["type"] === "answer") {
            answers.set(num(input["seq"]) ?? -1, input);
            const q = open.get(num(input["question"]) ?? -1);
            if (q && q["kind"] === "buttons") {
              if (q["purpose"] === "priority" && input["button"] === 1) hit("priority-pass");
              if (q["purpose"] === "payment" && input["button"] === 1) hit("payment-auto");
              // Forge's second button of the declaration: Alpha Strike, or Call Back once attackers are declared.
              if (q["purpose"] === "attack" && input["button"] === 2) hit("attack-all");
              if (q["purpose"] === "attackDeclared" && input["button"] === 2) hit("attack-call-back");
            }
            if (q && q["kind"] === "select") hit("decision-select");
          } else if (input["type"] === "card.tap") {
            // Forge accepted the tap unless a rejection with this seq follows
            const seq = num(input["seq"]) ?? -1;
            // The stack at the input: the previous checkpoint's (one comes before every input).
            if (purposes.has("priority")) {
              taps.set(seq, (previous?.stack.length ?? 0) > 0 ? ["priority-play", "priority-response"] : ["priority-play"]);
              casting = seq;
            } else if (purposes.has("payment")) taps.set(seq, ["payment-manual"]);
            else if (isDefender(previous, "card", num(input["card"]))) taps.set(seq, ["attack-defender"]);
          } else if (input["type"] === "player.tap") {
            const seq = num(input["seq"]) ?? -1;
            if ([...open.values()].some((q) => q["kind"] === "select")) taps.set(seq, ["target-player-tap"]);
            else if (purposes.has("payment")) taps.set(seq, ["payment-life"]);
            else if (isDefender(previous, "player", num(input["player"]))) taps.set(seq, ["attack-defender"]);
          } else if (input["type"] === "mana.use") {
            taps.set(num(input["seq"]) ?? -1, ["payment-pool"]);
          } else if (input["type"] === "state.request") {
            hit("state-request");
          }
          break;
        }
        case "mulligan":
          if (e["player"] === human) hit("mulligan");
          break;
        case "land":
          if (e["player"] === human) hit("land");
          break;
        case "cast": {
          if (e["trigger"] === true) hit("trigger");
          if ((num(e["stack"]) ?? 0) >= 1) hit("stack-response");
          if (e["player"] === human) {
            if (e["spell"] === true) hit("spell");
            const targets = Array.isArray(e["targets"]) ? (e["targets"] as unknown[]).map(String) : [];
            if (targets.some((t) => t.startsWith("c"))) hit("target-card");
            if (targets.some((t) => t.startsWith("p"))) hit("target-player");
            if (targets.length >= 2) hit("target-multi");
            casting = null;
          }
          break;
        }
        case "resolve":
          hit("stack-resolve");
          break;
        case "attackers":
          if (e["player"] === human && Array.isArray(e["attacks"]) && e["attacks"].length > 0) {
            hit("attack");
            if ((e["attacks"] as { defender?: unknown }[]).some((a) => typeof a.defender === "string" && a.defender.startsWith("c"))) hit("attack-planeswalker");
          }
          break;
        case "blockers":
          if (e["player"] === human && Array.isArray(e["blocks"])) {
            const blocked = (e["blocks"] as { blockers?: unknown[] }[]).filter((b) => Array.isArray(b.blockers) && b.blockers.length > 0);
            if (blocked.length >= 1) hit("block");
            if (blocked.length >= 2) hit("block-multi");
            if (blocked.some((b) => (b.blockers?.length ?? 0) >= 2)) hit("block-double");
          }
          break;
        case "move": {
          const from = zoneOf(e["from"]);
          const to = zoneOf(e["to"]);
          if (from && to) {
            hit(`zone:${from.zone}->${to.zone}`);
            if (human !== null && from.zone === "Command" && from.player === String(human)) hit("commander-cast");
            if (human !== null && to.zone === "Command" && to.player === String(human) && from.zone !== "Command") hit("commander-return");
          }
          break;
        }
        case "end":
          if (typeof e["result"] === "string") hit(`end-${e["result"]}`);
          if (e["conceded"] === true) hit("end-concede");
          break;
        default:
          break;
      }
    }
    previous = entry.snapshot;
    for (const refused of entry.snapshot.gui?.attack?.unavailable ?? []) {
      if (refused.reason === "sick") hit("attack-unavailable-sick");
      if (refused.reason === "tapped") hit("attack-unavailable-tapped");
      if (refused.reason === "restricted") hit("attack-unavailable-restricted");
    }
    if (human !== null) {
      const me = entry.snapshot.players.find((p) => p.id === human);
      for (const c of me?.commanders ?? []) {
        if (c.cast >= 2) hits["commander-tax"] = Math.max(hits["commander-tax"] ?? 0, c.cast - 1);
        const dealt = Object.values(c.damage).reduce((sum, v) => sum + v, 0);
        if (dealt > 0) hits["commander-damage"] = Math.max(hits["commander-damage"] ?? 0, dealt);
      }
    }
  }
  for (const categories of taps.values()) for (const category of categories) hit(category);
  const last = entries.at(-1)?.snapshot;
  for (const p of last?.players ?? []) {
    if (!p.lost) continue;
    if (p.life <= 0) hit("end-life");
    if ((p.counters["Poison"] ?? 0) >= 10) hit("end-poison");
  }
  return hits;
}
