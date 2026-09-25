/*
 * Test environment (jsdom). jsdom has no layout, so a few browser APIs the
 * shadcn components and the router's scroll restoration call are missing;
 * the stand-ins below answer like a wide screen that never scrolls. They only
 * make rendering possible, they do not change behaviour under test.
 *
 * IndexedDB: jsdom has none. fake-indexeddb is a complete implementation of
 * the IndexedDB API in memory (the usual way to test IndexedDB code in
 * Node); every test gets a new, empty one. The real browser database is
 * exercised by the end-to-end test in Chrome.
 */
import "fake-indexeddb/auto"
import "@testing-library/jest-dom/vitest"
import { cleanup, configure } from "@testing-library/react"
import { IDBFactory } from "fake-indexeddb"
import { toast } from "sonner"
import { afterEach, beforeEach } from "vitest"

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

// findBy…/waitFor wait up to 5 s instead of 1 s: pages that load on demand
// (React Router lazy routes) are transformed on first use, which on a busy
// machine took longer than a second. Passing tests are not slower for it.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => {
  // sonner keeps active toasts in a module-wide store and replays them to the
  // next Toaster: without this, a toast of one test shows up in the next.
  toast.dismiss()
  cleanup()
})

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
