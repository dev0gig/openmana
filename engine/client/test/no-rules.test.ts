// Guard for "No Magic rules in TypeScript" (prompt 03, Bible §2): the client
// and the hand-written protocol code move and check messages; they never
// look at what a card is or does, which step the game is in or what a button
// pair means. Only ids, question ids/kinds and the engine's own blocking flag
// are read. This test fails as soon as such game content shows up in code.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { BUTTONS_PURPOSES, PHASES } from "../../protocol/src/index.ts";

const engineDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const sources = [
  ...["engine-client.ts", "errors.ts", "worker-port.ts", "node-worker-port.ts", "index.ts"].map((f) => path.join(engineDir, "client", "src", f)),
  ...["validate.ts", "input-queue.ts", "features.ts", "answers.ts", "index.ts"].map((f) => path.join(engineDir, "protocol", "src", f)),
  path.join(engineDir, "wasm", "host", "worker-host.ts"),
];

/** Card, player and turn properties whose meaning is Magic, not transport. */
const GAME_FIELDS = ["power", "toughness", "loyalty", "cost", "typeLine", "colors", "playable", "action", "ways", "highlighted", "tapped", "sick", "attacking", "life", "mana", "landsPlayed", "canAct", "hasPriority", "phase", "turn", "purpose", "key", "counters"];

/** Same name, different meaning; each exception says why. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  // engine.boot's phase (worker-features … java-main) is the start-up progress, not the game's step.
  "wasm/host/worker-host.ts": ["phase"],
};

test("client, protocol code and worker host contain no game content", () => {
  for (const file of sources) {
    const code = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""); // comments may explain, code may not branch
    for (const value of [...PHASES, ...BUTTONS_PURPOSES]) {
      assert.ok(!code.includes(`"${value}"`), `${path.relative(engineDir, file)} names "${value}"`);
    }
    for (const field of GAME_FIELDS) {
      if (ALLOWED[path.relative(engineDir, file)]?.includes(field)) continue;
      const access = new RegExp(`\\.${field}\\b|\\["${field}"\\]`);
      assert.ok(!access.test(code), `${path.relative(engineDir, file)} reads the game field '${field.replace(/\\b.*$/, "")}'`);
    }
  }
});
