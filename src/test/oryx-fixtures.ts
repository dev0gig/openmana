/*
 * A small stand-in for the ORYX cloud (the Supabase endpoints the ORYX SDK
 * uses: the games table, the OAuth client config, cloud_saves and the
 * oryx_put_save RPC with its revision check), and the SDK's test hook `env`
 * (its window, address, storage, clock and fetch), so tests drive the real,
 * unchanged SDK (src/cloud/oryx-sdk.js) against it - modelled on the SDK's
 * own tests (oryx-games/shared/oryx-sdk.test.mjs). Sample data only.
 */
import { webcrypto } from "node:crypto"
import { createOryx, type Oryx, type OryxOptions } from "@/cloud/oryx-sdk.js"
import { ORYX_OPTIONS } from "@/cloud/cloud-sync"

export const REAL_ADDRESS = "https://openmana.oryx.quest/settings"
export const LOCAL_ADDRESS = "http://localhost:5173/settings"
const CLIENT_ID = "00000000-0000-4000-8000-00000000c11e"
const ACCESS = "test-access-token"
/** The code ORYX's consent page hands back in the stand-in. */
export const TEST_CODE = "test-authorization-code"

export interface CloudRow {
  revision: number
  save_version: number
  save_data: unknown
  data_hash: string
  summary: unknown
  playtime_ms: number | null
  device_label: string | null
  updated_at: string
  deleted_at: string | null
}

export interface FakeOryxCloud {
  /** Slot → the row cloud_saves holds. */
  readonly rows: Map<string, CloudRow>
  /** "METHOD /path" of every request, in order. */
  readonly calls: string[]
  /** What each accepted oryx_put_save stored (p_data), in order. */
  readonly uploads: unknown[]
  /** What the SDK told the cloud about backup problems (oryx_report_sync): start and end. */
  readonly reports: { ok: boolean; error: string | null }[]
  /** null: ORYX has no OAuth client for OpenMana yet. */
  clientId: string | null
  maxSaveBytes: number
  syncEnabled: boolean
  fetch(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number; text(): Promise<string> }>
}

export function fakeOryxCloud(): FakeOryxCloud {
  const cloud: FakeOryxCloud = {
    rows: new Map(),
    calls: [],
    uploads: [],
    reports: [],
    clientId: CLIENT_ID,
    maxSaveBytes: 1_048_576,
    syncEnabled: true,
    async fetch(url, init = {}) {
      const address = new URL(url)
      const method = init.method ?? "GET"
      cloud.calls.push(`${method} ${address.pathname}`)
      const reply = (status: number, json?: unknown) => ({ ok: status < 300, status, text: async () => (json === undefined ? "" : JSON.stringify(json)) })
      const body = init.body && init.headers?.["Content-Type"]?.includes("json") ? (JSON.parse(init.body) as Record<string, unknown>) : {}
      if (address.pathname === "/rest/v1/games") return reply(200, cloud.clientId === null ? [] : [{ oauth_client_id: cloud.clientId, active: true }])
      if (address.pathname === "/auth/v1/logout") return reply(204)
      if (address.pathname === "/auth/v1/oauth/token") {
        // The code of the return from the consent page (the PKCE check itself is the end-to-end test's).
        const form = new URLSearchParams(init.body ?? "")
        if (form.get("grant_type") !== "authorization_code" || form.get("code") !== TEST_CODE || form.get("client_id") !== cloud.clientId) {
          return reply(400, { error: "invalid_grant" })
        }
        return reply(200, { access_token: ACCESS, refresh_token: "test-refresh-token", expires_in: 3600, token_type: "bearer" })
      }
      if (init.headers?.["Authorization"] !== `Bearer ${ACCESS}`) return reply(401, { message: "JWT expired" })
      if (address.pathname === "/rest/v1/rpc/oryx_client_config") {
        return reply(200, { ok: true, sync_enabled: cloud.syncEnabled, max_slots: 2, max_save_bytes: cloud.maxSaveBytes })
      }
      if (address.pathname === "/rest/v1/cloud_saves") {
        const row = cloud.rows.get((address.searchParams.get("slot") ?? "").replace(/^eq\./, ""))
        return reply(200, row ? [{ ...row }] : [])
      }
      if (address.pathname === "/rest/v1/rpc/oryx_add_playtime") return reply(200, { ok: true })
      // oryx-sdk 1.1.0: play time as a growing total per device, and the start and end of a backup problem.
      if (address.pathname === "/rest/v1/rpc/oryx_report_playtime") return reply(200, { ok: true, added_ms: 0 })
      if (address.pathname === "/rest/v1/rpc/oryx_report_sync") {
        cloud.reports.push({ ok: body["p_ok"] === true, error: (body["p_error"] as string | null) ?? null })
        return reply(200, { ok: true })
      }
      if (address.pathname === "/rest/v1/rpc/oryx_put_save") {
        if (!cloud.syncEnabled) return reply(200, { ok: false, error: "sync_disabled" })
        if (JSON.stringify(body["p_data"]).length > cloud.maxSaveBytes) return reply(200, { ok: false, error: "too_large" })
        const slot = String(body["p_slot"])
        const row = cloud.rows.get(slot)
        const next = {
          save_version: Number(body["p_save_version"]),
          save_data: body["p_data"],
          data_hash: String(body["p_data_hash"]),
          summary: body["p_summary"] ?? null,
          playtime_ms: (body["p_playtime_ms"] as number | null) ?? null,
          device_label: (body["p_device_label"] as string | null) ?? null,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        }
        if (!row) {
          if (body["p_base_revision"] !== 0) return reply(200, { ok: false, error: "conflict", revision: 0 })
          cloud.rows.set(slot, { revision: 1, ...next })
        } else {
          if (row.save_version > next.save_version) return reply(200, { ok: false, error: "newer_version" })
          if (row.revision !== body["p_base_revision"]) return reply(200, { ok: false, error: "conflict", revision: row.revision })
          Object.assign(row, { revision: row.revision + 1, ...next })
        }
        cloud.uploads.push(body["p_data"])
        return reply(200, { ok: true, revision: cloud.rows.get(slot)!.revision })
      }
      return reply(404, { message: `not in the fake: ${method} ${address.pathname}` })
    },
  }
  return cloud
}

