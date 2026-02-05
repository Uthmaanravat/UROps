import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase environment variables are missing. Auth will not work.")
        return null as any // Return a mock or null if preferred, but usually better to handle upstream
    }

    return createBrowserClient(
        supabaseUrl,
        supabaseAnonKey
    )
}
