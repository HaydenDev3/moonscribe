/* global RequestInit, AbortController, Headers */
import type { ApiErrorCode, ApiErrorShape } from './contracts'

export class ApiRequestError extends Error {
  status: number
  code: ApiErrorCode
  retryable: boolean
  requestId?: string

  constructor(message: string, status = 0, code: ApiErrorCode = 'UNKNOWN', requestId?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.retryable = status === 408 || status === 429 || status >= 500 || code === 'OFFLINE' || code === 'TIMEOUT'
    this.requestId = requestId
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function errorCode(status: number, data: ApiErrorShape): ApiErrorCode {
  if (status === 401 || status === 403) return 'AUTH_EXPIRED'
  if (status === 408) return 'TIMEOUT'
  if (status === 429) return 'RATE_LIMITED'
  if (status >= 500) return 'SERVER_ERROR'
  if (data.code === 'CONFLICT') return 'CONFLICT'
  if (data.code === 'VALIDATION') return 'VALIDATION'
  return 'UNKNOWN'
}

export async function requestJson<T>(url: string, init: RequestInit = {}, options: { retries?: number; timeoutMs?: number; idempotencyKey?: string } = {}): Promise<T> {
  const retries = options.retries ?? 2
  const timeoutMs = options.timeoutMs ?? 12000
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const headers = init.headers instanceof Headers
        ? new Headers(init.headers)
        : { ...(init.headers as Record<string, string> | undefined) }
      if (options.idempotencyKey) {
        if (headers instanceof Headers) headers.set('Idempotency-Key', options.idempotencyKey)
        else headers['Idempotency-Key'] = options.idempotencyKey
      }
      const response = await fetch(url, { ...init, headers, signal: controller.signal })
      const data = await response.json().catch(() => ({})) as T & ApiErrorShape
      if (!response.ok) {
        const error = new ApiRequestError(data.error || `Request failed (${response.status})`, response.status, errorCode(response.status, data), data.requestId)
        if (!error.retryable || attempt === retries) throw error
        lastError = error
      } else return data as T
    } catch (error) {
      lastError = error instanceof ApiRequestError ? error : new ApiRequestError(error?.name === 'AbortError' ? 'Request timed out.' : 'The service is unreachable.', 0, error?.name === 'AbortError' ? 'TIMEOUT' : 'OFFLINE')
      if (!(lastError as ApiRequestError).retryable || attempt === retries) throw lastError
    } finally { clearTimeout(timer) }
    await sleep(Math.min(4000, 300 * (2 ** attempt)) + Math.round(Math.random() * 120))
  }
  throw lastError
}
