// One valid example of every message of the protocol, written by hand after
// real engine output (prompt 02 recordings; diagnostics.cards: the JVM card
// probe of prompt 04, shortened). schema.test.ts checks that each
// passes and that no message type of the schema is left without an example.
import { PROTOCOL_VERSION, type EngineInput, type EngineMessage, type MatchRequest, type VisibleCard, type WorkerCommand } from "../src/index.ts";

export const card: VisibleCard = {
  id: 54,
  key: "Bonecrusher Giant",
  name: "Bonecrusher Giant",
  typeLine: "Creature - Giant",
  cost: "{2}{R}",
  set: "ELD",
  power: 4,
  toughness: 3,
  text: "Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher Giant deals 2 damage to that spell's controller.",
  tapped: false,
  sick: true,
  faceDown: false,
  damage: 0,
  owner: 0,
  controller: 0,
  playable: true,
  action: "cast spell",
  ways: ["Bonecrusher Giant - Creature 4 / 3", "Stomp - Damage can't be prevented this turn."],
  counters: { P1P1: 1 },
};

export const matchRequest: MatchRequest = {
  seed: 3,
  format: "constructed",
  human: { name: "Player", deck: { name: "Red", main: [{ card: "Mountain", count: 20 }, { card: "Shock", count: 4 }] } },
  ai: { name: "Forge AI", profile: "Default", deck: { name: "Green", main: [{ card: "Forest", count: 22 }] } },
};

