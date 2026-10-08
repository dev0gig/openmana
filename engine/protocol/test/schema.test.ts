// The schema is the contract: every message type has a valid example, wrong
// messages are refused with a readable path, full snapshots are complete,
// and schema, generated TypeScript and the Java bridge agree on the version.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkEngineInput,
  checkEngineMessage,
  checkGameState,
  checkMatchRequest,
  checkWorkerCommand,
  inputProblems,
  PROTOCOL_VERSION,
  ProtocolViolation,
  QUESTION_KINDS,
} from "../src/index.ts";
import { card, engineInputs, engineMessages, matchRequest, workerCommands } from "./examples.ts";

const protocolDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = path.resolve(protocolDir, "..");
const schema = JSON.parse(fs.readFileSync(path.join(protocolDir, "schema", "protocol.schema.json"), "utf8"));
const defs = schema.$defs as Record<string, { oneOf?: { $ref: string }[]; properties?: Record<string, { const?: unknown }> }>;
const realStates = JSON.parse(fs.readFileSync(path.join(protocolDir, "test", "fixtures", "real-states.json"), "utf8")).states as unknown[];

function branchConsts(union: string, property: string): unknown[] {
  return defs[union]!.oneOf!.map((b) => defs[b.$ref.replace("#/$defs/", "")]!.properties![property]!.const);
}

function refused(check: (v: unknown) => unknown, value: unknown, pathPattern: RegExp) {
  assert.throws(
    () => check(value),
    (e: unknown) => {
      assert.ok(e instanceof ProtocolViolation, String(e));
      assert.ok(e.problems.some((p) => pathPattern.test(`${p.path} ${p.message}`)), `expected a problem matching ${pathPattern}, got: ${e.message}`);
      return true;
    },
  );
}

describe("valid messages", () => {
  test("every example passes, and every message type of the schema has one", () => {
    engineMessages.forEach((m) => checkEngineMessage(m));
    engineInputs.forEach((m) => checkEngineInput(m));
    workerCommands.forEach((m) => checkWorkerCommand(m));
    checkMatchRequest(matchRequest);
    const covered = (list: { type: string }[]) => new Set(list.map((m) => m.type));
    assert.deepEqual(covered(engineMessages), new Set(branchConsts("EngineMessage", "type")));
    assert.deepEqual(covered(engineInputs), new Set(branchConsts("EngineInput", "type")));
    assert.deepEqual(covered(workerCommands), new Set(branchConsts("WorkerCommand", "type")));
  });

  test("every question kind has a question and an answer, and says whether it blocks", () => {
    const questionKinds = branchConsts("Question", "kind");
    const answerKinds = branchConsts("AnswerInput", "kind");
    assert.deepEqual([...questionKinds].sort(), [...QUESTION_KINDS].sort());
    assert.deepEqual([...answerKinds].sort(), [...QUESTION_KINDS].sort());
    for (const b of defs["Question"]!.oneOf!) {
      const blocking = defs[b.$ref.replace("#/$defs/", "")]!.properties!["blocking"]!.const;
      assert.equal(typeof blocking, "boolean", `${b.$ref} must fix blocking to true or false`);
    }
    const examples = engineMessages.filter((m) => m.type === "question").map((m) => (m as { kind: string }).kind);
    assert.deepEqual(new Set(examples), new Set(QUESTION_KINDS));
    assert.deepEqual(new Set(engineInputs.filter((i) => i.type === "answer").map((i) => (i as { kind: string }).kind)), new Set(QUESTION_KINDS));
  });

  test("real full snapshots from the engine pass", () => {
    assert.ok(realStates.length >= 5);
    realStates.forEach((s) => checkGameState(s));
    realStates.forEach((s) => checkEngineMessage(s));
  });
});

