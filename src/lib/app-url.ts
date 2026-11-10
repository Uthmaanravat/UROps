export const PRODUCTION_APP_URL = "https://ur-ops.vercel.app"

/**
 * Returns the canonical base URL for all outgoing links (invites, quote accept links,
 * share links, email buttons, password reset, auth callbacks).
 *
 * Rules:
 * - Reads APP_URL, NEXT_PUBLIC_APP_URL, or NEXT_PUBLIC_SITE_URL.
 * - In production (VERCEL_ENV === 'production', NODE_ENV === 'production', or VERCEL),
 *   NEVER falls back to localhost / 127.0.0.1; always uses https://ur-ops.vercel.app
 *   if an env var is missing or points to localhost.
 */
export function getAppUrl(): string {
    const isProductionEnv =
        process.env.VERCEL_ENV === "production" ||
        process.env.NODE_ENV === "production" ||
        Boolean(process.env.VERCEL)

    const candidates = [
        process.env.APP_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
    ]

    for (const raw of candidates) {
        const trimmed = (raw || "").trim().replace(/\/+$/, "")
        if (!trimmed) continue
        const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(trimmed)
        if (isProductionEnv && isLocal) {
            continue
        }
        return trimmed
    }

    if (isProductionEnv) {
        return PRODUCTION_APP_URL
    }

    return "http://localhost:3000"
}

export function buildAppUrl(path: string): string {
    const base = getAppUrl()
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    return `${base}${cleanPath}`
}
