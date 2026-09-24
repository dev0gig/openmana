/*
 * Import aliases of the app, shared by vite.config.ts and vitest.config.ts
 * (and mirrored in tsconfig.app.json "paths").
 *
 * The app reaches the engine ONLY through engine/protocol and engine/client
 * (Bible §2: UI -> protocol -> bridge -> Forge); src/app/boundary.test.ts
 * fails on any other import from engine/.
 *
 *   @openmana/engine-client            engine/client (loaded on demand, see engine-session.ts)
 *   @openmana/engine-protocol          engine/protocol: types and everything else
 *   @openmana/engine-protocol/<file>   one file of engine/protocol/src, for code the
 *                                      first page load needs (feature detection,
 *                                      constants) without the schema validators
 */
import path from "node:path"

export interface Alias {
  readonly find: string | RegExp
  readonly replacement: string
}

export function appAliases(root: string): Alias[] {
  return [
    { find: /^@\//, replacement: `${path.join(root, "src")}/` },
    { find: /^@openmana\/engine-client$/, replacement: path.join(root, "engine/client/src/index.ts") },
    { find: /^@openmana\/engine-protocol$/, replacement: path.join(root, "engine/protocol/src/index.ts") },
    { find: /^@openmana\/engine-protocol\/(.+)$/, replacement: `${path.join(root, "engine/protocol/src")}/$1` },
  ]
}
