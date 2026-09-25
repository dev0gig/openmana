/* oryx-sdk.js · v1.0.0 · master copy: oryx-games/shared/oryx-sdk.js
 *
 * Connects a game to the player's ORYX account and keeps its saves in the ORYX cloud (Supabase),
 * next to the game's own local storage. Local stays the source of truth: the cloud is an addition,
 * and every failure (offline, not connected, Supabase paused) leaves the game exactly as it was.
 * Every game carries its own unchanged copy of this file (no dependencies, one ES module), so a game
 * never depends on an ORYX deploy. To update: change the master, raise the version, copy it.
 * Plan and reasons: oryx-games/ORYX-SUPABASE-ARCHITEKTUR.md (sections 4–7) and ORYX-PROBELAUF-PHASE0.md.
 *
 *   import { createOryx } from './oryx-sdk.js'
 *   const oryx = createOryx({ gameId: 'threnfall', supabaseUrl, publishableKey, redirectUri: 'https://threnfall.vercel.app/' })
 *   if (await oryx.ready() === 'redirecting') return      // connecting: the page is about to leave
 *   const slot = oryx.slot('1', { schemaVersion: 8, read, write, remove, migrate, summarize, playtime })
 *   await slot.pull()          // before the game reads its local save; asks the player only on a real conflict
 *   slot.markChanged()         // after every local save (uploads are collected, at most every 15–60 s)
 *   slot.remove()              // after the player deleted this save locally
 *
 * Connecting (OAuth 2.1 authorization code + PKCE against Supabase's OAuth server, consent page on ORYX):
 * - automatically when ORYX starts the game with ?oryx_sync=1 (ORYX adds it only when its player is signed
 *   in and cloud sync is on), otherwise with oryx.connect() from the game's menu;
 * - every jump uses location.replace, so no in-between page stays in the tab history (Back in the ORYX app);
 * - the client id is not built into the game: it is read from ORYX's games table and cached.
 * Conflicts are decided by revisions, never by clocks. A real conflict (both sides changed) is only
 * decided at start (pull), never in the middle of play: an upload that meets a newer cloud save marks
 * the slot and waits for the next start.
 * Only active on the game's real address (redirectUri's origin): locally, in tests and previews it stays
 * 'inactive' and does nothing.
 */

export const ORYX_SDK_VERSION = '1.0.0'

const TEXT = {
  de: {
    guest: 'ORYX-Cloud: nicht verbunden',
    connected: 'ORYX-Cloud: verbunden',
    disabled: 'ORYX-Cloud: in ORYX ausgeschaltet',
    offline: 'ORYX-Cloud: offline, lokal gespeichert',
    error: 'ORYX-Cloud: gerade nicht erreichbar',
    saved: 'gesichert',
    conflictPending: 'Konflikt, wird beim nächsten Start geklärt',
    connect: 'Mit ORYX verbinden',
    disconnect: 'Verbindung auf diesem Gerät trennen',
    conflictTitle: 'Zwei verschiedene Spielstände',
    conflictBody: 'Spielstand {slot} wurde auf zwei Geräten unterschiedlich weitergespielt. Welcher soll gelten? Der andere wird als Sicherung aufbewahrt.',
    cloud: 'Stand aus der ORYX-Cloud',
    local: 'Stand auf diesem Gerät',
    later: 'Später entscheiden',
    deletedTitle: 'Spielstand anderswo gelöscht',
    deletedBody: 'Spielstand {slot} wurde auf einem anderen Gerät gelöscht. Hier behalten oder auch hier löschen?',
    keep: 'Hier behalten und wieder sichern',
    deleteHere: 'Auch hier löschen',
    newerTitle: 'Neuere Spielversion',
    newerBody: 'Spielstand {slot} stammt aus einer neueren Version des Spiels. Lade die Seite neu, damit er übernommen wird. Bis dahin bleibt er unberührt.',
    ok: 'Verstanden',
    thisDevice: 'dieses Gerät',
    unknownDevice: 'anderes Gerät',
    justNow: 'gerade eben', minutes: 'vor {n} Min.', hours: 'vor {n} Std.',
    playtime: '{h} h {m} min',
  },
  en: {
    guest: 'ORYX cloud: not connected',
    connected: 'ORYX cloud: connected',
    disabled: 'ORYX cloud: switched off in ORYX',
    offline: 'ORYX cloud: offline, saved locally',
    error: 'ORYX cloud: currently unreachable',
    saved: 'saved',
    conflictPending: 'conflict, resolved at next start',
    connect: 'Connect with ORYX',
    disconnect: 'Disconnect on this device',
    conflictTitle: 'Two different saves',
    conflictBody: 'Save {slot} was continued differently on two devices. Which one should count? The other one is kept as a backup.',
    cloud: 'Save from the ORYX cloud',
    local: 'Save on this device',
    later: 'Decide later',
    deletedTitle: 'Save deleted elsewhere',
    deletedBody: 'Save {slot} was deleted on another device. Keep it here or delete it here too?',
    keep: 'Keep it here and back it up again',
    deleteHere: 'Delete it here too',
    newerTitle: 'Newer game version',
    newerBody: 'Save {slot} comes from a newer version of the game. Reload the page to take it over. Until then it stays untouched.',
    ok: 'Got it',
    thisDevice: 'this device',
    unknownDevice: 'another device',
    justNow: 'just now', minutes: '{n} min ago', hours: '{n} h ago',
    playtime: '{h} h {m} min',
  },
}

