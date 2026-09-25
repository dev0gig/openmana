/*
 * The Forge AI profile the player plays against (prompt 12, Bible §7): the
 * choice as a setting, what it means for the next game, and the draw of a
 * random one.
 *
 * The profiles are Forge's own (res/ai/*.ai of the pinned engine) - what each
 * one changes is verified and written down in ai-profile-table.ts (checked
 * against the engine at build time: vite/engine-assets.ts). The choice is a
 * preference: set once (Settings or the play page), kept, never asked when a
 * game starts (Anvil lesson). "Random" draws one of them for every game, like
 * Forge's own "Random (Every Game)" (a game here is a match of one game).
 */
import { defineSetting } from "@/storage/settings"
import { AI_PROFILE_TABLE, DEFAULT_AI_PROFILE, type AiProfileInfo } from "./ai-profile-table"

export type AiProfileChoice = { readonly kind: "profile"; readonly name: string } | { readonly kind: "random" }

function isAiProfileChoice(value: unknown): value is AiProfileChoice {
  if (typeof value !== "object" || value === null) return false
  const keys = Object.keys(value).sort().join(",")
  const choice = value as { kind?: unknown; name?: unknown }
  if (choice.kind === "random") return keys === "kind"
  return choice.kind === "profile" && keys === "kind,name" && typeof choice.name === "string" && /^[A-Za-z0-9_-]+$/.test(choice.name)
}

/** Forge's default profile until the player chooses another one. */
export const AI_PROFILE = defineSetting<AiProfileChoice>("ai.profile", { kind: "profile", name: DEFAULT_AI_PROFILE }, isAiProfileChoice)

export type ResolvedAiProfile =
  | { readonly status: "ok"; readonly profile: AiProfileInfo }
  /** One of `pool` is drawn when a game starts. */
  | { readonly status: "random"; readonly pool: readonly AiProfileInfo[] }
  /** The stored profile is not one of this engine's (a Forge update removed it): shown, never silently replaced. */
  | { readonly status: "missing"; readonly name: string }

/** What a choice means with this app's engine. */
export function resolveAiProfile(choice: AiProfileChoice, table: readonly AiProfileInfo[] = AI_PROFILE_TABLE): ResolvedAiProfile {
  if (choice.kind === "random") return { status: "random", pool: table }
  const profile = table.find((info) => info.name === choice.name)
  return profile ? { status: "ok", profile } : { status: "missing", name: choice.name }
}

/** One profile of the pool, each equally likely (`random` in [0, 1), Math.random by default). */
export function drawAiProfile(pool: readonly AiProfileInfo[], random: () => number = Math.random): AiProfileInfo {
  if (pool.length === 0) throw new Error("no AI profile to draw from")
  return pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)]!
}

/** The same choice (for highlighting the stored one in a list). */
export function sameAiProfileChoice(a: AiProfileChoice, b: AiProfileChoice): boolean {
  return a.kind === b.kind && (a.kind === "random" || a.name === (b as { readonly name: string }).name)
}
