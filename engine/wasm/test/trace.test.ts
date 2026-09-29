// The engine trace tooling of the differential tests (prompt 05): the
// comparison must fail on any difference and say where, the digest must not
// depend on key order, the coverage must read what a game exercised, and the
// fixtures must be well-formed and cover together what prompt 05 asks for.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import type { TraceSnapshot } from "../../protocol/src/index.ts";
import {
  canonicalJson,
  compareTraces,
  describeDivergence,
  firstDifference,
  parseTraceLines,
  REQUIRED_COVERAGE,
  TraceComparison,
  traceCoverage,
  traceDigest,
  traceStats,
  type TraceEntry,
} from "../spike/trace.ts";
import { FIXTURES_DIR, loadFixtures } from "./fixtures.ts";

const player = (id: number, extra: Partial<TraceSnapshot["players"][number]> = {}): TraceSnapshot["players"][number] => ({
  id, life: 20, lost: false, counters: {}, mana: {}, lands: 0, library: [], hand: [], graveyard: [], exile: [], command: [], battlefield: [], ...extra,
});

function entry(n: number, events: TraceEntry["events"], snapshot: Partial<TraceSnapshot> = {}, at: TraceEntry["at"] = "input", inputs = n - 1): TraceEntry {
  return {
    type: "diagnostics.trace", n, at, inputs, events,
    snapshot: { turn: 1, phase: "MAIN1", active: 0, priority: 0, human: 0, players: [player(0), player(1)], stack: [], combat: [], gui: { playable: [], highlighted: [], selectable: [], players: [], highlightedPlayers: [] }, questions: [], ...snapshot },
  };
}

const sample = (): TraceEntry[] => [
  entry(1, [{ e: "started", format: "constructed", aiProfile: "Default" }, { e: "question", id: 1, kind: "buttons", blocking: false, purpose: "priority", buttons: [true, true] }], { questions: [{ id: 1, kind: "buttons", blocking: false, purpose: "priority", buttons: [true, true] }] }),
  entry(2, [{ e: "input", input: { type: "card.tap", seq: 1, card: 7 } }, { e: "move", card: 7, key: "Shock", from: "Hand:0", to: "Stack:-" }, { e: "cast", card: 7, key: "Shock", player: 0, spell: true, trigger: false, stack: 0, targets: ["p1"] }]),
  entry(3, [{ e: "resolve", card: 7, key: "Shock", fizzled: false }, { e: "phase", player: 0, phase: "END_OF_TURN" }], { phase: "END_OF_TURN" }, "phase", 1),
];

