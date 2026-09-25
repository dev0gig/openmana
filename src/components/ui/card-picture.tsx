/*
 * The picture of a Magic card, built the shadcn way (OpenMana design system:
 * there is no registry component for it). An AspectRatio in the card's
 * proportions (63 × 88 mm) holds the picture; while it loads a Skeleton
 * stands in, and when there is no picture or it cannot load, `fallback`
 * (the card's text) takes its place - never a blank box.
 *
 * The picture is never cropped (object-contain): Scryfall's terms forbid
 * cutting off the artist name or copyright line, also in thumbnails.
 *
 * Pictures come from another origin (Scryfall's image server). Under the
 * app's COEP (require-corp) they must load in CORS mode, hence
 * crossOrigin="anonymous"; referrerPolicy="no-referrer" keeps the page's
 * address to ourselves (Bible §15). data-state says what is shown:
 * loading, loaded, failed or missing.
 */
import * as React from "react"
import { cn } from "cn"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Skeleton } from "@/components/ui/skeleton"

/** Width to height of a Magic card. */
const CARD_RATIO = 63 / 88

type PictureState = "loading" | "loaded" | "failed"

interface CardPictureProps extends Omit<React.ComponentProps<"img">, "src" | "alt" | "crossOrigin" | "onLoad" | "onError"> {
  /** The picture's URL; null: there is none. */
  src: string | null
  alt: string
  /** What stands in for a missing or failed picture (the card's text). */
  fallback: React.ReactNode
  /** Called once the picture loaded or failed. */
  onStateChange?: (state: Exclude<PictureState, "loading">) => void
  /**
   * OpenMana (prompt 13): a small card (the game table's rows) - the
   * fallback text box keeps little padding, so a name still fits.
   */
  compact?: boolean
}

function CardPicture({ src, alt, fallback, className, onStateChange, compact = false, ...props }: CardPictureProps) {
  // Keyed by URL: a new picture starts at "loading" without an effect.
  const [status, setStatus] = React.useState<{ readonly src: string | null; readonly state: PictureState }>({ src, state: "loading" })
  const state: PictureState = status.src === src ? status.state : "loading"
  const settle = (next: Exclude<PictureState, "loading">) => {
    setStatus({ src, state: next })
    onStateChange?.(next)
  }
  const shown = src === null ? "missing" : state
  return (
    <AspectRatio
      ratio={CARD_RATIO}
      data-slot="card-picture"
      data-state={shown}
      className={cn("overflow-hidden rounded-xl border bg-muted", className)}
    >
      {src !== null && state !== "failed" ? (
        <>
          {state === "loading" ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
          <img
            src={src}
            alt={alt}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            decoding="async"
            loading="lazy"
            onLoad={() => settle("loaded")}
            onError={() => settle("failed")}
            className={cn("size-full object-contain", state === "loading" && "opacity-0")}
            {...props}
          />
        </>
      ) : (
        <div data-slot="card-picture-fallback" className={cn("flex size-full flex-col overflow-hidden bg-card text-left text-card-foreground", compact ? "gap-0.5 p-1" : "gap-2 p-3")}>
          {fallback}
        </div>
      )}
    </AspectRatio>
  )
}

export { CardPicture, CARD_RATIO }
