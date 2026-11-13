'use server'

import { sendRealEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { ensureAuth, getAuthUser } from "@/lib/auth-actions"
import { isVatEffective, isInvalidLineItem } from "@/lib/vat-utils"
import { composeBrandedEmail } from "@/lib/email-compose"
import {
    formatLongDate,
    formatMoneyZA,
    getQuoteValidity,
    isAeroWashCompany,
    resolveGreetingName,
    type EmailRow,
} from "@/lib/email-templates"
import type { EmailAttachment } from "@/lib/email-assets"
import { getAppUrl } from "@/lib/app-url"

/**
 * Server-side gatekeeper:
 * Over-threshold quotes by non-owners are blocked server-side from PDF download, Excel export, email and share link until approved.
 * Per-company threshold: AeroWash = R50,000, LR Builders = off (NULL).
 */
export async function verifyQuoteActionPermission(
    invoiceId: string, 
    actionType: 'DOWNLOAD_PDF' | 'EMAIL' | 'SHARE_LINK' | 'EXPORT_EXCEL'
) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            select: { id: true, total: true, subtotal: true, type: true, quoteNumber: true, companyId: true, metadata: true }
        });
        if (!invoice) return { allowed: false, error: "Invoice not found or unauthorized." };

        // 1. Look up per-company approval threshold
        const settings = await prisma.companySettings.findUnique({ where: { companyId: invoice.companyId } });
        const threshold = settings?.approvalThreshold;

        // If threshold is not set (e.g. LR Builders), approval is entirely OFF!
        if (!threshold || threshold <= 0) {
            return { allowed: true };
        }

        const isOwner = authUser?.isOwner === true;
        const totalAmount = invoice.total || invoice.subtotal || 0;

        // If not a quote or under threshold, everyone is allowed
        if (invoice.type !== 'QUOTE' || totalAmount <= threshold) {
            return { allowed: true };
        }

        // Over-threshold quote: owner is always allowed
        if (isOwner) {
            return { allowed: true };
        }

        // Non-owner: check approval status
        const currentMeta = (invoice.metadata as any) || {};
        const approvalStatus = currentMeta.approvalStatus;

        if (approvalStatus !== 'APPROVED') {
            const actionLabel = actionType === 'DOWNLOAD_PDF' ? 'downloaded as PDF'
                              : actionType === 'EMAIL' ? 'sent via email'
                              : actionType === 'EXPORT_EXCEL' ? 'exported to Excel'
                              : 'shared via link';
            const statusLabel = approvalStatus === 'CHANGES_REQUESTED' ? 'Changes requested by owner' : 'Needs owner approval';
            return {
                allowed: false,
                error: `This quotation exceeds R${threshold.toLocaleString()} and requires owner approval before it can be ${actionLabel}. Current status: ${statusLabel}.`
            };
        }

        return { allowed: true };
    } catch (e: any) {
        return { allowed: false, error: e.message || "Failed to verify quote permissions." };
    }
}

async function ensureShareToken(invoiceId: string): Promise<string> {
    const row = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { metadata: true } });
    const currentMeta = (row?.metadata as any) || {};
    if (currentMeta.shareToken) return currentMeta.shareToken as string;
    const crypto = await import("crypto");
    const shareToken = crypto.randomBytes(16).toString('hex');
    await prisma.invoice.update({
        where: { id: invoiceId },
        data: { metadata: { ...currentMeta, shareToken } }
    });
    return shareToken;
}

/**
 * Sends a quote or invoice to the client as a branded HTML email (plain-text fallback included).
 * - Branding, sender, phone, logo and sign-off come from the sending company's own settings.
 * - The PDF (generated client-side, identical to the PDF download) is attached when supplied.
 * - AeroWash quotes get a secure "View & accept quote" button that stops accepting on the Valid until date.
 */
