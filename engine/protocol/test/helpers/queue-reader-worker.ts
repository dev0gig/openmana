// Worker thread for input-queue-threads.test.ts: blocks in read() like the
// engine worker does while Forge waits, and reports what it read.
import { parentPort, workerData } from "node:worker_threads";
import { inputQueueReader } from "../../src/index.ts";

const { buffer, expected } = workerData as { buffer: SharedArrayBuffer; expected: number };
const reader = inputQueueReader(buffer);
let checksum = 0;
let blocked = 0;
const lengths: number[] = [];
for (let i = 0; i < expected; i++) {
  let text = reader.tryRead();
  if (text === null) {
    blocked++;
    text = reader.read(10_000);
    if (text === null) {
      parentPort!.postMessage({ error: `nothing arrived for input ${i + 1} within 10 s` });
      process.exit(1);
    }
  }
  const input = JSON.parse(text) as { seq: number };
  if (input.seq !== i + 1) {
    parentPort!.postMessage({ error: `input ${i + 1} arrived as seq ${input.seq}` });
    process.exit(1);
  }
  for (let c = 0; c < text.length; c++) checksum = (Math.imul(checksum, 31) + text.charCodeAt(c)) | 0;
  lengths.push(text.length);
}
parentPort!.postMessage({ checksum, blocked, consumed: reader.consumed, lengths: lengths.length });
