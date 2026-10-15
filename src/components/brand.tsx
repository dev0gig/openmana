/*
 * The OpenMana mark in the app's bars and on the start page: the emblem of
 * the game table and the wordmark in gold (series openmana-menuestil,
 * prompt 57; src/components/ui/emblem.tsx). The app icon (public/icons,
 * manifest, PWA - temporary, taken over from Anvil, see
 * assets/app-icon/PROVENANCE.md) is not shown here any more and stays as it is.
 * Decoration: the link or heading around it carries the name.
 */
import { Emblem, Wordmark } from "@/components/ui/emblem"
import { cn } from "@/lib/utils"

export function Brand({ className, size = "default" }: { className?: string; size?: "default" | "hero" }) {
  const hero = size === "hero"
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Emblem className={hero ? "size-24" : "size-8"} />
      <Wordmark className={hero ? "text-4xl md:text-5xl" : "text-xl"} />
    </span>
  )
}
