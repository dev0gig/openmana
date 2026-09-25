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
import { EngineSession, matchInProgress, type ConcedeResult, type EngineSessionSnapshot, type MatchSetup } from "./engine-session"

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
      abortMatch: () => session.abortMatch(),
    }),
    [session],
  )
  return { snapshot, ...actions }
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
