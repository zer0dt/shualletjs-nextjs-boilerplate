import { createClient } from '@supabase/supabase-js'

export const createSupabaseClient = (token?: string) => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    }
  )
}

export { createClient }