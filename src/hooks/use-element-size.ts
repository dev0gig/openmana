/*
 * The size of an element's content box (inside padding and border), kept
 * current (ResizeObserver) - like useElementHeight, measured once before the
 * first paint too (layout effect), so a layout that depends on it is right
 * from the start. null until measured, and always null where there is no
 * layout (tests in jsdom): callers then fall back to their default.
 */
import { useLayoutEffect, useState, type RefObject } from "react"

export interface ElementSize {
  readonly width: number
  readonly height: number
}

export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const measure = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      const next = { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 }
      setSize((previous) => (previous !== null && previous.width === next.width && previous.height === next.height ? previous : next))
    }
    const style = getComputedStyle(element)
    const padding = (a: string, b: string) => (Number.parseFloat(a) || 0) + (Number.parseFloat(b) || 0)
    measure(element.clientWidth - padding(style.paddingLeft, style.paddingRight), element.clientHeight - padding(style.paddingTop, style.paddingBottom))
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry !== undefined) measure(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}
