"use server"

import { isVatEffective, getVatRate, calculateVatAndTotal } from "@/lib/vat-utils"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ensureAuth } from "@/lib/auth-actions"

import { updateProjectStatus } from "../projects/actions"

export async function createInvoiceAction(data: {
    clientId: string
    projectId?: string
    date: string
    items: { description: string; quantity: number; unitPrice: number; area?: string; unit?: string; reason?: string; code?: string; isLocked?: boolean; rateYear?: number; metadata?: any }[]
    metadata?: any
    site?: string
    quoteNumber?: string
    reference?: string
    projectName?: string // New field
    type?: 'QUOTE' | 'INVOICE'
    paymentNotes?: string
    firstPaymentPercentage?: number
    contactId?: string | null
    attentionTo?: string | null
    workType?: 'GENERAL' | 'TENDER'
    tenderId?: string | null
    rateYear?: number
    termsTemplateId?: string | null
    customTermsBody?: string | null
    prospectId?: string
}) {
    const companyId = await ensureAuth()
    console.log('[createInvoiceAction] Initiating invoice/quote creation:', {
        companyId,
        clientId: data.clientId,
        type: data.type,
        workType: data.workType,
        site: data.site,
        itemsCount: data.items?.length,
        hasMetadata: !!data.metadata
    });

    try {
        const year = new Date().getFullYear();
    let nextNumber = 0;
    let formattedQuoteNumber = data.quoteNumber;
    const isInvoice = data.type === 'INVOICE';
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    if (!settings) throw new Error("Company settings not found");
    const isTendersEnabled = settings.tendersEnabled === true;
    const isTender = isTendersEnabled && data.workType === 'TENDER';

    if (!data.clientId || typeof data.clientId !== 'string') {
        throw new Error("A valid client must be selected before saving.");
    }
    const clientObj = await prisma.client.findFirst({
        where: { id: data.clientId, companyId }
    });
    if (!clientObj) throw new Error("Client not found for this workspace. Please select or add a client.");

    // Fetch tender if workType is TENDER
    const tender = isTender
        ? (data.tenderId
            ? await prisma.tender.findFirst({ where: { id: data.tenderId, companyId } })
            : await prisma.tender.findFirst({ where: { companyId, status: "ACTIVE" } }))
        : null;

    const codePrefix = clientObj.codePrefix;
    const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' 
        || settings.name?.toLowerCase().includes('aerowash')
        || settings.theme === 'dark-orange';

    if (isAeroWash) {
        if (data.quoteNumber) {
            const manualNumber = data.quoteNumber;
            const match = manualNumber.match(/(\d+)$/);
            if (match) {
                const manualSeq = parseInt(match[1]);
                const currentSeq = isInvoice ? (settings.lastInvoiceNumber || 0) : (settings.lastQuoteNumber || 0);
                if (manualSeq > currentSeq) {
                    await prisma.companySettings.update({
                        where: { companyId },
                        data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: manualSeq }
                    });
                }
                nextNumber = manualSeq;
            } else {
                nextNumber = (isInvoice ? (settings.lastInvoiceNumber || 0) : (settings.lastQuoteNumber || 0)) + 1;
            }
            formattedQuoteNumber = data.quoteNumber;

            // Check uniqueness of manual number
            const existing = await prisma.invoice.findFirst({
                where: {
                    companyId,
                    quoteNumber: formattedQuoteNumber,
                    type: data.type || 'QUOTE'
                }
            });
            if (existing) {
                throw new Error(`${data.type || 'QUOTE'} number ${formattedQuoteNumber} has already been used. Please use a new number.`);
            }
        } else {
            let isUnique = false;
            while (!isUnique) {
                const updatedSettings = await prisma.companySettings.update({
                    where: { companyId },
                    data: isInvoice
                        ? { lastInvoiceNumber: { increment: 1 } }
                        : { lastQuoteNumber: { increment: 1 } }
                });
                nextNumber = isInvoice ? updatedSettings.lastInvoiceNumber : updatedSettings.lastQuoteNumber;
                formattedQuoteNumber = isInvoice
                    ? `INV-${year}-${nextNumber.toString().padStart(3, '0')}`
                    : `AW-${year}-${nextNumber.toString().padStart(3, '0')}`;

                const existing = await prisma.invoice.findFirst({
                    where: {
                        companyId,
                        quoteNumber: formattedQuoteNumber,
                        type: data.type || 'QUOTE'
                    }
                });
                if (!existing) {
                    isUnique = true;
                }
            }
        }
    } else if (isTender && tender) {
        const tenderPrefix = isInvoice ? (tender.invoicePrefix || "CCT-TI") : (tender.quotePrefix || "CCT-T");
        if (data.quoteNumber) {
            formattedQuoteNumber = data.quoteNumber;
            const match = data.quoteNumber.match(/(\d+)$/);
            if (match) {
                const manualSeq = parseInt(match[1]);
                const currentSeq = isInvoice ? (clientObj.lastInvoiceNumber || 0) : (clientObj.lastQuoteNumber || 0);
                if (manualSeq > currentSeq) {
                    await prisma.client.update({
                        where: { id: data.clientId },
                        data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: manualSeq }
                    });
                }
                nextNumber = manualSeq;
            } else {
                nextNumber = (isInvoice ? (clientObj.lastInvoiceNumber || 0) : (clientObj.lastQuoteNumber || 0)) + 1;
            }
        } else {
            let isUnique = false;
            while (!isUnique) {
                const updatedClient = await prisma.client.update({
                    where: { id: data.clientId },
                    data: isInvoice
                        ? { lastInvoiceNumber: { increment: 1 } }
                        : { lastQuoteNumber: { increment: 1 } }
                });
                nextNumber = isInvoice ? updatedClient.lastInvoiceNumber : updatedClient.lastQuoteNumber;
                formattedQuoteNumber = `${tenderPrefix}-${year}-${nextNumber.toString().padStart(3, '0')}`;

                const existing = await prisma.invoice.findFirst({
                    where: {
                        companyId,
                        quoteNumber: formattedQuoteNumber,
                        type: data.type || 'QUOTE'
                    }
                });
                if (!existing) {
                    isUnique = true;
                }
            }
        }
    } else if (codePrefix) {
        if (data.quoteNumber) {
            const manualNumber = data.quoteNumber;
            const match = manualNumber.match(/(\d+)$/);
            if (match) {
                const manualSeq = parseInt(match[1]);
                const currentClient = await prisma.client.findFirst({
                    where: { id: data.clientId, companyId }
                });
                const currentSeq = isInvoice ? (currentClient?.lastInvoiceNumber || 0) : (currentClient?.lastQuoteNumber || 0);
                if (manualSeq > currentSeq) {
                    await prisma.client.update({
                        where: { id: data.clientId },
                        data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: manualSeq }
                    });
                }
                nextNumber = manualSeq;
            } else {
                nextNumber = (isInvoice ? (clientObj.lastInvoiceNumber || 0) : (clientObj.lastQuoteNumber || 0)) + 1;
            }
            formattedQuoteNumber = data.quoteNumber;

            // Check uniqueness of manual number
            const existing = await prisma.invoice.findFirst({
                where: {
                    companyId,
                    quoteNumber: formattedQuoteNumber,
                    type: data.type || 'QUOTE'
                }
            });
            if (existing) {
                throw new Error(`${data.type || 'QUOTE'} number ${formattedQuoteNumber} has already been used. Please use a new number.`);
            }
        } else {
            let isUnique = false;
            while (!isUnique) {
                const updatedClient = await prisma.client.update({
                    where: { id: data.clientId },
                    data: isInvoice
                        ? { lastInvoiceNumber: { increment: 1 } }
                        : { lastQuoteNumber: { increment: 1 } }
                });
                nextNumber = isInvoice ? updatedClient.lastInvoiceNumber : updatedClient.lastQuoteNumber;
                formattedQuoteNumber = isInvoice
                    ? `${codePrefix}-INV-${year}-${nextNumber.toString().padStart(3, '0')}`
                    : `${codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`;

                const existing = await prisma.invoice.findFirst({
                    where: {
                        companyId,
                        quoteNumber: formattedQuoteNumber,
                        type: data.type || 'QUOTE'
                    }
                });
                if (!existing) {
                    isUnique = true;
                }
            }
        }
    } else {
        if (data.quoteNumber) {
            const manualNumber = data.quoteNumber;
            const match = manualNumber.match(/(\d+)$/);
            if (match) {
                const manualSeq = parseInt(match[1]);
                const currentSeq = isInvoice ? (settings.lastInvoiceNumber || 0) : (settings.lastQuoteNumber || 0);
                if (manualSeq > currentSeq) {
                    await prisma.companySettings.update({
                        where: { companyId },
                        data: { [isInvoice ? 'lastInvoiceNumber' : 'lastQuoteNumber']: manualSeq }
                    });
                }
                nextNumber = manualSeq;
            } else {
                nextNumber = (isInvoice ? (settings.lastInvoiceNumber || 0) : (settings.lastQuoteNumber || 0)) + 1;
            }
            formattedQuoteNumber = data.quoteNumber;

            // Check uniqueness of manual number
            const existing = await prisma.invoice.findFirst({
                where: {
                    companyId,
                    quoteNumber: formattedQuoteNumber,
                    type: data.type || 'QUOTE'
                }
            });
            if (existing) {
                throw new Error(`${data.type || 'QUOTE'} number ${formattedQuoteNumber} has already been used. Please use a new number.`);
            }
        } else {
            let isUnique = false;
            while (!isUnique) {
                const updatedSettings = await prisma.companySettings.update({
                    where: { companyId },
                    data: isInvoice
                        ? { lastInvoiceNumber: { increment: 1 } }
                        : { lastQuoteNumber: { increment: 1 } }
                });
                nextNumber = isInvoice ? updatedSettings.lastInvoiceNumber : updatedSettings.lastQuoteNumber;
                formattedQuoteNumber = isInvoice
                    ? `INV-${year}-${nextNumber.toString().padStart(3, '0')}`
                    : `Q-${year}-${nextNumber.toString().padStart(3, '0')}`;

                const existing = await prisma.invoice.findFirst({
                    where: {
                        companyId,
                        quoteNumber: formattedQuoteNumber,
                        type: data.type || 'QUOTE'
                    }
                });
                if (!existing) {
                    isUnique = true;
                }
            }
        }
    }
    let effectiveProjectId = data.projectId;

    // Always associate a project for new quotes
    if (!effectiveProjectId) {
        // Build default name: [Site] - [Reference] (No redundant dates)
        const defaultName = [data.site, data.reference].filter(Boolean).join(" - ") || "New Project";
        const candidateName = (data.projectName || defaultName).trim();

        const existingProject = await prisma.project.findFirst({
            where: {
                companyId,
                clientId: data.clientId,
                name: { equals: candidateName, mode: 'insensitive' }
            }
        });

        if (existingProject) {
            effectiveProjectId = existingProject.id;
        } else {
            const project = await prisma.project.create({
                data: {
                    companyId,
                    name: candidateName,
                    clientId: data.clientId,
                    status: 'SOW',
                    workflowStage: 'SOW',
                    description: `Created from Quotation ${formattedQuoteNumber} on ${data.date}`
                }
            });
            effectiveProjectId = project.id;
        }
    }

    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const vatEffective = isVatEffective(data.date, settings);
    const vatRate = getVatRate(settings);
    const { taxRate, taxAmount, total } = calculateVatAndTotal(subtotal, vatEffective, vatRate);

    const invoice = await prisma.invoice.create({
        data: {
            companyId,
            clientId: data.clientId,
            projectId: effectiveProjectId,
            contactId: data.contactId || null,
            attentionTo: data.attentionTo || null,
            date: new Date(data.date),
            type: data.type || 'QUOTE', // Use provided type or default to Quote
            status: 'DRAFT',
            number: nextNumber,
            subtotal,
            taxRate,
            taxAmount,
            total,
            site: data.site,
            quoteNumber: formattedQuoteNumber,
            reference: data.reference,
            paymentNotes: data.paymentNotes,
            firstPaymentPercentage: data.firstPaymentPercentage,
            workType: data.workType || 'GENERAL',
            tenderId: data.tenderId || (isTender ? tender?.id : null),
            rateYear: data.rateYear || 1,
            metadata: data.metadata || undefined,
            items: {
                create: data.items.map((item, idx) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    area: (item.area || ""),
                    unit: (item.unit || ""),
                    reason: (item.reason || null),
                    code: (item.code || null),
                    isLocked: Boolean(item.isLocked),
                    rateYear: item.rateYear || (isTender ? (data.rateYear || 1) : null),
                    total: item.quantity * item.unitPrice,
                    position: idx,
                    metadata: (item as any).metadata || undefined
                }))
            }
        }
    })

    // Upload site inspection photos to private Supabase Storage bucket (companyId/quoteId/)
    if (data.metadata?.siteVisitPhotos && Array.isArray(data.metadata.siteVisitPhotos) && data.metadata.siteVisitPhotos.length > 0) {
        try {
            const { uploadQuotePhoto } = await import("@/lib/supabase-storage");
            let photosChanged = false;
            const uploadedPhotos = await Promise.all(
                data.metadata.siteVisitPhotos.map(async (photo: any, pIdx: number) => {
                    if (photo.url && photo.url.startsWith('data:')) {
                        try {
                            const filename = `photo-${photo.photoNumber || (pIdx + 1).toString().padStart(2, '0')}.jpg`;
                            const storagePath = await uploadQuotePhoto(companyId, invoice.id, filename, photo.url);
                            photosChanged = true;
                            return { ...photo, url: storagePath };
                        } catch (uErr) {
                            console.error(`[createInvoiceAction] Failed to upload photo ${pIdx + 1} to storage:`, uErr);
                            return photo;
                        }
                    }
                    return photo;
                })
            );

            if (photosChanged) {
                const updatedMeta = { ...data.metadata, siteVisitPhotos: uploadedPhotos };
                await prisma.invoice.update({
                    where: { id: invoice.id },
                    data: { metadata: updatedMeta }
                });
            }
        } catch (storageErr) {
            console.error('[createInvoiceAction] Supabase storage upload error:', storageErr);
        }
    }

    // Snapshot Quotation Terms and Conditions
    if (invoice.type === 'QUOTE') {
        let position = 0;
        let templateToUse: any = null;

        if (data.termsTemplateId) {
            templateToUse = await prisma.termsTemplate.findFirst({
                where: { id: data.termsTemplateId, companyId }
            });
        } else if (data.termsTemplateId === undefined) {
            // Check client default first, then company default
            const targetTemplateId = clientObj.defaultTermsTemplateId;
            if (targetTemplateId) {
                templateToUse = await prisma.termsTemplate.findFirst({
                    where: { id: targetTemplateId, companyId }
                });
            }
            if (!templateToUse) {
                templateToUse = await prisma.termsTemplate.findFirst({
                    where: { companyId, isDefault: true }
                });
            }
        }

        if (templateToUse && templateToUse.body.trim()) {
            await prisma.quoteTerm.create({
                data: {
                    quoteId: invoice.id,
                    source: 'template',
                    templateId: templateToUse.id,
                    bodySnapshot: templateToUse.body.trim(),
                    position: position++
                }
            });
        }

        const effectiveCustomTerms = data.customTermsBody !== undefined
            ? (data.customTermsBody?.trim() || "")
            : (clientObj.defaultCustomTerms?.trim() || "");

        if (effectiveCustomTerms) {
            await prisma.quoteTerm.create({
                data: {
                    quoteId: invoice.id,
                    source: 'custom',
                    templateId: null,
                    bodySnapshot: effectiveCustomTerms,
                    position: position++
                }
            });
        }
    }

    if (effectiveProjectId) {
        if (invoice.status === 'PENDING_SCOPE') {
            await prisma.project.update({
                where: { id: effectiveProjectId, companyId },
                data: {
                    status: 'SOW',
                    workflowStage: 'SOW'
                }
            });
        } else {
            await prisma.project.update({
                where: { id: effectiveProjectId, companyId },
                data: {
                    status: isInvoice ? 'INVOICED' : 'SCHEDULED',
                    workflowStage: isInvoice ? 'INVOICE' : 'QUOTATION'
                }
            });
        }
    }

    // Update linked prospect if exists
    const targetProspectId = (data as any).prospectId || (clientObj?.customFields as any)?.prospectId;
    if (targetProspectId) {
        try {
            const p = await prisma.prospect.findUnique({ where: { id: targetProspectId } });
            if (p && p.companyId === companyId) {
                const existingLog = (p.contactLog as any[]) || [];
                await prisma.prospect.update({
                    where: { id: targetProspectId },
                    data: {
                        status: 'quoted',
                        lastContactDate: new Date(),
                        contactLog: [
                            ...existingLog,
                            {
                                date: new Date().toISOString(),
                                method: 'status',
                                outcome: `Quotation #${formattedQuoteNumber} created for ${data.site || p.name}`,
                                quoteId: invoice.id
                            }
                        ]
                    }
                });
            }
        } catch (pErr) {
            console.warn("Could not link prospect on quote creation:", pErr);
        }
    }

    revalidatePath("/drone");
    revalidatePath("/invoices");
    revalidatePath("/projects");
    revalidatePath("/clients");
    revalidatePath(`/clients/${data.clientId}`);
    if (effectiveProjectId) {
        revalidatePath(`/projects/${effectiveProjectId}`);
    }

    console.log('[createInvoiceAction] Invoice created successfully with ID:', invoice.id, 'Number:', formattedQuoteNumber);
    return invoice.id;
    } catch (err: any) {
        console.error('[createInvoiceAction] FATAL ERROR:', {
            name: err?.name,
            message: err?.message,
            code: err?.code,
            meta: err?.meta,
            stack: err?.stack,
            companyId,
            clientId: data.clientId
        });
        throw new Error(err?.message || "Failed to save quotation on server.");
    }
}