export const engineMessages: EngineMessage[] = [
  { type: "engine.boot", phase: "worker-features", t: 3.2, features: {
    webAssembly: true, wasmGc: true, wasmExnref: true, wasmTypedFunctionReferences: true, crossOriginIsolated: true,
    sharedArrayBuffer: true, atomicsWait: true, worker: true, missing: [], supported: true } },
  { type: "engine.boot", phase: "java-main", t: 728 },
  {
    type: "engine.ready",
    protocol: PROTOCOL_VERSION,
    engine: {
      forgeVersion: "GIT",
      forgeCommit: "ed0333fecb1fea0671b3e50cadc1da4f71db5798",
      forgeVersionCode: "2.0.15",
      patchCount: 6,
      patchesSha256: "d434f05792db3addec2bcc386318a7cdb5e0e3f4f1394d5490a73d28d3238ad7",
      openmanaCommit: "5a2ed628ef263fff95d0aca0c1c227453fa5074f",
      engineSourcesModified: false,
      synchronous: true,
      resourcesSha256: "0a4ae34b35b7ce650ac6815b80d59c205a8ae9535743ef134506db3076a72fe9",
    },
    boot: { resourceFiles: 36922, resourceBytes: 37706881, unpackMillis: 904, forgeInitMillis: 2462, cardLoading: "lazy", language: "en-US", cardLanguage: "en-US", aiProfiles: ["Cautious", "Default", "Experimental", "Reckless"] },
    t: 3472,
  },
  { type: "engine.waiting", consumed: 12 },
  { type: "engine.error", code: "deck-rejected", message: "Forge does not know 1 card(s) of deck 'Red'", report: { deck: "Red", unknownCards: ["Definitely Not A Magic Card"] } },
  { type: "engine.abort", reason: "unsupported-browser", origin: "client", message: "Dieser Browser kann die Forge-Engine nicht ausführen.", missing: ["SharedArrayBuffer"] },
  {
    type: "match.finished",
    summary: {
      winner: "Forge AI", reason: "AllOpponentsLost", turns: 15, result: "loss",
      players: [{ id: 0, name: "Player", life: -3, me: true }, { id: 1, name: "Forge AI", life: 14, me: false }],
      conceded: false, gameMillis: 1619, inputs: 44, logEntries: 324,
      logSha256: "c1e990c6986adb44562412bad97d897edf215dd6d9f62c2d0c7c98d4cb9471e2", protocolMessages: 147,
      protocolSha256: "6108436c356812edcf1372a7ee45b4e2d01ed5faa2d3036ada12f56360e8dabe",
      forgeCallbacks: { updateZones: 167, updateCards: 108 }, forgeErrors: [], threadViolations: [],
    },
  },
  {
    // a traced match (engine tests only): the summary counts the trace entries and events
    type: "match.finished",
    summary: {
      winner: "Player", reason: "AllOpponentsLost", turns: 17, result: "win",
      players: [{ id: 0, name: "Player", life: 31, me: true }, { id: 1, name: "Forge AI", life: -3, me: false }],
      conceded: false, gameMillis: 5310, inputs: 85, logEntries: 402,
      logSha256: "c1e990c6986adb44562412bad97d897edf215dd6d9f62c2d0c7c98d4cb9471e2", protocolMessages: 262,
      protocolSha256: "6108436c356812edcf1372a7ee45b4e2d01ed5faa2d3036ada12f56360e8dabe",
      forgeCallbacks: { updateZones: 250 }, trace: { entries: 303, events: 2798 }, forgeErrors: [], threadViolations: [],
    },
  },
  {
    type: "diagnostics.result",
    result: {
      seed: 42, gameMillis: 2014, draw: false, winner: "Green AI", winCondition: "AllOpponentsLost", turns: 20,
      players: [{ name: "Red AI", life: 0, library: 30, hand: 2, battlefield: 8, graveyard: 12 }],
      logEntries: 444, logSha256: "d7611b0e534870deb05d5253f4f53cf2489006b28fc4b865bf3a03ab5d5b85b8", forgeErrors: [],
    },
  },
  {
    type: "diagnostics.result",
    result: {
      seed: 7, gameMillis: 2890, draw: false, winner: "Green AI", winCondition: "AllOpponentsLost", turns: 24,
      players: [{ name: "Red AI", life: -1, library: 26, hand: 1, battlefield: 9, graveyard: 15 }],
      logEntries: 512, logSha256: "0d52aafc0fd4e6fb0dbf5c8e8a4d2b6e0b8e8f0ef3f6b1a42d8f33de0c1a2b3c", trace: { entries: 290, events: 3100 }, forgeErrors: [],
    },
  },
  {
    type: "diagnostics.cards",
    result: {
      format: "openmana-card-probe/1",
      cardLoading: "lazy",
      language: { selected: "de-DE", messages: { lblYes: "Ja" }, cardNames: { "Lightning Bolt": "Blitzschlag" }, timeZone: "UTC" },
      namedCreation: [{ id: "conjure-by-name", source: "Emerald Collector", effect: "MakeCard", ok: true, created: ["Mox Emerald"], uniqueCardsKnownBefore: 0, uniqueCardsKnownAfter: 2 }],
      representative: [{ category: "transform", request: "Delver of Secrets", found: true, name: "Delver of Secrets", layout: "Transform", faces: [{ name: "Delver of Secrets" }, { name: "Insectile Aberration" }], game: { doubleFaced: true } }],
      tokens: { scripts: 854, loaded: 854, abilities: 1335, sha256: "3b1b1051a0b674e954b30d297a1723779cb6eb8d779c74f005342b261d88186b", problems: [] },
      newestEditions: [{ code: "FRA", name: "Reality Fracture", date: "2026-10-02", distinctCards: 285, loaded: 283, notImplemented: ["Command the Stage", "Loot, the Anomaly"], sha256: "0d45af4db2351e4ca467fbf7df30283d2a559fef651a457261c257ee3d4022ed" }],
      database: {
        cards: { unique: 33505, printings: 97130, instantiated: 33505, abilities: 85321, layouts: { None: 32589, Transform: 399 },
          rulesSha256: "de6596f0db85981dc8b6614e46e4c295c00a5b4d9a263a93c2c2c94d6525c991", gameCardsSha256: "596d9fd3efd4fbbdb26ca9b3f8341b2d0910f1c2da8c931d1f92eed163b57563" },
        variantCards: { unique: 473, printings: 675, instantiated: 473, abilities: 823,
          rulesSha256: "c91d6f6b2d61c3048d554a9769539d42983291591a4c8ad778adeccaceb1693c", gameCardsSha256: "6b3da560c2ad36b68650d0e7a585300bdc3ffa0097a1d90180d5576f451ac472" },
        editions: 682,
        scriptWarnings: ["SVar 'TrigSwitch' not defined in Card (Desert Were-Worm)"],
        problems: [],
      },
      sections: { database: "b177b35f85b357ed7b66c8526f5d7436a51ce482242457dfa5ce6110cd51ba0b" },
      failures: [],
      fingerprint: "464cbd26db3b70667822aa8aa9f4f571f070c72b91fe846022ce5de26483e325",
      millis: { namedCreation: 16205, database: 12069 },
    },
  },
  {
    // engine tests only (prompt 05): an entry of the engine trace, shortened from a real JVM game
    type: "diagnostics.trace", n: 2, at: "input", inputs: 1,
    events: [
      { e: "input", input: { type: "answer", seq: 1, question: 1, kind: "buttons", button: 2 } },
      { e: "answered", id: 1, seq: 1 },
      { e: "move", card: 53, key: "Bonecrusher Giant", from: "Hand:0", to: "Library:0" },
      { e: "cast", card: 89, key: "Shock", player: 1, spell: true, trigger: false, stack: 1, targets: ["c10"] },
      { e: "question", id: 2, kind: "buttons", blocking: false, purpose: "mulliganBottom", buttons: [false, true] },
    ],
    snapshot: {
      turn: 0, phase: null, active: null, priority: null, human: 0,
      players: [
        { id: 0, life: 20, lost: false, counters: {}, mana: {}, lands: 0, library: [43, 27, 24], hand: [{ id: 53, key: "Bonecrusher Giant" }], graveyard: [], exile: [], command: [], battlefield: [] },
        {
          id: 1, life: 40, lost: false, counters: { Poison: 2 }, mana: { G: 1 }, lands: 1, library: [106], hand: [{ id: 116, key: "Forest" }], graveyard: [], exile: [],
          command: [{ id: 201, key: "Fynn, the Fangbearer" }],
          battlefield: [{ id: 80, key: "Grizzly Bears", tapped: true, sick: true, power: 3, toughness: 3, counters: { "+1/+1": 1 } }, { id: 90, key: "Delver of Secrets", state: "Transformed", attachedTo: "c80" }],
          commanders: [{ card: 201, cast: 1, damage: { "0": 3 } }],
        },
      ],
      stack: [{ card: 49, key: "Shock", player: 0, api: "DealDamage", spell: true, trigger: false, targets: ["p1", "c80", "s12"] }],
      combat: [{ attacker: 80, defender: "p0", blockers: [] }],
      gui: { playable: [], highlighted: [], selectable: [] },
      questions: [{ id: 2, kind: "buttons", blocking: false, purpose: "mulliganBottom", buttons: [false, true] }, { id: 5, kind: "choose", blocking: true, min: 1, max: 1, suggested: [1], items: ["c53", "p1", "hidden", "#4"] }],
    },
  },
  { type: "game.started", protocol: PROTOCOL_VERSION, human: "Player", ai: "Forge AI", aiProfile: "Default", format: "constructed", cardNames: ["Forest", "Mountain", "Shock"] },
  {
    type: "state", seq: 7, running: true, turn: 3, phase: "MAIN1", activePlayer: 0, me: 0,
    players: [
      { id: 0, name: "Player", ai: false, me: true, life: 20, hasPriority: true, canAct: true, lost: false, maxHandSize: 7,
        landsPlayed: 1, landsAllowed: 1, counters: {}, mana: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
        zones: { battlefield: [], hand: [card], graveyard: [], exile: [], command: [] }, library: 50, commanders: [] },
      { id: 1, name: "Forge AI", ai: true, me: false, life: 18, hasPriority: false, canAct: false, lost: false, maxHandSize: 7,
        landsPlayed: 0, landsAllowed: 1, counters: { POISON: 1 }, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        zones: { battlefield: [], hand: [{ hidden: true }, { hidden: true }], graveyard: [], exile: [], command: [] }, library: 49,
        commanders: [{ card, cast: 1, tax: 2, damage: [{ player: 0, amount: 5 }] }] },
    ],
    stack: [
      { id: 16, text: "Shock deals 2 damage to any target.", source: 48, card: { ...card, id: 48 }, player: 0, ability: false, trigger: false, targets: [{ kind: "player", id: 1 }] },
      { id: 17, text: "Morph", source: null, card: { hidden: true }, player: 1, ability: false, trigger: false, targets: [] },
    ],
    combat: [{ attacker: 19, defender: 1, defenderKind: "player", blockers: [] }],
  },
  { type: "events", entries: [{ kind: "LAND", text: "Player played Mountain (35)", card: 35, actor: "me" }, { kind: "TURN", text: "Turn 2 (Forge AI)" }] },
  { type: "message", kind: "prompt", text: "Priority: Player Turn: 1 (Player)", card: 54, cardView: card },
  { type: "message", kind: "incorrect-action", text: "" },
  { type: "question", kind: "select", id: 8, blocking: false, text: "Select targets", min: 1, max: 1, cards: [58], items: [{ nr: 1, text: "Goblin Arsonist (58)", card: 58, cardView: { ...card, id: 58 } }] },
  { type: "question", kind: "choose", id: 36, blocking: true, text: "Choose a mode", min: 1, max: 1, items: [{ nr: 1, text: "Mode 1" }, { nr: 2, hidden: true }], suggested: [1] },
  { type: "question", kind: "buttons", id: 3, blocking: false, text: "", purpose: "priority", buttons: [{ nr: 1, label: "OK", enabled: true, meaning: "pass" }, { nr: 2, label: "End Turn", enabled: true, meaning: "endTurn" }] },
  { type: "question", kind: "confirm", id: 4, blocking: true, text: "Pay {2}?", suggested: true, yesLabel: "Yes", noLabel: null },
  { type: "question", kind: "options", id: 14, blocking: true, text: "Choose ability to play", items: [{ nr: 1, text: "Cast" }], cancellable: true, card: 54, cardView: card },
  { type: "question", kind: "input", id: 5, blocking: true, text: "Choose a number", numeric: true, suggested: "0" },
  { type: "question", kind: "order", id: 6, blocking: true, text: "Order triggers", top: null, remainingMin: 0, remainingMax: 0, items: [{ nr: 1, text: "A" }, { nr: 2, text: "B" }] },
  { type: "question", kind: "arrange", id: 32, blocking: true, text: "Move cards to top or bottom of library", toTop: true, toBottom: true, toAnywhere: false, others: 50, items: [{ nr: 1, text: "Mountain", card: 35 }] },
  { type: "question", kind: "distribute", id: 9, blocking: true, text: "3 combat damage", total: 3, min: 0, items: [{ nr: 1, text: "Blocker", card: 77 }], card: 75 },
  { type: "question.withdrawn", id: 3 },
  { type: "question.answered", id: 4, seq: 12 },
  { type: "input.rejected", seq: 13, reason: "stale", detail: "question 9999999 is not open", input: { type: "answer", seq: 13, question: 9999999, kind: "buttons", button: 1 } },
  { type: "game.end", winner: "Forge AI", reason: "Concede", turns: 4, result: "loss", players: [{ id: 0, name: "Player", life: 20, me: true }], conceded: true },
];

