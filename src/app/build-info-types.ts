/*
 * What the build tells the app about itself (virtual:openmana-build, written
 * by vite/build-info.ts). Shared by the Vite plugin (Node) and the app; types only.
 */
export interface AppBuildInfo {
  readonly version: string
  /** Git commit of the app build; null if unknown. */
  readonly commit: string | null
  /** ISO date of that commit (a reproducible build date, unlike "now"); null if unknown. */
  readonly commitDate: string | null
  /** true if the working tree had uncommitted changes; null if unknown. */
  readonly modified: boolean | null
}
