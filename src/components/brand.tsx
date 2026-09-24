/*
 * The OpenMana mark: the temporary app icon (taken over unchanged from
 * Anvil, see assets/app-icon/PROVENANCE.md) and the wordmark.
 */
import { cn } from "@/lib/utils"

export function Brand({ className, size = "default" }: { className?: string; size?: "default" | "hero" }) {
  const hero = size === "hero"
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <img
        src="/icons/icon-192.png"
        alt=""
        width={hero ? 96 : 32}
        height={hero ? 96 : 32}
        className={cn("shrink-0", hero ? "size-24 rounded-3xl" : "size-8 rounded-lg")}
      />
      <span className={cn("font-heading font-semibold tracking-wide", hero ? "text-4xl md:text-5xl" : "text-lg")}>OpenMana</span>
    </span>
  )
}
