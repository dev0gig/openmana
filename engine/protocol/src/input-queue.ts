/*
 * The input queue: page -> engine worker, over a SharedArrayBuffer.
 *
 * Why not postMessage: Forge waits for the player deep inside its own Java
 * stack. In WebAssembly that stack lives on the worker's only thread, so the
 * worker cannot return to its event loop to receive a message while Forge
 * waits. It blocks in Atomics.wait on this buffer instead; the page writes the
 * next input and wakes it with Atomics.notify (research: OPENMANA_ENGINE_PLAN
 * §3.4). The other direction (engine -> page) is plain postMessage.
 *
 * One writer (the page's EngineClient), one reader (the worker host). The
 * writer never blocks (the page's main thread may not); the reader blocks
 * only when the queue is empty. The queue is bounded: if an input does not
 * fit, write() throws InputQueueError("full") and nothing is written - the
 * caller must surface that, never drop the input silently.
 *
 * Layout (all Int32, little-endian like every platform JavaScript runs on):
 *
 *   header, 8 slots = 32 bytes
 *     [0] magic 0x4f4d5155 ("OMQU")      [1] layout version (INPUT_QUEUE_LAYOUT)
 *     [2] capacity of the data area       [3] write position (bytes ever written)
 *     [4] read position (bytes ever read) [5] records written
 *     [6] records read                    [7] reserved (0)
 *   data area, `capacity` bytes (a power of two), used as a ring
 *
 * A record is a 4-byte little-endian length L followed by L bytes of UTF-8
 * JSON (one EngineInput). Records may wrap around the end of the ring. The
 * positions only grow (modulo 2^32); used bytes = write - read, the byte
 * index is position & (capacity - 1). The writer publishes a record by
 * storing the new write position with Atomics.store after copying the bytes;
 * the reader's Atomics.load of that position makes the bytes visible to it
 * (JavaScript's memory model: sequentially consistent atomics synchronise).
 *
 * The page creates the queue and hands `buffer` to the worker in
 * engine.start; the worker attaches a reader, which checks magic, layout
 * version and capacity and refuses anything else loudly.
 */

export const INPUT_QUEUE_MAGIC = 0x4f4d5155;
export const INPUT_QUEUE_LAYOUT = 1;
export const INPUT_QUEUE_HEADER_BYTES = 32;
export const DEFAULT_INPUT_QUEUE_CAPACITY = 64 * 1024;
export const MIN_INPUT_QUEUE_CAPACITY = 64;
export const MAX_INPUT_QUEUE_CAPACITY = 16 * 1024 * 1024;
/** Bytes of the length prefix of every record. */
export const INPUT_RECORD_HEADER_BYTES = 4;

const SLOT_MAGIC = 0;
const SLOT_LAYOUT = 1;
const SLOT_CAPACITY = 2;
const SLOT_WRITE = 3;
const SLOT_READ = 4;
const SLOT_WRITTEN = 5;
const SLOT_READ_COUNT = 6;

export type InputQueueErrorCode = "full" | "too-large" | "empty" | "layout" | "corrupt";

/** A loud failure of the input queue. */
export class InputQueueError extends Error {
  readonly code: InputQueueErrorCode;

  constructor(code: InputQueueErrorCode, message: string) {
    super(message);
    this.name = "InputQueueError";
    this.code = code;
  }
}

/** Page side. Never blocks. */
export interface InputQueueWriter {
  /** Hand this to the worker (engine.start). */
  readonly buffer: SharedArrayBuffer;
  readonly capacity: number;
  /**
   * Appends one input (JSON text) and wakes the reader. Returns the number
   * of the record (1 = first record ever written to this queue). Throws
   * InputQueueError: "full" if the free space is too small right now
   * (nothing written), "too-large" if it could never fit, "empty".
   */
  write(text: string): number;
  /** Records written so far. */
  readonly written: number;
  /** Records the reader has taken so far. */
  readonly read: number;
  /** Bytes currently free (a record needs 4 + its UTF-8 length). */
  freeBytes(): number;
}

