import { isAeroWashCompany, type EmailSettings } from "@/lib/email-templates"

export const LOGO_CID = 'company-logo'

export type EmailAttachment = {
    filename: string
    /** Raw bytes or a base64 string */
    content: Buffer | string
    contentType?: string
    /** Set to embed inline (referenced in HTML as cid:<contentId>) */
    contentId?: string
}

/**
 * Resolves the sending company's logo as an inline email attachment.
 * Gmail/Outlook block data: URLs and logos in settings are stored as data URLs, so the logo is attached inline (CID).
 * AeroWash uses its dark-header logo; every other company uses its own saved logo. Returns null if none is available.
 */
export async function resolveCompanyLogoAttachment(
    settings: EmailSettings & { logoUrl?: string | null; layoutPreferences?: any },
    companyId?: string | null
): Promise<EmailAttachment | null> {
    try {
        if (isAeroWashCompany(companyId, settings)) {
            const preferred = (settings as any)?.layoutPreferences?.darkHeaderLogoUrl || '/aerowash_header_logo.png'
            const fromPublic = await readPublicOrData(preferred) || (await readPublicOrData('/aerowash_header_logo.png'))
            if (fromPublic) return toAttachment(fromPublic)
            return null
        }
        const own = (settings as any)?.logoUrl as string | undefined
        if (!own) return null
        const resolved = await readPublicOrData(own)
        return resolved ? toAttachment(resolved) : null
    } catch (e) {
        console.warn('[Email] Could not resolve company logo:', e)
        return null
    }
}

type Resolved = { buffer: Buffer; contentType: string }

function toAttachment(r: Resolved): EmailAttachment {
    const ext = r.contentType.includes('png') ? 'png' : r.contentType.includes('svg') ? 'svg' : 'jpg'
    return { filename: `logo.${ext}`, content: r.buffer, contentType: r.contentType, contentId: LOGO_CID }
}

async function readPublicOrData(src: string): Promise<Resolved | null> {
    if (!src) return null
    if (src.startsWith('data:image/')) {
        const m = src.match(/^data:(image\/[A-Za-z0-9.+-]+);base64,(.+)$/)
        if (!m) return null
        return { buffer: Buffer.from(m[2], 'base64'), contentType: m[1] }
    }
    if (/^https?:\/\//i.test(src)) {
        const res = await fetch(src)
        if (!res.ok) return null
        const ct = res.headers.get('content-type') || 'image/png'
        return { buffer: Buffer.from(await res.arrayBuffer()), contentType: ct }
    }
    // Relative path inside /public
    const fs = await import('fs')
    const path = await import('path')
    const clean = src.startsWith('/') ? src.slice(1) : src
    const full = path.join(process.cwd(), 'public', clean)
    if (fs.existsSync(full)) {
        const ext = path.extname(full).toLowerCase()
        const contentType = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg'
        return { buffer: fs.readFileSync(full), contentType }
    }
    // Deployed fallback: fetch from the app's own public URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app'
    const res = await fetch(`${appUrl}/${clean}`)
    if (!res.ok) return null
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/png' }
}
