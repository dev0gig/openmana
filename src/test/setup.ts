/*
 * Test environment (jsdom). jsdom has no layout, so a few browser APIs the
 * shadcn components and the router's scroll restoration call are missing;
 * the stand-ins below answer like a wide screen that never scrolls. They only
 * make rendering possible, they do not change behaviour under test.
 */
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => cleanup())

if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList

  window.scrollTo = () => undefined

  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
}
