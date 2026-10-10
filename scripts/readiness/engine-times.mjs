#!/usr/bin/env node
// Engine and AI response times of real games, from readiness runs
// (scripts/readiness/matches.ts). Used to compare the Oracle and the open
// engine build under the same conditions (Prompt 34).
//
// Source: the portable replay JSON a run writes (one per run when a single game
// is selected with --games) - every engine message and player input with its
// reception time `at` (ms since the game started, taken by the app's recorder).
//
//   response   time from a player input (answer, card.tap, player.tap) to the
//              next engine.waiting: everything Forge computes before it asks
//              the player again
//   AI turn    a response during which a state shows the AI as active player:
//              Forge plays the AI's turn (or part of it) before asking again
//
// Plus, from each run's report.json: startMs (start button to the first
// question of Forge, includes downloading/booting the engine) and the game's
// total time.
//
//   node scripts/readiness/engine-times.mjs <readiness-out-dir>... > times.json
import fs from "node:fs";
import path from "node:path";

const INPUTS = new Set(["answer", "card.tap", "player.tap"]);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round = (value) => (value === null ? null : Math.round(value));

function responses(log) {
  const result = [];
  let open = null;
  for (const entry of [...log].sort((a, b) => a.seq - b.seq)) {
    const type = entry.message?.type;
    if (entry.from === "player" && INPUTS.has(type)) {
      if (open === null) open = { at: entry.at, ai: false };
    } else if (open !== null && type === "state" && entry.message.activePlayer !== null && entry.message.activePlayer !== entry.message.me) {
      open.ai = true;
    } else if (open !== null && type === "engine.waiting") {
      result.push({ ms: entry.at - open.at, ai: open.ai });
      open = null;
    }
  }
  return result;
}

const dirs = process.argv.slice(2);
if (!dirs.length) throw new Error("Usage: engine-times.mjs <readiness-out-dir>...");
const games = {};
const all = [];
const ai = [];
const starts = [];
for (const dir of dirs) {
  const report = JSON.parse(fs.readFileSync(path.join(dir, "report.json"), "utf8"));
  for (const file of fs.readdirSync(dir).filter((name) => /^replay-.*\.json$/.test(name))) {
    const replay = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const [id, entry] = Object.entries(report.games).find(([, game]) => game.recording?.id === replay.match.id) ?? [];
    if (!id) throw new Error(`${dir}/${file}: no game of report.json recorded it`);
    const times = responses(replay.log);
    const aiTimes = times.filter((t) => t.ai).map((t) => t.ms);
    all.push(...times.map((t) => t.ms));
    ai.push(...aiTimes);
    if (typeof entry.startMs === "number") starts.push(entry.startMs);
    games[id] = {
      dir,
      result: entry.result,
      turns: entry.turns,
      gameMs: entry.ms,
      startMs: entry.startMs,
      manifestSha256: replay.match.engine?.manifestSha256 ?? entry.recording?.manifestSha256 ?? null,
      responses: times.length,
      responseMedianMs: round(median(times.map((t) => t.ms))),
      aiTurns: aiTimes.length,
      aiTurnMedianMs: round(median(aiTimes)),
    };
  }
}
console.log(JSON.stringify({
  format: "openmana-engine-times/1",
  games,
  pooled: {
    games: Object.keys(games).length,
    responses: all.length,
    responseMedianMs: round(median(all)),
    aiTurns: ai.length,
    aiTurnMedianMs: round(median(ai)),
    startMedianMs: round(median(starts)),
  },
}, null, 2));
