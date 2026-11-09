import {
    buildBrandedEmail,
    resolveBrand,
    type BrandedEmailInput,
    type EmailBrand,
    type EmailSettings,
} from "@/lib/email-templates"
import { LOGO_CID, resolveCompanyLogoAttachment, type EmailAttachment } from "@/lib/email-assets"

export type ComposedEmail = {
    subject: string
    html: string
    text: string
    attachments: EmailAttachment[]
    from: string
    replyTo?: string
    brand: EmailBrand
}

/**
 * One place that turns a company's own settings into a ready-to-send branded email:
 * logo attached inline, company-specific sender/reply-to, HTML + plain-text fallback.
 */
export async function composeBrandedEmail(args: {
    companyId: string
    settings: (EmailSettings & { logoUrl?: string | null; layoutPreferences?: any }) | null | undefined
    email: Omit<BrandedEmailInput, 'brand' | 'logoCid' | 'subject'> & { subject: string | ((brand: EmailBrand) => string) }
    extraAttachments?: EmailAttachment[]
    /** Fallback sender address when the company has no email saved (e.g. the sending user's email). */
    fallbackSenderEmail?: string | null
}): Promise<ComposedEmail> {
    const logo = await resolveCompanyLogoAttachment(args.settings as any, args.companyId)
    const brand = resolveBrand(args.settings, args.companyId, Boolean(logo))
    const subject = typeof args.email.subject === 'function' ? args.email.subject(brand) : args.email.subject
    const built = buildBrandedEmail({
        ...args.email,
        subject,
        brand,
        logoCid: logo ? LOGO_CID : undefined,
    })

    const senderAddress = brand.email || (args.fallbackSenderEmail || '').trim()
    const from = senderAddress
        ? `${brand.name} <${senderAddress}>`
        : `${brand.name} <onboarding@resend.dev>`

    return {
        ...built,
        attachments: [...(logo ? [logo] : []), ...(args.extraAttachments || [])],
        from,
        replyTo: senderAddress || undefined,
        brand,
    }
}