export async function markAssociatedQuotesAsPaid(invoiceId: string, companyId: string) {
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId, companyId },
        include: { items: true }
    });
    if (!invoice || invoice.type !== 'INVOICE') return;

    let quoteNumberToMark: string | null = null;
    for (const item of invoice.items) {
        if (item.description && item.description.includes("As per quotation")) {
            const match = item.description.match(/As per quotation\s+(\S+)/);
            if (match) {
                quoteNumberToMark = match[1];
                break;
            }
        }
    }

    if (quoteNumberToMark) {
        await prisma.invoice.updateMany({
            where: {
                companyId,
                clientId: invoice.clientId,
                type: 'QUOTE',
                quoteNumber: quoteNumberToMark,
                status: { not: 'PAID' }
            },
            data: { status: 'PAID' }
        });
    }

    if (invoice.wbpId) {
        await prisma.invoice.updateMany({
            where: {
                companyId,
                wbpId: invoice.wbpId,
                type: 'QUOTE',
                status: { not: 'PAID' }
            },
            data: { status: 'PAID' }
        });
    }
}

export async function updateInvoiceStatus(id: string, status: any) { // Type check loose for brevity
    const companyId = await ensureAuth()
    const invoice = await prisma.invoice.update({
        where: { id, companyId },
        data: { status },
        include: { client: true, project: true }
    })
    
    if (status === 'PAID') {
        await markAssociatedQuotesAsPaid(id, companyId);
    }

    // PART 4: Link prospect updates
    const prospectId = (invoice.client?.customFields as any)?.prospectId;
    if (prospectId) {
        try {
            const p = await prisma.prospect.findUnique({ where: { id: prospectId } });
            if (p && p.companyId === companyId) {
                const existingLog = (p.contactLog as any[]) || [];
                const now = new Date();

                if (status === 'SENT' && p.status !== 'won') {
                    await prisma.prospect.update({
                        where: { id: prospectId },
                        data: {
                            status: 'quoted',
                            lastContactDate: now,
                            contactLog: [
                                ...existingLog,
                                {
                                    date: now.toISOString(),
                                    method: 'email',
                                    outcome: `Quote #${invoice.quoteNumber || invoice.number} sent to client`,
                                    quoteId: invoice.id
                                }
                            ]
                        }
                    });
                } else if (status === 'ACCEPTED') {
                    await prisma.prospect.update({
                        where: { id: prospectId },
                        data: {
                            status: 'won',
                            lastContactDate: now,
                            contactLog: [
                                ...existingLog,
                                {
                                    date: now.toISOString(),
                                    method: 'status',
                                    outcome: `Quote #${invoice.quoteNumber || invoice.number} accepted - Deal won!`,
                                    quoteId: invoice.id
                                }
                            ]
                        }
                    });

                    // Auto-create or update Project
                    if (!invoice.projectId) {
                        const newProject = await prisma.project.create({
                            data: {
                                companyId,
                                name: `${invoice.client.name} - ${invoice.site || 'Site Work'}`,
                                clientId: invoice.clientId,
                                status: 'SCHEDULED',
                                workflowStage: 'SOW',
                                commercialStatus: 'AWAITING_PO',
                                description: `Project auto-created from accepted Quote #${invoice.quoteNumber || invoice.number}`
                            }
                        });
                        await prisma.invoice.update({
                            where: { id: invoice.id },
                            data: { projectId: newProject.id }
                        });
                    } else {
                        await prisma.project.update({
                            where: { id: invoice.projectId },
                            data: {
                                status: 'SCHEDULED',
                                workflowStage: 'SOW',
                                commercialStatus: 'AWAITING_PO'
                            }
                        });
                    }
                } else if (status === 'REJECTED' || status === 'CANCELLED') {
                    await prisma.prospect.update({
                        where: { id: prospectId },
                        data: {
                            status: 'lost',
                            lastContactDate: now,
                            contactLog: [
                                ...existingLog,
                                {
                                    date: now.toISOString(),
                                    method: 'status',
                                    outcome: `Quote #${invoice.quoteNumber || invoice.number} rejected/cancelled`,
                                    quoteId: invoice.id
                                }
                            ]
                        }
                    });
                }
            }
        } catch (pErr) {
            console.warn("Could not update linked prospect in updateInvoiceStatus:", pErr);
        }
    }
    
    revalidatePath(`/invoices/${id}`)
    revalidatePath("/invoices")
    revalidatePath("/drone")
    revalidatePath("/clients")
    revalidatePath(`/clients/${invoice.clientId}`)
    if (invoice.projectId) {
        revalidatePath(`/projects/${invoice.projectId}`)
    }
}

