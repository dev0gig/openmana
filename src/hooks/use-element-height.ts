/*
 * The rendered height of an element, kept current (ResizeObserver). Measured
 * once before the first paint too (layout effect), so a layout that depends
 * on it is right from the start - no first frame in the wrong arrangement
 * (whose pictures the browser would start loading, then drop). null until
 * measured, and always null where there is no layout (tests in jsdom):
 * callers then fall back to their default arrangement.
 */
import { useLayoutEffect, useState, type RefObject } from "react"

export function useElementHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const measure = (value: number) => {
      if (value > 0) setHeight(Math.round(value))
    }
    measure(element.getBoundingClientRect().height)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry !== undefined) measure(entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return height
}