export const engineInputs: EngineInput[] = [
  { type: "answer", seq: 1, question: 8, kind: "select", choices: [1] },
  { type: "answer", seq: 2, question: 36, kind: "choose", choices: [] },
  { type: "answer", seq: 3, question: 3, kind: "buttons", button: 2 },
  { type: "answer", seq: 4, question: 4, kind: "confirm", yes: false },
  { type: "answer", seq: 5, question: 14, kind: "options", option: 0 },
  { type: "answer", seq: 6, question: 5, kind: "input", value: "3" },
  { type: "answer", seq: 7, question: 6, kind: "order", order: [2, 1] },
  { type: "answer", seq: 8, question: 32, kind: "arrange", top: [], bottom: [1] },
  { type: "answer", seq: 9, question: 9, kind: "distribute", amounts: [3] },
  { type: "card.tap", seq: 10, card: 35 },
  { type: "player.tap", seq: 11, player: 1 },
  { type: "state.request", seq: 12 },
  { type: "concede", seq: 13 },
];

export const workerCommands: WorkerCommand[] = [
  { type: "engine.start", protocol: PROTOCOL_VERSION, engineScriptUrl: "engine/openmana-engine.js", wasmUrl: "engine/openmana-engine.js.wasm", args: ["--card-loading=lazy"], queue: new SharedArrayBuffer(96), requireIsolation: true },
  { type: "match.start", match: matchRequest },
  { type: "diagnostics.ai-match", seed: 42, includeLog: false },
  { type: "diagnostics.ai-match", seed: 7, includeLog: false, trace: true },
  { type: "match.start", match: { ...matchRequest, trace: true } },
  { type: "diagnostics.card-probe" },
];