export async function sendInvoiceEmail(
    invoiceId: string,
    recipients?: string[],
    customBody?: string,
    pdf?: { filename: string; base64: string }
) {
    try {
        const companyId = await ensureAuth()
        const authUser = await getAuthUser()
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true, items: true, contact: true }
        })

        if (!invoice) {
            return { success: false, error: "Invoice not found or unauthorized" }
        }

        // Server-side blocking: over threshold by non-owners requires owner approval
        const perm = await verifyQuoteActionPermission(invoiceId, 'EMAIL');
        if (!perm.allowed) {
            return { success: false, error: perm.error };
        }

        if (!invoice.items || invoice.items.length === 0) {
            return { success: false, error: "Cannot send document: Document has no line items." }
        }

        const invalidItems = invoice.items.filter(item => isInvalidLineItem(item));
        if (invalidItems.length > 0) {
            return {
                success: false,
                error: `Cannot send document: ${invalidItems.length} line item(s) have zero or blank prices/quantities. Please review and price all items first.`
            }
        }

        const toEmails = recipients && recipients.length > 0 ? recipients : [invoice.client.email].filter(Boolean) as string[];

        if (toEmails.length === 0) {
            return { success: false, error: "No recipient emails provided" }
        }

        const settings = await prisma.companySettings.findUnique({ where: { companyId: invoice.companyId } });
        const isVatActive = isVatEffective(invoice.date, settings);
        const isAW = isAeroWashCompany(invoice.companyId, settings) || Boolean(invoice.quoteNumber?.startsWith('AW-'));
        const isQuote = invoice.type === 'QUOTE';
        const formattedNumber = invoice.quoteNumber || (isQuote ? `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}` : `INV-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`);
        const docTypeLabel = isQuote ? (isAW ? 'Quotation' : 'Quote') : (isVatActive ? 'Tax Invoice' : 'Invoice');
        const currency = settings?.currency || 'R';
        const appUrl = getAppUrl();

        // PDF attachment (same document as the PDF download)
        const extraAttachments: EmailAttachment[] = [];
        let pdfAttached = false;
        if (pdf?.base64) {
            const b64 = pdf.base64.includes('base64,') ? pdf.base64.split('base64,')[1] : pdf.base64;
            const buf = Buffer.from(b64, 'base64');
            if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') {
                const safeName = (pdf.filename || `${formattedNumber}.pdf`).replace(/[^A-Za-z0-9._ -]/g, '_');
                extraAttachments.push({ filename: safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`, content: buf, contentType: 'application/pdf' });
                pdfAttached = true;
            }
        }

        const greetingName = resolveGreetingName({
            contactName: invoice.contact?.name,
            attentionTo: invoice.attentionTo,
            clientAttentionTo: invoice.client.attentionTo,
            clientCompanyName: invoice.client.companyName,
            clientName: invoice.client.name,
        });

        const siteText = invoice.site ? ` for ${invoice.site.replace(/^Site:\s*/i, '')}` : '';
        const rows: EmailRow[] = [];
        const afterParagraphs: string[] = [];
        let cta: { label: string; url: string } | undefined;
        let ctaNote: string | undefined;

        if (isQuote) {
            const { expiry } = getQuoteValidity(invoice as any, settings);
            const validUntil = formatLongDate(expiry);
            rows.push({ label: 'Total', value: formatMoneyZA(invoice.total, currency), strong: true });
            if (validUntil) rows.push({ label: 'Valid until', value: validUntil });
            if (isAW) {
                const token = await ensureShareToken(invoice.id);
                cta = { label: 'View & accept quote', url: `${appUrl}/quote/${token}` };
                ctaNote = validUntil ? `This secure link is valid until ${validUntil}.` : undefined;
            }
        } else {
            const pct = invoice.firstPaymentPercentage;
            const isDepositInvoice = Boolean((invoice.metadata as any)?.isDepositInvoice);
            const hasPartial = Boolean(pct && pct > 0 && pct < 100 && !isDepositInvoice);
            if (hasPartial) {
                rows.push({ label: 'Invoice total', value: formatMoneyZA(invoice.total, currency) });
                rows.push({ label: `Deposit due (${pct}%)`, value: formatMoneyZA(invoice.total * (pct! / 100), currency), strong: true });
            } else {
                rows.push({ label: 'Amount due', value: formatMoneyZA(invoice.total, currency), strong: true });
            }
            if (invoice.dueDate) rows.push({ label: 'Due date', value: formatLongDate(invoice.dueDate) });
            if (settings?.bankDetails && settings.bankDetails.trim()) {
                afterParagraphs.push(`Banking details:\n${settings.bankDetails.trim()}\nPayment reference: ${formattedNumber}`);
            }
        }

        const intro = pdfAttached
            ? `Please find attached your ${docTypeLabel} ${formattedNumber}${siteText}.`
            : `Your ${docTypeLabel} ${formattedNumber}${siteText} is ready.`;

        const isAero = isAeroWashCompany(invoice.companyId, settings);
        const senderName = isAero ? undefined : ((authUser?.name || '').trim() || undefined);
        const composed = await composeBrandedEmail({
            companyId: invoice.companyId,
            settings,
            fallbackSenderEmail: isAero ? undefined : authUser?.email,
            extraAttachments,
            email: customBody
                ? {
                    subject: (b) => `${docTypeLabel} ${formattedNumber} from ${b.shortName}`,
                    greeting: undefined,
                    paragraphs: customBody.split(/\n{2,}/),
                    cta: undefined,
                }
                : {
                    subject: (b) => `${docTypeLabel} ${formattedNumber} from ${b.shortName}`,
                    greeting: `Hi ${greetingName},`,
                    paragraphs: [intro, ...(isQuote ? ['Review the details below, or reply to this email if you have any questions.'] : ['Reply to this email if you have any questions.'])],
                    rows,
                    cta,
                    ctaNote,
                    afterParagraphs,
                    signOff: isAero ? undefined : { name: senderName },
                },
        });

        // Subject uses the sending company's short name (e.g. "Quotation AW-2026-008 from AeroWash")
        const subject = `${docTypeLabel} ${formattedNumber} from ${composed.brand.shortName}`;

        const result = await sendRealEmail({
            to: toEmails,
            subject,
            body: composed.text,
            html: composed.html,
            from: composed.from,
            replyTo: composed.replyTo,
            attachments: composed.attachments,
            companyId: invoice.companyId,
            companyName: composed.brand.name,
            actorUserId: authUser?.id,
            actorName: authUser?.name || authUser?.email,
            triggeredByUserAction: true,
        })

        if (!result.success) {
            return { success: false, error: result.error || "Failed to send email" }
        }

        await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
                status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status
            }
        })

        return { 
            success: true, 
            messageId: (result as any).id || (result as any).data?.id,
            sandboxRerouted: (result as any).sandboxRerouted,
            note: (result as any).note,
            attachmentIncluded: pdfAttached
        }
    } catch (error: any) {
        console.error("sendInvoiceEmail error:", error)
        return { success: false, error: error.message || "Failed to send email" }
    }
}

export async function requestQuoteApprovalAction(invoiceId: string, isResubmission = false) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const existingHistory = Array.isArray(currentMeta.approvalHistory) ? currentMeta.approvalHistory : [];

        const newHistoryEntry = {
            action: isResubmission ? 'RESUBMITTED' : 'SUBMITTED',
            user: authUser?.name || authUser?.email || 'Admin User',
            userEmail: authUser?.email || '',
            timestamp: new Date().toISOString()
        };

        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'PENDING',
            needsApproval: true,
            approvalRequestedAt: new Date().toISOString(),
            approvalRequestedBy: authUser?.name || authUser?.email || 'Admin User',
            approvalRequestedByEmail: authUser?.email || '',
            approvalHistory: [...existingHistory, newHistoryEntry]
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        // Dynamic Owner Lookup: Query all owners in this company
        const owners = await prisma.user.findMany({
            where: { companyId, isOwner: true },
            select: { email: true, notificationEmail: true, name: true }
        });

        // Recipient addresses: use notificationEmail or real login email (never invent admin@ addresses)
        const ownerEmails = owners.map(o => (o.notificationEmail && o.notificationEmail.trim()) || o.email).filter(Boolean);

        // Fetch company settings to check copyNotificationsTo
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        if (settings?.copyNotificationsTo && settings.copyNotificationsTo.includes('@')) {
            if (!ownerEmails.includes(settings.copyNotificationsTo)) {
                ownerEmails.push(settings.copyNotificationsTo);
            }
        }

        const formattedNumber = invoice.quoteNumber || `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`;
        const appUrl = getAppUrl();
        const quoteUrl = `${appUrl}/invoices/${invoice.id}`;
        const currency = settings?.currency || 'R';

        if (ownerEmails.length > 0) {
            const composed = await composeBrandedEmail({
                companyId,
                settings,
                fallbackSenderEmail: authUser?.email,
                email: {
                    subject: isResubmission
                        ? `Resubmitted for Approval: Quotation ${formattedNumber} (${invoice.client.name} — ${formatMoneyZA(invoice.total, currency)})`
                        : `Approval Required: Quotation ${formattedNumber} (${invoice.client.name} — ${formatMoneyZA(invoice.total, currency)})`,
                    greeting: 'Hello,',
                    paragraphs: [
                        isResubmission
                            ? `Quotation ${formattedNumber} for ${invoice.client.name} has been revised and resubmitted for owner approval.`
                            : `Quotation ${formattedNumber} for ${invoice.client.name} exceeds the approval limit and needs your approval before it can be sent.`,
                    ],
                    rows: [
                        { label: 'Quotation', value: formattedNumber },
                        { label: 'Client', value: invoice.client.name },
                        { label: 'Total', value: formatMoneyZA(invoice.total, currency), strong: true },
                        { label: isResubmission ? 'Updated by' : 'Requested by', value: authUser?.name || authUser?.email || 'Team member' },
                        { label: 'Site', value: invoice.site || 'N/A' },
                    ],
                    cta: { label: 'Review quote', url: quoteUrl },
                    ctaNote: 'Sign in to approve it, or send it back with a note.',
                },
            });

            const emailRes = await sendRealEmail({
                to: ownerEmails,
                subject: composed.subject,
                body: composed.text,
                html: composed.html,
                from: composed.from,
                replyTo: composed.replyTo,
                attachments: composed.attachments,
                companyId,
                companyName: composed.brand.name,
                actorUserId: authUser?.id,
                actorName: authUser?.name || authUser?.email,
                triggeredByUserAction: true,
            });

            if (!emailRes.success) {
                return { success: true, warning: `Approval requested, but owner email notification failed: ${emailRes.error}` };
            }
        }

        return { success: true };
    } catch (e: any) {
        console.error("requestQuoteApprovalAction error:", e);
        return { success: false, error: e.message || "Failed to request approval" };
    }
}

export async function resubmitQuoteApprovalAction(invoiceId: string) {
    return requestQuoteApprovalAction(invoiceId, true);
}

export async function ownerApproveQuoteAction(invoiceId: string) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();

        // Dynamic Owner Verification
        if (!authUser?.isOwner) {
            return { success: false, error: "Only a company OWNER can approve quotes over the limit." };
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const existingHistory = Array.isArray(currentMeta.approvalHistory) ? currentMeta.approvalHistory : [];

        const newHistoryEntry = {
            action: 'APPROVED',
            user: authUser?.name || authUser?.email || 'Owner',
            userEmail: authUser?.email || '',
            timestamp: new Date().toISOString()
        };

        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'APPROVED',
            needsApproval: false,
            approvedAt: new Date().toISOString(),
            approvedBy: authUser?.name || authUser?.email || 'Owner',
            approvalHistory: [...existingHistory, newHistoryEntry]
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        return { success: true };
    } catch (e: any) {
        console.error("ownerApproveQuoteAction error:", e);
        return { success: false, error: e.message || "Failed to approve quote" };
    }
}


export async function sendBackQuoteAction(invoiceId: string, note: string) {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();

        if (!authUser?.isOwner) {
            return { success: false, error: "Only a company OWNER can send back quotes for revision." };
        }

        if (!note || note.trim().length === 0) {
            return { success: false, error: "A note explaining the requested changes is required." };
        }

        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, companyId },
            include: { client: true }
        });
        if (!invoice) return { success: false, error: "Invoice not found" };

        const currentMeta = (invoice.metadata as any) || {};
        const existingHistory = Array.isArray(currentMeta.approvalHistory) ? currentMeta.approvalHistory : [];

        const newHistoryEntry = {
            action: 'CHANGES_REQUESTED',
            note: note.trim(),
            user: authUser?.name || authUser?.email || 'Owner',
            userEmail: authUser?.email || '',
            timestamp: new Date().toISOString()
        };

        const updatedMeta = {
            ...currentMeta,
            approvalStatus: 'CHANGES_REQUESTED',
            latestOwnerNote: note.trim(),
            changesRequestedAt: new Date().toISOString(),
            changesRequestedBy: authUser?.name || authUser?.email || 'Owner',
            approvalHistory: [...existingHistory, newHistoryEntry]
        };

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { metadata: updatedMeta }
        });

        // Notify creator (never invent fake admin@ emails; use real login or notificationEmail)
        const creatorEmail = currentMeta.approvalRequestedByEmail || currentMeta.createdByUserEmail;
        const recipients: string[] = [];
        if (creatorEmail && creatorEmail.includes('@')) {
            const creatorUser = await prisma.user.findFirst({
                where: { companyId, email: creatorEmail },
                select: { email: true, notificationEmail: true }
            });
            const target = (creatorUser?.notificationEmail && creatorUser.notificationEmail.trim()) || creatorEmail;
            recipients.push(target);
        } else {
            const teamMembers = await prisma.user.findMany({
                where: { companyId },
                select: { email: true, notificationEmail: true, isOwner: true }
            });
            const nonOwners = teamMembers.filter(m => !m.isOwner);
            if (nonOwners.length > 0) {
                nonOwners.forEach(m => {
                    const target = (m.notificationEmail && m.notificationEmail.trim()) || m.email;
                    if (target) recipients.push(target);
                });
            } else if (authUser?.email) {
                recipients.push(authUser.email);
            }
        }

        // Copy all notifications to company-level address if configured (e.g. info@aerowash.co.za)
        const compSettings = await prisma.companySettings.findUnique({ where: { companyId } });
        if (compSettings?.copyNotificationsTo && compSettings.copyNotificationsTo.includes('@')) {
            if (!recipients.includes(compSettings.copyNotificationsTo)) {
                recipients.push(compSettings.copyNotificationsTo);
            }
        }

        const formattedNumber = invoice.quoteNumber || `Q-${new Date(invoice.date).getFullYear()}-${String(invoice.number).padStart(3, '0')}`;
        const appUrl = getAppUrl();
        const quoteUrl = `${appUrl}/invoices/${invoice.id}`;

        if (recipients.length > 0) {
            const composed = await composeBrandedEmail({
                companyId,
                settings: compSettings,
                fallbackSenderEmail: authUser?.email,
                email: {
                    subject: `Changes Requested: Quotation ${formattedNumber} (${invoice.client.name})`,
                    greeting: 'Hello,',
                    paragraphs: [
                        `The company owner has reviewed quotation ${formattedNumber} for ${invoice.client.name} and requested the following revisions:`,
                        `"${note.trim()}"`,
                    ],
                    afterParagraphs: ['Please open the quote, make the requested adjustments, and save to resubmit for approval.'],
                    cta: { label: 'Open quote', url: quoteUrl },
                },
            });

            const emailRes = await sendRealEmail({
                to: recipients,
                from: composed.from,
                replyTo: composed.replyTo,
                subject: composed.subject,
                body: composed.text,
                html: composed.html,
                attachments: composed.attachments,
                companyId,
                companyName: composed.brand.name,
                actorUserId: authUser?.id,
                actorName: authUser?.name || authUser?.email,
                triggeredByUserAction: true,
            });

            if (!emailRes.success) {
                return { success: true, emailWarning: `Quote sent back, but email notification failed: ${emailRes.error}` };
            }
        }

        return { success: true };
    } catch (e: any) {
        console.error("sendBackQuoteAction error:", e);
        return { success: false, error: e.message || "Failed to send back quote." };
    }
}

export async function getQuoteShareLinkAction(invoiceId: string) {
    const perm = await verifyQuoteActionPermission(invoiceId, 'SHARE_LINK');
    if (!perm.allowed) {
        return { success: false, error: perm.error };
    }
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, metadata: true }
    });
    if (!invoice) return { success: false, error: "Quote not found" };

    const currentMeta = (invoice.metadata as any) || {};
    let shareToken = currentMeta.shareToken;
    if (!shareToken) {
        const crypto = await import("crypto");
        shareToken = crypto.randomBytes(16).toString('hex');
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                metadata: {
                    ...currentMeta,
                    shareToken
                }
            }
        });
    }

    const appUrl = getAppUrl();
    return { success: true, shareUrl: `${appUrl}/quote/${shareToken}` };
}

export async function getPendingApprovalsAction() {
    try {
        const companyId = await ensureAuth();
        const authUser = await getAuthUser();
        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        const threshold = settings?.approvalThreshold;

        // If threshold is off (null), no approvals!
        if (!threshold || threshold <= 0) return { quotes: [] };
        if (!authUser?.isOwner) return { quotes: [] };

        const quotes = await prisma.invoice.findMany({
            where: {
                companyId,
                type: 'QUOTE',
                total: { gt: threshold }
            },
            select: {
                id: true,
                quoteNumber: true,
                total: true,
                metadata: true,
                date: true,
                client: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        const pending = quotes.filter(q => (q.metadata as any)?.approvalStatus === 'PENDING');
        return {
            quotes: pending.map(q => ({
                id: q.id,
                quoteNumber: q.quoteNumber,
                clientName: q.client?.name || 'Unknown Client',
                total: q.total
            }))
        };
    } catch (e: any) {
        console.error("getPendingApprovalsAction error:", e);
        return { quotes: [] };
    }
}