const REFRESH_EARLY_MS = 60_000
const DECLINE_PAUSE_MS = 30 * 24 * 3600_000
const PLAYTIME_REPORT_MS = 5 * 60_000
const PLAYTIME_MIN_MS = 60_000
const PLAYTIME_MAX_MS = 30 * 60_000
const KEEPALIVE_LIMIT = 60_000

// ---------------------------------------------------------------- helpers (exported for tests)

// Same JSON for the same content on every device: object keys sorted, recursively.
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return '[' + value.map(item => canonicalJson(item === undefined ? null : item)).join(',') + ']'
  const keys = Object.keys(value).filter(key => value[key] !== undefined && typeof value[key] !== 'function').sort()
  return '{' + keys.map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}'
}

function base64Url(bytes) {
  let text = ''
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(part))))
  } catch { return null }
}

function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin } catch { return false }
}

// ---------------------------------------------------------------- the SDK

export function createOryx(options = {}) {
  const env = resolveEnv(options.env)
  const gameId = String(options.gameId || '')
  const supabaseUrl = String(options.supabaseUrl || '').replace(/\/+$/, '')
  const publishableKey = String(options.publishableKey || '')
  const redirectUri = String(options.redirectUri || '')
  const localeOf = typeof options.locale === 'function' ? options.locale : () => options.locale || 'de'
  const onConflict = typeof options.onConflict === 'function' ? options.onConflict : null
  const useDialog = options.ui !== false
  const debounceMs = options.debounceMs ?? 15_000
  const maxWaitMs = options.maxWaitMs ?? 60_000
  const requestTimeoutMs = options.requestTimeoutMs ?? 8_000
  const active = Boolean(gameId && supabaseUrl && publishableKey && redirectUri) && options.enabled !== false
    && sameOrigin(env.location?.href, redirectUri)

  const key = name => `oryx.${gameId}.${name}`
  const store = {
    get(name, area = env.localStorage) { try { const raw = area?.getItem(key(name)); return raw ? JSON.parse(raw) : null } catch { return null } },
    set(name, value, area = env.localStorage) {
      try { value === null || value === undefined ? area?.removeItem(key(name)) : area?.setItem(key(name), JSON.stringify(value)) } catch { /* storage full or blocked */ }
    },
  }

  let status = active ? 'guest' : 'inactive'
  let lastSyncAt = store.get('lastSync') || 0
  const listeners = new Set()
  const slots = new Map()
  let refreshing = null
  let lifecycleWatched = false

  const text = (name, values = {}) => {
    const table = TEXT[localeOf()] || TEXT.de
    return String(table[name] ?? TEXT.de[name] ?? name).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '')
  }

  function setStatus(next) {
    if (status === 'inactive' || status === next) return
    status = next
    for (const listener of listeners) { try { listener(status) } catch { /* a listener must not break sync */ } }
  }

  // ---- network -------------------------------------------------------------------------------------

  async function request(path, { method = 'GET', body, token, timeoutMs = requestTimeoutMs, keepalive = false, form = false } = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timer = controller ? env.setTimeout(() => controller.abort(), timeoutMs) : null
    const headers = { apikey: publishableKey }
    if (token) headers.Authorization = 'Bearer ' + token
    let payload
    if (body !== undefined) {
      headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json'
      payload = form ? new URLSearchParams(body).toString() : JSON.stringify(body)
    }
    try {
      const response = await env.fetch(supabaseUrl + path, {
        method, headers, body: payload, keepalive: keepalive && (payload?.length || 0) < KEEPALIVE_LIMIT,
        signal: keepalive ? undefined : controller?.signal,
      })
      const raw = await response.text()
      let json = null
      try { json = raw ? JSON.parse(raw) : null } catch { json = null }
      return { ok: response.ok, status: response.status, json }
    } catch (error) {
      return { ok: false, status: 0, json: null, offline: true, timeout: error?.name === 'AbortError' }
    } finally {
      if (timer) env.clearTimeout(timer)
    }
  }

  function tokens() { return store.get('auth') }

  function keepTokens(json) {
    const claims = decodeJwt(json.access_token) || {}
    const next = {
      access: json.access_token,
      refresh: json.refresh_token,
      expiresAt: env.now() + (Number(json.expires_in) || 3600) * 1000,
      user: { id: claims.sub || null, email: claims.email || null },
    }
    store.set('auth', next)
    return next
  }

  function forgetTokens() { store.set('auth', null) }

  async function clientId() {
    const config = store.get('config')
    if (config?.clientId) return config.clientId
    const result = await request(`/rest/v1/games?select=oauth_client_id,active&id=eq.${encodeURIComponent(gameId)}`)
    const row = result.ok && Array.isArray(result.json) ? result.json[0] : null
    if (!row?.oauth_client_id || row.active === false) return null
    store.set('config', { ...(config || {}), clientId: row.oauth_client_id })
    return row.oauth_client_id
  }

  // One refresh at a time, also across tabs (Web Locks): Supabase rotates refresh tokens, a second
  // concurrent refresh with the old token would fail and log the player out.
  function withLock(name, task) {
    const locks = env.navigator?.locks
    if (locks?.request) return locks.request(`oryx-${gameId}-${name}`, task)
    return task()
  }

  function refreshTokens() {
    if (refreshing) return refreshing
    const before = tokens()
    refreshing = withLock('auth', async () => {
      const current = tokens()
      if (!current?.refresh) return null
      // Another tab refreshed meanwhile: use its tokens.
      if (before && current.refresh !== before.refresh && current.expiresAt - env.now() > REFRESH_EARLY_MS) return current
      const id = await clientId()
      if (!id) return current
      const result = await request('/auth/v1/oauth/token', { method: 'POST', form: true,
        body: { grant_type: 'refresh_token', refresh_token: current.refresh, client_id: id } })
      if (result.ok && result.json?.access_token) return keepTokens(result.json)
      if (result.status >= 400 && result.status < 500) {
        // Revoked in ORYX ("Trennen") or expired: back to guest, local saves stay as they are.
        forgetTokens()
        setStatus('guest')
        return null
      }
      setStatus('offline')
      return null
    }).finally(() => { refreshing = null })
    return refreshing
  }

  async function validToken() {
    let current = tokens()
    if (!current?.access) return null
    if (current.expiresAt - env.now() < REFRESH_EARLY_MS) current = await refreshTokens()
    return current?.access || null
  }

  // REST/RPC as the connected player. On 401 the token is refreshed once. Never throws.
  async function authorized(path, init = {}) {
    let token = await validToken()
    if (!token) return { ok: false, status: 401, json: null }
    let result = await request(path, { ...init, token })
    if (result.status === 401) {
      const fresh = await refreshTokens()
      if (!fresh?.access) return result
      result = await request(path, { ...init, token: fresh.access })
    }
    // A timeout means slow, not offline: only a failed connection counts as offline.
    if (result.offline && !result.timeout) setStatus('offline')
    return result
  }

  const rpc = (name, args, init = {}) => authorized(`/rest/v1/rpc/${name}`, { method: 'POST', body: args, ...init })

  // ---- connecting ----------------------------------------------------------------------------------

  function cleanUrl(url = new URL(env.location.href)) {
    for (const name of ['code', 'state', 'error', 'error_description', 'error_code', 'oryx_sync']) url.searchParams.delete(name)
    return url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash
  }

  async function connect() {
    if (!active) return false
    store.set('declined', null)
    const id = await clientId()
    if (!id) return false
    const verifier = base64Url(env.crypto.getRandomValues(new Uint8Array(48)))
    const state = base64Url(env.crypto.getRandomValues(new Uint8Array(16)))
    const challenge = base64Url(await env.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    store.set('pkce', { verifier, state, returnTo: cleanUrl(), clientId: id }, env.sessionStorage)
    const url = new URL(supabaseUrl + '/auth/v1/oauth/authorize')
    url.search = new URLSearchParams({ response_type: 'code', client_id: id, redirect_uri: redirectUri,
      code_challenge: challenge, code_challenge_method: 'S256', state, scope: 'email' }).toString()
    env.location.replace(url.toString())
    return true
  }

  async function handleCallback(params) {
    const pkce = store.get('pkce', env.sessionStorage)
    if (!pkce || pkce.state !== params.get('state')) return false
    store.set('pkce', null, env.sessionStorage)
    const back = pkce.returnTo || '/'
    const here = cleanUrl()
    // Code and state never stay in the address (history, screenshots, referrer).
    if (back.split(/[?#]/)[0] === here.split(/[?#]/)[0]) env.history.replaceState(env.history.state, '', back)
    else env.history.replaceState(env.history.state, '', here)
    if (params.get('error')) {
      if (params.get('error') === 'access_denied') store.set('declined', env.now())
      return true
    }
    const result = await request('/auth/v1/oauth/token', { method: 'POST', form: true, body: {
      grant_type: 'authorization_code', code: params.get('code'), redirect_uri: redirectUri,
      code_verifier: pkce.verifier, client_id: pkce.clientId } })
    if (result.ok && result.json?.access_token) keepTokens(result.json)
    return true
  }

  async function disconnect() {
    const current = tokens()
    forgetTokens()
    store.set('declined', env.now())
    if (current?.access) request('/auth/v1/logout?scope=local', { method: 'POST', token: current.access }).catch(() => {})
    setStatus(active ? 'guest' : 'inactive')
  }

  async function loadConfig() {
    const result = await rpc('oryx_client_config', { p_game: gameId }, { timeoutMs: 2500 })
    if (result.ok && result.json?.ok) {
      store.set('config', { ...(store.get('config') || {}), syncEnabled: result.json.sync_enabled !== false,
        maxSaveBytes: result.json.max_save_bytes })
      return result.json.sync_enabled !== false ? 'connected' : 'disabled'
    }
    if (!tokens()) return 'guest'
    if (result.json?.error === 'session_revoked') { forgetTokens(); return 'guest' }
    if (result.offline) return 'offline'
    return store.get('config')?.syncEnabled === false ? 'disabled' : 'error'
  }

  // Call once at start, before the game reads its saves. Never throws.
  // Resolves 'redirecting' when it just started connecting (the page is leaving: stop booting).
  async function ready() {
    if (!active) return 'inactive'
    try {
      const params = new URLSearchParams(env.location.search)
      if ((params.has('code') || params.has('error')) && params.has('state')) await handleCallback(params)
      const wantsSync = params.get('oryx_sync') === '1'
      if (wantsSync && !params.has('code')) env.history.replaceState(env.history.state, '', cleanUrl())
      const declined = store.get('declined')
      const paused = declined && env.now() - declined < DECLINE_PAUSE_MS
      if (!tokens() && wantsSync && !paused && env.navigator?.onLine !== false) {
        if (await connect()) return 'redirecting'
      }
      if (!tokens()) { setStatus('guest'); return status }
      if (env.navigator?.onLine === false) setStatus('offline')
      else setStatus(await loadConfig())
      watchLifecycle()
      if (canSync()) playtime.start()
      return status
    } catch {
      setStatus(tokens() ? 'error' : 'guest')
      return status
    }
  }

  // ---- device --------------------------------------------------------------------------------------

  function deviceId() {
    let id = null
    try { id = env.localStorage.getItem('oryx.device') } catch { id = null }
    if (!id) {
      id = env.crypto.randomUUID ? env.crypto.randomUUID() : null
      if (id) { try { env.localStorage.setItem('oryx.device', id) } catch { /* fine */ } }
    }
    return id
  }

  let model = ''
  env.navigator?.userAgentData?.getHighEntropyValues?.(['model', 'platform'])
    .then(values => { model = values.model || '' }).catch(() => {})

  function deviceLabel() {
    const ua = env.navigator?.userAgent || ''
    const platform = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
      : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Browser'
    let app = false
    try { app = env.sessionStorage.getItem('oryx:launcher') === '1' } catch { app = false }
    return ((model || platform) + (app ? ' · ORYX-App' : ' · Browser')).slice(0, 60)
  }

  // ---- saves ---------------------------------------------------------------------------------------

  // 'offline' and 'error' still try (a success switches back to 'connected'); 'disabled' never does.
  const canSync = () => Boolean(tokens()) && ['connected', 'offline', 'error'].includes(status)
  const userKey = () => tokens()?.user?.id || 'anon'

  function slot(name, config) {
    const slotName = String(name)
    if (!/^[a-z0-9_-]{1,32}$/.test(slotName)) throw new Error('oryx: invalid slot name ' + slotName)
    if (slots.has(slotName)) return slots.get(slotName)
    const handle = createSlot(slotName, config)
    slots.set(slotName, handle)
    return handle
  }

  function createSlot(name, config) {
    const schemaVersion = Number(config.schemaVersion) || 1
    let timer = null
    let firstDirtyAt = 0
    let applying = false
    let uploading = null
    const stateName = () => `sync.${userKey()}.${name}`
    const state = () => ({ base: 0, hash: null, dirty: false, conflict: false, pendingDelete: false, ...(store.get(stateName()) || {}) })
    const patch = values => store.set(stateName(), { ...state(), ...values })

    async function snapshot() {
      const data = await config.read()
      if (data === null || data === undefined) return null
      const json = canonicalJson(data)
      const digest = await env.crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
      return { data, json, hash: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') }
    }

    function describe(side) {
      const parts = []
      if (side.device) parts.push(side.device)
      if (side.at) parts.push(ago(side.at))
      if (Number.isFinite(side.playtime) && side.playtime > 0) {
        const minutes = Math.round(side.playtime / 60000)
        parts.push(text('playtime', { h: Math.floor(minutes / 60), m: minutes % 60 }))
      }
      if (side.summary && typeof side.summary === 'object') {
        for (const [k, v] of Object.entries(side.summary).slice(0, 3)) parts.push(`${k} ${v}`)
      }
      return parts.join(' · ')
    }

    const summaryOf = data => { try { return config.summarize ? config.summarize(data) ?? null : null } catch { return null } }
    const playtimeOf = data => { try { return config.playtime ? Number(config.playtime(data)) || null : null } catch { return null } }

    async function fetchMeta(timeoutMs) {
      const result = await authorized(`/rest/v1/cloud_saves?select=revision,save_version,data_hash,summary,playtime_ms,device_label,updated_at,deleted_at&game_id=eq.${encodeURIComponent(gameId)}&slot=eq.${encodeURIComponent(name)}`, { timeoutMs })
      if (!result.ok) return { ok: false, reason: result.timeout ? 'timeout' : result.offline ? 'offline' : 'error' }
      return { ok: true, row: Array.isArray(result.json) ? result.json[0] || null : null }
    }

    async function fetchData() {
      const result = await authorized(`/rest/v1/cloud_saves?select=revision,save_version,save_data,data_hash&game_id=eq.${encodeURIComponent(gameId)}&slot=eq.${encodeURIComponent(name)}`)
      return result.ok && Array.isArray(result.json) ? result.json[0] || null : null
    }

    // Local copy of what is about to be replaced by the cloud (the cloud keeps its own history).
    function backupLocal(local) {
      if (!local) return
      store.set(`backup.${name}`, { at: env.now(), json: local.json })
    }

    async function download() {
      const full = await fetchData()
      if (!full) return false
      let data = full.save_data
      if (full.save_version < schemaVersion && config.migrate) data = await config.migrate(data, full.save_version)
      backupLocal(await snapshot().catch(() => null))
      applying = true
      try { await config.write(data) } finally { applying = false }
      const after = await snapshot()
      patch({ base: full.revision, hash: after?.hash ?? full.data_hash, dirty: false, conflict: false })
      markSynced()
      return true
    }

    async function upload({ base = state().base, keepalive = false, retried = false } = {}) {
      const local = await snapshot()
      if (!local) return 'empty'
      const maxBytes = store.get('config')?.maxSaveBytes || 1_048_576
      if (new TextEncoder().encode(local.json).length > maxBytes) return 'too_large'
      const result = await rpc('oryx_put_save', {
        p_game: gameId, p_slot: name, p_data: JSON.parse(local.json), p_base_revision: base,
        p_save_version: schemaVersion, p_data_hash: local.hash, p_summary: summaryOf(local.data),
        p_playtime_ms: playtimeOf(local.data), p_device_id: deviceId(), p_device_label: deviceLabel(),
        p_client_saved_at: new Date(env.now()).toISOString(),
      }, { keepalive })
      const answer = result.json || {}
      if (result.ok && answer.ok) {
        patch({ base: answer.revision, hash: local.hash, dirty: false, conflict: false, pendingDelete: false })
        markSynced()
        return 'ok'
      }
      if (result.offline) return 'offline'
      if (answer.error === 'sync_disabled') { setStatus('disabled'); return 'disabled' }
      // The server accepts one write per slot every 5 s; wait once instead of failing.
      if (answer.error === 'too_fast' && !keepalive && !retried) {
        await new Promise(done => env.setTimeout(done, answer.retry_after_ms || 5000))
        return upload({ base, retried: true })
      }
      if (answer.error === 'session_revoked') { await refreshTokens(); return 'revoked' }
      return answer.error || 'error'
    }

    // Decides like section 7 of the plan. Returns what happened; the game re-reads its save on 'pulled'.
    async function pull({ timeoutMs = 2500 } = {}) {
      if (!canSync()) return status === 'inactive' ? 'inactive' : status
      try {
        const meta = await fetchMeta(timeoutMs)
        if (!meta.ok) return meta.reason
        const cloud = meta.row
        const local = await snapshot()
        const known = state()

        if (cloud && !cloud.deleted_at && cloud.save_version > schemaVersion) {
          await choose({ title: text('newerTitle'), body: text('newerBody', { slot: name }), options: [{ value: 'later', label: text('ok'), primary: true }] })
          return 'newer-version'
        }
        if (!cloud) {
          if (!local) return 'none'
          const done = await upload({ base: 0 })
          return done === 'ok' ? 'pushed' : done
        }
        if (cloud.deleted_at) {
          if (!local) { patch({ base: cloud.revision, hash: null, dirty: false }); return 'none' }
          if (known.pendingDelete) return 'none'
          const pick = await decide({ kind: 'deleted', slot: name, cloud: side(cloud), local: sideOfLocal(local) })
          if (pick === 'keep') { const done = await upload({ base: cloud.revision }); return done === 'ok' ? 'pushed' : done }
          if (pick === 'delete' && config.remove) {
            applying = true
            try { await config.remove() } finally { applying = false }
            patch({ base: cloud.revision, hash: null, dirty: false, conflict: false })
            return 'removed'
          }
          patch({ conflict: true })
          return 'later'
        }
        if (!local) return (await download()) ? 'pulled' : 'error'
        if (local.hash === cloud.data_hash) {
          patch({ base: cloud.revision, hash: local.hash, dirty: false, conflict: false })
          return 'none'
        }
        const syncedBefore = known.hash !== null && known.base > 0
        const unchanged = syncedBefore && local.hash === known.hash
        if (unchanged) return cloud.revision === known.base ? 'none' : ((await download()) ? 'pulled' : 'error')
        if (syncedBefore && cloud.revision === known.base) {
          const done = await upload({ base: known.base })
          return done === 'ok' ? 'pushed' : done
        }
        // Both sides changed (or a guest save meets an existing cloud save).
        if (config.merge) {
          const full = await fetchData()
          if (!full) return 'error'
          const merged = await config.merge(local.data, full.save_data)
          applying = true
          try { await config.write(merged) } finally { applying = false }
          const done = await upload({ base: full.revision })
          return done === 'ok' ? 'merged' : done
        }
        const pick = await decide({ kind: 'conflict', slot: name, cloud: side(cloud), local: sideOfLocal(local) })
        if (pick === 'cloud') return (await download()) ? 'pulled' : 'error'
        if (pick === 'local') { const done = await upload({ base: cloud.revision }); return done === 'ok' ? 'pushed' : done }
        patch({ conflict: true })
        return 'later'
      } catch {
        return 'error'
      }
    }

    function side(cloud) {
      return { device: cloud.device_label || text('unknownDevice'), at: cloud.updated_at, summary: cloud.summary, playtime: cloud.playtime_ms }
    }
    function sideOfLocal(local) {
      return { device: text('thisDevice'), at: null, summary: summaryOf(local.data), playtime: playtimeOf(local.data) }
    }

    async function decide(conflict) {
      const described = { ...conflict, cloudText: describe(conflict.cloud), localText: describe(conflict.local) }
      if (onConflict) {
        try { return await onConflict(described) } catch { return 'later' }
      }
      if (!useDialog) return 'later'
      if (conflict.kind === 'deleted') {
        const options = [{ value: 'keep', label: text('keep'), detail: described.localText, primary: true }]
        if (config.remove) options.push({ value: 'delete', label: text('deleteHere') })
        options.push({ value: 'later', label: text('later') })
        return choose({ title: text('deletedTitle'), body: text('deletedBody', { slot: name }), options })
      }
      const cloudAhead = (conflict.cloud.playtime || 0) > (conflict.local.playtime || 0)
      return choose({ title: text('conflictTitle'), body: text('conflictBody', { slot: name }), options: [
        { value: 'cloud', label: text('cloud'), detail: described.cloudText, primary: cloudAhead },
        { value: 'local', label: text('local'), detail: described.localText, primary: !cloudAhead },
        { value: 'later', label: text('later') },
      ] })
    }

    function schedule() {
      const now = env.now()
      if (!firstDirtyAt) firstDirtyAt = now
      env.clearTimeout(timer)
      const wait = Math.max(0, Math.min(debounceMs, firstDirtyAt + maxWaitMs - now))
      timer = env.setTimeout(() => { flush() }, wait)
    }

    function markChanged() {
      if (applying || status === 'inactive' || !tokens()) return
      const current = state()
      if (current.conflict) return
      if (!current.dirty) patch({ dirty: true })
      if (canSync()) schedule()
    }

    // Uploads now if something is waiting. Safe to call often (page hidden, before leaving).
    function flush({ keepalive = false } = {}) {
      env.clearTimeout(timer)
      timer = null
      firstDirtyAt = 0
      if (!canSync()) return Promise.resolve('skipped')
      const current = state()
      if (current.conflict) return Promise.resolve('conflict')
      // A deletion waits only while nothing new was saved; a new save in the same slot replaces it.
      if (current.pendingDelete && !current.dirty) return removeNow()
      if (!current.dirty) return Promise.resolve('clean')
      if (uploading) return uploading.then(() => flush({ keepalive }))
      uploading = upload({ base: current.base, keepalive }).then(async result => {
        // A newer cloud save (conflict) or one from a newer game version: stop uploading this slot
        // until the next start decides (pull), never in the middle of play.
        if (result === 'conflict' || result === 'newer_version') patch({ conflict: true })
        if (result === 'too_fast') schedule()
        if (result === 'offline' || result === 'error') schedule()
        return result
      }).finally(() => { uploading = null })
      return uploading
    }

    async function removeNow() {
      const current = state()
      if (!canSync()) { patch({ pendingDelete: true, dirty: false, hash: null }); return 'pending' }
      let result = await rpc('oryx_delete_save', { p_game: gameId, p_slot: name, p_base_revision: current.base })
      if (result.json?.error === 'conflict') {
        result = await rpc('oryx_delete_save', { p_game: gameId, p_slot: name, p_base_revision: result.json.revision })
      }
      if (result.ok && result.json?.ok) {
        patch({ base: result.json.revision ?? current.base, hash: null, dirty: false, conflict: false, pendingDelete: false })
        return 'removed'
      }
      patch({ pendingDelete: true, dirty: false, hash: null })
      return result.offline ? 'offline' : 'error'
    }

    // The player deleted this save locally: mark it deleted in the cloud (its last version stays in
    // the cloud history). Without a connection the deletion waits and is sent later.
    function remove() {
      if (status === 'inactive') return Promise.resolve('inactive')
      if (!tokens()) return Promise.resolve('guest')
      env.clearTimeout(timer)
      timer = null
      firstDirtyAt = 0
      if (!state().base && !state().dirty) { patch({ hash: null, dirty: false, conflict: false }); return Promise.resolve('none') }
      return removeNow()
    }

    return {
      name,
      pull, markChanged, flush, remove,
      get state() { return state() },
    }
  }

  function markSynced() {
    lastSyncAt = env.now()
    store.set('lastSync', lastSyncAt)
    if (status !== 'connected' && tokens()) setStatus('connected')
  }

  function flushAll(options) { return Promise.all([...slots.values()].map(handle => handle.flush(options))) }

  function watchLifecycle() {
    if (lifecycleWatched || !env.window?.addEventListener) return
    lifecycleWatched = true
    const leaving = () => { flushAll({ keepalive: true }); playtime.report({ keepalive: true }) }
    env.document?.addEventListener?.('visibilitychange', () => {
      if (env.document.visibilityState === 'hidden') { playtime.pause(); leaving() } else playtime.resume()
    })
    env.window.addEventListener('pagehide', leaving)
    env.window.addEventListener('online', async () => {
      if (!tokens()) return
      setStatus(await loadConfig())
      if (status === 'connected') flushAll()
    })
    env.window.addEventListener('offline', () => { if (tokens()) setStatus('offline') })
  }

  // ---- play time (foreground time only, reported in chunks; ORYX shows it) -------------------------

  const playtime = (() => {
    let since = null
    let collected = 0
    let interval = null
    const visible = () => env.document?.visibilityState !== 'hidden'
    const take = () => { if (since !== null) { collected += Math.max(0, env.now() - since); since = env.now() } }
    return {
      start() {
        if (interval || status === 'inactive') return
        if (visible()) since = env.now()
        interval = env.setInterval(() => { take(); this.report() }, PLAYTIME_REPORT_MS)
      },
      pause() { take(); since = null },
      resume() { if (interval && since === null) since = env.now() },
      async report({ keepalive = false } = {}) {
        take()
        if (collected < PLAYTIME_MIN_MS || !canSync()) return
        const amount = Math.min(collected, PLAYTIME_MAX_MS)
        collected -= amount
        const result = await rpc('oryx_add_playtime', { p_game: gameId, p_ms: Math.round(amount) }, { keepalive })
        if (!result.ok) collected += amount
      },
      get pending() { take(); return collected },
    }
  })()

  // ---- dialog (touch, mouse, keyboard and gamepad; used only for decisions at start) ---------------

  function ago(iso) {
    const minutes = Math.round((env.now() - new Date(iso).getTime()) / 60000)
    if (!Number.isFinite(minutes)) return ''
    if (minutes < 1) return text('justNow')
    if (minutes < 60) return text('minutes', { n: minutes })
    const hours = Math.round(minutes / 60)
    if (hours < 48) return text('hours', { n: hours })
    return new Date(iso).toLocaleDateString(localeOf() === 'en' ? 'en-GB' : 'de-AT')
  }

  function choose({ title, body, options }) {
    const doc = env.document
    if (!doc?.body || !useDialog) return Promise.resolve('later')
    return new Promise(resolve => {
      const overlay = doc.createElement('div')
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.setAttribute('aria-label', title)
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '2147483646', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', boxSizing: 'border-box', background: 'rgba(5, 8, 14, 0.78)',
        font: '15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif', color: '#f4f7fb',
      })
      const panel = doc.createElement('div')
      Object.assign(panel.style, {
        width: 'min(30rem, 100%)', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box', padding: '20px',
        background: '#121826', border: '1px solid rgba(255, 255, 255, 0.16)', borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      })
      const heading = doc.createElement('h2')
      heading.textContent = title
      Object.assign(heading.style, { margin: '0 0 8px', fontSize: '18px', lineHeight: '1.3' })
      const para = doc.createElement('p')
      para.textContent = body
      Object.assign(para.style, { margin: '0 0 16px', color: '#b9c3d2' })
      panel.append(heading, para)
      const buttons = options.map(option => {
        const button = doc.createElement('button')
        button.type = 'button'
        const label = doc.createElement('span')
        label.textContent = option.label
        Object.assign(label.style, { display: 'block', fontWeight: '700' })
        button.append(label)
        if (option.detail) {
          const detail = doc.createElement('span')
          detail.textContent = option.detail
          Object.assign(detail.style, { display: 'block', fontSize: '13px', color: '#b9c3d2', marginTop: '2px' })
          button.append(detail)
        }
        Object.assign(button.style, {
          display: 'block', width: '100%', minHeight: '52px', margin: '0 0 10px', padding: '10px 14px', boxSizing: 'border-box',
          textAlign: 'left', color: '#f4f7fb', font: 'inherit', cursor: 'pointer', borderRadius: '12px',
          background: option.primary ? '#26324a' : '#1a2233', border: '1px solid rgba(255, 255, 255, 0.16)', outline: 'none',
        })
        button.addEventListener('focus', () => { button.style.boxShadow = '0 0 0 3px #ffb13d' })
        button.addEventListener('blur', () => { button.style.boxShadow = 'none' })
        button.addEventListener('click', () => finish(option.value))
        panel.append(button)
        return button
      })
      overlay.append(panel)
      doc.body.append(overlay)
      let index = Math.max(0, options.findIndex(option => option.primary))
      buttons[index]?.focus()
      const move = step => { index = (index + step + buttons.length) % buttons.length; buttons[index].focus() }

      // The game underneath must not react to these keys.
      const onKey = event => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
        if (event.key in keys) move(keys[event.key])
        else if (event.key === 'Enter' || event.key === ' ') buttons[index].click()
        else if (event.key === 'Escape') finish('later')
        else if (event.key !== 'Tab') return
        if (event.key !== 'Tab') event.preventDefault()
        event.stopImmediatePropagation()
      }
      env.window.addEventListener('keydown', onKey, true)

      // Gamepad (Retroid & co.): D-pad or stick moves, A chooses, B = later. Polled while open.
      let frame = 0
      let held = {}
      const poll = () => {
        const pad = [...(env.navigator?.getGamepads?.() || [])].find(Boolean)
        if (pad) {
          const pressed = i => Boolean(pad.buttons?.[i]?.pressed)
          const axis = pad.axes?.[1] || 0
          const now = { up: pressed(12) || axis < -0.6, down: pressed(13) || axis > 0.6, a: pressed(0), b: pressed(1) }
          if (now.up && !held.up) move(-1)
          if (now.down && !held.down) move(1)
          if (now.a && !held.a && held.seen) buttons[index].click()
          if (now.b && !held.b && held.seen) finish('later')
          held = { ...now, seen: true }
        }
        frame = env.requestAnimationFrame(poll)
      }
      frame = env.requestAnimationFrame(poll)

      function finish(value) {
        env.window.removeEventListener('keydown', onKey, true)
        env.cancelAnimationFrame(frame)
        overlay.remove()
        resolve(value)
      }
    })
  }

  // ---- public --------------------------------------------------------------------------------------

  return {
    version: ORYX_SDK_VERSION,
    get status() { return status },
    get user() { return tokens()?.user || null },
    get lastSyncAt() { return lastSyncAt || null },
    ready, connect, disconnect, slot,
    flush: flushAll,
    onStatus(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    // One line for the game's menu ('' when inactive, e.g. locally).
    describe() {
      if (status === 'inactive') return ''
      let line = text(status in TEXT.de ? status : 'error')
      if (status === 'connected' && lastSyncAt) line += ' · ' + text('saved') + ' ' + ago(new Date(lastSyncAt).toISOString())
      if ([...slots.values()].some(handle => handle.state.conflict)) line += ' · ' + text('conflictPending')
      return line
    },
    text,
    playtime,
  }
}

function resolveEnv(env = {}) {
  const g = globalThis
  return {
    window: env.window ?? g.window ?? g,
    document: env.document ?? g.document,
    location: env.location ?? g.location,
    history: env.history ?? g.history,
    navigator: env.navigator ?? g.navigator,
    localStorage: env.localStorage ?? safe(() => g.localStorage),
    sessionStorage: env.sessionStorage ?? safe(() => g.sessionStorage),
    crypto: env.crypto ?? g.crypto,
    fetch: env.fetch ?? ((...args) => g.fetch(...args)),
    now: env.now ?? (() => Date.now()),
    setTimeout: env.setTimeout ?? ((fn, ms) => g.setTimeout(fn, ms)),
    clearTimeout: env.clearTimeout ?? (id => g.clearTimeout(id)),
    setInterval: env.setInterval ?? ((fn, ms) => g.setInterval(fn, ms)),
    requestAnimationFrame: env.requestAnimationFrame ?? (fn => (g.requestAnimationFrame ? g.requestAnimationFrame(fn) : g.setTimeout(fn, 16))),
    cancelAnimationFrame: env.cancelAnimationFrame ?? (id => (g.cancelAnimationFrame ? g.cancelAnimationFrame(id) : g.clearTimeout(id))),
  }
}

function safe(read) { try { return read() } catch { return null } }
