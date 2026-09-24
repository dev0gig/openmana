import { Compass } from "lucide-react"
import { Link } from "react-router"
import { Page } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function NotFoundPage() {
  return (
    <Page title="Nicht gefunden">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Diese Seite gibt es nicht</EmptyTitle>
          <EmptyDescription>Vielleicht ein alter Link.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/">Zum Start</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </Page>
  )
}
