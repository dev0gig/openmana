/*
 * A failure of the local data, where it matters: German headline and advice,
 * the technical detail verbatim below (Bible §16: nothing fails silently).
 */
import { OctagonAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { StorageError } from "./errors"
import { storageErrorAdvice, storageErrorTitle } from "./storage-labels"
import type { ConnectionLoss } from "./storage-session"

export function StorageErrorAlert({ error, loss, children }: { error: StorageError; loss?: ConnectionLoss; children?: ReactNode }) {
  return (
    <Alert variant="destructive">
      <OctagonAlert aria-hidden />
      <AlertTitle>{storageErrorTitle(error, loss)}</AlertTitle>
      <AlertDescription>
        <span>{storageErrorAdvice(error)}</span>
        {children}
        <code className="mt-2 block text-xs break-words">{error.detail ? `${error.message} (${error.detail})` : error.message}</code>
      </AlertDescription>
    </Alert>
  )
}
