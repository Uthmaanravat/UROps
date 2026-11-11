export const PRODUCTION_APP_URL = "https://ur-ops.vercel.app"

/**
 * Returns the canonical base URL for all outgoing links (invites, quote accept links,
 * share links, email buttons, password reset, auth callbacks).
 *
 * Rules:
 * - Reads APP_URL, NEXT_PUBLIC_APP_URL, or NEXT_PUBLIC_SITE_URL.
 * - In preview: Uses its own deployment URL (via VERCEL_URL or preview-specific APP_URL).
 * - In production: Always uses https://ur-ops.vercel.app (never falls back to localhost).
 * - In local development: Falls back to http://localhost:3000.
 */
export function getAppUrl(): string {
    const isProductionEnv = process.env.VERCEL_ENV === "production"
    const isPreviewEnv =
        process.env.VERCEL_ENV === "preview" ||
        (Boolean(process.env.VERCEL_URL) && process.env.VERCEL_ENV !== "production")

    // In preview environment, check if preview-specific URL is available
    if (isPreviewEnv) {
        const customCandidate = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "")
        if (
            customCandidate &&
            !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(customCandidate) &&
            !customCandidate.includes("ur-ops.vercel.app")
        ) {
            return customCandidate.startsWith("http") ? customCandidate : `https://${customCandidate}`
        }
        if (process.env.VERCEL_URL) {
            const vUrl = process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
            return `https://${vUrl}`
        }
    }

    // In production environment
    if (isProductionEnv) {
        const prodCandidate = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "")
        if (prodCandidate && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(prodCandidate)) {
            return prodCandidate.startsWith("http") ? prodCandidate : `https://${prodCandidate}`
        }
        return PRODUCTION_APP_URL
    }

    // Standard candidates (for local development or custom deployments)
    const candidates = [
        process.env.APP_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_SITE_URL,
    ]

    for (const raw of candidates) {
        const trimmed = (raw || "").trim().replace(/\/+$/, "")
        if (!trimmed) continue
        return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    }

    return "http://localhost:3000"
}

export function buildAppUrl(path: string): string {
    const base = getAppUrl()
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    return `${base}${cleanPath}`
}
