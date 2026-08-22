import { resolveAppEnvironment } from '../config/environment'
const trim = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''

type ApiEnvironment = {
  VITE_API_URL?: string
  VITE_SYNC_SERVER?: string
  VITE_APP_URL?: string
  VITE_MOONSCRIBE_ENV?: string
  VITE_MOONSCRIBE_WEB_URL?: string
  VITE_MOONSCRIBE_API_URL?: string
  DEV?: boolean
}

type LocationInput = { protocol?: string; origin?: string }

export function isDesktopRuntime(locationLike: LocationInput = globalThis.location) {
  const protocol = locationLike?.protocol || ''
  const tauriGlobal = globalThis as typeof globalThis & { __TAURI_INTERNALS__?: unknown }
  return protocol === 'tauri:' || /^(?:https?:\/\/)?tauri\.localhost$/i.test(locationLike?.origin || '') || Boolean(tauriGlobal.__TAURI_INTERNALS__)
}

export function apiBaseUrl(env: ApiEnvironment = import.meta.env as ApiEnvironment, locationLike: LocationInput = globalThis.location) {
  const configured = trim(env.VITE_API_URL || env.VITE_SYNC_SERVER)
  if (configured) return configured
  if (isDesktopRuntime(locationLike)) return resolveAppEnvironment(env).apiUrl
  return trim(locationLike?.origin)
}

export function webAppUrl(env: ApiEnvironment = import.meta.env as ApiEnvironment, locationLike: LocationInput = globalThis.location) {
  const configured = trim(env.VITE_APP_URL)
  if (configured) return configured
  if (isDesktopRuntime(locationLike)) return resolveAppEnvironment(env).webUrl
  return trim(locationLike?.origin)
}

export function authReturnUrl(env: ApiEnvironment = import.meta.env as ApiEnvironment, locationLike: LocationInput = globalThis.location) {
  return isDesktopRuntime(locationLike) ? 'moonscribe://auth/callback' : `${webAppUrl(env, locationLike)}/dashboard`
}
