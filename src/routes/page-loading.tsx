/*
 * Stands in for a page that loads on demand while its code arrives (only on
 * the first visit, and only when it is opened directly - React Router's
 * HydrateFallback). The app frame and its navigation stay usable meanwhile.
 */
import { Skeleton } from "@/components/ui/skeleton"

export function PageLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8" aria-busy aria-label="Seite wird geladen">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
