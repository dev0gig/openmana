/*
 * One EngineSession for the whole app, so the engine and a running game keep
 * going while the player moves between pages. Leaving the app (unmount)
 * stops them.
 *
 * A running game lives only in this page (research §8, Bible §6: no
 * recovery yet): while one is on its way or running, closing or reloading
 * the page asks first (the browser's own "leave page?" dialog).
 */
import { createContext, use, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { toast } from "sonner"
import { engineAssets } from "./engine-assets"
import { abortTitle } from "./engine-labels"
import type { AnswerBody, ManaColor } from "@openmana/engine-protocol"
import { EngineSession, matchInProgress, type ConcedeResult, type EngineBootOptions, type EngineSessionSnapshot, type InputResult, type MatchSetup } from "./engine-session"

const EngineSessionContext = createContext<EngineSession | null>(null)

export function EngineSessionProvider({ children, session }: { children: ReactNode; session?: EngineSession }) {
  const [value] = useState(() => session ?? new EngineSession({ assets: engineAssets }))
  useEffect(() => () => value.stop(), [value])
  useAbortToast(value)
  useLeaveGuard(value)
  return <EngineSessionContext value={value}>{children}</EngineSessionContext>
}

export interface EngineSessionHandle {
  readonly snapshot: EngineSessionSnapshot
  /** Loads the engine on request (idle or after an abort). */
  readonly start: () => void
  /** Boots the engine ahead of a game (only from idle). */
  readonly prewarm: () => void
  readonly stop: () => void
  readonly startMatch: (setup: MatchSetup) => boolean
  readonly cancelMatch: () => void
  readonly concede: () => ConcedeResult
  /** Taps a card for the player (Forge's card.tap); only where Forge offers it (src/game/card-use.ts). */
  readonly tapCard: (card: number) => InputResult
  /** Taps a player for the player (Forge's player.tap, prompt 17); only where Forge's running input takes them (src/game/card-use.ts). */
  readonly tapPlayer: (player: number) => InputResult
  /** Pays with floating mana during Forge's payment (mana.use, prompt 17). */
  readonly useMana: (color: ManaColor) => InputResult
  /** Answers one of Forge's questions for the player (prompt 15: src/game/decision-panel.tsx builds the answer). */
  readonly answer: (question: number, body: AnswerBody) => InputResult
  readonly abortMatch: () => void
}

export function useEngineSession(): EngineSessionHandle {
  const session = use(EngineSessionContext)
  if (!session) throw new Error("useEngineSession outside EngineSessionProvider")
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  // Stable functions: pages call them from effects.
  const actions = useMemo(
    () => ({
      start: () => session.start(),
      prewarm: () => session.prewarm(),
      stop: () => session.stop(),
      startMatch: (setup: MatchSetup) => session.startMatch(setup),
      cancelMatch: () => session.cancelMatch(),
      concede: () => session.concede(),
      tapCard: (card: number) => session.tapCard(card),
      tapPlayer: (player: number) => session.tapPlayer(player),
      useMana: (color: ManaColor) => session.useMana(color),
      answer: (question: number, body: AnswerBody) => session.answer(question, body),
      abortMatch: () => session.abortMatch(),
    }),
    [session],
  )
  return { snapshot, ...actions }
}

/**
 * Hands the player's preferences for the engine's start to the session
 * (src/app/preferences.tsx; null while they are being read): the next boot
 * uses them, a warm engine no game uses yet is replaced (EngineSession.setBootOptions).
 */
export function useEngineBootOptions(options: EngineBootOptions | null): void {
  const session = use(EngineSessionContext)
  if (!session) throw new Error("useEngineBootOptions outside EngineSessionProvider")
  const cardLanguage = options?.cardLanguage ?? null
  useEffect(() => {
    if (cardLanguage !== null) session.setBootOptions({ cardLanguage })
  }, [session, cardLanguage])
}

/**
 * A failed engine never disappears silently (Bible §16): also on other pages.
 * One such toast at a time - a new failure replaces the last one's toast
 * instead of stacking the same message behind it.
 */
function useAbortToast(session: EngineSession): void {
  const last = useRef<EngineSessionSnapshot | null>(null)
  useEffect(
    () =>
      session.subscribe(() => {
        const { engine } = session.getSnapshot()
        if (engine.status === "aborted" && last.current?.engine.status !== "aborted") {
          toast.error(abortTitle(engine.abort), { id: "engine-abort", description: engine.abort.message })
        }
        last.current = session.getSnapshot()
      }),
    [session],
  )
}

/** Asks before the page is closed or reloaded while a game is on its way or running: that would end it. */
function useLeaveGuard(session: EngineSession): void {
  const playing = useSyncExternalStore(session.subscribe, () => matchInProgress(session.getSnapshot().match))
  useEffect(() => {
    if (!playing) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older browsers show the dialog only with a returnValue (its text is the browser's own).
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [playing])
}
