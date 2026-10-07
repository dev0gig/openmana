export interface CacheEntry { readonly url: string; readonly bytes: number; readonly sha256: string }
export function isolated(response: Response, headers: Readonly<Record<string, string>>): Response
export function verifiedDownload(entry: CacheEntry, fetcher?: typeof fetch): Promise<Response>
export function completeCache(storage: CacheStorage, name: string, entries: readonly CacheEntry[], marker: string, headers: Readonly<Record<string, string>>, fetcher?: typeof fetch): Promise<Cache>
