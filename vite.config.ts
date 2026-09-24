/*
 * OpenMana web app: Vite + React + Tailwind (shadcn/ui).
 *
 * - The app talks to Forge only through engine/protocol and engine/client
 *   (aliases below); the built engine comes in through vite/engine-assets.ts.
 * - Every response carries the cross-origin isolation headers the engine
 *   needs (vite/isolation-headers.ts; Vercel: vercel.json).
 *
 * Environment: OPENMANA_ENGINE_DIR (default engine/build/dist) and
 * OPENMANA_ENGINE=omit (build without an engine on purpose).
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { appAliases } from "./vite/aliases.ts"
import { buildInfo } from "./vite/build-info.ts"
import { engineAssets, engineModeFromEnv } from "./vite/engine-assets.ts"
import { ISOLATION_HEADERS } from "./vite/isolation-headers.ts"
import { unwatchedPaths } from "./vite/watch.ts"

const root = import.meta.dirname
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string }

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    engineAssets({
      dir: process.env["OPENMANA_ENGINE_DIR"] ?? path.join(root, "engine/build/dist"),
      mode: engineModeFromEnv(process.env["OPENMANA_ENGINE"]),
    }),
    buildInfo({ root, version }),
  ],
  resolve: {
    alias: appAliases(root),
  },
  server: {
    headers: ISOLATION_HEADERS,
    watch: { ignored: [unwatchedPaths(root)] },
  },
  preview: {
    headers: ISOLATION_HEADERS,
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // React and the router change far less often than the app: an app
          // update keeps this chunk in the browser cache.
          groups: [{ name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ }],
        },
      },
    },
  },
})
