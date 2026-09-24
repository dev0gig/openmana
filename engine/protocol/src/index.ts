/*
 * engine/protocol: the only contract between the OpenMana UI and the engine.
 *
 * - types and constants generated from schema/protocol.schema.json
 * - runtime validation against that schema (validate.ts)
 * - the SharedArrayBuffer input queue page -> worker (input-queue.ts)
 * - feature detection (features.ts)
 *
 * Nothing in here knows a Magic rule; it moves and checks messages.
 */
export type * from "./generated/protocol.ts";
export * from "./generated/constants.ts";
export type { SchemaError, Validator } from "./generated/validators.js";
export * from "./validate.ts";
export * from "./input-queue.ts";
export * from "./features.ts";
export type * from "./answers.ts";
