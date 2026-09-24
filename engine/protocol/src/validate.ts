/*
 * Runtime checks against the protocol schema.
 *
 * The validators are generated from protocol.schema.json (Ajv standalone
 * code, see scripts/generate.mjs). This module only turns their verdict into
 * something loud and readable: a ProtocolViolation that names the offending
 * paths, instead of a boolean nobody looks at.
 */
import {
  validateEngineInput,
  validateEngineMessage,
  validateGameState,
  validateMatchRequest,
  validateWorkerCommand,
  type SchemaError,
  type Validator,
} from "./generated/validators.js";
import type { EngineInput, EngineMessage, GameState, MatchRequest, WorkerCommand } from "./generated/protocol.ts";

/** One problem with a message: where (JSON pointer) and what. */
export interface SchemaProblem {
  readonly path: string;
  readonly message: string;
}

/** A value does not conform to the protocol schema. */
export class ProtocolViolation extends Error {
  readonly what: string;
  readonly problems: readonly SchemaProblem[];

  constructor(what: string, problems: readonly SchemaProblem[]) {
    super(`${what} does not conform to the OpenMana protocol: ${formatProblems(problems)}`);
    this.name = "ProtocolViolation";
    this.what = what;
    this.problems = problems;
  }
}

function describe(error: SchemaError): SchemaProblem {
  const params = error.params;
  let message = error.message ?? error.keyword;
  if (error.keyword === "additionalProperties" && typeof params["additionalProperty"] === "string") {
    message = `unexpected property '${params["additionalProperty"]}'`;
  } else if (error.keyword === "enum" && Array.isArray(params["allowedValues"])) {
    message = `must be one of ${JSON.stringify(params["allowedValues"])}`;
  } else if (error.keyword === "const" && "allowedValue" in params) {
    message = `must be ${JSON.stringify(params["allowedValue"])}`;
  }
  return { path: error.instancePath === "" ? "/" : error.instancePath, message };
}

/** "path: message; …" with at most `max` entries. */
export function formatProblems(problems: readonly SchemaProblem[], max = 6): string {
  const shown = problems.slice(0, max).map((p) => `${p.path}: ${p.message}`);
  if (problems.length > max) {
    shown.push(`… and ${problems.length - max} more`);
  }
  return shown.join("; ");
}

/**
 * The problems the validator found in its last call. Ajv reports the failed
 * branches of unions too; the discriminator already picked the right branch,
 * so duplicates are removed and the list stays short.
 */
function problemsOf(validator: Validator<unknown>): SchemaProblem[] {
  const seen = new Set<string>();
  const problems: SchemaProblem[] = [];
  for (const error of validator.errors ?? []) {
    const problem = describe(error);
    const key = `${problem.path} ${problem.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      problems.push(problem);
    }
  }
  return problems.length > 0 ? problems : [{ path: "/", message: "invalid" }];
}

function checker<T>(validator: Validator<T>, what: (value: unknown) => string) {
  return (value: unknown): T => {
    if (validator(value)) {
      return value;
    }
    throw new ProtocolViolation(what(value), problemsOf(validator as Validator<unknown>));
  };
}

function typeName(value: unknown): string {
  if (value !== null && typeof value === "object" && typeof (value as { type?: unknown }).type === "string") {
    return `'${(value as { type: string }).type}'`;
  }
  return "a message without type";
}

/** Everything the worker posts to the page. Throws ProtocolViolation. */
export const checkEngineMessage: (value: unknown) => EngineMessage = checker(
  validateEngineMessage,
  (v) => `engine message ${typeName(v)}`,
);

/** An input for the queue. Throws ProtocolViolation. */
export const checkEngineInput: (value: unknown) => EngineInput = checker(
  validateEngineInput,
  (v) => `input ${typeName(v)}`,
);

/** A command for the worker. Throws ProtocolViolation. */
export const checkWorkerCommand: (value: unknown) => WorkerCommand = checker(
  validateWorkerCommand,
  (v) => `worker command ${typeName(v)}`,
);

/** A match request. Throws ProtocolViolation. */
export const checkMatchRequest: (value: unknown) => MatchRequest = checker(validateMatchRequest, () => "match request");

/** A single full state (tests, diagnostics). Throws ProtocolViolation. */
export const checkGameState: (value: unknown) => GameState = checker(validateGameState, () => "state");

/** The problems of a value that is not a valid input, or null if it is valid. */
export function inputProblems(value: unknown): readonly SchemaProblem[] | null {
  return validateEngineInput(value) ? null : problemsOf(validateEngineInput as Validator<unknown>);
}
