export type MoonScribeEnvironment = 'production' | 'development'
export type AppEnvironment = { name: MoonScribeEnvironment; webUrl: string; apiUrl: string; authUrl: string; websocketUrl: string }
type EnvironmentInput = {
  DEV?: boolean
  VITE_MOONSCRIBE_ENV?: string
  VITE_MOONSCRIBE_WEB_URL?: string
  VITE_MOONSCRIBE_API_URL?: string
  VITE_API_URL?: string
}
const trim = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''

export function resolveAppEnvironment(env: EnvironmentInput): AppEnvironment {
  const name = (env.VITE_MOONSCRIBE_ENV || (env.DEV ? 'development' : 'production')) === 'development' ? 'development' : 'production'
  const webUrl = trim(env.VITE_MOONSCRIBE_WEB_URL) || (name === 'development' ? 'http://localhost:5173' : 'https://moonscribe.cc')
  const apiUrl = trim(env.VITE_MOONSCRIBE_API_URL || env.VITE_API_URL) || (name === 'development' ? 'http://localhost:3001' : 'https://moonscribe.cc')
  return { name, webUrl, apiUrl, authUrl: `${apiUrl}/auth`, websocketUrl: apiUrl.replace(/^http/, 'ws') }
}

export const appEnvironment = resolveAppEnvironment(import.meta.env)
