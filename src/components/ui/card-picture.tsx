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
 *
 * A picture that loads lazily with `sizes="auto"` (the game table's,
 * table-picture.tsx) gives up `sizes` before it leaves the page: Chrome
 * keeps such an image - and the elements around it - alive after its removal
 * (its viewport listener); prompt 45 measured about 20 nodes and 4 event
 * listeners more per state of the game table, without end. React runs a
 * ref's cleanup before it takes the elements out of the page.
 *
 * A picture that failed tries again on its own (the project owner,
 * 2026-10-16: "die Kartenbilder laden nicht zuverlässig"): one dropped
 * request - a flaky network, a proxy, a connection cut - must not leave the
 * card's text for good. After RETRY_DELAYS_MS, and whenever the browser is
 * back online, a new <img> asks for the picture again, invisible on top of
 * the fallback, which stays until the picture has loaded (no flicker between
 * text and placeholder). Chrome asks the server anew for a URL that failed.
 */
import * as React from "react"
import { cn } from "cn"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Skeleton } from "@/components/ui/skeleton"

/** Width to height of a Magic card. */
const CARD_RATIO = 63 / 88

/** How long a failed picture waits before each new attempt (then only when the browser is back online). */
const RETRY_DELAYS_MS = [1_000, 4_000, 15_000] as const

/** "retrying": failed, the fallback is shown and a new attempt loads invisibly on top. */
type PictureState = "loading" | "loaded" | "failed" | "retrying"

interface CardPictureProps extends Omit<React.ComponentProps<"img">, "src" | "alt" | "crossOrigin" | "onLoad" | "onError" | "ref"> {
  /** The picture's URL; null: there is none. */
  src: string | null
  alt: string
  /** What stands in for a missing or failed picture (the card's text). */
  fallback: React.ReactNode
  /** Called once the picture loaded or first failed (and again when a new attempt loaded it). */
  onStateChange?: (state: "loaded" | "failed") => void
  /**
   * OpenMana (prompt 13): a small card (the game table's rows) - the
   * fallback text box keeps little padding, so a name still fits.
   */
  compact?: boolean
}

/**
 * Takes `sizes` away when a lazily sized picture leaves the page (see above)
 * and gives it back when the same element is put in again (React's
 * development mode attaches a ref twice).
 */
function useReleasedSizes(): React.RefCallback<HTMLImageElement> {
  const saved = React.useRef<string | null>(null)
  return React.useCallback((image: HTMLImageElement | null) => {
    if (image === null) return undefined
    if (saved.current !== null) image.setAttribute("sizes", saved.current)
    saved.current = null
    return () => {
      const sizes = image.getAttribute("sizes")
      if (sizes !== "auto") return
      saved.current = sizes
      image.removeAttribute("sizes")
    }
  }, [])
}

function CardPicture({ src, alt, fallback, className, onStateChange, compact = false, ...props }: CardPictureProps) {
  const releaseSizes = useReleasedSizes()
  // Keyed by URL: a new picture starts at "loading" without an effect. `attempt` counts the new attempts.
  const [status, setStatus] = React.useState<{ readonly src: string | null; readonly state: PictureState; readonly attempt: number }>({ src, state: "loading", attempt: 0 })
  const current = status.src === src ? status : { src, state: "loading" as const, attempt: 0 }
  const { state, attempt } = current
  const settle = (next: "loaded" | "failed") => {
    setStatus({ src, state: next, attempt })
    if (next === "loaded" || state === "loading") onStateChange?.(next)
  }

  React.useEffect(() => {
    if (src === null || state !== "failed") return undefined
    const retry = () => setStatus((previous) => (previous.src === src && previous.state === "failed" ? { src, state: "retrying", attempt: previous.attempt + 1 } : previous))
    const delay = RETRY_DELAYS_MS[attempt]
    const timer = delay === undefined ? undefined : window.setTimeout(retry, delay)
    window.addEventListener("online", retry)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("online", retry)
    }
  }, [src, state, attempt])

  const shown = src === null ? "missing" : state === "retrying" ? "failed" : state
  const retrying = state === "retrying"
  return (
    <AspectRatio
      ratio={CARD_RATIO}
      data-slot="card-picture"
      data-state={shown}
      className={cn("overflow-hidden rounded-xl border bg-muted", className)}
    >
      {src !== null && state === "loading" ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      {src === null || state === "failed" || retrying ? (
        <div data-slot="card-picture-fallback" className={cn("flex size-full flex-col overflow-hidden bg-card text-left text-card-foreground", compact ? "gap-0.5 p-1" : "gap-2 p-3")}>
          {fallback}
        </div>
      ) : null}
      {src !== null && state !== "failed" ? (
        <img
          key={attempt}
          ref={releaseSizes}
          src={src}
          alt={retrying ? "" : alt}
          aria-hidden={retrying || undefined}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          decoding="async"
          loading="lazy"
          onLoad={() => settle("loaded")}
          onError={() => settle("failed")}
          className={cn("size-full object-contain", state === "loading" && "opacity-0", retrying && "absolute inset-0 opacity-0")}
          {...props}
        />
      ) : null}
    </AspectRatio>
  )
}

export { CardPicture, CARD_RATIO }
