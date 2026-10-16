/*
 * The recorded whole games for the match report's tests (prompt 62):
 * src/test/fixtures/report-games.json.gz, written by
 * scripts/record-report-games.ts from the fixture games of the engine's
 * differential tests (Forge's messages unchanged, the player's inputs where
 * Forge read them; the header built). Read with Node (the tests run in Node).
 */
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"
import type { ReplayDocument } from "@/storage/generated/records"

export interface ReportGame {
  readonly name: string
  readonly why: string
  readonly replay: ReplayDocument
}

let cached: readonly ReportGame[] | null = null

/** The five games, each time a fresh copy (tests may change theirs). */
export function reportGames(): ReportGame[] {
  cached ??= (
    JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(import.meta.dirname, "fixtures/report-games.json.gz"))).toString("utf8")) as {
      readonly games: readonly ReportGame[]
    }
  ).games
  return structuredClone(cached) as ReportGame[]
}

export function reportGame(name: string): ReportGame {
  const game = reportGames().find((each) => each.name === name)
  if (game === undefined) throw new Error(`no recorded report game ${name}`)
  return game
}
