import { useEffect, useState } from "react"

/**
 * performance.now(), refreshed every `intervalMs` while `active` (for running
 * timers). Right after activation it may lag by up to one interval, so
 * callers clamp elapsed times at zero.
 */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(performance.now()), intervalMs)
    return () => clearInterval(timer)
  }, [active, intervalMs])
  return now
}
