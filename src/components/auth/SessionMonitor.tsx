"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export function SessionMonitor() {
    const supabase = createClient()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        if (!supabase) return

        // 1. Listen for Auth State Changes (Sign Out, Session Expiry)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            console.log("Auth Event:", event, session ? "Session Active" : "No Session")

            if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
                // Ignore if we are already on a public page
                const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
                if (!isPublicPage) {
                    console.log("Session Monitor: Redirecting to login due to session loss")
                    window.location.href = "/login?message=Session expired. Please log in again."
                }
            }
        })

        // 2. Tab Visibility Listener (Refresh on return)
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log("Tab Active: Checking session validity...")
                const { data: { session }, error } = await supabase.auth.getSession()

                if (error || !session) {
                    const isPublicPage = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/signup')
                    if (!isPublicPage) {
                        window.location.href = "/login?message=Your session has ended."
                    }
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            subscription.unsubscribe()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [supabase, router, pathname])

    return null // Invisible component
}
