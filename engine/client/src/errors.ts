/*
 * Loud failures of the client API. Nothing the UI sends may disappear
 * silently (Bible §16): an input the client can already tell is wrong is
 * refused synchronously with an EngineInputError; everything else the
 * engine rejects later with an input.rejected message carrying the seq.
 */

/**
 * Why the client refused an input without sending it.
 * - no-match: no game is running (not started yet, over, or aborted)
 * - unknown-question: the engine never asked a question with this id
 * - stale: the question was withdrawn or already answered
 * - not-active: a blocking question is open and must be answered first
 * - wrong-kind: the answer is for another kind of question
 * - unknown-card / unknown-player: not visible / not in the latest state
 * - malformed: the input does not conform to the protocol schema
 * - queue-full: the engine has not read the pending inputs yet (try again when it waits)
 * - too-large: the input can never fit into the input queue
 */
export type EngineInputErrorReason =
  | "no-match"
  | "unknown-question"
  | "stale"
  | "not-active"
  | "wrong-kind"
  | "unknown-card"
  | "unknown-player"
  | "malformed"
  | "queue-full"
  | "too-large";

export class EngineInputError extends Error {
  readonly reason: EngineInputErrorReason;

  constructor(reason: EngineInputErrorReason, message: string) {
    super(message);
    this.name = "EngineInputError";
    this.reason = reason;
  }
}

/** The client was used in a way its lifecycle does not allow (a UI bug, not a game event). */
export type EngineClientErrorCode = "already-started" | "not-started" | "not-ready" | "invalid-request" | "closed";

export class EngineClientError extends Error {
  readonly code: EngineClientErrorCode;

  constructor(code: EngineClientErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EngineClientError";
    this.code = code;
  }
}
