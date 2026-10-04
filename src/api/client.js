const ACCESS_TOKEN_KEY = 'library-access-token'
const REFRESH_TOKEN_KEY = 'library-refresh-token'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
let refreshInFlight = null

export class ApiError extends Error {
  constructor(message, { status, data, meta } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.meta = meta
  }
}

export function setSessionTokens(tokens = {}) {
  accessToken = tokens.accessToken || tokens.token || null
  refreshToken = tokens.refreshToken || null
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  else localStorage.removeItem(ACCESS_TOKEN_KEY)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  else localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getSessionTokens() {
  return { accessToken, refreshToken }
}

export function clearSessionTokens() {
  setSessionTokens()
}

async function readEnvelope(response) {
  const text = await response.text()
  let envelope
  try {
    envelope = text ? JSON.parse(text) : { success: response.ok, message: response.statusText, data: null, meta: {} }
  } catch (error) {
    throw new ApiError('The API returned an invalid JSON response.', { status: response.status, data: error })
  }
  if (!response.ok || envelope.success === false) {
    throw new ApiError(envelope.message || `Request failed with status ${response.status}.`, {
      status: response.status,
      data: envelope.errors ?? envelope.data,
      meta: envelope.meta,
    })
  }
  if (!Object.hasOwn(envelope, 'data')) {
    throw new ApiError('The API response is missing its data field.', { status: response.status, data: envelope })
  }
  return { success: envelope.success, message: envelope.message || '', data: envelope.data, meta: envelope.meta || {} }
}

async function refreshSession() {
  if (!refreshToken) {
    clearSessionTokens()
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401 })
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const envelope = await readEnvelope(response)
      if (!envelope.data?.accessToken && !envelope.data?.token) {
        throw new ApiError('The refresh response did not include an access token.', { status: response.status, data: envelope.data })
      }
      setSessionTokens(envelope.data)
      return accessToken
    })().catch((error) => {
      clearSessionTokens()
      throw error
    }).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

async function performRequest(path, { method = 'GET', body, query, auth = true, retry = true, signal } = {}) {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal })
  if (response.status === 401 && auth && retry && !/^\/auth\/(login|refresh|logout)$/.test(path)) {
    await refreshSession()
    return performRequest(path, { method, body, query, auth, retry: false, signal })
  }
  return readEnvelope(response)
}

async function get(path, options) {
  return (await performRequest(path, options)).data
}

async function send(path, method, body, options) {
  return (await performRequest(path, { ...options, method, body })).data
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  request: performRequest,
  get,
  post: (path, body, options) => send(path, 'POST', body, options),
  put: (path, body, options) => send(path, 'PUT', body, options),
  patch: (path, body, options) => send(path, 'PATCH', body, options),
  delete: (path, options) => send(path, 'DELETE', undefined, options),
  async list(path, query = {}) {
    const limit = Number(query.limit || 100)
    let page = Number(query.page || 1)
    let items = []
    let total
    let meta
    do {
      const envelope = await performRequest(path, { query: { ...query, page, limit } })
      if (!Array.isArray(envelope.data)) throw new ApiError(`Expected an array response from ${path}.`, { data: envelope.data })
      items = items.concat(envelope.data)
      meta = envelope.meta
      total = meta.total
      page += 1
    } while (total !== undefined && items.length < Number(total))
    return { data: items, meta }
  },
}
