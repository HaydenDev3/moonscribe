import { createClient } from '@supabase/supabase-js'

function readEnv(...keys: string[]) {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  for (const key of keys) {
    const value = env?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

const url = readEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
const key = readEnv('VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

export const supabaseConfig = {
  url,
  key,
  enabled: Boolean(url && key),
}

export const supabase = supabaseConfig.enabled
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.enabled)
}
