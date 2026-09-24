/*
 * Cross-origin isolation for every response of the app.
 *
 * Forge runs as WebAssembly in a Dedicated Worker and waits for the player's
 * input with Atomics.wait on a SharedArrayBuffer (engine/protocol). Browsers
 * only offer SharedArrayBuffer to cross-origin isolated pages, i.e. pages
 * served with COOP same-origin + COEP require-corp (research
 * OPENMANA_ENGINE_PLAN.md §7). Without them the engine cannot start; the
 * app then says so instead of hanging (engine/protocol/src/features.ts).
 *
 * CORP same-origin keeps other sites from embedding OpenMana's own files; it
 * matches the engine's test server (engine/wasm/test/serve.mjs).
 *
 * One source for the dev server, `vite preview` and Vercel: vercel.json must
 * carry exactly these headers on every route (vite/deployment.test.ts).
 */
export const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const satisfies Record<string, string>
