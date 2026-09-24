/* A page that crashed shows why, inside the app frame, instead of a blank screen. */
import { OctagonAlert, RotateCcw } from "lucide-react"
import { isRouteErrorResponse, useRouteError } from "react-router"
import { Page } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`
  if (error instanceof Error) return error.message
  return String(error)
}

export function RouteError() {
  const error = useRouteError()
  return (
    <Page title="Fehler">
      <Alert variant="destructive">
        <OctagonAlert aria-hidden />
        <AlertTitle>Diese Seite konnte nicht angezeigt werden.</AlertTitle>
        <AlertDescription>
          <code className="block text-xs break-words">{describe(error)}</code>
        </AlertDescription>
      </Alert>
      <div>
        <Button onClick={() => window.location.reload()}>
          <RotateCcw data-icon="inline-start" aria-hidden />
          Neu laden
        </Button>
      </div>
    </Page>
  )
}
