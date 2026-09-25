/*
 * "Karte nachschlagen": find a card by the start of any of its names
 * (German or English) in the card catalog on this device and see it as
 * OpenMana shows it. Nothing goes to Scryfall's API; the pictures come from
 * Scryfall's image server. A name Forge knows without Scryfall data is
 * reported as such; an unknown one as unknown.
 */
import { ArrowLeft, Search } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CardPicture } from "@/components/ui/card-picture"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import type { LocalDatabase } from "@/storage/database"
import type { ForgeOnlyCardRecord } from "@/storage/generated/records"
import { useStorage } from "@/storage/storage-context"
import { useCardCatalog } from "./card-catalog-context"
import { CardDetails } from "./card-details"
import { cardDisplay } from "./card-display"
import { FORGE_ONLY_LABELS } from "./card-labels"
import { findForgeOnly, searchCardsByName, type CardMatch } from "./card-lookup"

type Search =
  | { readonly status: "idle" }
  | { readonly status: "searching" }
  | { readonly status: "done"; readonly text: string; readonly matches: readonly CardMatch[]; readonly forgeOnly: ForgeOnlyCardRecord | null }
  | { readonly status: "failed"; readonly message: string }

function useCardSearch(database: LocalDatabase | null, text: string, enabled: boolean): Search {
  const [search, setSearch] = useState<{ readonly text: string; readonly result: Search } | null>(null)
  const query = text.trim()
  useEffect(() => {
    if (database === null || !enabled || query.length < 2) return
    let active = true
    // Wait for a pause in typing.
    const timer = setTimeout(() => {
      Promise.all([searchCardsByName(database, query), findForgeOnly(database, query)]).then(
        ([matches, forgeOnly]) => {
          if (active) setSearch({ text: query, result: { status: "done", text: query, matches, forgeOnly } })
        },
        (error: unknown) => {
          if (active) setSearch({ text: query, result: { status: "failed", message: error instanceof Error ? error.message : String(error) } })
        },
      )
    }, 200)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [database, query, enabled])
  if (query.length < 2 || !enabled) return { status: "idle" }
  return search?.text === query ? search.result : { status: "searching" }
}

function ResultItem({ match, onSelect }: { match: CardMatch; onSelect: () => void }) {
  const id = useId()
  const display = cardDisplay(match.card, { match })
  const face = display.faces[display.face]!
  return (
    <Item asChild variant="outline" size="sm">
      <button type="button" onClick={onSelect} className="text-left" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <ItemMedia>
          <div className="w-10">
            <CardPicture src={display.picture?.urls.thumb ?? null} alt="" fallback={null} />
          </div>
        </ItemMedia>
        <ItemContent>
          <ItemTitle id={`${id}-title`}>{display.name.text}</ItemTitle>
          <ItemDescription id={`${id}-description`}>
            {display.name.lang === "de" ? `${match.card.name} · ` : ""}
            {face.typeLine?.text ?? ""}
          </ItemDescription>
        </ItemContent>
      </button>
    </Item>
  )
}

function Results({ search, onSelect }: { search: Search; onSelect: (match: CardMatch) => void }) {
  switch (search.status) {
    case "idle":
      return <p className="text-sm text-muted-foreground">Gib mindestens zwei Buchstaben eines deutschen oder englischen Kartennamens ein.</p>
    case "searching":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Spinner className="size-4" />
          Suche …
        </p>
      )
    case "failed":
      return (
        <Alert variant="destructive">
          <AlertTitle>Die Suche ist fehlgeschlagen</AlertTitle>
          <AlertDescription>
            <code className="text-xs break-words">{search.message}</code>
          </AlertDescription>
        </Alert>
      )
    case "done":
      if (search.matches.length === 0) {
        return (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{search.forgeOnly ? "Keine Scryfall-Daten zu dieser Karte" : "Keine Karte gefunden"}</EmptyTitle>
              <EmptyDescription>
                {search.forgeOnly
                  ? `Forge kennt „${search.forgeOnly.name}“ und kann sie spielen; angezeigt wird sie mit Forges eigenem Text. ${FORGE_ONLY_LABELS[search.forgeOnly.reason]}.`
                  : `Kein Kartenname beginnt mit „${search.text}“.`}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      }
      return (
        // Buttons in a named group (a button must keep its role; a list item it is not).
        <ItemGroup role="group" aria-label="Gefundene Karten" className="gap-2">
          {search.matches.map((match) => (
            <ResultItem key={match.card.oracleId} match={match} onSelect={() => onSelect(match)} />
          ))}
        </ItemGroup>
      )
  }
}

export function CardLookupDialog() {
  const catalog = useCardCatalog()
  const { snapshot } = useStorage()
  const database = snapshot.status === "ready" ? snapshot.database : null
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [selected, setSelected] = useState<CardMatch | null>(null)
  const search = useCardSearch(database, text, open && catalog.usable)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSelected(null)
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <Search data-icon="inline-start" aria-hidden />
          Karte nachschlagen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Karte nachschlagen</DialogTitle>
          <DialogDescription>Deutsch oder englisch – aus den Kartendaten auf diesem Gerät.</DialogDescription>
        </DialogHeader>
        {!catalog.usable ? (
          catalog.status === "installing" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Spinner className="size-4" />
              Die Kartendaten werden gerade eingerichtet …
            </p>
          ) : (
            <Alert>
              <AlertTitle>Die Kartendaten sind noch nicht eingerichtet</AlertTitle>
              <AlertDescription>Richte sie unter „Kartendaten“ ein; danach lassen sich Karten hier nachschlagen.</AlertDescription>
            </Alert>
          )
        ) : selected ? (
          <div className="flex flex-col gap-4">
            <div>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                <ArrowLeft data-icon="inline-start" aria-hidden />
                Zur Trefferliste
              </Button>
            </div>
            <CardDetails card={selected.card} match={selected} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="card-lookup-text">Kartenname</FieldLabel>
              <Input
                id="card-lookup-text"
                type="search"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={text}
                placeholder="z. B. Blitzschlag"
                onChange={(event) => setText(event.currentTarget.value)}
              />
            </Field>
            <Results search={search} onSelect={setSelected} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
