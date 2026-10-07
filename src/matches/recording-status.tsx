import { createContext, use, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { EngineSession } from "@/engine/engine-session"
import { appVersion, useOptionalStorage } from "@/storage/storage-context"
import { toStorageError, type StorageError } from "@/storage/errors"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { MatchRecorder } from "./match-recorder"

const RecordingError = createContext<StorageError | null>(null)
export function RecordingProvider({ session, children }: { session: EngineSession; children: ReactNode }) {
  const snapshot = useOptionalStorage()
  const database = snapshot?.status === "ready" ? snapshot.database : null
  const [error, setError] = useState<StorageError | null>(null)
  useEffect(() => {
    if (!database) return
    const recorder = new MatchRecorder({
      session,
      database,
      assets: session.assets,
      app: appVersion(),
      onError: (cause) => {
        const error = toStorageError(cause, "recording match")
        setError(error)
        toast.error("Die Partie wird nicht vollständig gespeichert", {
          id: "match-recording",
          description: "Das Spiel läuft weiter. Mehr dazu unter Partien.",
        })
      },
    })
    const leaving = () => {
      void recorder.flush()
    }
    window.addEventListener("pagehide", leaving)
    return () => {
      window.removeEventListener("pagehide", leaving)
      recorder.dispose()
    }
  }, [session, database])
  return <RecordingError value={error}>{children}</RecordingError>
}
export function RecordingAlert() {
  const error = use(RecordingError)
  return error ? (
    <StorageErrorAlert error={error}>
      <span>Die Partie ist möglicherweise unvollständig aufgezeichnet. Das Spiel läuft weiter.</span>
    </StorageErrorAlert>
  ) : null
}
