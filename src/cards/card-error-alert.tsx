/*
 * A failure around card data, where it matters: German headline and advice,
 * the technical detail verbatim below (Bible §16: nothing fails silently).
 */
import { OctagonAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cardErrorAdvice, cardErrorTitle } from "./card-labels"
import type { CardDataError } from "./errors"

export function CardDataErrorAlert({ error, children }: { error: CardDataError; children?: ReactNode }) {
  return (
    <Alert variant={error.code === "aborted" ? "default" : "destructive"}>
      <OctagonAlert aria-hidden />
      <AlertTitle>{cardErrorTitle(error)}</AlertTitle>
      <AlertDescription>
        <span>{cardErrorAdvice(error)}</span>
        {children}
        <code className="mt-2 block text-xs break-words">{error.detail ? `${error.message} (${error.detail})` : error.message}</code>
      </AlertDescription>
    </Alert>
  )
}
