/* Matches: played games and their history. Recording follows; until then it is honestly empty. */
import { History } from "lucide-react"
import { Page } from "@/components/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export function MatchesPage() {
  return (
    <Page title="Partien" description="Deine gespielten Partien auf diesem Gerät.">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Noch keine Partien</EmptyTitle>
          <EmptyDescription>
            Gespielte Partien werden hier automatisch aufgezeichnet – zum Nachlesen und Nachspielen. Die Aufzeichnung folgt.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Page>
  )
}
