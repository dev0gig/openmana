/*
 * virtual:openmana-build: which app version and Git commit this build is.
 *
 * The commit date stands in for a build time, so the same commit always
 * gives the same bundle (a clock would change every build). Vercel builds
 * without a .git directory fall back to VERCEL_GIT_COMMIT_SHA.
 */
import { execFileSync } from "node:child_process"
import type { Plugin } from "vite"
import type { AppBuildInfo } from "../src/app/build-info-types.ts"

export const BUILD_MODULE_ID = "virtual:openmana-build"
const RESOLVED_BUILD_MODULE_ID = `\0${BUILD_MODULE_ID}`

export function readBuildInfo(root: string, version: string, env: NodeJS.ProcessEnv = process.env): AppBuildInfo {
  const git = (...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  try {
    return {
      version,
      commit: git("rev-parse", "HEAD"),
      commitDate: git("log", "-1", "--format=%cI"),
      // The Forge submodule never enters the app bundle (the engine is a verified
      // artifact), and Vercel's clone leaves it differing from the gitlink.
      modified: git("status", "--porcelain", "--ignore-submodules=all").length > 0,
    }
  } catch {
    return { version, commit: env["VERCEL_GIT_COMMIT_SHA"] || null, commitDate: null, modified: null }
  }
}

export function buildInfo(options: { readonly root: string; readonly version: string }): Plugin {
  let info: AppBuildInfo | null = null
  return {
    name: "openmana:build-info",
    resolveId(id) {
      return id === BUILD_MODULE_ID ? RESOLVED_BUILD_MODULE_ID : null
    },
    load(id) {
      if (id !== RESOLVED_BUILD_MODULE_ID) return null
      info ??= readBuildInfo(options.root, options.version)
      return `export const BUILD_INFO = ${JSON.stringify(info)};\n`
    },
  }
}
