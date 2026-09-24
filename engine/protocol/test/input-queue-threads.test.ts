// Input queue across two real threads: the reader blocks in Atomics.wait
// (as the engine worker does while Forge waits for the player), the writer
// never blocks and backs off when the queue is full. Thousands of inputs of
// random size must arrive complete, in order and exactly once.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import { createInputQueue, InputQueueError } from "../src/index.ts";

test("a blocking reader thread receives every input in order while the writer backs off on a full queue", async () => {
  const total = 5000;
  const writer = createInputQueue(512);
  const worker = new Worker(new URL("./helpers/queue-reader-worker.ts", import.meta.url), {
    workerData: { buffer: writer.buffer, expected: total },
  });
  const done = new Promise<{ checksum: number; blocked: number; consumed: number; error?: string }>((resolve, reject) => {
    worker.once("message", resolve);
    worker.once("error", reject);
  });

  let checksum = 0;
  let full = 0;
  let seed = 7;
  for (let seq = 1; seq <= total; ) {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    const text = JSON.stringify({ type: "answer", seq, question: seq, kind: "input", value: "€".repeat(seed % 40) });
    try {
      writer.write(text);
    } catch (e) {
      assert.ok(e instanceof InputQueueError && e.code === "full", String(e));
      full++;
      // The page never blocks: give the reader time, then try the same input again.
      await new Promise((resolve) => setImmediate(resolve));
      continue;
    }
    for (let c = 0; c < text.length; c++) checksum = (Math.imul(checksum, 31) + text.charCodeAt(c)) | 0;
    // Now and then let the queue run empty, so the reader must block and be woken.
    if (seq % 250 === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    seq++;
  }

  const result = await done;
  await worker.terminate();
  assert.equal(result.error, undefined, result.error);
  assert.equal(result.consumed, total);
  assert.equal(result.checksum, checksum, "every input arrived unchanged and in order");
  assert.equal(writer.written, total);
  assert.equal(writer.read, total);
  assert.ok(full > 0, "the writer met a full queue at least once");
  assert.ok(result.blocked > 0, "the reader had to block at least once");
});
