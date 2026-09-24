/*
 * Unit and component tests (Vitest). The browser app runs in jsdom; files
 * that test Node tooling declare `// @vitest-environment node`.
 *
 * The two build-time modules are replaced by fixed test values
 * (src/test/virtual-*.ts): a test must not depend on whether an engine was
 * built. The real engine is exercised by the end-to-end test
 * (scripts/e2e/run.mjs) in Chrome.
 */
import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { appAliases } from "./vite/aliases.ts"

const root = import.meta.dirname

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...appAliases(root),
      { find: "virtual:openmana-engine", replacement: path.join(root, "src/test/virtual-engine.ts") },
      { find: "virtual:openmana-build", replacement: path.join(root, "src/test/virtual-build.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "vite/**/*.test.ts", "scripts/**/*.test.ts"],
    restoreMocks: true,
  },
})
