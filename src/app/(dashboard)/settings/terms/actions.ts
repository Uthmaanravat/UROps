"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAuth } from "@/lib/auth-actions"

/**
 * Fetch all terms templates belonging to the user's business.
 * Ordered with default first, then alphabetically by name.
 */
export async function getTermsTemplatesAction() {
    const companyId = await ensureAuth()

    const templates = await prisma.termsTemplate.findMany({
        where: { companyId },
        include: {
            _count: {
                select: {
                    versions: true,
                    quoteTerms: true
                }
            }
        },
        orderBy: [
            { isDefault: 'desc' },
            { name: 'asc' }
        ]
    })

    return templates
}

/**
 * Fetch version history for a specific terms template.
 */
export async function getTermsTemplateVersionsAction(templateId: string) {
    const companyId = await ensureAuth()

    const template = await prisma.termsTemplate.findFirst({
        where: { id: templateId, companyId }
    })
    if (!template) {
        throw new Error("Template not found or access denied")
    }

    const versions = await prisma.termsTemplateVersion.findMany({
        where: { templateId },
        orderBy: { version: 'desc' }
    })

    return versions
}

/**
 * Create or update a terms template.
 * - Enforces single default per business.
 * - On update, increments version and archives a version snapshot.
 */
export async function saveTermsTemplateAction(data: {
    id?: string
    name: string
    body: string
    isDefault?: boolean
}) {
    const companyId = await ensureAuth()
    const trimmedName = data.name.trim()
    const trimmedBody = data.body.trim()

    if (!trimmedName) throw new Error("Template name is required")
    if (!trimmedBody) throw new Error("Template terms body is required")

    return await prisma.$transaction(async (tx) => {
        // If this template is being set as default, clear default from all other templates for this business
        if (data.isDefault) {
            await tx.termsTemplate.updateMany({
                where: { companyId, isDefault: true },
                data: { isDefault: false }
            })
        }

        if (data.id) {
            // Update existing template
            const existing = await tx.termsTemplate.findFirst({
                where: { id: data.id, companyId }
            })
            if (!existing) throw new Error("Template not found")

            const nextVersion = existing.version + 1

            const updated = await tx.termsTemplate.update({
                where: { id: data.id },
                data: {
                    name: trimmedName,
                    body: trimmedBody,
                    isDefault: data.isDefault ?? existing.isDefault,
                    version: nextVersion
                }
            })

            // Save new version snapshot
            await tx.termsTemplateVersion.create({
                data: {
                    templateId: updated.id,
                    version: nextVersion,
                    name: trimmedName,
                    body: trimmedBody
                }
            })

            return updated
        } else {
            // Check if this is the first template for the company; if so, make it default automatically
            const existingCount = await tx.termsTemplate.count({
                where: { companyId }
            })
            const willBeDefault = data.isDefault !== undefined ? data.isDefault : (existingCount === 0)

            if (willBeDefault) {
                await tx.termsTemplate.updateMany({
                    where: { companyId, isDefault: true },
                    data: { isDefault: false }
                })
            }

            const created = await tx.termsTemplate.create({
                data: {
                    companyId,
                    name: trimmedName,
                    body: trimmedBody,
                    isDefault: willBeDefault,
                    version: 1
                }
            })

            // Record initial version 1 snapshot
            await tx.termsTemplateVersion.create({
                data: {
                    templateId: created.id,
                    version: 1,
                    name: trimmedName,
                    body: trimmedBody
                }
            })

            return created
        }
    }).then((res) => {
        revalidatePath("/settings/terms")
        revalidatePath("/invoices")
        revalidatePath("/invoices/new")
        return res
    })
}

/**
 * Delete a terms template. Quotes already issued retain their body snapshots
 * because QuoteTerm.templateId is onDelete: SetNull.
 */
export async function deleteTermsTemplateAction(templateId: string) {
    const companyId = await ensureAuth()

    const existing = await prisma.termsTemplate.findFirst({
        where: { id: templateId, companyId }
    })
    if (!existing) throw new Error("Template not found")

    await prisma.termsTemplate.delete({
        where: { id: templateId }
    })

    revalidatePath("/settings/terms")
    revalidatePath("/invoices")
    revalidatePath("/invoices/new")
    return { success: true }
}

/**
 * Mark a template as the default for the business.
 */
