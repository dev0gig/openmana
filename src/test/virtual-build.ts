/* Test stand-in for virtual:openmana-build (vitest.config.ts). */
import type { AppBuildInfo } from "@/app/build-info-types"

export const BUILD_INFO: AppBuildInfo = { version: "0.0.0-test", commit: null, commitDate: null, modified: null }