describe("comparing traces", () => {
  test("canonical JSON sorts keys and keeps array order", () => {
    assert.equal(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
    assert.equal(canonicalJson({ a: undefined, b: null }), '{"b":null}');
  });

  test("the first difference ignores key order and names its path", () => {
    assert.equal(firstDifference({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), null);
    assert.deepEqual(firstDifference({ a: { b: [1, 2, 3] } }, { a: { b: [1, 5, 3] } }), { path: "a.b[1]", a: 2, b: 5 });
    assert.deepEqual(firstDifference([1, 2], [1, 2, 3]), { path: "[2]", a: undefined, b: 3 });
    assert.deepEqual(firstDifference({ a: 1 }, { a: 1, x: false }), { path: "x", a: undefined, b: false });
  });

  test("equal traces pass; the first differing entry is reported with its place in the game", () => {
    assert.equal(compareTraces(sample(), sample()), null);
    const other = sample();
    (other[1]!.events[2] as unknown as { targets: string[] }).targets = ["c9"];
    const d = compareTraces(sample(), other)!;
    assert.equal(d.entry, 2);
    assert.equal(d.path, "events[2].targets[0]");
    assert.equal(d.reference, "p1");
    assert.equal(d.actual, "c9");
    assert.match(d.context, /turn 1 MAIN1, 1 inputs read, checkpoint input/);
    const text = describeDivergence(d);
    assert.match(text, /entry 2 .* at events\[2\]\.targets\[0\]: JVM "p1" \/ Wasm "c9"/);
    assert.match(text, /"key":"Shock"/, "the whole event on both sides");
  });

  test("a snapshot difference names the zone entry", () => {
    const other = sample();
    other[2]!.snapshot.players[1] = player(1, { battlefield: [{ id: 3, key: "Forest", tapped: true }] });
    const reference = sample();
    reference[2]!.snapshot.players[1] = player(1, { battlefield: [{ id: 3, key: "Forest" }] });
    const d = compareTraces(reference, other)!;
    assert.equal(d.path, "snapshot.players[1].battlefield[0].tapped");
    assert.deepEqual(d.actualOwner, { id: 3, key: "Forest", tapped: true });
  });

  test("a trace that ends early or runs on is a divergence too", () => {
    const shorter = compareTraces(sample(), sample().slice(0, 2))!;
    assert.equal(shorter.entry, 3);
    assert.match(shorter.context, /compared trace ends after 2 entries/);
    const longer = compareTraces(sample().slice(0, 2), sample())!;
    assert.equal(longer.entry, 3);
    assert.match(longer.context, /reference trace has only 2 entries/);
  });

  test("the incremental comparison stops at the first difference", () => {
    const comparison = new TraceComparison(sample());
    const other = sample();
    other[0]!.inputs = 5;
    assert.ok(comparison.add(other[0]!));
    assert.equal(comparison.add(other[1]!)?.entry, 1, "later entries are not compared any more");
    assert.equal(comparison.compared, 1);
  });

  test("the digest does not depend on key order but on every value", async () => {
    const reverseKeys = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(reverseKeys) : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
    const reordered = sample().map((e) => reverseKeys(e) as TraceEntry);
    assert.notEqual(JSON.stringify(reordered), JSON.stringify(sample()), "the keys really are in another order");
    assert.equal(await traceDigest(sample()), await traceDigest(reordered));
    const other = sample();
    other[2]!.snapshot.turn = 2;
    assert.notEqual(await traceDigest(sample()), await traceDigest(other));
    assert.match(await traceDigest([]), /^[0-9a-f]{64}$/);
  });

  test("trace lines and counts", () => {
    const lines = sample().map((e) => JSON.stringify(e)).join("\n") + "\n";
    assert.deepEqual(parseTraceLines(lines), sample());
    const stats = traceStats(sample());
    assert.deepEqual(stats.checkpoints, { input: 2, phase: 1 });
    assert.equal(stats.events, 7);
    assert.equal(stats.eventKinds["cast"], 1);
  });
});

describe("coverage", () => {
  const q = (id: number, purpose: string) => ({ e: "question" as const, id, kind: "buttons", blocking: false, purpose, buttons: [true, true] });
  const input = (seq: number, body: Record<string, unknown>) => ({ e: "input" as const, input: { seq, ...body } });

  test("what the player did: mulligan, lands and spells, priority, payment, targets, stack, combat, zones, end", () => {
    // As the bridge records it: one input at the start of each entry (a
    // checkpoint comes before every input), one buttons question open at a
    // time, and every snapshot lists the questions open at its checkpoint.
    const Q = (id: number, purpose: string) => ({ id, kind: "buttons" as const, blocking: false, purpose: purpose as "priority", buttons: [true, true] });
    const open = (...questions: ReturnType<typeof Q>[]) => ({ questions });
    const trace: TraceEntry[] = [
      entry(1, [q(1, "mulligan")], open(Q(1, "mulligan"))),
      entry(2, [input(1, { type: "answer", question: 1, kind: "buttons", button: 2 }), { e: "answered", id: 1, seq: 1 }, { e: "mulligan", player: 0 }, q(2, "priority")], open(Q(2, "priority"))),
      entry(3, [input(2, { type: "card.tap", card: 30 }), { e: "land", player: 0, card: 30, key: "Mountain" }, { e: "move", card: 30, from: "Hand:0", to: "Battlefield:0" }], open(Q(2, "priority"))),
      entry(4, [input(3, { type: "card.tap", card: 99 }), { e: "rejected", seq: 3, reason: "no-effect" }], open(Q(2, "priority"))),
      entry(5, [input(4, { type: "card.tap", card: 7 }), { e: "withdrawn", id: 2 }, q(3, "payment")], open(Q(3, "payment"))),
      entry(6, [input(5, { type: "card.tap", card: 30 }), { e: "mana", player: 0, mode: "Added", colors: ["R"] }], open(Q(3, "payment"))),
      entry(7, [input(6, { type: "answer", question: 3, kind: "buttons", button: 1 }), { e: "answered", id: 3, seq: 6 },
        { e: "cast", card: 7, player: 0, spell: true, trigger: false, stack: 0, targets: ["p1", "c40"] },
        { e: "cast", card: 41, player: 1, spell: true, trigger: false, stack: 1, targets: ["c7"] },
        { e: "cast", card: 42, player: 1, spell: false, trigger: true, stack: 0, targets: [] }, { e: "resolve", card: 41 }, q(4, "priority")], open(Q(4, "priority"))),
      entry(8, [input(7, { type: "answer", question: 4, kind: "buttons", button: 1 }), { e: "answered", id: 4, seq: 7 },
        { e: "attackers", player: 0, attacks: [{ defender: "p1", attackers: [30] }] },
        { e: "blockers", player: 0, blocks: [{ attacker: 50, blockers: [31, 32] }, { attacker: 51, blockers: [33] }] },
        { e: "question", id: 5, kind: "choose", blocking: true }], { questions: [{ id: 5, kind: "choose", blocking: true }] }),
      entry(9, [input(8, { type: "answer", question: 5, kind: "choose", choices: [1] }), { e: "answered", id: 5, seq: 8 },
        { e: "move", card: 100, from: "Command:0", to: "Stack:-" }, { e: "move", card: 100, from: "Graveyard:0", to: "Command:0" },
        { e: "end", winner: "Forge AI", reason: "Concede", turns: 6, result: "loss", conceded: true }],
        { players: [player(0, { lost: true, life: 0, commanders: [{ card: 100, cast: 2, damage: { "1": 5 } }] }), player(1)] }, "end"),
    ];
    const c = traceCoverage(trace);
    for (const key of ["mulligan", "land", "spell", "priority-pass", "payment-auto", "payment-manual", "target-card", "target-player", "trigger",
      "stack-response", "stack-resolve", "attack", "block", "block-multi", "block-double", "decision-choose", "question-withdrawn", "input-rejected",
      "commander-cast", "commander-return", "commander-tax", "commander-damage", "end-loss", "end-concede", "end-life", "zone:Hand->Battlefield", "zone:Command->Stack"]) {
      assert.ok((c[key] ?? 0) > 0, `${key} not seen: ${JSON.stringify(c)}`);
    }
    assert.equal(c["priority-play"], 2, "two taps at priority were accepted, the rejected one does not count");
    assert.equal(c["payment-manual"], 1);
    assert.equal(c["spell"], 1, "only the player's own spells count as its spells");
  });

  test("priority in the opponent's turn and an answer on the stack (prompt 16)", () => {
    const Q = (id: number, purpose: string) => ({ id, kind: "buttons" as const, blocking: false, purpose: purpose as "priority", buttons: [true, true] });
    const shock = { card: 41, key: "Shock", player: 1, api: "DealDamage", spell: true, trigger: false, targets: ["p0"] };
    const trace: TraceEntry[] = [
      // The opponent's turn (active 1): Forge asks the player at priority, nothing on the stack yet - the player passes.
      entry(1, [q(1, "priority")], { active: 1, questions: [Q(1, "priority")] }),
      entry(2, [input(1, { type: "answer", question: 1, kind: "buttons", button: 1 }), { e: "answered", id: 1, seq: 1 },
        { e: "cast", card: 41, player: 1, spell: true, trigger: false, stack: 0, targets: ["p0"] }, q(2, "priority")], { active: 1, stack: [shock], questions: [Q(2, "priority")] }),
      // With the opponent's spell on the stack the player taps a card: an answer.
      entry(3, [input(2, { type: "card.tap", card: 7 }), { e: "cast", card: 7, player: 0, spell: true, trigger: false, stack: 1, targets: ["p1"] }], { active: 1, stack: [], questions: [] }),
      // In the player's own turn, with an empty stack: a play, no answer.
      entry(4, [q(3, "priority")], { active: 0, questions: [Q(3, "priority")] }),
      entry(5, [input(3, { type: "card.tap", card: 30 })], { active: 0, questions: [] }),
    ];
    const c = traceCoverage(trace);
    assert.equal(c["priority-opponent-turn"], 2, "two priorities in the opponent's turn, none counted in the player's own");
    assert.equal(c["priority-response"], 1, "only the tap with something on the stack answers");
    assert.equal(c["priority-play"], 2);
  });

  test("players as targets, several targets, the pool, life for mana and decisions while casting (prompt 17)", () => {
    const P = { id: 1, kind: "buttons" as const, blocking: false, purpose: "priority" as const, buttons: [true, true] };
    const mode = { id: 2, kind: "choose" as const, blocking: true, min: 1, max: 1 };
    const select = { id: 3, kind: "select" as const, blocking: false, min: 2, max: 2, cards: [9] };
    const pay = { id: 4, kind: "buttons" as const, blocking: false, purpose: "payment" as const, buttons: [true, true] };
    const trace: TraceEntry[] = [
      entry(1, [q(1, "priority")], { questions: [P] }),
      // The player taps a card at priority; Forge asks for a mode (blocking) before targets and payment.
      entry(2, [input(1, { type: "card.tap", card: 30 }), { e: "question", ...mode }], { questions: [mode] }),
      entry(3, [input(2, { type: "answer", question: 2, kind: "choose", choices: [1] }), { e: "answered", id: 2, seq: 2 }, { e: "question", ...select }], { questions: [select] }),
      // A player chosen by tapping them; a second tap on a player Forge refuses does not count.
      entry(4, [input(3, { type: "player.tap", player: 1 })], { questions: [select] }),
      entry(5, [input(4, { type: "player.tap", player: 0 }), { e: "rejected", seq: 4, reason: "no-effect" }], { questions: [select] }),
      entry(6, [input(5, { type: "card.tap", card: 9 }), { e: "withdrawn", id: 3 }, { e: "question", ...pay }], { questions: [pay] }),
      // Floating mana, then life for Phyrexian mana, then the spell with both targets on the stack.
      entry(7, [input(6, { type: "mana.use", color: "B" })], { questions: [pay] }),
      entry(8, [input(7, { type: "player.tap", player: 0 }), { e: "withdrawn", id: 4 },
        { e: "cast", card: 30, player: 0, spell: true, trigger: false, stack: 0, targets: ["p1", "c9"] }]),
      // A blocking decision after the cast is not one of casting.
      entry(9, [{ e: "question", ...mode, id: 5 }], { questions: [{ ...mode, id: 5 }] }),
      entry(10, [input(8, { type: "answer", question: 5, kind: "choose", choices: [1] }), { e: "answered", id: 5, seq: 8 }]),
    ];
    const c = traceCoverage(trace);
    assert.equal(c["target-player-tap"], 1, "the refused player tap does not count");
    assert.equal(c["payment-pool"], 1);
    assert.equal(c["payment-life"], 1);
    assert.equal(c["target-multi"], 1);
    assert.equal(c["cast-nested"], 1, "only the mode chosen while the spell was being cast");
    assert.equal(c["target-player"], 1);
    assert.equal(c["target-card"], 1);
  });

  test("declaring attackers: the defender switched, Alpha Strike, Call Back, a planeswalker attacked, Forge's reasons (prompt 18)", () => {
    const A = (id: number, purpose: "attack" | "attackDeclared") => ({ id, kind: "buttons" as const, blocking: false, purpose, buttons: [true, true] });
    const gui = (attack: NonNullable<NonNullable<TraceSnapshot["gui"]>["attack"]>) => ({ playable: [], highlighted: [], selectable: [], players: [], highlightedPlayers: [], attack });
    const defenders = [{ kind: "player" as const, id: 1 }, { kind: "card" as const, id: 68 }, { kind: "card" as const, id: 74 }];
    const atPlayer = { defender: defenders[0]!, defenders, unavailable: [] };
    const atWalker = { defender: defenders[1]!, defenders, unavailable: [] };
    const declaring = { questions: [A(1, "attack")] };
    const trace: TraceEntry[] = [
      // Forge's reasons at the first checkpoint of the declaration: each counts where the state names it.
      entry(1, [q(1, "attack")], { ...declaring, gui: gui({ ...atPlayer, unavailable: [{ card: 17, reason: "sick" }, { card: 31, reason: "tapped" }, { card: 38, reason: "restricted" }] }) }),
      // The planeswalker tapped: it becomes the defender.
      entry(2, [input(1, { type: "card.tap", card: 68 })], { ...declaring, gui: gui(atWalker) }),
      // The defender tapped again changes nothing: no switch.
      entry(3, [input(2, { type: "card.tap", card: 68 })], { ...declaring, gui: gui(atWalker) }),
      // Another planeswalker Forge refuses (the bridge's no-effect): no switch.
      entry(4, [input(3, { type: "card.tap", card: 74 }), { e: "rejected", seq: 3, reason: "no-effect" }], { ...declaring, gui: gui(atWalker) }),
      // The opponent tapped: the player is the defender again; the player themself is no defender.
      entry(5, [input(4, { type: "player.tap", player: 1 })], { ...declaring, gui: gui(atPlayer) }),
      entry(6, [input(5, { type: "player.tap", player: 0 }), { e: "rejected", seq: 5, reason: "no-effect" }], { ...declaring, gui: gui(atPlayer) }),
      // Alpha Strike (Forge's second button while nobody attacks), then Call Back (once attackers are declared).
      entry(7, [input(6, { type: "answer", question: 1, kind: "buttons", button: 2 }), { e: "answered", id: 1, seq: 6 }, q(2, "attackDeclared")], { questions: [A(2, "attackDeclared")], gui: gui(atPlayer) }),
      entry(8, [input(7, { type: "answer", question: 2, kind: "buttons", button: 2 }), { e: "answered", id: 2, seq: 7 }, q(3, "attack")], { questions: [A(3, "attack")], gui: gui(atPlayer) }),
      // OK declares: one creature at the planeswalker, one at the player; the AI's attack at a card is not the player's.
      entry(9, [input(8, { type: "answer", question: 3, kind: "buttons", button: 1 }), { e: "answered", id: 3, seq: 8 },
        { e: "attackers", player: 0, attacks: [{ defender: "c68", attackers: [14] }, { defender: "p1", attackers: [20] }] },
        { e: "attackers", player: 1, attacks: [{ defender: "c90", attackers: [60] }] }]),
    ];
    const c = traceCoverage(trace);
    assert.equal(c["attack-defender"], 2, "the planeswalker and the player again; not the defender tapped again, not a refused tap");
    assert.equal(c["attack-all"], 1);
    assert.equal(c["attack-call-back"], 1);
    assert.equal(c["attack"], 1, "only the player's own attack");
    assert.equal(c["attack-planeswalker"], 1);
    assert.equal(c["attack-unavailable-sick"], 1);
    assert.equal(c["attack-unavailable-tapped"], 1);
    assert.equal(c["attack-unavailable-restricted"], 1);
    assert.equal(c["input-rejected"], 2);
  });

  test("a trace without a human seat still shows zones, stack and the end", () => {
    const trace = [entry(1, [{ e: "cast", card: 1, player: 1, spell: true, trigger: true, stack: 1, targets: [] }, { e: "move", card: 1, from: "Library:1", to: "Hand:1" }], { human: null }, "end")];
    const c = traceCoverage(trace);
    assert.equal(c["trigger"], 1);
    assert.equal(c["stack-response"], 1);
    assert.equal(c["zone:Library->Hand"], 1);
    assert.equal(c["spell"], undefined);
  });
});

describe("fixtures", () => {
  test("every fixture of the repository is well-formed and together they cover what prompt 05 asks for", () => {
    const fixtures = loadFixtures();
    assert.ok(fixtures.length >= 8, `${fixtures.length} fixtures`);
    const covered = new Set(fixtures.filter((f) => !f.sameGameAs).flatMap((f) => f.covers));
    assert.deepEqual(REQUIRED_COVERAGE.filter((c) => !covered.has(c)), []);
    for (const f of fixtures) {
      assert.equal(f.match.trace, true, `${f.name}: the reference game must be traced`);
      assert.ok(Number.isInteger(f.match.seed), `${f.name}: fixed seed`);
    }
    assert.ok(fixtures.some((f) => f.match.format === "commander"), "a Commander game");
    assert.ok(fixtures.some((f) => f.engine.language === "de-DE" && f.sameGameAs), "a German variant that must be the same game");
    assert.ok(
      fixtures.some((f) => f.engine.cardLanguage !== f.engine.language && f.sameGameAs),
      "a variant whose cards are in another language than Forge's words (prompt 12) that must be the same game",
    );
    for (const f of fixtures) assert.ok(f.engine.cardLanguage, `${f.name}: the card language defaults to the language`);
  });

  test("a fixture with an unknown field, a missing seed or an unknown coverage category is refused", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "openmana-fixtures-"));
    try {
      fs.mkdirSync(path.join(tmp, "differential"));
      fs.cpSync(path.join(FIXTURES_DIR, "decks"), path.join(tmp, "decks"), { recursive: true });
      const good = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "differential", "human-3.json"), "utf8"));
      const write = (value: unknown) => fs.writeFileSync(path.join(tmp, "differential", "x.json"), JSON.stringify(value));
      write(good);
      assert.equal(loadFixtures(tmp).length, 1);
      write({ ...good, colour: "red" });
      assert.throws(() => loadFixtures(tmp), /unknown field\(s\) colour/);
      write({ ...good, match: { ...good.match, seed: null } });
      assert.throws(() => loadFixtures(tmp), /fixed integer/);
      write({ ...good, covers: ["mulligan", "flying"] });
      assert.throws(() => loadFixtures(tmp), /unknown: flying/);
      write({ ...good, player: { attack: "sometimes" } });
      assert.throws(() => loadFixtures(tmp), /player\.attack/);
      write({ ...good, match: { ...good.match, human: { name: "Player", deck: "no-such-deck" } } });
      assert.throws(() => loadFixtures(tmp), /does not exist/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
