/*
 * Starting a game from the deck choice and the AI profile (a preference,
 * src/app/preferences.tsx), shared by the play page ("Partie starten") and
 * the game page ("Neue Partie"): whether a game can start now, what the
 * start button says, and the start itself - draw the AI's deck and profile if
 * they are random, hand the game to the engine session (which boots a fresh
 * engine if none is ready), go to the game page.
 *
 * The button is enabled whenever the decks allow a game and the engine can
 * run here, whatever the engine is doing: a start while it boots waits for
 * it, a start after a failed boot tries again. Its note always says what
 * happens next, so a start never looks like a frozen button.
 */
import { useNavigate } from "react-router"
import { usePreferences } from "@/app/preferences"
import type { PlaySelection } from "@/decks/deck-selection"
import { SELECTION_BLOCKERS } from "@/decks/library-labels"
import { matchInProgress, type EngineSnapshot, type MatchSnapshot } from "@/engine/engine-session"
import { useEngineSession } from "@/engine/engine-session-context"
import { resolveAiProfile, type ResolvedAiProfile } from "./ai-profiles"
import { planGame } from "./match-setup"

/** The game page. */
export const GAME_PATH = "/play/game"

export interface StartInput {
  /** The deck choice as read from the local database. */
  readonly data: "loading" | "error" | "ready"
  readonly noDecks: boolean
  readonly selection: PlaySelection | null
}

export interface StartState {
  readonly enabled: boolean
  /** start: a new game; resume: a game is on its way or running - the button leads to it. */
  readonly action: "start" | "resume"
  /** Why not, or what happens next (German). */
  readonly note: string
}

/** What else a start needs besides the deck choice: the engine and the player's preferences (the AI profile). */
export interface StartContext {
  readonly engine: EngineSnapshot
  readonly match: MatchSnapshot | null
  /** The chosen AI profile resolved against this app's engine; null while the preferences are read. */
  readonly profile: ResolvedAiProfile | null
}

/** The note names the first thing in the way, in the order the player sets a game up: the decks, the AI profile, then the engine. */
export function startState(input: StartInput & StartContext): StartState {
  const blocked = (note: string): StartState => ({ enabled: false, action: "start", note })
  if (matchInProgress(input.match)) return { enabled: true, action: "resume", note: "Eine Partie läuft – sie wartet auf dich." }
  if (input.data === "loading") return blocked("Lese die Decks auf diesem Gerät …")
  if (input.data === "error") return blocked("Die Decks auf diesem Gerät lassen sich gerade nicht lesen.")
  if (input.noDecks) return blocked("Dafür fehlt noch ein Deck.")
  if (input.selection === null) return blocked("Lese die Decks auf diesem Gerät …")
  if (input.selection.blocker !== null) return blocked(SELECTION_BLOCKERS[input.selection.blocker])
  if (input.profile === null) return blocked("Lese die Einstellungen auf diesem Gerät …")
  if (input.profile.status === "missing") return blocked(`Das gewählte KI-Profil „${input.profile.name}“ gibt es in dieser Version nicht mehr – wähle ein anderes.`)
  const engine = input.engine
  if (engine.status === "unavailable") return blocked("Diese App-Version enthält keine Forge-Engine.")
  if (engine.status === "unsupported") return blocked("Dieser Browser kann die Forge-Engine nicht ausführen.")
  const start = (note: string): StartState => ({ enabled: true, action: "start", note })
  switch (engine.status) {
    case "ready":
      return start("Forge ist bereit.")
    case "booting":
      return start("Forge lädt noch – die Partie beginnt, sobald Forge bereit ist.")
    case "aborted":
      return start("Forge wird dafür neu gestartet (einige Sekunden).")
    case "idle":
    case "busy":
      return start("Forge startet dafür (einige Sekunden).")
  }
}

/** The start button's state and action for this deck choice. */
export function useGameStart(input: StartInput): { readonly state: StartState; readonly start: () => void } {
  const session = useEngineSession()
  const preferences = usePreferences()
  const navigate = useNavigate()
  const profile = preferences.status === "loading" ? null : resolveAiProfile(preferences.aiProfile)
  const state = startState({ ...input, engine: session.snapshot.engine, match: session.snapshot.match, profile })
  const start = () => {
    if (!state.enabled) return
    if (state.action === "start") {
      const setup = input.selection === null || profile === null ? null : planGame(input.selection, { profile })
      if (setup === null || !session.startMatch(setup)) return
    }
    void navigate(GAME_PATH)
  }
  return { state, start }
}
