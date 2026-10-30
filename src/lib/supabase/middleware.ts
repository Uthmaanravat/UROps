import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', request.nextUrl.pathname)

    let response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return response
    }

    try {
        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            request.cookies.set({
                                name,
                                value,
                                ...options,
                            })
                            response = NextResponse.next({
                                request: {
                                    headers: requestHeaders,
                                },
                            })
                            response.cookies.set({
                                name,
                                value,
                                ...options,
                            })
                        } catch {
                            // Ignore cookie set errors in middleware
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            request.cookies.set({
                                name,
                                value: '',
                                ...options,
                            })
                            response = NextResponse.next({
                                request: {
                                    headers: requestHeaders,
                                },
                            })
                            response.cookies.set({
                                name,
                                value: '',
                                ...options,
                            })
                        } catch {
                            // Ignore cookie remove errors in middleware
                        }
                    },
                },
            }
        )

        await supabase.auth.getUser()

        return response
    } catch (e) {
        console.error("updateSession error:", e)
        return response
    }
}