export async function setDefaultTermsTemplateAction(templateId: string) {
    const companyId = await ensureAuth()

    await prisma.$transaction(async (tx) => {
        const existing = await tx.termsTemplate.findFirst({
            where: { id: templateId, companyId }
        })
        if (!existing) throw new Error("Template not found")

        await tx.termsTemplate.updateMany({
            where: { companyId, isDefault: true },
            data: { isDefault: false }
        })

        await tx.termsTemplate.update({
            where: { id: templateId },
            data: { isDefault: true }
        })
    })

    revalidatePath("/settings/terms")
    revalidatePath("/invoices")
    revalidatePath("/invoices/new")
    return { success: true }
}

/**
 * Restore a prior version of a terms template.
 * Bumps the template version and writes a new version entry so history is never lost.
 */
export async function restoreTermsTemplateVersionAction(templateId: string, versionNumber: number) {
    const companyId = await ensureAuth()

    return await prisma.$transaction(async (tx) => {
        const template = await tx.termsTemplate.findFirst({
            where: { id: templateId, companyId }
        })
        if (!template) throw new Error("Template not found")

        const versionRecord = await tx.termsTemplateVersion.findUnique({
            where: {
                templateId_version: {
                    templateId,
                    version: versionNumber
                }
            }
        })
        if (!versionRecord) throw new Error("Version record not found")

        const nextVersion = template.version + 1

        const updated = await tx.termsTemplate.update({
            where: { id: templateId },
            data: {
                name: versionRecord.name,
                body: versionRecord.body,
                version: nextVersion
            }
        })

        await tx.termsTemplateVersion.create({
            data: {
                templateId,
                version: nextVersion,
                name: versionRecord.name,
                body: versionRecord.body
            }
        })

        return updated
    }).then((res) => {
        revalidatePath("/settings/terms")
        revalidatePath("/invoices")
        return res
    })
}

/**
 * Save custom terms as a brand new template for the business so recurring variations can be reused.
 */
export async function saveCustomTermsAsTemplateAction(data: { name: string; body: string }) {
    const companyId = await ensureAuth()
    const trimmedName = data.name.trim()
    const trimmedBody = data.body.trim()

    if (!trimmedName) throw new Error("Template name is required")
    if (!trimmedBody) throw new Error("Terms body is required")

    const created = await prisma.$transaction(async (tx) => {
        const template = await tx.termsTemplate.create({
            data: {
                companyId,
                name: trimmedName,
                body: trimmedBody,
                isDefault: false,
                version: 1
            }
        })

        await tx.termsTemplateVersion.create({
            data: {
                templateId: template.id,
                version: 1,
                name: trimmedName,
                body: trimmedBody
            }
        })

        return template
    })

    revalidatePath("/settings/terms")
    revalidatePath("/invoices/new")
    return created
}

/**
 * Snapshot terms onto a quote.
 * Rules:
 * - A quote that has been sent/locked is immutable, terms included.
 * - Persists exact snapshots of template text and/or custom terms.
 */
export async function saveQuoteTermsAction(quoteId: string, data: {
    templateId?: string | null
    customTermsBody?: string | null
}) {
    const companyId = await ensureAuth()

    const quote = await prisma.invoice.findFirst({
        where: { id: quoteId, companyId }
    })
    if (!quote) throw new Error("Quote not found")

    // Immutability check: if quote is locked, do not allow modifying terms
    const isLocked = ['SENT', 'ACCEPTED', 'REJECTED', 'PAID', 'INVOICED'].includes(quote.status)
    if (isLocked) {
        throw new Error("This quote has already been issued or locked and cannot be modified.")
    }

    return await prisma.$transaction(async (tx) => {
        // Clear previous quote terms for this quote
        await tx.quoteTerm.deleteMany({
            where: { quoteId }
        })

        let positionCounter = 0

        // 1. Template terms snapshot
        if (data.templateId) {
            const template = await tx.termsTemplate.findFirst({
                where: { id: data.templateId, companyId }
            })
            if (template && template.body.trim()) {
                await tx.quoteTerm.create({
                    data: {
                        quoteId,
                        source: 'template',
                        templateId: template.id,
                        bodySnapshot: template.body.trim(),
                        position: positionCounter++
                    }
                })
            }
        }

        // 2. Custom terms snapshot
        if (data.customTermsBody && data.customTermsBody.trim()) {
            await tx.quoteTerm.create({
                data: {
                    quoteId,
                    source: 'custom',
                    templateId: null,
                    bodySnapshot: data.customTermsBody.trim(),
                    position: positionCounter++
                }
            })
        }

        return tx.quoteTerm.findMany({
            where: { quoteId },
            orderBy: { position: 'asc' }
        })
    }).then((res) => {
        revalidatePath(`/invoices/${quoteId}`)
        return res
    })
}
