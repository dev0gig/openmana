/* Only interpret the recording's wire envelopes; Forge snapshots remain authoritative. */
import {
  checkEngineInput,
  checkEngineMessage,
  checkMatchRequest,
  type GameEvent,
  type GameState,
  type Question,
} from "@openmana/engine-protocol"
import { PROTOCOL_VERSION } from "@openmana/engine-protocol/generated/constants"
import { SCHEMA_VERSION } from "@/storage/generated/constants"
import type { ReplayDocument } from "@/storage/generated/records"
import { validateReplayDocument } from "@/storage/generated/validators.js"
import type { LocalDatabase } from "@/storage/database"
import { stableJson } from "@/storage/collection"
import { StorageError } from "@/storage/errors"
import { MIGRATIONS, upgradeRecord } from "@/storage/migrations"
import { logRange, pruneMatchTransaction, type StoredMatch } from "@/storage/matches"

export const MAX_REPLAY_BYTES = 100 * 1024 * 1024

export function exportReplay(stored: StoredMatch): Blob {
  const document: ReplayDocument = {
    format: "openmana-replay",
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    match: stored.match,
    log: [...stored.log],
  }
  checkReplay(document)
  return new Blob([JSON.stringify(document)], { type: "application/json" })
}

export function checkReplay(value: unknown): ReplayDocument {
  if (!validateReplayDocument(value))
    throw new StorageError("invalid-record", "Die Datei enthält keine gültige OpenMana-Wiedergabe.")
  if (value.schemaVersion > SCHEMA_VERSION)
    throw new StorageError("backup-unsupported", "Diese Wiedergabe stammt aus einer neueren OpenMana-Version.")
  let previousAt = 0
  value.log.forEach((entry, seq) => {
    if (entry.matchId !== value.match.id || entry.seq !== seq || entry.at < previousAt)
      throw new StorageError(
        "invalid-record",
        "Die Aufzeichnung enthält fremde, fehlende, doppelte oder falsch geordnete Einträge.",
      )
    previousAt = entry.at
    // Historical protocol transcripts travel intact; never reinterpret them with today's shape.
    if (value.match.engine.protocol !== PROTOCOL_VERSION) return
    try {
      if (entry.from === "engine") checkEngineMessage(entry.message)
      else if (entry.message.type === "match.start") checkMatchRequest(entry.message["match"])
      else if (entry.message.type === "recording.boot") {
        if (
          !Array.isArray(entry.message["args"]) ||
          !entry.message["args"].every((v: unknown) => typeof v === "string")
        )
          throw new Error("invalid boot arguments")
      } else checkEngineInput(entry.message)
    } catch {
      throw new StorageError(
        "invalid-record",
        `Eintrag ${seq + 1} enthält keine gültige Nachricht des aufgezeichneten Protokolls.`,
      )
    }
  })
  if (value.match.endedAt !== null && value.match.endedAt < value.match.startedAt)
    throw new StorageError("invalid-record", "Das Ende der Aufzeichnung liegt vor ihrem Beginn.")
  if (value.match.engine.protocol === PROTOCOL_VERSION) {
    const messages = value.log
      .filter((entry) => entry.from === "engine")
      .map((entry) => checkEngineMessage(entry.message))
    const starts = messages.filter((message) => message.type === "game.started")
    if (
      starts.length !== 1 ||
      starts[0]?.protocol !== value.match.engine.protocol ||
      starts[0].format !== value.match.format
    )
      throw new StorageError("invalid-record", "Der passende Beginn der Partie fehlt oder ist mehrfach vorhanden.")
    const ends = messages.filter((message) => message.type === "game.end")
    const aborts = messages.filter((message) => message.type === "engine.abort")
    const end = ends[0]
    if (
      ends.length > 1 ||
      (value.match.status === "finished" &&
        (aborts.length > 0 ||
          end === undefined ||
          value.match.end === null ||
          value.match.endedAt === null ||
          stableJson(value.match.end) !==
            stableJson({ result: end.result, reason: end.reason, turns: end.turns, conceded: end.conceded }))) ||
      (value.match.status === "running" &&
        (ends.length > 0 || aborts.length > 0 || value.match.end !== null || value.match.endedAt !== null)) ||
      (value.match.status === "aborted" &&
        (aborts.length === 0 || value.match.endedAt === null || value.match.end !== null || ends.length > 0))
    )
      throw new StorageError(
        "invalid-record",
        "Die Aufzeichnung ist unvollständig oder ihr Ergebnis stimmt nicht mit Forge überein.",
      )
  }
  return value
}

