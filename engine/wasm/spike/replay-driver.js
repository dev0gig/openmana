/*
 * Replays a human-vs-AI game recorded on the JVM against the Wasm engine and
 * judges the outcome (prompt 02). Shared by the spike page (browser) and
 * engine/wasm/test/node-replay.mjs.
 *
 * The transcript (format openmana-input-transcript/1) comes from
 * JvmHumanMatchMain: the request (seed, decks), every input the scripted
 * player gave, and the JVM result. The driver plays the part of the page:
 * whenever the worker reports input.wait, it writes the next recorded input
 * into the SharedArrayBuffer channel. It knows no Magic rules and makes no
 * decisions; Forge in the worker does all the playing.
 *
 * Passed only if the Wasm game ends exactly like the JVM game: same Forge
 * game log (hash), same decision messages (questions with ids, withdrawals,
 * rejections; hash), same calls from Forge into the GUI (counted by method),
 * same number of inputs, turns and result, no Forge errors, no work on other
 * threads, and the opponent's hand never visible.
 *
 * Plain script. Exposes globalThis.OpenManaReplay.
 */
(function () {
  "use strict";

  const FORMAT = "openmana-input-transcript/1";
  // forgeCallbacks: Forge's calls into the GUI by method. Differs if Forge
  // events stop arriving in the image (reflection metadata missing).
  const SAME_AS_JVM = ["logSha256", "logEntries", "protocolSha256", "protocolMessages", "forgeCallbacks", "inputs", "turns", "result", "winner", "reason", "conceded"];

  /**
   * @param transcript the recorded game
   * @param channel    writer of input-channel.js (page side)
   */
  function start(transcript, channel) {
    if (!transcript || transcript.format !== FORMAT) {
      throw new Error("not an OpenMana input transcript (expected format " + FORMAT + ")");
    }
    const inputs = transcript.inputs;
    const counters = {};
    let sent = 0;
    let problem = null;

    const count = (key) => {
      counters[key] = (counters[key] || 0) + 1;
    };

    return {
      /** The engine request that starts the recorded game. */
      request: Object.assign({ command: "human-match" }, transcript.request),
      counters,
      sent: () => sent,
      problem: () => problem,

      /** A bridge message from the engine (worker message type "protocol"). */
      protocol(message) {
        count("emit:" + message.type);
        if (message.type === "question") {
          count("question:" + message.kind);
        } else if (message.type === "input.rejected") {
          count("rejected:" + message.reason);
        } else if (message.type === "state") {
          for (const player of message.players) {
            if (player.me) continue;
            for (const card of player.zones.hand) {
              count(card.hidden ? "state:opponent-hand-hidden" : "state:opponent-hand-visible");
              if ("id" in card || "name" in card || "key" in card) count("state:opponent-hand-leak");
            }
          }
        }
      },

      /**
       * The engine blocks for input number n (from 1). Writes the recorded
       * input. Returns false if there is none: the game went differently.
       */
      inputWait(n) {
        if (problem) {
          return false;
        }
        if (n !== sent + 1) {
          problem = "the engine asked for input #" + n + " while #" + (sent + 1) + " was due";
        } else if (sent >= inputs.length) {
          problem = "the engine waits for input #" + n + ", but the JVM game ended after " + inputs.length + " inputs";
        }
        if (problem) {
          return false;
        }
        channel.write(JSON.stringify(inputs[sent]));
        sent += 1;
        return true;
      },

      /** Compares the engine's final response with the JVM result. */
      judge(response) {
        const failures = [];
        if (problem) failures.push(problem);
        if (!response || !response.ok) {
          failures.push("the engine did not finish the game: " + (response ? response.error + "\n" + (response.stack || "") : "no response"));
          return { ok: false, failures, inputsSent: sent, counters, result: null };
        }
        const result = response.result;
        const expected = transcript.expected;
        for (const key of SAME_AS_JVM) {
          if (JSON.stringify(result[key]) !== JSON.stringify(expected[key])) {
            failures.push(key + ": wasm " + JSON.stringify(result[key]) + " != jvm " + JSON.stringify(expected[key]));
          }
        }
        if (sent !== inputs.length) failures.push("only " + sent + " of " + inputs.length + " recorded inputs were used");
        if (result.forgeErrors.length > 0) failures.push("Forge errors: " + result.forgeErrors.join(" | "));
        if (result.threadViolations.length > 0) failures.push("work on other threads: " + result.threadViolations.join(" | "));
        const reasons = new Set(Object.keys(counters).concat(Object.keys(transcript.counters)).filter((k) => k.startsWith("rejected:")));
        for (const key of reasons) {
          if ((counters[key] || 0) !== (transcript.counters[key] || 0)) {
            failures.push(key + ": wasm " + (counters[key] || 0) + " != jvm " + (transcript.counters[key] || 0));
          }
        }
        if (counters["state:opponent-hand-visible"] || counters["state:opponent-hand-leak"]) {
          failures.push("the opponent's hand was visible in a state message");
        }
        if (!counters["state:opponent-hand-hidden"]) failures.push("no state message showed the opponent's hidden hand");
        return { ok: failures.length === 0, failures, inputsSent: sent, counters, result };
      },
    };
  }

  globalThis.OpenManaReplay = { start, FORMAT };
})();
