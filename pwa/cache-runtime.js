/* Build-generated configuration is trusted; network bytes are not. No runtime
 * cache of third-party/user URLs. A completion marker is published last. */
export function isolated(response, headers) {
  const result = new Headers(response.headers)
  for (const [key, value] of Object.entries(headers)) result.set(key, value)
  // Cached bodies are decoded; transport headers would describe different bytes.
  result.delete("content-encoding")
  result.delete("content-length")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: result })
}

export async function verifiedDownload(entry, fetcher = fetch) {
  const response = await fetcher(entry.url, { cache: "no-store", credentials: "same-origin", redirect: "error" })
  if (!response.ok || response.type === "opaque") throw new Error(`Download failed: ${entry.url}`)
  const bytes = await response.arrayBuffer()
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (x) => x.toString(16).padStart(2, "0")).join("")
  if (bytes.byteLength !== entry.bytes || digest !== entry.sha256) throw new Error(`Integrity check failed: ${entry.url}`)
  return new Response(bytes, { status: response.status, headers: response.headers })
}

export async function completeCache(storage, name, entries, marker, headers, fetcher = fetch) {
  const cache = await storage.open(name)
  if (await cache.match(marker)) {
    // Eviction/developer deletion can remove an individual file, too.
    if ((await Promise.all(entries.map((entry) => cache.match(entry.url)))).every(Boolean)) return cache
  }
  await cache.delete(marker)
  try {
    for (const entry of entries) {
      await cache.put(entry.url, isolated(await verifiedDownload(entry, fetcher), headers))
    }
    await cache.put(marker, new Response("complete"))
    return cache
  } catch (error) {
    await storage.delete(name)
    throw error
  }
}
