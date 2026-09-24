/*
 * The engine this build ships (or why it ships none), from the build
 * (vite/engine-assets.ts). The only place the app reads the virtual module.
 */
import { ENGINE_ASSETS } from "virtual:openmana-engine"
import type { EngineAssets } from "./engine-assets-types"

export const engineAssets: EngineAssets = ENGINE_ASSETS
