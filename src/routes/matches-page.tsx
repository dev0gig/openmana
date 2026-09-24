/*
 * Matches: recorded games as the database holds them. Recording and replay
 * are prompt 22; until then matches only arrive through a loaded backup, and
 * the page shows exactly what is stored.
 */
import { History, Swords } from "lucide-react"
import { Page } from "@/components/page-header"
import { TextLink } from "@/components/text-link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import type { MatchRecord } from "@/storage/generated/records"
import { listMatches } from "@/storage/matches"
import { StorageErrorAlert } from "@/storage/storage-alert"
import { useStorageQuery } from "@/storage/storage-context"
import { formatDateTime, GAME_RESULT_LABELS, MATCH_STATUS_LABELS } from "@/storage/storage-labels"

function describeMatch(match: MatchRecord): string {
  const parts = [formatDateTime(match.startedAt)]
  if (match.end?.result) parts.push(GAME_RESULT_LABELS[match.end.result])
  else parts.push(MATCH_STATUS_LABELS[match.status])
  if (match.end?.turns != null) parts.push(match.end.turns === 1 ? "1 Zug" : `${match.end.turns} Züge`)
  return parts.join(" · ")
}

export function MatchesPage() {
  const matches = useStorageQuery(["matches"], listMatches)
  return (
    <Page title="Partien" description="Deine gespielten Partien auf diesem Gerät.">
      {matches.status === "loading" ? (
        <Skeleton className="h-40 w-full" aria-label="Partien werden geladen" />
      ) : matches.status === "error" ? (
        <StorageErrorAlert error={matches.error}>
          <span className="mt-1 block">
            Mehr dazu in den <TextLink to="/settings">Einstellungen</TextLink> unter „Daten auf diesem Gerät“.
          </span>
        </StorageErrorAlert>
      ) : matches.data.records.length === 0 && matches.data.invalid.length === 0 ? (
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
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{matches.data.records.length === 1 ? "1 Partie" : `${matches.data.records.length} Partien`}</CardTitle>
            <CardDescription>Nachlesen und Nachspielen folgen mit der Aufzeichnung.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup aria-label="Gespeicherte Partien" role="list">
              {matches.data.records.map((match) => (
                <Item key={match.id} variant="outline" role="listitem">
                  <ItemMedia variant="icon">
                    <Swords aria-hidden />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {match.human.deck.name} gegen {match.ai.name}
                    </ItemTitle>
                    <ItemDescription>{describeMatch(match)}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
              {matches.data.invalid.map((record) => (
                <Item key={record.key} variant="outline" role="listitem">
                  <ItemContent>
                    <ItemTitle>
                      Beschädigter Eintrag <Badge variant="destructive">beschädigt</Badge>
                    </ItemTitle>
                    <ItemDescription>
                      Diese Partie hat nicht das erwartete Format. Prüfen und entfernen: <TextLink to="/settings">Einstellungen</TextLink> → Daten
                      prüfen.
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </Page>
  )
}