describe("refused messages", () => {
  test("unknown or missing type", () => {
    refused(checkEngineMessage, { type: "frage", id: 1 }, /tag "type" must be in oneOf/);
    refused(checkEngineMessage, { id: 1 }, /type/);
    refused(checkEngineInput, { type: "karte.antippen", seq: 1, card: 3 }, /tag "type"/);
    refused(checkWorkerCommand, { type: "request", id: 1 }, /tag "type"/);
  });

  test("a question without its fields, with a wrong blocking flag or an unknown kind", () => {
    refused(checkEngineMessage, { type: "question", kind: "buttons", id: 3, blocking: false, text: "" }, /must have required property 'buttons'/);
    refused(checkEngineMessage, { type: "question", kind: "confirm", id: 4, blocking: false, text: "", suggested: true }, /\/blocking must be true/);
    refused(checkEngineMessage, { type: "question", kind: "vote", id: 4, blocking: true, text: "" }, /tag "kind"/);
    refused(checkEngineMessage, { type: "question", kind: "buttons", id: 0, blocking: false, text: "", buttons: [] }, /\/id must be >= 1/);
  });

  test("extra properties are not tolerated (the contract is closed)", () => {
    refused(checkEngineMessage, { type: "question.withdrawn", id: 3, reason: "gone" }, /unexpected property 'reason'/);
    refused(checkEngineInput, { type: "card.tap", seq: 1, card: 3, force: true }, /unexpected property 'force'/);
    refused(checkMatchRequest, { ...matchRequest, command: "human-match" }, /unexpected property 'command'/);
  });

  test("inputs: seq from 1, answers carry their kind and only its fields, buttons are 1 or 2", () => {
    refused(checkEngineInput, { type: "state.request", seq: 0 }, /\/seq must be >= 1/);
    refused(checkEngineInput, { type: "concede" }, /seq/);
    refused(checkEngineInput, { type: "answer", seq: 1, question: 3, button: 1 }, /kind/);
    refused(checkEngineInput, { type: "answer", seq: 1, question: 3, kind: "buttons", button: 3 }, /\/button must be one of \[1,2\]/);
    refused(checkEngineInput, { type: "answer", seq: 1, question: 3, kind: "buttons", choices: [1] }, /button/);
    refused(checkEngineInput, { type: "answer", seq: 1, question: 8, kind: "select", choices: [] }, /\/choices/);
    assert.equal(inputProblems({ type: "concede", seq: 5 }), null);
    assert.ok(inputProblems({ type: "concede", seq: -1 })!.length > 0);
  });

  test("a match request needs both seats and non-empty decks", () => {
    refused(checkMatchRequest, { ...matchRequest, ai: undefined }, /must have required property 'ai'/);
    refused(checkMatchRequest, { ...matchRequest, format: "draft" }, /\/format must be one of/);
    refused(checkMatchRequest, { ...matchRequest, human: { name: "Player", deck: { name: "Red", main: [] } } }, /\/human\/deck\/main/);
    refused(checkMatchRequest, { ...matchRequest, human: { name: "Player", deck: { name: "Red", main: [{ card: " ", count: 1 }] } } }, /\/human\/deck\/main\/0\/card/);
    refused(checkMatchRequest, { ...matchRequest, human: { name: "Player", deck: { name: "Red", main: [{ card: "Shock", count: 0 }] } } }, /count must be >= 1/);
  });
});

describe("full snapshots", () => {
  const base = realStates[realStates.length - 1] as Record<string, unknown>;

  test("a state without any of its parts is refused: snapshots are never partial", () => {
    for (const field of ["seq", "running", "turn", "phase", "activePlayer", "me", "players", "stack", "combat"]) {
      const partial = { ...base };
      delete partial[field];
      refused(checkGameState, partial, new RegExp(`must have required property '${field}'`));
    }
    const players = base["players"] as Record<string, unknown>[];
    for (const field of ["zones", "library", "mana", "life", "commanders"]) {
      const player = { ...players[0]! };
      delete player[field];
      refused(checkGameState, { ...base, players: [player, players[1]] }, new RegExp(`/players/0 must have required property '${field}'`));
    }
    const zones = { ...(players[0]!["zones"] as Record<string, unknown>) };
    delete zones["exile"];
    refused(checkGameState, { ...base, players: [{ ...players[0], zones }, players[1]] }, /\/players\/0\/zones must have required property 'exile'/);
  });

  test("a hidden card is only {hidden: true}: an id or a name would reveal it", () => {
    const players = base["players"] as Record<string, unknown>[];
    const leak = (hiddenCard: object) => ({
      ...base,
      players: [players[0], { ...players[1], zones: { ...(players[1]!["zones"] as object), hand: [hiddenCard] } }],
    });
    checkGameState(leak({ hidden: true }));
    refused(checkGameState, leak({ hidden: true, id: 17 }), /unexpected property 'id'|must have required property/);
    refused(checkGameState, leak({ hidden: true, name: "Shock" }), /unexpected property 'name'|must have required property/);
    refused(checkGameState, leak({ id: 17 }), /must have required property/);
  });

  test("card markers are Forge's flags, present only when true", () => {
    checkEngineMessage({ type: "message", kind: "prompt", text: "", card: card.id, cardView: card });
    refused(checkEngineMessage, { type: "message", kind: "prompt", text: "", cardView: { ...card, playable: false } }, /playable must be true/);
    checkEngineMessage({ type: "message", kind: "prompt", text: "", cardView: { ...card, colors: "", printedColors: "G" } });
    refused(checkEngineMessage, { type: "message", kind: "prompt", text: "", cardView: { ...card, colors: "RW" } }, /colors/);
    checkEngineMessage({ type: "message", kind: "prompt", text: "", cardView: { ...card, colors: "WR", printedColors: "" } });
  });
});

describe("one version everywhere", () => {
  test("schema, generated constant and the bridge's Protocol.VERSION agree", () => {
    assert.equal(schema.$defs.ProtocolVersion.const, PROTOCOL_VERSION);
    const java = fs.readFileSync(path.join(engineDir, "bridge", "src", "main", "java", "org", "openmana", "engine", "bridge", "Protocol.java"), "utf8");
    const match = /public static final int VERSION = (\d+);/.exec(java);
    assert.ok(match, "Protocol.java must declare `public static final int VERSION = <n>;`");
    assert.equal(Number(match[1]), PROTOCOL_VERSION, "bump the schema's ProtocolVersion and Protocol.VERSION together");
  });

  test("the generated files are exactly what the schema gives", () => {
    execFileSync(process.execPath, [path.join(protocolDir, "scripts", "generate.mjs"), "--check"], { stdio: "pipe" });
  });
});
