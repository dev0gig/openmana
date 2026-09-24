// Input queue (page -> engine) on one thread: layout checks, FIFO order,
// records wrapping around the end of the ring, loud overflow, corruption.
// The two-thread test with a blocking reader is input-queue-threads.test.ts.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createInputQueue,
  DEFAULT_INPUT_QUEUE_CAPACITY,
  INPUT_QUEUE_HEADER_BYTES,
  INPUT_QUEUE_LAYOUT,
  INPUT_QUEUE_MAGIC,
  InputQueueError,
  inputQueueReader,
  inputQueueWriter,
} from "../src/index.ts";

function queueError(code: string) {
  return (e: unknown) => e instanceof InputQueueError && e.code === code;
}

/** Small deterministic PRNG (mulberry32), so failures are reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("layout", () => {
  test("a new queue has the documented header and the default capacity", () => {
    const writer = createInputQueue();
    assert.equal(writer.capacity, DEFAULT_INPUT_QUEUE_CAPACITY);
    assert.equal(writer.buffer.byteLength, INPUT_QUEUE_HEADER_BYTES + DEFAULT_INPUT_QUEUE_CAPACITY);
    const header = new Int32Array(writer.buffer, 0, 8);
    assert.equal(header[0]! >>> 0, INPUT_QUEUE_MAGIC);
    assert.equal(header[1], INPUT_QUEUE_LAYOUT);
    assert.equal(header[2], DEFAULT_INPUT_QUEUE_CAPACITY);
    assert.deepEqual([header[3], header[4], header[5], header[6], header[7]], [0, 0, 0, 0, 0]);
  });

  test("capacity must be a power of two between 64 bytes and 16 MiB", () => {
    for (const bad of [0, 32, 100, 1000, 3 * 1024, 32 * 1024 * 1024, -64, 64.5]) {
      assert.throws(() => createInputQueue(bad), queueError("layout"), `capacity ${bad}`);
    }
    for (const good of [64, 256, 4096, 16 * 1024 * 1024]) {
      assert.equal(createInputQueue(good).capacity, good);
    }
  });

  test("the reader refuses a buffer that is not an OpenMana queue of this layout", () => {
    const writer = createInputQueue(256);
    const header = new Int32Array(writer.buffer, 0, 8);

    assert.throws(() => inputQueueReader(new ArrayBuffer(512) as unknown as SharedArrayBuffer), queueError("layout"));
    assert.throws(() => inputQueueReader(new SharedArrayBuffer(16)), queueError("layout"));
    assert.throws(() => inputQueueReader(new SharedArrayBuffer(INPUT_QUEUE_HEADER_BYTES + 256)), /not an OpenMana input queue/);

    Atomics.store(header, 1, INPUT_QUEUE_LAYOUT + 1);
    assert.throws(() => inputQueueReader(writer.buffer), /layout 2, this side speaks layout 1/);
    Atomics.store(header, 1, INPUT_QUEUE_LAYOUT);

    Atomics.store(header, 2, 128);
    assert.throws(() => inputQueueReader(writer.buffer), /capacity 128 does not match the buffer/);
    Atomics.store(header, 2, 256);

    assert.equal(inputQueueReader(writer.buffer).capacity, 256);
    assert.equal(inputQueueWriter(writer.buffer).capacity, 256);
  });
});

describe("records", () => {
  test("inputs come out in the order they went in, with counts on both sides", () => {
    const writer = createInputQueue(1024);
    const reader = inputQueueReader(writer.buffer);
    assert.equal(reader.tryRead(), null);
    const texts = ['{"type":"state.request","seq":1}', '{"type":"card.tap","seq":2,"card":17}', '{"type":"concede","seq":3}'];
    texts.forEach((t, i) => assert.equal(writer.write(t), i + 1));
    assert.equal(writer.written, 3);
    assert.equal(writer.read, 0);
    assert.deepEqual([reader.tryRead(), reader.tryRead(), reader.tryRead()], texts);
    assert.equal(reader.tryRead(), null);
    assert.equal(reader.consumed, 3);
    assert.equal(writer.read, 3);
    assert.equal(writer.freeBytes(), 1024);
  });

  test("records that wrap around the end of the ring, multi-byte UTF-8 split included, come back intact", () => {
    const writer = createInputQueue(64);
    const reader = inputQueueReader(writer.buffer);
    // 40 + 4 bytes, read; the next records start at byte 44 and must wrap.
    writer.write("x".repeat(40));
    assert.equal(reader.tryRead(), "x".repeat(40));
    const umlauts = "Zauberspruch: äöü ß €€ 🂡"; // 2-, 3- and 4-byte characters
    assert.ok(new TextEncoder().encode(umlauts).length > 20);
    writer.write(umlauts);
    assert.equal(reader.tryRead(), umlauts);
    // Length prefix itself split across the boundary at every offset.
    for (let pad = 1; pad <= 60; pad++) {
      writer.write("p".repeat(pad));
      assert.equal(reader.tryRead(), "p".repeat(pad));
      writer.write("äöü");
      assert.equal(reader.tryRead(), "äöü");
    }
  });

  test("a full queue refuses loudly and writes nothing; after reading there is room again", () => {
    const writer = createInputQueue(64);
    const reader = inputQueueReader(writer.buffer);
    const record = "r".repeat(12); // 16 bytes with its length prefix
    for (let i = 0; i < 4; i++) writer.write(record);
    assert.equal(writer.freeBytes(), 0);
    const before = new Uint8Array(writer.buffer.slice(0));
    assert.throws(() => writer.write("r"), (e: unknown) => queueError("full")(e) && /queue is full/.test((e as Error).message));
    assert.deepEqual(new Uint8Array(writer.buffer.slice(0)), before, "a refused write must not change a single byte");
    assert.equal(writer.written, 4);
    assert.equal(reader.tryRead(), record);
    writer.write(record);
    assert.equal(writer.written, 5);
    for (let i = 0; i < 4; i++) assert.equal(reader.tryRead(), record);
    assert.equal(reader.tryRead(), null);
  });

  test("an input that could never fit is refused as too large, an empty one as empty", () => {
    const writer = createInputQueue(64);
    assert.throws(() => writer.write("y".repeat(61)), queueError("too-large"));
    assert.equal(writer.write("y".repeat(60)), 1, "60 bytes + 4 byte prefix = exactly the capacity");
    assert.throws(() => writer.write(""), queueError("empty"));
  });

  test("read() with a timeout returns null when nothing arrives", () => {
    const writer = createInputQueue(64);
    const reader = inputQueueReader(writer.buffer);
    const start = Date.now();
    assert.equal(reader.read(30), null);
    assert.ok(Date.now() - start >= 25);
    writer.write("a");
    assert.equal(reader.read(30), "a");
  });

  test("inconsistent positions or a broken record are reported as corrupt, not read", () => {
    const writer = createInputQueue(64);
    const reader = inputQueueReader(writer.buffer);
    const header = new Int32Array(writer.buffer, 0, 8);
    Atomics.store(header, 3, 200); // write position far beyond the capacity
    assert.throws(() => reader.tryRead(), queueError("corrupt"));
    assert.throws(() => writer.write("a"), queueError("corrupt"));
    Atomics.store(header, 3, 8); // 8 bytes "written" whose length prefix says 0
    assert.throws(() => reader.tryRead(), /record of 0 bytes/);
    const data = new DataView(writer.buffer, INPUT_QUEUE_HEADER_BYTES);
    data.setUint32(0, 50, true); // says 50 bytes, only 4 follow
    assert.throws(() => reader.tryRead(), /record of 50 bytes, but only 8 bytes were written/);
    data.setUint32(0, 4, true);
    new Uint8Array(writer.buffer, INPUT_QUEUE_HEADER_BYTES + 4, 4).set([0xff, 0xfe, 0xfd, 0xfc]);
    assert.throws(() => reader.tryRead(), /not valid UTF-8/);
  });

  test("random traffic matches a simple model (sizes, wrap-around, refusals)", () => {
    const random = prng(20260924);
    const writer = createInputQueue(256);
    const reader = inputQueueReader(writer.buffer);
    const model: string[] = [];
    let used = 0;
    let refused = 0;
    let wrapped = 0;
    for (let step = 0; step < 20000; step++) {
      if (random() < 0.55) {
        const size = 1 + Math.floor(random() * 120);
        const text = JSON.stringify({ type: "card.tap", seq: step + 1, card: size }) + "ä".repeat(Math.floor(size / 3));
        const need = 4 + new TextEncoder().encode(text).length;
        if (need > 256) {
          assert.throws(() => writer.write(text), queueError("too-large"));
        } else if (used + need > 256) {
          assert.throws(() => writer.write(text), queueError("full"));
          refused++;
        } else {
          const header = new Int32Array(writer.buffer, 0, 8);
          const start = Atomics.load(header, 3) & 255;
          if (start + need > 256) wrapped++;
          writer.write(text);
          model.push(text);
          used += need;
        }
      } else {
        const text = reader.tryRead();
        const expected = model.shift();
        assert.equal(text, expected ?? null);
        if (expected !== undefined) used -= 4 + new TextEncoder().encode(expected).length;
      }
      assert.equal(writer.freeBytes(), 256 - used);
    }
    assert.ok(refused > 100, `refusals exercised (${refused})`);
    assert.ok(wrapped > 100, `wrap-around exercised (${wrapped})`);
  });
});
