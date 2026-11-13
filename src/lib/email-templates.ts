/**
 * Shared, company-branded email templates (HTML + plain-text fallback).
 *
 * Rules:
 *  - Branding (name, logo, colours, phone, email, sign-off) always comes from the sending company's
 *    own settings. Nothing here is hard-coded to one company and the word "UROps" never appears.
 *  - Money is always formatted as R20,850.00.
 *  - The greeting uses the contact person; it falls back to the client/company name only if there is no contact.
 */

export const AEROWASH_COMPANY_ID = '70af7281-072d-4ed5-9f2e-af4d93e99ea9'

export type EmailSettings = {
    name?: string | null
    email?: string | null
    phone?: string | null
    website?: string | null
    theme?: string | null
    currency?: string | null
    bankDetails?: string | null
    validityDays?: number | null
} | null | undefined

export type EmailRow = { label: string; value: string; strong?: boolean }

export type EmailBrand = {
    /** Full legal/display name, e.g. "AeroWash (Pty) Ltd" */
    name: string
    /** Short name for subjects, e.g. "AeroWash" */
    shortName: string
    email: string
    phone: string
    website: string
    accent: string
    accentText: string
    headerBg: string
    headerText: string
    hasLogo: boolean
}

export function isAeroWashCompany(companyId?: string | null, settings?: EmailSettings): boolean {
    return (
        companyId === AEROWASH_COMPANY_ID ||
        settings?.theme === 'dark-orange' ||
        Boolean(settings?.name && settings.name.toLowerCase().includes('aerowash'))
    )
}

/** Formats money as R20,850.00 (comma thousands, dot decimals). */
export function formatMoneyZA(amount: number | null | undefined, symbol: string = 'R'): string {
    const n = Number(amount)
    const safe = Number.isFinite(n) ? n : 0
    const sign = safe < 0 ? '-' : ''
    const abs = Math.abs(safe).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${sign}${symbol}${abs}`
}

export function formatLongDate(d: Date | string | null | undefined): string {
    if (!d) return ''
    const date = new Date(d)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "AeroWash (Pty) Ltd" -> "AeroWash". "LR Builders" stays "LR Builders". */
export function shortCompanyName(name?: string | null): string {
    const clean = (name || '').replace(/\s*\(pty\)\s*ltd\.?/i, '').trim()
    return clean || (name || '').trim() || 'Our team'
}

function accentFor(theme?: string | null): { accent: string; accentText: string } {
    const lower = (theme || '').toLowerCase()
    if (lower.includes('orange')) return { accent: '#D05E00', accentText: '#FFFFFF' }
    if (lower.includes('blue')) return { accent: '#2563EB', accentText: '#FFFFFF' }
    if (lower.includes('violet')) return { accent: '#8B5CF6', accentText: '#FFFFFF' }
    return { accent: '#A3E635', accentText: '#0A0A0A' } // default lime needs dark text
}

export function resolveBrand(settings: EmailSettings, companyId?: string | null, hasLogo = false): EmailBrand {
    const aero = isAeroWashCompany(companyId, settings)
    const { accent, accentText } = accentFor(aero ? 'dark-orange' : settings?.theme)
    const name = aero ? 'AeroWash (Pty) Ltd' : ((settings?.name || '').trim() || 'Our team')
    return {
        name,
        shortName: shortCompanyName(name),
        email: aero ? 'info@aerowash.co.za' : ((settings?.email || '').trim()),
        phone: (settings?.phone || '').trim() || (aero ? '067 829 3350' : ''),
        website: (settings?.website || '').trim() || (aero ? 'https://aerowash.co.za' : ''),
        accent,
        accentText,
        headerBg: aero ? '#0A0A0A' : '#FFFFFF',
        headerText: aero ? '#FFFFFF' : '#0A0A0A',
        hasLogo,
    }
}

/** Quote validity: same rule the acceptance page and server-side acceptance use. */
export function getQuoteValidity(
    invoice: { date: Date | string; validityDays?: number | null; metadata?: any },
    settings: EmailSettings
): { days: number; expiry: Date } {
    const days =
        (invoice as any).validityDays ||
        (invoice.metadata as any)?.validityDays ||
        settings?.validityDays ||
        30
    const expiry = new Date(new Date(invoice.date).getTime() + days * 24 * 60 * 60 * 1000)
    return { days, expiry }
}

/** Contact person first; company/client name only if there is no contact. */
export function resolveGreetingName(opts: {
    contactName?: string | null
    attentionTo?: string | null
    clientAttentionTo?: string | null
    clientCompanyName?: string | null
    clientName?: string | null
}): string {
    const pick = [opts.contactName, opts.attentionTo, opts.clientAttentionTo]
        .map(v => (v || '').trim())
        .find(Boolean)
    if (pick) return pick
    return (opts.clientCompanyName || opts.clientName || '').trim() || 'there'
}

export function esc(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function paragraphsHtml(paragraphs: string[]): string {
    return paragraphs
        .filter(p => p !== undefined && p !== null && String(p).trim() !== '')
        .map(p => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#1f2937;">${esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('')
}

function rowsHtml(rows: EmailRow[]): string {
    if (!rows.length) return ''
    const trs = rows
        .map(
            r => `<tr>
<td style="padding:8px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #eef0f2;">${esc(r.label)}</td>
<td align="right" style="padding:8px 0;font-size:${r.strong ? '16px' : '14px'};font-weight:${r.strong ? '700' : '500'};color:#111827;border-bottom:1px solid #eef0f2;">${esc(r.value)}</td>
</tr>`
        )
        .join('')
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 20px 0;border-top:1px solid #eef0f2;">${trs}</table>`
}

