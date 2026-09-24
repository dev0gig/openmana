/*
 * One EngineSession for the whole app, so the engine keeps running while the
 * player moves between pages. Leaving the app (unmount) stops it.
 */
import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { toast } from "sonner"
import { engineAssets } from "./engine-assets"
import { abortTitle } from "./engine-labels"
import { EngineSession, type EngineSessionSnapshot } from "./engine-session"

const EngineSessionContext = createContext<EngineSession | null>(null)

export function EngineSessionProvider({ children, session }: { children: ReactNode; session?: EngineSession }) {
  const [value] = useState(() => session ?? new EngineSession({ assets: engineAssets }))
  useEffect(() => () => value.stop(), [value])
  useAbortToast(value)
  return <EngineSessionContext value={value}>{children}</EngineSessionContext>
}

export function useEngineSession(): { snapshot: EngineSessionSnapshot; start: () => void; stop: () => void } {
  const session = use(EngineSessionContext)
  if (!session) throw new Error("useEngineSession outside EngineSessionProvider")
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  return { snapshot, start: () => session.start(), stop: () => session.stop() }
}

/** A failed engine never disappears silently (Bible §16): also on other pages. */
function useAbortToast(session: EngineSession): void {
  const last = useRef<EngineSessionSnapshot | null>(null)
  useEffect(
    () =>
      session.subscribe(() => {
        const snapshot = session.getSnapshot()
        if (snapshot.status === "aborted" && last.current?.status !== "aborted") {
          toast.error(abortTitle(snapshot.abort), { description: snapshot.abort.message })
        }
        last.current = snapshot
      }),
    [session],
  )
}
