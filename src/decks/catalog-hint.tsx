/*
 * Without the card catalog on this device the library still works - decks
 * are Forge's names and counts - but shows no German names, no pictures and
 * no language status. This says so where decks are shown, and sets the
 * catalog up right there (the same install as in the settings).
 */
import { Languages } from "lucide-react"
import { useCardCatalog } from "@/cards/card-catalog-context"
import { InstallButton, InstallProgressView } from "@/cards/card-data-card"
import { CardDataErrorAlert } from "@/cards/card-error-alert"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function CatalogHint() {
  const catalog = useCardCatalog()
  if (catalog.usable || catalog.status === "loading" || catalog.status === "storage-error") return null
  if (catalog.status === "unavailable") {
    return (
      <Alert>
        <Languages aria-hidden />
        <AlertTitle>Diese Version enthält keine Kartendaten</AlertTitle>
        <AlertDescription>Karten erscheinen mit den englischen Namen, die Forge kennt, ohne Bilder.</AlertDescription>
      </Alert>
    )
  }
  return (
    <>
      <Alert>
        <Languages aria-hidden />
        <AlertTitle>{catalog.status === "installing" ? "Die Kartendaten werden eingerichtet" : "Ohne Kartendaten: englische Namen, keine Bilder"}</AlertTitle>
        <AlertDescription>
          {catalog.status === "installing" ? (
            <InstallProgressView state={catalog} />
          ) : (
            <>
              <span>Mit den Kartendaten zeigt OpenMana die Karten deutsch und mit Bild, und die Suche findet auch deutsche Kartennamen.</span>
              <span className="mt-2 block">
                <InstallButton state={catalog} />
              </span>
            </>
          )}
        </AlertDescription>
      </Alert>
      {catalog.error !== null ? <CardDataErrorAlert error={catalog.error} /> : null}
    </>
  )
}
