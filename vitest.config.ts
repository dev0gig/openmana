/*
 * Unit and component tests (Vitest). The browser app runs in jsdom; files
 * that test Node tooling declare `// @vitest-environment node`.
 *
 * The three build-time modules are replaced by fixed test values
 * (src/test/virtual-*.ts): a test must not depend on whether an engine or a
 * card catalog was built. The real engine and catalog are exercised by the
 * end-to-end test (scripts/e2e/run.ts) in Chrome.
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
      { find: "virtual:openmana-cards", replacement: path.join(root, "src/test/virtual-cards.ts") },
      { find: "virtual:openmana-build", replacement: path.join(root, "src/test/virtual-build.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "vite/**/*.test.ts", "scripts/**/*.test.ts", "cards/**/*.test.ts"],
    restoreMocks: true,
  },
})
