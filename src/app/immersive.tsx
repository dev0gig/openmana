/*
 * The whole screen for one page (prompt 13): while a game runs, the game
 * table takes the screen - no sidebar, no top bar, no tab bar (Design System
 * §4: the table has its own full-screen layout). A page asks for it with
 * useImmersive(true) while it shows the table; the app shell hides its frame
 * as long as the page does. The page then offers its own way around the app
 * (the game's menu); leaving the page gives the frame back.
 */
import { createContext, use, useLayoutEffect, useState, type ReactNode } from "react"

type SetImmersive = (immersive: boolean) => void

const ImmersiveContext = createContext<{ readonly immersive: boolean; readonly set: SetImmersive }>({ immersive: false, set: () => undefined })

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, set] = useState(false)
  return <ImmersiveContext value={{ immersive, set }}>{children}</ImmersiveContext>
}

/** The app shell: whether a page wants the whole screen right now. */
export function useIsImmersive(): boolean {
  return use(ImmersiveContext).immersive
}

/**
 * A page: take the whole screen while `on` (and give it back when `on` ends
 * or the page goes). A layout effect, so the frame is gone before the page
 * is painted.
 */
export function useImmersive(on: boolean): void {
  const { set } = use(ImmersiveContext)
  useLayoutEffect(() => {
    if (!on) return
    set(true)
    return () => set(false)
  }, [on, set])
}
