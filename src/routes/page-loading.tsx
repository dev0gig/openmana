/*
 * Stands in for a page that loads on demand while its code arrives (only on
 * the first visit, and only when it is opened directly - React Router's
 * HydrateFallback). The app frame and its navigation stay usable meanwhile.
 * Menu style "Reich" (prompt 59): it keeps the shape of a page - the title's
 * place with the ornament line under it (PageHeader), then a panel's place.
 */
import { OrnamentDivider } from "@/components/ui/ornament"
import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8" aria-busy aria-label="Seite wird geladen">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-9 w-64" />
        <OrnamentDivider className="my-1.5" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}
