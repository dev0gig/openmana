#!/usr/bin/env node
/*
 * The differential test fixtures (engine/fixtures/differential, prompt 05):
 * one small JSON file per scripted game, decks in engine/fixtures/decks. This
 * loads and checks them strictly and turns them into scenarios for the JVM
 * reference run (JvmHumanMatchMain --scenario, format openmana-scenario/1):
 * the match request with its decks and "trace": true, the scripted player's
 * policy, the engine's language and card loading.
 *
 *   node engine/wasm/test/fixtures.ts resolve <out-dir>   one <name>.scenario.json per fixture
 *   node engine/wasm/test/fixtures.ts list                one tab-separated line per fixture for
 *                                                         test-engine.sh: name language cardLanguage
 *                                                         cardLoading sameGameAs node-feedings browser-feedings
 *                                                         ("-" for none, lists comma-separated)
 *
 * A fixture:
 *   { "description": "…",
 *     "match":   { "seed": 3, "format": "constructed"|"commander",
 *                  "human": { "name": "Player", "deck": "<deck file>" },
 *                  "ai":    { "name": "Forge AI", "profile": "Default", "deck": "<deck file>" } },
 *     "player":  { "attack": "all"|"none"|"alternate", "block": "none"|"one"|"assign", "play": "all"|"respond", "concedeInTurn": 0 },
 *     "engine":  { "language": "en-US"|"de-DE", "cardLanguage": "en-US"|"de-DE",       (optional; cardLanguage:
 *                  "cardLoading": "eager"|"lazy" },                                    the cards in Forge's texts, default language)
 *     "wasm":    { "node": ["lazy", "eager"], "browser": ["lazy"] },                   (input feedings of the replays)
 *     "covers":  [ coverage categories of engine/wasm/spike/trace.ts the game must show ] }
 * or a variant of another fixture that must be the very same game (equal
 * engine trace), with other engine settings:
 *   { "description": "…", "sameGameAs": "<fixture>", "engine": { … }, "wasm": { … } }
 * Anything unknown is refused: a typo must not silently test less.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARD_LOADINGS, ENGINE_LANGUAGES, checkMatchRequest, type Deck, type MatchRequest } from "../../protocol/src/index.ts";
import { COVERAGE } from "../spike/trace.ts";

export const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
export const SCENARIO_FORMAT = "openmana-scenario/1";

const FEEDINGS = ["lazy", "eager"] as const;
type Feeding = (typeof FEEDINGS)[number];

export interface PlayerPolicy {
  attack: "all" | "none" | "alternate";
  block: "none" | "one" | "assign";
  /** all: every card Forge marks playable at priority; respond: lands only while the stack is empty, answers while it is not (prompt 16). */
  play: "all" | "respond";
  /** cards: cards first where Forge offers cards and players; players: the opponent first (prompt 17). */
  target: "cards" | "players";
  concedeInTurn: number;
}

export interface Fixture {
  name: string;
  description: string;
  /** The fixture this one must equal (same game, other engine settings), or null. */
  sameGameAs: string | null;
  match: MatchRequest;
  player: PlayerPolicy;
  engine: { language: string; cardLanguage: string; cardLoading: string };
  wasm: { node: Feeding[]; browser: Feeding[] };
  covers: string[];
}

