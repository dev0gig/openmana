/*
 * One StorageSession for the whole app (opened when the app starts, closed
 * when it goes away) and the hooks the views read local data with.
 */
import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { toast } from "sonner"
import { buildInfo } from "@/app/build-info"
import type { LocalDatabase } from "./database"
import { toStorageError, type StorageError } from "./errors"
import type { AppVersion } from "./generated/records"
import type { StoreName } from "./schema"
import { StorageSession, type StorageSnapshot } from "./storage-session"
import { storageErrorTitle } from "./storage-labels"

/** This build, as the database and backups record it. */
export function appVersion(): AppVersion {
  const commit = buildInfo.commit !== null && /^[0-9a-f]{40}$/.test(buildInfo.commit) ? buildInfo.commit : null
  return { version: buildInfo.version, commit }
}

const StorageContext = createContext<StorageSession | null>(null)

export function StorageProvider({ children, session }: { children: ReactNode; session?: StorageSession }) {
  const [value] = useState(() => session ?? new StorageSession({ app: appVersion() }))
  useEffect(() => {
    value.open()
    return () => value.close()
  }, [value])
  useConnectionLossToast(value)
  return <StorageContext value={value}>{children}</StorageContext>
}

const NO_STORAGE = () => null
const NO_SUBSCRIBE = () => () => undefined
/** Optional consumers (recording) also work in engine-only diagnostic frames. */
export function useOptionalStorage(): StorageSnapshot | null {
  const session = use(StorageContext)
  return useSyncExternalStore(session?.subscribe ?? NO_SUBSCRIBE, session?.getSnapshot ?? NO_STORAGE)
}

export function useStorage(): { snapshot: StorageSnapshot; session: StorageSession } {
  const session = use(StorageContext)
  if (!session) throw new Error("useStorage outside StorageProvider")
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  return { snapshot, session }
}

export type StorageQuery<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error"; readonly error: StorageError }

const LOADING = { status: "loading" } as const

/**
 * Runs `query` once the database is ready and again whenever one of `stores`
 * changes (here or in another tab). `query` must be stable (a module-level
 * function): a new function would run it again on every render.
 */
export function useStorageQuery<T>(stores: readonly StoreName[], query: (db: LocalDatabase) => Promise<T>): StorageQuery<T> {
  const { snapshot, session } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const storesKey = stores.join(",")
  const [result, setResult] = useState<{ readonly database: LocalDatabase; readonly state: StorageQuery<T> } | null>(null)
  const latest = useRef(0)
  useEffect(() => {
    if (database === null) return
    let active = true
    const run = () => {
      // Only the newest run may answer: an older, slower one would show stale data.
      const ticket = ++latest.current
      query(database).then(
        (data) => {
          if (active && ticket === latest.current) setResult({ database, state: { status: "ready", data } })
        },
        (error: unknown) => {
          if (active && ticket === latest.current) setResult({ database, state: { status: "error", error: toStorageError(error, "reading local data") } })
        },
      )
    }
    run()
    const unsubscribe = session.subscribeChanges(storesKey.split(",") as StoreName[], run)
    return () => {
      active = false
      unsubscribe()
    }
  }, [database, session, storesKey, query])
  if (snapshot.status === "failed" || snapshot.status === "closed") return { status: "error", error: snapshot.error }
  if (database === null || result === null || result.database !== database) return LOADING
  return result.state
}

/** A lost connection never goes unnoticed (Bible §16), whatever page is open. */
function useConnectionLossToast(session: StorageSession): void {
  useEffect(
    () =>
      session.subscribe(() => {
        const snapshot = session.getSnapshot()
        if (snapshot.status === "closed") {
          toast.error(storageErrorTitle(snapshot.error, snapshot.reason), { id: "storage-closed", description: "Bitte lade die Seite neu." })
        }
      }),
    [session],
  )
}
