/*
 * The app's CloudSync in React: CloudProvider (main.tsx, around the router),
 * CloudStorageLink (inside the app shell's StorageProvider: links the cloud
 * to the local database), CloudReturnNotice (the app shell: says once how the
 * return from ORYX's consent page went) and useCloudSync (the settings card).
 * Without a provider - page and component tests, the table harness - there is
 * no cloud: the link and the notice do nothing and the card is not shown.
 */
import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from "react"
import { toast } from "sonner"
import { useStorage } from "@/storage/storage-context"
import type { CloudReturn, CloudSnapshot, CloudSync } from "./cloud-sync"

const CloudContext = createContext<CloudSync | null>(null)

export function CloudProvider({ cloud, children }: { cloud: CloudSync; children: ReactNode }) {
  return <CloudContext value={cloud}>{children}</CloudContext>
}

/** Links the app's cloud to the app's local database (render it inside StorageProvider). */
export function CloudStorageLink(): null {
  const cloud = use(CloudContext)
  const { session } = useStorage()
  useEffect(() => cloud?.attach(session), [cloud, session])
  return null
}

const subscribeToNothing = () => () => undefined
const noSnapshot = () => null

/** The app's cloud and its state; null without a CloudProvider. */
export function useCloudSync(): { readonly cloud: CloudSync; readonly snapshot: CloudSnapshot } | null {
  const cloud = use(CloudContext)
  const snapshot = useSyncExternalStore(cloud?.subscribe ?? subscribeToNothing, cloud?.getSnapshot ?? noSnapshot)
  return cloud === null || snapshot === null ? null : { cloud, snapshot }
}

const RETURN_NOTICES: Readonly<Record<CloudReturn, { readonly kind: "success" | "info" | "error"; readonly title: string; readonly description: string }>> = {
  connected: {
    kind: "success",
    title: "Mit ORYX verbunden",
    description: "Deine Decks werden jetzt zwischen deinen Geräten abgeglichen. Mehr dazu in den Einstellungen.",
  },
  declined: {
    kind: "info",
    title: "Nicht mit ORYX verbunden",
    description: "Du hast die Verbindung nicht erlaubt. Deine Daten bleiben auf diesem Gerät.",
  },
  failed: {
    kind: "error",
    title: "Verbinden mit ORYX hat nicht geklappt",
    description: "Deine Daten bleiben auf diesem Gerät. Versuche es in den Einstellungen erneut.",
  },
}

/**
 * Coming back from ORYX's consent page lands on OpenMana's start page (the
 * address ORYX sends the player to): say how it went, once (Bible §16: no
 * silent outcome), wherever the player is.
 */
export function CloudReturnNotice(): null {
  const returned = useCloudSync()?.snapshot.returned ?? null
  useEffect(() => {
    if (returned === null) return
    const notice = RETURN_NOTICES[returned]
    // One id: Strict Mode's second run updates the same toast instead of adding one.
    toast[notice.kind](notice.title, { id: "oryx-return", description: notice.description })
  }, [returned])
  return null
}