export interface Scenario {
  format: typeof SCENARIO_FORMAT;
  name: string;
  engine: { language: string; cardLanguage: string; cardLoading: string };
  player: PlayerPolicy;
  match: MatchRequest;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(where: string, value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw new Error(`${where}: unknown field(s) ${unknown.join(", ")}`);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function isCoverageCategory(key: string): boolean {
  return key in COVERAGE || /^zone:[A-Za-z]+->[A-Za-z]+$/.test(key);
}

function deck(dir: string, name: unknown, where: string): Deck {
  if (typeof name !== "string" || !/^[a-z0-9-]+$/.test(name)) throw new Error(`${where}: deck must name a file in fixtures/decks (lower case, digits, dashes)`);
  const file = path.join(dir, "decks", `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`${where}: deck file decks/${name}.json does not exist`);
  return readJson(file) as Deck;
}

function feedings(where: string, value: unknown): Feeding[] {
  if (!Array.isArray(value) || value.some((f) => !FEEDINGS.includes(f as Feeding)) || new Set(value).size !== value.length) {
    throw new Error(`${where}: a list of distinct feedings (${FEEDINGS.join(", ")})`);
  }
  return value as Feeding[];
}

/** Loads every fixture of <dir>/differential, checks it and resolves variants and decks. */
export function loadFixtures(dir = FIXTURES_DIR): Fixture[] {
  const files = fs.readdirSync(path.join(dir, "differential")).filter((f) => f.endsWith(".json")).sort();
  const raw = new Map<string, Record<string, unknown>>();
  for (const file of files) {
    const value = readJson(path.join(dir, "differential", file));
    const name = file.slice(0, -".json".length);
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`${file}: fixture names are lower case, digits and dashes`);
    if (!isObject(value)) throw new Error(`${file}: not a JSON object`);
    raw.set(name, value);
  }
  const fixtures: Fixture[] = [];
  for (const [name, value] of raw) {
    const where = `fixture ${name}`;
    const variantOf = value["sameGameAs"];
    onlyKeys(where, value, variantOf === undefined ? ["description", "match", "player", "engine", "wasm", "covers"] : ["description", "sameGameAs", "engine", "wasm"]);
    if (typeof value["description"] !== "string" || value["description"].trim() === "") throw new Error(`${where}: description missing`);
    let base = value;
    if (variantOf !== undefined) {
      if (typeof variantOf !== "string" || !raw.has(variantOf)) throw new Error(`${where}: sameGameAs names no fixture`);
      base = raw.get(variantOf)!;
      if (base["sameGameAs"] !== undefined) throw new Error(`${where}: sameGameAs must name a fixture that is not a variant itself`);
    }
    const match = base["match"];
    if (!isObject(match)) throw new Error(`${where}: match missing`);
    onlyKeys(`${where} match`, match, ["seed", "format", "human", "ai"]);
    if (!Number.isInteger(match["seed"])) throw new Error(`${where}: match.seed must be a fixed integer (reproducible games)`);
    const human = match["human"];
    const ai = match["ai"];
    if (!isObject(human) || !isObject(ai)) throw new Error(`${where}: match.human and match.ai are required`);
    const request = {
      seed: match["seed"],
      format: match["format"],
      human: { ...human, deck: deck(dir, human["deck"], `${where} human`) },
      ai: { ...ai, deck: deck(dir, ai["deck"], `${where} ai`) },
      trace: true,
    } as MatchRequest;
    checkMatchRequest(request);

    const player = base["player"] ?? {};
    if (!isObject(player)) throw new Error(`${where}: player must be an object`);
    onlyKeys(`${where} player`, player, ["attack", "block", "play", "target", "concedeInTurn"]);
    const policy: PlayerPolicy = {
      attack: (player["attack"] ?? "all") as PlayerPolicy["attack"],
      block: (player["block"] ?? "none") as PlayerPolicy["block"],
      play: (player["play"] ?? "all") as PlayerPolicy["play"],
      target: (player["target"] ?? "cards") as PlayerPolicy["target"],
      concedeInTurn: (player["concedeInTurn"] ?? 0) as number,
    };
    if (!["all", "none", "alternate"].includes(policy.attack)) throw new Error(`${where}: player.attack is all, none or alternate`);
    if (!["none", "one", "assign"].includes(policy.block)) throw new Error(`${where}: player.block is none, one or assign`);
    if (!["all", "respond"].includes(policy.play)) throw new Error(`${where}: player.play is all or respond`);
    if (!["cards", "players"].includes(policy.target)) throw new Error(`${where}: player.target is cards or players`);
    if (!Number.isInteger(policy.concedeInTurn) || policy.concedeInTurn < 0) throw new Error(`${where}: player.concedeInTurn is a turn number or 0`);

    const engine = value["engine"] ?? {};
    if (!isObject(engine)) throw new Error(`${where}: engine must be an object`);
    onlyKeys(`${where} engine`, engine, ["language", "cardLanguage", "cardLoading"]);
    const language = (engine["language"] ?? "en-US") as string;
    const cardLanguage = (engine["cardLanguage"] ?? language) as string;
    const cardLoading = (engine["cardLoading"] ?? "eager") as string;
    if (!(ENGINE_LANGUAGES as readonly string[]).includes(language)) throw new Error(`${where}: engine.language is one of ${ENGINE_LANGUAGES.join(", ")}`);
    if (!(ENGINE_LANGUAGES as readonly string[]).includes(cardLanguage)) throw new Error(`${where}: engine.cardLanguage is one of ${ENGINE_LANGUAGES.join(", ")}`);
    if (!(CARD_LOADINGS as readonly string[]).includes(cardLoading)) throw new Error(`${where}: engine.cardLoading is one of ${CARD_LOADINGS.join(", ")}`);

    const wasm = value["wasm"] ?? {};
    if (!isObject(wasm)) throw new Error(`${where}: wasm must be an object`);
    onlyKeys(`${where} wasm`, wasm, ["node", "browser"]);

    const covers = base["covers"] ?? [];
    if (!Array.isArray(covers) || covers.some((c) => typeof c !== "string" || !isCoverageCategory(c))) {
      throw new Error(`${where}: covers lists coverage categories of engine/wasm/spike/trace.ts (unknown: ${(covers as unknown[]).filter((c) => typeof c !== "string" || !isCoverageCategory(c)).join(", ")})`);
    }
    if (variantOf === undefined && covers.length === 0) throw new Error(`${where}: covers must say what the game is for`);

    fixtures.push({
      name,
      description: value["description"],
      sameGameAs: typeof variantOf === "string" ? variantOf : null,
      match: request,
      player: policy,
      engine: { language, cardLanguage, cardLoading },
      wasm: { node: feedings(`${where} wasm.node`, wasm["node"] ?? ["lazy", "eager"]), browser: feedings(`${where} wasm.browser`, wasm["browser"] ?? ["lazy"]) },
      covers: covers as string[],
    });
  }
  return fixtures;
}

export function scenarioOf(fixture: Fixture): Scenario {
  return { format: SCENARIO_FORMAT, name: fixture.name, engine: fixture.engine, player: fixture.player, match: fixture.match };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, outDir] = process.argv.slice(2);
  const fixtures = loadFixtures();
  if (command === "resolve" && outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const fixture of fixtures) {
      fs.writeFileSync(path.join(outDir, `${fixture.name}.scenario.json`), JSON.stringify(scenarioOf(fixture), null, 2) + "\n");
    }
    console.error(`[openmana-engine] ${fixtures.length} Fixtures aufgeloest nach ${outDir}`);
  } else if (command === "list") {
    const list = (l: readonly string[]) => (l.length === 0 ? "-" : l.join(","));
    for (const f of fixtures) {
      console.log([f.name, f.engine.language, f.engine.cardLanguage, f.engine.cardLoading, f.sameGameAs ?? "-", list(f.wasm.node), list(f.wasm.browser)].join("\t"));
    }
  } else {
    console.error("usage: fixtures.ts resolve <out-dir> | list");
    process.exit(2);
  }
}