export async function parseReplay(file: Blob): Promise<ReplayDocument> {
  if (file.size > MAX_REPLAY_BYTES)
    throw new StorageError("invalid-record", "Eine Wiedergabedatei darf höchstens 100 MiB groß sein.")
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new StorageError("invalid-record", "Die Wiedergabedatei enthält kein lesbares JSON.")
  }
  // Check the envelope before upgrading older record shapes. No writes before all validation.
  if (!raw || typeof raw !== "object") throw new StorageError("invalid-record", "Die Datei enthält keine Wiedergabe.")
  const data = raw as ReplayDocument
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1 || data.schemaVersion > SCHEMA_VERSION)
    throw new StorageError("backup-unsupported", "Die Datenversion dieser Wiedergabe wird nicht unterstützt.")
  data.match = upgradeRecord(
    "matches",
    data.match,
    data.schemaVersion,
    SCHEMA_VERSION,
    MIGRATIONS,
  ) as ReplayDocument["match"]
  if (Array.isArray(data.log))
    data.log = data.log.map((entry) =>
      upgradeRecord("matchLog", entry, data.schemaVersion, SCHEMA_VERSION, MIGRATIONS),
    ) as ReplayDocument["log"]
  return checkReplay(data)
}

/** Same id + identical content is a no-op. Conflicts never overwrite a local recording. */
export async function importReplay(db: LocalDatabase, value: ReplayDocument): Promise<"imported" | "existing"> {
  checkReplay(value)
  const result = await db.write(["settings", "matches", "matchLog"], async (tx) => {
    const current: unknown = await tx.objectStore("matches").get(value.match.id)
    if (current !== undefined) {
      const log = await tx.objectStore("matchLog").getAll(logRange(value.match.id))
      if (stableJson(current) === stableJson(value.match) && stableJson(log) === stableJson(value.log))
        return "existing" as const
      throw new StorageError(
        "invalid-record",
        "Eine andere Aufzeichnung mit derselben Kennung ist schon gespeichert. Es wurde nichts überschrieben.",
      )
    }
    await tx.objectStore("matches").add(value.match)
    for (const entry of value.log) await tx.objectStore("matchLog").add(entry)
    await pruneMatchTransaction(tx)
    return "imported" as const
  })
  return result
}

export interface ReplayFrame {
  readonly state: GameState
  readonly questions: readonly Question[]
  readonly history: readonly GameEvent[]
  readonly prompt: string | null
  readonly seq: number
  readonly at: number
  readonly type: string
}

export function replayFrames(stored: StoredMatch): ReplayFrame[] {
  checkReplay({
    format: "openmana-replay",
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    match: stored.match,
    log: [...stored.log],
  })
  if (stored.match.engine.protocol !== PROTOCOL_VERSION)
    throw new StorageError(
      "invalid-record",
      "Diese Aufzeichnung verwendet ein anderes Engine-Protokoll. JSON speichern bleibt verfügbar.",
    )
  let state: GameState | null = null
  let questions: Question[] = []
  let history: GameEvent[] = []
  let prompt: string | null = null
  const frames: ReplayFrame[] = []
  for (const entry of stored.log) {
    if (entry.from === "engine") {
      const message = checkEngineMessage(entry.message)
      switch (message.type) {
        case "state":
          state = message
          break
        case "question":
          questions = [...questions.filter((q) => q.id !== message.id), message]
          break
        case "question.answered":
        case "question.withdrawn":
          questions = questions.filter((q) => q.id !== message.id)
          break
        case "events":
          history = [...history, ...message.entries]
          break
        case "message":
          if (message.kind === "prompt") prompt = message.text.trim() === "" ? null : message.text
          break
        case "game.end":
        case "engine.abort":
          questions = []
          prompt = null
          break
        default:
          break
      }
    }
    if (state !== null)
      frames.push({ state, questions, history, prompt, seq: entry.seq, at: entry.at, type: entry.message.type })
  }
  return frames
}
