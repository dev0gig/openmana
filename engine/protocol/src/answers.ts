/*
 * Typing helpers for answers. The client adds type, seq and question; the UI
 * provides the rest, and TypeScript ties it to the question's kind.
 */
import type { AnswerInput, QuestionKind } from "./generated/protocol.ts";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An answer without the fields the client fills in (type, seq, question). */
export type AnswerBody = DistributiveOmit<AnswerInput, "type" | "seq" | "question">;

/** The answer body for a question of kind K, e.g. AnswerBodyFor<"buttons"> = { kind: "buttons"; button: 1 | 2 }. */
export type AnswerBodyFor<K extends QuestionKind> = Extract<AnswerBody, { kind: K }>;