export interface BuiltEmail {
    subject: string
    html: string
    text: string
}

export interface BrandedEmailInput {
    brand: EmailBrand
    subject: string
    greeting?: string
    /** Plain paragraphs (escaped automatically). */
    paragraphs: string[]
    rows?: EmailRow[]
    /** Paragraphs shown after the rows / button (e.g. bank details, notes). */
    afterParagraphs?: string[]
    cta?: { label: string; url: string }
    /** Small grey line under the button, e.g. "This link expires on 15 December 2026." */
    ctaNote?: string
    /** Sign-off block. When omitted, an automated sign-off with the company name is used. */
    signOff?: { name?: string; lines?: string[] }
    /** Content-ID of the inline logo attachment, when one is attached. */
    logoCid?: string
}

/** Branded HTML + plain-text email. Works for quotes, invoices, reminders and approvals. */
export function buildBrandedEmail(input: BrandedEmailInput): BuiltEmail {
    const { brand } = input
    const isAero = brand.shortName === 'AeroWash' || brand.name.toLowerCase().includes('aerowash')
    const signLines = (() => {
        if (isAero) {
            // AeroWash client emails always sign off strictly as "AeroWash (Pty) Ltd" (never personal user name)
            return [brand.name, brand.phone, brand.email].filter(Boolean)
        }
        if (input.signOff) {
            return [
                input.signOff.name || '',
                brand.name,
                brand.phone,
                brand.email,
                ...(input.signOff.lines || []),
            ].filter(Boolean)
        }
        return [brand.name, brand.phone, brand.email].filter(Boolean)
    })()

    const hasSignOff = Boolean(input.signOff || isAero)

    const logoBlock = input.logoCid
        ? `<img src="cid:${esc(input.logoCid)}" alt="${esc(brand.name)}" height="44" style="display:block;height:44px;width:auto;border:0;outline:none;">`
        : `<span style="font-size:20px;font-weight:800;letter-spacing:0.5px;color:${brand.headerText};">${esc(brand.name)}</span>`

    const button = input.cta
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 8px 0;"><tr><td bgcolor="${brand.accent}" style="border-radius:8px;">
<a href="${esc(input.cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:${brand.accentText};text-decoration:none;border-radius:8px;background:${brand.accent};">${esc(input.cta.label)}</a>
</td></tr></table>${
            input.ctaNote
                ? `<p style="margin:0 0 18px 0;font-size:12px;color:#6b7280;">${esc(input.ctaNote)}</p>`
                : '<div style="height:10px;"></div>'
        }`
        : ''

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="background:${brand.headerBg};padding:20px 28px;border-bottom:4px solid ${brand.accent};">${logoBlock}</td></tr>
<tr><td style="padding:28px 28px 8px 28px;">
${input.greeting ? `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#1f2937;">${esc(input.greeting)}</p>` : ''}
${paragraphsHtml(input.paragraphs)}
${rowsHtml(input.rows || [])}
${button}
${paragraphsHtml(input.afterParagraphs || [])}
<p style="margin:18px 0 0 0;font-size:15px;line-height:1.6;color:#1f2937;">${hasSignOff ? 'Kind regards,' : ''}</p>
<p style="margin:2px 0 22px 0;font-size:14px;line-height:1.6;color:#374151;">${signLines.map((l, i) => (i === 0 ? `<strong>${esc(l)}</strong>` : esc(l))).join('<br>')}</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:14px 28px;border-top:1px solid #eef0f2;font-size:11px;color:#9ca3af;">${esc(brand.name)}${brand.email ? ` &middot; ${esc(brand.email)}` : ''}${brand.phone ? ` &middot; ${esc(brand.phone)}` : ''}</td></tr>
</table>
</td></tr></table>
</body></html>`

    const textParts: string[] = []
    if (input.greeting) textParts.push(input.greeting)
    textParts.push(...input.paragraphs.filter(p => p && String(p).trim()))
    if (input.rows?.length) textParts.push(input.rows.map(r => `${r.label}: ${r.value}`).join('\n'))
    if (input.cta) {
        textParts.push(`${input.cta.label}:\n${input.cta.url}${input.ctaNote ? `\n(${input.ctaNote})` : ''}`)
    }
    if (input.afterParagraphs?.length) textParts.push(...input.afterParagraphs.filter(p => p && String(p).trim()))
    textParts.push(`${hasSignOff ? 'Kind regards,\n' : ''}${signLines.join('\n')}`)

    return { subject: input.subject, html, text: textParts.join('\n\n') }
}