export async function getQuoteSequenceAction(clientId?: string, workType: 'GENERAL' | 'TENDER' = 'GENERAL', tenderId?: string) {
    const companyId = await ensureAuth();
    const year = new Date().getFullYear();

    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' 
        || settings?.name?.toLowerCase().includes('aerowash')
        || settings?.theme === 'dark-orange';

    if (isAeroWash) {
        const lastQuote = await prisma.invoice.findFirst({
            where: { companyId, type: 'QUOTE' },
            orderBy: { number: 'desc' }
        });
        const nextNumber = Math.max(settings?.lastQuoteNumber || 0, lastQuote?.number || 0) + 1;
        return `AW-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    if (workType === 'TENDER') {
        const tender = tenderId
            ? await prisma.tender.findFirst({ where: { id: tenderId, companyId } })
            : await prisma.tender.findFirst({ where: { companyId, status: "ACTIVE" } });
        const prefix = tender?.quotePrefix || "CCT-T";
        const client = clientId
            ? await prisma.client.findFirst({ where: { id: clientId, companyId } })
            : (tender ? await prisma.client.findFirst({ where: { id: tender.clientId } }) : null);

        const lastQuote = await prisma.invoice.findFirst({
            where: { companyId, workType: 'TENDER', type: 'QUOTE' },
            orderBy: { number: 'desc' }
        });
        const nextNumber = Math.max(client?.lastQuoteNumber || 0, lastQuote?.number || 0) + 1;
        return `${prefix}-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    if (clientId) {
        const client = await prisma.client.findFirst({
            where: { id: clientId, companyId }
        });
        if (client && client.codePrefix) {
            const lastQuote = await prisma.invoice.findFirst({
                where: { companyId, clientId, type: 'QUOTE' },
                orderBy: { number: 'desc' }
            });
            const nextNumber = Math.max(client.lastQuoteNumber || 0, lastQuote?.number || 0) + 1;
            return `${client.codePrefix}-Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }

    // Find the highest number used in existing quotes
    const lastQuote = await prisma.invoice.findFirst({
        where: { companyId, type: 'QUOTE' },
        orderBy: { number: 'desc' }
    });

    if (!settings) return null;

    // Use whichever is higher: the DB counter or the highest actual number found
    const nextNumber = Math.max(settings.lastQuoteNumber || 0, lastQuote?.number || 0) + 1;
    return `Q-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function getInvoiceSequenceAction(clientId?: string, workType: 'GENERAL' | 'TENDER' = 'GENERAL', tenderId?: string) {
    const companyId = await ensureAuth();
    const year = new Date().getFullYear();

    const settings = await prisma.companySettings.findUnique({
        where: { companyId }
    });

    const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' 
        || settings?.name?.toLowerCase().includes('aerowash')
        || settings?.theme === 'dark-orange';

    if (isAeroWash) {
        const lastInvoice = await prisma.invoice.findFirst({
            where: { companyId, type: 'INVOICE' },
            orderBy: { number: 'desc' }
        });
        const nextNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
        return `INV-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    if (workType === 'TENDER') {
        const tender = tenderId
            ? await prisma.tender.findFirst({ where: { id: tenderId, companyId } })
            : await prisma.tender.findFirst({ where: { companyId, status: "ACTIVE" } });
        const prefix = tender?.invoicePrefix || "CCT-TI";
        const client = clientId
            ? await prisma.client.findFirst({ where: { id: clientId, companyId } })
            : (tender ? await prisma.client.findFirst({ where: { id: tender.clientId } }) : null);

        const lastInvoice = await prisma.invoice.findFirst({
            where: { companyId, workType: 'TENDER', type: 'INVOICE' },
            orderBy: { number: 'desc' }
        });
        const nextNumber = Math.max(client?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
        return `${prefix}-${year}-${nextNumber.toString().padStart(3, '0')}`;
    }

    if (clientId) {
        const client = await prisma.client.findFirst({
            where: { id: clientId, companyId }
        });
        if (client && client.codePrefix) {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, clientId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            const nextNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            return `${client.codePrefix}-INV-${year}-${nextNumber.toString().padStart(3, '0')}`;
        }
    }

    // Find the highest number used in existing invoices
    const lastInvoice = await prisma.invoice.findFirst({
        where: { companyId, type: 'INVOICE' },
        orderBy: { number: 'desc' }
    });

    if (!settings) return null;

    const nextNumber = Math.max(settings.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
    return `INV-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export async function convertToInvoiceAction(id: string, clientPoNumber?: string, firstPaymentPercentage?: number, presentationStyle?: 'AS_PER_QUOTATION' | 'DETAILED') {
    const companyId = await ensureAuth()

    // 1. Get the original quote details
    const quote = await prisma.invoice.findUnique({
        where: { id, companyId },
        include: {
            items: {
                orderBy: { position: 'asc' }
            },
            client: true
        }
    });
    if (!quote) throw new Error("Quote not found");

    if (!quote.items || quote.items.length === 0) {
        throw new Error("Cannot convert quotation: Quote has no line items.");
    }
    const isNoChargeLine = (item: any): boolean => {
        if (!item) return false;
        const meta = (item.metadata || item.internalMetadata || {}) as any;
        if (meta.isNoCharge || meta.isIncluded) return true;
        const label = String(meta.label || '').trim().toLowerCase();
        if (label === 'no charge' || label === 'included') return true;
        if (meta.itemNumber === 11 || meta.itemNumber === 14) return true;

        const desc = String(item.description || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        const notes = String(item.notes || '').toLowerCase();
        const combined = `${name} ${desc} ${notes}`;
        if (combined.includes('site visit & facade assessment') || combined.includes('service photo record')) {
            return true;
        }
        if (combined.includes('no charge') || combined.includes('included')) {
            return true;
        }
        return false;
    };

    const invalidItems = quote.items.filter(item => {
        const qty = Number(item.quantity);
        if (!qty || isNaN(qty) || qty <= 0) return true;
        const price = Number(item.unitPrice ?? 0);
        if (isNaN(price) || price < 0) return true;
        if (price === 0) {
            return !isNoChargeLine(item);
        }
        return false;
    });
    if (invalidItems.length > 0) {
        throw new Error(`Cannot convert quotation to invoice: ${invalidItems.length} line item(s) have zero or blank prices/quantities. Please review and price all items first.`);
    }

    const client = quote.client;
    const isTender = quote.workType === 'TENDER';
    const tender = isTender
        ? (quote.tenderId
            ? await prisma.tender.findFirst({ where: { id: quote.tenderId, companyId } })
            : await prisma.tender.findFirst({ where: { companyId, status: "ACTIVE" } }))
        : null;

    const companySettings = await prisma.companySettings.findUnique({ where: { companyId } });
    const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' 
        || companySettings?.name?.toLowerCase().includes('aerowash')
        || companySettings?.theme === 'dark-orange';

    const codePrefix = client.codePrefix;
    let nextInvoiceNumber = 0;
    const year = new Date().getFullYear();
    let formattedInvoiceNumber = "";

    // 2. Get the next invoice number based on tender prefix, client prefix or settings
    let isUnique = false;
    while (!isUnique) {
        if (isAeroWash) {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            nextInvoiceNumber = Math.max(companySettings?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.companySettings.update({
                where: { companyId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        } else if (isTender && tender) {
            const tenderPrefix = tender.invoicePrefix || "CCT-TI";
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, workType: 'TENDER', type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            nextInvoiceNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.client.update({
                where: { id: quote.clientId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `${tenderPrefix}-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        } else if (codePrefix) {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, clientId: quote.clientId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            nextInvoiceNumber = Math.max(client.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.client.update({
                where: { id: quote.clientId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `${codePrefix}-INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        } else {
            const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId, type: 'INVOICE' },
                orderBy: { number: 'desc' }
            });
            const settings = await prisma.companySettings.findUnique({ where: { companyId } });
            nextInvoiceNumber = Math.max(settings?.lastInvoiceNumber || 0, lastInvoice?.number || 0) + 1;
            await prisma.companySettings.update({
                where: { companyId },
                data: { lastInvoiceNumber: nextInvoiceNumber }
            });
            formattedInvoiceNumber = `INV-${year}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        }

        const existing = await prisma.invoice.findFirst({
            where: {
                companyId,
                quoteNumber: formattedInvoiceNumber,
                type: 'INVOICE'
            }
        });
        if (!existing) {
            isUnique = true;
        }
    }

    // 4. Determine VAT eligibility for newly issued invoice
    const invoiceDate = new Date();
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    const vatEffective = isVatEffective(invoiceDate, settings);
    const vatRate = getVatRate(settings);
    const { taxRate: newTaxRate, taxAmount: newTaxAmount, total: newTotal } = calculateVatAndTotal(quote.subtotal, vatEffective, vatRate);

    // 5. Create the NEW separate Invoice record
    const invoice = await prisma.invoice.create({
        data: {
            companyId: quote.companyId,
            clientId: quote.clientId,
            projectId: quote.projectId,
            wbpId: quote.wbpId,
            contactId: quote.contactId || null,
            attentionTo: quote.attentionTo || null,
            workType: quote.workType,
            tenderId: quote.tenderId,
            rateYear: quote.rateYear,
            type: 'INVOICE',
            status: 'DRAFT',
            number: nextInvoiceNumber,
            subtotal: quote.subtotal,
            taxRate: newTaxRate,
            taxAmount: newTaxAmount,
            total: newTotal,
            site: quote.site,
            quoteNumber: formattedInvoiceNumber, // This is the label for the NEW invoice
            reference: quote.quoteNumber || quote.reference || null,
            clientPoNumber: clientPoNumber || null,
            paymentNotes: presentationStyle || 'AS_PER_QUOTATION',
            firstPaymentPercentage: firstPaymentPercentage !== undefined ? firstPaymentPercentage : quote.firstPaymentPercentage,
            date: new Date(), // Current date for the invoice
            metadata: (quote as any).metadata || undefined,
            items: {
                create: quote.items.map((item, idx) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    area: item.area || "",
                    unit: item.unit || "ea",
                    reason: item.reason || null,
                    code: item.code || null,
                    isLocked: Boolean(item.isLocked),
                    rateYear: item.rateYear || quote.rateYear || 1,
                    total: item.total || (item.quantity * item.unitPrice),
                    position: idx,
                    metadata: (item as any).metadata || undefined
                }))
            }
        }
    })

    // 5. Update the original Quote status to reflect it's been converted, but keep as QUOTE
    await prisma.invoice.update({
        where: { id: quote.id },
        data: { status: 'INVOICED' }
    })

    // PART 4: Update linked prospect to WON
    const prospectId = (client?.customFields as any)?.prospectId;
    if (prospectId) {
        try {
            const p = await prisma.prospect.findUnique({ where: { id: prospectId } });
            if (p && p.companyId === companyId) {
                const existingLog = (p.contactLog as any[]) || [];
                await prisma.prospect.update({
                    where: { id: prospectId },
                    data: {
                        status: 'won',
                        lastContactDate: new Date(),
                        contactLog: [
                            ...existingLog,
                            {
                                date: new Date().toISOString(),
                                method: 'status',
                                outcome: `Quote #${quote.quoteNumber || quote.number} converted to Invoice #${formattedInvoiceNumber} - Won!`,
                                quoteId: quote.id
                            }
                        ]
                    }
                });
            }
        } catch (pErr) {
            console.warn("Could not update linked prospect in convertToInvoiceAction:", pErr);
        }
    }

    // 6. Update Project Stage
    if (invoice.projectId) {
        await prisma.project.update({
            where: { id: invoice.projectId },
            data: {
                status: 'INVOICED',
                workflowStage: 'INVOICE'
            }
        })
    }

    revalidatePath(`/invoices/${invoice.id}`)
    revalidatePath(`/invoices`)
    return invoice.id;
}

export async function recordPaymentAction(data: {
    invoiceId: string
    amount: number
    method: string
    notes?: string
    date: string
}) {
    const companyId = await ensureAuth()
    // Verify invoice belongs to company
    const currentInvoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId, companyId }
    })
    if (!currentInvoice) throw new Error("Invoice not found")

    const payment = await prisma.payment.create({
        data: {
            companyId,
            invoiceId: data.invoiceId,
            amount: data.amount,
            method: data.method,
            notes: data.notes,
            date: new Date(data.date)
        }
    })

    // Calculate totals
    const invoice = await prisma.invoice.findUnique({
        where: { id: data.invoiceId, companyId },
        include: { payments: true }
    })

    if (invoice) {
        const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
        let newStatus = invoice.status

        if (totalPaid >= invoice.total) {
            newStatus = 'PAID'
        } else if (totalPaid > 0) {
            newStatus = 'PARTIAL'
        }

        if (newStatus !== invoice.status) {
            await prisma.invoice.update({
                where: { id: data.invoiceId, companyId },
                data: { status: newStatus }
            })

            // IF FULLY PAID, also mark the associated quote as PAID so it leaves the quote folder
            if (newStatus === 'PAID') {
                await markAssociatedQuotesAsPaid(data.invoiceId, companyId);
            }
        }

        if (invoice.projectId) {
            const isDepositInvoice = (invoice.metadata as any)?.isDepositInvoice || invoice.firstPaymentPercentage === 60 || invoice.paymentNotes?.toLowerCase().includes('deposit');
            if (isDepositInvoice) {
                await prisma.project.update({
                    where: { id: invoice.projectId },
                    data: {
                        status: 'SCHEDULED',
                        commercialStatus: 'PO_RECEIVED',
                        description: `Ready to schedule - Deposit payment of R${data.amount} recorded on ${new Date().toLocaleDateString()}`
                    }
                });

                try {
                    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
                    const ownerEmails = ['uthmaan@aerowash.co.za'];
                    if (settings?.copyNotificationsTo && !ownerEmails.includes(settings.copyNotificationsTo)) {
                        ownerEmails.push(settings.copyNotificationsTo);
                    }
                    const { sendRealEmail } = await import("@/lib/email");
                    await sendRealEmail({
                        to: ownerEmails,
                        from: 'AeroWash Payments <info@aerowash.co.za>',
                        replyTo: 'info@aerowash.co.za',
                        subject: `Deposit Paid: Project Ready to Schedule (${invoice.quoteNumber || invoice.number} — R${data.amount})`,
                        body: `Hello Uthmaan,\n\nA deposit payment of R${data.amount.toFixed(2)} has been recorded against invoice ${invoice.quoteNumber || invoice.number}.\n\nThe linked project is now marked "Ready to schedule" in your operations queue.\n\nView Project:\n${process.env.NEXT_PUBLIC_APP_URL || 'https://ur-ops.vercel.app'}/projects/${invoice.projectId}\n\nUROps Automated Workflow`
                    });
                } catch (notifErr) {
                    console.error("Deposit payment notification error:", notifErr);
                }
            } else if (newStatus === 'PAID') {
                await updateProjectStatus(invoice.projectId, 'COMPLETED')
            } else {
                await updateProjectStatus(invoice.projectId, 'PAID')
            }
        }
    }

    revalidatePath(`/invoices/${data.invoiceId}`)
    revalidatePath("/invoices")
    revalidatePath("/clients")
    if (invoice) {
        revalidatePath(`/clients/${invoice.clientId}`)
        if (invoice.projectId) {
            // If an unsent DRAFT balance invoice exists on this project and payment was recorded against another invoice (e.g. late deposit), recalculate the draft balance invoice automatically
            const otherDraftBal = await prisma.invoice.findFirst({
                where: {
                    projectId: invoice.projectId,
                    companyId,
                    type: "INVOICE",
                    status: "DRAFT",
                    id: { not: invoice.id }
                }
            })
            if (otherDraftBal && ((otherDraftBal.metadata as any)?.isBalanceInvoice || (otherDraftBal.metadata as any)?.isVisitInvoice)) {
                const { upsertProjectBalanceInvoiceDraft } = await import("@/lib/balance-invoice")
                await upsertProjectBalanceInvoiceDraft({
                    projectId: invoice.projectId,
                    companyId
                })
                revalidatePath(`/invoices/${otherDraftBal.id}`)
            }
            revalidatePath(`/projects/${invoice.projectId}`)
        }
    }
}

export async function deleteInvoiceAction(id: string) {
    const companyId = await ensureAuth()
    // Verify invoice belongs to company
    const invoice = await prisma.invoice.findUnique({
        where: { id, companyId }
    })
    if (!invoice) throw new Error("Invoice not found")

    // Delete related payments first
    await prisma.payment.deleteMany({
        where: { invoiceId: id }
    })

    // Delete invoice items
    await prisma.invoiceItem.deleteMany({
        where: { invoiceId: id }
    })

    // Delete the invoice
    await prisma.invoice.delete({
        where: { id, companyId }
    })

    revalidatePath("/invoices")
    revalidatePath("/clients")
    revalidatePath(`/clients/${invoice.clientId}`)
    if (invoice.projectId) {
        revalidatePath(`/projects/${invoice.projectId}`)
    }
    redirect("/invoices")
}

export async function createStatementAction(clientId: string, totalDue: number) {
    const companyId = await ensureAuth()
    
    const client = await prisma.client.findFirst({
        where: { id: clientId, companyId }
    });
    if (!client) throw new Error("Client not found");

    const codePrefix = client.codePrefix;
    let nextNumber: number;

    if (codePrefix) {
        const lastStatement = await prisma.statement.findFirst({
            where: { companyId, clientId },
            orderBy: { number: 'desc' }
        });
        nextNumber = Math.max(client.lastStatementNumber || 0, lastStatement?.number || 0) + 1;
        await prisma.client.update({
            where: { id: clientId },
            data: { lastStatementNumber: nextNumber }
        });
    } else {
        const lastStatement = await prisma.statement.findFirst({
            where: { companyId },
            orderBy: { number: 'desc' }
        });
        const settings = await prisma.companySettings.findUnique({
            where: { companyId }
        });
        if (!settings) throw new Error("Company settings not found");
        nextNumber = Math.max(settings.lastStatementNumber || 0, lastStatement?.number || 0) + 1;
        await prisma.companySettings.update({
            where: { companyId },
            data: { lastStatementNumber: nextNumber }
        });
    }

    const year = new Date().getFullYear();
    const statementNumber = codePrefix
        ? `${codePrefix}-STM-${year}-${nextNumber.toString().padStart(3, '0')}`
        : `STM-${year}-${nextNumber.toString().padStart(3, '0')}`;

    const statement = await prisma.statement.create({
        data: {
            companyId,
            clientId,
            number: nextNumber,
            statementNumber,
            totalDue,
            date: new Date()
        }
    });

    revalidatePath(`/clients/${clientId}`);
    return statementNumber;
}


/**
 * Fetches catalog items for the active workspace.
 * AeroWash: loads from CatalogueItem (22 items: 10 cleaning, 4 assessment, 6 site conditions, 2 contracts)
 * LR Builders: loads from FixedPriceItem (123 items: 115 tender, 8 general)
 */
export async function getWorkspaceCatalogAction() {
    const companyId = await ensureAuth();
    try {
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        const isAeroWash = companyId === '70af7281-072d-4ed5-9f2e-af4d93e99ea9' 
            || settings?.theme === 'dark-orange'
            || settings?.name?.toLowerCase().includes('aerowash');

        if (isAeroWash) {
            const items = await (prisma as any).catalogueItem.findMany({
                where: { companyId, isActive: true },
                orderBy: { itemNumber: 'asc' }
            }).catch(() => []);

            if (items && items.length > 0) {
                const getRateNote = (pricingMethod: string) => {
                    switch (pricingMethod) {
                        case 'BAND_RATE': return 'Band A–E (R16–R34/m²)';
                        case 'ITEM_1_PLUS_15_PERCENT': return 'Item 1 +15%';
                        case 'PERCENT_OF_ELEVATION_BAND_DEFAULT_12': return '12% of elevation';
                        case 'PERCENT_OF_ELEVATION_DEFAULT_25': return '25% of elevation';
                        case 'PRICE_ON_QUOTE': return 'Price on quote';
                        case 'SOLAR_PANEL_RATE': return 'R6 client / R10 AeroWash';
                        case 'FREE_ASSESSMENT': return 'No charge (R0)';
                        case 'PHOTO_RECORD': return 'Included / On quote';
                        case 'PERCENT_OF_CLEANING_LINES_10': return '10% of cleaning lines';
                        case 'REGIONAL_WATER_PER_LITRE': return "Atlantis R0.30/L · Simon's Town R0.85/L";
                        case 'CONTRACT_PROGRAMME_DISCOUNT': return 'Biannual -10% · Quarterly -15% · Monthly -20%';
                        case 'CONTRACT_COMBINED_PROGRAMME': return '8× Glazing + 4× Facade / yr';
                        default: return 'Rate Card Rev 13';
                    }
                };

                return items.map((i: any) => ({
                    id: i.id,
                    code: `#${i.itemNumber}`,
                    itemNumber: i.itemNumber,
                    name: i.name,
                    description: i.name,
                    clientDescription: i.clientDescription,
                    category: i.category,
                    pricingMethod: i.pricingMethod,
                    internalNotes: i.internalNotes,
                    unitPrice: 0,
                    unit: i.category === 'CONTRACTS' ? 'programme' : 'service',
                    isCatalogueItem: true,
                    rateNote: getRateNote(i.pricingMethod)
                }));
            }
        }

        // LR Builders or other: read FixedPriceItem
        return await prisma.fixedPriceItem.findMany({
            where: { companyId },
            include: { 
                client: { select: { id: true, name: true } },
                tender: { select: { id: true, name: true, tenderNumber: true } }
            },
            orderBy: { description: 'asc' }
        });
    } catch (error) {
        console.error("Error fetching workspace catalog:", error);
        return [];
    }
}