/** The in-memory stand-in for the browser's Web Storage the SDK keeps its connection in. */
export class MemoryStorage {
  readonly #map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.#map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, String(value))
  }
  removeItem(key: string): void {
    this.#map.delete(key)
  }
  keys(): string[] {
    return [...this.#map.keys()]
  }
}

/** A device that connected before: the SDK's tokens (valid for an hour) as it keeps them. */
export function connectedStorage(): MemoryStorage {
  const storage = new MemoryStorage()
  storage.setItem(
    "oryx.openmana.auth",
    JSON.stringify({ access: ACCESS, refresh: "test-refresh-token", expiresAt: Date.now() + 3_600_000, user: { id: "00000000-0000-4000-8000-0000000000a1", email: "spieler@example.invalid" } }),
  )
  storage.setItem("oryx.openmana.config", JSON.stringify({ clientId: CLIENT_ID }))
  return storage
}

export interface TestOryx {
  readonly oryx: Oryx
  readonly storage: MemoryStorage
  /** Where the SDK sent the page (location.replace), in order. */
  readonly replaced: string[]
}

/** The real SDK with OpenMana's options, against the fake cloud; timers short (uploads 5 ms after a change unless given). */
export function testOryx(
  cloud: FakeOryxCloud,
  options: { readonly href?: string; readonly storage?: MemoryStorage; readonly session?: MemoryStorage; readonly sdk?: Partial<OryxOptions> } = {},
): TestOryx {
  const href = options.href ?? REAL_ADDRESS
  const storage = options.storage ?? new MemoryStorage()
  const replaced: string[] = []
  const location = {
    href,
    search: new URL(href).search,
    replace: (url: string) => {
      replaced.push(url)
    },
  }
  const env = {
    window: { addEventListener: () => undefined },
    document: { visibilityState: "visible", addEventListener: () => undefined, body: null },
    location,
    history: { state: null, replaceState: () => undefined },
    navigator: { onLine: true, userAgent: "Vitest" },
    localStorage: storage,
    sessionStorage: options.session ?? new MemoryStorage(),
    crypto: webcrypto,
    fetch: (url: string, init?: Parameters<FakeOryxCloud["fetch"]>[1]) => cloud.fetch(url, init),
    now: () => Date.now(),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    // No play-time reports in tests.
    setInterval: () => 0,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
  }
  const oryx = createOryx({ ...ORYX_OPTIONS, debounceMs: 5, maxWaitMs: 50, ...options.sdk, env })
  return { oryx, storage, replaced }
}

/** The tab's session as the SDK leaves it when it sends the player to ORYX's consent page (connect()). */
export function connectingSession(state: string): MemoryStorage {
  const session = new MemoryStorage()
  session.setItem("oryx.openmana.pkce", JSON.stringify({ verifier: "test-verifier", state, returnTo: "/settings", clientId: CLIENT_ID }))
  return session
}