/** Worker side. */
export interface InputQueueReader {
  readonly capacity: number;
  /** The next input, or null if the queue is empty. Never blocks. */
  tryRead(): string | null;
  /**
   * The next input; blocks with Atomics.wait while the queue is empty (not
   * allowed on a browser's main thread). With a timeout, null if nothing
   * arrived in time.
   */
  read(timeoutMs?: number): string | null;
  /** Records taken so far. */
  readonly consumed: number;
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function sharedArrayBufferAvailable(): boolean {
  return typeof SharedArrayBuffer === "function";
}

interface Views {
  readonly header: Int32Array;
  readonly data: Uint8Array;
  readonly capacity: number;
}

function views(buffer: SharedArrayBuffer): Views {
  if (!sharedArrayBufferAvailable() || !(buffer instanceof SharedArrayBuffer)) {
    throw new InputQueueError("layout", "the input queue needs a SharedArrayBuffer (cross-origin isolation)");
  }
  if (buffer.byteLength < INPUT_QUEUE_HEADER_BYTES + MIN_INPUT_QUEUE_CAPACITY) {
    throw new InputQueueError("layout", `the input queue buffer is too small (${buffer.byteLength} bytes)`);
  }
  const header = new Int32Array(buffer, 0, INPUT_QUEUE_HEADER_BYTES / 4);
  const magic = Atomics.load(header, SLOT_MAGIC) >>> 0;
  const layout = Atomics.load(header, SLOT_LAYOUT);
  const capacity = Atomics.load(header, SLOT_CAPACITY);
  if (magic !== INPUT_QUEUE_MAGIC) {
    throw new InputQueueError("layout", `not an OpenMana input queue (magic 0x${magic.toString(16)})`);
  }
  if (layout !== INPUT_QUEUE_LAYOUT) {
    throw new InputQueueError("layout", `input queue layout ${layout}, this side speaks layout ${INPUT_QUEUE_LAYOUT}`);
  }
  if (!isPowerOfTwo(capacity) || INPUT_QUEUE_HEADER_BYTES + capacity !== buffer.byteLength) {
    throw new InputQueueError("layout", `input queue capacity ${capacity} does not match the buffer (${buffer.byteLength} bytes)`);
  }
  return { header, data: new Uint8Array(buffer, INPUT_QUEUE_HEADER_BYTES, capacity), capacity };
}

/** Copies `bytes` into the ring at `position` (wrapping). */
function copyIn(data: Uint8Array, capacity: number, position: number, bytes: Uint8Array): void {
  const start = position & (capacity - 1);
  const first = Math.min(bytes.length, capacity - start);
  data.set(bytes.subarray(0, first), start);
  if (first < bytes.length) {
    data.set(bytes.subarray(first), 0);
  }
}

/** Copies `length` bytes out of the ring at `position` into a fresh, unshared array. */
function copyOut(data: Uint8Array, capacity: number, position: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  const start = position & (capacity - 1);
  const first = Math.min(length, capacity - start);
  out.set(data.subarray(start, start + first), 0);
  if (first < length) {
    out.set(data.subarray(0, length - first), first);
  }
  return out;
}

function lengthPrefix(length: number): Uint8Array {
  const prefix = new Uint8Array(INPUT_RECORD_HEADER_BYTES);
  new DataView(prefix.buffer).setUint32(0, length, true);
  return prefix;
}

/** Page side: a new, empty queue. `capacity` must be a power of two (64 bytes … 16 MiB). */
export function createInputQueue(capacity: number = DEFAULT_INPUT_QUEUE_CAPACITY): InputQueueWriter {
  if (!sharedArrayBufferAvailable()) {
    throw new InputQueueError("layout", "SharedArrayBuffer is not available (the page must be cross-origin isolated)");
  }
  if (!isPowerOfTwo(capacity) || capacity < MIN_INPUT_QUEUE_CAPACITY || capacity > MAX_INPUT_QUEUE_CAPACITY) {
    throw new InputQueueError(
      "layout",
      `input queue capacity must be a power of two between ${MIN_INPUT_QUEUE_CAPACITY} and ${MAX_INPUT_QUEUE_CAPACITY} bytes, got ${capacity}`,
    );
  }
  const buffer = new SharedArrayBuffer(INPUT_QUEUE_HEADER_BYTES + capacity);
  const header = new Int32Array(buffer, 0, INPUT_QUEUE_HEADER_BYTES / 4);
  Atomics.store(header, SLOT_CAPACITY, capacity);
  Atomics.store(header, SLOT_LAYOUT, INPUT_QUEUE_LAYOUT);
  // Magic last: a reader never sees a half-initialised header as valid.
  Atomics.store(header, SLOT_MAGIC, INPUT_QUEUE_MAGIC | 0);
  return inputQueueWriter(buffer);
}

/** Page side of an existing queue buffer (validated). */
export function inputQueueWriter(buffer: SharedArrayBuffer): InputQueueWriter {
  const { header, data, capacity } = views(buffer);
  const encoder = new TextEncoder();
  const maxPayload = capacity - INPUT_RECORD_HEADER_BYTES;

  function used(): number {
    const write = Atomics.load(header, SLOT_WRITE);
    const read = Atomics.load(header, SLOT_READ);
    const bytes = (write - read) >>> 0;
    if (bytes > capacity) {
      throw new InputQueueError("corrupt", `input queue positions are inconsistent (${bytes} bytes used of ${capacity})`);
    }
    return bytes;
  }

  return {
    buffer,
    capacity,
    get written() {
      return Atomics.load(header, SLOT_WRITTEN) >>> 0;
    },
    get read() {
      return Atomics.load(header, SLOT_READ_COUNT) >>> 0;
    },
    freeBytes() {
      return capacity - used();
    },
    write(text: string): number {
      const payload = encoder.encode(text);
      if (payload.length === 0) {
        throw new InputQueueError("empty", "an empty input cannot be written");
      }
      if (payload.length > maxPayload) {
        throw new InputQueueError(
          "too-large",
          `an input of ${payload.length} bytes can never fit into the input queue (at most ${maxPayload} bytes per input)`,
        );
      }
      const need = INPUT_RECORD_HEADER_BYTES + payload.length;
      const free = capacity - used();
      if (need > free) {
        throw new InputQueueError(
          "full",
          `the input queue is full: the engine has not read the pending inputs yet (${need} bytes needed, ${free} free)`,
        );
      }
      const write = Atomics.load(header, SLOT_WRITE);
      copyIn(data, capacity, write, lengthPrefix(payload.length));
      copyIn(data, capacity, write + INPUT_RECORD_HEADER_BYTES, payload);
      // Publish: after this store the reader may take the record.
      Atomics.store(header, SLOT_WRITE, (write + need) | 0);
      const number = (Atomics.add(header, SLOT_WRITTEN, 1) + 1) >>> 0;
      Atomics.notify(header, SLOT_WRITE);
      return number;
    },
  };
}

/** Worker side of the queue buffer received in engine.start (validated). */
export function inputQueueReader(buffer: SharedArrayBuffer): InputQueueReader {
  const { header, data, capacity } = views(buffer);
  const decoder = new TextDecoder("utf-8", { fatal: true });

  function take(): string | null {
    const read = Atomics.load(header, SLOT_READ);
    const write = Atomics.load(header, SLOT_WRITE);
    const available = (write - read) >>> 0;
    if (available === 0) {
      return null;
    }
    if (available > capacity || available < INPUT_RECORD_HEADER_BYTES) {
      throw new InputQueueError("corrupt", `input queue positions are inconsistent (${available} bytes available)`);
    }
    const prefix = copyOut(data, capacity, read, INPUT_RECORD_HEADER_BYTES);
    const length = new DataView(prefix.buffer).getUint32(0, true);
    if (length === 0 || INPUT_RECORD_HEADER_BYTES + length > available) {
      throw new InputQueueError("corrupt", `input queue record of ${length} bytes, but only ${available} bytes were written`);
    }
    // TextDecoder refuses views on shared memory: decode a copy.
    let text: string;
    try {
      text = decoder.decode(copyOut(data, capacity, read + INPUT_RECORD_HEADER_BYTES, length));
    } catch (e) {
      throw new InputQueueError("corrupt", `input queue record is not valid UTF-8: ${String(e)}`);
    }
    Atomics.store(header, SLOT_READ, (read + INPUT_RECORD_HEADER_BYTES + length) | 0);
    Atomics.add(header, SLOT_READ_COUNT, 1);
    return text;
  }

  return {
    capacity,
    get consumed() {
      return Atomics.load(header, SLOT_READ_COUNT) >>> 0;
    },
    tryRead: take,
    read(timeoutMs?: number): string | null {
      const deadline = timeoutMs === undefined ? Infinity : Date.now() + timeoutMs;
      for (;;) {
        const text = take();
        if (text !== null) {
          return text;
        }
        const write = Atomics.load(header, SLOT_WRITE);
        if (write !== Atomics.load(header, SLOT_READ)) {
          continue;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          return null;
        }
        // Sleeps while the write position is unchanged; wakes on notify.
        Atomics.wait(header, SLOT_WRITE, write, remaining === Infinity ? undefined : remaining);
      }
    },
  };
}
