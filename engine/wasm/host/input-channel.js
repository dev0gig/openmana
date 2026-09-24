/*
 * OpenMana engine: the input mailbox from the page to the engine worker
 * (spike form of prompt 02; prompt 03 turns it into the versioned protocol).
 *
 * Forge waits for the player deep inside its own Java stack. In WebAssembly
 * that stack lives on the worker's only thread, so the worker cannot go back
 * to its event loop to receive a postMessage while Forge waits. Instead it
 * blocks in Atomics.wait on a SharedArrayBuffer; the page writes the next
 * input there and wakes it with Atomics.notify. That needs cross-origin
 * isolation (COOP/COEP), which feature-detect.js checks before anything starts.
 *
 * Layout of the SharedArrayBuffer:
 *   Int32 [0]   state: 0 = empty (the page may write), 1 = full (the worker may read)
 *   Int32 [1]   length of the payload in bytes
 *   byte 8 …    payload: one input message as UTF-8 JSON text
 *
 * Handshake: the worker posts { type: "input.wait", n } right before it
 * blocks, and the page answers every input.wait with exactly one write().
 * One slot is enough because Forge asks for one input at a time.
 *
 * Plain script: loaded with importScripts(), require() or <script>. Exposes
 * globalThis.OpenManaInputChannel.
 */
(function () {
  "use strict";

  const HEADER_BYTES = 8;
  const EMPTY = 0;
  const FULL = 1;
  const DEFAULT_CAPACITY = 64 * 1024;

  function views(buffer) {
    if (typeof SharedArrayBuffer === "undefined" || !(buffer instanceof SharedArrayBuffer)) {
      throw new Error("the input channel needs a SharedArrayBuffer (cross-origin isolation)");
    }
    return { control: new Int32Array(buffer, 0, 2), payload: new Uint8Array(buffer, HEADER_BYTES) };
  }

  /** Page side: a new channel; hand `buffer` to the worker in its start message. */
  function create(capacity) {
    return writer(new SharedArrayBuffer(HEADER_BYTES + (capacity || DEFAULT_CAPACITY)));
  }

  /** Page side of an existing buffer. */
  function writer(buffer) {
    const { control, payload } = views(buffer);
    const encoder = new TextEncoder();
    return {
      buffer,
      /** Writes one input (JSON text) and wakes the worker. Never overwrites an unread input. */
      write(text) {
        const bytes = encoder.encode(text);
        if (bytes.length > payload.length) {
          throw new Error("an input of " + bytes.length + " bytes does not fit into the input channel (" + payload.length + " bytes)");
        }
        if (Atomics.load(control, 0) !== EMPTY) {
          throw new Error("the engine has not read the previous input yet");
        }
        payload.set(bytes);
        Atomics.store(control, 1, bytes.length);
        Atomics.store(control, 0, FULL);
        Atomics.notify(control, 0);
      },
    };
  }

  /** Worker side: read() blocks until the page has written an input and returns its text. */
  function reader(buffer) {
    const { control, payload } = views(buffer);
    const decoder = new TextDecoder();
    return {
      read() {
        while (Atomics.load(control, 0) !== FULL) {
          Atomics.wait(control, 0, EMPTY);
        }
        const length = Atomics.load(control, 1);
        // TextDecoder refuses views on shared memory: decode a copy.
        const text = decoder.decode(payload.slice(0, length));
        Atomics.store(control, 0, EMPTY);
        return text;
      },
    };
  }

  globalThis.OpenManaInputChannel = { create, writer, reader, DEFAULT_CAPACITY };
})();
